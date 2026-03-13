#!/bin/bash
# C3 (Custom Command and Control) Dormant Mode Entrypoint
# Starts in dormant mode, monitoring for activation flag.
# When /opt/c2-setup/.activate exists, starts C3 gateway + MCP Server.
# When flag is removed, stops C3 and returns to dormant mode.

set -e

C2_SETUP_DIR="/opt/c2-setup"
ACTIVATE_FLAG="${C2_SETUP_DIR}/.activate"
C3_HOME="/opt/c3"
MCP_PORT="${MCP_PORT:-9000}"
C3_PID=""

log() {
  echo "[c3-entrypoint] $(date '+%Y-%m-%d %H:%M:%S') $1"
}

start_c3() {
  if [ ! -d "${C3_HOME}/src" ]; then
    log "C3 source not found, attempting clone..."
    git clone --depth 1 https://github.com/ReversecLabs/C3.git ${C3_HOME}/src || {
      log "ERROR: Failed to clone C3 repository"
      return 1
    }
  fi

  log "Starting C3 gateway..."

  # Build C3 if not already built
  if [ ! -f "${C3_HOME}/gateway" ]; then
    cd ${C3_HOME}/src
    if [ -f "CMakeLists.txt" ]; then
      mkdir -p build && cd build
      cmake .. 2>&1 && make -j$(nproc) 2>&1 || {
        log "WARN: C3 build failed, attempting alternative startup"
      }
    fi
  fi

  # Start C3 gateway (or web UI if available)
  if [ -f "${C3_HOME}/gateway" ]; then
    ${C3_HOME}/gateway 2>&1 &
    C3_PID=$!
    log "C3 gateway started (PID: $C3_PID)"
  elif [ -f "${C3_HOME}/src/Src/WebController/Backend/server.js" ]; then
    cd ${C3_HOME}/src/Src/WebController/Backend
    node server.js 2>&1 &
    C3_PID=$!
    log "C3 web controller started (PID: $C3_PID)"
  else
    log "WARN: No C3 binary found, running in management-only mode"
  fi

  # Start MCP server if available
  if [ -f "/mcp/dist/index.js" ]; then
    log "Starting MCP server on port $MCP_PORT..."
    cd /mcp && node dist/index.js &
    log "MCP server started"
  fi

  return 0
}

stop_c3() {
  if [ -n "$C3_PID" ] && kill -0 "$C3_PID" 2>/dev/null; then
    log "Stopping C3 (PID: $C3_PID)..."
    kill "$C3_PID" 2>/dev/null || true
    wait "$C3_PID" 2>/dev/null || true
    C3_PID=""
    log "C3 stopped"
  fi

  pkill -f "node.*mcp" 2>/dev/null || true
}

cleanup() {
  log "Shutting down..."
  stop_c3
  exit 0
}

trap cleanup SIGTERM SIGINT

mkdir -p "$C2_SETUP_DIR"

log "C3 Agent starting in DORMANT mode"
log "Monitoring for activation flag at $ACTIVATE_FLAG"

C2_RUNNING=false

while true; do
  if [ -f "$ACTIVATE_FLAG" ]; then
    if [ "$C2_RUNNING" = false ]; then
      log "Activation flag detected!"
      if start_c3; then
        C2_RUNNING=true
        log "C3 is now ACTIVE"
      else
        log "Failed to start C3, remaining DORMANT"
      fi
    fi
  else
    if [ "$C2_RUNNING" = true ]; then
      log "Activation flag removed, deactivating..."
      stop_c3
      C2_RUNNING=false
      log "C3 is now DORMANT"
    fi
  fi

  sleep 5
done
