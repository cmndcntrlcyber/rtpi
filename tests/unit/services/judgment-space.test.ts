import { describe, it, expect } from "vitest";
import { JudgmentSpace } from "../../../server/services/judgment/judgment-space";
import { JudgmentLens } from "../../../server/services/judgment/judgment-lens";

describe("JudgmentSpace", () => {
  it("creates with empty state", () => {
    const space = new JudgmentSpace("agent1", "op1");
    const snap = space.getSnapshot();
    expect(snap.activeHypotheses).toEqual([]);
    expect(snap.decisionHistory).toEqual([]);
    expect(snap.constraints).toEqual([]);
  });

  it("adds and retrieves hypotheses", () => {
    const space = new JudgmentSpace("agent1", "op1");
    space.addHypothesis("target vulnerable", 0.7);
    const snap = space.getSnapshot();
    expect(snap.activeHypotheses).toHaveLength(1);
    expect(snap.activeHypotheses[0].statement).toBe("target vulnerable");
    expect(snap.activeHypotheses[0].confidence).toBe(0.7);
  });

  it("caps hypotheses at MAX (20)", () => {
    const space = new JudgmentSpace("agent1", "op1");
    for (let i = 0; i < 21; i++) {
      space.addHypothesis(`hypothesis ${i}`, 0.5);
    }
    const snap = space.getSnapshot();
    expect(snap.activeHypotheses.length).toBeLessThanOrEqual(20);
  });

  it("updates hypothesis confidence on support", () => {
    const space = new JudgmentSpace("agent1", "op1");
    const h = space.addHypothesis("target vulnerable", 0.5);
    space.updateHypothesis(h.id, "port 443 open", "support");
    const snap = space.getSnapshot();
    const updated = snap.activeHypotheses.find((x) => x.id === h.id);
    expect(updated!.confidence).toBeGreaterThan(0.5);
  });

  it("updates hypothesis confidence on contradict", () => {
    const space = new JudgmentSpace("agent1", "op1");
    const h = space.addHypothesis("target vulnerable", 0.5);
    space.updateHypothesis(h.id, "firewall blocks all", "contradict");
    const snap = space.getSnapshot();
    const updated = snap.activeHypotheses.find((x) => x.id === h.id);
    expect(updated!.confidence).toBeLessThan(0.5);
  });

  it("auto-archives hypothesis below threshold", () => {
    const space = new JudgmentSpace("agent1", "op1");
    const h = space.addHypothesis("unlikely theory", 0.15);
    space.updateHypothesis(h.id, "evidence 1", "contradict");
    space.updateHypothesis(h.id, "evidence 2", "contradict");
    space.updateHypothesis(h.id, "evidence 3", "contradict");
    const snap = space.getSnapshot();
    const found = snap.activeHypotheses.find((x) => x.id === h.id);
    expect(found).toBeUndefined();
  });

  it("records decisions and caps at 50", () => {
    const space = new JudgmentSpace("agent1", "op1");
    for (let i = 0; i < 55; i++) {
      space.recordDecision({
        iteration: i,
        action: `action-${i}`,
        confidence: 0.5,
      });
    }
    const snap = space.getSnapshot();
    expect(snap.decisionHistory.length).toBe(50);
  });

  it("computes confidence as average of hypotheses", () => {
    const space = new JudgmentSpace("agent1", "op1");
    space.addHypothesis("hypothesis A", 0.8);
    space.addHypothesis("hypothesis B", 0.4);
    expect(space.getConfidence()).toBeCloseTo(0.6, 5);
  });

  it("manages constraints", () => {
    const space = new JudgmentSpace("agent1", "op1");
    space.addConstraint("no brute force");
    space.addConstraint("stay in scope");
    expect(space.getSnapshot().constraints).toEqual([
      "no brute force",
      "stay in scope",
    ]);
    space.removeConstraint("no brute force");
    expect(space.getSnapshot().constraints).toEqual(["stay in scope"]);
  });

  it("serializes to JSON", () => {
    const space = new JudgmentSpace("agent1", "op1");
    space.addHypothesis("test hyp", 0.6);
    const json = space.serialize();
    const parsed = JSON.parse(json);
    expect(parsed.agentId).toBe("agent1");
    expect(parsed.operationId).toBe("op1");
    expect(parsed.activeHypotheses).toHaveLength(1);
    expect(parsed.activeHypotheses[0].statement).toBe("test hyp");
  });

  it("reset clears all state", () => {
    const space = new JudgmentSpace("agent1", "op1");
    space.addHypothesis("hyp", 0.5);
    space.addConstraint("constraint");
    space.recordDecision({ iteration: 0, action: "scan", confidence: 0.5 });
    space.reset();
    const snap = space.getSnapshot();
    expect(snap.activeHypotheses).toEqual([]);
    expect(snap.decisionHistory).toEqual([]);
    expect(snap.constraints).toEqual([]);
  });
});

describe("JudgmentLens", () => {
  const lens = new JudgmentLens();

  it("formatForPrompt renders hypotheses", () => {
    const space = new JudgmentSpace("agent1", "op1");
    space.addHypothesis("target vulnerable", 0.7);
    const output = lens.formatForPrompt(space.getSnapshot());
    expect(output).toContain("Active Hypotheses");
    expect(output).toContain("target vulnerable");
  });

  it("formatForPrompt omits empty sections", () => {
    const space = new JudgmentSpace("agent1", "op1");
    const output = lens.formatForPrompt(space.getSnapshot());
    expect(output).not.toContain("Active Hypotheses");
  });

  it("summarize produces one-paragraph summary", () => {
    const space = new JudgmentSpace("agent1", "op1");
    space.addHypothesis("hyp1", 0.8);
    space.addHypothesis("hyp2", 0.6);
    const summary = lens.summarize(space.getSnapshot());
    expect(summary).toContain("agent1");
    expect(summary).toContain("2");
    expect(summary.split("\n")).toHaveLength(1);
  });
});
