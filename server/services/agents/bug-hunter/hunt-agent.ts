/**
 * HuntAgent (FF_BUG_HUNTER) — phase 3.
 *
 * The active testing agent. Runs an autonomous tool loop with a pre-prompt
 * hook that retrieves matching bug-hunter skills from the knowledge_base
 * each iteration (e.g. discovering /oauth/ → hunt-oauth loads next round).
 *
 * Inference:
 *   - Tool-use decisions go through routeReasoning inside ToolExecutionLoop
 *     (Settings → DEFAULT_REASONING_MODEL → qwen3:14b).
 *   - Skill embeddings/retrieval go through routeEmbedding (qwen3-embedding:4b).
 * All paths set `provider: auto` implicitly — no model strings here.
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { operations } from "@shared/schema";
import { BaseTaskAgent, type TaskDefinition, type TaskResult } from "../base-task-agent";
import { createBugHunterToolLoop } from "./bug-hunter-tool-loop";
import { loadEngagementMeta } from "../../bug-hunter/engagement-scaffolder";

const DEFAULT_OBJECTIVE = `Conduct active bug-hunting against the target. Use the retrieved bug-hunter skills as your playbook. Prefer findings that can pass the 7-Question Gate (real HTTP request, real impact, in scope, non-admin). Stop when scope is exhausted or you've accumulated enough validated leads to take to validate phase.`;

export class HuntAgent extends BaseTaskAgent {
  constructor() {
    super("Bug Hunter — Hunt", "bug_hunter_hunt", [
      "active_testing",
      "vuln_class_dispatch",
      "rag_skill_retrieval",
      "tool_orchestration",
    ]);
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    if (task.taskType !== "bug_hunter_hunt") {
      return { success: false, error: `Unsupported task type: ${task.taskType}` };
    }
    if (!task.operationId || !task.targetId) {
      return { success: false, error: "operationId and targetId required" };
    }
    await this.initialize();
    await this.updateStatus("running");

    try {
      const [op] = await db.select().from(operations).where(eq(operations.id, task.operationId)).limit(1);
      if (!op) return { success: false, error: `operation ${task.operationId} not found` };

      const meta = await loadEngagementMeta(task.operationId);
      const mode = (task.parameters?.mode as "redteam" | "wapt") ?? meta?.mode ?? "wapt";
      const objective = (task.parameters?.objective as string) ?? DEFAULT_OBJECTIVE;
      const maxIterations = (task.parameters?.maxIterations as number) ?? 12;
      const autonomyLevel = (task.parameters?.autonomyLevel as number) ?? 5;

      const loop = createBugHunterToolLoop({
        agentId: this.agentId!,
        agentName: this.agentName,
        operationId: task.operationId,
        targetId: task.targetId,
        objective,
        constraints: {
          maxIterations,
          autonomyLevel,
          requireApprovalForCategories: mode === "redteam" ? [] : ["exploitation", "post-exploitation"],
        },
        hook: { mode, phase: "hunt" },
      });

      const runResult = await loop.run();

      const result: TaskResult = {
        success: runResult.status === "completed",
        data: {
          mode,
          loopStatus: runResult.status,
          iterations: runResult.iterations.length,
          toolsUsed: runResult.toolsUsed,
          summary: runResult.summary,
          totalDurationMs: runResult.totalDurationMs,
        },
        memoryIds: runResult.memoryIds,
        error: runResult.error,
      };
      await this.storeTaskMemory({ task, result, memoryType: "insight" });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    } finally {
      await this.updateStatus("idle");
    }
  }
}

export const huntAgent = new HuntAgent();
