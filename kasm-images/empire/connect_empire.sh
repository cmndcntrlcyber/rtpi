#!/bin/bash
#
# Empire C2 Connection Script
# Connects to RTPI Empire server
#

set -e

EMPIRE_HOST="${EMPIRE_HOST:-empire-server}"
EMPIRE_PORT="${EMPIRE_PORT:-1337}"
EMPIRE_USER="${EMPIRE_USER:-empireadmin}"
EMPIRE_PASS="${EMPIRE_PASSWORD}"

echo "========================================="
echo "  PowerShell Empire Client"
echo "========================================="
echo ""
echo "Connecting to: ${EMPIRE_HOST}:${EMPIRE_PORT}"
echo "Username: ${EMPIRE_USER}"
echo ""

# Check if Empire server is reachable
if ! nc -z "$EMPIRE_HOST" "$EMPIRE_PORT" 2>/dev/null; then
    echo "ERROR: Cannot reach Empire server at ${EMPIRE_HOST}:${EMPIRE_PORT}"
    echo "Please ensure the Empire server is running"
    exit 1
fi

# Launch Empire client
cd /opt/Empire
python3 empire \
    --rest \
    --rest-ip "$EMPIRE_HOST" \
    --rest-port "$EMPIRE_PORT" \
    --username "$EMPIRE_USER" \
    --password "$EMPIRE_PASS"
