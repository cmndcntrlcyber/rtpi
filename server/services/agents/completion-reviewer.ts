import type { Finding } from "./tool-execution-loop";
import type {
  CompletionEvidence,
  CompletionReviewResult,
} from "../../../shared/types/completion-evidence";

export interface ReviewParams {
  iterations: Array<{
    toolUsed: string | null;
    executionResult: { exitCode: number } | null;
  }>;
  findings: Finding[];
  objective: string;
  toolsUsed: string[];
  availableTools: Array<{ toolId: string }>;
}

export const MAX_REJECTIONS = 3;

const DISCOVERY_KEYWORDS = ["scan", "discover", "enumerate", "find", "hunt"];

function computeEvidenceStrength(
  toolsExecuted: string[],
  toolsSucceeded: string[],
  findingsCount: number,
): CompletionEvidence["evidenceStrength"] {
  if (toolsExecuted.length === 0 && findingsCount === 0) return "none";
  if (findingsCount === 0 || toolsExecuted.length < 2) return "weak";
  if (findingsCount >= 3 && toolsSucceeded.length >= 1) return "strong";
  if (findingsCount >= 1 && toolsSucceeded.length >= 1) return "moderate";
  return "weak";
}

export function reviewCompletion(
  params: ReviewParams,
): CompletionReviewResult {
  const { iterations, findings, objective, toolsUsed, availableTools } =
    params;

  const toolsExecuted = iterations
    .map((it) => it.toolUsed)
    .filter((t): t is string => t !== null);

  const toolsSucceeded = iterations
    .filter(
      (it) =>
        it.toolUsed !== null &&
        it.executionResult !== null &&
        it.executionResult.exitCode === 0,
    )
    .map((it) => it.toolUsed as string);

  const findingsCount = findings.length;

  const uniqueToolsUsed = [...new Set(toolsUsed)];
  const scopeItemsTotal = availableTools.length;
  const scopeItemsTested = uniqueToolsUsed.length;
  const coverageRatio =
    scopeItemsTotal > 0 ? scopeItemsTested / scopeItemsTotal : 0;

  const evidenceStrength = computeEvidenceStrength(
    toolsExecuted,
    toolsSucceeded,
    findingsCount,
  );

  const evidence: CompletionEvidence = {
    findingsCount,
    toolsExecuted,
    toolsSucceeded,
    coverageMetrics: {
      scopeItemsTested,
      scopeItemsTotal,
      coverageRatio,
    },
    iterations: iterations.length,
    evidenceStrength,
  };

  if (toolsExecuted.length === 0) {
    return {
      accepted: false,
      reason: "No tools were executed",
      evidence,
      requiredActions: ["Execute at least one tool before completing"],
    };
  }

  if (toolsSucceeded.length === 0) {
    return {
      accepted: false,
      reason: "No tools completed successfully",
      evidence,
      requiredActions: ["At least one tool must complete successfully"],
    };
  }

  const objectiveLower = objective.toLowerCase();
  const isDiscoveryObjective = DISCOVERY_KEYWORDS.some((kw) =>
    objectiveLower.includes(kw),
  );
  if (isDiscoveryObjective && findingsCount === 0) {
    return {
      accepted: false,
      reason: "Discovery objective produced no findings",
      evidence,
      requiredActions: [
        "Discovery objective requires at least one finding",
      ],
    };
  }

  if (iterations.length < 2) {
    return {
      accepted: false,
      reason: "Insufficient iterations",
      evidence,
      requiredActions: [
        "Complete at least 2 tool iterations before declaring done",
      ],
    };
  }

  return {
    accepted: true,
    reason: "Completion criteria met",
    evidence,
  };
}
