#!/bin/bash
# Sliver C2 Dormant Mode Entrypoint
# Starts in dormant mode, monitoring for activation flag.
# When /opt/c2-setup/.activate exists, starts Sliver server + MCP Server.
# When flag is removed, stops Sliver and returns to dormant mode.

set -e

C2_SETUP_DIR="/opt/c2-setup"
ACTIVATE_FLAG="${C2_SETUP_DIR}/.activate"
SLIVER_HOME="/opt/sliver"
MCP_PORT="${MCP_PORT:-9000}"
SLIVER_PID=""

log() {
  echo "[sliver-entrypoint] $(date '+%Y-%m-%d %H:%M:%S') $1"
}

start_sliver() {
  if [ ! -f "${SLIVER_HOME}/sliver-server" ]; then
    log "ERROR: Sliver server binary not found"
    return 1
  fi

  log "Starting Sliver C2 server..."

  # Unpack Sliver assets on first run
  ${SLIVER_HOME}/sliver-server unpack --force 2>/dev/null || true

  # Start Sliver daemon
  ${SLIVER_HOME}/sliver-server daemon 2>&1 &
  SLIVER_PID=$!

  log "Sliver C2 server started (PID: $SLIVER_PID)"

  # Start MCP server if available
  if [ -f "/mcp/dist/index.js" ]; then
    log "Starting MCP server on port $MCP_PORT..."
    cd /mcp && node dist/index.js &
    log "MCP server started"
  fi

  return 0
}

stop_sliver() {
  if [ -n "$SLIVER_PID" ] && kill -0 "$SLIVER_PID" 2>/dev/null; then
    log "Stopping Sliver C2 server (PID: $SLIVER_PID)..."
    kill "$SLIVER_PID" 2>/dev/null || true
    wait "$SLIVER_PID" 2>/dev/null || true
    SLIVER_PID=""
    log "Sliver C2 server stopped"
  fi

  pkill -f "node.*mcp" 2>/dev/null || true
}

cleanup() {
  log "Shutting down..."
  stop_sliver
  exit 0
}

trap cleanup SIGTERM SIGINT

mkdir -p "$C2_SETUP_DIR"

log "Sliver C2 Agent starting in DORMANT mode"
log "Monitoring for activation flag at $ACTIVATE_FLAG"

C2_RUNNING=false

while true; do
  if [ -f "$ACTIVATE_FLAG" ]; then
    if [ "$C2_RUNNING" = false ]; then
      log "Activation flag detected!"
      if start_sliver; then
        C2_RUNNING=true
        log "Sliver C2 is now ACTIVE"
      else
        log "Failed to start Sliver, remaining DORMANT"
      fi
    fi
  else
    if [ "$C2_RUNNING" = true ]; then
      log "Activation flag removed, deactivating..."
      stop_sliver
      C2_RUNNING=false
      log "Sliver C2 is now DORMANT"
    fi
  fi

  sleep 5
done
