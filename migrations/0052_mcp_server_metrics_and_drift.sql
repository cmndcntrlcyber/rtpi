-- v3.1.10: MCP server response time metrics + capability drift detection

ALTER TABLE mcp_servers
  ADD COLUMN IF NOT EXISTS avg_response_ms INTEGER,
  ADD COLUMN IF NOT EXISTS p95_response_ms INTEGER,
  ADD COLUMN IF NOT EXISTS metrics_call_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_capability_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_capability_snapshot JSON;

ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'capability_drift';
