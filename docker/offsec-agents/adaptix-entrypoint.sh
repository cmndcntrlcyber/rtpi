#!/bin/bash
# AdaptixC2 Dormant Mode Entrypoint
# Starts in dormant mode, monitoring for activation flag.
# When /opt/c2-setup/.activate exists, starts AdaptixC2 server + MCP Server.
# When flag is removed, stops AdaptixC2 and returns to dormant mode.

set -e

C2_SETUP_DIR="/opt/c2-setup"
ACTIVATE_FLAG="${C2_SETUP_DIR}/.activate"
ADAPTIX_HOME="/opt/adaptix"
MCP_PORT="${MCP_PORT:-9000}"
ADAPTIX_PID=""

log() {
  echo "[adaptix-entrypoint] $(date '+%Y-%m-%d %H:%M:%S') $1"
}

start_adaptix() {
  if [ ! -d "${ADAPTIX_HOME}/src" ]; then
    log "AdaptixC2 source not found, attempting clone..."
    git clone --depth 1 https://github.com/Adaptix-Framework/AdaptixC2.git ${ADAPTIX_HOME}/src || {
      log "ERROR: Failed to clone AdaptixC2 repository"
      return 1
    }
  fi

  log "Starting AdaptixC2 server..."

  # Build if not already built
  if [ ! -f "${ADAPTIX_HOME}/adaptix-server" ]; then
    cd ${ADAPTIX_HOME}/src
    if [ -f "go.mod" ]; then
      go build -o ${ADAPTIX_HOME}/adaptix-server ./... 2>&1 || log "WARN: AdaptixC2 Go build failed"
    elif [ -f "Makefile" ]; then
      make 2>&1 || log "WARN: AdaptixC2 make failed"
    elif [ -f "build.sh" ]; then
      bash build.sh 2>&1 || log "WARN: AdaptixC2 build script failed"
    fi
  fi

  # Start AdaptixC2 server
  if [ -f "${ADAPTIX_HOME}/adaptix-server" ]; then
    ${ADAPTIX_HOME}/adaptix-server 2>&1 &
    ADAPTIX_PID=$!
    log "AdaptixC2 server started (PID: $ADAPTIX_PID)"
  else
    # Try running from source
    cd ${ADAPTIX_HOME}/src
    if [ -f "go.mod" ]; then
      go run . 2>&1 &
      ADAPTIX_PID=$!
      log "AdaptixC2 running from source (PID: $ADAPTIX_PID)"
    else
      log "WARN: No AdaptixC2 binary found, running in management-only mode"
    fi
  fi

  # Start MCP server if available
  if [ -f "/mcp/dist/index.js" ]; then
    log "Starting MCP server on port $MCP_PORT..."
    cd /mcp && node dist/index.js &
    log "MCP server started"
  fi

  return 0
}

stop_adaptix() {
  if [ -n "$ADAPTIX_PID" ] && kill -0 "$ADAPTIX_PID" 2>/dev/null; then
    log "Stopping AdaptixC2 (PID: $ADAPTIX_PID)..."
    kill "$ADAPTIX_PID" 2>/dev/null || true
    wait "$ADAPTIX_PID" 2>/dev/null || true
    ADAPTIX_PID=""
    log "AdaptixC2 stopped"
  fi

  pkill -f "node.*mcp" 2>/dev/null || true
}

cleanup() {
  log "Shutting down..."
  stop_adaptix
  exit 0
}

trap cleanup SIGTERM SIGINT

mkdir -p "$C2_SETUP_DIR"

log "AdaptixC2 Agent starting in DORMANT mode"
log "Monitoring for activation flag at $ACTIVATE_FLAG"

C2_RUNNING=false

while true; do
  if [ -f "$ACTIVATE_FLAG" ]; then
    if [ "$C2_RUNNING" = false ]; then
      log "Activation flag detected!"
      if start_adaptix; then
        C2_RUNNING=true
        log "AdaptixC2 is now ACTIVE"
      else
        log "Failed to start AdaptixC2, remaining DORMANT"
      fi
    fi
  else
    if [ "$C2_RUNNING" = true ]; then
      log "Activation flag removed, deactivating..."
      stop_adaptix
      C2_RUNNING=false
      log "AdaptixC2 is now DORMANT"
    fi
  fi

  sleep 5
done
