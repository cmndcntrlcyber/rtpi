import { db } from "../../db";
import { discoveredAssets } from "@shared/schema";
import { eq } from "drizzle-orm";
import { BaseReporter, PageData, Issue, Recommendation, Change } from "./base-reporter";

export class AssetsReporter extends BaseReporter {
  constructor() {
    super("surface_assessment");
  }

  async fetchPageData(operationId: string): Promise<PageData> {
    const assets = await db.select().from(discoveredAssets).where(eq(discoveredAssets.operationId, operationId));

    return {
      assets,
      totalCount: assets.length,
      byType: this.groupByField(assets, "type"),
      byStatus: this.groupByField(assets, "status"),
    };
  }

  identifyIssues(data: PageData): Issue[] {
    const issues: Issue[] = [];

    if (data.totalCount === 0) {
      issues.push({
        severity: "medium",
        category: "no_assets",
        message: "No assets discovered yet. Run a surface assessment scan.",
      });
    }

    return issues;
  }

  generateRecommendations(issues: Issue[], changes: Change[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const issue of issues) {
      if (issue.category === "no_assets") {
        recommendations.push({
          priority: "high",
          action: "Run BBOT scan to discover assets for this operation",
          category: "reconnaissance",
        });
      }
    }

    for (const change of changes) {
      if (change.field === "totalCount" && (change.difference || 0) > 10) {
        recommendations.push({
          priority: "medium",
          action: "Large number of new assets discovered, analyze for vulnerabilities",
          category: "reconnaissance",
        });
      }
    }

    return recommendations;
  }
}

export const assetsReporter = new AssetsReporter();
