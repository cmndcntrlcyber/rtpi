-- V2.8.1: Agent Chat System - Persistent Conversations
-- Creates tables for storing agent conversation sessions and messages

-- Enums
DO $$ BEGIN
  CREATE TYPE conversation_status AS ENUM ('active', 'archived', 'deleted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE chat_message_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Agent conversations table
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Conversation metadata
  title TEXT,
  agent_role TEXT,
  status conversation_status NOT NULL DEFAULT 'active',

  -- Summary
  last_message_preview TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  total_tokens_used INTEGER NOT NULL DEFAULT 0,

  -- AI provider info
  last_provider TEXT,
  last_model TEXT,

  -- Timing
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent conversation messages table
CREATE TABLE IF NOT EXISTS agent_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,

  -- Message content
  role chat_message_role NOT NULL,
  content TEXT NOT NULL,

  -- AI metadata (for assistant messages)
  provider TEXT,
  model TEXT,
  tokens_used INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  duration_ms INTEGER,

  -- Context snapshot
  context_summary JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_id ON agent_conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_operation_id ON agent_conversations(operation_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_id ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_status ON agent_conversations(status);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_message ON agent_conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_conv_messages_conversation ON agent_conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_conv_messages_created ON agent_conversation_messages(created_at DESC);
