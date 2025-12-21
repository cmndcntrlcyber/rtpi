-- Migration: Empire C2 Integration
-- Description: Adds tables and schema for PowerShell Empire C2 framework integration
-- Date: 2025-12-20

-- Create empire_c2 schema for Empire-specific data
CREATE SCHEMA IF NOT EXISTS empire_c2;

-- Enum for Empire listener types
CREATE TYPE empire_listener_type AS ENUM (
  'http',
  'https',
  'http_foreign',
  'http_hop',
  'http_mapi',
  'onedrive',
  'redirector'
);

-- Enum for Empire agent status
CREATE TYPE empire_agent_status AS ENUM (
  'active',
  'pending',
  'lost',
  'killed'
);

-- Enum for Empire task status
CREATE TYPE empire_task_status AS ENUM (
  'queued',
  'sent',
  'completed',
  'error'
);

-- Empire server configurations table
CREATE TABLE IF NOT EXISTS empire_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 1337,
  rest_api_url TEXT NOT NULL,
  rest_api_port INTEGER NOT NULL DEFAULT 1337,
  socketio_url TEXT,
  socketio_port INTEGER,
  admin_username TEXT NOT NULL DEFAULT 'empireadmin',
  admin_password_hash TEXT NOT NULL,
  api_token TEXT,
  certificate_path TEXT,
  is_active BOOLEAN DEFAULT true,
  version TEXT,
  status TEXT DEFAULT 'disconnected',
  last_heartbeat TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Empire user tokens table (per-user API tokens for Empire)
CREATE TABLE IF NOT EXISTS empire_user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES empire_servers(id) ON DELETE CASCADE,
  permanent_token TEXT NOT NULL,
  temporary_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP,
  UNIQUE(user_id, server_id)
);

-- Empire listeners table
CREATE TABLE IF NOT EXISTS empire_listeners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES empire_servers(id) ON DELETE CASCADE,
  empire_listener_id TEXT NOT NULL,
  name TEXT NOT NULL,
  listener_type empire_listener_type NOT NULL,
  listener_category TEXT,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  cert_path TEXT,
  staging_key TEXT,
  default_delay INTEGER DEFAULT 5,
  default_jitter REAL DEFAULT 0.0,
  default_lost_limit INTEGER DEFAULT 60,
  kill_date TEXT,
  working_hours TEXT,
  redirect_target TEXT,
  proxy_url TEXT,
  proxy_username TEXT,
  proxy_password TEXT,
  user_agent TEXT,
  headers TEXT,
  cookie TEXT,
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'stopped',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id),
  config JSONB DEFAULT '{}'::jsonb,
  UNIQUE(server_id, empire_listener_id)
);

-- Empire stagers table
CREATE TABLE IF NOT EXISTS empire_stagers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES empire_servers(id) ON DELETE CASCADE,
  listener_id UUID REFERENCES empire_listeners(id) ON DELETE SET NULL,
  stager_name TEXT NOT NULL,
  stager_type TEXT NOT NULL,
  language TEXT NOT NULL,
  output_file TEXT,
  base64_output TEXT,
  listener_name TEXT,
  user_agent TEXT,
  proxy_url TEXT,
  proxy_credentials TEXT,
  binpath TEXT,
  obfuscate BOOLEAN DEFAULT false,
  obfuscation_command TEXT,
  bypass_amsi BOOLEAN DEFAULT true,
  bypass_uac BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id),
  config JSONB DEFAULT '{}'::jsonb
);

-- Empire agents table
CREATE TABLE IF NOT EXISTS empire_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES empire_servers(id) ON DELETE CASCADE,
  listener_id UUID REFERENCES empire_listeners(id) ON DELETE SET NULL,
  target_id UUID REFERENCES targets(id) ON DELETE SET NULL,
  operation_id UUID REFERENCES operations(id) ON DELETE SET NULL,
  empire_agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hostname TEXT,
  internal_ip TEXT,
  external_ip TEXT,
  username TEXT,
  high_integrity BOOLEAN DEFAULT false,
  process_name TEXT,
  process_id INTEGER,
  language TEXT,
  language_version TEXT,
  os_details TEXT,
  architecture TEXT,
  domain TEXT,
  status empire_agent_status DEFAULT 'pending',
  checkin_time TIMESTAMP,
  lastseen_time TIMESTAMP,
  delay INTEGER DEFAULT 5,
  jitter REAL DEFAULT 0.0,
  lost_limit INTEGER DEFAULT 60,
  kill_date TEXT,
  working_hours TEXT,
  functions TEXT[],
  session_key TEXT,
  nonce TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(server_id, empire_agent_id)
);

-- Empire tasks table
CREATE TABLE IF NOT EXISTS empire_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES empire_servers(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES empire_agents(id) ON DELETE CASCADE,
  empire_task_id TEXT,
  task_name TEXT NOT NULL,
  module_name TEXT,
  command TEXT NOT NULL,
  parameters JSONB DEFAULT '{}'::jsonb,
  status empire_task_status DEFAULT 'queued',
  results TEXT,
  user_output TEXT,
  agent_output TEXT,
  error_message TEXT,
  queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_by TEXT REFERENCES users(id),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Empire modules table (cache of available modules)
CREATE TABLE IF NOT EXISTS empire_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES empire_servers(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  module_path TEXT NOT NULL,
  language TEXT NOT NULL,
  category TEXT,
  description TEXT,
  author TEXT[],
  background BOOLEAN DEFAULT false,
  output_extension TEXT,
  needs_admin BOOLEAN DEFAULT false,
  opsec_safe BOOLEAN DEFAULT true,
  techniques TEXT[],
  software TEXT,
  options JSONB DEFAULT '{}'::jsonb,
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(server_id, module_name)
);

-- Empire credentials table (harvested credentials)
CREATE TABLE IF NOT EXISTS empire_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES empire_servers(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES empire_agents(id) ON DELETE SET NULL,
  operation_id UUID REFERENCES operations(id) ON DELETE SET NULL,
  empire_credential_id TEXT,
  cred_type TEXT NOT NULL,
  domain TEXT,
  username TEXT NOT NULL,
  password TEXT,
  ntlm_hash TEXT,
  sha256_hash TEXT,
  host TEXT,
  os TEXT,
  sid TEXT,
  notes TEXT,
  harvested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Empire events table (for real-time event tracking)
CREATE TABLE IF NOT EXISTS empire_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES empire_servers(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES empire_agents(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  message TEXT,
  username TEXT,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  event_data JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX idx_empire_user_tokens_user_id ON empire_user_tokens(user_id);
CREATE INDEX idx_empire_user_tokens_server_id ON empire_user_tokens(server_id);
CREATE INDEX idx_empire_listeners_server_id ON empire_listeners(server_id);
CREATE INDEX idx_empire_listeners_active ON empire_listeners(is_active);
CREATE INDEX idx_empire_stagers_server_id ON empire_stagers(server_id);
CREATE INDEX idx_empire_stagers_listener_id ON empire_stagers(listener_id);
CREATE INDEX idx_empire_agents_server_id ON empire_agents(server_id);
CREATE INDEX idx_empire_agents_status ON empire_agents(status);
CREATE INDEX idx_empire_agents_operation_id ON empire_agents(operation_id);
CREATE INDEX idx_empire_agents_target_id ON empire_agents(target_id);
CREATE INDEX idx_empire_tasks_agent_id ON empire_tasks(agent_id);
CREATE INDEX idx_empire_tasks_status ON empire_tasks(status);
CREATE INDEX idx_empire_modules_server_id ON empire_modules(server_id);
CREATE INDEX idx_empire_modules_category ON empire_modules(category);
CREATE INDEX idx_empire_credentials_server_id ON empire_credentials(server_id);
CREATE INDEX idx_empire_credentials_operation_id ON empire_credentials(operation_id);
CREATE INDEX idx_empire_events_server_id ON empire_events(server_id);
CREATE INDEX idx_empire_events_timestamp ON empire_events(timestamp DESC);

-- Comments
COMMENT ON TABLE empire_servers IS 'PowerShell Empire server configurations';
COMMENT ON TABLE empire_user_tokens IS 'Per-user API tokens for Empire access';
COMMENT ON TABLE empire_listeners IS 'Empire C2 listeners';
COMMENT ON TABLE empire_stagers IS 'Empire payload stagers';
COMMENT ON TABLE empire_agents IS 'Empire C2 agents/implants';
COMMENT ON TABLE empire_tasks IS 'Tasks queued and executed on Empire agents';
COMMENT ON TABLE empire_modules IS 'Available Empire modules (cached)';
COMMENT ON TABLE empire_credentials IS 'Credentials harvested by Empire agents';
COMMENT ON TABLE empire_events IS 'Empire event stream for real-time monitoring';
