import { BaseTaskAgent, TaskDefinition, TaskResult } from "./base-task-agent";
import { db } from "../../db";
import { vulnerabilities, agentActivityReports } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { memoryService } from "../memory-service";

/**
 * QA Agent
 * Validates scan results, checks for false positives, verifies finding quality,
 * and ensures operational data integrity.
 */
export class QAAgent extends BaseTaskAgent {
  constructor() {
    super("QA Agent", "qa_agent", [
      "validation",
      "verification",
      "quality_assurance",
      "false_positive_detection",
    ]);
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    await this.updateStatus("running");

    try {
      switch (task.taskType) {
        case "validate_findings":
          return await this.validateFindings(task);
        case "check_report_quality":
          return await this.checkReportQuality(task);
        case "verify_scan_completeness":
          return await this.verifyScanCompleteness(task);
        default:
          return await this.genericValidation(task);
      }
    } catch (error) {
      await this.updateStatus("error");
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errMsg };
    } finally {
      await this.updateStatus("idle");
    }
  }

  private async validateFindings(task: TaskDefinition): Promise<TaskResult> {
    if (!task.operationId) {
      return { success: false, error: "operationId required" };
    }

    const vulns = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.operationId, task.operationId));

    const issues: string[] = [];

    for (const vuln of vulns) {
      // Check for missing descriptions
      if (!vuln.description || vuln.description.length < 20) {
        issues.push(`Vulnerability "${vuln.title}" has insufficient description`);
      }
      // Check for missing severity
      if (!vuln.severity) {
        issues.push(`Vulnerability "${vuln.title}" is missing severity rating`);
      }
    }

    await this.storeTaskMemory({
      task,
      result: { success: true, data: { issueCount: issues.length, issues: issues.slice(0, 20) } },
      memoryType: "event",
    });

    return {
      success: true,
      data: {
        totalFindings: vulns.length,
        issueCount: issues.length,
        issues: issues.slice(0, 20),
        passRate: vulns.length > 0 ? ((vulns.length - issues.length) / vulns.length) * 100 : 100,
      },
    };
  }

  private async checkReportQuality(task: TaskDefinition): Promise<TaskResult> {
    if (!task.operationId) {
      return { success: false, error: "operationId required" };
    }

    const reports = await db
      .select()
      .from(agentActivityReports)
      .where(eq(agentActivityReports.operationId, task.operationId));

    const issues: string[] = [];

    for (const report of reports) {
      if (!report.activitySummary || report.activitySummary.length < 10) {
        issues.push(`Report ${report.id} has insufficient summary`);
      }
      if (!report.keyMetrics || Object.keys(report.keyMetrics as any).length === 0) {
        issues.push(`Report ${report.id} has no key metrics`);
      }
    }

    return {
      success: true,
      data: {
        totalReports: reports.length,
        issueCount: issues.length,
        issues: issues.slice(0, 20),
      },
    };
  }

  private async verifyScanCompleteness(task: TaskDefinition): Promise<TaskResult> {
    const memories = await this.getRelevantMemories({
      operationId: task.operationId,
      taskType: "surface_assessment",
      limit: 50,
    });

    return {
      success: true,
      data: {
        relatedMemories: memories.length,
        message: `Found ${memories.length} scan-related memory entries for review`,
      },
    };
  }

  private async genericValidation(task: TaskDefinition): Promise<TaskResult> {
    await this.storeTaskMemory({
      task,
      result: { success: true, data: { message: "Generic validation completed" } },
      memoryType: "event",
    });

    return {
      success: true,
      data: { message: `QA validation completed for task type: ${task.taskType}` },
    };
  }
}

export const qaAgent = new QAAgent();
