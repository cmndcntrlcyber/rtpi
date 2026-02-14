import { BaseTaskAgent, TaskDefinition, TaskResult } from "./base-task-agent";
import { db } from "../../db";
import { targets, discoveredAssets } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Target Agent
 * Manages target lifecycle, scope validation, prioritization,
 * and target-related operational tasks.
 */
export class TargetAgent extends BaseTaskAgent {
  constructor() {
    super("Target Agent", "target_agent", [
      "target_management",
      "scope_analysis",
      "prioritization",
    ]);
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    await this.updateStatus("running");

    try {
      switch (task.taskType) {
        case "prioritize_targets":
          return await this.prioritizeTargets(task);
        case "validate_scope":
          return await this.validateScope(task);
        case "analyze_coverage":
          return await this.analyzeCoverage(task);
        default:
          return { success: false, error: `Unknown task type: ${task.taskType}` };
      }
    } catch (error) {
      await this.updateStatus("error");
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errMsg };
    } finally {
      await this.updateStatus("idle");
    }
  }

  private async prioritizeTargets(task: TaskDefinition): Promise<TaskResult> {
    if (!task.operationId) {
      return { success: false, error: "operationId required" };
    }

    const targetList = await db
      .select()
      .from(targets)
      .where(eq(targets.operationId, task.operationId));

    // Get asset counts per target to determine priority
    const prioritized = await Promise.all(
      targetList.map(async (target) => {
        const assets = await db
          .select()
          .from(discoveredAssets)
          .where(eq(discoveredAssets.targetId, target.id));

        return {
          targetId: target.id,
          targetName: target.name,
          assetCount: assets.length,
          suggestedPriority: assets.length > 10 ? "high" : assets.length > 3 ? "medium" : "low",
        };
      }),
    );

    await this.storeTaskMemory({
      task,
      result: { success: true, data: { prioritized: prioritized.length } },
      memoryType: "insight",
    });

    return {
      success: true,
      data: {
        totalTargets: targetList.length,
        prioritized,
      },
    };
  }

  private async validateScope(task: TaskDefinition): Promise<TaskResult> {
    if (!task.operationId) {
      return { success: false, error: "operationId required" };
    }

    const targetList = await db
      .select()
      .from(targets)
      .where(eq(targets.operationId, task.operationId));

    // Check for known memory about scope
    const scopeMemories = await this.getRelevantMemories({
      operationId: task.operationId,
      taskType: "scope_validation",
      limit: 20,
    });

    return {
      success: true,
      data: {
        totalTargets: targetList.length,
        scopeMemories: scopeMemories.length,
        message: `${targetList.length} targets in scope, ${scopeMemories.length} scope-related memories found`,
      },
    };
  }

  private async analyzeCoverage(task: TaskDefinition): Promise<TaskResult> {
    if (!task.operationId) {
      return { success: false, error: "operationId required" };
    }

    const targetList = await db
      .select()
      .from(targets)
      .where(eq(targets.operationId, task.operationId));

    const coverage = await Promise.all(
      targetList.map(async (target) => {
        const assets = await db
          .select()
          .from(discoveredAssets)
          .where(eq(discoveredAssets.targetId, target.id));

        return {
          targetId: target.id,
          targetName: target.name,
          assetsDiscovered: assets.length,
          hasBeenScanned: assets.length > 0,
        };
      }),
    );

    const scannedCount = coverage.filter((c) => c.hasBeenScanned).length;

    await this.storeTaskMemory({
      task,
      result: { success: true, data: { coveragePercent: (scannedCount / targetList.length) * 100 } },
      memoryType: "fact",
    });

    return {
      success: true,
      data: {
        totalTargets: targetList.length,
        scannedTargets: scannedCount,
        coveragePercent: targetList.length > 0 ? (scannedCount / targetList.length) * 100 : 0,
        coverage,
      },
    };
  }
}

export const targetAgent = new TargetAgent();
