import { db } from "../../db";
import { operations, targets, vulnerabilities, agentWorkflows } from "@shared/schema";
import { eq } from "drizzle-orm";
import { BaseReporter, PageData, Issue, Recommendation, Change } from "./base-reporter";

export class DashboardReporter extends BaseReporter {
  constructor() {
    super("dashboard");
  }

  async fetchPageData(operationId: string): Promise<PageData> {
    const operation = await db.select().from(operations).where(eq(operations.id, operationId)).limit(1);
    const targetList = await db.select().from(targets).where(eq(targets.operationId, operationId));
    const vulnList = await db.select().from(vulnerabilities).where(eq(vulnerabilities.operationId, operationId));
    const workflows = await db.select().from(agentWorkflows).where(eq(agentWorkflows.operationId, operationId));

    return {
      operation: operation[0],
      targetCount: targetList.length,
      vulnerabilityCount: vulnList.length,
      workflowCount: workflows.length,
      activeWorkflows: workflows.filter((w) => w.status === "running").length,
      completedWorkflows: workflows.filter((w) => w.status === "completed").length,
      failedWorkflows: workflows.filter((w) => w.status === "failed").length,
    };
  }

  identifyIssues(data: PageData): Issue[] {
    const issues: Issue[] = [];

    if (data.targetCount === 0) {
      issues.push({
        severity: "medium",
        category: "no_targets",
        message: "No targets assigned to this operation",
      });
    }

    if (data.failedWorkflows > 0) {
      issues.push({
        severity: "medium",
        category: "failed_workflows",
        message: `${data.failedWorkflows} workflows have failed`,
      });
    }

    return issues;
  }

  generateRecommendations(issues: Issue[], changes: Change[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const issue of issues) {
      if (issue.category === "no_targets") {
        recommendations.push({
          priority: "high",
          action: "Add targets to this operation to begin reconnaissance",
          category: "operations",
        });
      }
      if (issue.category === "failed_workflows") {
        recommendations.push({
          priority: "medium",
          action: "Investigate failed workflows and retry if appropriate",
          category: "operations",
        });
      }
    }

    for (const change of changes) {
      if (change.field === "vulnerabilityCount" && (change.difference || 0) > 0) {
        recommendations.push({
          priority: "medium",
          action: "New vulnerabilities detected, review and prioritize",
          category: "security",
        });
      }
    }

    return recommendations;
  }
}

export const dashboardReporter = new DashboardReporter();
