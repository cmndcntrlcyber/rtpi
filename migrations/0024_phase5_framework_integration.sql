-- Phase 5: Framework Integration Migration
-- Implements MITRE ATLAS, OWASP LLM Top 10, and NIST AI RMF frameworks

-- ============================================================================
-- MITRE ATLAS (Adversarial Threat Landscape for AI Systems)
-- ============================================================================

-- ATLAS Tactics (AI/ML kill chain phases)
CREATE TABLE atlas_tactics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atlas_id TEXT UNIQUE NOT NULL,  -- e.g., 'AML.TA0001'
  name TEXT NOT NULL,
  description TEXT,
  short_name TEXT,
  sort_order INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ATLAS Techniques (adversarial ML techniques)
CREATE TABLE atlas_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atlas_id TEXT UNIQUE NOT NULL,  -- e.g., 'AML.T0001'
  name TEXT NOT NULL,
  description TEXT,
  tactic_id UUID REFERENCES atlas_tactics(id) ON DELETE SET NULL,

  -- Technique details
  case_studies TEXT[],
  detection_methods TEXT[],
  mitigation_strategies TEXT[],

  -- Metadata
  is_subtechnique BOOLEAN DEFAULT false,
  parent_technique_id UUID REFERENCES atlas_techniques(id) ON DELETE SET NULL,
  platforms TEXT[],  -- ['ML Service', 'Model', 'Training Data']

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ATLAS Case Studies
CREATE TABLE atlas_case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technique_id UUID NOT NULL REFERENCES atlas_techniques(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_system TEXT,
  impact TEXT,
  references TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for ATLAS
CREATE INDEX idx_atlas_techniques_tactic ON atlas_techniques(tactic_id);
CREATE INDEX idx_atlas_techniques_parent ON atlas_techniques(parent_technique_id);
CREATE INDEX idx_atlas_case_studies_technique ON atlas_case_studies(technique_id);

-- ============================================================================
-- OWASP LLM Top 10
-- ============================================================================

-- OWASP LLM Vulnerabilities (the Top 10)
CREATE TABLE owasp_llm_vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owasp_id TEXT UNIQUE NOT NULL,  -- 'LLM01', 'LLM02', etc.
  name TEXT NOT NULL,              -- 'Prompt Injection', 'Insecure Output Handling'
  description TEXT,
  risk_rating TEXT,                -- 'Critical', 'High', 'Medium', 'Low'

  -- Vulnerability details
  common_examples TEXT[],
  prevention_strategies TEXT[],
  example_attack_scenarios TEXT[],

  -- References
  references TEXT[],
  cwe_mappings TEXT[],             -- Related CWE IDs

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- OWASP LLM Attack Vectors
CREATE TABLE owasp_llm_attack_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vulnerability_id UUID NOT NULL REFERENCES owasp_llm_vulnerabilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  attack_complexity TEXT,          -- 'Low', 'Medium', 'High'
  prerequisites TEXT[],
  payload_examples TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- OWASP LLM Mitigations
CREATE TABLE owasp_llm_mitigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vulnerability_id UUID NOT NULL REFERENCES owasp_llm_vulnerabilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  implementation_guidance TEXT,
  effectiveness TEXT,              -- 'High', 'Medium', 'Low'
  cost TEXT,                       -- 'High', 'Medium', 'Low'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for OWASP LLM
CREATE INDEX idx_owasp_attack_vectors_vuln ON owasp_llm_attack_vectors(vulnerability_id);
CREATE INDEX idx_owasp_mitigations_vuln ON owasp_llm_mitigations(vulnerability_id);

-- ============================================================================
-- NIST AI RMF (AI Risk Management Framework)
-- ============================================================================

-- NIST AI RMF Functions (Govern, Map, Measure, Manage)
CREATE TABLE nist_ai_functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id TEXT UNIQUE NOT NULL,  -- 'GOVERN', 'MAP', 'MEASURE', 'MANAGE'
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- NIST AI RMF Categories
CREATE TABLE nist_ai_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT UNIQUE NOT NULL,  -- 'GOVERN-1', 'MAP-1', etc.
  function_id UUID NOT NULL REFERENCES nist_ai_functions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- NIST AI RMF Subcategories (actionable outcomes)
CREATE TABLE nist_ai_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id TEXT UNIQUE NOT NULL,  -- 'GOVERN-1.1', 'MAP-1.1', etc.
  category_id UUID NOT NULL REFERENCES nist_ai_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER,

  -- Implementation guidance
  implementation_examples TEXT[],
  informative_references TEXT[],

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for NIST AI RMF
CREATE INDEX idx_nist_categories_function ON nist_ai_categories(function_id);
CREATE INDEX idx_nist_subcategories_category ON nist_ai_subcategories(category_id);

-- ============================================================================
-- Cross-Framework Mapping
-- ============================================================================

-- Framework Mappings (many-to-many relationships)
CREATE TABLE framework_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source framework entry
  source_framework TEXT NOT NULL,  -- 'ATTACK', 'ATLAS', 'OWASP_LLM', 'NIST_AI'
  source_id TEXT NOT NULL,         -- External ID (e.g., 'T1059', 'AML.T0001', 'LLM01')
  source_table_id UUID NOT NULL,   -- Internal database UUID

  -- Target framework entry
  target_framework TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_table_id UUID NOT NULL,

  -- Relationship
  mapping_type TEXT NOT NULL,      -- 'related', 'equivalent', 'implements', 'mitigates'
  confidence REAL DEFAULT 1.0,     -- 0.0 to 1.0
  description TEXT,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(source_framework, source_table_id, target_framework, target_table_id, mapping_type)
);

CREATE INDEX idx_framework_mappings_source ON framework_mappings(source_framework, source_id);
CREATE INDEX idx_framework_mappings_target ON framework_mappings(target_framework, target_id);

-- ============================================================================
-- Operation-Framework Associations
-- ============================================================================

-- Link operations to framework elements
CREATE TABLE operation_framework_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,

  framework_type TEXT NOT NULL,    -- 'ATTACK', 'ATLAS', 'OWASP_LLM', 'NIST_AI'
  framework_element_id UUID NOT NULL,  -- Points to technique/vuln/subcategory
  framework_element_external_id TEXT NOT NULL,  -- 'T1059', 'AML.T0001', etc.

  -- Coverage details
  coverage_status TEXT NOT NULL,   -- 'planned', 'in_progress', 'tested', 'validated'
  test_results JSONB,
  notes TEXT,

  -- Linking
  linked_vulnerability_id UUID REFERENCES vulnerabilities(id) ON DELETE SET NULL,
  linked_target_id UUID REFERENCES targets(id) ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(operation_id, framework_type, framework_element_id)
);

CREATE INDEX idx_op_framework_operation ON operation_framework_coverage(operation_id);
CREATE INDEX idx_op_framework_type ON operation_framework_coverage(framework_type);
