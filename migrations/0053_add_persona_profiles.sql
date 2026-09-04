CREATE TABLE IF NOT EXISTS persona_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  methodology TEXT NOT NULL,
  expertise_domains JSONB DEFAULT '[]',
  behavioral_constraints JSONB DEFAULT '{}',
  performance_history JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persona_profiles_agent_type ON persona_profiles(agent_type);
