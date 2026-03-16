# Container Rebuild Required for v2.4.4

**Date:** 2026-03-15  
**Reason:** Added x86_64 cross-compilation binutils for pwntools

---

## Changes Made

Updated `docker/offsec-agents/Dockerfile.maldev-tools` to include:

```dockerfile
# Cross-compilation support (ARM64 and x86_64)
gcc-aarch64-linux-gnu g++-aarch64-linux-gnu \
binutils-x86-64-linux-gnu \    # NEW
binutils-i686-linux-gnu \      # NEW
```

This enables pwntools to assemble x86/x64 shellcode on ARM64 hosts.

---

## Rebuild Instructions

```bash
# Stop the container
docker compose stop offsec-maldev

# Rebuild the image
docker compose build offsec-maldev

# Start the container
docker compose up -d offsec-maldev

# Verify tools are available
docker exec rtpi-maldev-agent python3 -c "from pwn import *; context.arch='amd64'; print('x86_64 binutils:', which('x86_64-linux-gnu-as'))"
```

---

## Verification

After rebuild, test shellcode assembly:

```bash
npx tsx scripts/test-maldev-tools.ts
```

Expected result: "✅ Shellcode generated successfully"

---

## Impact

**Before:** pwntools could only generate templates, not assemble them  
**After:** Full shellcode generation + assembly on ARM64 hosts  
**Benefit:** Complete tool-assisted exploit development pipeline

---

**Status:** PENDING REBUILD
