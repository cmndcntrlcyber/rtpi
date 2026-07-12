import { db } from "../../db";
import { sql } from "drizzle-orm";
import { createLogger } from "../../lib/logger";
import type { Finding } from "./tool-execution-loop";

const log = createLogger("revalidator");

export type RevalidationVerdict = "true_positive" | "false_positive" | "already_fixed" | "duplicate" | "uncertain";

export interface RevalidationResult {
  finding: Finding;
  verdict: RevalidationVerdict;
  confidence: number;
  reason: string;
  duplicateOf?: string;
}

export class Revalidator {
  async revalidate(
    finding: Finding,
    context: { operationId: string; targetId?: string }
  ): Promise<RevalidationResult> {
    try {
      const duplicateResult = await db.execute(sql`
        SELECT memory_text FROM memory_entries
        WHERE context_id = (
          SELECT id FROM memory_contexts WHERE context_id = ${context.operationId} LIMIT 1
        )
        AND tags @> ARRAY['finding']
        AND memory_text ILIKE ${`%${finding.value}%`}
        LIMIT 5
      `);

      const duplicateRows = (duplicateResult as any).rows ?? duplicateResult;
      if (duplicateRows && duplicateRows.length > 0) {
        const matched = duplicateRows[0] as Record<string, unknown>;
        return {
          finding,
          verdict: "duplicate",
          confidence: 0.85,
          reason: "Finding matches an existing entry in operation memory",
          duplicateOf: matched.memory_text as string,
        };
      }

      if (finding.kind === "vulnerability" && finding.value) {
        const fixResult = await db.execute(sql`
          SELECT memory_text FROM memory_entries
          WHERE context_id = (
            SELECT id FROM memory_contexts WHERE context_id = ${context.operationId} LIMIT 1
          )
          AND (tags @> ARRAY['fix'] OR tags @> ARRAY['remediation'])
          AND memory_text ILIKE ${`%${finding.value}%`}
          LIMIT 1
        `);

        const fixRows = (fixResult as any).rows ?? fixResult;
        if (fixRows && fixRows.length > 0) {
          return {
            finding,
            verdict: "already_fixed",
            confidence: 0.75,
            reason: "A fix or remediation referencing the same value was previously recorded",
          };
        }
      }

      if (!finding.evidence || finding.evidence.length < 10) {
        return {
          finding,
          verdict: "uncertain",
          confidence: 0.3,
          reason: "Insufficient evidence to confirm finding",
        };
      }

      return {
        finding,
        verdict: "true_positive",
        confidence: 0.8,
        reason: "Finding has supporting evidence and no prior duplicates or fixes found",
      };
    } catch (err) {
      log.debug({ err, finding }, "Revalidation query failed");
      return {
        finding,
        verdict: "uncertain",
        confidence: 0.2,
        reason: "Database query failed during revalidation",
      };
    }
  }

  async revalidateBatch(
    findings: Finding[],
    context: { operationId: string; targetId?: string }
  ): Promise<RevalidationResult[]> {
    if (findings.length === 0) return [];

    let existingMemory: Array<Record<string, unknown>> = [];
    try {
      const preload = await db.execute(sql`
        SELECT memory_text, tags FROM memory_entries
        WHERE context_id = (
          SELECT id FROM memory_contexts WHERE context_id = ${context.operationId} LIMIT 1
        )
        AND tags @> ARRAY['finding']
      `);
      existingMemory = ((preload as any).rows ?? preload) as Array<Record<string, unknown>>;
    } catch {
      log.debug("Failed to preload operation findings for batch revalidation");
    }

    const results: RevalidationResult[] = [];
    for (const finding of findings) {
      if (existingMemory.length > 0) {
        const match = existingMemory.find(
          (row) => (row.memory_text as string || "").toLowerCase().includes(finding.value.toLowerCase())
        );
        if (match) {
          results.push({
            finding,
            verdict: "duplicate",
            confidence: 0.85,
            reason: "Finding matches an existing entry in operation memory (batch lookup)",
            duplicateOf: match.memory_text as string,
          });
          continue;
        }
      }
      results.push(await this.revalidate(finding, context));
    }
    return results;
  }

  deduplicateFindings(results: RevalidationResult[]): RevalidationResult[] {
    const kept: RevalidationResult[] = [];

    for (const result of results) {
      if (result.verdict === "duplicate") continue;

      const isDup = kept.some((existing) => {
        if (existing.finding.kind !== result.finding.kind) return false;
        return this.jaccardSimilarity(existing.finding.value, result.finding.value) > 0.8;
      });

      if (isDup) continue;
      kept.push(result);
    }

    return kept;
  }

  private jaccardSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));

    if (wordsA.size === 0 && wordsB.size === 0) return 1;
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let intersection = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) intersection++;
    }

    const union = wordsA.size + wordsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}

export const revalidator = new Revalidator();
