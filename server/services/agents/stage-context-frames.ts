export interface StageContextFrame {
  stageName: string;
  roleDescription: string;
  visibleData: string[];
  hiddenData: string[];
  successCriteria: string[];
  antiPatterns: string[];
}

export const STAGE_FRAMES: Record<string, StageContextFrame> = {
  scope: {
    stageName: "scope",
    roleDescription:
      "Parse and structure the engagement scope. Identify in-scope targets, excluded areas, and rules of engagement.",
    visibleData: ["operation.scope", "operation.name", "program_metadata", "target_list"],
    hiddenData: ["findings", "tool_output", "exploit_results", "prior_agent_reasoning"],
    successCriteria: [
      "Structured scope document produced",
      "All targets identified",
      "Exclusions documented",
    ],
    antiPatterns: [
      "Running tools",
      "Making assumptions about vulnerabilities",
      "Skipping scope items",
    ],
  },

  recon: {
    stageName: "recon",
    roleDescription:
      "Map the external attack surface. Enumerate subdomains, discover services, identify technologies.",
    visibleData: ["scope_document", "target_urls", "target_ips", "tool_catalog"],
    hiddenData: ["prior_vulnerabilities", "exploitation_results", "other_agent_findings"],
    successCriteria: [
      "Subdomains enumerated",
      "Services discovered",
      "Technologies identified",
      "Attack surface map produced",
    ],
    antiPatterns: [
      "Attempting exploitation",
      "Ignoring scope boundaries",
      "Skipping passive recon",
    ],
  },

  hunt: {
    stageName: "hunt",
    roleDescription:
      "Systematically discover vulnerabilities within the mapped attack surface.",
    visibleData: [
      "attack_surface_map",
      "scope_rules",
      "tool_catalog",
      "discovered_findings",
      "recon_results",
    ],
    hiddenData: ["validation_results", "report_drafts", "other_hunter_reasoning"],
    successCriteria: [
      "Vulnerability classes tested",
      "Findings documented with evidence",
      "Tool chains executed",
    ],
    antiPatterns: [
      "Declaring done after one tool",
      "Ignoring tool errors",
      "Testing out of scope",
    ],
  },

  validate: {
    stageName: "validate",
    roleDescription:
      "Independently verify a single finding. Your job is to find reasons it is WRONG, not to confirm it.",
    visibleData: ["single_finding", "finding_evidence", "scope_rules"],
    hiddenData: [
      "hunt_reasoning",
      "other_findings",
      "tool_chain_history",
      "hunter_confidence",
      "attack_surface_map",
    ],
    successCriteria: [
      "Finding verified or rejected with evidence",
      "Severity confirmed or adjusted",
      "Reproducibility assessed",
    ],
    antiPatterns: [
      "Confirming without checking",
      "Running new discovery scans",
      "Accessing hunt agent reasoning",
    ],
  },

  capture: {
    stageName: "capture",
    roleDescription:
      "Document validated findings with proof-of-concept evidence suitable for reporting.",
    visibleData: ["validated_findings", "poc_artifacts", "scope_rules"],
    hiddenData: ["hunt_reasoning", "validation_reasoning", "rejected_findings"],
    successCriteria: [
      "PoC documented",
      "Steps to reproduce listed",
      "Impact described",
      "Remediation suggested",
    ],
    antiPatterns: [
      "Re-hunting for new findings",
      "Including unvalidated findings",
      "Exposing raw tool output without sanitization",
    ],
  },

  report: {
    stageName: "report",
    roleDescription:
      "Generate the final penetration test report from validated, captured findings.",
    visibleData: [
      "captured_findings",
      "operation_metadata",
      "report_template",
      "executive_context",
    ],
    hiddenData: [
      "internal_reasoning",
      "failed_attempts",
      "rejected_findings",
      "raw_tool_output",
      "agent_conversations",
    ],
    successCriteria: [
      "All findings included",
      "Executive summary written",
      "Remediation prioritized",
      "Report follows template",
    ],
    antiPatterns: [
      "Including internal agent dialogue",
      "Referencing tool names without context",
      "Omitting severity justification",
    ],
  },
};
