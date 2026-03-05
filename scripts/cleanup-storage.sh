#!/bin/bash
# RTPI Storage Cleanup Script
# Generated: 2026-02-17
# This script provides safe cleanup commands for freeing up storage space

set -e

echo "=============================================="
echo "RTPI Storage Cleanup Utility"
echo "=============================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to show space saved
show_space() {
    df -h / | tail -1 | awk '{print "Available: " $4 " (" $5 " used)"}'
}

echo "Current disk usage:"
show_space
echo ""

# Phase 1: Safe Docker cleanup (already completed - kept for reference)
echo -e "${GREEN}Phase 1: Docker Build Cache Cleanup${NC}"
echo "This removes unused Docker build cache layers..."
echo "Command: docker builder prune -af"
echo "Expected savings: ~72GB"
echo "Status: ✓ Already executed"
echo ""

# Phase 2: Remove stopped containers
echo -e "${GREEN}Phase 2: Remove Stopped Containers${NC}"
read -p "Remove all stopped containers? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing stopped containers..."
    docker container prune -f
    echo "✓ Done"
fi
echo ""

# Phase 3: Remove dangling images
echo -e "${GREEN}Phase 3: Remove Dangling/Unused Images${NC}"
read -p "Remove dangling Docker images? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing dangling images..."
    docker image prune -f
    echo "✓ Done"
fi
echo ""

# Phase 4: Remove old Docker images
echo -e "${YELLOW}Phase 4: Remove Old/Unused Images (30+ days)${NC}"
echo "This removes images not used in the last 30 days..."
read -p "Proceed? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing old images..."
    docker image prune -a --filter "until=720h" -f
    echo "✓ Done"
fi
echo ""

# Phase 5: Clean npm cache
echo -e "${GREEN}Phase 5: Clean npm Cache${NC}"
read -p "Clean npm cache? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleaning npm cache..."
    npm cache clean --force
    echo "✓ Done"
fi
echo ""

# Phase 6: Remove unused Docker networks
echo -e "${GREEN}Phase 6: Clean Docker Networks${NC}"
read -p "Remove unused Docker networks? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing unused networks..."
    docker network prune -f
    echo "✓ Done"
fi
echo ""

# Phase 7: Optional - Remove <none> tagged images
echo -e "${YELLOW}Phase 7: Remove Untagged Images${NC}"
echo "Found $(docker images -f "dangling=true" -q | wc -l) untagged images"
read -p "Remove untagged (<none>) images? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing untagged images..."
    docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || echo "No untagged images to remove"
    echo "✓ Done"
fi
echo ""

# Phase 8: High-risk cleanup (commented out for safety)
echo -e "${RED}=== HIGH-RISK CLEANUP OPTIONS (Disabled) ===${NC}"
echo "The following commands can free more space but may cause data loss:"
echo ""
echo "# Remove ALL unused volumes (includes databases!):"
echo "# docker volume prune -a"
echo ""
echo "# Remove ALL unused images:"
echo "# docker image prune -a"
echo ""
echo "# Complete Docker system cleanup:"
echo "# docker system prune -a --volumes"
echo ""
echo "To run these, execute them manually after backing up important data."
echo ""

# Final report
echo "=============================================="
echo "Cleanup complete!"
echo ""
echo "Final disk usage:"
show_space
echo ""
echo "Additional manual cleanup options:"
echo "1. Review large volumes: docker volume ls"
echo "2. Check specific volume size: docker volume inspect <volume_name>"
echo "3. Remove specific unused volume: docker volume rm <volume_name>"
echo "4. Clean old wordlists: Review rtpi_fuzzing-wordlists (6.9GB)"
echo "5. Clean rkllama models: Check ~/.rkllama/models/ (4.7GB in project)"
echo ""
echo "=============================================="
