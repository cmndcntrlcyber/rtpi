#!/bin/bash
# rtpi-dev.sh — bring up the full RTPI development stack.
#
# 1. Validates Docker is running
# 2. Starts all Docker Compose services + enabled profiles
# 3. Waits for core infra (postgres, redis) to be healthy
# 4. Starts the backend (npm run dev) and frontend (npm run dev:frontend)
# 5. Forwards SIGTERM/SIGINT to both processes for clean shutdown
#
# Designed to run under systemd (rtpi.service) or interactively.
#
# Usage:
#   bash scripts/rtpi-dev.sh                    # full stack + all enabled profiles
#   bash scripts/rtpi-dev.sh --skip-profiles    # core infra + dev servers only

set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

SKIP_PROFILES=false
[ "${1:-}" = "--skip-profiles" ] && SKIP_PROFILES=true

COMPOSE_PROJECT="${RTPI_COMPOSE_PROJECT:-rtpi}"
BACKEND_PID=""
FRONTEND_PID=""

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
log()  { printf '\033[1;36m[rtpi]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m  ✗\033[0m %s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# Cleanup — forward signals to child processes
# ---------------------------------------------------------------------------
shutdown() {
  log "Shutting down..."
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  log "Dev servers stopped."
  exit 0
}
trap shutdown SIGTERM SIGINT SIGHUP

# ---------------------------------------------------------------------------
# wait_healthy — poll until a command succeeds or timeout
# ---------------------------------------------------------------------------
wait_healthy() {
  local label="$1" cmd="$2" timeout="${3:-60}" poll="${4:-2}"
  local elapsed=0
  while ! eval "$cmd" >/dev/null 2>&1; do
    elapsed=$((elapsed + poll))
    if [ "$elapsed" -ge "$timeout" ]; then
      fail "$label did not become healthy within ${timeout}s"
      return 1
    fi
    sleep "$poll"
  done
  ok "$label healthy (${elapsed}s)"
}

# ---------------------------------------------------------------------------
# Phase 1: Validate prerequisites
# ---------------------------------------------------------------------------
log "Phase 1: Prerequisites"

if ! command -v docker >/dev/null; then
  fail "Docker not found"; exit 1
fi
if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon not running"; exit 1
fi
ok "Docker available"

if ! command -v npm >/dev/null; then
  fail "npm not found"; exit 1
fi
ok "npm available"

if [ ! -f "${REPO_DIR}/.env" ]; then
  fail ".env file not found — copy .env.example and configure"
  exit 1
fi
ok ".env loaded"

# Source .env for profile detection
set -a
# shellcheck disable=SC1091
source "${REPO_DIR}/.env" 2>/dev/null || true
set +a

# ---------------------------------------------------------------------------
# Phase 2: Start Docker Compose services
# ---------------------------------------------------------------------------
log "Phase 2: Docker Compose services"

# Always start core (no-profile) services
log "Starting core services (postgres, redis, tools, empire, workbench, etc.)..."
docker compose -p "$COMPOSE_PROJECT" up -d
ok "Core services started"

# Start enabled profiles
if [ "$SKIP_PROFILES" = "false" ]; then
  PROFILES=()

  [ "${KASM_ENABLED:-}" = "true" ]    && PROFILES+=(kasm)
  [ "${OFFSEC_ENABLED:-}" = "true" ]  && PROFILES+=(offsec-agents)
  [ "${SYSREPTOR_ENABLED:-}" = "true" ] || [ -n "${SYSREPTOR_URL:-}" ] && PROFILES+=(sysreptor)
  [ "${DOCMOST_ENABLED:-}" = "true" ] && PROFILES+=(docmost)
  [ "${VPN_ENABLED:-}" = "true" ]     && PROFILES+=(vpn)
  [ "${MEM0_ENABLED:-}" = "true" ]    && PROFILES+=(mem0)
  [ "${PDF_ENABLED:-}" = "true" ]     && PROFILES+=(pdf)
  [ "${PORTAINER_ENABLED:-}" = "true" ] && PROFILES+=(management)

  # GPU/CPU Ollama — pick one based on what's available
  if [ "${OLLAMA_ENABLED:-}" = "true" ]; then
    if command -v nvidia-smi >/dev/null 2>&1; then
      PROFILES+=(gpu)
    else
      PROFILES+=(cpu)
    fi
  fi

  # vLLM
  [ "${VLLM_ENABLED:-}" = "true" ] && PROFILES+=(vllm)

  if [ ${#PROFILES[@]} -gt 0 ]; then
    log "Starting profiles: ${PROFILES[*]}"
    for profile in "${PROFILES[@]}"; do
      docker compose -p "$COMPOSE_PROJECT" --profile "$profile" up -d
    done
    ok "Profiles started"
  else
    log "No optional profiles enabled"
  fi
fi

# ---------------------------------------------------------------------------
# Phase 3: Wait for core infrastructure health
# ---------------------------------------------------------------------------
log "Phase 3: Infrastructure health gates"

wait_healthy "PostgreSQL" \
  "docker exec ${COMPOSE_PROJECT}-postgres pg_isready -U rtpi -q" 60

wait_healthy "Redis" \
  "docker exec ${COMPOSE_PROJECT}-redis redis-cli ping" 60

# ---------------------------------------------------------------------------
# Phase 4: Start dev servers
# ---------------------------------------------------------------------------
log "Phase 4: Dev servers"

mkdir -p "${REPO_DIR}/logs"

log "Starting backend (npm run dev)..."
npm run dev > "${REPO_DIR}/logs/backend.log" 2>&1 &
BACKEND_PID=$!
ok "Backend started (PID $BACKEND_PID)"

log "Starting frontend (npm run dev:frontend)..."
npm run dev:frontend > "${REPO_DIR}/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
ok "Frontend started (PID $FRONTEND_PID)"

# Wait for backend to be ready
wait_healthy "Backend API" \
  "curl -sf --max-time 5 http://localhost:${PORT:-3000}/api/v1/health/live" 120 3

wait_healthy "Frontend UI" \
  "curl -sf --max-time 5 http://localhost:5000/" 60 3

# ---------------------------------------------------------------------------
# Running — show summary
# ---------------------------------------------------------------------------
echo ""
log "━━━ RTPI Dev Stack Running ━━━"
log "Backend API:  http://localhost:${PORT:-3000}"
log "Frontend UI:  http://localhost:5000"
log "Backend log:  ${REPO_DIR}/logs/backend.log"
log "Frontend log: ${REPO_DIR}/logs/frontend.log"
echo ""
docker ps --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
  --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | head -25
echo ""
log "Press Ctrl+C to stop, or send SIGTERM."

# Wait on both child processes — if either exits, shut down the other
wait -n "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
EXIT_CODE=$?
log "A dev server exited (code $EXIT_CODE). Stopping the other..."
shutdown
