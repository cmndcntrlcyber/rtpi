/**
 * Tool Container Registry Types — v2.5
 *
 * Type definitions for the agent-to-container mapping and
 * tool execution system.
 */

// ---------------------------------------------------------------------------
// Agent Roles (mirrors Python AgentRole enum)
// ---------------------------------------------------------------------------

export type AgentRole =
  | "recon_agent"
  | "web_vuln_agent"
  | "infra_vuln_agent"
  | "ad_vuln_agent"
  | "cloud_vuln_agent"
  | "exploit_agent"
  | "post_exploit_agent"
  | "social_eng_agent"
  | "re_agent"
  | "code_review_agent"
  | "vuln_research_agent"
  | "llm_security_agent"
  | "reporting_agent";

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  container: string;
  description: string;
  timeout: number;
  parse_format: "text" | "json" | "xml" | "nmap-xml";
}

export interface AgentToolMapping {
  primary_container: string;
  supporting_containers: string[];
  tools: ToolDefinition[];
  skills_domains: string[];
  mitre_tactics: string[];
}

export type ToolRegistryResponse = Record<AgentRole, AgentToolMapping>;

// ---------------------------------------------------------------------------
// Tool Execution
// ---------------------------------------------------------------------------

export interface ToolExecRequest {
  agent_role: AgentRole;
  tool_name: string;
  params: Record<string, string>;
  timeout?: number;
}

export interface ToolExecResponse {
  tool: string;
  container: string;
  command: string;
  exit_code: number;
  success: boolean;
  stdout: string;
  stderr: string;
  parsed_output: unknown;
  duration_seconds: number;
  error: string | null;
}

export interface BatchToolExecRequest {
  agent_role: AgentRole;
  tools: Array<{
    tool_name: string;
    params: Record<string, string>;
  }>;
  max_concurrent?: number;
}

export interface BatchToolExecResponse {
  results: Array<{
    tool: string;
    container: string;
    success: boolean;
    exit_code: number;
    duration_seconds: number;
    error: string | null;
    stdout_preview: string;
    parsed_output: unknown;
  }>;
  total: number;
  succeeded: number;
}

// ---------------------------------------------------------------------------
// Container Health
// ---------------------------------------------------------------------------

export interface ContainerHealthStatus {
  container: string;
  status: string;
  healthy: boolean;
  image?: string;
  error?: string;
}

export interface ContainerHealthResponse {
  containers: ContainerHealthStatus[];
  total: number;
  healthy: number;
}

export interface AgentContainerHealthResponse {
  agent: AgentRole;
  containers: ContainerHealthStatus[];
}
