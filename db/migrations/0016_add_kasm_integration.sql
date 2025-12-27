-- Migration: Add Kasm Workspaces Integration
-- Version: 0016
-- Date: 2025-12-26
-- Description: Creates database tables for Kasm Workspaces integration
--              Supports workspace session tracking, management, and lifecycle

-- ============================================================================
-- Kasm Workspaces Table
-- ============================================================================
-- Tracks individual workspace instances provisioned for users

CREATE TABLE IF NOT EXISTS kasm_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_id UUID REFERENCES operations(id) ON DELETE SET NULL,

  -- Workspace configuration
  workspace_type TEXT NOT NULL, -- 'vscode', 'burp', 'kali', 'firefox', 'empire'
  workspace_name TEXT, -- Optional user-provided name

  -- Kasm identifiers
  kasm_session_id TEXT NOT NULL UNIQUE, -- Kasm session identifier
  kasm_container_id TEXT, -- Docker container ID
  kasm_user_id TEXT, -- Kasm internal user ID

  -- Status and access
  status TEXT NOT NULL DEFAULT 'starting', -- 'starting', 'running', 'stopped', 'failed'
  access_url TEXT, -- Full URL to access workspace
  internal_ip TEXT, -- Container internal IP

  -- Resource limits
  cpu_limit TEXT DEFAULT '2', -- CPU cores (e.g., '2', '4')
  memory_limit TEXT DEFAULT '4096M', -- Memory limit (e.g., '4096M', '8192M')

  -- Lifecycle management
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP, -- When workspace became ready
  last_accessed TIMESTAMP, -- Last user activity
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours', -- Auto-cleanup time
  terminated_at TIMESTAMP, -- When workspace was stopped

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Additional workspace configuration
  error_message TEXT, -- Error details if status = 'failed'

  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Kasm Sessions Table
-- ============================================================================
-- Tracks user sessions accessing workspaces

CREATE TABLE IF NOT EXISTS kasm_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES kasm_workspaces(id) ON DELETE CASCADE,

  -- Session tracking
  session_token TEXT UNIQUE, -- Kasm session token
  kasm_session_id TEXT, -- Kasm internal session ID

  -- Activity tracking
  last_activity TIMESTAMP DEFAULT NOW(),
  activity_count INTEGER DEFAULT 0, -- Number of interactions

  -- Connection info
  ip_address TEXT, -- Client IP
  user_agent TEXT, -- Client browser/OS

  -- Session lifecycle
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '12 hours',
  terminated_at TIMESTAMP,

  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Kasm Workspaces Indexes
CREATE INDEX idx_kasm_workspaces_user_id ON kasm_workspaces(user_id);
CREATE INDEX idx_kasm_workspaces_operation_id ON kasm_workspaces(operation_id);
CREATE INDEX idx_kasm_workspaces_status ON kasm_workspaces(status);
CREATE INDEX idx_kasm_workspaces_workspace_type ON kasm_workspaces(workspace_type);
CREATE INDEX idx_kasm_workspaces_kasm_session_id ON kasm_workspaces(kasm_session_id);
CREATE INDEX idx_kasm_workspaces_expires_at ON kasm_workspaces(expires_at);
CREATE INDEX idx_kasm_workspaces_created_at ON kasm_workspaces(created_at DESC);

-- Kasm Sessions Indexes
CREATE INDEX idx_kasm_sessions_user_id ON kasm_sessions(user_id);
CREATE INDEX idx_kasm_sessions_workspace_id ON kasm_sessions(workspace_id);
CREATE INDEX idx_kasm_sessions_session_token ON kasm_sessions(session_token);
CREATE INDEX idx_kasm_sessions_last_activity ON kasm_sessions(last_activity DESC);
CREATE INDEX idx_kasm_sessions_expires_at ON kasm_sessions(expires_at);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE kasm_workspaces IS 'Tracks Kasm Workspace instances provisioned for users';
COMMENT ON TABLE kasm_sessions IS 'Tracks user sessions accessing Kasm Workspaces';

COMMENT ON COLUMN kasm_workspaces.workspace_type IS 'Type of workspace: vscode, burp, kali, firefox, empire';
COMMENT ON COLUMN kasm_workspaces.status IS 'Workspace status: starting, running, stopped, failed';
COMMENT ON COLUMN kasm_workspaces.kasm_session_id IS 'Unique Kasm session identifier';
COMMENT ON COLUMN kasm_workspaces.expires_at IS 'Auto-cleanup time (default 24 hours from creation)';

COMMENT ON COLUMN kasm_sessions.session_token IS 'Kasm session authentication token';
COMMENT ON COLUMN kasm_sessions.last_activity IS 'Last recorded user activity in the workspace';
COMMENT ON COLUMN kasm_sessions.expires_at IS 'Session expiration time (default 12 hours from creation)';
