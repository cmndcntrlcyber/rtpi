#!/bin/bash
# install-systemd-units.sh — install/uninstall RTPI self-healing systemd units.
#
# Usage:
#   sudo bash scripts/install-systemd-units.sh            # install + enable
#   sudo bash scripts/install-systemd-units.sh --uninstall # disable + remove
#
# Installs:
#   rtpi.service                  — full dev stack (Docker + npm dev servers)
#   rtpi-startup.service          — orchestrated stack boot (oneshot, runs first)
#   rtpi-watcher.service          — long-running API + container health daemon
#   rtpi-container-healer.service — one-shot container repair scan
#   rtpi-container-healer.timer   — fires the healer every 2 minutes

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SYSTEMD_DIR="/etc/systemd/system"
ENV_FILE="/etc/default/rtpi-watcher"

UNITS=(
  "rtpi.service"
  "rtpi-startup.service"
  "rtpi-watcher.service"
  "rtpi-container-healer.service"
  "rtpi-container-healer.timer"
)

log()  { printf '[install] %s\n' "$*"; }
die()  { printf '[error]   %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------
uninstall() {
  log "Stopping and disabling units..."
  for unit in "${UNITS[@]}"; do
    systemctl disable --now "$unit" 2>/dev/null || true
  done

  log "Removing unit files..."
  for unit in "${UNITS[@]}"; do
    rm -f "${SYSTEMD_DIR}/${unit}"
  done

  systemctl daemon-reload
  log "Uninstall complete. Env files in /etc/default/ were left in place."
  exit 0
}

[ "${1:-}" = "--uninstall" ] && uninstall

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
[ "$(id -u)" -eq 0 ] || die "Must run as root (sudo)."
command -v systemctl >/dev/null || die "systemctl not found — systemd required."
command -v docker    >/dev/null || die "docker not found — install Docker first."

# Detect the user who owns the repo (for User=/Group= in units)
REPO_OWNER=$(stat -c '%U' "$REPO_DIR")
REPO_GROUP=$(stat -c '%G' "$REPO_DIR")
log "Repo: ${REPO_DIR}  Owner: ${REPO_OWNER}:${REPO_GROUP}"

# ---------------------------------------------------------------------------
# Install unit files (template paths to match this repo location)
# ---------------------------------------------------------------------------
log "Installing unit files to ${SYSTEMD_DIR}/"

for unit in "${UNITS[@]}"; do
  src="${REPO_DIR}/systemd/${unit}"
  [ -f "$src" ] || die "Source file not found: $src"

  sed \
    -e "s|User=cmndcntrl|User=${REPO_OWNER}|g" \
    -e "s|Group=cmndcntrl|Group=${REPO_GROUP}|g" \
    -e "s|WorkingDirectory=.*|WorkingDirectory=${REPO_DIR}|g" \
    -e "s|ExecStart=.*/scripts/|ExecStart=${REPO_DIR}/scripts/|g" \
    -e "s|file:///home/cmndcntrl/code/rtpi|file://${REPO_DIR}|g" \
    "$src" > "${SYSTEMD_DIR}/${unit}"

  chmod 644 "${SYSTEMD_DIR}/${unit}"
  log "  Installed ${unit}"
done

# ---------------------------------------------------------------------------
# Install env files (no-clobber — never overwrite existing config)
# ---------------------------------------------------------------------------
declare -A ENV_FILES=(
  ["/etc/default/rtpi"]="${REPO_DIR}/systemd/rtpi.env.example"
  ["/etc/default/rtpi-watcher"]="${REPO_DIR}/systemd/rtpi-watcher.env.example"
  ["/etc/default/rtpi-startup"]="${REPO_DIR}/systemd/rtpi-startup.env.example"
)

for dest in "${!ENV_FILES[@]}"; do
  src="${ENV_FILES[$dest]}"
  if [ ! -f "$dest" ] && [ -f "$src" ]; then
    cp "$src" "$dest"
    chmod 644 "$dest"
    log "  Created ${dest} from template"
  else
    log "  ${dest} already exists — skipping"
  fi
done

# ---------------------------------------------------------------------------
# Ensure scripts are executable
# ---------------------------------------------------------------------------
chmod +x "${REPO_DIR}/scripts/rtpi-dev.sh"
chmod +x "${REPO_DIR}/scripts/rtpi-watcher.sh"
chmod +x "${REPO_DIR}/scripts/container-healer.sh"
chmod +x "${REPO_DIR}/scripts/rtpi-startup.sh"

# ---------------------------------------------------------------------------
# Enable + start
# ---------------------------------------------------------------------------
systemctl daemon-reload
systemctl enable rtpi.service
systemctl enable rtpi-startup.service
systemctl enable --now rtpi-watcher.service
systemctl enable --now rtpi-container-healer.timer
log "All units enabled."
log "To start the full dev stack now:  sudo systemctl start rtpi"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
log "Status:"
for unit in "${UNITS[@]}"; do
  status=$(systemctl is-active "$unit" 2>/dev/null || echo "unknown")
  printf '  %-40s %s\n' "$unit" "$status"
done
echo ""
log "View logs:"
log "  Dev stack: journalctl -u rtpi.service -f"
log "  Startup:   journalctl -u rtpi-startup.service -e"
log "  Watcher:   journalctl -u rtpi-watcher.service -f"
log "  Healer:    journalctl -u rtpi-container-healer.service --since '1 hour ago'"
