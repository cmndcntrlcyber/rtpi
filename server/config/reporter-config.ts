/**
 * Page Reporter Configuration (v2.3.2)
 * Defines per-page reporter specifications and monitoring rules.
 */

export interface PageReporterSpec {
  pageId: string;
  pageName: string;
  pageUrl: string;
  description: string;
  enabled: boolean;
  pollingIntervalMs: number;
  monitoredMetrics: string[];
  summaryPromptTemplate: string;
}

export const reporterSpecs: Record<string, PageReporterSpec> = {
  dashboard: {
    pageId: "dashboard",
    pageName: "Dashboard",
    pageUrl: "/",
    description: "Main dashboard overview with operation stats and activity",
    enabled: true,
    pollingIntervalMs: 3600000,
    monitoredMetrics: ["targetCount", "vulnerabilityCount", "workflowCount", "activeWorkflows"],
    summaryPromptTemplate: `Analyze the dashboard metrics and generate a concise operational summary:
- Targets: {{targetCount}}
- Vulnerabilities: {{vulnerabilityCount}}
- Workflows: {{workflowCount}} ({{activeWorkflows}} active)
Focus on: operational readiness, critical issues, and next recommended actions.`,
  },

  operations: {
    pageId: "operations",
    pageName: "Operations",
    pageUrl: "/operations",
    description: "Operations management page with operation status and targets",
    enabled: true,
    pollingIntervalMs: 3600000,
    monitoredMetrics: ["status", "teamMembers"],
    summaryPromptTemplate: `Summarize the current operation status:
Status: {{status}}
Team Members: {{teamMembers}}
Highlight: operations needing attention, recent changes, and recommended next steps.`,
  },

  targets: {
    pageId: "targets",
    pageName: "Targets",
    pageUrl: "/targets",
    description: "Target management with scan results and discovered services",
    enabled: true,
    pollingIntervalMs: 3600000,
    monitoredMetrics: ["totalCount", "byType", "byPriority"],
    summaryPromptTemplate: `Analyze target reconnaissance status:
Total Targets: {{totalCount}}
By Type: {{byType}}
By Priority: {{byPriority}}
Focus on: scan coverage, new discoveries, and targets needing attention.`,
  },

  vulnerabilities: {
    pageId: "vulnerabilities",
    pageName: "Vulnerabilities",
    pageUrl: "/vulnerabilities",
    description: "Vulnerability tracking with severity breakdown and verification status",
    enabled: true,
    pollingIntervalMs: 3600000,
    monitoredMetrics: ["totalCount", "bySeverity", "byStatus"],
    summaryPromptTemplate: `Summarize vulnerability assessment status:
Total: {{totalCount}}
By Severity: {{bySeverity}}
By Status: {{byStatus}}
Focus on: critical findings, verification status, and remediation priorities.`,
  },

  surface_assessment: {
    pageId: "surface_assessment",
    pageName: "Discovered Assets",
    pageUrl: "/surface-assessment",
    description: "Discovered assets from reconnaissance with attack surface mapping",
    enabled: true,
    pollingIntervalMs: 3600000,
    monitoredMetrics: ["totalCount", "byType", "byStatus"],
    summaryPromptTemplate: `Summarize attack surface discovery:
Total Assets: {{totalCount}}
By Type: {{byType}}
By Status: {{byStatus}}
Focus on: new discoveries, interesting services, and next reconnaissance steps.`,
  },

  tools: {
    pageId: "tools",
    pageName: "Security Tools",
    pageUrl: "/tools",
    description: "Security tool library and execution history",
    enabled: true,
    pollingIntervalMs: 3600000,
    monitoredMetrics: ["totalCount", "byCategory", "byStatus"],
    summaryPromptTemplate: `Summarize security tool activity:
Total Tools: {{totalCount}}
By Category: {{byCategory}}
By Status: {{byStatus}}
Focus on: tool usage patterns and integration opportunities.`,
  },

  workflows: {
    pageId: "workflows",
    pageName: "Agent Workflows",
    pageUrl: "/agent-workflows",
    description: "Agent workflow orchestration and task execution",
    enabled: true,
    pollingIntervalMs: 1800000,
    monitoredMetrics: ["totalCount", "byStatus", "byType"],
    summaryPromptTemplate: `Summarize workflow execution status:
Total: {{totalCount}}
By Status: {{byStatus}}
By Type: {{byType}}
Focus on: workflow progress, stalled tasks, and completion rates.`,
  },

  agents: {
    pageId: "agents",
    pageName: "AI Agents",
    pageUrl: "/agents",
    description: "AI agent status and activity monitoring",
    enabled: true,
    pollingIntervalMs: 1800000,
    monitoredMetrics: ["totalCount", "byStatus", "byType"],
    summaryPromptTemplate: `Summarize agent system health:
Total: {{totalCount}}
By Status: {{byStatus}}
By Type: {{byType}}
Focus on: agent health, error states, and capacity.`,
  },
};

/** Get all enabled reporter page IDs */
export function getEnabledReporterPages(): string[] {
  return Object.values(reporterSpecs)
    .filter((spec) => spec.enabled)
    .map((spec) => spec.pageId);
}

/** Get reporter spec by page ID */
export function getReporterSpec(pageId: string): PageReporterSpec | undefined {
  return reporterSpecs[pageId];
}
