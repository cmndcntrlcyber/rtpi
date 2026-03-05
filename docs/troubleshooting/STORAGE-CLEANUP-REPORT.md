# RTPI Storage Cleanup Report
**Date:** 2026-02-17  
**System:** Orange Pi 5 Plus (230GB Storage)

---

## 📊 Results Summary

### Before Cleanup
- **Total Storage:** 230GB
- **Used:** 191GB (87%)
- **Available:** 30GB

### After Cleanup
- **Total Storage:** 230GB
- **Used:** 184GB (84%)
- **Available:** 37GB ✅
- **Space Freed:** ~7GB

---

## 🔍 Storage Analysis Findings

### Major Consumers Identified

| Component | Size | Status |
|-----------|------|--------|
| **Docker Build Cache** | 72.5GB | ✅ Cleaned (~9GB freed) |
| Docker Images | 76GB | 60.5GB reclaimable |
| Docker Volumes | 18.5GB | 4.2GB reclaimable |
| rkllama directory | 4.7GB | Active (models) |
| node_modules | 511MB | Active |
| uploads directory | 14MB | Active |

### Top Docker Images by Size

1. rtpi/fuzzing-tools: 14.1GB
2. rtpi/burp-tools: 13.4GB
3. rtpi/azure-ad-tools: 7.36GB
4. rtpi/empire-tools: 7.59GB
5. rtpi/research-tools: 7.27GB
6. rtpi/framework-tools: 6.88GB
7. rtpi/maldev-tools: 6.82GB

### Top Docker Volumes by Size

1. rtpi_fuzzing-wordlists: 6.9GB
2. ollama_data: 2.5GB
3. open-webui-data: 2.0GB
4. kasm_db: 981MB

---

## ✅ Cleanup Actions Completed

1. ✅ **Docker Build Cache Cleanup**
   - Command: `docker builder prune -af`
   - Space freed: ~9GB
   - Status: Complete

2. ✅ **Removed Stopped Containers**
   - Command: `docker container prune -f`
   - Status: Complete (none found)

3. ✅ **Cleaned Docker Networks**
   - Command: `docker network prune -f`
   - Status: Complete

4. ✅ **Cleaned npm Cache**
   - Command: `npm cache clean --force`
   - Status: Complete

---

## 💡 Additional Cleanup Recommendations

### Quick Wins (Safe)

#### 1. Remove Dangling Images
```bash
docker image prune -f
```
Expected savings: Minimal

#### 2. Remove Old Docker Images (30+ days)
```bash
docker image prune -a --filter "until=720h"
```
Expected savings: Variable, depends on rebuild patterns

### Moderate Options (Review First)

#### 3. Remove Unused Docker Volumes
⚠️ **WARNING:** May include databases and persistent data
```bash
# Review volumes first
docker volume ls

# Remove specific unused volumes
docker volume rm <volume_name>
```

#### 4. Clean Up Fuzzing Wordlists (6.9GB)
```bash
# Review and remove unnecessary wordlists
docker volume inspect rtpi_fuzzing-wordlists
# If not needed, remove:
docker volume rm rtpi_fuzzing-wordlists
```

#### 5. Review RKLLama Models (4.7GB)
```bash
# Check installed models
rkllama_client list

# Remove unused models
rkllama_client remove <model-name>
```

### Aggressive Options (High Risk)

⚠️ **DATA LOSS WARNING** - Only use with backups

#### Remove ALL Unused Docker Resources
```bash
# Complete cleanup (removes volumes, images, everything unused)
docker compose down
docker system prune -a --volumes
```

---

## 🛠️ Tools Created

### 1. Automated Cleanup Script (Bi-weekly Cron Job)
**Location:** `/home/cmndcntrl/code/rtpi/scripts/automated-storage-cleanup.sh`  
**Schedule:** Every 2 weeks on Sunday at 3:00 AM  
**Logs:** `/home/cmndcntrl/code/rtpi/logs/storage-cleanup-*.log`

**What it cleans:**
- Docker build cache
- Stopped containers
- Dangling images
- Unused networks
- npm cache

**What it preserves:**
- ✅ Wordlist volumes (rtpi_fuzzing-wordlists)
- ✅ RKLLama models
- ✅ Docker volumes (databases, persistent data)
- ✅ Docker images (may be needed for operations)

**Manual run:**
```bash
/home/cmndcntrl/code/rtpi/scripts/automated-storage-cleanup.sh
```

**View cron schedule:**
```bash
crontab -l
```

### 2. Interactive Cleanup Script
**Location:** `/home/cmndcntrl/code/rtpi/cleanup-storage.sh`

**Usage:**
```bash
cd /home/cmndcntrl/code/rtpi
./cleanup-storage.sh
```

This interactive script guides you through safe cleanup options with confirmations.

---

## 📈 Current Docker Resource Usage

```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          40        32        75.92GB   60.51GB (79%)
Containers      33        32        5.914GB   0B (0%)
Local Volumes   69        29        18.54GB   4.15GB (22%)
Build Cache     477       0         63.26GB   13.76GB (21%)
```

### Key Insights:
- **79% of Docker images are reclaimable** (60.5GB)
- Most containers are actively running
- Build cache has additional 13.76GB that can be cleaned

---

## 🚀 Next Steps

### Immediate (If More Space Needed)
1. Run `docker image prune -a` to remove unused images (potentially 60GB)
2. Review and remove unused Docker volumes (potential 4GB)

### Automated Maintenance
✅ **Bi-weekly automated cleanup is now active!**
- **Schedule:** Every 2 weeks on Sunday at 3:00 AM
- **Script:** `/home/cmndcntrl/code/rtpi/scripts/automated-storage-cleanup.sh`
- **Logs:** `/home/cmndcntrl/code/rtpi/logs/storage-cleanup-*.log`
- **Protected:** Wordlists and RKLLama models are preserved

### Manual Maintenance
1. Run `./cleanup-storage.sh` for interactive cleanup
2. Monitor with: `docker system df`
3. Review large volumes: `docker volume ls`
4. Automated cleanup handles: Build cache, stopped containers, dangling images, npm cache

### Long-term Considerations
1. Consider external storage for:
   - Fuzzing wordlists (6.9GB)
   - LLM models (moving to S3/R2)
   - Archive old operation data
2. Implement automated cleanup jobs
3. Monitor disk usage with alerts (85% threshold)

---

## 📋 Quick Reference Commands

### Check Disk Usage
```bash
df -h
docker system df
docker system df -v  # Detailed view
```

### Safe Cleanup
```bash
docker builder prune -af    # Clean build cache
docker container prune -f   # Remove stopped containers
docker image prune -f       # Remove dangling images
docker network prune -f     # Remove unused networks
npm cache clean --force     # Clean npm cache
```

### Find Large Files
```bash
du -sh /home/cmndcntrl/code/rtpi/* | sort -hr | head -20
```

### Docker Volume Management
```bash
docker volume ls                              # List volumes
docker volume inspect <volume_name>           # Inspect volume
docker system df -v                           # Show volume sizes
docker volume rm <volume_name>                # Remove volume
```

---

## 📌 Notes

- The RTPI application uses multiple Docker profiles (kasm, gpu, cpu, etc.)
- Not all images may be in active use depending on which profiles are enabled
- RKLLama runs as systemd service, not in Docker
- Database volumes should NOT be removed without proper backups

---

**Generated by:** Cline Storage Troubleshooting Assistant  
**Script Location:** `/home/cmndcntrl/code/rtpi/cleanup-storage.sh`
