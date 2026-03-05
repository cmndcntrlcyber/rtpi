#!/bin/bash
# fuzzing-entrypoint.sh — Custom entrypoint for fuzzing-agent container
# Extends the base mcp-entrypoint.sh with PD tool verification on startup.

echo "OffSec Agent Container Starting..."
echo "Container: ${AGENT_TYPE:-fuzzing}"
echo "MCP Server: Initializing..."

# Verify PD tools are present (repairs stale Docker volume mounts)
/usr/local/bin/verify-pd-tools.sh || echo "[entrypoint] PD tool verification had issues (non-fatal)"

# Sync wordlists from R2 (if configured)
/usr/local/bin/sync-wordlists.sh || echo "Wordlist sync skipped or failed"

# Generate tool documentation (timeout after 60s to prevent hangs)
timeout 60 /usr/local/bin/generate-docs.sh || true

# Start MCP server as main process
cd /mcp
exec node dist/index.js
