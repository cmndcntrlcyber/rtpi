import client from "prom-client";

client.collectDefaultMetrics({ prefix: "rtpi_" });

export const toolExecutionDuration = new client.Histogram({
  name: "rtpi_tool_execution_duration_seconds",
  help: "Duration of tool executions in seconds",
  labelNames: ["tool", "status"] as const,
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300, 600],
});

export const toolExecutionsTotal = new client.Counter({
  name: "rtpi_tool_executions_total",
  help: "Total number of tool executions",
  labelNames: ["tool", "status"] as const,
});

export const scanDuration = new client.Histogram({
  name: "rtpi_scan_duration_seconds",
  help: "Duration of security scans in seconds",
  labelNames: ["scanner", "target_type"] as const,
  buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600, 7200],
});

export const agentWorkflowCompletions = new client.Counter({
  name: "rtpi_agent_workflow_completions_total",
  help: "Total number of agent workflow completions",
  labelNames: ["status"] as const,
});

export const httpRequestDuration = new client.Histogram({
  name: "rtpi_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const auditEventsTotal = new client.Counter({
  name: "rtpi_audit_events_total",
  help: "Total number of audit events",
  labelNames: ["action", "success"] as const,
});

export const healthStatus = new client.Gauge({
  name: "rtpi_health_status",
  help: "Component health status (1=healthy, 0.5=degraded, 0=unhealthy)",
  labelNames: ["component"] as const,
});

export const metricsRegistry = client.register;
