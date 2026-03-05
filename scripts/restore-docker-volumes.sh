#!/bin/bash
# RTPI Docker Volume Restoration Script
# Restores volumes from /var/lib/docker.bak to /mnt/nvme/docker
# Generated: 2026-02-22

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=============================================="
echo "RTPI Docker Volume Restoration"
echo "=============================================="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}ERROR: Must run as root (sudo)${NC}"
   exit 1
fi

SOURCE_DIR="/var/lib/docker.bak/volumes"
DEST_DIR="/mnt/nvme/docker/volumes"

echo -e "${YELLOW}Step 1: Stopping Docker services...${NC}"
systemctl stop docker docker.socket containerd 2>/dev/null || true
sleep 3

if systemctl is-active --quiet docker; then
    echo -e "${RED}ERROR: Docker is still running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker stopped${NC}"
echo ""

echo -e "${YELLOW}Step 2: Verifying source volumes exist...${NC}"
VOLUME_COUNT=$(find "$SOURCE_DIR" -maxdepth 1 -name "rtpi_*" -type d | wc -l)
echo -e "${GREEN}✓ Found $VOLUME_COUNT RTPI volumes to restore${NC}"
echo ""

echo -e "${YELLOW}Step 3: Restoring volumes...${NC}"
echo "This may take 5-10 minutes depending on volume sizes..."
echo ""

# Copy each rtpi_* volume
for volume in "$SOURCE_DIR"/rtpi_*; do
    if [ -d "$volume" ]; then
        volume_name=$(basename "$volume")
        echo -n "  Restoring $volume_name... "
        
        # Create destination if it doesn't exist
        mkdir -p "$DEST_DIR/$volume_name"
        
        # Copy with rsync to preserve permissions and show progress
        rsync -a --info=progress2 "$volume/" "$DEST_DIR/$volume_name/" 2>&1 | tail -1
        
        echo -e "${GREEN}✓${NC}"
    fi
done

echo ""
echo -e "${GREEN}✓ All volumes restored${NC}"
echo ""

echo -e "${YELLOW}Step 4: Verifying restored volumes...${NC}"
RESTORED_COUNT=$(find "$DEST_DIR" -maxdepth 1 -name "rtpi_*" -type d | wc -l)
echo -e "${GREEN}✓ $RESTORED_COUNT volumes now in $DEST_DIR${NC}"
echo ""

echo -e "${YELLOW}Step 5: Starting Docker...${NC}"
systemctl start docker
sleep 5

if systemctl is-active --quiet docker; then
    echo -e "${GREEN}✓ Docker started successfully${NC}"
else
    echo -e "${RED}ERROR: Docker failed to start${NC}"
    echo "Check logs: journalctl -xeu docker"
    exit 1
fi
echo ""

echo "=============================================="
echo -e "${GREEN}Volume Restoration Complete!${NC}"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. cd /home/cmndcntrl/code/rtpi"
echo "  2. docker compose up -d"
echo "  3. docker compose ps    # verify all services"
echo ""
echo "Storage usage:"
df -h /mnt/nvme
echo ""
