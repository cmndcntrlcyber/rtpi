import { db } from "../../db";
import { operations, targets } from "@shared/schema";
import { eq } from "drizzle-orm";
import { BaseReporter, PageData, Issue, Recommendation } from "./base-reporter";

export class OperationsReporter extends BaseReporter {
  constructor() {
    super("operations");
  }

  async fetchPageData(operationId: string): Promise<PageData> {
    const operation = await db.select().from(operations).where(eq(operations.id, operationId)).limit(1);
    const targetList = await db.select().from(targets).where(eq(targets.operationId, operationId));

    return {
      operation: operation[0],
      status: operation[0]?.status,
      teamMembers: (operation[0]?.teamMembers as any) || [],
      targetCount: targetList.length,
      hourlyReportingEnabled: operation[0]?.hourlyReportingEnabled,
    };
  }

  identifyIssues(data: PageData): Issue[] {
    const issues: Issue[] = [];

    if (data.status === "paused") {
      issues.push({
        severity: "low",
        category: "paused_operation",
        message: "Operation is currently paused",
      });
    }

    if (data.targetCount === 0 && data.status === "active") {
      issues.push({
        severity: "medium",
        category: "active_no_targets",
        message: "Active operation has no targets assigned",
      });
    }

    return issues;
  }

  generateRecommendations(issues: Issue[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const issue of issues) {
      if (issue.category === "active_no_targets") {
        recommendations.push({
          priority: "high",
          action: "Add targets to active operation to begin work",
          category: "operations",
        });
      }
    }

    return recommendations;
  }
}

export const operationsReporter = new OperationsReporter();
