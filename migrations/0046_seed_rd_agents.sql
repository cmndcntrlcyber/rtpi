-- Seed the seven R&D agents the OffSec Team → R&D Agents tab expects to
-- find. The original seed in db/migrations/0019_add_offsec_rd_team.sql had
-- two issues:
--
--   1. Its INSERT uses `ON CONFLICT DO NOTHING` with no column spec, but
--      `agents.name` has no UNIQUE constraint — so re-runs would have
--      inserted duplicates instead of skipping. We use WHERE NOT EXISTS
--      guards on `name` for proper idempotency.
--
--   2. One seed name ("Empire C2 Manager") doesn't match the UI's
--      `RD_AGENT_NAMES` set in client/src/components/offsec-team/
--      RDAgentsTab.tsx, which expects "C2 Warroom Manager". We seed the UI
--      name; the systemPrompt still references Empire as the underlying C2.
--
-- The `category: "R&D"` field is the secondary filter the UI uses, so even
-- if a name later drifts these rows continue to appear in the tab. `model`
-- is intentionally absent so the inference router (Phase 1 work) picks the
-- operator's Settings default at call time.

BEGIN;

-- Upgrade existing Maldev Agent config to the full R&D shape (it was created
-- by initializeAgentSystem() with a minimal `{"agentRole":"maldev_agent"}`
-- payload and hasn't been refreshed since).
UPDATE agents
   SET config = '{
     "category": "R&D",
     "agentRole": "maldev_agent",
     "systemPrompt": "You are a binary analysis and exploitation R&D specialist. You prioritize Rust-based development and convert other codebases to Rust. You specialize in reverse engineering, ROP chain development, and proof-of-concept creation.",
     "capabilities": ["reverse_engineering", "rop_development", "rust_development", "poc_creation"],
     "repositories": 44,
     "primaryLanguage": "rust",
     "toolCategories": ["reverse_engineering", "rop_development", "poc_development", "rust_development"]
   }'::jsonb,
       updated_at = NOW()
 WHERE name = 'Maldev Agent';

-- Burp Suite Orchestrator
INSERT INTO agents (name, type, status, config)
SELECT 'Burp Suite Orchestrator', 'custom', 'idle', '{
  "category": "R&D",
  "systemPrompt": "You are a Burp Suite orchestration specialist. You automate web application security testing using Burp Suite Professional API.",
  "capabilities": ["web_scanning", "vulnerability_detection", "burp_api"],
  "toolSettings": { "burpApiUrl": "", "burpApiKey": "" }
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Burp Suite Orchestrator');

-- C2 Warroom Manager (UI source-of-truth name; Empire is the underlying C2)
INSERT INTO agents (name, type, status, config)
SELECT 'C2 Warroom Manager', 'custom', 'idle', '{
  "category": "R&D",
  "systemPrompt": "You manage C2 operations across Empire, Adaptix, and the warroom. You coordinate listeners, payloads, and post-exploitation activities.",
  "capabilities": ["c2_management", "payload_generation", "post_exploitation"],
  "toolSettings": { "empireUrl": "", "empireToken": "" }
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'C2 Warroom Manager');

-- Advanced Fuzzing Agent
INSERT INTO agents (name, type, status, config)
SELECT 'Advanced Fuzzing Agent', 'custom', 'idle', '{
  "category": "R&D",
  "systemPrompt": "You are a fuzzing specialist using FFUF and custom wordlists. You discover hidden endpoints and parameters.",
  "capabilities": ["ffuf", "wordlist_management", "parameter_discovery", "fuzzing_templates"]
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Advanced Fuzzing Agent');

-- Framework Security Agent
INSERT INTO agents (name, type, status, config)
SELECT 'Framework Security Agent', 'custom', 'idle', '{
  "category": "R&D",
  "systemPrompt": "You are a framework security analyst. You detect technology stacks and analyze framework-specific vulnerabilities.",
  "capabilities": ["tech_stack_detection", "framework_analysis", "vulnerability_mapping", "advisory_aggregation"]
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Framework Security Agent');

-- Azure-AD Agent
INSERT INTO agents (name, type, status, config)
SELECT 'Azure-AD Agent', 'custom', 'idle', '{
  "category": "R&D",
  "systemPrompt": "You are an Azure and Active Directory attack research specialist. You research EntraID abuse techniques, AD enumeration, privilege escalation, persistence, and lateral movement. You prioritize Rust and C++ development.",
  "capabilities": ["entra_id_abuse", "ad_enumeration", "privilege_escalation", "persistence", "lateral_movement"],
  "repositories": 28,
  "primaryLanguages": ["rust", "cpp"],
  "toolCategories": ["entra_id_abuse", "aad_initial_access", "aad_enumeration", "aad_privesc", "aad_persistence", "aad_lateral_movement"]
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Azure-AD Agent');

-- Research Agent
INSERT INTO agents (name, type, status, config)
SELECT 'Research Agent', 'custom', 'idle', '{
  "category": "R&D",
  "systemPrompt": "You are a general R&D and experimentation agent. You test tools, develop techniques, create proof-of-concepts, and curate the knowledge base.",
  "capabilities": ["tool_testing", "technique_development", "poc_creation", "knowledge_curation"]
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Research Agent');

COMMIT;
