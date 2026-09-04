export interface Hypothesis {
  id: string;
  statement: string;
  confidence: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  createdAtIteration: number;
}

export interface DecisionRecord {
  iteration: number;
  action: string;
  tool?: string;
  confidence: number;
  outcome?: "success" | "failure" | "pending";
  durationMs?: number;
}

export interface JudgmentSnapshot {
  agentId: string;
  operationId: string;
  activeHypotheses: Hypothesis[];
  confidenceVector: Record<string, number>;
  decisionHistory: DecisionRecord[];
  constraints: string[];
  reasoningTrace: string[];
  lastUpdated: string;
}
