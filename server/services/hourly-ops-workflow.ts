import { db } from "../db";
import { operations, agentActivityReports } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { opsManagementOrchestrator } from "./ops-management-orchestrator";
import { operationsManagerAgent } from "./operations-manager-agent";
import { memoryService } from "./memory-service";

// Import individual reporters
import { dashboardReporter } from "./reporters/dashboard-reporter";
import { operationsReporter } from "./reporters/operations-reporter";
import { targetsReporter } from "./reporters/targets-reporter";
import { vulnerabilitiesReporter } from "./reporters/vulnerabilities-reporter";
import { assetsReporter } from "./reporters/assets-reporter";
import { toolsReporter } from "./reporters/tools-reporter";
import { workflowsReporter } from "./reporters/workflows-reporter";
import { agentsReporter } from "./reporters/agents-reporter";

import type { BaseReporter } from "./reporters/base-reporter";

const reporters: Record<string, BaseReporter> = {
  dashboard: dashboardReporter,
  operations: operationsReporter,
  targets: targetsReporter,
  vulnerabilities: vulnerabilitiesReporter,
  surface_assessment: assetsReporter,
  tools: toolsReporter,
  workflows: workflowsReporter,
  agents: agentsReporter,
};

interface HourlyCycleResult {
  operationId: string;
  reportsGenerated: number;
  reportsFailed: number;
  synthesisResult: {
    summary: string;
    insights: string[];
    taskId: string;
  } | null;
  tasksGenerated: number;
  durationMs: number;
}

/**
 * Hourly Operations Workflow
 *
 * Higher-level orchestration that coordinates the full hourly cycle:
 * 1. Trigger all page reporters
 * 2. Wait for reports to complete
 * 3. Synthesize reports via Operations Manager
 * 4. Generate follow-up tasks if needed
 */
class HourlyOpsWorkflow {
  /**
   * Execute a full hourly cycle for an operation
   */
  async executeHourlyCycle(operationId: string): Promise<HourlyCycleResult> {
    const startTime = Date.now();

    console.log(`[HourlyOpsWorkflow] Starting hourly cycle for operation ${operationId}`);

    // Ensure memory context exists
    try {
      await memoryService.createContext({
        contextType: "operation",
        contextId: operationId,
        contextName: `Operation ${operationId}`,
      });
    } catch {
      // Context may already exist
    }

    // 1. Trigger all reporters
    const reportResults = await this.triggerReporters(operationId);
    const reportsGenerated = reportResults.filter((r) => r.success).length;
    const reportsFailed = reportResults.filter((r) => !r.success).length;

    console.log(
      `[HourlyOpsWorkflow] Reports: ${reportsGenerated} succeeded, ${reportsFailed} failed`,
    );

    if (reportsGenerated === 0) {
      console.warn("[HourlyOpsWorkflow] No reports generated, skipping synthesis");
      return {
        operationId,
        reportsGenerated: 0,
        reportsFailed,
        synthesisResult: null,
        tasksGenerated: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Synthesize reports
    let synthesisResult: HourlyCycleResult["synthesisResult"] = null;
    try {
      const synthesis = await operationsManagerAgent.synthesizeReports(operationId);
      synthesisResult = {
        summary: synthesis.summary,
        insights: synthesis.insights,
        taskId: synthesis.taskId,
      };
      console.log(
        `[HourlyOpsWorkflow] Synthesis complete: ${synthesis.reportCount} reports synthesized`,
      );
    } catch (error) {
      console.error("[HourlyOpsWorkflow] Synthesis failed:", error);
    }

    // 3. Generate follow-up tasks from synthesis insights
    let tasksGenerated = 0;
    if (synthesisResult && synthesisResult.insights.length > 0) {
      tasksGenerated = await this.generateTasksFromSynthesis(
        synthesisResult,
        operationId,
      );
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[HourlyOpsWorkflow] Hourly cycle complete in ${durationMs}ms: ` +
        `${reportsGenerated} reports, ${tasksGenerated} tasks generated`,
    );

    return {
      operationId,
      reportsGenerated,
      reportsFailed,
      synthesisResult,
      tasksGenerated,
      durationMs,
    };
  }

  /**
   * Trigger all page reporters in parallel
   */
  async triggerReporters(
    operationId: string,
  ): Promise<Array<{ pageRole: string; success: boolean; error?: string }>> {
    const reportingPeriod = new Date();

    const results = await Promise.allSettled(
      Object.entries(reporters).map(async ([pageRole, reporter]) => {
        try {
          await reporter.executeReport(operationId, reportingPeriod);
          return { pageRole, success: true };
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error(
            `[HourlyOpsWorkflow] Reporter ${pageRole} failed:`,
            errMsg,
          );
          return { pageRole, success: false, error: errMsg };
        }
      }),
    );

    return results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { pageRole: "unknown", success: false, error: "Promise rejected" },
    );
  }

  /**
   * Generate tasks from synthesis insights
   */
  private async generateTasksFromSynthesis(
    synthesis: NonNullable<HourlyCycleResult["synthesisResult"]>,
    operationId: string,
  ): Promise<number> {
    let count = 0;

    for (const insight of synthesis.insights.slice(0, 3)) {
      const insightLower = insight.toLowerCase();

      // Route insights to appropriate agent roles
      let targetRole = "qa_agent";
      let taskType = "investigation";

      if (
        insightLower.includes("vulnerabilit") ||
        insightLower.includes("remediat")
      ) {
        targetRole = "vulnerability_agent";
        taskType = "vulnerability_assessment";
      } else if (
        insightLower.includes("target") ||
        insightLower.includes("scope")
      ) {
        targetRole = "target_agent";
        taskType = "target_management";
      } else if (
        insightLower.includes("report") ||
        insightLower.includes("document")
      ) {
        targetRole = "technical_writer";
        taskType = "report_generation";
      }

      try {
        await operationsManagerAgent.delegateTask({
          taskType,
          taskName: `Follow-up: ${insight.substring(0, 80)}`,
          description: insight,
          operationId,
          targetAgentRole: targetRole,
          priority: 5,
        });
        count++;
      } catch (error) {
        console.error(
          "[HourlyOpsWorkflow] Failed to delegate task for insight:",
          error,
        );
      }
    }

    return count;
  }

  /**
   * Execute hourly cycle via the legacy orchestrator workflow system
   * (wrapper for backward compatibility)
   */
  async executeViaOrchestrator(
    operationId: string,
    workflowName?: string,
  ): Promise<any> {
    return opsManagementOrchestrator.startOpsManagementWorkflow(
      operationId,
      workflowName || `Hourly Ops Workflow - ${new Date().toISOString()}`,
    );
  }
}

export const hourlyOpsWorkflow = new HourlyOpsWorkflow();
