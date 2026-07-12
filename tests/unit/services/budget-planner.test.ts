import { describe, it, expect } from "vitest";
import { AgentBudgetPlanner } from "../../../server/services/agents/budget-planner";

describe("AgentBudgetPlanner", () => {
  const planner = new AgentBudgetPlanner();

  it("low complexity uses fast tier", () => {
    const plan = planner.planMix({ taskComplexity: "low" });
    expect(plan.agents.every((a) => a.costTier === "fast")).toBe(true);
  });

  it("medium complexity mixes tiers", () => {
    const plan = planner.planMix({ taskComplexity: "medium" });
    const tiers = new Set(plan.agents.map((a) => a.costTier));
    expect(tiers.has("fast")).toBe(true);
    expect(tiers.has("standard")).toBe(true);
  });

  it("high complexity uses standard and deep", () => {
    const plan = planner.planMix({ taskComplexity: "high" });
    const tiers = new Set(plan.agents.map((a) => a.costTier));
    expect(tiers.has("standard")).toBe(true);
    expect(tiers.has("deep")).toBe(true);
  });

  it("tierToModelPreset maps correctly", () => {
    expect(planner.tierToModelPreset("fast")).toBe("fast");
    expect(planner.tierToModelPreset("standard")).toBe("general");
    expect(planner.tierToModelPreset("deep")).toBe("writing");
  });

  it("getCostMultiplier returns expected values", () => {
    expect(planner.getCostMultiplier("fast")).toBeLessThan(planner.getCostMultiplier("standard"));
    expect(planner.getCostMultiplier("standard")).toBeLessThan(planner.getCostMultiplier("deep"));
  });

  it("targetAgentCount scales agent counts", () => {
    const plan = planner.planMix({ taskComplexity: "medium", targetAgentCount: 10 });
    expect(plan.totalAgents).toBeGreaterThanOrEqual(8);
    expect(plan.totalAgents).toBeLessThanOrEqual(12);
  });

  it("budgetMultiplier reduces cost", () => {
    const defaultPlan = planner.planMix({ taskComplexity: "high" });
    const cheapPlan = planner.planMix({ taskComplexity: "high", budgetMultiplier: 0.5 });
    expect(cheapPlan.estimatedCostMultiplier).toBeLessThan(defaultPlan.estimatedCostMultiplier);
  });
});
