# OffSec Agent Containers Build Failure Troubleshooting

**Date Created**: 2026-02-27  
**Status**: Active Troubleshooting Guide  
**Severity**: ⚠️ Common - Expected on first deployment

---

## 📋 Quick Reference

| **Problem** | **Root Cause** | **Quick Fix** | **Time Required** |
|-------------|---------------|---------------|-------------------|
| Build fails with `rtpi/offsec-base:latest: failed to resolve` | Base image not built | Build base image first | 30-45 minutes |
| All OffSec agents fail simultaneously | Missing base image dependency | Skip OffSec agents or build base | 2 minutes (skip) |
| Pull access denied errors | Docker trying to pull from Hub | Build locally with correct profile | 30-45 minutes |

---

## 🔍 Problem Description

### Error Message
```
ERROR [offsec-burp internal] load metadata for docker.io/rtpi/offsec-base:latest:
------
 > [offsec-burp internal] load metadata for docker.io/rtpi/offsec-base:latest:
------
Dockerfile.framework-tools:9
--------------------
   7 |     # MITRE ATT&CK Tactics: Reconnaissance (TA0043), Initial Access (TA0001)
   8 |     
   9 | >>> FROM rtpi/offsec-base:latest
  10 |     
  11 |     # Set agent type for MCP server
--------------------
failed to solve: rtpi/offsec-base:latest: failed to resolve source metadata for 
docker.io/rtpi/offsec-base:latest: pull access denied, repository does not exist 
or may require authorization: server message: insufficient_scope: authorization failed
```

### What Happened

When running `docker compose up -d --build`, Docker Compose attempted to build **all** services, including the OffSec Agent containers (maldev, azure-ad, burp, empire, fuzzing, framework, research). These containers have a critical dependency:

```dockerfile
FROM rtpi/offsec-base:latest
```

**The Problem**: The base image doesn't exist yet because:
1. It requires a special Docker Compose profile (`build-only`) to build
2. It takes 30-45 minutes to build (Ubuntu 22.04 + Node.js + Python + Rust + Go + JDK)
3. It's ~4GB in size
4. Docker tried to pull it from Docker Hub (where it doesn't exist as a public image)

---

## 🎯 Three Deployment Options

### Option 1: Skip OffSec Agents (RECOMMENDED for Quick Start)

**Time**: 2 minutes  
**Best For**: Development, testing core features, getting started quickly

```bash
# Start only core services (excludes OffSec agents)
cd /home/cmndcntrl/code/rtpi
sudo docker compose up -d postgres redis rtpi-tools empire-server empire-proxy \
  workbench-db workbench-api workbench-frontend
```

**What This Starts**:
- ✅ PostgreSQL database (port 5434)
- ✅ Redis cache (port 6381)
- ✅ RTPI-Tools container (security tools)
- ✅ Empire C2 server (ports 1337, 5001, 8080-8100)
- ✅ ATT&CK Workbench (ports 3010, 3020, 27017)

**What This Skips**:
- ❌ OffSec agent containers (not needed for basic operations)

---

### Option 2: Build Specific OffSec Agents

**Time**: ~2-3 hours total (30-45 min base + 20-60 min per agent)  
**Best For**: When you need specific security research tools

#### Step 1: Build Base Image (Required First)
```bash
cd /home/cmndcntrl/code/rtpi

# Build the base image (this takes 30-45 minutes)
sudo docker compose --profile build-only build offsec-base

# Verify base image exists
sudo docker images | grep offsec-base
# Should show: rtpi/offsec-base   latest   ...
```

#### Step 2: Build Specific Agents You Need
```bash
# Build framework and research agents (examples)
sudo docker compose build offsec-framework offsec-research

# Or build individual agents:
sudo docker compose build offsec-maldev      # Binary analysis, ROP development
sudo docker compose build offsec-azure-ad    # Azure & AD testing
sudo docker compose build offsec-burp        # Web app security
sudo docker compose build offsec-empire      # C2 research
sudo docker compose build offsec-fuzzing     # Web fuzzing, discovery
```

#### Step 3: Start the Agents
```bash
# Start specific agents
sudo docker compose up -d offsec-framework offsec-research

# Or use profile to start all built agents
sudo docker compose --profile offsec-agents up -d
```

---

### Option 3: Build All OffSec Agents (Complete Deployment)

**Time**: ~4-5 hours total  
**Disk Space Required**: 50GB+  
**Best For**: Full security research lab setup

```bash
cd /home/cmndcntrl/code/rtpi

# Step 1: Build base image (30-45 min)
sudo docker compose --profile build-only build offsec-base

# Step 2: Build all agent images (2-4 hours)
sudo docker compose --profile offsec-agents build

# Step 3: Start everything
sudo docker compose --profile offsec-agents up -d
```

---

## 🔧 Recovery Procedure

If you encountered this error during deployment, follow these steps:

### 1. Stop Failed Build
```bash
cd /home/cmndcntrl/code/rtpi
sudo docker compose down
```

### 2. Choose Your Deployment Path

**For Quick Start** (Option 1):
```bash
sudo docker compose up -d postgres redis rtpi-tools empire-server empire-proxy \
  workbench-db workbench-api workbench-frontend
```

**For OffSec Agents** (Option 2 or 3):
```bash
# Build base first
sudo docker compose --profile build-only build offsec-base

# Then build specific or all agents
sudo docker compose build offsec-framework  # specific
# OR
sudo docker compose --profile offsec-agents build  # all
```

### 3. Verify Services
```bash
# Check running containers
sudo docker compose ps

# Check specific service health
sudo docker compose ps postgres redis rtpi-tools

# View logs if issues
sudo docker compose logs -f postgres
```

---

## 🚀 Post-Deployment Verification

### Core Services Health Check
```bash
# All services should show "Up" or "healthy"
sudo docker compose ps

# Expected output:
# NAME                 STATUS
# rtpi-postgres        Up (healthy)
# rtpi-redis           Up (healthy)
# rtpi-tools           Up
# rtpi-empire          Up (healthy)
# rtpi-workbench-api   Up (healthy)
```

### Test Database Connectivity
```bash
# From host machine
sudo docker exec -it rtpi-postgres psql -U rtpi -d rtpi_main -c "SELECT 1;"

# Should return: 1
```

### Test Redis Connectivity
```bash
# From host machine
sudo docker exec -it rtpi-redis redis-cli ping

# Should return: PONG
```

### Test Empire C2 API
```bash
# Test REST API
curl -k http://localhost:1337/

# Should return Empire web interface or API response
```

---

## 📊 Build Time Estimates

| Component | Build Time | Disk Space | Notes |
|-----------|-----------|------------|-------|
| **Core Services** | 5-10 min | 2GB | Postgres, Redis, rtpi-tools |
| **offsec-base** | 30-45 min | 4GB | Ubuntu + full toolchain |
| **Single Agent** | 20-60 min | 2-5GB | Varies by tools installed |
| **All 7 Agents** | 2-4 hours | 20GB+ | Parallel builds help |
| **Complete System** | 3-5 hours | 50GB+ | Everything including base |

**Pro Tip**: Build agents in parallel by opening multiple terminals:
```bash
# Terminal 1
sudo docker compose build offsec-maldev

# Terminal 2
sudo docker compose build offsec-research

# Terminal 3
sudo docker compose build offsec-framework
```

---

## 🛡️ Prevention Tips

### 1. Use Pre-Flight Check Script
```bash
# Run before deployment
bash scripts/pre-deployment-check.sh
```

This checks:
- Docker daemon running
- Sufficient disk space (50GB+ for full deployment)
- Docker permissions
- Base image presence

### 2. Use Build Automation Script
```bash
# Interactive build assistant
bash scripts/build-offsec-agents.sh

# Select which agents to build
# Automatic base image detection
# Progress indicators
# Health verification
```

### 3. Read Deployment Documentation
Before running `docker compose up`, review:
- `docs/DEPLOYMENT.md` - Full deployment guide
- `docs/troubleshooting/deployment-repair-plan.md` - Build sequences
- `docs/deployment/deployment-decision-tree.md` - Choose deployment path

### 4. Check Prerequisites
```bash
# Verify Docker version
docker --version  # Should be 24.0+

# Check available disk space
df -h /var/lib/docker  # Should have 50GB+ free

# Verify you're in docker group
groups | grep docker
```

---

## 🐛 Common Issues & Solutions

### Issue: "No space left on device"
**Solution**:
```bash
# Check disk space
df -h

# Clean old Docker resources
sudo docker system prune -a --volumes

# Or move Docker to larger disk
# See: scripts/migrate-docker-to-nvme.sh
```

### Issue: Base image build fails midway
**Solution**:
```bash
# Clean and rebuild
sudo docker compose --profile build-only build --no-cache offsec-base
```

### Issue: Agent build times out
**Solution**:
```bash
# Increase build timeout
COMPOSE_HTTP_TIMEOUT=600 sudo docker compose build offsec-maldev

# Or build with more verbose output
sudo docker compose build --progress=plain offsec-maldev
```

### Issue: "Cannot connect to Docker daemon"
**Solution**:
```bash
# Check Docker is running
sudo systemctl status docker

# Start Docker if stopped
sudo systemctl start docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker  # Or log out/in
```

---

## 📚 Related Documentation

- [Deployment Guide](../DEPLOYMENT.md) - Complete deployment instructions
- [Deployment Repair Plan](./deployment-repair-plan.md) - Detailed build sequences
- [Deployment Decision Tree](../deployment/deployment-decision-tree.md) - Choose your path
- [Build Dependency Graph](../deployment/build-dependency-graph.md) - Visual reference

---

## 💡 Key Takeaways

1. **OffSec agents require base image** - Always build `offsec-base` first
2. **Use profiles for controlled builds** - `--profile build-only` and `--profile offsec-agents`
3. **Plan for long build times** - 3-5 hours for complete setup
4. **Core services work independently** - You don't need OffSec agents for basic RTPI
5. **Build selectively** - Only build the agents you actually need

---

## 🤝 Getting Help

If you encounter issues not covered here:

1. Check logs: `sudo docker compose logs <service-name>`
2. Review build output: Build logs contain detailed error messages
3. Verify prerequisites: Run `scripts/pre-deployment-check.sh`
4. Check disk space: `df -h`
5. Clean and retry: `sudo docker compose down && sudo docker system prune`

---

**Last Updated**: 2026-02-27  
**Applies To**: RTPI v2.2+ with OffSec Agent Containers
