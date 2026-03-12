# NVMe Drive Failure & Recovery Documentation

**Date:** 2026-03-06
**Status:** RESOLVED - Full recovery, no data loss
**Issue:** NVMe drive disappeared from system after filesystem corruption, successfully recovered

## Problem Summary

1. **Initial Issue:** EXT4 filesystem corruption on `/dev/nvme0n1p1` causing read-only mount
2. **Escalation:** After unmounting the NVMe partition, the entire NVMe device disappeared
3. **Driver Status:** NVMe driver loaded but device not detected
4. **Impact:** All Docker data stored on NVMe is inaccessible

## Diagnosis

```bash
# NVMe device completely missing
ls -la /dev/nvme*  # No such file or directory
lsblk               # No nvme devices listed
lsmod | grep nvme   # Driver loaded but no device
```

## Root Cause

EXT4 filesystem corruption with temporary device disappearance. The NVMe controller temporarily lost the device after unmounting the corrupted partition, but the drive reappeared after kernel module reload. The filesystem was fully recoverable via e2fsck with no errors found, indicating:
- Filesystem-level corruption (not hardware failure)
- Temporary NVMe controller state issue after forced unmount
- Drive and data remained intact throughout

## Recovery Actions Taken

### Phase 1: Emergency Shutdown ✅
- Stopped all Docker containers
- Stopped Docker daemon
- Unmounted NVMe partition

### Phase 2: NVMe Recovery Attempt ✅
- Loaded NVMe kernel module
- Device initially did not reappear
- After further attempts, device was detected again

### Phase 3: Temporary Failover to eMMC Storage ✅
- Removed NVMe from fstab (prevent boot issues)
- Reconfigured Docker to use `/var/lib/docker` on eMMC
- Restarted Docker services temporarily on eMMC

### Phase 4: Filesystem Check & Full Recovery ✅
- Ran `e2fsck -f -y /dev/nvme0n1p1` — completed with **no errors found**
  - 1,726,494 files checked and verified
  - 0.1% non-contiguous (excellent fragmentation)
  - ~92GB used of 1.8TB (5% utilization)
- Remounted NVMe: `mount /dev/nvme0n1p1 /mnt/nvme`
- Restored fstab entry: `UUID=9d7b081c-62b2-49d7-bc42-b5a4906b38c3 /mnt/nvme ext4 defaults,noatime 0 2`
- Reconfigured Docker data-root back to `/mnt/nvme/docker`
- Restarted Docker and brought up all 16 services

## Data Loss Assessment

**No data was lost.** The filesystem was fully intact after e2fsck verification.

### All Data Preserved:
- Docker overlay2 layers
- Docker container data and volumes
- Docker build cache
- Source code (in `/home/cmndcntrl/code/rtpi`)
- Database data (PostgreSQL, MongoDB, Redis volumes)
- Application configuration files

## Recovery Outcome

- **Date resolved:** 2026-03-06
- **All 16 Docker services confirmed healthy** (postgres, redis, empire, open-webui, all offsec agents, workbench stack, rtpi-tools)
- **NVMe health:** 5% utilization (~92GB of 1.8TB), 0.1% fragmentation
- **Docker data-root:** `/mnt/nvme/docker`

## Ongoing Monitoring

1. Monitor NVMe health with SMART tools: `sudo smartctl -a /dev/nvme0n1`
2. Periodic filesystem checks during maintenance windows
3. Monitor Docker disk usage: `docker system df`
4. Regular `docker system prune` to manage disk usage

## Prevention

- Implement regular backups of Docker volumes
- Monitor filesystem health with SMART tools (`smartctl`)
- Consider RAID or redundant storage for critical data
- Regular `docker system prune` to manage disk usage

## If This Happens Again

1. Stop Docker: `sudo systemctl stop docker`
2. Unmount: `sudo umount /mnt/nvme`
3. Check filesystem: `sudo e2fsck -f -y /dev/nvme0n1p1`
4. If device disappears: `sudo modprobe -r nvme && sudo modprobe nvme` to reload driver
5. Remount and restart Docker
6. Bring up services: `docker compose up -d`
