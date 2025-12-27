#!/bin/bash
#
# Firefox Workspace Custom Startup Script
# Launches Firefox with security testing configuration
#

set -e

echo "Starting Firefox workspace..."

# Wait for desktop environment
sleep 2

# Firefox will auto-start via Kasm default configuration

echo "Firefox workspace ready!"
echo "Recommended extensions for security testing:"
echo "  - FoxyProxy (proxy management)"
echo "  - Wappalyzer (technology detection)"
echo "  - Cookie-Editor (cookie manipulation)"
echo "  - User-Agent Switcher (UA spoofing)"
echo "  - HackBar (web testing toolbar)"
