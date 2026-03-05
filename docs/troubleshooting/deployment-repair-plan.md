# RTPI Deployment Repair Plan

**Date Created**: 2026-02-27  
**Purpose**: Guide for recovering from deployment failures and proper build sequences  
**Status**: Active Reference Document

---

## 📋 Table of Contents

1. [Build Dependency Graph](#build-dependency-graph)
2. [Deployment Scenarios](#deployment-scenarios)
3. [Step-by-Step Repair Procedures](#step-by-step-repair-procedures)
4. [Build Sequences](#build-sequences)
5. [Verification Checkpoints](#verification-checkpoints)
6. [Rollback Procedures](#rollback-procedures)
7. [Common Failure Modes](#common-failure-modes)

---

## 🗺️ Build Dependency Graph

### Visual Dependency Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RTPI Platform                               │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │
         ┌───────────────────────┴───────────────────────┐
         │                                               │
    ┌────▼─────┐                                  ┌──────▼────────┐
    │   CORE   │                                  │    OFFSEC     │
    │ SERVICES │                                  │    AGENTS     │
    └────┬─────┘                                  └──────┬────────┘
         │                                               │
         │                                               │
         ├──► PostgreSQL (5434)                         │
         ├──► Redis (6381)                              │
         ├──► rtpi-tools                           ┌────▼─────────┐
         ├──► Empire C2 (1337, 5001)               │ offsec-base  │
         │    ├──► empire-server                   │   (image)    │
         │    └──► empire-proxy                    └────┬─────────┘
         └──► ATT&CK Workbench                          │
              ├──► workbench-db (27017)                 │
              ├──► workbench-api (3010)        ┌────────┴────────┐
              └──► workbench-frontend (3020)   │                 │
                                                │  7 Agent Images │
         NO DEPENDENCIES                        │                 │
         ↓                                      ├──► offsec-maldev
         Independent services                   ├──► offsec-azure-ad
         Can start immediately                  ├──► offsec-burp
                                                ├──► offsec-empire
                                                ├──► offsec-fuzzing
                                                ├──► offsec-framework
                                                └──► offsec-research
                                                
                                                WITH DEPENDENCY
                                                ↓
                                                Must build base first
                                                30-45 min base image
                                                + 20-60 min per agent
```

### Dependency Rules

1. **Core Services**: No interdependencies, can start in any order
2. **OffSec Base**: Must be built before ANY agent containers
3. **OffSec Agents**: All depend on `rtpi/offsec-base:latest`
4. **Profiles**: OffSec agents use Docker Compose profiles (not started by default)

---

## 🎯 Deployment Scenarios

### Scenario 1: Clean First Deployment (Core Only)

**Use Case**: Getting started quickly, development, testing core features  
**Time**: 5-10 minutes  
**Disk**: 2-3 GB

```bash
# Start core services only
cd /home/cmndcntrl/code/rtpi
sudo docker compose up -d postgres redis rtpi-tools \
  empire-server empire-proxy \
  workbench-db workbench-api workbench-frontend
```

**What You Get**:
- ✅ Full database (PostgreSQL)
- ✅ Caching (Redis)
- ✅ Security tools (rtpi-tools with 19 tools)
- ✅ C2 server (Empire)
- ✅ MITRE ATT&CK framework (Workbench)

**What You Don't Get**:
- ❌ OffSec agent containers (not needed for basic RTPI)

---

### Scenario 2: Core + Selective OffSec Agents

**Use Case**: Need specific security research tools  
**Time**: 2-3 hours (base + selected agents)  
**Disk**: 10-15 GB

```bash
cd /home/cmndcntrl/code/rtpi

# Step 1: Start core services (5-10 min)
sudo docker compose up -d postgres redis rtpi-tools \
  empire-server empire-proxy \
  workbench-db workbench-api workbench-frontend

# Step 2: Build base image (30-45 min)
sudo docker compose --profile build-only build offsec-base

# Step 3: Build specific agents (20-60 min each)
sudo docker compose build offsec-framework offsec-research

# Step 4: Start agents
sudo docker compose up -d offsec-framework offsec-research
```

**Best Agents to Start With**:
- **offsec-framework**: Technology detection, CMS scanning
- **offsec-research**: General R&D, JupyterLab notebooks
- **offsec-fuzzing**: Web fuzzing, directory discovery

---

### Scenario 3: Complete Full Deployment

**Use Case**: Full security research lab  
**Time**: 4-5 hours  
**Disk**: 50+ GB

```bash
cd /home/cmndcntrl/code/rtpi

# Step 1: Start core services
sudo docker compose up -d postgres redis rtpi-tools \
  empire-server empire-proxy \
  workbench-db workbench-api workbench-frontend

# Step 2: Build base image (30-45 min)
sudo docker compose --profile build-only build offsec-base

# Step 3: Build all agents (2-4 hours)
# Use parallel terminals to speed up
sudo docker compose --profile offsec-agents build

# Step 4: Start all agents
sudo docker compose --profile offsec-agents up -d
```

---

## 🔧 Step-by-Step Repair Procedures

### Repair 1: Failed Initial `docker compose up -d --build`

**Symptoms**:
- Build fails with "rtpi/offsec-base:latest: failed to resolve"
- Multiple agent containers show build errors
- Error mentions "pull access denied"

**Root Cause**: Attempted to build OffSec agents without base image

**Repair Steps**:

```bash
# 1. Stop all containers and clean up
cd /home/cmndcntrl/code/rtpi
sudo docker compose down

# 2. Start core services only (skip OffSec agents)
sudo docker compose up -d postgres redis rtpi-tools \
  empire-server empire-proxy \
  workbench-db workbench-api workbench-frontend

# 3. Verify core services are healthy
sudo docker compose ps

# 4. (Optional) Build OffSec agents later if needed
# See Scenario 2 above
```

**Verification**:
```bash
# All core services should be "Up" or "healthy"
sudo docker compose ps | grep -E "postgres|redis|rtpi-tools|empire|workbench"
```

---

### Repair 2: Incomplete OffSec Agent Build

**Symptoms**:
- Some agents built successfully, others failed
- Base image exists but agents incomplete
- Mixed status in `docker images`

**Root Cause**: Network issues, timeouts, or resource constraints during build

**Repair Steps**:

```bash
cd /home/cmndcntrl/code/rtpi

# 1. Check which agents are built
sudo docker images | grep offsec

# 2. Rebuild failed agents individually
sudo docker compose build --no-cache offsec-framework

# 3. Or rebuild all agents
sudo docker compose --profile offsec-agents build --no-cache

# 4. Start built agents
sudo docker compose up -d offsec-framework
```

**Verification**:
```bash
# Check agent containers are running
sudo docker compose ps | grep offsec

# Verify MCP server is running in agent
sudo docker exec rtpi-framework-agent pgrep -f "node.*mcp"
```

---

### Repair 3: Service Won't Start After Build

**Symptoms**:
- Build completed successfully
- Container starts then immediately exits
- Logs show errors

**Diagnostic Steps**:

```bash
# 1. Check container status
sudo docker compose ps <service-name>

# 2. View recent logs
sudo docker compose logs --tail=50 <service-name>

# 3. Try starting in foreground to see errors
sudo docker compose up <service-name>
```

**Common Fixes**:

**Issue: Permission errors**
```bash
# Fix volume permissions
sudo docker compose down
sudo rm -rf <volume-path>
sudo docker compose up -d <service-name>
```

**Issue: Port conflicts**
```bash
# Find what's using the port
sudo netstat -tlnp | grep <port>

# Kill the process or change port in docker-compose.yml
```

**Issue: Missing environment variables**
```bash
# Check .env file exists
ls -la .env

# Verify required variables
grep -E "POSTGRES|REDIS|EMPIRE" .env
```

---

## 📝 Build Sequences

### Sequence 1: Core-Only Build Order

```bash
# Dependencies resolved automatically by Docker Compose
# Services start in optimal order based on depends_on

# 1. Network creation (automatic)
# 2. Volume creation (automatic)
# 3. Independent services can start in parallel:
#    - postgres
#    - redis
#    - workbench-db
# 4. Services waiting for dependencies:
#    - rtpi-tools (independent, but may need time to build)
#    - empire-server (waits for postgres healthy)
#    - workbench-api (waits for workbench-db healthy)
# 5. Services waiting for APIs:
#    - empire-proxy (waits for empire-server)
#    - workbench-frontend (waits for workbench-api)
```

**Command**:
```bash
sudo docker compose up -d postgres redis rtpi-tools \
  empire-server empire-proxy \
  workbench-db workbench-api workbench-frontend
```

---

### Sequence 2: OffSec Agent Build Order

```bash
# CRITICAL: Base image must be built first!

# 1. Build base image (required)
sudo docker compose --profile build-only build offsec-base

# 2. Build agents (can be parallel)
#    Order doesn't matter - all depend only on base
sudo docker compose build \
  offsec-maldev \
  offsec-azure-ad \
  offsec-burp \
  offsec-empire \
  offsec-fuzzing \
  offsec-framework \
  offsec-research

# 3. Start agents (can be parallel)
sudo docker compose up -d \
  offsec-maldev \
  offsec-azure-ad \
  offsec-burp \
  offsec-empire \
  offsec-fuzzing \
  offsec-framework \
  offsec-research
```

**Optimized Parallel Build** (multiple terminals):
```bash
# Terminal 1
sudo docker compose build offsec-maldev offsec-azure-ad

# Terminal 2
sudo docker compose build offsec-burp offsec-empire

# Terminal 3
sudo docker compose build offsec-fuzzing offsec-framework

# Terminal 4
sudo docker compose build offsec-research
```

---

## ✅ Verification Checkpoints

### Checkpoint 1: Core Services Health

**Run After**: Core services deployment

```bash
# Check all services are up
sudo docker compose ps

# Test PostgreSQL
sudo docker exec rtpi-postgres psql -U rtpi -d rtpi_main -c "SELECT version();"

# Test Redis
sudo docker exec rtpi-redis redis-cli ping

# Test Empire API
curl -k http://localhost:1337/

# Test Workbench API
curl http://localhost:3010/api/collections

# Check logs for errors
sudo docker compose logs --tail=20 postgres redis rtpi-tools
```

**Expected Results**:
- All services show "Up" or "Up (healthy)"
- PostgreSQL returns version info
- Redis returns "PONG"
- Empire returns HTML or JSON response
- Workbench returns JSON array
- No ERROR lines in logs

---

### Checkpoint 2: Base Image Verification

**Run After**: `offsec-base` build

```bash
# Verify image exists
sudo docker images rtpi/offsec-base:latest

# Check image size (should be ~4GB)
sudo docker images rtpi/offsec-base:latest --format "{{.Size}}"

# Inspect image layers
sudo docker history rtpi/offsec-base:latest | head -20

# Test image runs
sudo docker run --rm rtpi/offsec-base:latest which node python go rustc
```

**Expected Results**:
- Image appears in `docker images` list
- Size is approximately 4GB
- Test container finds all toolchain binaries

---

### Checkpoint 3: Agent Container Health

**Run After**: Agent container deployment

```bash
# Check agent containers are running
sudo docker compose ps | grep offsec

# Test MCP server is running
sudo docker exec rtpi-framework-agent pgrep -f "node.*mcp"

# Check agent logs
sudo docker compose logs --tail=20 offsec-framework

# Verify tools are accessible
sudo docker exec rtpi-framework-agent ls -la /opt/tools/bin/

# Test tool execution
sudo docker exec rtpi-framework-agent whatweb --version
```

**Expected Results**:
- All agent containers show "Up"
- MCP server process is running (PID returned)
- Logs show "MCP Server: Initializing..."
- Tools directory populated
- Tool commands execute successfully

---

## ⏪ Rollback Procedures

### Rollback 1: Stop Problematic Service

```bash
# Stop single service
sudo docker compose stop <service-name>

# Remove container (keeps image and volumes)
sudo docker compose rm -f <service-name>

# Restart from clean state
sudo docker compose up -d <service-name>
```

---

### Rollback 2: Complete Teardown and Restart

```bash
# Stop all services
sudo docker compose down

# Remove all containers (keeps images and volumes)
sudo docker compose down --remove-orphans

# Full cleanup (removes volumes - DATA LOSS!)
sudo docker compose down -v

# Restart core services
sudo docker compose up -d postgres redis rtpi-tools \
  empire-server empire-proxy \
  workbench-db workbench-api workbench-frontend
```

---

### Rollback 3: Remove Failed OffSec Builds

```bash
# Remove specific agent image
sudo docker rmi rtpi/maldev-tools:latest

# Remove all agent images
sudo docker images | grep offsec | awk '{print $3}' | xargs sudo docker rmi -f

# Remove base image (forces complete rebuild)
sudo docker rmi rtpi/offsec-base:latest

# Rebuild from scratch
sudo docker compose --profile build-only build --no-cache offsec-base
```

---

## 🐛 Common Failure Modes

### Failure Mode 1: Disk Space Exhaustion

**Symptoms**:
- Build stops with "no space left on device"
- `df -h` shows disk nearly full
- Docker operations fail randomly

**Solution**:
```bash
# Check disk usage
df -h /var/lib/docker

# Clean Docker cache
sudo docker system prune -a --volumes

# Check again
df -h /var/lib/docker

# If still full, move Docker to larger disk
# See: scripts/migrate-docker-to-nvme.sh
```

---

### Failure Mode 2: Network Timeout During Build

**Symptoms**:
- Build fails downloading packages
- "connection timeout" or "connection refused"
- Intermittent failures

**Solution**:
```bash
# Retry with increased timeout
COMPOSE_HTTP_TIMEOUT=600 sudo docker compose build offsec-base

# Or use Docker BuildKit cache
DOCKER_BUILDKIT=1 sudo docker compose build offsec-base

# If persistent, check DNS
sudo docker run --rm alpine ping -c 3 google.com
```

---

### Failure Mode 3: Resource Exhaustion (RAM/CPU)

**Symptoms**:
- Build is extremely slow
- System becomes unresponsive
- Out of memory errors

**Solution**:
```bash
# Build one agent at a time
sudo docker compose build offsec-maldev
# Wait for completion
sudo docker compose build offsec-azure-ad

# Limit Docker resources
# Edit /etc/docker/daemon.json:
{
  "max-concurrent-builds": 1,
  "max-concurrent-uploads": 1
}

# Restart Docker
sudo systemctl restart docker
```

---

### Failure Mode 4: Permission Denied Errors

**Symptoms**:
- "permission denied" accessing docker.sock
- Cannot start containers
- Volume mount failures

**Solution**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Apply group membership (or logout/login)
newgrp docker

# Fix volume permissions
sudo chown -R $USER:$USER ./uploads
sudo chown -R $USER:$USER ./logs

# Restart containers
sudo docker compose down
sudo docker compose up -d
```

---

## 📊 Build Time Budget

### Planning Your Deployment

| Scenario | Components | Build Time | Start Time | Total | Disk |
|----------|-----------|-----------|-----------|-------|------|
| **Core Only** | 8 services | 5 min | 1 min | ~6 min | 2 GB |
| **Core + Base** | + offsec-base | 5 + 40 min | 1 min | ~46 min | 6 GB |
| **Core + 1 Agent** | + framework | 5 + 40 + 30 min | 2 min | ~77 min | 10 GB |
| **Core + 3 Agents** | + frw+res+fuzz | 5 + 40 + 90 min | 3 min | ~138 min | 15 GB |
| **Complete** | All 7 agents | 5 + 40 + 180 min | 5 min | ~230 min | 50 GB |

**Pro Tips**:
- Build agents in parallel (multiple terminals) to save time
- Use `--no-cache` only when necessary (much slower)
- Build during off-hours or overnight for complete deployment
- Monitor disk space continuously during builds

---

## 📚 Related Documentation

- [OffSec Agents Build Failure](./offsec-agents-build-failure.md) - Specific troubleshooting
- [Deployment Guide](../DEPLOYMENT.md) - Complete deployment instructions
- [Deployment Decision Tree](../deployment/deployment-decision-tree.md) - Choose your path
- [Build Dependency Graph](../deployment/build-dependency-graph.md) - Visual reference

---

## 🎓 Key Principles

1. **Build Dependencies First**: Always build `offsec-base` before any agent
2. **Start Core Independently**: Core services don't need OffSec agents
3. **Build Selectively**: Only build agents you actually need
4. **Verify at Checkpoints**: Test after each major step
5. **Plan for Time**: Full deployment takes 4-5 hours
6. **Monitor Resources**: Watch disk space and memory during builds
7. **Use Profiles**: Control what gets built with `--profile` flags
8. **Parallel Builds**: Speed up with multiple terminals
9. **Keep Backups**: Document working state before major changes
10. **Read Logs**: They contain the answers to most problems

---

**Last Updated**: 2026-02-27  
**Maintained By**: RTPI Infrastructure Team  
**Version**: 1.0.0
