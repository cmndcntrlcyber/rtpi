import { createLogger } from "../../lib/logger";
import type { LoopResult, Finding } from "../agents/tool-execution-loop";
import type { MemoryScope } from "./memory-router";

const log = createLogger("experience-extractor");

export interface ExperienceRecord {
  taskType: string;
  agentType: string;
  targetProfile: string;
  toolChain: string[];
  iterationCount: number;
  successRate: number;
  errorPatterns: string[];
  findingsQuality: "strong" | "moderate" | "weak" | "none";
  lessons: string[];
  timestamp: string;
}

function classifyFindingsQuality(findings: Finding[]): ExperienceRecord["findingsQuality"] {
  if (findings.length === 0) return "none";
  if (findings.length >= 3) {
    const withEvidence = findings.filter((f) => f.evidence && f.evidence.length > 0);
    return withEvidence.length >= 2 ? "strong" : "moderate";
  }
  return findings.length >= 1 ? "weak" : "none";
}

function extractErrorPatterns(result: LoopResult): string[] {
  const patterns: string[] = [];
  const seen = new Set<string>();

  for (const iter of result.iterations) {
    if (iter.executionResult && iter.executionResult.exitCode !== 0) {
      const stderr = iter.executionResult.stderr || "";
      let pattern = "unknown_error";
      if (iter.executionResult.timedOut) pattern = "timeout";
      else if (/connection refused|ECONNREFUSED/i.test(stderr)) pattern = "network";
      else if (/permission denied|EACCES/i.test(stderr)) pattern = "permission";
      else if (/command not found|not installed/i.test(stderr)) pattern = "missing_dep";
      else if (/401|403|unauthorized/i.test(stderr)) pattern = "auth";

      if (!seen.has(pattern)) {
        seen.add(pattern);
        patterns.push(pattern);
      }
    }
  }

  return patterns;
}

function deriveLessons(result: LoopResult, errorPatterns: string[]): string[] {
  const lessons: string[] = [];

  if (result.status === "completed" && result.toolsUsed.length > 1) {
    lessons.push(`Tool chain [${result.toolsUsed.join(" → ")}] completed successfully in ${result.iterations.length} iterations.`);
  }

  if (errorPatterns.length > 0) {
    lessons.push(`Encountered error patterns: ${errorPatterns.join(", ")}. Consider pre-checking these conditions.`);
  }

  const successfulIters = result.iterations.filter(
    (i) => i.executionResult && i.executionResult.exitCode === 0,
  );
  const failedIters = result.iterations.filter(
    (i) => i.executionResult && i.executionResult.exitCode !== 0,
  );

  if (failedIters.length > successfulIters.length) {
    lessons.push(`High failure rate (${failedIters.length}/${result.iterations.length}). Review tool compatibility with target type.`);
  }

  return lessons.slice(0, 3);
}

export function extractExperience(
  result: LoopResult,
  objective: string,
  agentType: string,
): ExperienceRecord {
  const successfulIters = result.iterations.filter(
    (i) => i.executionResult && i.executionResult.exitCode === 0,
  );

  const allFindings: Finding[] = result.iterations
    .flatMap((i) => i.findings || []);

  const errorPatterns = extractErrorPatterns(result);

  const taskType = /scan|discover|enum/i.test(objective)
    ? "discovery"
    : /exploit|attack|pentest/i.test(objective)
      ? "exploitation"
      : /review|assess|audit/i.test(objective)
        ? "assessment"
        : "general";

  return {
    taskType,
    agentType,
    targetProfile: objective.slice(0, 200),
    toolChain: result.toolsUsed,
    iterationCount: result.iterations.length,
    successRate:
      result.iterations.length > 0
        ? successfulIters.length / result.iterations.length
        : 0,
    errorPatterns,
    findingsQuality: classifyFindingsQuality(allFindings),
    lessons: deriveLessons(result, errorPatterns),
    timestamp: new Date().toISOString(),
  };
}

export async function storeExperience(
  record: ExperienceRecord,
  scope: MemoryScope,
): Promise<void> {
  try {
    const { memoryRouter } = await import("./memory-router");
    const adapters = memoryRouter.getRegisteredAdapters();

    if (adapters.length === 0) {
      log.warn("No memory adapters registered, skipping experience storage");
      return;
    }

    const { memoryService } = await import("../memory-service");
    const context = await memoryService.createContext({
      contextType: "operation",
      contextId: scope.operationId || "global",
      contextName: `Experience: ${record.agentType}`,
    });

    await memoryService.addMemory({
      contextId: context.id,
      memoryText: `[EXPERIENCE] ${record.agentType} (${record.taskType}): ${record.lessons.join(" ")} Tools: ${record.toolChain.join(", ")}. Success rate: ${(record.successRate * 100).toFixed(0)}%. Findings: ${record.findingsQuality}.`,
      memoryType: "pattern",
      tags: ["experience", record.agentType, record.taskType],
      metadata: record as unknown as Record<string, unknown>,
    });
  } catch (err) {
    log.warn("Failed to store experience (non-fatal):", err);
  }
}

export async function retrieveRelevantExperience(
  objective: string,
  agentType: string,
  limit: number = 3,
): Promise<ExperienceRecord[]> {
  try {
    const { memoryRouter } = await import("./memory-router");
    const hits = await memoryRouter.query(
      `experience ${agentType} ${objective}`,
      { category: "experience" },
      "fast",
      limit,
    );

    return hits
      .filter((h) => h.metadata && (h.metadata as Record<string, unknown>).agentType)
      .map((h) => h.metadata as unknown as ExperienceRecord);
  } catch (err) {
    log.warn("Failed to retrieve experience (non-fatal):", err);
    return [];
  }
}

export function formatExperienceForPrompt(records: ExperienceRecord[]): string {
  if (records.length === 0) return "";

  const lines = ["## Prior Experience\n"];
  for (const r of records) {
    lines.push(`### ${r.agentType} — ${r.taskType}`);
    lines.push(`- **Tools used:** ${r.toolChain.join(" → ")}`);
    lines.push(`- **Success rate:** ${(r.successRate * 100).toFixed(0)}%`);
    lines.push(`- **Findings quality:** ${r.findingsQuality}`);
    if (r.lessons.length > 0) {
      lines.push(`- **Lessons:** ${r.lessons.join("; ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
