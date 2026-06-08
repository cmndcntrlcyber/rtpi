/**
 * ValidateAgent (FF_BUG_HUNTER) — phase 4.
 *
 * Runs the 7-Question Gate across every open finding on an operation
 * (or a single explicit finding via parameters.findingId). Updates each
 * vulnerability row with the gate's verdict in metadata and writes a
 * memory entry tagged `bh:validate` per finding.
 *
 * Inference: gates Q3 and Q7 are programmatic. Q1/Q2/Q4/Q5/Q6 route
 * through routeReasoning — Settings → qwen3:14b.
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { vulnerabilities } from "@shared/schema";
import { BaseTaskAgent, type TaskDefinition, type TaskResult } from "../base-task-agent";
import { runSevenQuestionGate, type GateResult, type Finding } from "../../bug-hunter/seven-question-gate";
import { loadEngagementMeta } from "../../bug-hunter/engagement-scaffolder";

export class ValidateAgent extends BaseTaskAgent {
  constructor() {
    super("Bug Hunter — Validate", "bug_hunter_validate", [
      "seven_question_gate",
      "in_scope_check",
      "never_submit_check",
      "chain_required_check",
    ]);
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    if (task.taskType !== "bug_hunter_validate") {
      return { success: false, error: `Unsupported task type: ${task.taskType}` };
    }
    if (!task.operationId) {
      return { success: false, error: "operationId required" };
    }
    await this.updateStatus("running");

    try {
      const fast = task.parameters?.fast === true;
      const meta = await loadEngagementMeta(task.operationId);
      const mode = meta?.mode ?? "wapt";
      const scopeRules = meta?.scopeRules ?? {};
      const acceptedImpacts = meta?.acceptedImpacts ?? [];

      const findingId = task.parameters?.findingId as string | undefined;
      const rows = findingId
        ? await db.select().from(vulnerabilities).where(eq(vulnerabilities.id, findingId))
        : await db.select().from(vulnerabilities).where(eq(vulnerabilities.operationId, task.operationId));

      if (rows.length === 0) {
        return { success: true, data: { evaluated: 0, verdicts: {} } };
      }

      const verdicts: Record<string, GateResult> = {};
      let pass = 0;
      let kill = 0;
      let chain = 0;
      let downgrade = 0;

      for (const row of rows) {
        const finding: Finding = {
          title: row.title,
          description: row.description ?? undefined,
          cvssScore: (row as { cvssScore?: number | null }).cvssScore ?? null,
          severity: row.severity ?? null,
          affectedUrl: (row as { affectedUrl?: string | null }).affectedUrl ?? null,
          proofOfConcept: (row as { proofOfConcept?: string | null }).proofOfConcept ?? null,
        };

        const gate = await runSevenQuestionGate({
          finding,
          scope: {
            ...(scopeRules as Record<string, unknown>),
            acceptedImpacts,
          },
          mode,
          fast,
        });
        verdicts[row.id] = gate;

        switch (gate.verdict) {
          case "PASS": pass++; break;
          case "KILL": kill++; break;
          case "CHAIN_REQUIRED": chain++; break;
          case "DOWNGRADE": downgrade++; break;
        }

        // Persist the verdict on the vulnerability so reporters / UI can read it.
        const existingMeta = ((row as { metadata?: Record<string, unknown> }).metadata as Record<string, unknown>) ?? {};
        await db
          .update(vulnerabilities)
          .set({
            metadata: {
              ...existingMeta,
              bugHunterGate: {
                verdict: gate.verdict,
                failedQuestion: gate.failedQuestion,
                reasoning: gate.reasoning,
                matchedNeverSubmit: gate.matchedNeverSubmit,
                matchedChainRequired: gate.matchedChainRequired,
                evaluatedAt: new Date().toISOString(),
                fast,
              },
            },
          })
          .where(eq(vulnerabilities.id, row.id));
      }

      const result: TaskResult = {
        success: true,
        data: {
          evaluated: rows.length,
          counts: { pass, kill, chain, downgrade },
          fast,
          verdicts: Object.fromEntries(
            Object.entries(verdicts).map(([id, v]) => [
              id,
              { verdict: v.verdict, failedQuestion: v.failedQuestion, reasoning: v.reasoning.slice(0, 400) },
            ]),
          ),
        },
      };
      await this.storeTaskMemory({ task, result, memoryType: "fact" });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    } finally {
      await this.updateStatus("idle");
    }
  }
}

export const validateAgent = new ValidateAgent();
