CREATE TABLE IF NOT EXISTS session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  operation_id UUID REFERENCES operations(id) ON DELETE SET NULL,
  agent_type TEXT NOT NULL,
  target_type TEXT,
  summary TEXT NOT NULL,
  tools_used JSONB DEFAULT '[]',
  findings_count INTEGER DEFAULT 0,
  outcome TEXT NOT NULL,
  lessons_learned JSONB DEFAULT '[]',
  search_vector TSVECTOR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_agent_type ON session_summaries(agent_type);
CREATE INDEX IF NOT EXISTS idx_session_summaries_operation ON session_summaries(operation_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_search ON session_summaries USING GIN(search_vector);
