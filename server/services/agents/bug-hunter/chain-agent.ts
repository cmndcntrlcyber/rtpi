/**
 * ChainAgent (FF_BUG_HUNTER) — phase 3.5.
 *
 * Looks across the accumulated findings on an operation and proposes
 * A→B (or A→B→C) chains that escalate severity. Uses the bug-hunter
 * skills (conditionally-valid table from triage-validation + the
 * bug-bounty chain section) for pattern hints.
 *
 * Inference: routeReasoning (Settings → qwen3:14b default).
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { vulnerabilities } from "@shared/schema";
import { BaseTaskAgent, type TaskDefinition, type TaskResult } from "../base-task-agent";
import { routeReasoning, NoInferenceProviderAvailable } from "../../inference/inference-router";
import { retrieveBugHunterSkills } from "../../knowledge/bug-hunter-skill-retriever";
import { loadEngagementMeta } from "../../bug-hunter/engagement-scaffolder";
import { createLogger } from '../../../lib/logger';
const log = createLogger("chain-agent");

export interface ChainProposal {
  primary: string;
  chained: string[];
  rationale: string;
  expectedImpact: string;
  expectedSeverity: "critical" | "high" | "medium" | "low" | "informational";
}

export class ChainAgent extends BaseTaskAgent {
  constructor() {
    super("Bug Hunter — Chain", "bug_hunter_chain", [
      "chain_construction",
      "escalation_reasoning",
      "severity_uplift",
    ]);
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    if (task.taskType !== "bug_hunter_chain") {
      return { success: false, error: `Unsupported task type: ${task.taskType}` };
    }
    if (!task.operationId) {
      return { success: false, error: "operationId required" };
    }
    await this.updateStatus("running");

    try {
      const vulns = await db
        .select()
        .from(vulnerabilities)
        .where(eq(vulnerabilities.operationId, task.operationId));

      if (vulns.length === 0) {
        return { success: true, data: { proposals: [], reason: "no findings yet" } };
      }

      const meta = await loadEngagementMeta(task.operationId);
      const mode = meta?.mode ?? "wapt";

      const chainSkills = await retrieveBugHunterSkills({
        query: `chain construction conditionally valid finding combinations ${vulns.map((v) => v.title).slice(0, 5).join(" ")}`,
        phase: "chain",
        mode,
        topK: 4,
        includeMeta: true,
      });

      const findingsList = vulns
        .slice(0, 30)
        .map((v, i) => `${i + 1}. [${v.severity}] ${v.title} — ${v.description?.slice(0, 200) ?? ""}`)
        .join("\n");

      const skillContext = chainSkills.map((s) => s.content.slice(0, 1500)).join("\n\n---\n\n").slice(0, 5000);

      const prompt = `You are analyzing an open engagement's findings to propose A→B (or A→B→C) exploit chains that escalate severity.

CURRENT FINDINGS:
${findingsList}

CHAIN PATTERNS (from bug-hunter playbook):
${skillContext}

Return STRICT JSON, an array of up to 5 proposals. Each proposal:
{
  "primary": "finding-title-or-index",
  "chained": ["additional finding titles or steps"],
  "rationale": "short why-this-works",
  "expectedImpact": "what the chain produces",
  "expectedSeverity": "critical|high|medium|low|informational"
}

If no chains are viable, return [].`;

      let proposals: ChainProposal[] = [];
      try {
        const result = await routeReasoning({
          messages: [{ role: "user", content: prompt }],
          system: "You are a senior bug-bounty operator. Propose only chains you can justify from the listed findings. Don't invent new vulnerabilities.",
          maxTokens: 1200,
          temperature: 0.2,
        });
        const match = result.response.text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]) as ChainProposal[];
          if (Array.isArray(parsed)) proposals = parsed;
        }
      } catch (err) {
        if (err instanceof NoInferenceProviderAvailable) {
          log.warn("[ChainAgent] no provider available — returning empty proposal list");
        } else {
          log.warn("[ChainAgent] chain reasoning failed:", err);
        }
      }

      const taskResult: TaskResult = {
        success: true,
        data: {
          proposals,
          totalFindings: vulns.length,
          chainSkillsConsulted: chainSkills.length,
        },
      };
      await this.storeTaskMemory({ task, result: taskResult, memoryType: "insight" });
      return taskResult;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    } finally {
      await this.updateStatus("idle");
    }
  }
}

export const chainAgent = new ChainAgent();
