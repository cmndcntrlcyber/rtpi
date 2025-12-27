#!/bin/bash
#
# Empire Workspace Custom Startup Script
# Displays connection information
#

set -e

echo "Starting Empire client workspace..."

# Wait for desktop environment
sleep 3

# Display welcome message
echo "=========================================" > /home/kasm-user/WELCOME.txt
echo "  PowerShell Empire Client Workspace" >> /home/kasm-user/WELCOME.txt
echo "=========================================" >> /home/kasm-user/WELCOME.txt
echo "" >> /home/kasm-user/WELCOME.txt
echo "To connect to Empire server:" >> /home/kasm-user/WELCOME.txt
echo "  $ connect-empire" >> /home/kasm-user/WELCOME.txt
echo "" >> /home/kasm-user/WELCOME.txt
echo "Or use the desktop shortcut:" >> /home/kasm-user/WELCOME.txt
echo "  - Double-click 'Empire Client' on desktop" >> /home/kasm-user/WELCOME.txt
echo "" >> /home/kasm-user/WELCOME.txt
echo "Empire Commands Quick Reference:" >> /home/kasm-user/WELCOME.txt
echo "  listeners              - List active listeners" >> /home/kasm-user/WELCOME.txt
echo "  agents                 - List active agents" >> /home/kasm-user/WELCOME.txt
echo "  uselistener <name>     - Configure a listener" >> /home/kasm-user/WELCOME.txt
echo "  usestager <name>       - Generate a stager" >> /home/kasm-user/WELCOME.txt
echo "  interact <agent>       - Interact with an agent" >> /home/kasm-user/WELCOME.txt
echo "" >> /home/kasm-user/WELCOME.txt
echo "Directories:" >> /home/kasm-user/WELCOME.txt
echo "  - /home/kasm-user/workspace - Working directory" >> /home/kasm-user/WELCOME.txt
echo "  - /home/kasm-user/loot - Captured data" >> /home/kasm-user/WELCOME.txt
echo "  - /home/kasm-user/stagers - Generated stagers" >> /home/kasm-user/WELCOME.txt
echo "" >> /home/kasm-user/WELCOME.txt

cat /home/kasm-user/WELCOME.txt

echo "Empire client workspace ready!"
