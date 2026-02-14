-- Memory System Foundation (Mem0 Integration)
-- Phase 1: Agentic memory infrastructure for v2.3
-- Provides contextual memory storage, vector embeddings, graph relationships, and audit logging

-- ============================================================================
-- ENUMERATIONS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE memory_context_type AS ENUM (
    'operation', 'target', 'agent', 'user', 'workflow', 'global'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE memory_type AS ENUM (
    'fact', 'event', 'insight', 'pattern', 'procedure', 'preference'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE memory_relationship_type AS ENUM (
    'related_to', 'caused_by', 'depends_on', 'conflicts_with', 'supersedes', 'derived_from'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE memory_access_type AS ENUM (
    'read', 'write', 'update', 'delete', 'search'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type memory_context_type NOT NULL,
  context_id TEXT NOT NULL,
  context_name TEXT NOT NULL,
  metadata JSON DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(context_type, context_id)
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id UUID NOT NULL REFERENCES memory_contexts(id) ON DELETE CASCADE,

  -- Memory content
  memory_text TEXT NOT NULL,
  memory_type memory_type NOT NULL,

  -- Embeddings as JSON array (future: ALTER to vector(1536) with pgvector extension)
  embedding JSON,

  -- Source tracking
  source_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  source_report_id UUID,

  -- Scoring and access
  relevance_score REAL NOT NULL DEFAULT 1.0,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP,

  -- Temporal validity
  valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP,

  -- Tags and metadata
  tags JSON DEFAULT '[]',
  metadata JSON DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_memory_id UUID NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
  target_memory_id UUID NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
  relationship_type memory_relationship_type NOT NULL,
  strength REAL NOT NULL DEFAULT 1.0,
  metadata JSON DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(source_memory_id, target_memory_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS memory_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
  accessed_by_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  accessed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  access_type memory_access_type NOT NULL,
  query_text TEXT,
  result_count INTEGER,
  accessed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_memory_contexts_type_id ON memory_contexts(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_context ON memory_entries(context_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_type ON memory_entries(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_entries_agent ON memory_entries(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_valid_until ON memory_entries(valid_until) WHERE valid_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memory_entries_created_at ON memory_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_relationships_source ON memory_relationships(source_memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_relationships_target ON memory_relationships(target_memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_access_logs_memory ON memory_access_logs(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_access_logs_accessed_at ON memory_access_logs(accessed_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Reuse existing update_updated_at_column() function (from 0003 migration)
DO $$ BEGIN
  CREATE TRIGGER update_memory_contexts_updated_at
    BEFORE UPDATE ON memory_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_memory_entries_updated_at
    BEFORE UPDATE ON memory_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE memory_contexts IS 'Memory system contexts linking memories to operations, targets, agents, or users';
COMMENT ON TABLE memory_entries IS 'Individual memory entries with optional vector embeddings for similarity search';
COMMENT ON TABLE memory_relationships IS 'Graph edges connecting related memories with typed relationships';
COMMENT ON TABLE memory_access_logs IS 'Audit trail for all memory access operations';
COMMENT ON COLUMN memory_entries.embedding IS 'Vector embedding stored as JSON array. Future: convert to pgvector vector(1536) for native similarity search.';
COMMENT ON COLUMN memory_entries.valid_until IS 'NULL means permanent memory. Non-NULL enables automatic cleanup of stale memories.';
