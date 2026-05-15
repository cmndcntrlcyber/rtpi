#!/bin/bash
# RTPI Deploy Verification Gate
# Runs after `docker compose up -d` to confirm every container in the project
# reaches a stable, healthy state. Fails the deploy if any container is in a
# restart loop, has exited, or stays unhealthy past the stability window.
#
# Catches the failure modes that pre-deployment-check.sh and container-healer.sh
# do not:
#   - Restart loops from broken entrypoint/command (e.g. certbot YAML scalar bug)
#   - Crash loops from misconfiguration (e.g. kasm-share baked-in DB password)
#   - Pinned-unhealthy from wrong healthchecks (e.g. kasm-vscode/kali curl -f vs 401)
#
# Usage:
#   scripts/deploy-verify.sh [--timeout 300] [--stability 30]
#                            [--project rtpi] [--ignore name1,name2]
#
# Exit codes:
#   0  All containers reached stable healthy state.
#   1  Bad arguments / docker not available.
#   2  At least one container in a hard-fail state (exited / restarting / dead / unhealthy).
#   3  Timed out waiting for stability.

set -u
set -o pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
TIMEOUT=${RTPI_VERIFY_TIMEOUT:-300}      # seconds to wait for all containers to settle
STABILITY=${RTPI_VERIFY_STABILITY:-30}   # seconds a container must hold a good state
POLL=${RTPI_VERIFY_POLL:-3}              # seconds between polls
PROJECT=${RTPI_VERIFY_PROJECT:-rtpi}     # compose project name (matches com.docker.compose.project label)
IGNORE_RAW=${RTPI_VERIFY_IGNORE:-}       # comma-separated list of container names to skip

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
while [ $# -gt 0 ]; do
    case "$1" in
        --timeout) TIMEOUT="$2"; shift 2 ;;
        --stability) STABILITY="$2"; shift 2 ;;
        --poll) POLL="$2"; shift 2 ;;
        --project) PROJECT="$2"; shift 2 ;;
        --ignore) IGNORE_RAW="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,22p' "$0"
            exit 0
            ;;
        *)
            echo "Unknown flag: $1" >&2
            echo "Try --help" >&2
            exit 1
            ;;
    esac
done

IFS=',' read -r -a IGNORE <<<"$IGNORE_RAW"
is_ignored() {
    local name="$1"
    for n in "${IGNORE[@]:-}"; do
        [ -n "$n" ] && [ "$n" = "$name" ] && return 0
    done
    return 1
}

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
DIM=$'\033[2m'
NC=$'\033[0m'

if [ ! -t 1 ] || [ -n "${NO_COLOR:-}" ]; then
    RED=''; GREEN=''; YELLOW=''; DIM=''; NC=''
fi

log()  { echo "${DIM}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo "${GREEN}✓${NC} $*"; }
warn() { echo "${YELLOW}⚠${NC} $*"; }
err()  { echo "${RED}✗${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null; then
    err "docker not found in PATH"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    err "docker daemon is not reachable"
    exit 1
fi

# ---------------------------------------------------------------------------
# Discover containers in the compose project
# ---------------------------------------------------------------------------
mapfile -t CONTAINERS < <(
    docker ps -a \
        --filter "label=com.docker.compose.project=${PROJECT}" \
        --format '{{.Names}}' | sort
)

if [ "${#CONTAINERS[@]}" -eq 0 ]; then
    err "No containers found for compose project '${PROJECT}'"
    err "Did you run 'docker compose up -d' first? Pass --project if your project name differs."
    exit 1
fi

log "Verifying ${#CONTAINERS[@]} container(s) in project '${PROJECT}'"
log "Timeout: ${TIMEOUT}s · stability window: ${STABILITY}s · poll: ${POLL}s"

# Snapshot starting RestartCount per container — we treat a *new* restart as a hard fail,
# since the deploy was supposed to have just settled.
declare -A START_RESTART_COUNT
declare -A LAST_GOOD_AT     # epoch when container first/last seen in a good state
declare -A FINAL_STATUS     # one of: ok | bad | unknown

now() { date +%s; }

snapshot_starting_state() {
    for c in "${CONTAINERS[@]}"; do
        local rc
        rc=$(docker inspect -f '{{.RestartCount}}' "$c" 2>/dev/null || echo 0)
        START_RESTART_COUNT["$c"]=$rc
        LAST_GOOD_AT["$c"]=0
        FINAL_STATUS["$c"]="unknown"
    done
}

# A container is "one-shot" if its restart policy is "no" — by compose convention
# these are init containers (e.g. cert generators, schema migrators) that exit 0
# on success and are referenced by depends_on: service_completed_successfully.
is_one_shot() {
    local c="$1" policy
    policy=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$c" 2>/dev/null || echo "")
    [ "$policy" = "no" ] || [ -z "$policy" ]
}

# Returns 0 if container is in a *hard-fail* state we should not wait through.
# Sets REASON.
REASON=""
is_hard_fail() {
    local c="$1"
    local state health rc rc_start exit_code
    state=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo missing)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$c" 2>/dev/null || echo none)
    rc=$(docker inspect -f '{{.RestartCount}}' "$c" 2>/dev/null || echo 0)
    exit_code=$(docker inspect -f '{{.State.ExitCode}}' "$c" 2>/dev/null || echo 0)
    rc_start=${START_RESTART_COUNT["$c"]:-0}

    case "$state" in
        exited)
            # One-shot init containers exit 0 on success — that's healthy, not failure.
            if is_one_shot "$c" && [ "$exit_code" = "0" ]; then
                REASON=""
                return 1
            fi
            REASON="state=exited exit_code=${exit_code}"
            return 0
            ;;
        dead)
            REASON="state=dead"
            return 0
            ;;
        restarting)
            # restarting is a hard-fail signal as long as it sticks; we'll catch it
            # only after one stability window so transient post-`up -d` restarts don't
            # trip a false alarm.
            REASON="state=restarting"
            return 0
            ;;
    esac

    if [ "$health" = "unhealthy" ]; then
        REASON="health=unhealthy"
        return 0
    fi

    if [ "$rc" -gt "$rc_start" ]; then
        REASON="restart_count grew ${rc_start} -> ${rc}"
        return 0
    fi

    REASON=""
    return 1
}

is_good_now() {
    local c="$1"
    local state health exit_code
    state=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo missing)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$c" 2>/dev/null || echo none)
    exit_code=$(docker inspect -f '{{.State.ExitCode}}' "$c" 2>/dev/null || echo 0)

    # One-shot init containers count as good once they exit 0.
    if [ "$state" = "exited" ] && [ "$exit_code" = "0" ] && is_one_shot "$c"; then
        return 0
    fi

    [ "$state" = "running" ] || return 1
    case "$health" in
        healthy|none) return 0 ;;
        starting|unhealthy|*) return 1 ;;
    esac
}

dump_diagnostics() {
    local c="$1" reason="$2"
    err "  ${c}: ${reason}"
    echo "${DIM}    --- last 25 log lines ---${NC}"
    docker logs --tail 25 "$c" 2>&1 | sed 's/^/    /' || true
    echo "${DIM}    --- inspect summary ---${NC}"
    docker inspect "$c" --format '    state={{.State.Status}} exit={{.State.ExitCode}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}} oom={{.State.OOMKilled}} error="{{.State.Error}}"' 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Wait loop
# ---------------------------------------------------------------------------
snapshot_starting_state

DEADLINE=$(( $(now) + TIMEOUT ))
GRACE_DEADLINE=$(( $(now) + STABILITY ))   # don't trip 'restarting' state during initial settle
HARD_FAILED=()

while true; do
    pending=0
    settled=0
    skipped=0

    for c in "${CONTAINERS[@]}"; do
        if is_ignored "$c"; then
            skipped=$((skipped + 1))
            FINAL_STATUS["$c"]="ok"  # treat as passing for summary
            continue
        fi

        if [ "${FINAL_STATUS[$c]}" = "ok" ]; then
            settled=$((settled + 1))
            continue
        fi

        # Hard-fail check — but allow a STABILITY-second grace window for
        # transient post-up restarts that resolve on their own.
        if is_hard_fail "$c"; then
            if [ "$(now)" -ge "$GRACE_DEADLINE" ]; then
                FINAL_STATUS["$c"]="bad"
                HARD_FAILED+=("$c::$REASON")
                continue
            fi
            # In grace period: report and keep waiting.
        fi

        if is_good_now "$c"; then
            if [ "${LAST_GOOD_AT[$c]}" = "0" ]; then
                LAST_GOOD_AT["$c"]=$(now)
            fi
            held=$(( $(now) - LAST_GOOD_AT["$c"] ))
            if [ "$held" -ge "$STABILITY" ]; then
                FINAL_STATUS["$c"]="ok"
                settled=$((settled + 1))
                continue
            fi
        else
            # Reset stability window if we slip out of good.
            LAST_GOOD_AT["$c"]=0
        fi

        pending=$((pending + 1))
    done

    total=${#CONTAINERS[@]}
    log "settled=${settled} pending=${pending} skipped=${skipped} bad=${#HARD_FAILED[@]} (of ${total})"

    if [ "${#HARD_FAILED[@]}" -gt 0 ]; then
        # Stop waiting on the rest if anything has hard-failed — the deploy is broken.
        break
    fi

    if [ "$pending" -eq 0 ]; then
        break
    fi

    if [ "$(now)" -ge "$DEADLINE" ]; then
        # Time is up; mark anything still pending as bad.
        for c in "${CONTAINERS[@]}"; do
            [ "${FINAL_STATUS[$c]}" = "unknown" ] && {
                FINAL_STATUS["$c"]="bad"
                HARD_FAILED+=("$c::timeout (state=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null) health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$c" 2>/dev/null))")
            }
        done
        break
    fi

    sleep "$POLL"
done

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
echo
echo "===================== Deploy Verification Result ====================="
for c in "${CONTAINERS[@]}"; do
    case "${FINAL_STATUS[$c]}" in
        ok)  ok  "$c" ;;
        bad) err "$c" ;;
        *)   warn "$c — final status unknown" ;;
    esac
done
echo

if [ "${#HARD_FAILED[@]}" -eq 0 ]; then
    ok "All containers reached a stable healthy state."
    exit 0
fi

err "${#HARD_FAILED[@]} container(s) failed verification:"
for entry in "${HARD_FAILED[@]}"; do
    name=${entry%%::*}
    reason=${entry#*::}
    dump_diagnostics "$name" "$reason"
done

# Exit code 3 if every failure was a timeout; 2 if any was a true hard fail.
all_timeouts=1
for entry in "${HARD_FAILED[@]}"; do
    [[ "${entry#*::}" == timeout* ]] || { all_timeouts=0; break; }
done
[ "$all_timeouts" = "1" ] && exit 3
exit 2
