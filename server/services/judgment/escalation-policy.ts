import type { JudgmentSnapshot } from "../../../shared/types/judgment-types";

export type EscalationTrigger =
  | "low_confidence"
  | "high_impact"
  | "novel_situation"
  | "contradictory_evidence"
  | "safety_boundary";

export type EscalationRoute = "stronger_model" | "voting_panel" | "human";

export interface EscalationPolicy {
  triggers: {
    lowConfidenceThreshold: number;
    highImpactCategories: string[];
    novelSituationIterationThreshold: number;
  };
  routing: {
    toStrongerModel: EscalationTrigger[];
    toVotingPanel: EscalationTrigger[];
    toHuman: EscalationTrigger[];
  };
}

export interface EscalationDecision {
  escalate: boolean;
  trigger: EscalationTrigger | null;
  route: EscalationRoute | null;
}

export const defaultEscalationPolicy: EscalationPolicy = {
  triggers: {
    lowConfidenceThreshold: 0.3,
    highImpactCategories: ["exploitation", "c2", "post-exploitation", "credential_testing"],
    novelSituationIterationThreshold: 5,
  },
  routing: {
    toStrongerModel: ["low_confidence", "novel_situation"],
    toVotingPanel: ["contradictory_evidence"],
    toHuman: ["safety_boundary", "high_impact"],
  },
};

const SAFETY_CRITICAL_TOOLS = ["rm", "dd", "mkfs", "format"];
const DESTRUCTIVE_KEYWORDS = ["destructive", "irreversible", "wipe"];

function resolveRoute(trigger: EscalationTrigger, policy: EscalationPolicy): EscalationRoute {
  if (policy.routing.toHuman.includes(trigger)) return "human";
  if (policy.routing.toVotingPanel.includes(trigger)) return "voting_panel";
  if (policy.routing.toStrongerModel.includes(trigger)) return "stronger_model";
  return "human";
}

export function shouldEscalate(
  snapshot: JudgmentSnapshot,
  decision: { action: string; tool?: string; reasoning: string },
  policy: EscalationPolicy,
): EscalationDecision {
  const toolLower = (decision.tool ?? "").toLowerCase();
  const reasoningLower = decision.reasoning.toLowerCase();

  if (
    SAFETY_CRITICAL_TOOLS.some((t) => toolLower === t) ||
    DESTRUCTIVE_KEYWORDS.some((kw) => reasoningLower.includes(kw))
  ) {
    const trigger: EscalationTrigger = "safety_boundary";
    return { escalate: true, trigger, route: resolveRoute(trigger, policy) };
  }

  if (
    decision.tool &&
    policy.triggers.highImpactCategories.some((cat) => toolLower.includes(cat))
  ) {
    const trigger: EscalationTrigger = "high_impact";
    return { escalate: true, trigger, route: resolveRoute(trigger, policy) };
  }

  const hasContradiction = snapshot.activeHypotheses.some(
    (h) =>
      h.supportingEvidence.length > 0 &&
      h.contradictingEvidence.length > 0 &&
      h.confidence >= 0.3 &&
      h.confidence <= 0.7,
  );
  if (hasContradiction) {
    const trigger: EscalationTrigger = "contradictory_evidence";
    return { escalate: true, trigger, route: resolveRoute(trigger, policy) };
  }

  if (snapshot.activeHypotheses.length > 0) {
    const avg =
      snapshot.activeHypotheses.reduce((sum, h) => sum + h.confidence, 0) /
      snapshot.activeHypotheses.length;
    if (avg < policy.triggers.lowConfidenceThreshold) {
      const trigger: EscalationTrigger = "low_confidence";
      return { escalate: true, trigger, route: resolveRoute(trigger, policy) };
    }
  }

  const history = snapshot.decisionHistory;
  if (history.length > policy.triggers.novelSituationIterationThreshold) {
    const lastThree = history.slice(-3);
    if (lastThree.length === 3 && lastThree.every((d) => d.outcome === "failure")) {
      const trigger: EscalationTrigger = "novel_situation";
      return { escalate: true, trigger, route: resolveRoute(trigger, policy) };
    }
  }

  return { escalate: false, trigger: null, route: null };
}

export function policyForAutonomyLevel(level: number): EscalationPolicy {
  if (level <= 3) {
    return {
      triggers: {
        lowConfidenceThreshold: 0.8,
        highImpactCategories: [
          "exploitation",
          "c2",
          "post-exploitation",
          "credential_testing",
          "reconnaissance",
          "scanning",
          "enumeration",
        ],
        novelSituationIterationThreshold: 3,
      },
      routing: {
        toStrongerModel: [],
        toVotingPanel: [],
        toHuman: [
          "low_confidence",
          "high_impact",
          "novel_situation",
          "contradictory_evidence",
          "safety_boundary",
        ],
      },
    };
  }

  if (level <= 7) {
    return { ...defaultEscalationPolicy };
  }

  return {
    triggers: {
      lowConfidenceThreshold: 0.1,
      highImpactCategories: ["exploitation", "c2", "post-exploitation", "credential_testing"],
      novelSituationIterationThreshold: 10,
    },
    routing: {
      toStrongerModel: [
        "low_confidence",
        "high_impact",
        "novel_situation",
        "contradictory_evidence",
      ],
      toVotingPanel: [],
      toHuman: ["safety_boundary"],
    },
  };
}
