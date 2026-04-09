/**
 * LangGraph Orchestrator Client — v2.5
 *
 * TypeScript HTTP client for the LangGraph orchestrator Python service.
 * Provides typed wrappers for engagement management and workflow control.
 */

import type {
  StartEngagementRequest,
  StartEngagementResponse,
  EngagementStatus,
  EngagementListResponse,
  ApprovalRequest,
  ApprovalResponse,
} from "../../shared/types/langgraph-types";
import type {
  SkillSearchRequest,
  SkillSearchResponse,
  SkillContentResponse,
} from "../../shared/types/skill-types";
import type {
  ToolExecRequest,
  ToolExecResponse,
  BatchToolExecRequest,
  BatchToolExecResponse,
  ToolRegistryResponse,
  ContainerHealthResponse,
  AgentContainerHealthResponse,
  AgentRole,
} from "../../shared/types/tool-container-types";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://localhost:8080";

async function orchestratorFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${ORCHESTRATOR_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Orchestrator API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function checkOrchestratorHealth(): Promise<{
  status: string;
  workflow_compiled: boolean;
  version: string;
}> {
  return orchestratorFetch("/health");
}

// ---------------------------------------------------------------------------
// Engagement Management
// ---------------------------------------------------------------------------

export async function startEngagement(
  req: StartEngagementRequest,
): Promise<StartEngagementResponse> {
  return orchestratorFetch<StartEngagementResponse>("/engagements/start", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getEngagementStatus(engagementId: string): Promise<EngagementStatus> {
  return orchestratorFetch<EngagementStatus>(
    `/engagements/${encodeURIComponent(engagementId)}`,
  );
}

export async function listEngagements(): Promise<EngagementListResponse> {
  return orchestratorFetch<EngagementListResponse>("/engagements");
}

export async function advanceEngagement(
  engagementId: string,
): Promise<{ engagement_id: string; current_phase: string; status: string }> {
  return orchestratorFetch(`/engagements/${encodeURIComponent(engagementId)}/advance`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Human-in-the-Loop
// ---------------------------------------------------------------------------

export async function approveExploitation(req: ApprovalRequest): Promise<ApprovalResponse> {
  return orchestratorFetch<ApprovalResponse>(
    `/engagements/${encodeURIComponent(req.engagement_id)}/approve`,
    {
      method: "POST",
      body: JSON.stringify(req),
    },
  );
}

// ---------------------------------------------------------------------------
// Skill Discovery
// ---------------------------------------------------------------------------

export async function searchSkills(req: SkillSearchRequest): Promise<SkillSearchResponse> {
  return orchestratorFetch<SkillSearchResponse>("/skills/search", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getSkillContent(skillName: string): Promise<SkillContentResponse> {
  return orchestratorFetch<SkillContentResponse>(
    `/skills/${encodeURIComponent(skillName)}`,
  );
}

// ---------------------------------------------------------------------------
// Tool Execution
// ---------------------------------------------------------------------------

export async function executeTool(req: ToolExecRequest): Promise<ToolExecResponse> {
  return orchestratorFetch<ToolExecResponse>("/tools/execute", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function executeToolsBatch(
  req: BatchToolExecRequest,
): Promise<BatchToolExecResponse> {
  return orchestratorFetch<BatchToolExecResponse>("/tools/execute-batch", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getToolRegistry(): Promise<ToolRegistryResponse> {
  return orchestratorFetch<ToolRegistryResponse>("/tools/registry");
}

export async function checkAllContainerHealth(): Promise<ContainerHealthResponse> {
  return orchestratorFetch<ContainerHealthResponse>("/tools/containers/health");
}

export async function checkAgentContainerHealth(
  agentRole: AgentRole,
): Promise<AgentContainerHealthResponse> {
  return orchestratorFetch<AgentContainerHealthResponse>(
    `/tools/containers/${encodeURIComponent(agentRole)}/health`,
  );
}
