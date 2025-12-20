-- Tool Framework Enhancement
-- Implements standardized tool configuration, GitHub auto-installer, and testing framework

-- ============================================================================
-- ENUMERATIONS
-- ============================================================================

-- Tool category enum
DO $$ BEGIN
  CREATE TYPE tool_category AS ENUM (
    'reconnaissance',
    'scanning',
    'exploitation',
    'post-exploitation',
    'wireless',
    'web-application',
    'password-cracking',
    'forensics',
    'social-engineering',
    'reporting',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Parameter type enum
DO $$ BEGIN
  CREATE TYPE parameter_type AS ENUM (
    'string',
    'number',
    'boolean',
    'array',
    'file',
    'ip-address',
    'cidr',
    'url',
    'port',
    'enum'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Install method enum
DO $$ BEGIN
  CREATE TYPE install_method AS ENUM (
    'apt',
    'pip',
    'npm',
    'go-install',
    'cargo',
    'docker',
    'github-binary',
    'github-source',
    'manual'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Output format enum
DO $$ BEGIN
  CREATE TYPE output_format AS ENUM (
    'json',
    'xml',
    'csv',
    'text',
    'nmap-xml',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tool execution status enum
DO $$ BEGIN
  CREATE TYPE tool_execution_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'timeout',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Install status enum
DO $$ BEGIN
  CREATE TYPE install_status AS ENUM (
    'pending',
    'installing',
    'installed',
    'failed',
    'updating'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Tool registry table
CREATE TABLE IF NOT EXISTS tool_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT UNIQUE NOT NULL, -- Short identifier (e.g., 'nmap', 'metasploit')
  name TEXT NOT NULL,
  version TEXT,
  category tool_category NOT NULL,
  description TEXT,

  -- Installation
  install_method install_method NOT NULL,
  install_command TEXT,
  docker_image TEXT,
  github_url TEXT,
  binary_path TEXT NOT NULL,

  -- Configuration (full ToolConfiguration as JSONB)
  config JSONB NOT NULL DEFAULT '{}',

  -- Status
  install_status install_status NOT NULL DEFAULT 'pending',
  install_log TEXT,
  validation_status TEXT, -- 'validated', 'pending', 'failed'
  last_validated TIMESTAMP,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  homepage TEXT,
  documentation TEXT,

  -- Timestamps
  installed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tool parameters table (normalized from ToolConfiguration.parameters)
CREATE TABLE IF NOT EXISTS tool_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,

  -- Parameter definition
  parameter_name TEXT NOT NULL,
  parameter_type parameter_type NOT NULL,
  description TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  default_value TEXT,

  -- Validation
  validation_regex TEXT,
  enum_values TEXT[] DEFAULT '{}',

  -- UI hints
  placeholder TEXT,
  help_text TEXT,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Ensure unique parameter names per tool
  UNIQUE(tool_id, parameter_name)
);

-- Tool executions table (execution history and results)
CREATE TABLE IF NOT EXISTS tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,

  -- Context
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
  target_id UUID REFERENCES targets(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Execution details
  command TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  status tool_execution_status NOT NULL DEFAULT 'pending',

  -- Results
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  parsed_output JSONB,

  -- Performance
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_ms INTEGER,
  timeout_ms INTEGER DEFAULT 300000, -- 5 minutes default

  -- Metadata
  error_message TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tool output parsers table
CREATE TABLE IF NOT EXISTS tool_output_parsers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,

  -- Parser configuration
  parser_name TEXT NOT NULL,
  parser_type TEXT NOT NULL, -- 'json', 'xml', 'regex', 'custom'
  output_format output_format NOT NULL,

  -- Parser implementation
  parser_code TEXT, -- JavaScript/TypeScript parser function
  regex_patterns JSONB DEFAULT '{}',
  json_paths JSONB DEFAULT '{}',
  xml_paths JSONB DEFAULT '{}',

  -- Metadata
  description TEXT,
  example_input TEXT,
  example_output JSONB,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- One parser per tool
  UNIQUE(tool_id, parser_name)
);

-- GitHub tool installations table (auto-installer tracking)
CREATE TABLE IF NOT EXISTS github_tool_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_url TEXT NOT NULL,
  tool_id UUID REFERENCES tool_registry(id) ON DELETE CASCADE,

  -- Analysis results
  repo_name TEXT,
  detected_language TEXT,
  detected_dependencies JSONB DEFAULT '[]',
  suggested_install_method install_method,

  -- Build artifacts
  dockerfile_generated TEXT,
  build_script_generated TEXT,

  -- Installation tracking
  install_status install_status NOT NULL DEFAULT 'pending',
  build_log TEXT,
  error_message TEXT,

  -- Timestamps
  analyzed_at TIMESTAMP,
  installed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tool test results table
CREATE TABLE IF NOT EXISTS tool_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,

  -- Test configuration
  test_type TEXT NOT NULL, -- 'syntax', 'execution', 'output-parsing'
  test_command TEXT,
  expected_exit_code INTEGER,
  expected_output TEXT,

  -- Test results
  passed BOOLEAN NOT NULL,
  actual_exit_code INTEGER,
  actual_output TEXT,
  error_message TEXT,
  execution_time_ms INTEGER,

  -- Metadata
  tested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  tested_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Tool registry indexes
CREATE INDEX IF NOT EXISTS idx_tool_registry_tool_id ON tool_registry(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_registry_category ON tool_registry(category);
CREATE INDEX IF NOT EXISTS idx_tool_registry_install_status ON tool_registry(install_status);
CREATE INDEX IF NOT EXISTS idx_tool_registry_validation_status ON tool_registry(validation_status);
CREATE INDEX IF NOT EXISTS idx_tool_registry_tags ON tool_registry USING GIN(tags);

-- Tool parameters indexes
CREATE INDEX IF NOT EXISTS idx_tool_parameters_tool_id ON tool_parameters(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_parameters_required ON tool_parameters(tool_id, required);

-- Tool executions indexes
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_id ON tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_user_id ON tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_operation_id ON tool_executions(operation_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_target_id ON tool_executions(target_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_agent_id ON tool_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON tool_executions(status);
CREATE INDEX IF NOT EXISTS idx_tool_executions_created_at ON tool_executions(created_at DESC);

-- Tool output parsers indexes
CREATE INDEX IF NOT EXISTS idx_tool_output_parsers_tool_id ON tool_output_parsers(tool_id);

-- GitHub installations indexes
CREATE INDEX IF NOT EXISTS idx_github_installations_tool_id ON github_tool_installations(tool_id);
CREATE INDEX IF NOT EXISTS idx_github_installations_status ON github_tool_installations(install_status);
CREATE INDEX IF NOT EXISTS idx_github_installations_created_at ON github_tool_installations(created_at DESC);

-- Tool test results indexes
CREATE INDEX IF NOT EXISTS idx_tool_test_results_tool_id ON tool_test_results(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_test_results_test_type ON tool_test_results(test_type);
CREATE INDEX IF NOT EXISTS idx_tool_test_results_passed ON tool_test_results(passed);
CREATE INDEX IF NOT EXISTS idx_tool_test_results_tested_at ON tool_test_results(tested_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update triggers for updated_at columns
CREATE TRIGGER update_tool_registry_updated_at
  BEFORE UPDATE ON tool_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_output_parsers_updated_at
  BEFORE UPDATE ON tool_output_parsers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_github_installations_updated_at
  BEFORE UPDATE ON github_tool_installations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tool_registry IS 'Centralized registry for all security tools with standardized configuration';
COMMENT ON TABLE tool_parameters IS 'Normalized parameter definitions for each tool';
COMMENT ON TABLE tool_executions IS 'Execution history and results for all tool runs';
COMMENT ON TABLE tool_output_parsers IS 'Output parsing configurations for automated result extraction';
COMMENT ON TABLE github_tool_installations IS 'GitHub auto-installer tracking and build artifacts';
COMMENT ON TABLE tool_test_results IS 'Validation and testing results for tools';

COMMENT ON COLUMN tool_registry.config IS 'Full ToolConfiguration object stored as JSONB for flexibility';
COMMENT ON COLUMN tool_executions.parsed_output IS 'Structured output after applying output parser';
COMMENT ON COLUMN github_tool_installations.dockerfile_generated IS 'Auto-generated Dockerfile from repository analysis';
