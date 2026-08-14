/**
 * Ferry Orchestrator Client — v3.10.3a Sprint 2.1
 *
 * Mirrors the langgraph-client.ts API surface but routes through
 * ferry-client.ts to the nexus-harness skill engine. Used when
 * FF_FERRY_BRIDGE=true; the legacy LangGraph path remains as fallback
 * when FF_FERRY_BRIDGE=false.
 */

import { randomUUID } from "crypto";
import { ferryClient } from "./ferry-client";
import { harnessToolExecutor } from "./harness-tool-executor";
import { createLogger } from "../lib/logger";
const log = createLogger("ferry-orchestrator");

export async function checkFerryHealth(): Promise<{
  status: string;
  workflow_compiled: boolean;
  version: string;
}> {
  const health = await ferryClient.checkHealth();
  return {
    status: health.status,
    workflow_compiled: true,
    version: health.version,
  };
}

export async function startEngagementViaFerry(req: {
  engagement_id?: string;
  targets: string[];
  scope_constraints?: string[];
}): Promise<{ engagement_id: string; status: string; current_phase: string }> {
  const engagementId = req.engagement_id || `eng-${randomUUID()}`;
  log.info(`[ferry] starting engagement ${engagementId} targets=${req.targets.join(",")}`);

  const result = await ferryClient.submitTask({
    task_id: engagementId,
    tool_name: "offense/orchestration/engagement-pipeline",
    json_arguments: JSON.stringify({
      action: "start",
      targets: req.targets,
      scope_constraints: req.scope_constraints || [],
    }),
    session_id: engagementId,
  });

  return {
    engagement_id: engagementId,
    status: result.is_error ? "failed" : "started",
    current_phase: result.is_error ? "error" : "planning",
  };
}

export async function getEngagementStatusViaFerry(
  engagementId: string,
): Promise<{ engagement_id: string; status: string; current_phase: string }> {
  const result = await ferryClient.submitTask({
    task_id: `${engagementId}-status-${Date.now()}`,
    tool_name: "offense/orchestration/engagement-pipeline",
    json_arguments: JSON.stringify({
      action: "status",
      engagement_id: engagementId,
    }),
    session_id: engagementId,
  });

  try {
    const parsed = JSON.parse(result.output);
    return parsed;
  } catch {
    return {
      engagement_id: engagementId,
      status: result.is_error ? "error" : "active",
      current_phase: "unknown",
    };
  }
}

export async function listEngagementsViaFerry(): Promise<{
  engagements: Array<{ engagement_id: string; status: string; current_phase: string }>;
}> {
  return { engagements: [] };
}

export async function advanceEngagementViaFerry(
  engagementId: string,
): Promise<{ engagement_id: string; current_phase: string; status: string }> {
  log.info(`[ferry] advancing engagement ${engagementId}`);

  const result = await ferryClient.submitTask({
    task_id: `${engagementId}-advance-${Date.now()}`,
    tool_name: "offense/orchestration/engagement-pipeline",
    json_arguments: JSON.stringify({
      action: "advance",
      engagement_id: engagementId,
    }),
    session_id: engagementId,
  });

  try {
    const parsed = JSON.parse(result.output);
    return parsed;
  } catch {
    return {
      engagement_id: engagementId,
      current_phase: result.is_error ? "error" : "advanced",
      status: result.is_error ? "failed" : "active",
    };
  }
}

export async function approveExploitationViaFerry(req: {
  engagement_id: string;
  approved: boolean;
  notes?: string;
}): Promise<{ engagement_id: string; approved: boolean; status: string }> {
  log.info(`[ferry] approval for ${req.engagement_id}: ${req.approved}`);

  const result = await ferryClient.submitTask({
    task_id: `${req.engagement_id}-approve-${Date.now()}`,
    tool_name: "offense/orchestration/engagement-pipeline",
    json_arguments: JSON.stringify({
      action: "approve",
      engagement_id: req.engagement_id,
      approved: req.approved,
      notes: req.notes,
    }),
    session_id: req.engagement_id,
  });

  return {
    engagement_id: req.engagement_id,
    approved: req.approved,
    status: result.is_error ? "error" : "approved",
  };
}

export async function executeToolViaFerry(req: {
  agent_role: string;
  tool_name: string;
  params: Record<string, string>;
  timeout?: number;
}): Promise<{ success: boolean; output: string; duration_ms: number }> {
  const result = await harnessToolExecutor.executeViaHarness(
    req.tool_name,
    req.params,
  );
  return {
    success: result.success,
    output: result.output,
    duration_ms: result.executionTimeMs,
  };
}
