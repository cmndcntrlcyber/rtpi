CREATE TABLE IF NOT EXISTS skill_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_path TEXT NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  operation_id UUID REFERENCES operations(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL,
  iterations_used INTEGER,
  findings_produced INTEGER DEFAULT 0,
  feedback_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_usage_log_skill_path ON skill_usage_log(skill_path);
CREATE INDEX IF NOT EXISTS idx_skill_usage_log_created ON skill_usage_log(created_at);
