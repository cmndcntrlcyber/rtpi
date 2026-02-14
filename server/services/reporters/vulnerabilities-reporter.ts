import { db } from "../../db";
import { vulnerabilities } from "@shared/schema";
import { eq } from "drizzle-orm";
import { BaseReporter, PageData, Issue, Recommendation, Change } from "./base-reporter";

export class VulnerabilitiesReporter extends BaseReporter {
  constructor() {
    super("vulnerabilities");
  }

  async fetchPageData(operationId: string): Promise<PageData> {
    const vulns = await db.select().from(vulnerabilities).where(eq(vulnerabilities.operationId, operationId));

    return {
      vulnerabilities: vulns,
      totalCount: vulns.length,
      bySeverity: this.groupByField(vulns, "severity"),
      byStatus: this.groupByField(vulns, "status"),
    };
  }

  identifyIssues(data: PageData): Issue[] {
    const issues: Issue[] = [];

    if ((data.bySeverity?.critical || 0) > 0) {
      issues.push({
        severity: "critical",
        category: "critical_vulns",
        message: `${data.bySeverity.critical} critical vulnerabilities require immediate attention`,
      });
    }

    if ((data.bySeverity?.high || 0) > 5) {
      issues.push({
        severity: "high",
        category: "high_vuln_count",
        message: `${data.bySeverity.high} high-severity vulnerabilities detected`,
      });
    }

    return issues;
  }

  generateRecommendations(issues: Issue[], changes: Change[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const issue of issues) {
      if (issue.category === "critical_vulns") {
        recommendations.push({
          priority: "high",
          action: "Review and remediate critical vulnerabilities immediately",
          category: "security",
        });
      }
    }

    for (const change of changes) {
      if (change.field === "totalCount" && (change.difference || 0) > 0) {
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

export const vulnerabilitiesReporter = new VulnerabilitiesReporter();
