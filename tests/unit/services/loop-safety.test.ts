import { describe, it, expect } from "vitest";
import { DeadLoopDetector, TokenBudgetTracker } from "../../../server/services/agents/loop-safety";

describe("DeadLoopDetector", () => {
  it("starts not stalled", () => {
    const detector = new DeadLoopDetector();
    expect(detector.isStalled().stalled).toBe(false);
  });

  it("detects repeated tool+args", () => {
    const detector = new DeadLoopDetector();
    detector.recordIteration("nmap", ["-sV", "10.0.0.1"], 1);
    detector.recordIteration("nmap", ["-sV", "10.0.0.1"], 1);
    detector.recordIteration("nmap", ["-sV", "10.0.0.1"], 1);
    const result = detector.isStalled();
    expect(result.stalled).toBe(true);
    expect(result.reason).toMatch(/repeated/i);
  });

  it("does not trigger for different tools", () => {
    const detector = new DeadLoopDetector();
    detector.recordIteration("nmap", ["-sV"], 1);
    detector.recordIteration("nuclei", ["-t", "cves"], 1);
    detector.recordIteration("bbot", ["--target", "x"], 1);
    expect(detector.isStalled().stalled).toBe(false);
  });

  it("detects consecutive zero findings", () => {
    const detector = new DeadLoopDetector();
    detector.recordIteration("nmap", ["-sV"], 0);
    detector.recordIteration("nuclei", ["-t"], 0);
    detector.recordIteration("bbot", ["--scan"], 0);
    const result = detector.isStalled();
    expect(result.stalled).toBe(true);
  });

  it("resets stall counter on findings", () => {
    const detector = new DeadLoopDetector();
    detector.recordIteration("nmap", ["-sV"], 0);
    detector.recordIteration("nuclei", ["-t"], 0);
    detector.recordIteration("bbot", ["--scan"], 3);
    detector.recordIteration("nmap", ["-p80"], 0);
    detector.recordIteration("nuclei", ["-severity", "high"], 0);
    expect(detector.isStalled().stalled).toBe(false);
  });

  it("reset clears state", () => {
    const detector = new DeadLoopDetector();
    detector.recordIteration("nmap", ["-sV", "10.0.0.1"], 0);
    detector.recordIteration("nmap", ["-sV", "10.0.0.1"], 0);
    detector.recordIteration("nmap", ["-sV", "10.0.0.1"], 0);
    expect(detector.isStalled().stalled).toBe(true);
    detector.reset();
    expect(detector.isStalled().stalled).toBe(false);
  });
});

describe("TokenBudgetTracker", () => {
  it("unlimited budget never exhausts", () => {
    const tracker = new TokenBudgetTracker(0, 0);
    tracker.record(1000000, 100);
    expect(tracker.isExhausted().exhausted).toBe(false);
  });

  it("token budget exhaustion", () => {
    const tracker = new TokenBudgetTracker(1000, 0);
    tracker.record(500);
    expect(tracker.isExhausted().exhausted).toBe(false);
    tracker.record(600);
    expect(tracker.isExhausted().exhausted).toBe(true);
  });

  it("cost budget exhaustion", () => {
    const tracker = new TokenBudgetTracker(0, 5.0);
    tracker.record(0, 3.0);
    expect(tracker.isExhausted().exhausted).toBe(false);
    tracker.record(0, 3.0);
    expect(tracker.isExhausted().exhausted).toBe(true);
  });

  it("getSummary with unlimited", () => {
    const tracker = new TokenBudgetTracker(0, 0);
    const summary = tracker.getSummary();
    expect(summary.tokensRemaining).toBe(Infinity);
  });

  it("getSummary with budget", () => {
    const tracker = new TokenBudgetTracker(1000, 0);
    tracker.record(300);
    const summary = tracker.getSummary();
    expect(summary.tokensRemaining).toBe(700);
  });
});
