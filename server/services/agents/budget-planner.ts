import { createLogger } from "../../lib/logger";

const log = createLogger("budget-planner");

export type CostTier = "fast" | "standard" | "deep";

export interface AgentMixPlan {
  agents: Array<{ role: string; costTier: CostTier; count: number }>;
  totalAgents: number;
  estimatedCostMultiplier: number;
  rationale: string;
}

export interface BudgetPlanRequest {
  taskComplexity: "low" | "medium" | "high";
  budgetMultiplier?: number;
  targetAgentCount?: number;
}

const COST_MULTIPLIERS: Record<CostTier, number> = {
  fast: 0.1,
  standard: 1.0,
  deep: 3.0,
};

const TIER_MODEL_MAP: Record<CostTier, string> = {
  fast: "fast",
  standard: "general",
  deep: "writing",
};

export class AgentBudgetPlanner {
  planMix(request: BudgetPlanRequest): AgentMixPlan {
    let agents: Array<{ role: string; costTier: CostTier; count: number }>;

    switch (request.taskComplexity) {
      case "low":
        agents = [
          { role: "hunter", costTier: "fast", count: 5 },
          { role: "validator", costTier: "fast", count: 1 },
        ];
        break;
      case "medium":
        agents = [
          { role: "hunter", costTier: "fast", count: 4 },
          { role: "validator", costTier: "standard", count: 1 },
          { role: "reviewer", costTier: "standard", count: 1 },
        ];
        break;
      case "high":
        agents = [
          { role: "hunter", costTier: "standard", count: 3 },
          { role: "validator", costTier: "deep", count: 1 },
          { role: "reviewer", costTier: "deep", count: 1 },
        ];
        break;
    }

    if (request.targetAgentCount) {
      const currentTotal = agents.reduce((sum, a) => sum + a.count, 0);
      const scale = request.targetAgentCount / currentTotal;
      agents = agents.map((a) => ({
        ...a,
        count: Math.max(1, Math.round(a.count * scale)),
      }));
    }

    if (request.budgetMultiplier !== undefined && request.budgetMultiplier < 1.0) {
      const factor = request.budgetMultiplier;
      agents = agents.map((a) => {
        const reducedCount = Math.max(1, Math.round(a.count * factor));
        const cheaperTier: CostTier = a.costTier === "deep" ? "standard" : a.costTier === "standard" ? "fast" : "fast";
        return {
          ...a,
          count: reducedCount,
          costTier: factor < 0.5 ? cheaperTier : a.costTier,
        };
      });
    }

    const totalAgents = agents.reduce((sum, a) => sum + a.count, 0);
    const estimatedCostMultiplier = agents.reduce(
      (sum, a) => sum + a.count * COST_MULTIPLIERS[a.costTier],
      0,
    );

    const tierBreakdown = agents.map((a) => `${a.count}x ${a.costTier} ${a.role}`).join(", ");
    const rationale = `${request.taskComplexity} complexity: ${tierBreakdown}. Estimated cost ${estimatedCostMultiplier.toFixed(1)}x a single standard agent.`;

    return { agents, totalAgents, estimatedCostMultiplier, rationale };
  }

  tierToModelPreset(tier: CostTier): string {
    return TIER_MODEL_MAP[tier];
  }

  getCostMultiplier(tier: CostTier): number {
    return COST_MULTIPLIERS[tier];
  }
}

export const agentBudgetPlanner = new AgentBudgetPlanner();
