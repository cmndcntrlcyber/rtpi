-- ============================================================================
-- Phase 2: Agent System Architecture - Message Bus Infrastructure
-- Migration 0022: Create inter-agent communication tables
-- ============================================================================

-- ============================================================================
-- ENUMERATIONS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE agent_message_type AS ENUM (
    'report', 'task', 'question', 'response', 'alert', 'status', 'data'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_status AS ENUM (
    'queued', 'delivered', 'read', 'processed', 'failed', 'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_priority AS ENUM (
    'critical', 'high', 'normal', 'low', 'background'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Agent messages - Inter-agent communication records
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type agent_message_type NOT NULL,

  -- Routing
  from_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  from_agent_role TEXT NOT NULL,
  to_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  to_agent_role TEXT,
  broadcast_to_role TEXT,

  -- Context
  operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
  target_id UUID REFERENCES targets(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES agent_workflows(id) ON DELETE SET NULL,

  -- Priority
  priority message_priority NOT NULL DEFAULT 'normal',

  -- Content
  subject TEXT NOT NULL,
  content_summary TEXT NOT NULL,
  content_data JSON NOT NULL DEFAULT '{}',
  context_data JSON DEFAULT '{}',

  -- Memory integration
  relevant_memory_ids TEXT[] DEFAULT '{}',
  should_store_in_memory BOOLEAN NOT NULL DEFAULT false,
  stored_as_memory_id UUID REFERENCES memory_entries(id) ON DELETE SET NULL,
  memory_type TEXT,

  -- Status tracking
  status message_status NOT NULL DEFAULT 'queued',
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  processed_at TIMESTAMP,
  expires_at TIMESTAMP,

  -- Metadata
  metadata JSON DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agent registry - Tracks active agents and their capabilities
CREATE TABLE IF NOT EXISTS agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE UNIQUE,

  -- Agent identity
  agent_role TEXT NOT NULL,
  agent_type TEXT NOT NULL,

  -- Capabilities
  capabilities TEXT[] DEFAULT '{}',
  message_types_handled TEXT[] DEFAULT '{}',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_heartbeat_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Message queue stats
  queued_messages INTEGER NOT NULL DEFAULT 0,
  processed_messages INTEGER NOT NULL DEFAULT 0,
  failed_messages INTEGER NOT NULL DEFAULT 0,

  -- Configuration
  max_queue_size INTEGER NOT NULL DEFAULT 100,
  processing_timeout_ms INTEGER NOT NULL DEFAULT 300000,

  -- Metadata
  metadata JSON DEFAULT '{}',
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agent message subscriptions
CREATE TABLE IF NOT EXISTS agent_message_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Subscription filters
  message_type agent_message_type,
  from_agent_role TEXT,
  operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
  priority_filter JSON,

  -- Configuration
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_process BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_agent_messages_to_agent ON agent_messages(to_agent_id, status) WHERE to_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_messages_broadcast ON agent_messages(broadcast_to_role, status) WHERE broadcast_to_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_messages_from_agent ON agent_messages(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_operation ON agent_messages(operation_id) WHERE operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_messages_status ON agent_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_priority ON agent_messages(priority, status);
CREATE INDEX IF NOT EXISTS idx_agent_messages_expires ON agent_messages(expires_at) WHERE expires_at IS NOT NULL AND status = 'queued';

CREATE INDEX IF NOT EXISTS idx_agent_registry_active ON agent_registry(is_active, agent_role);
CREATE INDEX IF NOT EXISTS idx_agent_registry_agent_id ON agent_registry(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_subscriptions_agent ON agent_message_subscriptions(agent_id) WHERE is_active = true;
