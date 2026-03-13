#!/bin/bash
# Loki C2 Dormant Mode Entrypoint
# Starts in dormant mode, monitoring for activation flag.
# When /opt/c2-setup/.activate exists, starts Loki listener + MCP Server.
# When flag is removed, stops Loki and returns to dormant mode.

set -e

C2_SETUP_DIR="/opt/c2-setup"
ACTIVATE_FLAG="${C2_SETUP_DIR}/.activate"
LOKI_HOME="/opt/loki"
MCP_PORT="${MCP_PORT:-9000}"
LOKI_PID=""

log() {
  echo "[loki-entrypoint] $(date '+%Y-%m-%d %H:%M:%S') $1"
}

start_loki() {
  if [ ! -d "${LOKI_HOME}/src" ]; then
    log "Loki source not found, attempting clone..."
    git clone --depth 1 https://github.com/boku7/Loki.git ${LOKI_HOME}/src || {
      log "ERROR: Failed to clone Loki repository"
      return 1
    }
  fi

  log "Starting Loki C2..."

  # Build Loki if not already built
  if [ ! -f "${LOKI_HOME}/loki-server" ]; then
    cd ${LOKI_HOME}/src
    if [ -f "Makefile" ]; then
      make 2>&1 || log "WARN: Loki build may need manual intervention"
    elif [ -f "build.sh" ]; then
      bash build.sh 2>&1 || log "WARN: Loki build script failed"
    fi
    # Copy built binary if it exists
    find . -name "loki*" -type f -executable -exec cp {} ${LOKI_HOME}/loki-server \; 2>/dev/null || true
  fi

  # Start Loki listener
  if [ -f "${LOKI_HOME}/loki-server" ]; then
    ${LOKI_HOME}/loki-server 2>&1 &
    LOKI_PID=$!
    log "Loki C2 server started (PID: $LOKI_PID)"
  elif [ -f "${LOKI_HOME}/src/teamserver" ] || [ -f "${LOKI_HOME}/src/server.py" ]; then
    cd ${LOKI_HOME}/src
    python3 server.py 2>&1 &
    LOKI_PID=$!
    log "Loki teamserver started (PID: $LOKI_PID)"
  else
    log "WARN: No Loki binary found, running in management-only mode"
  fi

  # Start MCP server if available
  if [ -f "/mcp/dist/index.js" ]; then
    log "Starting MCP server on port $MCP_PORT..."
    cd /mcp && node dist/index.js &
    log "MCP server started"
  fi

  return 0
}

stop_loki() {
  if [ -n "$LOKI_PID" ] && kill -0 "$LOKI_PID" 2>/dev/null; then
    log "Stopping Loki C2 (PID: $LOKI_PID)..."
    kill "$LOKI_PID" 2>/dev/null || true
    wait "$LOKI_PID" 2>/dev/null || true
    LOKI_PID=""
    log "Loki C2 stopped"
  fi

  pkill -f "node.*mcp" 2>/dev/null || true
}

cleanup() {
  log "Shutting down..."
  stop_loki
  exit 0
}

trap cleanup SIGTERM SIGINT

mkdir -p "$C2_SETUP_DIR"

log "Loki C2 Agent starting in DORMANT mode"
log "Monitoring for activation flag at $ACTIVATE_FLAG"

C2_RUNNING=false

while true; do
  if [ -f "$ACTIVATE_FLAG" ]; then
    if [ "$C2_RUNNING" = false ]; then
      log "Activation flag detected!"
      if start_loki; then
        C2_RUNNING=true
        log "Loki C2 is now ACTIVE"
      else
        log "Failed to start Loki, remaining DORMANT"
      fi
    fi
  else
    if [ "$C2_RUNNING" = true ]; then
      log "Activation flag removed, deactivating..."
      stop_loki
      C2_RUNNING=false
      log "Loki C2 is now DORMANT"
    fi
  fi

  sleep 5
done
