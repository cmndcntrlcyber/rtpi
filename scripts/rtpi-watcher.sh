#!/bin/bash
# rtpi-watcher — self-healing daemon for the RTPI stack.
#
# Polls the things that should always be healthy and restarts them when they
# aren't. Designed to run as a systemd unit (see systemd/rtpi-watcher.service)
# under journald, but can also be invoked directly for ad-hoc monitoring.
#
# What it watches:
#   1. The API health endpoint (default http://localhost:3000/api/v1/health).
#      Reports {status, database}. A failure → restart the API container
#      (or run the configured heal hook).
#   2. The Postgres container (rtpi-postgres) via `pg_isready`.
#      A failure → restart the container.
#   3. Every Docker container in the rtpi compose project that is in
#      "restarting", "exited", or "unhealthy" state → restart it.
#
# Self-healing safeguards:
#   - Per-target restart counter with a rolling window (default 3 restarts /
#     600 s). Once the cap is hit, the target is quarantined until the
#     window slides off. Prevents the watcher from amplifying a real bug
#     into a restart loop.
#   - Cool-down between heal actions (default 15 s) so a single bad event
#     doesn't kick off a cascade of restarts.
#   - All actions log to stdout/stderr with `[level]` prefixes so journald
#     timestamps and filters work naturally.
#
# Configuration:
#   Environment-file (systemd EnvironmentFile=) overrides all of these.
#   See /etc/default/rtpi-watcher for the production knobs.
#
#   RTPI_WATCHER_INTERVAL          seconds between polls (default 60)
#   RTPI_WATCHER_API_HEALTH_URL    health endpoint to probe
#   RTPI_WATCHER_API_CONTAINER     container name to restart on API failure
#                                  (empty disables API restart action)
#   RTPI_WATCHER_API_TIMEOUT       curl timeout in seconds (default 10)
#   RTPI_WATCHER_PROJECT           docker compose project label (default rtpi)
#   RTPI_WATCHER_IGNORE            comma-separated container names to skip
#   RTPI_WATCHER_MAX_RESTARTS      heals per target per window (default 3)
#   RTPI_WATCHER_WINDOW            window in seconds (default 600)
#   RTPI_WATCHER_COOLDOWN          seconds between heal actions (default 15)
#   RTPI_WATCHER_PG_CONTAINER      postgres container (default rtpi-postgres)
#   RTPI_WATCHER_PG_USER           role to pg_isready as (default rtpi)
#   RTPI_WATCHER_PG_DB             db to pg_isready against (default rtpi_main)
#   RTPI_WATCHER_DRY_RUN           1 = log healing actions but don't execute
#
# Exit codes:
#   0   clean shutdown via SIGTERM/SIGINT.
#   2   misconfiguration (e.g. docker not on PATH).
#
# Companion to scripts/deploy-verify.sh — that one runs once at the end of a
# deploy as a gate; this one runs forever as a live healer.

set -u
set -o pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
INTERVAL=${RTPI_WATCHER_INTERVAL:-60}
API_HEALTH_URL=${RTPI_WATCHER_API_HEALTH_URL:-http://localhost:3000/api/v1/health}
API_CONTAINER=${RTPI_WATCHER_API_CONTAINER:-}
API_TIMEOUT=${RTPI_WATCHER_API_TIMEOUT:-10}
PROJECT=${RTPI_WATCHER_PROJECT:-rtpi}
IGNORE_RAW=${RTPI_WATCHER_IGNORE:-}
MAX_RESTARTS=${RTPI_WATCHER_MAX_RESTARTS:-3}
WINDOW=${RTPI_WATCHER_WINDOW:-600}
COOLDOWN=${RTPI_WATCHER_COOLDOWN:-15}
PG_CONTAINER=${RTPI_WATCHER_PG_CONTAINER:-rtpi-postgres}
PG_USER=${RTPI_WATCHER_PG_USER:-rtpi}
PG_DB=${RTPI_WATCHER_PG_DB:-rtpi_main}
DRY_RUN=${RTPI_WATCHER_DRY_RUN:-0}

# State (associative arrays — bash 4+).
declare -A RESTART_COUNT      # name -> number of restarts in current window
declare -A WINDOW_START       # name -> epoch when the current window opened
declare -A QUARANTINED        # name -> 1 if currently rate-limited
LAST_HEAL_AT=0

IFS=',' read -r -a IGNORE <<<"$IGNORE_RAW"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log()  { printf '[info]  %s %s\n'  "$(date -Is)" "$*"; }
warn() { printf '[warn]  %s %s\n'  "$(date -Is)" "$*" >&2; }
err()  { printf '[error] %s %s\n'  "$(date -Is)" "$*" >&2; }
debug() { [ "${RTPI_WATCHER_DEBUG:-0}" = "1" ] && printf '[debug] %s %s\n' "$(date -Is)" "$*" || true; }

is_ignored() {
  local name="$1"
  for n in "${IGNORE[@]:-}"; do
    [ -z "$n" ] && continue
    [ "$n" = "$name" ] && return 0
  done
  return 1
}

# ---------------------------------------------------------------------------
# Quarantine / rate-limit bookkeeping
# ---------------------------------------------------------------------------
note_restart() {
  local name="$1"
  local now
  now=$(date +%s)
  local start=${WINDOW_START[$name]:-0}
  if [ $((now - start)) -gt "$WINDOW" ]; then
    # Window slid off — reset.
    WINDOW_START[$name]=$now
    RESTART_COUNT[$name]=0
    unset 'QUARANTINED[$name]'
  fi
  RESTART_COUNT[$name]=$((${RESTART_COUNT[$name]:-0} + 1))
  if [ "${RESTART_COUNT[$name]}" -ge "$MAX_RESTARTS" ]; then
    QUARANTINED[$name]=1
    warn "Quarantining $name after ${RESTART_COUNT[$name]} restarts in ${WINDOW}s; will resume healing once the window expires."
  fi
}

is_quarantined() {
  local name="$1"
  [ "${QUARANTINED[$name]:-0}" = "1" ]
}

obey_cooldown() {
  local now
  now=$(date +%s)
  local since=$((now - LAST_HEAL_AT))
  if [ "$since" -lt "$COOLDOWN" ]; then
    debug "Cooldown: skipping heal action (${since}s < ${COOLDOWN}s)"
    return 1
  fi
  LAST_HEAL_AT=$now
  return 0
}

# ---------------------------------------------------------------------------
# Heal action — single point that respects DRY_RUN + cooldown + quarantine.
# ---------------------------------------------------------------------------
heal_restart_container() {
  local name="$1"
  local reason="$2"
  if is_ignored "$name"; then
    debug "Ignoring $name (in RTPI_WATCHER_IGNORE)"
    return 0
  fi
  if is_quarantined "$name"; then
    debug "Skipping $name (quarantined)"
    return 0
  fi
  if ! obey_cooldown; then return 0; fi
  warn "Healing: docker restart $name — reason: $reason"
  if [ "$DRY_RUN" = "1" ]; then
    log "DRY_RUN: would run \`docker restart $name\`"
    return 0
  fi
  if docker restart "$name" >/dev/null 2>&1; then
    log "Restarted $name OK"
    note_restart "$name"
  else
    err "docker restart $name failed (check docker daemon and container existence)"
  fi
}

# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------
check_api() {
  if [ -z "$API_HEALTH_URL" ]; then return 0; fi
  local body
  if ! body=$(curl -sf --max-time "$API_TIMEOUT" "$API_HEALTH_URL" 2>/dev/null); then
    warn "API health probe failed: $API_HEALTH_URL"
    if [ -n "$API_CONTAINER" ]; then
      heal_restart_container "$API_CONTAINER" "API /health unreachable"
    else
      debug "RTPI_WATCHER_API_CONTAINER not set — not auto-restarting API"
    fi
    return 1
  fi
  # If the body advertises a non-ok status or db: down, treat as unhealthy.
  if printf '%s' "$body" | grep -Eqi '"status"\s*:\s*"(degraded|down|unhealthy|error)"'; then
    warn "API reports degraded health: $body"
    if [ -n "$API_CONTAINER" ]; then
      heal_restart_container "$API_CONTAINER" "API /health reports degraded"
    fi
    return 1
  fi
  if printf '%s' "$body" | grep -Eqi '"database"\s*:\s*(false|"down"|"unhealthy")'; then
    warn "API reports database unhealthy: $body"
    heal_restart_container "$PG_CONTAINER" "API /health reports database down"
    return 1
  fi
  debug "API healthy"
  return 0
}

check_postgres() {
  if [ -z "$PG_CONTAINER" ]; then return 0; fi
  if ! docker inspect "$PG_CONTAINER" >/dev/null 2>&1; then
    debug "Postgres container $PG_CONTAINER not present; skipping"
    return 0
  fi
  if docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" -d "$PG_DB" -q 2>/dev/null; then
    debug "Postgres ready"
    return 0
  fi
  warn "pg_isready failed against $PG_CONTAINER ($PG_USER@$PG_DB)"
  heal_restart_container "$PG_CONTAINER" "pg_isready failed"
  return 1
}

check_containers() {
  # Anything in the compose project that's restarting, exited, or unhealthy.
  local ids name state health
  if ! command -v docker >/dev/null; then
    err "docker is not on PATH; cannot inspect containers"
    return 1
  fi
  ids=$(docker ps -a --filter "label=com.docker.compose.project=$PROJECT" --format '{{.ID}}') || return 1
  if [ -z "$ids" ]; then
    debug "No containers labeled com.docker.compose.project=$PROJECT"
    return 0
  fi
  for id in $ids; do
    # status / health in one inspect call (avoids fork storm on large projects).
    local row
    if ! row=$(docker inspect --format '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}}|{{.State.Restarting}}|{{.State.ExitCode}}' "$id" 2>/dev/null); then
      debug "inspect $id failed (container may have just been removed)"
      continue
    fi
    name=${row%%|*}
    name=${name#/}
    local rest=${row#*|}
    state=${rest%%|*}
    rest=${rest#*|}
    health=${rest%%|*}
    rest=${rest#*|}
    local restarting=${rest%%|*}
    rest=${rest#*|}
    local exit_code=${rest%%|*}

    case "$state" in
      running)
        if [ "$health" = "unhealthy" ]; then
          warn "Container $name is running but unhealthy"
          heal_restart_container "$name" "unhealthy"
        elif [ "$restarting" = "true" ]; then
          warn "Container $name is in a restart loop"
          heal_restart_container "$name" "restart loop"
        fi
        ;;
      restarting)
        warn "Container $name state=restarting"
        heal_restart_container "$name" "state=restarting"
        ;;
      exited|dead)
        # Some compose services are one-shot (init containers) and exit 0 by
        # design. Don't fight them.
        if [ "$exit_code" = "0" ]; then
          debug "Container $name exited cleanly (code 0); leaving alone"
        else
          warn "Container $name state=$state exit=$exit_code"
          heal_restart_container "$name" "state=$state exit=$exit_code"
        fi
        ;;
      *)
        debug "Container $name state=$state; no action"
        ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null; then
  err "docker is not on PATH; rtpi-watcher cannot function. Exiting."
  exit 2
fi

trap 'log "Received signal; shutting down rtpi-watcher"; exit 0' INT TERM

log "rtpi-watcher starting (interval=${INTERVAL}s project=$PROJECT api=$API_HEALTH_URL dry_run=$DRY_RUN)"

while true; do
  debug "tick"
  # Order matters: containers first (cheapest), then postgres (gates the API
  # check meaningful), then API (which itself can trigger pg restart).
  check_containers || true
  check_postgres   || true
  check_api        || true
  sleep "$INTERVAL"
done
