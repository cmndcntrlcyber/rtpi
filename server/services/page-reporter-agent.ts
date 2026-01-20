import { db } from "../db";
import {
  agentActivityReports,
  agents,
  operations,
  targets,
  vulnerabilities,
  agentWorkflows,
  discoveredAssets,
  securityTools,
} from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Page Reporter Agent Service
 *
 * Executes individual page reporter agents that monitor specific aspects of the system.
 * Each reporter:
 * - Collects data from its assigned page/domain
 * - Detects changes since last report
 * - Identifies issues and milestones
 * - Generates actionable recommendations
 */
class PageReporterAgent {
  /**
   * Execute a reporter agent
   *
   * @param agentId - ID of the reporter agent
   * @param operationId - ID of the operation
   * @param reportingPeriod - Timestamp for this reporting period
   * @returns Report data
   */
  async executeReporter(
    agentId: string,
    operationId: string,
    reportingPeriod: Date
  ): Promise<any> {
    console.log(`📝 [PageReporterAgent] Executing reporter ${agentId} for operation ${operationId}`);

    try {
      // Get agent configuration
      const agent = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);

      if (agent.length === 0) {
        throw new Error(`Agent ${agentId} not found`);
      }

      const agentConfig = agent[0].config as any;
      const pageRole = agentConfig?.pageRole || "unknown";

      console.log(`📊 [PageReporterAgent] Reporter role: ${pageRole}`);

      // Get last report for comparison
      const lastReport = await this.getLastReport(agentId, operationId);

      // Fetch current page data based on role
      const currentData = await this.fetchPageData(pageRole, operationId);

      // Detect changes
      const changes = this.detectChanges(lastReport?.pageState, currentData);

      // Identify issues and recommendations
      const issues = this.identifyIssues(pageRole, currentData);
      const recommendations = this.generateRecommendations(pageRole, issues, changes);

      // Calculate key metrics
      const keyMetrics = this.calculateMetrics(pageRole, currentData);

      // Generate activity summary
      const activitySummary = this.generateSummary(pageRole, changes, issues, keyMetrics);

      // Store report
      const report = await db
        .insert(agentActivityReports)
        .values({
          agentId,
          agentPageRole: pageRole,
          operationId,
          reportType: "hourly_status",
          reportPeriodStart: new Date(reportingPeriod.getTime() - 3600000), // 1 hour ago
          reportPeriodEnd: reportingPeriod,
          activitySummary,
          keyMetrics,
          pageState: currentData,
          changesDetected: changes,
          issuesReported: issues,
          recommendations,
          status: "submitted",
        })
        .returning();

      console.log(`✅ [PageReporterAgent] Report ${report[0].id} created for agent ${agentId}`);

      return {
        reportId: report[0].id,
        pageRole,
        summary: activitySummary,
        metrics: keyMetrics,
        changeCount: changes.length,
        issueCount: issues.length,
      };
    } catch (error) {
      console.error(
        `❌ [PageReporterAgent] Failed to execute reporter ${agentId}:`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Get the last report for an agent
   */
  private async getLastReport(
    agentId: string,
    operationId: string
  ): Promise<typeof agentActivityReports.$inferSelect | null> {
    const reports = await db
      .select()
      .from(agentActivityReports)
      .where(eq(agentActivityReports.agentId, agentId))
      .orderBy(desc(agentActivityReports.generatedAt))
      .limit(1);

    return reports.length > 0 ? reports[0] : null;
  }

  /**
   * Fetch data for a specific page role
   */
  private async fetchPageData(pageRole: string, operationId: string): Promise<any> {
    switch (pageRole) {
      case "dashboard":
        return this.fetchDashboardData(operationId);

      case "operations":
        return this.fetchOperationsData(operationId);

      case "targets":
        return this.fetchTargetsData(operationId);

      case "vulnerabilities":
        return this.fetchVulnerabilitiesData(operationId);

      case "surface_assessment":
        return this.fetchSurfaceAssessmentData(operationId);

      case "agents":
        return this.fetchAgentsData(operationId);

      case "tools":
        return this.fetchToolsData(operationId);

      case "workflows":
        return this.fetchWorkflowsData(operationId);

      default:
        console.warn(`⚠️  [PageReporterAgent] Unknown page role: ${pageRole}`);
        return { pageRole, note: "No data collection implemented for this role" };
    }
  }

  /**
   * Fetch dashboard data
   */
  private async fetchDashboardData(operationId: string): Promise<any> {
    const operation = await db.select().from(operations).where(eq(operations.id, operationId)).limit(1);

    const targetCount = await db.select().from(targets).where(eq(targets.operationId, operationId));
    const vulnCount = await db.select().from(vulnerabilities).where(eq(vulnerabilities.operationId, operationId));
    const activeWorkflows = await db
      .select()
      .from(agentWorkflows)
      .where(eq(agentWorkflows.operationId, operationId));

    return {
      operation: operation[0],
      targetCount: targetCount.length,
      vulnerabilityCount: vulnCount.length,
      workflowCount: activeWorkflows.length,
      activeWorkflows: activeWorkflows.filter((w) => w.status === "running").length,
    };
  }

  /**
   * Fetch operations data
   */
  private async fetchOperationsData(operationId: string): Promise<any> {
    const operation = await db.select().from(operations).where(eq(operations.id, operationId)).limit(1);

    return {
      operation: operation[0],
      status: operation[0]?.status,
      teamMembers: (operation[0]?.teamMembers as any) || [],
    };
  }

  /**
   * Fetch targets data
   */
  private async fetchTargetsData(operationId: string): Promise<any> {
    const targetsList = await db.select().from(targets).where(eq(targets.operationId, operationId));

    return {
      targets: targetsList,
      totalCount: targetsList.length,
      byType: this.groupByField(targetsList, "type"),
      byPriority: this.groupByField(targetsList, "priority"),
    };
  }

  /**
   * Fetch vulnerabilities data
   */
  private async fetchVulnerabilitiesData(operationId: string): Promise<any> {
    const vulns = await db.select().from(vulnerabilities).where(eq(vulnerabilities.operationId, operationId));

    return {
      vulnerabilities: vulns,
      totalCount: vulns.length,
      bySeverity: this.groupByField(vulns, "severity"),
      byStatus: this.groupByField(vulns, "status"),
    };
  }

  /**
   * Fetch surface assessment data
   */
  private async fetchSurfaceAssessmentData(operationId: string): Promise<any> {
    const assets = await db.select().from(discoveredAssets).where(eq(discoveredAssets.operationId, operationId));

    return {
      assets,
      totalCount: assets.length,
      byType: this.groupByField(assets, "type"),
      byStatus: this.groupByField(assets, "status"),
    };
  }

  /**
   * Fetch agents data
   */
  private async fetchAgentsData(operationId: string): Promise<any> {
    const allAgents = await db.select().from(agents);

    return {
      agents: allAgents,
      totalCount: allAgents.length,
      byStatus: this.groupByField(allAgents, "status"),
      byType: this.groupByField(allAgents, "type"),
    };
  }

  /**
   * Fetch tools data
   */
  private async fetchToolsData(operationId: string): Promise<any> {
    const tools = await db.select().from(securityTools);

    return {
      tools,
      totalCount: tools.length,
      byCategory: this.groupByField(tools, "category"),
      byStatus: this.groupByField(tools, "status"),
    };
  }

  /**
   * Fetch workflows data
   */
  private async fetchWorkflowsData(operationId: string): Promise<any> {
    const workflows = await db.select().from(agentWorkflows).where(eq(agentWorkflows.operationId, operationId));

    return {
      workflows,
      totalCount: workflows.length,
      byStatus: this.groupByField(workflows, "status"),
      byType: this.groupByField(workflows, "workflowType"),
    };
  }

  /**
   * Detect changes between previous and current state
   */
  private detectChanges(previousState: any, currentState: any): any[] {
    const changes: any[] = [];

    if (!previousState) {
      return [{ type: "first_report", message: "First report, no baseline for comparison" }];
    }

    // Compare counts
    const prevKeys = Object.keys(previousState);
    for (const key of prevKeys) {
      if (key.endsWith("Count") && typeof currentState[key] === "number") {
        const diff = currentState[key] - previousState[key];
        if (diff !== 0) {
          changes.push({
            type: "count_change",
            field: key,
            previous: previousState[key],
            current: currentState[key],
            difference: diff,
            message: `${key} changed from ${previousState[key]} to ${currentState[key]} (${diff > 0 ? "+" : ""}${diff})`,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Identify issues in current data
   */
  private identifyIssues(pageRole: string, currentData: any): any[] {
    const issues: any[] = [];

    switch (pageRole) {
      case "vulnerabilities":
        if (currentData.bySeverity?.critical > 0) {
          issues.push({
            severity: "high",
            category: "critical_vulns",
            message: `${currentData.bySeverity.critical} critical vulnerabilities require immediate attention`,
          });
        }
        break;

      case "workflows":
        const failed = currentData.byStatus?.failed || 0;
        if (failed > 0) {
          issues.push({
            severity: "medium",
            category: "failed_workflows",
            message: `${failed} workflows have failed`,
          });
        }
        break;

      case "agents":
        const errorAgents = currentData.byStatus?.error || 0;
        if (errorAgents > 0) {
          issues.push({
            severity: "medium",
            category: "agent_errors",
            message: `${errorAgents} agents are in error state`,
          });
        }
        break;
    }

    return issues;
  }

  /**
   * Generate recommendations based on issues and changes
   */
  private generateRecommendations(pageRole: string, issues: any[], changes: any[]): any[] {
    const recommendations: any[] = [];

    // Recommendations based on issues
    for (const issue of issues) {
      if (issue.category === "critical_vulns") {
        recommendations.push({
          priority: "high",
          action: "Review and remediate critical vulnerabilities immediately",
          category: "security",
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

    // Recommendations based on changes
    for (const change of changes) {
      if (change.type === "count_change" && change.field === "vulnerabilityCount" && change.difference > 0) {
        recommendations.push({
          priority: "medium",
          action: "New vulnerabilities detected, review and prioritize",
          category: "security",
        });
      }
    }

    return recommendations;
  }

  /**
   * Calculate key metrics
   */
  private calculateMetrics(pageRole: string, currentData: any): any {
    const metrics: any = {
      timestamp: new Date().toISOString(),
      pageRole,
    };

    // Extract counts
    Object.keys(currentData).forEach((key) => {
      if (key.endsWith("Count")) {
        metrics[key] = currentData[key];
      }
    });

    return metrics;
  }

  /**
   * Generate activity summary
   */
  private generateSummary(pageRole: string, changes: any[], issues: any[], metrics: any): string {
    const parts: string[] = [];

    parts.push(`Reporter: ${pageRole}`);

    if (changes.length > 0) {
      parts.push(`Changes: ${changes.length} detected`);
    }

    if (issues.length > 0) {
      parts.push(`Issues: ${issues.length} identified`);
    }

    // Add key metrics
    const metricKeys = Object.keys(metrics).filter((k) => k.endsWith("Count"));
    if (metricKeys.length > 0) {
      const metricSummary = metricKeys.map((k) => `${k}=${metrics[k]}`).join(", ");
      parts.push(`Metrics: ${metricSummary}`);
    }

    return parts.join(" | ");
  }

  /**
   * Group array of objects by a field
   */
  private groupByField(items: any[], field: string): Record<string, number> {
    const groups: Record<string, number> = {};

    for (const item of items) {
      const value = item[field] || "unknown";
      groups[value] = (groups[value] || 0) + 1;
    }

    return groups;
  }
}

// Singleton instance
export const pageReporterAgent = new PageReporterAgent();
