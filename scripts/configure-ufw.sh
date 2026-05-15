#!/usr/bin/env bash
# RTPI UFW Rules
# Opens the user-facing RTPI ports through ufw, scoped to a source CIDR.
#
# IMPORTANT — read this first:
# On Linux hosts running Docker with default settings, Docker bypasses ufw.
# Docker's iptables management inserts rules in the DOCKER chain *upstream*
# of ufw's INPUT chain, so any port published via `docker compose ... ports:`
# is already reachable regardless of ufw state. These rules are useful when:
#   1. You sit behind another firewall (cloud SG, router NAT, hw appliance)
#      that needs the same ports opened in addition to ufw.
#   2. You've disabled Docker's iptables management
#      (/etc/docker/daemon.json: {"iptables": false}) and ufw is the only gate.
#   3. You want documented intent — these rules describe which ports RTPI
#      considers "user-facing" so future operators know what's expected.
#
# Database / cache / admin-socket ports are intentionally not opened — those
# are listed in docs/DEPLOYMENT.md under "Port Requirements" with a note to
# keep them 127.0.0.1-only.
#
# Usage:
#   sudo bash scripts/configure-ufw.sh                  # default LAN scope
#   sudo bash scripts/configure-ufw.sh 10.0.0.0/8       # custom CIDR
#   sudo bash scripts/configure-ufw.sh any              # open to the world
#   sudo bash scripts/configure-ufw.sh --dry-run        # print, don't apply
#   sudo bash scripts/configure-ufw.sh --revoke         # remove all RTPI rules
#
# Exit codes:
#   0  rules applied (or dry-run printed)
#   1  ufw not installed / not active
#   2  bad arguments

set -uo pipefail

# ---------------------------------------------------------------------------
# Output helpers (match scripts/deploy-verify.sh / build-resilient.sh style)
# ---------------------------------------------------------------------------
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
DIM=$'\033[2m'
NC=$'\033[0m'
[ ! -t 1 ] || [ -n "${NO_COLOR:-}" ] && { RED=''; GREEN=''; YELLOW=''; DIM=''; NC=''; }
log()  { echo "${DIM}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo "${GREEN}✓${NC} $*"; }
warn() { echo "${YELLOW}⚠${NC} $*"; }
err()  { echo "${RED}✗${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
SRC="${RTPI_UFW_SOURCE:-192.168.1.0/24}"
DRY_RUN=0
REVOKE=0

while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run) DRY_RUN=1; shift ;;
        --revoke)  REVOKE=1; shift ;;
        -h|--help)
            sed -n '2,28p' "$0"
            exit 0
            ;;
        --*) err "Unknown flag: $1"; exit 2 ;;
        *)
            # First positional arg is the source CIDR.
            SRC="$1"
            shift
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
if ! command -v ufw >/dev/null 2>&1; then
    err "ufw is not installed. Install with: sudo apt install ufw"
    exit 1
fi

if [ "$DRY_RUN" = "0" ] && [ "$EUID" -ne 0 ]; then
    err "ufw rule changes require root. Run with sudo, or pass --dry-run to preview."
    exit 2
fi

# ---------------------------------------------------------------------------
# Port table
#
# Each entry: "<port-or-range> <description>"
# Order matters only for the comment that ends up in `ufw status verbose`.
# ---------------------------------------------------------------------------
PORTS=(
    # RTPI core (host-served via npm; not docker)
    "5000      RTPI frontend (vite dev)"
    "3001      RTPI backend API"

    # SysReptor
    "7777      SysReptor UI (Caddy)"
    "9005      SysReptor app direct"

    # Kasm Workspaces
    "8443      Kasm Workspaces HTTPS"
    "8444      Kasm HTTP redirect"
    "6901      Kasm vscode workspace"
    "6902      Kasm kali workspace"
    "4822      Kasm Guacamole"
    "8182      Kasm Share"

    # Other web UIs
    "3000      Open WebUI"
    "3010      ATT&CK Workbench API"
    "3020      ATT&CK Workbench UI"
    "7474      Neo4j browser"
    "7687      Neo4j Bolt"
    "8888      JupyterLab (research)"
    "9876      Burp MCP"
    "8283      Burp Proxy"
    "8185      LangGraph orchestrator"

    # Empire C2
    "1337      Empire REST"
    "5001      Empire Web UI"
    "8080:8100 Empire dynamic listeners"
)

# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------
run() {
    if [ "$DRY_RUN" = "1" ]; then
        echo "  $*"
    else
        # ufw is verbose enough on its own; capture errors but don't drown the operator.
        if ! "$@" >/dev/null; then
            warn "command failed: $*"
        fi
    fi
}

if [ "$REVOKE" = "1" ]; then
    log "revoking all rules tagged 'RTPI:'"
    if [ "$DRY_RUN" = "1" ]; then
        # `ufw status numbered` requires root. In dry-run we may not have it,
        # so describe the action instead of running it.
        if [ "$EUID" -eq 0 ]; then
            ufw status numbered 2>/dev/null \
                | awk -F'[][]' '/RTPI:/{print "  ufw --force delete " $2}'
        else
            echo "  (would enumerate 'ufw status numbered' for RTPI: rules — needs root)"
            echo "  (would walk indices in reverse and run 'ufw --force delete <n>')"
            echo "  (would run 'ufw reload')"
        fi
    else
        # Walk the numbered list in reverse so deletions don't shift indices.
        mapfile -t INDEXES < <(ufw status numbered | awk -F'[][]' '/RTPI:/{print $2}' | sort -rn)
        for i in "${INDEXES[@]}"; do
            ufw --force delete "$i" >/dev/null || warn "failed to delete rule $i"
        done
        ufw reload >/dev/null || true
    fi
    ok "RTPI rules revoked"
    exit 0
fi

log "applying ufw rules: source=${SRC} (override with positional arg or RTPI_UFW_SOURCE)"
if [ "$SRC" = "any" ]; then
    SRC_FRAG="from any"
else
    SRC_FRAG="from $SRC"
fi

[ "$DRY_RUN" = "1" ] && warn "dry-run: commands below would be executed"

for entry in "${PORTS[@]}"; do
    # Split: first whitespace-block is the port spec, rest is description
    port="${entry%% *}"
    desc="$(echo "${entry#* }" | sed 's/^ *//')"
    run ufw allow $SRC_FRAG to any port "$port" proto tcp comment "RTPI: ${desc}"
done

if [ "$DRY_RUN" = "0" ]; then
    log "reloading ufw"
    ufw reload >/dev/null || warn "ufw reload failed"
    if ! ufw status >/dev/null 2>&1 || ! ufw status | grep -q '^Status: active'; then
        warn "ufw is installed but not active. Enable with: sudo ufw enable"
    fi
fi

echo
ok "${#PORTS[@]} RTPI rule(s) processed"
log "view with:   sudo ufw status verbose | grep RTPI"
log "revoke with: sudo bash scripts/configure-ufw.sh --revoke"

# ---------------------------------------------------------------------------
# Reminder about Docker bypass
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = "0" ] && command -v docker >/dev/null 2>&1; then
    if docker info 2>/dev/null | grep -q 'Firewall Backend: iptables'; then
        echo
        warn "Docker is using its iptables backend (default), which BYPASSES ufw."
        warn "Docker-published ports remain reachable on this host regardless of"
        warn "ufw allow/deny state. To make ufw authoritative, set"
        warn "  /etc/docker/daemon.json: {\"iptables\": false}"
        warn "and manage all NAT/forwarding manually. Most operators leave Docker"
        warn "managing iptables and use ufw rules as documentation only."
    fi
fi
