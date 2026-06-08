-- Seed the seven bug-hunter phase agents (FF_BUG_HUNTER).
--
-- Each row is gated by WHERE NOT EXISTS (agents.name has no UNIQUE
-- constraint, so plain ON CONFLICT is unreliable here — same pattern as
-- migration 0046). config.ai.provider = "auto" means the inference
-- router picks the operator's Settings default at call time (Ollama by
-- default: qwen3:14b reasoning / qwen2.5-coder:14b agent / qwen3-
-- embedding:4b embedding). No model strings are pinned here.
--
-- These rows are inserted unconditionally so the agents are present in
-- the DB even when FF_BUG_HUNTER is off. The route mount and workflow
-- creation paths are flag-gated in server/index.ts and workflow-event-
-- handlers.ts, so dormant rows do no harm.

BEGIN;

-- Bug Hunter — Scope (phase 1)
INSERT INTO agents (name, type, status, config, capabilities)
SELECT 'Bug Hunter — Scope', 'custom', 'idle', '{
  "category": "Bug Hunter",
  "agentRole": "bug_hunter_scope",
  "ai": { "provider": "auto" },
  "systemPrompt": "You parse bug-bounty program scope into structured rules. Never invent domains. Capture in-scope, out-of-scope, accepted-impact lists, and mode (red-team vs WAPT).",
  "phase": 1
}'::jsonb, '["scope_parsing","program_metadata","mode_dispatch"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Bug Hunter — Scope');

-- Bug Hunter — Recon (phase 2)
INSERT INTO agents (name, type, status, config, capabilities)
SELECT 'Bug Hunter — Recon', 'custom', 'idle', '{
  "category": "Bug Hunter",
  "agentRole": "bug_hunter_recon",
  "ai": { "provider": "auto" },
  "systemPrompt": "You drive subdomain enumeration, URL crawling, technology detection, and surface inventory. Delegate to BBOT via surface-assessment-agent. Frame outputs for bug-hunter consumption.",
  "phase": 2
}'::jsonb, '["subdomain_enum","tech_detect","url_crawl","surface_inventory"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Bug Hunter — Recon');

-- Bug Hunter — Hunt (phase 3)
INSERT INTO agents (name, type, status, config, capabilities)
SELECT 'Bug Hunter — Hunt', 'custom', 'idle', '{
  "category": "Bug Hunter",
  "agentRole": "bug_hunter_hunt",
  "ai": { "provider": "auto" },
  "systemPrompt": "You actively test for vulnerabilities. Each iteration the bug-hunter pre-prompt hook injects relevant skill chunks from the knowledge_base (e.g. hunt-jwt loads when JWT endpoints surface). Aim for findings that pass the 7-Question Gate.",
  "phase": 3
}'::jsonb, '["active_testing","vuln_class_dispatch","rag_skill_retrieval","tool_orchestration"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Bug Hunter — Hunt');

-- Bug Hunter — Chain (phase 3.5)
INSERT INTO agents (name, type, status, config, capabilities)
SELECT 'Bug Hunter — Chain', 'custom', 'idle', '{
  "category": "Bug Hunter",
  "agentRole": "bug_hunter_chain",
  "ai": { "provider": "auto" },
  "systemPrompt": "You propose A→B (or A→B→C) escalation chains across accumulated findings. Use the bug-bounty chain skill and triage-validation conditionally-valid table for patterns.",
  "phase": 3.5
}'::jsonb, '["chain_construction","escalation_reasoning","severity_uplift"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Bug Hunter — Chain');

-- Bug Hunter — Validate (phase 4)
INSERT INTO agents (name, type, status, config, capabilities)
SELECT 'Bug Hunter — Validate', 'custom', 'idle', '{
  "category": "Bug Hunter",
  "agentRole": "bug_hunter_validate",
  "ai": { "provider": "auto" },
  "systemPrompt": "You enforce the 7-Question Gate. Q3 (in-scope) and Q7 (always-rejected list) run programmatically; Q1/Q2/Q4/Q5/Q6 run via reasoning model with the triage-validation playbook in context.",
  "phase": 4
}'::jsonb, '["seven_question_gate","in_scope_check","never_submit_check","chain_required_check"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Bug Hunter — Validate');

-- Bug Hunter — Capture (phase 5)
INSERT INTO agents (name, type, status, config, capabilities)
SELECT 'Bug Hunter — Capture', 'custom', 'idle', '{
  "category": "Bug Hunter",
  "agentRole": "bug_hunter_capture",
  "ai": { "provider": "auto" },
  "systemPrompt": "You run evidence-hygiene checks: cookie/auth-header redaction, PII black-bar, HAR sanitization, internal-IP scrubbing. Annotate findings with hygiene flags so the report agent either auto-redacts or refuses to write.",
  "phase": 5
}'::jsonb, '["evidence_hygiene","pii_scan","session_redaction","har_sanitization"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Bug Hunter — Capture');

-- Bug Hunter — Report (phase 6)
INSERT INTO agents (name, type, status, config, capabilities)
SELECT 'Bug Hunter — Report', 'custom', 'idle', '{
  "category": "Bug Hunter",
  "agentRole": "bug_hunter_report",
  "ai": { "provider": "auto" },
  "systemPrompt": "You write platform-appropriate bug-bounty / red-team reports. Pull the right template skill for the platform (bugcrowd-reporting, report-writing, redteam-report-template). Never include unredacted credentials.",
  "phase": 6
}'::jsonb, '["report_generation","platform_templates","vrt_mapping","evidence_synthesis"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Bug Hunter — Report');

COMMIT;
