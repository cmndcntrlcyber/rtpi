#!/bin/bash
# rtpi-startup.sh — orchestrated startup for the full RTPI stack.
#
# Brings up services in dependency order with health gates between phases.
# Supports both native (npm) and Docker app modes.
#
# Usage:
#   bash scripts/rtpi-startup.sh                   # full stack
#   bash scripts/rtpi-startup.sh --core-only       # infra + app only
#   bash scripts/rtpi-startup.sh --docker          # app runs in Docker
#   bash scripts/rtpi-startup.sh --native          # app runs natively (default)
#   bash scripts/rtpi-startup.sh --phase 3         # resume from phase 3
#   bash scripts/rtpi-startup.sh --dry-run         # show plan, don't execute
#   bash scripts/rtpi-startup.sh --skip-profiles   # skip optional profiles

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
APP_MODE="${RTPI_APP_MODE:-native}"     # native | docker
CORE_ONLY=false
DRY_RUN=false
SKIP_PROFILES=false
START_PHASE=0
COMPOSE_PROJECT="${RTPI_COMPOSE_PROJECT:-rtpi}"
API_PORT="${PORT:-3000}"
API_URL="http://localhost:${API_PORT}/api/v1/health/ready"
READY_FILE="${RTPI_READY_FILE:-/tmp/rtpi-ready}"

# Parse args
while [ $# -gt 0 ]; do
  case "$1" in
    --core-only)      CORE_ONLY=true ;;
    --docker)         APP_MODE=docker ;;
    --native)         APP_MODE=native ;;
    --dry-run)        DRY_RUN=true ;;
    --skip-profiles)  SKIP_PROFILES=true ;;
    --phase)          shift; START_PHASE="${1:-0}" ;;
    *)                echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()   { printf '\033[1;34m[phase %s]\033[0m %s\n' "${CURRENT_PHASE:-?}" "$*"; }
ok()    { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
fail()  { printf '\033[1;31m  ✗\033[0m %s\n' "$*" >&2; }
phase() { CURRENT_PHASE=$1; printf '\n\033[1;33m━━━ Phase %s: %s ━━━\033[0m\n' "$1" "$2"; }

wait_for() {
  local label="$1" cmd="$2" timeout="${3:-60}" poll="${4:-2}"
  local elapsed=0
  if [ "$DRY_RUN" = "true" ]; then
    log "DRY_RUN: would wait for $label (timeout ${timeout}s)"
    return 0
  fi
  while ! eval "$cmd" >/dev/null 2>&1; do
    elapsed=$((elapsed + poll))
    if [ "$elapsed" -ge "$timeout" ]; then
      fail "$label did not become ready within ${timeout}s"
      return 1
    fi
    printf '.'
    sleep "$poll"
  done
  echo ""
  ok "$label ready (${elapsed}s)"
}

compose() {
  if [ "$DRY_RUN" = "true" ]; then
    log "DRY_RUN: docker compose $*"
    return 0
  fi
  docker compose -p "$COMPOSE_PROJECT" "$@"
}

is_running() {
  docker inspect --format '{{.State.Running}}' "$1" 2>/dev/null | grep -q true
}

# ---------------------------------------------------------------------------
# Phase 0: Prerequisites
# ---------------------------------------------------------------------------
run_phase_0() {
  phase 0 "Prerequisites"

  if ! command -v docker >/dev/null; then
    fail "Docker not found"; exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    fail "Docker daemon not running"; exit 1
  fi
  ok "Docker available"

  if [ ! -f "${REPO_DIR}/.env" ]; then
    fail ".env file not found — copy .env.example and configure"
    exit 1
  fi
  ok ".env file exists"

  # Source .env for profile detection
  set -a
  # shellcheck disable=SC1091
  source "${REPO_DIR}/.env" 2>/dev/null || true
  set +a
  ok "Environment loaded"
}

# ---------------------------------------------------------------------------
# Phase 1: Core Infrastructure (postgres + redis)
# ---------------------------------------------------------------------------
run_phase_1() {
  phase 1 "Core Infrastructure"

  compose up -d postgres redis
  wait_for "PostgreSQL" "docker exec ${COMPOSE_PROJECT}-postgres pg_isready -U rtpi -q" 60
  wait_for "Redis" "docker exec ${COMPOSE_PROJECT}-redis redis-cli ping" 60
}

# ---------------------------------------------------------------------------
# Phase 2: Supporting Databases
# ---------------------------------------------------------------------------
run_phase_2() {
  phase 2 "Supporting Services"

  local services=()
  if is_running "${COMPOSE_PROJECT}-workbench-db" 2>/dev/null || ! $CORE_ONLY; then
    services+=(workbench-db)
  fi

  if [ ${#services[@]} -eq 0 ]; then
    log "No supporting services to start (core-only mode)"
    return 0
  fi

  compose up -d "${services[@]}"

  for svc in "${services[@]}"; do
    wait_for "$svc" "docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' ${COMPOSE_PROJECT}-${svc} 2>/dev/null | grep -q healthy" 90 3
  done
}

# ---------------------------------------------------------------------------
# Phase 3: Application
# ---------------------------------------------------------------------------
run_phase_3() {
  phase 3 "Application"

  if [ "$APP_MODE" = "docker" ]; then
    log "Starting app in Docker mode..."
    compose -f docker-compose.prod.yml up -d app
    wait_for "App (Docker)" "curl -sf --max-time 5 $API_URL" 120 3
  else
    log "Starting app in native mode..."
    if [ "$DRY_RUN" = "true" ]; then
      log "DRY_RUN: would start app with npm"
      return 0
    fi

    # Check if already running via readiness file
    if [ -f "$READY_FILE" ]; then
      local pid
      pid=$(cat "$READY_FILE" 2>/dev/null || echo "")
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        ok "App already running (PID $pid)"
        return 0
      fi
    fi

    cd "$REPO_DIR"
    nohup npm run dev > logs/app-startup.log 2>&1 &
    local app_pid=$!
    log "App starting (PID $app_pid), waiting for readiness..."

    wait_for "App (native)" "curl -sf --max-time 5 $API_URL" 120 3
  fi
}

# ---------------------------------------------------------------------------
# Phase 4: API-dependent Services
# ---------------------------------------------------------------------------
run_phase_4() {
  phase 4 "API-dependent Services"

  if [ "$CORE_ONLY" = "true" ]; then
    log "Skipping (core-only mode)"
    return 0
  fi

  local services=()
  services+=(rtpi-tools)

  # Only bring up empire if its config is present
  if [ -n "${EMPIRE_API_URL:-}" ]; then
    services+=(empire-server empire-proxy)
  fi

  services+=(workbench-api workbench-frontend)

  if [ ${#services[@]} -gt 0 ]; then
    compose up -d "${services[@]}"
    log "Waiting for services to stabilize..."
    sleep 10

    for svc in "${services[@]}"; do
      local container="${COMPOSE_PROJECT}-${svc}"
      if docker inspect "$container" >/dev/null 2>&1; then
        local health
        health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || echo "unknown")
        if [ "$health" = "healthy" ] || [ "$health" = "none" ]; then
          ok "$svc ($health)"
        else
          log "$svc health: $health (may still be starting)"
        fi
      fi
    done
  fi

  # Profile-gated services
  if [ "${SYSREPTOR_ENABLED:-}" = "true" ] || [ -n "${SYSREPTOR_URL:-}" ]; then
    log "Starting SysReptor profile..."
    compose --profile sysreptor up -d
  fi

  if [ "${DOCMOST_ENABLED:-}" = "true" ] || [ -n "${DOCMOST_URL:-}" ]; then
    log "Starting Docmost profile..."
    compose --profile docmost up -d
  fi
}

# ---------------------------------------------------------------------------
# Phase 5: Optional Profiles
# ---------------------------------------------------------------------------
run_phase_5() {
  phase 5 "Optional Profiles"

  if [ "$CORE_ONLY" = "true" ] || [ "$SKIP_PROFILES" = "true" ]; then
    log "Skipping optional profiles"
    return 0
  fi

  if [ "${KASM_ENABLED:-}" = "true" ]; then
    log "Starting Kasm profile..."
    compose --profile kasm up -d
  fi

  if [ "${OFFSEC_ENABLED:-}" = "true" ]; then
    log "Starting OffSec agents profile..."
    compose --profile offsec-agents up -d
  fi

  if [ "${VPN_ENABLED:-}" = "true" ]; then
    log "Starting VPN profile..."
    compose --profile vpn up -d
  fi

  # Run deploy-verify as final gate (non-fatal — just report)
  if [ "$DRY_RUN" = "false" ] && [ -f "${REPO_DIR}/scripts/deploy-verify.sh" ]; then
    log "Running post-startup verification..."
    if bash "${REPO_DIR}/scripts/deploy-verify.sh" 2>&1; then
      ok "Deploy verification passed"
    else
      fail "Deploy verification reported issues (check output above)"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Phase 6: Post-startup
# ---------------------------------------------------------------------------
run_phase_6() {
  phase 6 "Post-startup"

  # Enable systemd healing units if installed
  if command -v systemctl >/dev/null 2>&1; then
    if [ -f /etc/systemd/system/rtpi-watcher.service ]; then
      if ! systemctl is-active --quiet rtpi-watcher.service 2>/dev/null; then
        log "Starting rtpi-watcher.service..."
        if [ "$DRY_RUN" = "false" ]; then
          sudo systemctl start rtpi-watcher.service 2>/dev/null || log "Could not start watcher (run install-systemd-units.sh first)"
        fi
      else
        ok "rtpi-watcher.service already active"
      fi
    fi

    if [ -f /etc/systemd/system/rtpi-container-healer.timer ]; then
      if ! systemctl is-active --quiet rtpi-container-healer.timer 2>/dev/null; then
        log "Starting rtpi-container-healer.timer..."
        if [ "$DRY_RUN" = "false" ]; then
          sudo systemctl start rtpi-container-healer.timer 2>/dev/null || log "Could not start healer timer"
        fi
      else
        ok "rtpi-container-healer.timer already active"
      fi
    fi
  fi

  # Summary
  echo ""
  printf '\033[1;33m━━━ Stack Status ━━━\033[0m\n'
  if [ "$DRY_RUN" = "false" ]; then
    docker ps --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
      --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | head -30
    echo ""
    if [ -f "$READY_FILE" ]; then
      ok "App readiness file: ${READY_FILE} (PID $(cat "$READY_FILE" 2>/dev/null))"
    fi
  fi
  ok "Startup complete"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo ""
printf '\033[1;36m╔══════════════════════════════════════╗\033[0m\n'
printf '\033[1;36m║      RTPI Stack Startup              ║\033[0m\n'
printf '\033[1;36m╚══════════════════════════════════════╝\033[0m\n'
echo ""
log "Mode: ${APP_MODE} | Core-only: ${CORE_ONLY} | Dry-run: ${DRY_RUN} | Start phase: ${START_PHASE}"

# Ensure logs directory exists
mkdir -p "${REPO_DIR}/logs"

for p in 0 1 2 3 4 5 6; do
  [ "$p" -lt "$START_PHASE" ] && continue
  "run_phase_${p}"
done
