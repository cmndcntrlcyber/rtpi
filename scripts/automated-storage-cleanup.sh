#!/bin/bash
# RTPI Automated Storage Cleanup Script
# Runs bi-weekly via cron
# Safe cleanup - DOES NOT delete wordlists or RKLLama models

set -e

# Logging
LOG_DIR="/home/cmndcntrl/code/rtpi/logs"
LOG_FILE="${LOG_DIR}/storage-cleanup-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOG_DIR"

# Redirect all output to log file
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=============================================="
echo "RTPI Automated Storage Cleanup"
echo "Date: $(date)"
echo "=============================================="
echo ""

# Function to check available space
check_space() {
    df -h / | tail -1 | awk '{print "Available: " $4 " (" $5 " used)"}'
}

echo "📊 Initial disk usage:"
check_space
echo ""

# 1. Clean Docker build cache
echo "🧹 Cleaning Docker build cache..."
docker builder prune -af 2>&1 | grep -i "total reclaimed" || echo "Build cache cleaned"
echo ""

# 2. Remove stopped containers
echo "🧹 Removing stopped containers..."
docker container prune -f 2>&1 | grep -i "total reclaimed" || echo "No stopped containers to remove"
echo ""

# 3. Remove dangling images
echo "🧹 Removing dangling Docker images..."
docker image prune -f 2>&1 | grep -i "total reclaimed" || echo "No dangling images to remove"
echo ""

# 4. Remove unused Docker networks
echo "🧹 Cleaning unused Docker networks..."
docker network prune -f 2>&1 || echo "Networks cleaned"
echo ""

# 5. Clean npm cache (safe, rebuilds automatically)
echo "🧹 Cleaning npm cache..."
npm cache clean --force 2>&1 || echo "npm cache cleaned"
echo ""

# NOTE: Explicitly SKIPPING:
# - Wordlists volumes (rtpi_fuzzing-wordlists)
# - RKLLama models
# - Any other Docker volumes
# - Docker images (user may need them)

echo "⚠️  PRESERVED (not cleaned):"
echo "   ✓ Wordlist volumes (rtpi_fuzzing-wordlists)"
echo "   ✓ RKLLama models"
echo "   ✓ Docker volumes (databases, persistent data)"
echo "   ✓ Docker images (may be needed for operations)"
echo ""

# Final disk usage
echo "=============================================="
echo "✅ Cleanup complete!"
echo ""
echo "📊 Final disk usage:"
check_space
echo ""

# Show Docker resource usage
echo "📦 Docker resource usage:"
docker system df 2>&1 || echo "Docker system df unavailable"
echo ""

# Cleanup old log files (keep last 30 days)
echo "🗑️  Cleaning old log files (>30 days)..."
find "$LOG_DIR" -name "storage-cleanup-*.log" -mtime +30 -delete 2>/dev/null || echo "Old logs cleaned"
echo ""

echo "=============================================="
echo "Log saved to: $LOG_FILE"
echo "=============================================="
