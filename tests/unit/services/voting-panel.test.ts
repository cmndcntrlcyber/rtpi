import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../server/services/inference/inference-router", () => ({
  routeReasoning: vi.fn(),
}));

import { routeReasoning } from "../../../server/services/inference/inference-router";
const mockRouteReasoning = routeReasoning as unknown as ReturnType<typeof vi.fn>;

import { VotingPanel } from "../../../server/services/agents/voting-panel";

describe("VotingPanel", () => {
  let panel: VotingPanel;

  beforeEach(() => {
    vi.clearAllMocks();
    panel = new VotingPanel();
  });

  it("returns consensus from majority vote on categorical", async () => {
    mockRouteReasoning
      .mockResolvedValueOnce({ response: { text: JSON.stringify({ action: "exploit" }) } })
      .mockResolvedValueOnce({ response: { text: JSON.stringify({ action: "exploit" }) } })
      .mockResolvedValueOnce({ response: { text: JSON.stringify({ action: "scan" }) } });

    const result = await panel.vote({
      prompt: "What action to take?",
      schema: { action: "categorical" },
      voterCount: 3,
    });

    expect(result.consensus.action).toBe("exploit");
    expect(result.confidence).toBeGreaterThanOrEqual(0.66);
  });

  it("computes median for numerical fields", async () => {
    mockRouteReasoning
      .mockResolvedValueOnce({ response: { text: JSON.stringify({ score: 7 }) } })
      .mockResolvedValueOnce({ response: { text: JSON.stringify({ score: 3 }) } })
      .mockResolvedValueOnce({ response: { text: JSON.stringify({ score: 9 }) } });

    const result = await panel.vote({
      prompt: "Rate the severity",
      schema: { score: "numerical" },
      voterCount: 3,
    });

    expect(result.consensus.score).toBe(7);
  });

  it("handles boolean majority", async () => {
    mockRouteReasoning
      .mockResolvedValueOnce({ response: { text: JSON.stringify({ safe: true }) } })
      .mockResolvedValueOnce({ response: { text: JSON.stringify({ safe: true }) } })
      .mockResolvedValueOnce({ response: { text: JSON.stringify({ safe: false }) } });

    const result = await panel.vote({
      prompt: "Is this safe?",
      schema: { safe: "boolean" },
      voterCount: 3,
    });

    expect(result.consensus.safe).toBe(true);
  });

  it("returns confidence 0 when all voters fail", async () => {
    mockRouteReasoning
      .mockRejectedValueOnce(new Error("model timeout"))
      .mockRejectedValueOnce(new Error("model timeout"))
      .mockRejectedValueOnce(new Error("model timeout"));

    const result = await panel.vote({
      prompt: "Decide action",
      schema: { action: "categorical" },
      voterCount: 3,
    });

    expect(result.confidence).toBe(0);
    expect(result.consensus).toEqual({});
  });

  it("handles single successful voter", async () => {
    mockRouteReasoning
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ response: { text: JSON.stringify({ result: "ok" }) } });

    const result = await panel.vote({
      prompt: "Check status",
      schema: { result: "categorical" },
      voterCount: 3,
    });

    expect(result.confidence).toBeCloseTo(1 / 3, 2);
  });

  it("spawns configurable number of voters", async () => {
    mockRouteReasoning.mockResolvedValue({ response: { text: JSON.stringify({ action: "scan" }) } });

    await panel.vote({
      prompt: "Decide action",
      schema: { action: "categorical" },
      voterCount: 5,
    });

    expect(mockRouteReasoning).toHaveBeenCalledTimes(5);
  });
});
