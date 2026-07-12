import { describe, it, expect } from "vitest";

import {
  shouldEscalate,
  policyForAutonomyLevel,
  defaultEscalationPolicy,
} from "../../../server/services/judgment/escalation-policy";
import type { JudgmentSnapshot } from "../../../shared/types/judgment-types";

function mockSnapshot(overrides: Partial<JudgmentSnapshot> = {}): JudgmentSnapshot {
  return {
    agentId: "test-agent",
    operationId: "test-op",
    activeHypotheses: [],
    confidenceVector: {},
    decisionHistory: [],
    constraints: [],
    reasoningTrace: [],
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

describe("shouldEscalate", () => {
  it("does not escalate normal decisions", () => {
    const snapshot = mockSnapshot();
    const decision = { action: "execute_tool", tool: "nmap", reasoning: "scan" };
    const result = shouldEscalate(snapshot, decision, defaultEscalationPolicy);
    expect(result.escalate).toBe(false);
  });

  it("escalates safety_boundary for destructive tools", () => {
    const snapshot = mockSnapshot();
    const decision = { action: "execute_tool", tool: "rm", reasoning: "clean up" };
    const result = shouldEscalate(snapshot, decision, defaultEscalationPolicy);
    expect(result.escalate).toBe(true);
    expect(result.trigger).toBe("safety_boundary");
  });

  it("escalates safety_boundary for destructive reasoning keywords", () => {
    const snapshot = mockSnapshot();
    const decision = {
      action: "execute_tool",
      tool: "custom-script",
      reasoning: "this is destructive but necessary",
    };
    const result = shouldEscalate(snapshot, decision, defaultEscalationPolicy);
    expect(result.escalate).toBe(true);
    expect(result.trigger).toBe("safety_boundary");
  });

  it("escalates high_impact for exploitation tools", () => {
    const snapshot = mockSnapshot();
    const decision = {
      action: "execute_tool",
      tool: "exploitation-framework",
      reasoning: "run exploit",
    };
    const result = shouldEscalate(snapshot, decision, defaultEscalationPolicy);
    expect(result.escalate).toBe(true);
    expect(result.trigger).toBe("high_impact");
  });

  it("escalates low_confidence when below threshold", () => {
    const snapshot = mockSnapshot({
      activeHypotheses: [
        {
          id: "h1",
          statement: "open port",
          confidence: 0.1,
          supportingEvidence: ["scan"],
          contradictingEvidence: [],
          createdAtIteration: 0,
        },
        {
          id: "h2",
          statement: "closed port",
          confidence: 0.2,
          supportingEvidence: ["probe"],
          contradictingEvidence: [],
          createdAtIteration: 1,
        },
      ],
    });
    const decision = { action: "execute_tool", tool: "nmap", reasoning: "scan" };
    const result = shouldEscalate(snapshot, decision, defaultEscalationPolicy);
    expect(result.escalate).toBe(true);
    expect(result.trigger).toBe("low_confidence");
  });

  it("escalates contradictory_evidence", () => {
    const snapshot = mockSnapshot({
      activeHypotheses: [
        {
          id: "h1",
          statement: "vuln exists",
          confidence: 0.5,
          supportingEvidence: ["scanner found it"],
          contradictingEvidence: ["manual check failed"],
          createdAtIteration: 0,
        },
      ],
    });
    const decision = { action: "execute_tool", tool: "nmap", reasoning: "verify" };
    const result = shouldEscalate(snapshot, decision, defaultEscalationPolicy);
    expect(result.escalate).toBe(true);
    expect(result.trigger).toBe("contradictory_evidence");
  });

  it("escalates novel_situation after repeated failures", () => {
    const failures = Array.from({ length: 6 }, (_, i) => ({
      iteration: i,
      action: "execute_tool",
      tool: "scanner",
      confidence: 0.5,
      outcome: "failure" as const,
    }));
    const snapshot = mockSnapshot({ decisionHistory: failures });
    const decision = { action: "execute_tool", tool: "nmap", reasoning: "retry" };
    const result = shouldEscalate(snapshot, decision, defaultEscalationPolicy);
    expect(result.escalate).toBe(true);
    expect(result.trigger).toBe("novel_situation");
  });
});

describe("policyForAutonomyLevel", () => {
  it("level 1-3 routes everything to human", () => {
    const policy = policyForAutonomyLevel(2);
    expect(policy.routing.toHuman).toContain("low_confidence");
    expect(policy.routing.toHuman).toContain("high_impact");
    expect(policy.routing.toHuman).toContain("novel_situation");
    expect(policy.routing.toHuman).toContain("contradictory_evidence");
    expect(policy.routing.toHuman).toContain("safety_boundary");
  });

  it("level 4-7 uses default policy", () => {
    const policy = policyForAutonomyLevel(5);
    expect(policy.triggers.lowConfidenceThreshold).toBe(
      defaultEscalationPolicy.triggers.lowConfidenceThreshold,
    );
    expect(policy.triggers.highImpactCategories).toEqual(
      defaultEscalationPolicy.triggers.highImpactCategories,
    );
    expect(policy.triggers.novelSituationIterationThreshold).toBe(
      defaultEscalationPolicy.triggers.novelSituationIterationThreshold,
    );
  });

  it("level 8-10 only routes safety to human", () => {
    const policy = policyForAutonomyLevel(9);
    expect(policy.routing.toHuman).toEqual(["safety_boundary"]);
  });
});
