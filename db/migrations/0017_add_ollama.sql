-- Migration 0017: Add Ollama AI Integration
-- Description: Adds support for local AI inference via Ollama
-- Created: 2025-12-27
-- Enhancement: #08 - Ollama AI Integration (Phase 1)

-- ============================================================================
-- TABLE: ollama_models
-- Purpose: Track downloaded Ollama models and their usage
-- ============================================================================

CREATE TABLE IF NOT EXISTS ollama_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL UNIQUE,
  model_tag TEXT DEFAULT 'latest',
  model_size BIGINT, -- Size in bytes
  parameter_size TEXT, -- e.g., "8b", "7b"
  quantization TEXT, -- e.g., "q4_0", "q8_0"
  downloaded_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'downloading', 'loading', 'loaded', 'unloaded', 'error')),
  metadata JSONB DEFAULT '{}', -- Additional model metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_ollama_models_status ON ollama_models(status);
CREATE INDEX idx_ollama_models_last_used ON ollama_models(last_used);
CREATE INDEX idx_ollama_models_model_name ON ollama_models(model_name);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ollama_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ollama_models_updated_at
  BEFORE UPDATE ON ollama_models
  FOR EACH ROW
  EXECUTE FUNCTION update_ollama_models_updated_at();

-- ============================================================================
-- TABLE: ai_enrichment_logs
-- Purpose: Log all AI enrichment activities for auditing and analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_enrichment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vulnerability_id UUID REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  model_used TEXT NOT NULL, -- e.g., "llama3:8b", "qwen2.5-coder:7b", "gpt-4"
  provider TEXT NOT NULL DEFAULT 'ollama' CHECK (provider IN ('ollama', 'openai', 'anthropic', 'llama.cpp')),
  enrichment_type TEXT NOT NULL, -- e.g., "description", "impact", "remediation", "cve_matching"
  prompt TEXT NOT NULL,
  response TEXT,
  tokens_used INTEGER, -- Total tokens (prompt + completion)
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  duration_ms INTEGER, -- Time taken for inference
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}', -- Additional context (e.g., model parameters)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_ai_enrichment_logs_vulnerability_id ON ai_enrichment_logs(vulnerability_id);
CREATE INDEX idx_ai_enrichment_logs_model_used ON ai_enrichment_logs(model_used);
CREATE INDEX idx_ai_enrichment_logs_provider ON ai_enrichment_logs(provider);
CREATE INDEX idx_ai_enrichment_logs_created_at ON ai_enrichment_logs(created_at DESC);
CREATE INDEX idx_ai_enrichment_logs_success ON ai_enrichment_logs(success);

-- ============================================================================
-- VIEWS: Ollama Analytics
-- Purpose: Provide insights into model usage and performance
-- ============================================================================

-- View: Model usage statistics
CREATE OR REPLACE VIEW ollama_model_stats AS
SELECT
  om.model_name,
  om.model_tag,
  om.parameter_size,
  om.status,
  om.usage_count,
  om.last_used,
  COUNT(ael.id) AS enrichment_count,
  AVG(ael.duration_ms) AS avg_duration_ms,
  SUM(ael.tokens_used) AS total_tokens_used,
  AVG(ael.tokens_used) AS avg_tokens_per_request,
  COUNT(CASE WHEN ael.success = true THEN 1 END) AS successful_requests,
  COUNT(CASE WHEN ael.success = false THEN 1 END) AS failed_requests,
  CASE
    WHEN COUNT(ael.id) > 0 THEN
      ROUND((COUNT(CASE WHEN ael.success = true THEN 1 END)::numeric / COUNT(ael.id)::numeric) * 100, 2)
    ELSE 0
  END AS success_rate_pct
FROM ollama_models om
LEFT JOIN ai_enrichment_logs ael ON ael.model_used = om.model_name || ':' || om.model_tag
GROUP BY om.id, om.model_name, om.model_tag, om.parameter_size, om.status, om.usage_count, om.last_used;

-- View: Recent AI enrichment activity
CREATE OR REPLACE VIEW recent_ai_enrichments AS
SELECT
  ael.id,
  ael.vulnerability_id,
  v.title AS vulnerability_title,
  ael.model_used,
  ael.provider,
  ael.enrichment_type,
  ael.duration_ms,
  ael.tokens_used,
  ael.success,
  ael.created_at
FROM ai_enrichment_logs ael
LEFT JOIN vulnerabilities v ON v.id = ael.vulnerability_id
ORDER BY ael.created_at DESC
LIMIT 100;

-- View: Provider performance comparison
CREATE OR REPLACE VIEW ai_provider_performance AS
SELECT
  provider,
  COUNT(*) AS total_requests,
  AVG(duration_ms) AS avg_duration_ms,
  AVG(tokens_used) AS avg_tokens_used,
  COUNT(CASE WHEN success = true THEN 1 END) AS successful_requests,
  ROUND((COUNT(CASE WHEN success = true THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 2) AS success_rate_pct
FROM ai_enrichment_logs
GROUP BY provider
ORDER BY total_requests DESC;

-- ============================================================================
-- SEED DATA: Initial Models (Pre-configured)
-- ============================================================================

-- Insert placeholder records for target models
-- These will be updated when models are actually downloaded
INSERT INTO ollama_models (model_name, model_tag, parameter_size, status, metadata)
VALUES
  ('llama3', 'latest', '8b', 'available', '{"description": "Meta Llama 3 - General purpose AI", "recommended_for": ["general", "description", "impact"]}'),
  ('qwen2.5-coder', 'latest', '7b', 'available', '{"description": "Qwen 2.5 Coder - Code-focused AI", "recommended_for": ["code_analysis", "remediation", "technical"]}')
ON CONFLICT (model_name) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ollama_models IS 'Tracks downloaded Ollama models and their usage statistics';
COMMENT ON TABLE ai_enrichment_logs IS 'Logs all AI enrichment activities for auditing and performance analysis';

COMMENT ON COLUMN ollama_models.model_name IS 'Model name without tag (e.g., llama3, qwen2.5-coder)';
COMMENT ON COLUMN ollama_models.model_tag IS 'Model tag/version (e.g., latest, 8b-q4_0)';
COMMENT ON COLUMN ollama_models.model_size IS 'Total model size in bytes';
COMMENT ON COLUMN ollama_models.parameter_size IS 'Model parameter count (e.g., 8b = 8 billion parameters)';
COMMENT ON COLUMN ollama_models.quantization IS 'Quantization format if applicable (e.g., q4_0, q8_0)';
COMMENT ON COLUMN ollama_models.status IS 'Current model status: available, downloading, loading, loaded, unloaded, error';
COMMENT ON COLUMN ollama_models.usage_count IS 'Total number of times this model has been used';
COMMENT ON COLUMN ollama_models.last_used IS 'Timestamp of last model usage (for auto-unload logic)';

COMMENT ON COLUMN ai_enrichment_logs.enrichment_type IS 'Type of enrichment: description, impact, remediation, cve_matching, etc.';
COMMENT ON COLUMN ai_enrichment_logs.provider IS 'AI provider: ollama, openai, anthropic, llama.cpp';
COMMENT ON COLUMN ai_enrichment_logs.duration_ms IS 'Inference time in milliseconds';
COMMENT ON COLUMN ai_enrichment_logs.tokens_used IS 'Total tokens (prompt + completion)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
