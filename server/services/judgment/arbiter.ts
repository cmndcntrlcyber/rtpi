import type { JudgmentSnapshot } from "../../../shared/types/judgment-types";
import {
  type EscalationPolicy,
  type EscalationRoute,
  shouldEscalate,
  defaultEscalationPolicy,
} from "./escalation-policy";
import { routeReasoning } from "../inference/inference-router";
import { createLogger } from "../../lib/logger";

const log = createLogger("arbiter");

export interface ArbitrationParams {
  decision: { action: string; tool?: string; args?: string[]; reasoning: string };
  snapshot: JudgmentSnapshot;
  policy?: EscalationPolicy;
  availableTools: Array<{ toolId: string; name: string; category: string }>;
  approvalCallback?: (request: {
    tool: string;
    reason: string;
  }) => Promise<{ approved: boolean; reason?: string }>;
}

export interface ArbitrationResult {
  finalDecision: { action: string; tool?: string; args?: string[]; reasoning: string };
  escalated: boolean;
  escalationRoute?: EscalationRoute;
  overrideReason?: string;
}

class Arbiter {
  async arbitrate(params: ArbitrationParams): Promise<ArbitrationResult> {
    const policy = params.policy ?? defaultEscalationPolicy;
    const escalation = shouldEscalate(params.snapshot, params.decision, policy);

    if (!escalation.escalate || !escalation.route) {
      return { finalDecision: params.decision, escalated: false };
    }

    log.info(
      { trigger: escalation.trigger, route: escalation.route, tool: params.decision.tool },
      "escalation triggered",
    );

    try {
      switch (escalation.route) {
        case "stronger_model":
          return await this.handleStrongerModel(params, escalation.trigger!);
        case "voting_panel":
          return await this.handleVotingPanel(params, escalation.trigger!);
        case "human":
          return await this.handleHuman(params, escalation.trigger!);
        default:
          return { finalDecision: params.decision, escalated: false };
      }
    } catch (err) {
      log.warn({ err }, "escalation handler failed, returning original decision");
      return { finalDecision: params.decision, escalated: false };
    }
  }

  private async handleStrongerModel(
    params: ArbitrationParams,
    trigger: string,
  ): Promise<ArbitrationResult> {
    const hypothesesSummary = params.snapshot.activeHypotheses
      .map((h) => `- "${h.statement}" (confidence: ${h.confidence})`)
      .join("\n");

    const toolsList = params.availableTools
      .map((t) => `${t.name} [${t.category}]`)
      .join(", ");

    const prompt = [
      "You are a senior security analyst reviewing an agent's decision.",
      "",
      `The agent decided: action=${params.decision.action}, tool=${params.decision.tool ?? "none"}, reasoning=${params.decision.reasoning}`,
      "",
      "Current context:",
      `- Hypotheses:\n${hypothesesSummary || "  (none)"}`,
      `- Escalation trigger: ${trigger}`,
      "",
      `Available tools: ${toolsList || "none"}`,
      "",
      "Should this decision proceed, or should a different action/tool be chosen?",
      'Respond with JSON: { "action": "execute_tool"|"complete"|"request_approval", "tool": "<tool_or_null>", "args": [], "reasoning": "<your_reasoning>" }',
    ].join("\n");

    try {
      const result = await routeReasoning({
        explicitModel: process.env.ESCALATION_MODEL,
        messages: [{ role: "user", content: prompt }],
        responseFormat: { type: "json_object" },
        maxTokens: 1024,
      });

      const parsed = JSON.parse(result.response.text);
      return {
        finalDecision: {
          action: parsed.action ?? params.decision.action,
          tool: parsed.tool === "null" || parsed.tool === null ? undefined : parsed.tool,
          args: Array.isArray(parsed.args) ? parsed.args : params.decision.args,
          reasoning: parsed.reasoning ?? params.decision.reasoning,
        },
        escalated: true,
        escalationRoute: "stronger_model",
        overrideReason: `Stronger model review (trigger: ${trigger})`,
      };
    } catch (err) {
      log.warn({ err }, "stronger model escalation failed, returning original decision");
      return { finalDecision: params.decision, escalated: false };
    }
  }

  private async handleVotingPanel(
    params: ArbitrationParams,
    trigger: string,
  ): Promise<ArbitrationResult> {
    const hypothesesSummary = params.snapshot.activeHypotheses
      .map((h) => `- "${h.statement}" (confidence: ${h.confidence})`)
      .join("\n");

    const toolsList = params.availableTools
      .map((t) => `${t.name} [${t.category}]`)
      .join(", ");

    const prompt = [
      "You are a security analyst. Given the following context, decide the best next action.",
      "",
      `Current hypotheses:\n${hypothesesSummary || "  (none)"}`,
      `Available tools: ${toolsList || "none"}`,
      `Previous decision was: action=${params.decision.action}, tool=${params.decision.tool ?? "none"}`,
      "",
      "What action and tool should be used next?",
      'Respond with JSON: { "action": "execute_tool"|"complete"|"request_approval", "tool": "<tool_or_null>", "args": [], "reasoning": "<your_reasoning>" }',
    ].join("\n");

    try {
      const votes = await Promise.all(
        [0, 1, 2].map(() =>
          routeReasoning({
            messages: [{ role: "user", content: prompt }],
            responseFormat: { type: "json_object" },
            maxTokens: 1024,
            temperature: 0.7,
          }),
        ),
      );

      const parsed = votes.map((v) => {
        try {
          return JSON.parse(v.response.text);
        } catch {
          return null;
        }
      }).filter(Boolean);

      if (parsed.length === 0) {
        return { finalDecision: params.decision, escalated: false };
      }

      const actionCounts = new Map<string, number>();
      for (const p of parsed) {
        const a = p.action ?? "execute_tool";
        actionCounts.set(a, (actionCounts.get(a) ?? 0) + 1);
      }
      const winningAction = [...actionCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

      const actionVoters = parsed.filter((p) => (p.action ?? "execute_tool") === winningAction);
      const toolCounts = new Map<string, number>();
      for (const p of actionVoters) {
        const t = p.tool ?? "none";
        toolCounts.set(t, (toolCounts.get(t) ?? 0) + 1);
      }
      const winningTool = [...toolCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

      const representative =
        actionVoters.find((p) => (p.tool ?? "none") === winningTool) ?? actionVoters[0];

      return {
        finalDecision: {
          action: winningAction,
          tool: winningTool === "none" || winningTool === "null" ? undefined : winningTool,
          args: Array.isArray(representative.args) ? representative.args : params.decision.args,
          reasoning: representative.reasoning ?? params.decision.reasoning,
        },
        escalated: true,
        escalationRoute: "voting_panel",
        overrideReason: `Voting panel consensus (trigger: ${trigger}, votes: ${parsed.length})`,
      };
    } catch (err) {
      log.warn({ err }, "voting panel escalation failed, returning original decision");
      return { finalDecision: params.decision, escalated: false };
    }
  }

  private async handleHuman(
    params: ArbitrationParams,
    trigger: string,
  ): Promise<ArbitrationResult> {
    if (!params.approvalCallback) {
      return {
        finalDecision: { ...params.decision, action: "request_approval" },
        escalated: true,
        escalationRoute: "human",
        overrideReason: `Human approval required (trigger: ${trigger}), no callback provided`,
      };
    }

    try {
      const approval = await params.approvalCallback({
        tool: params.decision.tool ?? params.decision.action,
        reason: `Escalation trigger: ${trigger}. ${params.decision.reasoning}`,
      });

      if (approval.approved) {
        return {
          finalDecision: params.decision,
          escalated: true,
          escalationRoute: "human",
          overrideReason: `Human approved (trigger: ${trigger})`,
        };
      }

      return {
        finalDecision: { ...params.decision, action: "request_approval" },
        escalated: true,
        escalationRoute: "human",
        overrideReason: `Human denied (trigger: ${trigger}): ${approval.reason ?? "no reason given"}`,
      };
    } catch (err) {
      log.warn({ err }, "human approval callback failed, requesting approval");
      return {
        finalDecision: { ...params.decision, action: "request_approval" },
        escalated: true,
        escalationRoute: "human",
        overrideReason: `Human approval callback error (trigger: ${trigger})`,
      };
    }
  }
}

export const arbiter = new Arbiter();
export { Arbiter };
