-- v2.9.1 Phase 4: Framework→tools/agents bindings
-- Links framework elements (OWASP LLM controls, NIST AI subcategories,
-- CIS safeguards, ATLAS/ATT&CK techniques) to executable assets (tools,
-- agents, workflows). Distinct from framework_mappings (framework↔framework).

DO $$ BEGIN
  CREATE TYPE framework_binding_kind AS ENUM ('tool', 'agent', 'workflow');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE framework_binding_strength AS ENUM ('primary', 'supports', 'validates');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS framework_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- "owasp_llm" | "nist_ai" | "cis_v8" | "atlas" | "attck"
  framework_type TEXT NOT NULL,
  -- External canonical ID (e.g. "LLM01", "GV.OC-01", "1.1")
  framework_element_external_id TEXT NOT NULL,

  binding_kind framework_binding_kind NOT NULL,
  -- FK by convention; not enforced (target table depends on binding_kind).
  target_id UUID NOT NULL,

  strength framework_binding_strength NOT NULL DEFAULT 'supports',
  confidence REAL DEFAULT 1.0,
  rationale TEXT,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS framework_bindings_unique_idx
  ON framework_bindings (framework_type, framework_element_external_id, binding_kind, target_id);

CREATE INDEX IF NOT EXISTS framework_bindings_target_idx
  ON framework_bindings (binding_kind, target_id);
