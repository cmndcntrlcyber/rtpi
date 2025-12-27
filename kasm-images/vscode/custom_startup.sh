#!/bin/bash
#
# VS Code Workspace Custom Startup Script
# Automatically launches VS Code on workspace start
#

set -e

echo "Starting VS Code workspace..."

# Wait for desktop environment to be ready
sleep 3

# Launch VS Code in workspace directory
/usr/share/code/code --no-sandbox --user-data-dir=/home/kasm-user/.vscode /home/kasm-user/workspace &

echo "VS Code workspace ready!"
