/**
 * mem0 API Client — v2.5
 *
 * TypeScript HTTP client for the mem0 Python service.
 * Provides typed wrappers for all mem0 REST endpoints.
 * Used by the Express backend to proxy mem0 operations.
 */

import type {
  Mem0AddRequest,
  Mem0AddResponse,
  Mem0SearchRequest,
  Mem0SearchResponse,
  Mem0GetAllResponse,
  Mem0HealthResponse,
  Mem0StatsResponse,
  Mem0Memory,
  AttackPathQuery,
  AttackPathResponse,
  FindingMetadata,
} from "../../shared/types/mem0-types";

const MEM0_API_URL = process.env.MEM0_API_URL || "http://localhost:8000";

async function mem0Fetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${MEM0_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`mem0 API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Health & Stats
// ---------------------------------------------------------------------------

export async function checkMem0Health(): Promise<Mem0HealthResponse> {
  return mem0Fetch<Mem0HealthResponse>("/health");
}

export async function getMem0Stats(engagementId?: string): Promise<Mem0StatsResponse> {
  const params = engagementId ? `?engagement_id=${encodeURIComponent(engagementId)}` : "";
  return mem0Fetch<Mem0StatsResponse>(`/stats${params}`);
}

// ---------------------------------------------------------------------------
// Memory CRUD
// ---------------------------------------------------------------------------

export async function addMemory(req: Mem0AddRequest): Promise<Mem0AddResponse> {
  return mem0Fetch<Mem0AddResponse>("/memory/add", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function searchMemory(req: Mem0SearchRequest): Promise<Mem0SearchResponse> {
  return mem0Fetch<Mem0SearchResponse>("/memory/search", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getAllMemories(
  engagementId: string,
  agentId?: string,
): Promise<Mem0GetAllResponse> {
  const params = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : "";
  return mem0Fetch<Mem0GetAllResponse>(`/memory/all/${encodeURIComponent(engagementId)}${params}`);
}

export async function deleteMemory(memoryId: string): Promise<{ success: boolean }> {
  return mem0Fetch<{ success: boolean }>(`/memory/${encodeURIComponent(memoryId)}`, {
    method: "DELETE",
  });
}

export async function deleteEngagementMemories(
  engagementId: string,
): Promise<{ success: boolean }> {
  return mem0Fetch<{ success: boolean }>("/memory/delete-engagement", {
    method: "POST",
    body: JSON.stringify({ engagement_id: engagementId }),
  });
}

// ---------------------------------------------------------------------------
// Graph Queries
// ---------------------------------------------------------------------------

export async function getAttackPaths(query: AttackPathQuery): Promise<AttackPathResponse> {
  const params = new URLSearchParams({
    engagement_id: query.engagement_id,
  });
  if (query.source) params.set("source", query.source);
  if (query.destination) params.set("destination", query.destination);

  return mem0Fetch<AttackPathResponse>(`/memory/attack-paths?${params}`);
}

export async function getCriticalVulns(
  engagementId: string,
): Promise<{ vulnerabilities: Mem0Memory[] }> {
  return mem0Fetch<{ vulnerabilities: Mem0Memory[] }>(
    `/memory/critical-vulns?engagement_id=${encodeURIComponent(engagementId)}`,
    { method: "POST" },
  );
}

// ---------------------------------------------------------------------------
// Convenience: Store a finding with full metadata
// ---------------------------------------------------------------------------

export async function storeFinding(
  engagementId: string,
  agentId: string,
  sessionId: string,
  description: string,
  metadata: FindingMetadata,
): Promise<Mem0AddResponse> {
  return addMemory({
    content: description,
    engagement_id: engagementId,
    agent_id: agentId,
    session_id: sessionId,
    metadata,
  });
}
