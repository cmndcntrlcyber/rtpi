import { db } from "../../db";
import { targets } from "@shared/schema";
import { eq } from "drizzle-orm";
import { BaseReporter, PageData, Issue, Recommendation, Change } from "./base-reporter";

export class TargetsReporter extends BaseReporter {
  constructor() {
    super("targets");
  }

  async fetchPageData(operationId: string): Promise<PageData> {
    const targetList = await db.select().from(targets).where(eq(targets.operationId, operationId));

    return {
      targets: targetList,
      totalCount: targetList.length,
      byType: this.groupByField(targetList, "type"),
      byPriority: this.groupByField(targetList, "priority"),
    };
  }

  identifyIssues(data: PageData): Issue[] {
    const issues: Issue[] = [];

    if (data.totalCount === 0) {
      issues.push({
        severity: "medium",
        category: "no_targets",
        message: "No targets assigned to this operation",
      });
    }

    return issues;
  }

  generateRecommendations(issues: Issue[], changes: Change[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const change of changes) {
      if (change.field === "totalCount" && (change.difference || 0) > 0) {
        recommendations.push({
          priority: "high",
          action: "Run surface assessment on newly added targets",
          category: "reconnaissance",
        });
      }
    }

    return recommendations;
  }
}

export const targetsReporter = new TargetsReporter();
