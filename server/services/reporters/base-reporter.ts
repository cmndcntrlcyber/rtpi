import { db } from "../../db";
import { agentActivityReports } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { memoryService, AddMemoryParams } from "../memory-service";
import { agentConfig } from "../../config/agent-config";
import { getReporterSpec } from "../../config/reporter-config";

// ============================================================================
// Types
// ============================================================================

export interface PageData {
  [key: string]: any;
}

export interface Change {
  type: string;
  field: string;
  previous?: any;
  current?: any;
  difference?: number;
  message: string;
}

export interface Issue {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  message: string;
  affectedItems?: string[];
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  action: string;
  category: string;
}

export interface ReportResult {
  reportId: string;
  pageRole: string;
  summary: string;
  metrics: Record<string, any>;
  changes: Change[];
  issues: Issue[];
  recommendations: Recommendation[];
}

// ============================================================================
// Base Reporter
// ============================================================================

export abstract class BaseReporter {
  protected pageRole: string;

  constructor(pageRole: string) {
    this.pageRole = pageRole;
  }

  /** Fetch current page data for the given operation */
  abstract fetchPageData(operationId: string): Promise<PageData>;

  /** Detect changes between previous and current state */
  detectChanges(previous: PageData | null, current: PageData): Change[] {
    const changes: Change[] = [];

    if (!previous) {
      return [{ type: "first_report", field: "all", message: "First report, no baseline for comparison" }];
    }

    // Compare numeric counts
    for (const key of Object.keys(current)) {
      if (key.endsWith("Count") && typeof current[key] === "number" && typeof previous[key] === "number") {
        const diff = current[key] - previous[key];
        if (diff !== 0) {
          changes.push({
            type: "count_change",
            field: key,
            previous: previous[key],
            current: current[key],
            difference: diff,
            message: `${key} changed from ${previous[key]} to ${current[key]} (${diff > 0 ? "+" : ""}${diff})`,
          });
        }
      }
    }

    return changes;
  }

  /** Identify issues in the current data */
  identifyIssues(_data: PageData): Issue[] {
    return [];
  }

  /** Generate recommendations based on issues and changes */
  generateRecommendations(_issues: Issue[], _changes: Change[]): Recommendation[] {
    return [];
  }

  /** Execute a full report cycle with memory integration */
  async executeReport(
    agentId: string,
    operationId: string,
    reportingPeriod: Date,
  ): Promise<ReportResult> {
    console.log(`[${this.pageRole}Reporter] Executing report for operation ${operationId}`);

    // Fetch last report for comparison
    const lastReport = await this.getLastReport(agentId, operationId);
    const previousState = lastReport?.pageState as PageData | null;

    // Fetch current data
    const currentData = await this.fetchPageData(operationId);

    // Detect changes
    const changes = this.detectChanges(previousState, currentData);

    // Identify issues
    const issues = this.identifyIssues(currentData);

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, changes);

    // Calculate metrics
    const metrics = this.calculateMetrics(currentData);

    // Generate summary
    const summary = this.generateSummary(changes, issues, metrics);

    // Store report in database
    const [report] = await db
      .insert(agentActivityReports)
      .values({
        agentId,
        agentPageRole: this.pageRole,
        operationId,
        reportType: "hourly_status",
        reportPeriodStart: new Date(reportingPeriod.getTime() - 3600000),
        reportPeriodEnd: reportingPeriod,
        activitySummary: summary,
        keyMetrics: metrics,
        pageState: currentData,
        changesDetected: changes,
        issuesReported: issues,
        recommendations,
        status: "submitted",
        synthesisStatus: "pending",
      })
      .returning();

    // Store in memory if enabled
    if (agentConfig.pageReporter.memoryEnabled) {
      await this.storeReportInMemory(operationId, agentId, report.id, summary, changes);
    }

    console.log(`[${this.pageRole}Reporter] Report ${report.id} created`);

    return {
      reportId: report.id,
      pageRole: this.pageRole,
      summary,
      metrics,
      changes,
      issues,
      recommendations,
    };
  }

  // ============================================================================
  // Protected Helpers
  // ============================================================================

  protected calculateMetrics(data: PageData): Record<string, any> {
    const metrics: Record<string, any> = {
      timestamp: new Date().toISOString(),
      pageRole: this.pageRole,
    };

    for (const key of Object.keys(data)) {
      if (key.endsWith("Count") || typeof data[key] === "number") {
        metrics[key] = data[key];
      }
    }

    return metrics;
  }

  protected generateSummary(changes: Change[], issues: Issue[], metrics: Record<string, any>): string {
    const parts: string[] = [`Reporter: ${this.pageRole}`];

    if (changes.length > 0) {
      parts.push(`Changes: ${changes.length} detected`);
    }
    if (issues.length > 0) {
      parts.push(`Issues: ${issues.length} identified`);
    }

    const metricKeys = Object.keys(metrics).filter((k) => k.endsWith("Count"));
    if (metricKeys.length > 0) {
      const metricSummary = metricKeys.map((k) => `${k}=${metrics[k]}`).join(", ");
      parts.push(`Metrics: ${metricSummary}`);
    }

    return parts.join(" | ");
  }

  protected groupByField(items: any[], field: string): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const item of items) {
      const value = item[field] || "unknown";
      groups[value] = (groups[value] || 0) + 1;
    }
    return groups;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async getLastReport(
    agentId: string,
    operationId: string,
  ): Promise<typeof agentActivityReports.$inferSelect | null> {
    const reports = await db
      .select()
      .from(agentActivityReports)
      .where(
        and(
          eq(agentActivityReports.agentId, agentId),
          eq(agentActivityReports.agentPageRole, this.pageRole),
        ),
      )
      .orderBy(desc(agentActivityReports.generatedAt))
      .limit(1);

    return reports.length > 0 ? reports[0] : null;
  }

  private async storeReportInMemory(
    operationId: string,
    agentId: string,
    reportId: string,
    summary: string,
    changes: Change[],
  ): Promise<void> {
    try {
      const context = await memoryService.createContext({
        contextType: "operation",
        contextId: operationId,
        contextName: `Operation ${operationId}`,
      });

      // Store report as event
      await memoryService.addMemory({
        contextId: context.id,
        memoryText: `${this.pageRole} Report: ${summary}`,
        memoryType: "event",
        sourceAgentId: agentId,
        sourceReportId: reportId,
        tags: [this.pageRole, "hourly-report"],
        metadata: { reportId, changeCount: changes.length },
      });

      // Store significant changes as insights
      const significantChanges = changes.filter(
        (c) => c.type === "count_change" && Math.abs(c.difference || 0) > 0,
      );
      if (significantChanges.length > 0) {
        await memoryService.addMemory({
          contextId: context.id,
          memoryText: `Significant changes on ${this.pageRole}: ${significantChanges.map((c) => c.message).join("; ")}`,
          memoryType: "insight",
          sourceAgentId: agentId,
          tags: [this.pageRole, "significant-change"],
        });
      }
    } catch (error) {
      console.error(`[${this.pageRole}Reporter] Failed to store report in memory:`, error);
    }
  }
}
