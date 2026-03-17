#!/bin/bash
#
# BurpSuite Professional Workspace Startup Script
# Launched automatically when the Kasm workspace starts
#

set -e

echo "[BurpSuite Workspace] Starting..."

# Wait for desktop environment to be ready
sleep 2

# Set up license if mounted
if [ -f /opt/burp-setup/burpsuite.license ]; then
    mkdir -p /home/kasm-user/.BurpSuite
    cp /opt/burp-setup/burpsuite.license /home/kasm-user/.BurpSuite/burpsuite.license
    echo "[BurpSuite Workspace] License file installed"
fi

# Auto-launch BurpSuite if BURP_AUTOSTART is set
if [ "${BURP_AUTOSTART:-false}" = "true" ]; then
    echo "[BurpSuite Workspace] Auto-launching BurpSuite..."
    /opt/BurpSuitePro/BurpSuitePro \
        --project-dir=/home/kasm-user/burp-projects \
        &
fi

echo "[BurpSuite Workspace] Ready"
echo "  Launch: Double-click 'BurpSuite Pro' on desktop"
echo "  Projects: /home/kasm-user/burp-projects"
echo "  Extensions: /home/kasm-user/extensions"
