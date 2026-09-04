export interface CompletionEvidence {
  findingsCount: number;
  toolsExecuted: string[];
  toolsSucceeded: string[];
  coverageMetrics: {
    scopeItemsTested: number;
    scopeItemsTotal: number;
    coverageRatio: number;
  };
  iterations: number;
  evidenceStrength: "strong" | "moderate" | "weak" | "none";
}

export interface CompletionReviewResult {
  accepted: boolean;
  reason: string;
  evidence: CompletionEvidence;
  requiredActions?: string[];
}
