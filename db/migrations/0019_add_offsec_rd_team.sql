-- Migration: 0019_add_offsec_rd_team.sql
-- Description: Add OffSec Team R&D infrastructure (research projects, experiments, knowledge base, tool library)
-- Author: RTPI Development Team
-- Date: 2025-01-15

-- ============================================================================
-- FORWARD MIGRATION
-- ============================================================================

-- Ensure pgvector extension exists for RAG/embedding support
CREATE EXTENSION IF NOT EXISTS vector;

-- Create research_projects table
CREATE TABLE IF NOT EXISTS research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('tool_testing', 'vulnerability_research', 'technique_development', 'knowledge_curation', 'poc_development')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived', 'cancelled')),

  -- Team Assignment
  lead_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  assigned_agents JSONB DEFAULT '[]', -- Array of agent IDs

  -- Project Details
  objectives TEXT,
  success_criteria TEXT,
  findings JSONB DEFAULT '{}',
  artifacts JSONB DEFAULT '[]', -- [{type: 'code|report|poc', name: '', path: '', createdAt: ''}]

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_completion CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed')
  )
);

-- Create rd_experiments table
CREATE TABLE IF NOT EXISTS rd_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Experiment Details
  hypothesis TEXT,
  methodology TEXT,
  tools_used JSONB DEFAULT '[]', -- Array of tool names/IDs
  targets JSONB DEFAULT '[]', -- Test targets (URLs, IPs, etc.)

  -- Results
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'failed', 'cancelled')),
  results JSONB DEFAULT '{}',
  conclusions TEXT,
  success BOOLEAN,

  -- Execution Details
  executed_by_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES agent_workflows(id) ON DELETE SET NULL,
  execution_log TEXT,
  error_message TEXT,

  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_timing CHECK (
    (started_at IS NULL OR started_at >= created_at) AND
    (completed_at IS NULL OR completed_at >= started_at)
  )
);

-- Create knowledge_base table
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,

  -- Classification
  category VARCHAR(100) NOT NULL, -- 'Web Security', 'Network Security', 'Malware Dev', etc.
  tags TEXT[] DEFAULT '{}', -- Array of tags: ['OWASP', 'XSS', 'Burp Suite']

  -- Source & Attribution
  source_url TEXT,
  author TEXT,
  published_date DATE,

  -- Content Type
  content_type VARCHAR(50) DEFAULT 'article' CHECK (content_type IN ('article', 'tutorial', 'paper', 'poc', 'tool_doc', 'technique')),

  -- MITRE ATT&CK Mapping
  attack_tactics TEXT[] DEFAULT '{}', -- ['Initial Access', 'Execution']
  attack_techniques TEXT[] DEFAULT '{}', -- ['T1566', 'T1059']

  -- RAG/Embedding Support
  embedding VECTOR(1536), -- OpenAI text-embedding-ada-002 dimension
  embedding_model VARCHAR(50) DEFAULT 'text-embedding-ada-002',

  -- Metrics
  view_count INTEGER DEFAULT 0,
  usefulness_score DECIMAL(3,2) DEFAULT 0.0, -- 0.0 to 5.0

  -- Relationships
  related_project_id UUID REFERENCES research_projects(id) ON DELETE SET NULL,
  related_articles UUID[] DEFAULT '{}', -- Array of related knowledge_base IDs

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(summary, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'C')
  ) STORED
);

-- Create tool_library table (extends security_tools with R&D metadata)
CREATE TABLE IF NOT EXISTS tool_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_tool_id UUID REFERENCES security_tools(id) ON DELETE CASCADE,

  -- R&D Specific Metadata
  research_value VARCHAR(20) DEFAULT 'medium' CHECK (research_value IN ('low', 'medium', 'high', 'critical')),
  testing_status VARCHAR(20) DEFAULT 'untested' CHECK (testing_status IN ('untested', 'testing', 'validated', 'deprecated')),

  -- Integration
  compatible_agents JSONB DEFAULT '[]', -- Agent IDs that can use this tool
  required_capabilities TEXT[] DEFAULT '{}',

  -- Testing & Validation
  last_tested_at TIMESTAMP,
  test_results JSONB DEFAULT '{}',
  known_issues TEXT[],

  -- Usage Metrics
  execution_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.0, -- 0.00 to 100.00
  avg_execution_time_seconds INTEGER,

  -- Documentation
  usage_examples JSONB DEFAULT '[]', -- [{title: '', description: '', command: ''}]
  research_notes TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Research Projects Indexes
CREATE INDEX IF NOT EXISTS idx_research_projects_status ON research_projects(status);
CREATE INDEX IF NOT EXISTS idx_research_projects_type ON research_projects(type);
CREATE INDEX IF NOT EXISTS idx_research_projects_lead_agent ON research_projects(lead_agent_id);
CREATE INDEX IF NOT EXISTS idx_research_projects_created_by ON research_projects(created_by);
CREATE INDEX IF NOT EXISTS idx_research_projects_created_at ON research_projects(created_at DESC);

-- R&D Experiments Indexes
CREATE INDEX IF NOT EXISTS idx_rd_experiments_project ON rd_experiments(project_id);
CREATE INDEX IF NOT EXISTS idx_rd_experiments_status ON rd_experiments(status);
CREATE INDEX IF NOT EXISTS idx_rd_experiments_agent ON rd_experiments(executed_by_agent_id);
CREATE INDEX IF NOT EXISTS idx_rd_experiments_workflow ON rd_experiments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_rd_experiments_created_at ON rd_experiments(created_at DESC);

-- Knowledge Base Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_attack_tactics ON knowledge_base USING GIN(attack_tactics);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_attack_techniques ON knowledge_base USING GIN(attack_techniques);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_content_type ON knowledge_base(content_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_created_at ON knowledge_base(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search ON knowledge_base USING GIN(search_vector);

-- Tool Library Indexes
CREATE INDEX IF NOT EXISTS idx_tool_library_security_tool ON tool_library(security_tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_library_research_value ON tool_library(research_value);
CREATE INDEX IF NOT EXISTS idx_tool_library_testing_status ON tool_library(testing_status);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on research_projects
CREATE OR REPLACE FUNCTION update_research_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS research_projects_updated_at ON research_projects;
CREATE TRIGGER research_projects_updated_at
  BEFORE UPDATE ON research_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_research_projects_updated_at();

-- Update updated_at timestamp on knowledge_base
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS knowledge_base_updated_at ON knowledge_base;
CREATE TRIGGER knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_base_updated_at();

-- Update updated_at timestamp on tool_library
CREATE OR REPLACE FUNCTION update_tool_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tool_library_updated_at ON tool_library;
CREATE TRIGGER tool_library_updated_at
  BEFORE UPDATE ON tool_library
  FOR EACH ROW
  EXECUTE FUNCTION update_tool_library_updated_at();

-- ============================================================================
-- SEED DATA: R&D Agents
-- ============================================================================

-- Insert R&D specialized agents (if agents table exists and has expected structure)
-- These agents will appear in the OffSec Team R&D page

INSERT INTO agents (name, type, status, config) VALUES
(
  'Burp Suite Orchestrator',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "claude-3-opus",
    "systemPrompt": "You are a Burp Suite orchestration specialist. You automate web application security testing using Burp Suite Professional API.",
    "capabilities": ["web_scanning", "vulnerability_detection", "burp_api"],
    "toolSettings": {
      "burpApiUrl": "",
      "burpApiKey": ""
    }
  }'::JSONB
),
(
  'Empire C2 Manager',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "claude-3-opus",
    "systemPrompt": "You are an Empire C2 framework specialist. You manage listeners, payloads, and post-exploitation activities.",
    "capabilities": ["c2_management", "payload_generation", "post_exploitation"],
    "toolSettings": {
      "empireUrl": "",
      "empireToken": ""
    }
  }'::JSONB
),
(
  'Advanced Fuzzing Agent',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "claude-3-opus",
    "systemPrompt": "You are a fuzzing specialist using FFUF and custom wordlists. You discover hidden endpoints and parameters.",
    "capabilities": ["ffuf", "wordlist_management", "parameter_discovery", "fuzzing_templates"]
  }'::JSONB
),
(
  'Framework Security Agent',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "claude-3-opus",
    "systemPrompt": "You are a framework security analyst. You detect technology stacks and analyze framework-specific vulnerabilities.",
    "capabilities": ["tech_stack_detection", "framework_analysis", "vulnerability_mapping", "advisory_aggregation"]
  }'::JSONB
),
(
  'Maldev Agent',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "claude-3-opus",
    "systemPrompt": "You are a binary analysis and exploitation R&D specialist. You prioritize Rust-based development and convert other codebases to Rust. You specialize in reverse engineering, ROP chain development, and proof-of-concept creation.",
    "capabilities": ["reverse_engineering", "rop_development", "rust_development", "poc_creation"],
    "repositories": 44,
    "primaryLanguage": "rust",
    "toolCategories": ["reverse_engineering", "rop_development", "poc_development", "rust_development"]
  }'::JSONB
),
(
  'Azure-AD Agent',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "claude-3-opus",
    "systemPrompt": "You are an Azure and Active Directory attack research specialist. You research EntraID abuse techniques, AD enumeration, privilege escalation, persistence, and lateral movement. You prioritize Rust and C++ development.",
    "capabilities": ["entra_id_abuse", "ad_enumeration", "privilege_escalation", "persistence", "lateral_movement"],
    "repositories": 28,
    "primaryLanguages": ["rust", "cpp"],
    "toolCategories": ["entra_id_abuse", "aad_initial_access", "aad_enumeration", "aad_privesc", "aad_persistence", "aad_lateral_movement"]
  }'::JSONB
),
(
  'Research Agent',
  'custom',
  'idle',
  '{
    "category": "R&D",
    "model": "claude-3-opus",
    "systemPrompt": "You are a general R&D and experimentation agent. You test tools, develop techniques, create proof-of-concepts, and curate the knowledge base.",
    "capabilities": ["tool_testing", "technique_development", "poc_creation", "knowledge_curation"]
  }'::JSONB
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE research_projects IS 'OffSec Team R&D research projects for tool testing, vulnerability research, and technique development';
COMMENT ON TABLE rd_experiments IS 'Individual experiments within research projects, with hypothesis testing and result tracking';
COMMENT ON TABLE knowledge_base IS 'R&D knowledge base with full-text search and vector embeddings for RAG';
COMMENT ON TABLE tool_library IS 'R&D tool library extending security_tools with testing status and research metadata';

-- ============================================================================
-- ROLLBACK MIGRATION (uncomment to rollback)
-- ============================================================================
/*
-- Drop triggers
DROP TRIGGER IF EXISTS research_projects_updated_at ON research_projects;
DROP TRIGGER IF EXISTS knowledge_base_updated_at ON knowledge_base;
DROP TRIGGER IF EXISTS tool_library_updated_at ON tool_library;

-- Drop trigger functions
DROP FUNCTION IF EXISTS update_research_projects_updated_at();
DROP FUNCTION IF EXISTS update_knowledge_base_updated_at();
DROP FUNCTION IF EXISTS update_tool_library_updated_at();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS tool_library CASCADE;
DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS rd_experiments CASCADE;
DROP TABLE IF EXISTS research_projects CASCADE;

-- Optionally remove R&D agents
DELETE FROM agents WHERE config->>'category' = 'R&D';
*/
