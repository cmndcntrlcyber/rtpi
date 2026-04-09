/**
 * Skill Discovery Types — v2.5
 *
 * Type definitions for the unified skills library and discovery service.
 */

// ---------------------------------------------------------------------------
// Skill Metadata
// ---------------------------------------------------------------------------

export type SkillSource =
  | "Anthropic-Cybersecurity-Skills"
  | "PayloadsAllTheThings"
  | "ClaudeAdvancedPlugins"
  | "Custom";

export type SkillDomain =
  | "offensive"
  | "reverse-engineering"
  | "cryptography"
  | "cloud-security"
  | "api-security"
  | "development"
  | "threat-modeling"
  | "supply-chain"
  | "devsecops"
  | "code-review"
  | "vulnerability-research"
  | "reporting"
  | "platform"
  | "general";

export interface SkillMetadata {
  name: string;
  description: string;
  domain: SkillDomain;
  tags: string[];
  mitre_techniques: string[];
  path: string;
  source: SkillSource;
}

export interface SkillSearchResult extends SkillMetadata {
  relevance_score: number;
}

// ---------------------------------------------------------------------------
// API Types
// ---------------------------------------------------------------------------

export interface SkillSearchRequest {
  query: string;
  domain?: SkillDomain;
  mitre_technique?: string;
  limit?: number;
}

export interface SkillSearchResponse {
  results: SkillSearchResult[];
  total: number;
}

export interface SkillContentResponse {
  name: string;
  content: string;
}
