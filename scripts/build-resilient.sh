#!/usr/bin/env bash
# RTPI Resilient OffSec Agent Build
# Builds rtpi/offsec-base + the 14 child agent images with:
#   - bounded parallelism (one `docker compose build` invocation per image,
#     so a single failure cannot cancel sibling builds via BuildKit)
#   - per-image retry on transient failure
#   - per-image log file + summary table
#   - clean exit-code contract for CI/deploy gates
#
# Companion to scripts/deploy-verify.sh — same project conventions.
#
# Exit codes:
#   0   base + every child built successfully
#   2   bad args / docker not running
#   10  base failed (children skipped)
#   20  base ok, ≥1 child failed all retries
#
# Usage:
#   bash scripts/build-resilient.sh
#   BUILD_CONCURRENCY=4 bash scripts/build-resilient.sh
#   BUILD_RETRIES=0 bash scripts/build-resilient.sh   # one shot, no retry

set -uo pipefail

# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------
CONCURRENCY="${BUILD_CONCURRENCY:-2}"
RETRIES="${BUILD_RETRIES:-2}"
RETRY_DELAY="${BUILD_RETRY_DELAY:-15}"
LOG_DIR="${LOG_DIR:-/tmp/rtpi-build}"

# The 14 child services. Match exactly what's in docker-compose.yml under
# `profiles: [offsec-agents]`. offsec-base is built separately first.
CHILDREN=(
    offsec-maldev
    offsec-azure-ad
    offsec-burp
    offsec-empire
    offsec-c3
    offsec-sliver
    offsec-loki
    offsec-adaptix
    offsec-fuzzing
    offsec-framework
    offsec-research
    offsec-cloud
    offsec-llm-sec
    offsec-web-injection
)

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# ---------------------------------------------------------------------------
# Output helpers (match scripts/deploy-verify.sh style)
# ---------------------------------------------------------------------------
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
DIM=$'\033[2m'
NC=$'\033[0m'

if [ ! -t 1 ] || [ -n "${NO_COLOR:-}" ]; then
    RED=''; GREEN=''; YELLOW=''; BLUE=''; DIM=''; NC=''
fi

log()  { echo "${DIM}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo "${GREEN}✓${NC} $*"; }
warn() { echo "${YELLOW}⚠${NC} $*"; }
err()  { echo "${RED}✗${NC} $*" >&2; }
hdr()  { echo; echo "${BLUE}===== $* =====${NC}"; }

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
    err "docker not found in PATH"
    exit 2
fi

if ! docker info >/dev/null 2>&1; then
    err "docker daemon is not reachable (is the user in the docker group? does sudo docker work?)"
    exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

mkdir -p "$LOG_DIR"
SUMMARY="$LOG_DIR/_summary"
: > "$SUMMARY"

log "repo:        $REPO_ROOT"
log "log dir:     $LOG_DIR"
log "concurrency: $CONCURRENCY"
log "retries:     $RETRIES (delay $RETRY_DELAY s · linear backoff)"

# ---------------------------------------------------------------------------
# Build helpers
# ---------------------------------------------------------------------------
# Build a single service with retries. Writes per-image log + summary line.
# Exits 0 on eventual success, 1 on terminal failure.
build_one() {
    local svc="$1"
    local logf="$LOG_DIR/${svc}.log"
    local attempt=0 t0 t1 max_attempts=$((RETRIES + 1))
    : > "$logf"

    while [ "$attempt" -lt "$max_attempts" ]; do
        attempt=$((attempt + 1))
        t0=$(date +%s)
        echo "===== attempt $attempt of $max_attempts at $(date -Iseconds) =====" >> "$logf"
        if docker compose build "$svc" >> "$logf" 2>&1; then
            t1=$(date +%s)
            printf '%-28s OK   %ds (attempt %d)\n' "$svc" "$((t1 - t0))" "$attempt" >> "$SUMMARY"
            return 0
        fi
        t1=$(date +%s)
        echo "===== attempt $attempt FAILED in $((t1 - t0))s =====" >> "$logf"
        if [ "$attempt" -lt "$max_attempts" ]; then
            sleep $((RETRY_DELAY * attempt))
        fi
    done

    printf '%-28s FAIL after %d attempts (see %s)\n' "$svc" "$max_attempts" "$logf" >> "$SUMMARY"
    return 1
}

# Export for xargs subshells.
export -f build_one
export LOG_DIR SUMMARY RETRIES RETRY_DELAY

# ---------------------------------------------------------------------------
# Step 1 — base (fail fast, with one retry)
# ---------------------------------------------------------------------------
hdr "Building offsec-base"
BASE_LOG="$LOG_DIR/offsec-base.log"
: > "$BASE_LOG"

base_attempt=0
BASE_OK=0
while [ "$base_attempt" -lt 2 ]; do
    base_attempt=$((base_attempt + 1))
    log "offsec-base attempt $base_attempt"
    if docker compose --profile build-only build offsec-base >> "$BASE_LOG" 2>&1; then
        BASE_OK=1
        break
    fi
    [ "$base_attempt" -lt 2 ] && { warn "base build failed, retrying in ${RETRY_DELAY}s"; sleep "$RETRY_DELAY"; }
done

if [ "$BASE_OK" != "1" ]; then
    err "offsec-base failed after 2 attempts. Children skipped."
    err "log: $BASE_LOG"
    printf '%-28s FAIL (fatal — children skipped)\n' "offsec-base" >> "$SUMMARY"
    echo
    cat "$SUMMARY"
    exit 10
fi
ok "offsec-base built"
printf '%-28s OK\n' "offsec-base" >> "$SUMMARY"

# ---------------------------------------------------------------------------
# Step 2 — children (bounded parallelism via xargs -P)
# ---------------------------------------------------------------------------
hdr "Building ${#CHILDREN[@]} child images at concurrency $CONCURRENCY"
log "Each image runs in its own \`docker compose build\` invocation; one"
log "failure cannot cancel siblings."

# xargs -P spawns up to CONCURRENCY parallel `bash -c build_one ...` jobs.
# Each job is a separate process group, separate compose invocation, separate
# BuildKit DAG — so cancellation does not propagate.
printf '%s\n' "${CHILDREN[@]}" | \
    xargs -P"$CONCURRENCY" -I{} bash -c 'build_one "$1"' _ {}
XARGS_RC=$?

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
hdr "Build Summary"
sort "$SUMMARY"

FAIL_COUNT=$(grep -c 'FAIL' "$SUMMARY" 2>/dev/null || true)
OK_COUNT=$(grep -c ' OK ' "$SUMMARY" 2>/dev/null || true)
TOTAL=$((${#CHILDREN[@]} + 1))   # children + base

echo
log "Built $OK_COUNT/$TOTAL · failed $FAIL_COUNT · logs in $LOG_DIR"

if [ "$FAIL_COUNT" -eq 0 ]; then
    ok "All images built. Re-run anytime — cache mounts make rebuilds near-instant."
    exit 0
fi

err "$FAIL_COUNT image(s) failed all retries. Review per-image logs:"
grep 'FAIL' "$SUMMARY" | while read -r line; do
    err "  $line"
done
exit 20
