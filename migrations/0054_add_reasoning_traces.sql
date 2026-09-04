CREATE TABLE IF NOT EXISTS reasoning_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES agent_workflows(id) ON DELETE CASCADE,
  operation_id UUID REFERENCES operations(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  agent_name TEXT,
  iteration INTEGER NOT NULL,
  action TEXT NOT NULL,
  tool TEXT,
  confidence REAL NOT NULL,
  outcome TEXT,
  duration_ms INTEGER,
  hypothesis TEXT,
  findings_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reasoning_traces_operation ON reasoning_traces(operation_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_traces_agent ON reasoning_traces(agent_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_traces_created ON reasoning_traces(created_at);
