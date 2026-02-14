import { db } from "../../db";
import { agents } from "@shared/schema";
import { BaseReporter, PageData, Issue, Recommendation } from "./base-reporter";

export class AgentsReporter extends BaseReporter {
  constructor() {
    super("agents");
  }

  async fetchPageData(_operationId: string): Promise<PageData> {
    const allAgents = await db.select().from(agents);

    return {
      agents: allAgents,
      totalCount: allAgents.length,
      byStatus: this.groupByField(allAgents, "status"),
      byType: this.groupByField(allAgents, "type"),
    };
  }

  identifyIssues(data: PageData): Issue[] {
    const issues: Issue[] = [];

    const errorAgents = data.byStatus?.error || 0;
    if (errorAgents > 0) {
      issues.push({
        severity: "medium",
        category: "agent_errors",
        message: `${errorAgents} agents are in error state`,
      });
    }

    return issues;
  }

  generateRecommendations(issues: Issue[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const issue of issues) {
      if (issue.category === "agent_errors") {
        recommendations.push({
          priority: "medium",
          action: "Investigate and restart agents in error state",
          category: "operations",
        });
      }
    }

    return recommendations;
  }
}

export const agentsReporter = new AgentsReporter();
