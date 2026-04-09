/**
 * LangGraph Orchestrator Types — v2.5
 *
 * Type definitions for the LangGraph-based pentest workflow orchestrator.
 * Mirrors the Python state/graph definitions in services/orchestrator/.
 */

// ---------------------------------------------------------------------------
// Engagement Lifecycle
// ---------------------------------------------------------------------------

export type EngagementPhase =
  | "planning"
  | "recon"
  | "vuln_assessment"
  | "exploitation"
  | "post_exploitation"
  | "reverse_engineering"
  | "reporting"
  | "complete"
  | "error";

export interface StartEngagementRequest {
  engagement_id?: string;
  targets: string[];
  scope_constraints?: string[];
}

export interface StartEngagementResponse {
  engagement_id: string;
  session_id: string;
  status: string;
  targets: string[];
}

export interface EngagementStatus {
  engagement_id: string;
  phase: EngagementPhase;
  approval_needed: boolean;
  finding_count: number;
  messages: EngagementMessage[];
}

export interface EngagementSummary {
  engagement_id: string;
  phase: EngagementPhase;
  target_count: number;
  finding_count: number;
  started_at: string;
}

export interface EngagementListResponse {
  engagements: EngagementSummary[];
}

// ---------------------------------------------------------------------------
// Human-in-the-Loop
// ---------------------------------------------------------------------------

export interface ApprovalRequest {
  engagement_id: string;
  approved: boolean;
  notes?: string;
}

export interface ApprovalResponse {
  engagement_id: string;
  approved: boolean;
  next_phase: EngagementPhase;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface EngagementMessage {
  role: "system" | "assistant" | "operator";
  content: string;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Findings (mirrors Python Finding TypedDict)
// ---------------------------------------------------------------------------

export interface EngagementFinding {
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: "verified" | "high" | "medium" | "uncertain";
  domain: string;
  technique?: string;
  cvss?: number;
  status: string;
  target_host?: string;
  target_port?: string;
  cve_id?: string;
  cwe_id?: string;
  agent: string;
  evidence?: string;
}
