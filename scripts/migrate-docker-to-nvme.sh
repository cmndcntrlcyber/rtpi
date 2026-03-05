#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Migrate Docker storage to NVMe drive (nvme0n1)
# Run as root: sudo bash scripts/migrate-docker-to-nvme.sh
#
# Safe to re-run: each step checks for completion before executing.
# ============================================================================

NVME_DEV="/dev/nvme0n1"
NVME_PART="${NVME_DEV}p1"
MOUNT_POINT="/mnt/nvme"
DOCKER_NEW_ROOT="${MOUNT_POINT}/docker"
DAEMON_JSON="/etc/docker/daemon.json"

# --- Helpers ----------------------------------------------------------------

step_skip() { echo "    [SKIP] $1"; }
step_done() { echo "    [DONE] $1"; }
step_fail() { echo "    [FAIL] $1" >&2; exit 1; }

trap 'echo ""; echo "ERROR: Script failed at line $LINENO (exit $?)." >&2' ERR

# --- Pre-flight -------------------------------------------------------------

echo "=== RTPI: Migrate Docker to NVMe ==="
echo "Device:      $NVME_DEV"
echo "Partition:   $NVME_PART"
echo "Mount:       $MOUNT_POINT"
echo "Docker root: $DOCKER_NEW_ROOT"
echo ""

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: Must run as root (sudo)"
  exit 1
fi

if [[ ! -b "$NVME_DEV" ]]; then
  echo "ERROR: $NVME_DEV not found"
  exit 1
fi

# ============================================================================
# Step 1: Partition and format
# ============================================================================
echo ">>> Step 1: Partition and format $NVME_DEV"

if [[ -b "$NVME_PART" ]]; then
  PART_FS=$(blkid -o value -s TYPE "$NVME_PART" 2>/dev/null || true)
  if [[ "$PART_FS" == "ext4" ]]; then
    step_skip "Partition $NVME_PART already exists with ext4 filesystem"
  elif [[ -n "$PART_FS" ]]; then
    step_fail "Partition $NVME_PART exists but has filesystem '$PART_FS' (expected ext4). Refusing to reformat."
  else
    echo "    Partition exists but has no filesystem. Formatting as ext4..."
    mkfs.ext4 -L rtpi-data "$NVME_PART"
    step_done "Formatted $NVME_PART as ext4"
  fi
else
  echo "    Partitioning $NVME_DEV with GPT..."
  parted -s "$NVME_DEV" mklabel gpt
  parted -s "$NVME_DEV" mkpart primary ext4 0% 100%
  # Wait for partition device to appear
  sleep 2
  if [[ ! -b "$NVME_PART" ]]; then
    partprobe "$NVME_DEV" 2>/dev/null || true
    sleep 2
  fi
  if [[ ! -b "$NVME_PART" ]]; then
    step_fail "Partition $NVME_PART did not appear after partitioning"
  fi
  echo "    Formatting $NVME_PART as ext4..."
  mkfs.ext4 -L rtpi-data "$NVME_PART"
  step_done "Partitioned and formatted $NVME_PART"
fi

# ============================================================================
# Step 2: Mount
# ============================================================================
echo ">>> Step 2: Mount $NVME_PART at $MOUNT_POINT"

if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
  # Verify it's the right device
  MOUNTED_DEV=$(findmnt -n -o SOURCE "$MOUNT_POINT" 2>/dev/null || true)
  if [[ "$MOUNTED_DEV" == "$NVME_PART" ]]; then
    step_skip "$NVME_PART already mounted at $MOUNT_POINT"
  else
    step_fail "$MOUNT_POINT is mounted but from '$MOUNTED_DEV' (expected $NVME_PART)"
  fi
else
  # Check if the partition is mounted somewhere else
  ELSEWHERE=$(findmnt -n -o TARGET "$NVME_PART" 2>/dev/null || true)
  if [[ -n "$ELSEWHERE" ]]; then
    step_fail "$NVME_PART is mounted at '$ELSEWHERE' instead of $MOUNT_POINT. Unmount it first."
  fi
  mkdir -p "$MOUNT_POINT"
  mount "$NVME_PART" "$MOUNT_POINT"
  if mountpoint -q "$MOUNT_POINT"; then
    step_done "Mounted $NVME_PART at $MOUNT_POINT"
  else
    step_fail "Mount command succeeded but $MOUNT_POINT is not a mountpoint"
  fi
fi

# ============================================================================
# Step 3: Add to fstab (idempotent)
# ============================================================================
echo ">>> Step 3: Persistent mount in /etc/fstab"

NVME_UUID=$(blkid -s UUID -o value "$NVME_PART")
if [[ -z "$NVME_UUID" ]]; then
  step_fail "Could not determine UUID for $NVME_PART"
fi

if grep -q "$NVME_UUID" /etc/fstab; then
  step_skip "UUID=$NVME_UUID already in fstab"
else
  echo "UUID=$NVME_UUID $MOUNT_POINT ext4 defaults,noatime 0 2" >> /etc/fstab
  step_done "Added UUID=$NVME_UUID to fstab"
fi

# ============================================================================
# Step 4: Stop Docker
# ============================================================================
echo ">>> Step 4: Stop Docker"

# Check if Docker is already using the NVMe root
CURRENT_ROOT=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)
if [[ "$CURRENT_ROOT" == "$DOCKER_NEW_ROOT" ]]; then
  step_skip "Docker is already running with data-root=$DOCKER_NEW_ROOT"
  DOCKER_ALREADY_MIGRATED=true
else
  DOCKER_ALREADY_MIGRATED=false
  if systemctl is-active --quiet docker 2>/dev/null; then
    systemctl stop docker docker.socket containerd 2>/dev/null || true
    sleep 2
    if systemctl is-active --quiet docker 2>/dev/null; then
      step_fail "Docker is still running after stop attempt"
    fi
    step_done "Docker stopped"
  else
    step_skip "Docker is already stopped"
  fi
fi

# ============================================================================
# Step 5: Migrate Docker data
# ============================================================================
echo ">>> Step 5: Migrate /var/lib/docker -> $DOCKER_NEW_ROOT"

if [[ "$DOCKER_ALREADY_MIGRATED" == "true" ]]; then
  step_skip "Docker already running on NVMe, no migration needed"
elif [[ -d "$DOCKER_NEW_ROOT/overlay2" ]] || [[ -d "$DOCKER_NEW_ROOT/image" ]]; then
  DATA_SIZE=$(du -sh "$DOCKER_NEW_ROOT" 2>/dev/null | cut -f1 || echo "unknown")
  step_skip "Docker data already exists at $DOCKER_NEW_ROOT ($DATA_SIZE)"
else
  if [[ -d /var/lib/docker ]] && [[ "$(ls -A /var/lib/docker 2>/dev/null)" ]]; then
    echo "    Copying data (this may take a while)..."
    mkdir -p "$DOCKER_NEW_ROOT"
    rsync -aHAXx --info=progress2 /var/lib/docker/ "$DOCKER_NEW_ROOT/"
    step_done "Data migrated to $DOCKER_NEW_ROOT"
  else
    echo "    No existing Docker data at /var/lib/docker"
    mkdir -p "$DOCKER_NEW_ROOT"
    step_done "Created empty $DOCKER_NEW_ROOT"
  fi
fi

# ============================================================================
# Step 6: Update daemon.json
# ============================================================================
echo ">>> Step 6: Update $DAEMON_JSON"

if [[ -f "$DAEMON_JSON" ]] && grep -q "\"data-root\": \"$DOCKER_NEW_ROOT\"" "$DAEMON_JSON"; then
  step_skip "$DAEMON_JSON already configured with data-root=$DOCKER_NEW_ROOT"
else
  cat > "$DAEMON_JSON" <<'DAEMON_EOF'
{
  "data-root": "/mnt/nvme/docker",
  "storage-driver": "overlay2",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65536,
      "Soft": 65536
    }
  }
}
DAEMON_EOF
  step_done "Wrote $DAEMON_JSON"
fi

# ============================================================================
# Step 7: Backup old Docker dir and restart
# ============================================================================
echo ">>> Step 7: Backup old Docker dir and start Docker"

if [[ "$DOCKER_ALREADY_MIGRATED" == "true" ]]; then
  step_skip "Docker already running on NVMe"
else
  # Backup old Docker directory
  if [[ -d /var/lib/docker.bak ]]; then
    step_skip "Backup /var/lib/docker.bak already exists"
  elif [[ -d /var/lib/docker ]] && [[ "$(ls -A /var/lib/docker 2>/dev/null)" ]]; then
    mv /var/lib/docker /var/lib/docker.bak
    step_done "Moved /var/lib/docker -> /var/lib/docker.bak"
  else
    step_skip "No /var/lib/docker to back up"
  fi

  # Start Docker
  echo "    Starting Docker..."
  systemctl start docker
  sleep 3
  if systemctl is-active --quiet docker; then
    step_done "Docker started successfully"
  else
    step_fail "Docker failed to start. Check: journalctl -xeu docker"
  fi
fi

# ============================================================================
# Step 8: Verify
# ============================================================================
echo ""
echo "=== Verification ==="

VERIFY_ROOT=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo "UNKNOWN")
echo "Docker Root Dir: $VERIFY_ROOT"

if [[ "$VERIFY_ROOT" == "$DOCKER_NEW_ROOT" ]]; then
  echo "    [PASS] Docker is using NVMe storage"
else
  echo "    [WARN] Expected $DOCKER_NEW_ROOT but got $VERIFY_ROOT"
fi

echo ""
echo "NVMe usage:"
df -h "$MOUNT_POINT"
echo ""
echo "lsblk:"
lsblk "$NVME_DEV"
echo ""
echo "=== Migration complete! ==="
echo ""
echo "Next steps:"
echo "  1. cd /home/cmndcntrl/code/rtpi && docker compose up -d"
echo "  2. docker compose ps   # verify all services"
echo "  3. Once confirmed working, remove backup: sudo rm -rf /var/lib/docker.bak"
