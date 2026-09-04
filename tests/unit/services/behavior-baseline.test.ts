import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../server/db", () => ({
  db: { execute: vi.fn().mockResolvedValue({ rows: [] }) },
}));

vi.mock("../../../server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { BehaviorBaseline } from "../../../server/services/agents/behavior-baseline";

let baseline: BehaviorBaseline;

beforeEach(() => {
  baseline = new BehaviorBaseline();
});

describe("BehaviorBaseline", () => {
  it("returns null for unknown agent types", async () => {
    const result = await baseline.loadBaseline("nonexistent");
    expect(result).toBeNull();
  });

  it("checkDrift returns empty when no baseline", async () => {
    const alerts = await baseline.checkDrift("unknown-agent", {
      iterations: 5,
      findings: 2,
      durationMs: 10000,
      toolsUsed: ["nmap"],
    });
    expect(alerts).toEqual([]);
  });

  it("updateBaseline initializes new baseline", async () => {
    await baseline.updateBaseline("recon-agent", {
      iterations: 10,
      findings: 3,
      durationMs: 5000,
      toolsUsed: ["nmap", "nuclei"],
      success: true,
    });

    const result = baseline.getBaseline("recon-agent");
    expect(result).not.toBeNull();
    expect(result!.sampleCount).toBe(1);
  });

  it("updateBaseline updates running statistics", async () => {
    await baseline.updateBaseline("recon-agent", {
      iterations: 10,
      findings: 4,
      durationMs: 5000,
      toolsUsed: ["nmap"],
      success: true,
    });

    await baseline.updateBaseline("recon-agent", {
      iterations: 20,
      findings: 6,
      durationMs: 7000,
      toolsUsed: ["nuclei"],
      success: true,
    });

    const result = baseline.getBaseline("recon-agent");
    expect(result).not.toBeNull();
    expect(result!.sampleCount).toBe(2);
    expect(result!.avgIterations).toBe(15);
  });

  it("clearCache works", async () => {
    await baseline.updateBaseline("recon-agent", {
      iterations: 10,
      findings: 3,
      durationMs: 5000,
      toolsUsed: ["nmap"],
      success: true,
    });

    baseline.clearCache();
    expect(baseline.getBaseline("recon-agent")).toBeNull();
  });
});
