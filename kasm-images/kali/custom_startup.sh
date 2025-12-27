#!/bin/bash
#
# Kali Linux Workspace Custom Startup Script
# Initializes pentesting environment
#

set -e

echo "Starting Kali Linux workspace..."

# Wait for desktop environment
sleep 3

# Start Tor service for proxychains (if needed)
# tor &

# Display welcome message
echo "========================================" > /home/kasm-user/WELCOME.txt
echo "  Kali Linux Pentesting Workspace" >> /home/kasm-user/WELCOME.txt
echo "========================================" >> /home/kasm-user/WELCOME.txt
echo "" >> /home/kasm-user/WELCOME.txt
echo "Available Tools:" >> /home/kasm-user/WELCOME.txt
echo "  - Metasploit Framework (msfconsole)" >> /home/kasm-user/WELCOME.txt
echo "  - Burp Suite (burpsuite)" >> /home/kasm-user/WELCOME.txt
echo "  - Nmap (nmap)" >> /home/kasm-user/WELCOME.txt
echo "  - Wireshark (wireshark)" >> /home/kasm-user/WELCOME.txt
echo "  - SQLMap (sqlmap)" >> /home/kasm-user/WELCOME.txt
echo "  - Hydra (hydra)" >> /home/kasm-user/WELCOME.txt
echo "  - John the Ripper (john)" >> /home/kasm-user/WELCOME.txt
echo "" >> /home/kasm-user/WELCOME.txt
echo "Directories:" >> /home/kasm-user/WELCOME.txt
echo "  - /home/kasm-user/workspace - Your working directory" >> /home/kasm-user/WELCOME.txt
echo "  - /home/kasm-user/loot - Store captured data" >> /home/kasm-user/WELCOME.txt
echo "  - /home/kasm-user/exploits - Custom exploits" >> /home/kasm-user/WELCOME.txt
echo "  - /usr/share/wordlists - Password lists" >> /home/kasm-user/WELCOME.txt
echo "" >> /home/kasm-user/WELCOME.txt

# Display welcome message in terminal
if [ -f /home/kasm-user/WELCOME.txt ]; then
    cat /home/kasm-user/WELCOME.txt
fi

echo "Kali Linux workspace ready!"
