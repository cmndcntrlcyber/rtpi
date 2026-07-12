export interface MakerOutput {
  source: string;
  content: string;
  contentType: "finding" | "report" | "decision" | "assessment";
  rawEvidence: string[];
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface CheckerVerdict {
  accepted: boolean;
  confidence: number;
  reason: string;
  corrections?: string[];
  evidenceGaps?: string[];
}

export interface MakerCheckerResult {
  makerOutput: MakerOutput;
  checkerVerdict: CheckerVerdict;
  finalOutput: string;
  checkerModel?: string;
}
