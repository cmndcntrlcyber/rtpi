-- v2.9.1 Phase 5: Health/probe columns for runtime observability
-- mcp_servers gets liveness probe state (populated by mcp-invoker every 30s).
-- tool_registry gets per-tool health check fields (populated by the
-- health-checks service when a container's tool inventory is enumerated).

ALTER TABLE mcp_servers
  ADD COLUMN IF NOT EXISTS liveness_path TEXT,
  ADD COLUMN IF NOT EXISTS last_probe_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_probe_ok BOOLEAN;

ALTER TABLE tool_registry
  ADD COLUMN IF NOT EXISTS health_check_cmd TEXT,
  ADD COLUMN IF NOT EXISTS last_health_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_health_ok BOOLEAN;
