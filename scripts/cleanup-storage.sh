#!/usr/bin/env bash
# RTPI Storage Cleanup
#
# Single entrypoint for both interactive (manual) and automated (cron) cleanup.
# Replaces the two earlier scripts (cleanup-storage.sh + automated-storage-cleanup.sh)
# which had ~80% overlapping logic.
#
# Usage:
#   cleanup-storage.sh                       # interactive (y/n per phase)
#   cleanup-storage.sh --auto                # non-interactive, log to file
#   cleanup-storage.sh --yes                 # non-interactive, no log file
#   cleanup-storage.sh --auto --include-old  # also prune images >30 days
#   cleanup-storage.sh --log-dir /var/log    # override default log location
#
# Flags:
#   --auto             non-interactive + tee output to a timestamped log file
#   --yes / -y         non-interactive, all phases run, no log file
#   --include-old      enable the 30-day-old-image prune phase
#   --include-untagged enable the explicit untagged-image cleanup phase
#   --log-dir DIR      log directory for --auto mode (default: <repo>/logs)
#
# Always preserved (never touched by any phase):
#   - Docker volumes (databases, persistent data)
#   - Wordlist volumes (rtpi_fuzzing-wordlists)
#   - RKLLama models
#   - Tagged Docker images that are in use

set -euo pipefail

# ---------------------------------------------------------------------------
# CLI parsing
# ---------------------------------------------------------------------------

AUTO=0
ASSUME_YES=0
INCLUDE_OLD=0
INCLUDE_UNTAGGED=0
SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$( cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd )"
LOG_DIR="${REPO_ROOT}/logs"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --auto)             AUTO=1; ASSUME_YES=1 ;;
    --yes|-y)           ASSUME_YES=1 ;;
    --include-old)      INCLUDE_OLD=1 ;;
    --include-untagged) INCLUDE_UNTAGGED=1 ;;
    --log-dir)          LOG_DIR="$2"; shift ;;
    --help|-h)          sed -n '2,24p' "$0"; exit 0 ;;
    *)                  echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

# In --auto, opt into all the typically-safe phases by default so cron runs
# do real work without needing additional flags. Manual --yes leaves the
# riskier phases off unless the operator opts in explicitly.
if [[ $AUTO -eq 1 ]]; then
  INCLUDE_OLD=${INCLUDE_OLD:-0}        # kept off — 30d prune is opt-in
  INCLUDE_UNTAGGED=${INCLUDE_UNTAGGED:-0}
fi

# ---------------------------------------------------------------------------
# Output helpers — color when stdout is a TTY, plain when piped/logged
# ---------------------------------------------------------------------------

if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; NC=''
fi

log()  { printf '%b\n' "$*"; }
hr()   { log '=============================================='; }
phase(){ log "${GREEN}» $*${NC}"; }

# ---------------------------------------------------------------------------
# Logging — only when --auto
# ---------------------------------------------------------------------------

LOG_FILE=""
if [[ $AUTO -eq 1 ]]; then
  mkdir -p "$LOG_DIR"
  LOG_FILE="${LOG_DIR}/storage-cleanup-$(date +%Y%m%d-%H%M%S).log"
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

# ---------------------------------------------------------------------------
# Confirm helper — auto-yes when ASSUME_YES, otherwise prompt
# ---------------------------------------------------------------------------

confirm() {
  local prompt="$1"
  if [[ $ASSUME_YES -eq 1 ]]; then
    log "  → $prompt [auto-yes]"
    return 0
  fi
  read -p "  $prompt (y/n): " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]]
}

show_space() {
  df -h / | tail -1 | awk '{print "  Available: " $4 " (" $5 " used)"}'
}

# ---------------------------------------------------------------------------
# Cleanup phases
# ---------------------------------------------------------------------------

hr
log "RTPI Storage Cleanup"
log "Mode: $([[ $AUTO -eq 1 ]] && echo automated || echo interactive)"
log "Date: $(date)"
[[ -n "$LOG_FILE" ]] && log "Log:  $LOG_FILE"
hr
log ""
log "📊 Initial disk usage:"
show_space
log ""

phase "Phase 1: Docker build cache"
if confirm "Prune unused build cache layers?"; then
  docker builder prune -af 2>&1 | grep -i "total reclaimed" || log "  (build cache pruned)"
fi
log ""

phase "Phase 2: Stopped containers"
if confirm "Remove stopped containers?"; then
  docker container prune -f 2>&1 | grep -i "total reclaimed" || log "  (no stopped containers)"
fi
log ""

phase "Phase 3: Dangling images"
if confirm "Remove dangling Docker images?"; then
  docker image prune -f 2>&1 | grep -i "total reclaimed" || log "  (no dangling images)"
fi
log ""

phase "Phase 4: Unused networks"
if confirm "Prune unused Docker networks?"; then
  docker network prune -f 2>&1 || log "  (networks pruned)"
fi
log ""

phase "Phase 5: npm cache"
if confirm "Clean npm cache?"; then
  npm cache clean --force 2>&1 || log "  (npm cache cleaned)"
fi
log ""

if [[ $INCLUDE_OLD -eq 1 ]]; then
  log "${YELLOW}» Phase 6 (opt-in): Old images >30 days${NC}"
  if confirm "Remove images not used in the last 30 days?"; then
    docker image prune -a --filter "until=720h" -f
  fi
  log ""
fi

if [[ $INCLUDE_UNTAGGED -eq 1 ]]; then
  log "${YELLOW}» Phase 7 (opt-in): Untagged <none> images${NC}"
  untagged_count=$(docker images -f "dangling=true" -q | wc -l)
  log "  Found $untagged_count untagged images"
  if [[ $untagged_count -gt 0 ]] && confirm "Remove untagged (<none>) images?"; then
    docker images -f "dangling=true" -q | xargs -r docker rmi 2>/dev/null || log "  (some untagged images in use)"
  fi
  log ""
fi

# ---------------------------------------------------------------------------
# Always-preserved + final summary
# ---------------------------------------------------------------------------

log "⚠️  Preserved (not cleaned):"
log "   ✓ Wordlist volumes (rtpi_fuzzing-wordlists)"
log "   ✓ RKLLama models"
log "   ✓ Docker volumes (databases, persistent data)"
log "   ✓ Tagged Docker images currently in use"
log ""

if [[ $AUTO -eq 0 ]]; then
  log "${RED}=== High-risk options (run manually after backup) ===${NC}"
  log "   docker volume prune -a            # removes unused volumes (DBs!)"
  log "   docker image prune -a             # removes ALL unused images"
  log "   docker system prune -a --volumes  # nuclear option"
  log ""
fi

hr
log "✅ Cleanup complete"
log ""
log "📊 Final disk usage:"
show_space
log ""
log "📦 Docker resource usage:"
docker system df 2>&1 || log "  (docker system df unavailable)"
log ""

# Rotate old logs (only meaningful in --auto mode where we wrote one)
if [[ $AUTO -eq 1 && -d "$LOG_DIR" ]]; then
  find "$LOG_DIR" -name "storage-cleanup-*.log" -mtime +30 -delete 2>/dev/null || true
fi

[[ -n "$LOG_FILE" ]] && log "Log saved to: $LOG_FILE"
hr
