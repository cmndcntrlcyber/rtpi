/**
 * mem0 Memory Service Types — v2.5
 *
 * Type definitions for the mem0-backed persistent memory system.
 * Used by both the Express backend (TypeScript client) and frontend.
 */

// ---------------------------------------------------------------------------
// Memory Metadata
// ---------------------------------------------------------------------------

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingConfidence = "verified" | "high" | "medium" | "uncertain";
export type FindingStatus = "open" | "exploited" | "remediated" | "false-positive";

export interface FindingMetadata {
  severity: FindingSeverity;
  confidence: FindingConfidence;
  domain: string;                 // web, network, ad, cloud, re, etc.
  technique?: string;             // MITRE ATT&CK ID (T####)
  cvss?: number;
  status: FindingStatus;
  target_host?: string;
  target_port?: string;
  cve_id?: string;
  cwe_id?: string;
}

// ---------------------------------------------------------------------------
// API Request Types
// ---------------------------------------------------------------------------

export interface Mem0AddRequest {
  content: string;
  engagement_id: string;
  agent_id?: string;
  session_id?: string;
  metadata?: FindingMetadata;
}

export interface Mem0SearchRequest {
  query: string;
  engagement_id: string;
  agent_id?: string;
  filters?: Mem0Filters;
  limit?: number;
}

export interface Mem0DeleteRequest {
  engagement_id: string;
}

export interface Mem0Filters {
  AND?: Mem0FilterCondition[];
  OR?: Mem0FilterCondition[];
}

export interface Mem0FilterCondition {
  [field: string]: {
    eq?: string | number;
    ne?: string | number;
    in?: (string | number)[];
    gt?: number;
    lt?: number;
  };
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

export interface Mem0HealthResponse {
  status: "healthy" | "unhealthy";
  mem0_initialized: boolean;
  version: string;
}

export interface Mem0AddResponse {
  success: boolean;
  memory_id?: string;
  result?: unknown;
}

export interface Mem0SearchResponse {
  results: Mem0Memory[];
  query: string;
  engagement_id: string;
}

export interface Mem0GetAllResponse {
  memories: Mem0Memory[];
  engagement_id: string;
  agent_id?: string;
}

export interface Mem0StatsResponse {
  total_memories: number;
  engagement_id?: string;
}

export interface Mem0Memory {
  id: string;
  memory: string;
  metadata?: Record<string, unknown>;
  score?: number;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Attack Path Types
// ---------------------------------------------------------------------------

export interface AttackPathQuery {
  engagement_id: string;
  source?: string;
  destination?: string;
}

export interface AttackPathResponse {
  paths: Mem0Memory[];
  engagement_id: string;
  source?: string;
  destination?: string;
}
