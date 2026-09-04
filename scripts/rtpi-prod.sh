#!/bin/bash
# rtpi-prod.sh — deploy and run the full RTPI production stack.
#
# 1. Validates Docker is running and .env exists
# 2. Runs pre-deployment checks (npm run deploy:check)
# 3. Builds the production app image
# 4. Starts all Docker Compose production services + enabled profiles
# 5. Waits for core infrastructure (postgres, redis) to be healthy
# 6. Waits for the app and nginx to be healthy
# 7. Runs post-deploy verification gate (npm run deploy:verify)
# 8. Shows a summary of running services
#
# Everything runs inside Docker — no local npm dev servers.
#
# Usage:
#   bash scripts/rtpi-prod.sh                    # full stack + all enabled profiles
#   bash scripts/rtpi-prod.sh --skip-profiles    # core prod services only
#   bash scripts/rtpi-prod.sh --skip-build       # skip docker build (use existing images)
#   bash scripts/rtpi-prod.sh --skip-checks      # skip pre/post deploy verification

set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

SKIP_PROFILES=false
SKIP_BUILD=false
SKIP_CHECKS=false

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-profiles) SKIP_PROFILES=true ;;
    --skip-build)    SKIP_BUILD=true ;;
    --skip-checks)   SKIP_CHECKS=true ;;
    *)               echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
  shift
done

COMPOSE_PROJECT="${RTPI_COMPOSE_PROJECT:-rtpi}"
PROD_COMPOSE="-f docker-compose.prod.yml"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
log()  { printf '\033[1;35m[rtpi-prod]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m  ✗\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[1;33m  ⚠\033[0m %s\n' "$*"; }

# ---------------------------------------------------------------------------
# wait_healthy — poll until a command succeeds or timeout
# ---------------------------------------------------------------------------
wait_healthy() {
  local label="$1" cmd="$2" timeout="${3:-120}" poll="${4:-3}"
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

if [ ! -f "${REPO_DIR}/.env" ]; then
  fail ".env file not found — copy .env.example and configure"
  exit 1
fi
ok ".env loaded"

# Source .env for profile detection and variable expansion
set -a
# shellcheck disable=SC1091
source "${REPO_DIR}/.env" 2>/dev/null || true
set +a

# ---------------------------------------------------------------------------
# Phase 2: Pre-deployment checks
# ---------------------------------------------------------------------------
if [ "$SKIP_CHECKS" = "false" ]; then
  log "Phase 2: Pre-deployment checks"
  if [ -x "${REPO_DIR}/scripts/pre-deployment-check.sh" ]; then
    if ! bash "${REPO_DIR}/scripts/pre-deployment-check.sh"; then
      fail "Pre-deployment checks failed — fix issues above before deploying"
      exit 1
    fi
    ok "Pre-deployment checks passed"
  else
    warn "pre-deployment-check.sh not found or not executable, skipping"
  fi
else
  log "Phase 2: Pre-deployment checks (skipped)"
fi

# ---------------------------------------------------------------------------
# Phase 3: Build production images
# ---------------------------------------------------------------------------
if [ "$SKIP_BUILD" = "false" ]; then
  log "Phase 3: Building production images"
  docker compose -p "$COMPOSE_PROJECT" $PROD_COMPOSE build
  ok "Production app image built"

  # Build offsec agent images if the profile is enabled
  if [ "$SKIP_PROFILES" = "false" ] && [ "${OFFSEC_ENABLED:-}" = "true" ]; then
    log "Building offsec agent images (resilient build)..."
    if [ -x "${REPO_DIR}/scripts/build-resilient.sh" ]; then
      bash "${REPO_DIR}/scripts/build-resilient.sh"
      ok "Offsec agent images built"
    else
      docker compose -p "$COMPOSE_PROJECT" --profile offsec-agents build
      ok "Offsec agent images built (standard)"
    fi
  fi
else
  log "Phase 3: Build (skipped — using existing images)"
fi

# ---------------------------------------------------------------------------
# Phase 4: Start production Docker Compose services
# ---------------------------------------------------------------------------
log "Phase 4: Starting production services"

docker compose -p "$COMPOSE_PROJECT" $PROD_COMPOSE up -d
ok "Core production services started (postgres, redis, app, nginx)"

# Start enabled profiles from the main docker-compose.yml
if [ "$SKIP_PROFILES" = "false" ]; then
  PROFILES=()

  [ "${KASM_ENABLED:-}" = "true" ]      && PROFILES+=(kasm)
  [ "${OFFSEC_ENABLED:-}" = "true" ]    && PROFILES+=(offsec-agents)
  [ "${SYSREPTOR_ENABLED:-}" = "true" ] || [ -n "${SYSREPTOR_URL:-}" ] && PROFILES+=(sysreptor)
  [ "${DOCMOST_ENABLED:-}" = "true" ]   && PROFILES+=(docmost)
  [ "${VPN_ENABLED:-}" = "true" ]       && PROFILES+=(vpn)
  [ "${MEM0_ENABLED:-}" = "true" ]      && PROFILES+=(mem0)
  [ "${PDF_ENABLED:-}" = "true" ]       && PROFILES+=(pdf)
  [ "${PORTAINER_ENABLED:-}" = "true" ] && PROFILES+=(management)

  if [ "${OLLAMA_ENABLED:-}" = "true" ]; then
    if command -v nvidia-smi >/dev/null 2>&1; then
      PROFILES+=(gpu)
    else
      PROFILES+=(cpu)
    fi
  fi

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
# Phase 5: Wait for infrastructure health
# ---------------------------------------------------------------------------
log "Phase 5: Infrastructure health gates"

wait_healthy "PostgreSQL" \
  "docker exec ${COMPOSE_PROJECT}-postgres-prod pg_isready -U \${DB_USER:-rtpi} -q" 60

wait_healthy "Redis" \
  "docker exec ${COMPOSE_PROJECT}-redis-prod redis-cli -a \${REDIS_PASSWORD:-redis} ping" 60

wait_healthy "App" \
  "docker exec ${COMPOSE_PROJECT}-app-prod wget -qO /dev/null http://localhost:3000/api/v1/health/live" 120 5

wait_healthy "Nginx" \
  "curl -sf --max-time 5 http://localhost:80/" 60 3

# ---------------------------------------------------------------------------
# Phase 6: Post-deploy verification
# ---------------------------------------------------------------------------
if [ "$SKIP_CHECKS" = "false" ]; then
  log "Phase 6: Post-deploy verification"
  if [ -x "${REPO_DIR}/scripts/deploy-verify.sh" ]; then
    if bash "${REPO_DIR}/scripts/deploy-verify.sh" --project "$COMPOSE_PROJECT"; then
      ok "Post-deploy verification passed"
    else
      fail "Post-deploy verification failed — check container status above"
      echo ""
      docker compose -p "$COMPOSE_PROJECT" $PROD_COMPOSE ps
      exit 1
    fi
  else
    warn "deploy-verify.sh not found, skipping post-deploy verification"
  fi
else
  log "Phase 6: Post-deploy verification (skipped)"
fi

# ---------------------------------------------------------------------------
# Running — show summary
# ---------------------------------------------------------------------------
echo ""
log "━━━ RTPI Production Stack Running ━━━"
log "App (via nginx): http://localhost:80"
log "App (direct):    http://localhost:3000"
echo ""
docker compose -p "$COMPOSE_PROJECT" $PROD_COMPOSE ps \
  --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null
echo ""

# Show profile containers if any were started
if [ "$SKIP_PROFILES" = "false" ] && [ ${#PROFILES[@]:-0} -gt 0 ]; then
  log "Profile containers:"
  docker ps --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
    --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | head -30
  echo ""
fi

log "Production deployment complete."
