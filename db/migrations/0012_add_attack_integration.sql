-- Migration: MITRE ATT&CK Integration
-- Description: Adds tables and schema for MITRE ATT&CK framework integration
-- Date: 2025-12-21

-- Create attack schema for ATT&CK-specific data
CREATE SCHEMA IF NOT EXISTS attack;

-- Enum for ATT&CK object types
CREATE TYPE attack_object_type AS ENUM (
  'technique',
  'tactic',
  'group',
  'software',
  'mitigation',
  'data-source',
  'campaign'
);

-- Enum for ATT&CK platforms
CREATE TYPE attack_platform AS ENUM (
  'Windows',
  'macOS',
  'Linux',
  'Cloud',
  'Network',
  'Containers',
  'IaaS',
  'SaaS',
  'Office 365',
  'Azure AD',
  'Google Workspace',
  'PRE'
);

-- ATT&CK Tactics (TA####)
CREATE TABLE IF NOT EXISTS attack_tactics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  short_name TEXT,
  x_mitre_shortname TEXT,
  stix_id TEXT UNIQUE,
  created TIMESTAMP,
  modified TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ATT&CK Techniques and Sub-Techniques (T####, T####.###)
CREATE TABLE IF NOT EXISTS attack_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_subtechnique BOOLEAN DEFAULT false,
  parent_technique_id UUID REFERENCES attack_techniques(id) ON DELETE SET NULL,
  stix_id TEXT UNIQUE,
  kill_chain_phases TEXT[],
  platforms attack_platform[],
  permissions_required TEXT[],
  effective_permissions TEXT[],
  defense_bypassed TEXT[],
  data_sources TEXT[],
  detection TEXT,
  version TEXT,
  created TIMESTAMP,
  modified TIMESTAMP,
  deprecated BOOLEAN DEFAULT false,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  external_references JSONB DEFAULT '[]'::jsonb,
  x_mitre_version TEXT,
  x_mitre_detection TEXT,
  x_mitre_data_sources TEXT[],
  x_mitre_contributors TEXT[],
  x_mitre_platforms TEXT[],
  x_mitre_is_subtechnique BOOLEAN DEFAULT false,
  x_mitre_impact_type TEXT[]
);

-- ATT&CK Groups (G####)
CREATE TABLE IF NOT EXISTS attack_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  aliases TEXT[],
  stix_id TEXT UNIQUE,
  version TEXT,
  created TIMESTAMP,
  modified TIMESTAMP,
  deprecated BOOLEAN DEFAULT false,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  external_references JSONB DEFAULT '[]'::jsonb,
  x_mitre_version TEXT,
  x_mitre_contributors TEXT[]
);

-- ATT&CK Software (S####)
CREATE TABLE IF NOT EXISTS attack_software (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  software_type TEXT,
  aliases TEXT[],
  platforms attack_platform[],
  stix_id TEXT UNIQUE,
  version TEXT,
  created TIMESTAMP,
  modified TIMESTAMP,
  deprecated BOOLEAN DEFAULT false,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  external_references JSONB DEFAULT '[]'::jsonb,
  x_mitre_version TEXT,
  x_mitre_contributors TEXT[],
  x_mitre_platforms TEXT[]
);

-- ATT&CK Mitigations (M####)
CREATE TABLE IF NOT EXISTS attack_mitigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  stix_id TEXT UNIQUE,
  version TEXT,
  created TIMESTAMP,
  modified TIMESTAMP,
  deprecated BOOLEAN DEFAULT false,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  external_references JSONB DEFAULT '[]'::jsonb,
  x_mitre_version TEXT
);

-- ATT&CK Data Sources (DS####)
CREATE TABLE IF NOT EXISTS attack_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  stix_id TEXT UNIQUE,
  platforms attack_platform[],
  collection_layers TEXT[],
  data_components JSONB DEFAULT '[]'::jsonb,
  version TEXT,
  created TIMESTAMP,
  modified TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  external_references JSONB DEFAULT '[]'::jsonb,
  x_mitre_version TEXT
);

-- ATT&CK Campaigns (C####)
CREATE TABLE IF NOT EXISTS attack_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attack_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  aliases TEXT[],
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  stix_id TEXT UNIQUE,
  version TEXT,
  created TIMESTAMP,
  modified TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  external_references JSONB DEFAULT '[]'::jsonb,
  x_mitre_version TEXT,
  x_mitre_first_seen_citation TEXT,
  x_mitre_last_seen_citation TEXT
);

-- ATT&CK Relationships (connects all objects)
CREATE TABLE IF NOT EXISTS attack_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stix_id TEXT UNIQUE,
  relationship_type TEXT NOT NULL,
  source_type attack_object_type NOT NULL,
  source_ref TEXT NOT NULL,
  target_type attack_object_type NOT NULL,
  target_ref TEXT NOT NULL,
  description TEXT,
  created TIMESTAMP,
  modified TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Operation to ATT&CK Technique mapping (red team coverage)
CREATE TABLE IF NOT EXISTS operation_attack_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  technique_id UUID NOT NULL REFERENCES attack_techniques(id) ON DELETE CASCADE,
  tactic_id UUID REFERENCES attack_tactics(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'planned',
  coverage_percentage INTEGER DEFAULT 0,
  evidence_text TEXT,
  notes TEXT,
  executed_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(operation_id, technique_id)
);

-- Technique to Tactic mapping (many-to-many)
CREATE TABLE IF NOT EXISTS attack_technique_tactics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technique_id UUID NOT NULL REFERENCES attack_techniques(id) ON DELETE CASCADE,
  tactic_id UUID NOT NULL REFERENCES attack_tactics(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(technique_id, tactic_id)
);

-- Indexes for performance
CREATE INDEX idx_attack_techniques_attack_id ON attack_techniques(attack_id);
CREATE INDEX idx_attack_techniques_parent ON attack_techniques(parent_technique_id);
CREATE INDEX idx_attack_techniques_subtechnique ON attack_techniques(is_subtechnique);
CREATE INDEX idx_attack_techniques_deprecated ON attack_techniques(deprecated);
CREATE INDEX idx_attack_techniques_stix_id ON attack_techniques(stix_id);

CREATE INDEX idx_attack_tactics_attack_id ON attack_tactics(attack_id);
CREATE INDEX idx_attack_tactics_stix_id ON attack_tactics(stix_id);

CREATE INDEX idx_attack_groups_attack_id ON attack_groups(attack_id);
CREATE INDEX idx_attack_groups_stix_id ON attack_groups(stix_id);
CREATE INDEX idx_attack_groups_deprecated ON attack_groups(deprecated);

CREATE INDEX idx_attack_software_attack_id ON attack_software(attack_id);
CREATE INDEX idx_attack_software_stix_id ON attack_software(stix_id);
CREATE INDEX idx_attack_software_type ON attack_software(software_type);

CREATE INDEX idx_attack_mitigations_attack_id ON attack_mitigations(attack_id);
CREATE INDEX idx_attack_mitigations_stix_id ON attack_mitigations(stix_id);

CREATE INDEX idx_attack_data_sources_attack_id ON attack_data_sources(attack_id);
CREATE INDEX idx_attack_data_sources_stix_id ON attack_data_sources(stix_id);

CREATE INDEX idx_attack_campaigns_attack_id ON attack_campaigns(attack_id);
CREATE INDEX idx_attack_campaigns_stix_id ON attack_campaigns(stix_id);

CREATE INDEX idx_attack_relationships_source ON attack_relationships(source_ref);
CREATE INDEX idx_attack_relationships_target ON attack_relationships(target_ref);
CREATE INDEX idx_attack_relationships_type ON attack_relationships(relationship_type);

CREATE INDEX idx_operation_attack_mapping_operation ON operation_attack_mapping(operation_id);
CREATE INDEX idx_operation_attack_mapping_technique ON operation_attack_mapping(technique_id);
CREATE INDEX idx_operation_attack_mapping_status ON operation_attack_mapping(status);

CREATE INDEX idx_attack_technique_tactics_technique ON attack_technique_tactics(technique_id);
CREATE INDEX idx_attack_technique_tactics_tactic ON attack_technique_tactics(tactic_id);

-- Comments
COMMENT ON SCHEMA attack IS 'MITRE ATT&CK framework integration';
COMMENT ON TABLE attack_techniques IS 'ATT&CK techniques and sub-techniques';
COMMENT ON TABLE attack_tactics IS 'ATT&CK tactics (initial access, execution, etc.)';
COMMENT ON TABLE attack_groups IS 'Threat actor groups tracked by ATT&CK';
COMMENT ON TABLE attack_software IS 'Malware and tools tracked by ATT&CK';
COMMENT ON TABLE attack_mitigations IS 'Security mitigations mapped to techniques';
COMMENT ON TABLE attack_data_sources IS 'Data sources for detecting techniques';
COMMENT ON TABLE attack_campaigns IS 'Threat campaigns tracked by ATT&CK';
COMMENT ON TABLE attack_relationships IS 'Relationships between ATT&CK objects';
COMMENT ON TABLE operation_attack_mapping IS 'Red team operation to ATT&CK technique mapping';
COMMENT ON TABLE attack_technique_tactics IS 'Many-to-many mapping of techniques to tactics';
