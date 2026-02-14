import { db } from "../../db";
import { agentWorkflows } from "@shared/schema";
import { eq } from "drizzle-orm";
import { BaseReporter, PageData, Issue, Recommendation } from "./base-reporter";

export class WorkflowsReporter extends BaseReporter {
  constructor() {
    super("workflows");
  }

  async fetchPageData(operationId: string): Promise<PageData> {
    const workflows = await db.select().from(agentWorkflows).where(eq(agentWorkflows.operationId, operationId));

    return {
      workflows,
      totalCount: workflows.length,
      byStatus: this.groupByField(workflows, "status"),
      byType: this.groupByField(workflows, "workflowType"),
    };
  }

  identifyIssues(data: PageData): Issue[] {
    const issues: Issue[] = [];

    const failed = data.byStatus?.failed || 0;
    if (failed > 0) {
      issues.push({
        severity: "medium",
        category: "failed_workflows",
        message: `${failed} workflows have failed`,
      });
    }

    return issues;
  }

  generateRecommendations(issues: Issue[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const issue of issues) {
      if (issue.category === "failed_workflows") {
        recommendations.push({
          priority: "medium",
          action: "Investigate failed workflows and retry if appropriate",
          category: "operations",
        });
      }
    }

    return recommendations;
  }
}

export const workflowsReporter = new WorkflowsReporter();
