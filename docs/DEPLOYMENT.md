# Deployment Guide

This guide covers deploying the Unified RTPI platform in various environments, from development to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [System Requirements](#system-requirements)
- [Environment Configuration](#environment-configuration)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Database Setup](#database-setup)
- [Security Configuration](#security-configuration)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Post-Deploy Verification](#post-deploy-verification)
- [Scaling](#scaling)
- [Agent System Deployment](#agent-system-deployment-v21)
- [OffSec Agent Containers](#offsec-agent-containers)
- [SysReptor Reporting Platform](#sysreptor-reporting-platform)
- [VPN Tunnel Manager](#vpn-tunnel-manager)

---

## Prerequisites

### Required Software

- **Node.js**: Version 20.x or higher
- **Docker**: Version 24.x or higher
- **Docker Compose**: Version 2.x or higher
- **PostgreSQL**: Version 16.x (if not using Docker)
- **Redis**: Version 7.x (if not using Docker)
- **Git**: For version control

### Optional Tools

- **nginx**: For reverse proxy in production
- **Certbot**: For SSL/TLS certificate management
- **PM2**: For process management (alternative to Docker)

---

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 20 GB available space
- **Network**: 100 Mbps

### Recommended Requirements (Production)

- **CPU**: 4+ cores
- **RAM**: 8+ GB
- **Storage**: 100+ GB SSD
- **Network**: 1 Gbps
- **OS**: Ubuntu 22.04 LTS or similar Linux distribution

### Port Requirements

The following ports must be available:

- `3001` - Backend API server
- `5434` - PostgreSQL database (main)
- `5435` - PostgreSQL database (mem0 vector store)
- `6381` - Redis cache
- `1337` - Empire REST API (proxied)
- `5001` - Empire Web UI (proxied)
- `8080-8100` - Empire dynamic listener ports
- `3000` - Open WebUI
- `3010` - ATT&CK Workbench API
- `3020` - ATT&CK Workbench Frontend
- `7474` / `7687` - Neo4j browser / Bolt
- `8005` - mem0 API
- `8185` - LangGraph orchestrator
- `8888` - JupyterLab (research agent)
- `9876` - Burp MCP Server
- `8283` - Burp Proxy
- `7777` - SysReptor UI (Caddy proxy — optional, `sysreptor` profile)
- `9000` - SysReptor API (optional, `sysreptor` profile)
- `80` / `443` - HTTP/HTTPS (production with reverse proxy)

**Note**: The Empire dynamic listener range (8080-8100) is reserved. Do not assign other services to ports in this range.

---

## Environment Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

### Required Variables

#### Server Configuration

```bash
NODE_ENV=production
PORT=3000
```

#### Database Configuration

```bash
DB_HOST=localhost
DB_PORT=5434
DB_USER=rtpi
DB_PASSWORD=<secure-password>
DB_NAME=rtpi_main
DATABASE_URL=postgresql://rtpi:<secure-password>@localhost:5434/rtpi_main
```

#### Redis Configuration

```bash
REDIS_URL=redis://localhost:6381
REDIS_PASSWORD=<secure-password>
```

**Note**: For production deployments with Docker Compose, ensure `REDIS_PASSWORD` is set to secure the Redis instance. The password will be used in the connection URL format: `redis://:<password>@redis:6381`

#### Session Security

```bash
# Generate with: openssl rand -base64 32
SESSION_SECRET=<random-secret-key>
```

#### Authentication

```bash
# Google OAuth (Production Only - Optional)
# For local development, leave these commented out to use local authentication only
# Uncomment and configure for production deployment:
# GOOGLE_CLIENT_ID=<your-production-google-client-id>
# GOOGLE_CLIENT_SECRET=<your-production-google-client-secret>
# GOOGLE_CALLBACK_URL=https://yourdomain.com/api/v1/auth/google/callback

# JWT Tokens
JWT_SECRET=<random-secret-key>
JWT_EXPIRES_IN=24h
```

**Note**: The application works perfectly with local authentication (username/password) only. Google OAuth is optional and primarily intended for production deployments where you want to offer users the convenience of OAuth login.

#### CORS Configuration

```bash
CORS_ORIGIN=https://yourdomain.com
```

#### File Upload

```bash
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=./uploads
```

#### AI Services (Optional)

```bash
OPENAI_API_KEY=<your-openai-api-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

#### Agent System Configuration (v2.1)

```bash
# Agent System Auto-Initialization
AGENT_AUTO_INITIALIZE=true

# Workflow Retry Configuration
WORKFLOW_RETRY_MAX_RETRIES=3
WORKFLOW_RETRY_BACKOFF_MULTIPLIER=2
WORKFLOW_RETRY_BASE_DELAY_MS=1000
```

### Generating Secure Secrets

#### Option A — Bootstrap Script (Recommended)

Instead of copying `.env.example` and editing secrets by hand, run the bundled bootstrap:

```bash
# Host
npm run bootstrap

# or via Docker (no Node required)
docker compose --profile bootstrap run --rm rtpi-bootstrap
```

This will:

- Generate every secret the stack needs (encryption key, session/JWT secrets, admin password, Empire/Workbench/Kasm passwords, Redis password, SysReptor SECRET_KEY + AES ENCRYPTION_KEYS, SysReptor DB/Redis passwords).
- Write them to `.env` and `configs/rtpi-sysreptor/app.env` (derived from the `.example` templates).
- Patch `docker/postgres-init/01-init-databases.sql` with the generated SysReptor DB password so the first-boot init creates the user correctly.
- Save a mode-600 backup copy to `~/.rtpi/credentials-<timestamp>.env` with a convenience symlink at `~/.rtpi/credentials.latest.env`.
- Refuse to overwrite an existing `.env` unless you pass `--force`.

Your default admin password is printed once at the end of the run and stored in the backup file.

**Regenerate everything:**

```bash
npm run bootstrap -- --force
docker compose down -v   # wipe volumes so postgres-init re-runs with the new password
docker compose up -d
```

#### Option B — Manual

If you prefer to edit `.env` by hand, copy `.env.example` and `configs/rtpi-sysreptor/app.env.example`, then generate individual values:

```bash
openssl rand -hex 32        # ENCRYPTION_KEY (64 hex chars / 32 bytes)
openssl rand -base64 64     # SESSION_SECRET, JWT_SECRET, WORKBENCH_SESSION_SECRET
openssl rand -base64 50     # SysReptor SECRET_KEY
openssl rand -base64 32     # SysReptor AES key (goes inside ENCRYPTION_KEYS JSON)
cat /proc/sys/kernel/random/uuid  # SysReptor ENCRYPTION_KEYS key id + DEFAULT_ENCRYPTION_KEY_ID
```

Remember that `SYSREPTOR_DB_PASSWORD` in `.env` must match `DATABASE_PASSWORD` in `configs/rtpi-sysreptor/app.env` **and** the `CREATE USER sysreptor WITH PASSWORD` value in `docker/postgres-init/01-init-databases.sql`. Using Option A avoids these cross-file sync errors.

---

## RTPI-Tools Container Setup

The rtpi-tools container provides an isolated environment for executing security tools. This section covers its deployment and configuration.

### Container Overview

The rtpi-tools container includes:
- **19 pre-installed security tools** across 9 categories
- **Isolated execution environment** for security operations
- **Docker-based security** with non-root user execution
- **API integration** for agent-driven tool execution

### Building the Container

1. **Build rtpi-tools image:**

```bash
# From project root
docker compose build rtpi-tools

# Or build directly
docker build -f Dockerfile.tools -t rtpi-tools .
```

2. **Verify build:**

```bash
docker images | grep rtpi-tools
```

### Starting the Container

The rtpi-tools container starts automatically with docker-compose:

```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.prod.yml up -d

# Verify container is running
docker ps | grep rtpi-tools
```

### Seeding Security Tools Database

After the container is running, populate the tools database:

```bash
# Ensure database is up to date
npm run db:push

# Run the seeder
npx tsx scripts/seed-tools.ts
```

Expected output:
```
🌱 Seeding security tools...
✓ Cleared existing tools
✓ Added: Nmap (reconnaissance)
✓ Added: Metasploit Framework (exploitation)
✓ Added: Hashcat (password_cracking)
...
✅ Successfully seeded 19 security tools!
```

### MITRE ATT&CK Data

The ATT&CK Workflows tab and `/api/v1/attack/*` endpoints depend on the `attack_tactics`/`attack_techniques` tables being populated from a STIX bundle.

**Automatic (default):** On startup, the server checks `attack_tactics`. If empty, it downloads the enterprise STIX bundle from `raw.githubusercontent.com/mitre/cti` and imports it. The bundle is cached at `server/data/attack/enterprise-attack.json` for subsequent runs.

**Manual:** If the deployment has no outbound internet access, run the importer locally once and commit/ship the JSON under `server/data/attack/`:

```bash
npx tsx server/scripts/import-attack-data.ts
```

**Opt-out:** Set `ATTACK_AUTO_IMPORT=false` in the environment to skip the bootstrap entirely. Override the source URL with `ATTACK_STIX_URL` if you mirror it internally.

### Container Configuration

The rtpi-tools container is configured in `docker-compose.yml`:

```yaml
rtpi-tools:
  build:
    context: .
    dockerfile: Dockerfile.tools
  container_name: rtpi-tools
  networks:
    - rtpi-network
  volumes:
    - tool-results:/var/log/rtpi
    - tool-configs:/opt/tools/config
    - shared-data:/shared
  stdin_open: true
  tty: true
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "echo", "healthy"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### Volume Mounts

The container uses three volumes for data persistence:

- **tool-results**: Stores tool execution results and logs
- **tool-configs**: Configuration files for tools

- **shared-data**: Shared data between containers
### Testing Tool Execution

Verify tools are working correctly:

```bash
# Test Nmap
docker exec rtpi-tools nmap --version

# Test Python
docker exec rtpi-tools python3 --version

# Test PowerShell
docker exec rtpi-tools pwsh -Command "Write-Host 'Test'"

# List installed tools
docker exec rtpi-tools ls -la /opt/tools/
```

### Container Management

```bash
# View container logs
docker logs rtpi-tools

# Restart container
docker restart rtpi-tools

# Access container shell
docker exec -it rtpi-tools /bin/bash

# Check container status via API
curl http://localhost:3000/api/v1/containers/rtpi-tools/status
```

### Security Considerations

- **Non-root execution**: Tools run as `rtpi-tools` user
- **Network isolation**: Container on isolated bridge network
- **Command validation**: All commands validated before execution
- **Resource limits**: CPU and memory limits enforced
- **Audit logging**: All tool executions logged

### Troubleshooting rtpi-tools

**Container won't start:**
```bash
# Check logs
docker logs rtpi-tools

# Rebuild container
docker compose build --no-cache rtpi-tools
docker compose up -d rtpi-tools
```

**Tools not found:**
```bash
# Verify tools are installed
docker exec rtpi-tools which nmap
docker exec rtpi-tools which msfconsole

# Check PATH
docker exec rtpi-tools echo $PATH
```

**Database not seeded:**
```bash
# Check if tools exist in database
curl http://localhost:3000/api/v1/tools

# Re-run seeder
npx tsx scripts/seed-tools.ts
```

For complete rtpi-tools documentation, see [RTPI-Tools Implementation Guide](RTPI-TOOLS-IMPLEMENTATION.md).

---

## Agent System Deployment (v2.1)

The v2.1 Autonomous Agent Framework provides automated workflow orchestration for security assessments.

### Auto-Initialization

On server startup, the agent system automatically:
1. Initializes the AgentWorkflowOrchestrator
2. Seeds default workflow templates (if not present)
3. Sets up event listeners for workflow triggers
4. Configures graceful shutdown handlers

### Default Workflow Templates

Five workflow templates are seeded on first run:

| Template | Trigger Event | Description |
|----------|--------------|-------------|
| Surface Assessment Workflow | `operation_created` | Initial reconnaissance |
| Web Hacker Workflow | `surface_assessment_completed` | Web vulnerability scanning |
| Full Assessment Pipeline | `manual` | Complete assessment chain |
| Tool Discovery Workflow | `scheduled` | Periodic tool updates |
| Quick Scan Workflow | `manual` | Fast reconnaissance |

### Environment Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_AUTO_INITIALIZE` | `true` | Enable auto-init on startup |
| `WORKFLOW_RETRY_MAX_RETRIES` | `3` | Max retry attempts per task |
| `WORKFLOW_RETRY_BACKOFF_MULTIPLIER` | `2` | Exponential backoff multiplier |
| `WORKFLOW_RETRY_BASE_DELAY_MS` | `1000` | Base delay between retries (ms) |

### Verifying Agent System

```bash
# Check agent system initialized
curl http://localhost:3000/api/v1/agents/health

# List workflow templates
curl http://localhost:3000/api/v1/workflows/templates

# Check workflow instances
curl http://localhost:3000/api/v1/workflows/instances
```

### Nuclei Template Management

The platform includes a Nuclei template management API for vulnerability scanning:

```bash
# List all templates
curl http://localhost:3000/api/v1/nuclei-templates

# Get template statistics
curl http://localhost:3000/api/v1/nuclei-templates/stats

# Sync from official repository
curl -X POST http://localhost:3000/api/v1/nuclei-templates/sync
```

### Workflow Checkpoint and Resume

Workflows support checkpoint/resume for fault tolerance:

- **Pause**: `POST /api/v1/workflows/instances/:id/pause` - Creates checkpoint
- **Resume**: `POST /api/v1/workflows/instances/:id/resume` - Resumes from checkpoint

### Graceful Shutdown

On SIGTERM/SIGINT, the agent system:
1. Pauses all running workflows
2. Saves checkpoint state for resume
3. Completes in-progress tasks (with timeout)
4. Closes database connections

---

## OffSec Agent Containers

> ⚠️ **CRITICAL: Read Before Building OffSec Agents**
> 
> **DO NOT run `docker compose up -d --build` without reading this section!**
> 
> The OffSec agents require a **base image** to be built first, which takes 30-45 minutes. If you attempt to build everything at once without the base image, the build will fail with:
> ```
> rtpi/offsec-base:latest: failed to resolve source metadata
> pull access denied, repository does not exist
> ```
> 
> **Quick Start Options:**
> - **Option A (Recommended)**: Skip OffSec agents entirely - [See Core-Only Deployment](#scenario-1-core-only-deployment-recommended)
> - **Option B**: Build base image first, then selective agents - [See Build Sequence](#building-the-base-image-required-first)
> - **Option C**: Full deployment (4-5 hours) - [See Complete Build](#scenario-3-complete-full-deployment)
> - **Option D (Resilient)**: `npm run build:offsec` — base + 14 children with retry, see [Resilient Build](#resilient-build)
> 
> **Troubleshooting Guide**: If you already encountered build errors, see [OffSec Agents Build Failure Troubleshooting](./troubleshooting/offsec-agents-build-failure.md)

> ⚠️ **Behavior change: OffSec agents are now profile-gated.**
> 
> The 14 offsec agent services (`offsec-maldev`, `offsec-c3`, `offsec-burp`, …) declare `profiles: [offsec-agents]` in `docker-compose.yml`. Effects:
> 
> - `docker compose up -d` (no profile) — **does NOT start the offsec agents** (regression vs. older versions where they came up by default).
> - `docker compose up -d --profile offsec-agents` — base RTPI services + the 14 offsec agents.
> - `docker compose down` (no profile) — does **not** stop or remove already-running offsec containers; pass `--profile offsec-agents` to manage them, or `--remove-orphans` to clear them.
> 
> Migration on an existing host: include `--profile offsec-agents` in your `up`/`down`/`pull` commands, or rely on `npm run build:offsec` for builds (which enumerates services explicitly and ignores profile semantics).
> 
> Why: under the old config, `--profile offsec-agents` was a no-op filter (the profile was undefined), and a build invocation would silently pull in `ghidra-headless`, `rtpi-orchestrator`, and `rtpi-tools`. Defining the profile makes scoping intentional.

---

### Overview

The OffSec Team Agent containers are specialized Docker images for security research and penetration testing. Each container includes curated tools for specific MITRE ATT&CK tactics and exposes them via MCP (Model Context Protocol) servers.

**Important**: These containers are **optional** and not required for basic RTPI operations. Core services (PostgreSQL, Redis, rtpi-tools, Empire, ATT&CK Workbench) work independently.

---

### Resilient Build

Use `npm run build:offsec` (or `bash scripts/build-resilient.sh`) for production
rollouts. It builds `offsec-base` first, then the 14 child agent images at
bounded parallelism with per-image retry. Per-image logs go to
`/tmp/rtpi-build/<service>.log`; a summary is written to
`/tmp/rtpi-build/_summary`.

```bash
npm run build:offsec
# or directly:
bash scripts/build-resilient.sh
```

**Why this exists.** Plain `docker compose --profile offsec-agents build` runs
all 15 image builds in one BuildKit DAG. If any one apt-get blip on
`archive.ubuntu.com` causes a single image to fail, BuildKit cancels every
sibling that was healthy mid-build. Production deploys lose 30+ minutes of
compute to one transient mirror outage. The resilient script:

- Spawns one `docker compose build` invocation per image, so a failure cannot
  cancel siblings (each is its own DAG).
- Retries a failed image up to `BUILD_RETRIES` times (default 2) with linear
  backoff before giving up.
- Reads BuildKit cache mounts on `/var/cache/apt` and `/var/lib/apt` baked
  into every offsec Dockerfile (Layer 1 of the resilience work) — so apt
  indices and `.deb` packages persist across builds.

**Tunables (env vars):**

| Variable | Default | Effect |
|---|---|---|
| `BUILD_CONCURRENCY` | `2` | How many images compile in parallel. Raise on hosts with bandwidth/CPU; lower if you're hammering shared apt mirrors. |
| `BUILD_RETRIES` | `2` | Per-image retry count after the first attempt. `0` = single shot. |
| `BUILD_RETRY_DELAY` | `15` | Seconds between retries (linear: 15, 30, 45 …). |
| `LOG_DIR` | `/tmp/rtpi-build` | Where per-image logs and `_summary` land. |

**Exit codes:**

| Code | Meaning |
|---|---|
| `0` | base + every child built |
| `2` | docker not reachable / bad args |
| `10` | base failed (children skipped — fatal) |
| `20` | base ok, ≥1 child failed all retries (deploy should not proceed) |

Re-run the same command to retry only what's missing. Already-built images
short-circuit through BuildKit cache + apt cache mount in seconds.

### Deployment Scenarios

Choose the deployment path that matches your needs:

#### Scenario 1: Core-Only Deployment (Recommended)

**Time**: 5-10 minutes  
**Disk**: 2-3 GB  
**Best For**: Development, getting started, basic RTPI operations

```bash
cd /home/cmndcntrl/code/rtpi
sudo docker compose up -d postgres redis rtpi-tools \
  empire-server empire-proxy \
  workbench-db workbench-api workbench-frontend
```

**What You Get**: PostgreSQL, Redis, rtpi-tools (19 security tools), Empire C2, ATT&CK Workbench  
**What You Skip**: OffSec agent containers (not needed for basic operations)

---

#### Scenario 2: Core + Selective OffSec Agents

**Time**: 2-3 hours  
**Disk**: 10-15 GB  
**Best For**: When you need specific security research tools

```bash
cd /home/cmndcntrl/code/rtpi

# Step 1: Start core services (5-10 min)
sudo docker compose up -d postgres redis rtpi-tools \
  empire-server empire-proxy \
  workbench-db workbench-api workbench-frontend

# Step 2: Build base image (30-45 min) - REQUIRED FIRST!
sudo docker compose --profile build-only build offsec-base

# Step 3: Build specific agents you need (20-60 min each)
sudo docker compose build offsec-framework offsec-research

# Step 4: Start agents
sudo docker compose up -d offsec-framework offsec-research
```

**Recommended Agents**:
- `offsec-framework`: Technology detection, CMS scanning
- `offsec-research`: General R&D, JupyterLab notebooks
- `offsec-fuzzing`: Web fuzzing, directory discovery

---

#### Scenario 3: Complete Full Deployment

**Time**: 4-5 hours  
**Disk**: 50+ GB  
**Best For**: Full security research lab setup

```bash
cd /home/cmndcntrl/code/rtpi

# Step 1: Start core services
sudo docker compose up -d postgres redis rtpi-tools \
  empire-server empire-proxy \
  workbench-db workbench-api workbench-frontend

# Step 2: Build base image (30-45 min) - REQUIRED FIRST!
sudo docker compose --profile build-only build offsec-base

# Step 3: Build all agents (2-4 hours)
sudo docker compose --profile offsec-agents build

# Step 4: Start all agents
sudo docker compose --profile offsec-agents up -d
```

**Parallel Build Tip**: Open multiple terminals and build agents simultaneously to save time.

---

### Container Overview

| Agent | Dockerfile | Focus Area | MITRE Tactics |
|-------|-----------|-----------|---------------|
| **Maldev** | `Dockerfile.maldev-tools` | Binary Analysis, ROP Development | Defense Evasion, Execution |
| **Azure-AD** | `Dockerfile.azure-ad-tools` | Azure & Active Directory | Credential Access, Lateral Movement |
| **Burp** | `Dockerfile.burp-tools` | Web Application Security | Reconnaissance, Initial Access |
| **Empire** | `Dockerfile.empire-tools` | Command & Control | C2, Persistence |
| **Fuzzing** | `Dockerfile.fuzzing-tools` | Web Fuzzing, Discovery | Discovery, Reconnaissance |
| **Framework** | `Dockerfile.framework-tools` | Tech Stack Detection | Reconnaissance, Initial Access |
| **Research** | `Dockerfile.research-tools` | General R&D, OSINT | All Tactics |

### Build Requirements

**System Requirements:**
- **Disk Space**: 50GB+ (tool repositories and compiled binaries)
- **RAM**: 4GB+ for build processes
- **CPU**: Multi-core recommended for parallel compilation
- **Build Time**: Base image ~30-45 min, each agent ~20-60 min

**Architecture Support:**
- Full support for `amd64` (x86_64)
- Partial support for `arm64` (some Windows-specific tools excluded)

### Building the Base Image (Required First)

The base image must be built before any agent images:

```bash
# Build the base image (required first)
docker compose --profile build-only build offsec-base

# Or build directly
docker build -f docker/offsec-agents/Dockerfile.base \
  -t rtpi/offsec-base:latest \
  docker/offsec-agents/
```

The base image includes:
- Ubuntu 22.04 with Python3, Node.js, Rust, Go, JDK
- Non-root `rtpi-agent` user
- MCP server framework
- Common security tool dependencies

### Building Individual Agent Images

After the base image is built, build individual agents:

```bash
# Build all agents at once
docker compose --profile offsec-agents build

# Or build specific agents
docker compose build offsec-maldev
docker compose build offsec-azure-ad
docker compose build offsec-burp
docker compose build offsec-empire
docker compose build offsec-fuzzing
docker compose build offsec-framework
docker compose build offsec-research
```

**Direct Docker Build (alternative):**

```bash
# Maldev Agent
docker build -f docker/offsec-agents/Dockerfile.maldev-tools \
  -t rtpi/maldev-tools:latest \
  docker/offsec-agents/

# Azure-AD Agent
docker build -f docker/offsec-agents/Dockerfile.azure-ad-tools \
  -t rtpi/azure-ad-tools:latest \
  docker/offsec-agents/

# Burp Agent
docker build -f docker/offsec-agents/Dockerfile.burp-tools \
  -t rtpi/burp-tools:latest \
  docker/offsec-agents/

# Empire Agent
docker build -f docker/offsec-agents/Dockerfile.empire-tools \
  -t rtpi/empire-tools:latest \
  docker/offsec-agents/

# Fuzzing Agent
docker build -f docker/offsec-agents/Dockerfile.fuzzing-tools \
  -t rtpi/fuzzing-tools:latest \
  docker/offsec-agents/

# Framework Agent
docker build -f docker/offsec-agents/Dockerfile.framework-tools \
  -t rtpi/framework-tools:latest \
  docker/offsec-agents/

# Research Agent
docker build -f docker/offsec-agents/Dockerfile.research-tools \
  -t rtpi/research-tools:latest \
  docker/offsec-agents/
```

### Starting OffSec Agent Containers

The OffSec agents use the `offsec-agents` Docker Compose profile:

```bash
# Start all OffSec agents
docker compose --profile offsec-agents up -d

# Start specific agents only
docker compose up -d offsec-maldev offsec-research

# View agent logs
docker logs rtpi-maldev-agent
docker logs rtpi-research-agent
```

### Verifying Agent Health

Each agent runs an MCP server with a health check:

```bash
# Check all agent containers
docker compose --profile offsec-agents ps

# Verify MCP server is running
docker exec rtpi-maldev-agent pgrep -f "node.*mcp"

# Check agent logs for MCP startup
docker logs rtpi-maldev-agent 2>&1 | grep -i mcp
```

### Agent-Specific Ports

| Agent | Port | Service |
|-------|------|---------|
| Research | 8888 | JupyterLab notebooks |
| All agents | 9000 (internal) | MCP Server |

### Volumes and Persistence

Each agent has dedicated volumes for tool storage:

| Volume | Purpose |
|--------|---------|
| `maldev-tools` | Maldev agent tools |
| `azure-ad-tools` | Azure-AD agent tools |
| `burp-tools` | Burp agent tools |
| `empire-tools` | Empire agent tools |
| `fuzzing-tools` | Fuzzing agent tools |
| `fuzzing-wordlists` | Shared wordlists (SecLists, fuzzdb) |
| `framework-tools` | Framework agent tools |
| `research-tools` | Research agent tools |
| `research-notebooks` | Jupyter notebooks |
| `shared-data` | Shared data across all agents |

### Troubleshooting OffSec Agents

**Agent won't start:**
```bash
# Check logs for errors
docker logs rtpi-maldev-agent

# Rebuild if necessary
docker compose build --no-cache offsec-maldev
docker compose --profile offsec-agents up -d
```

**MCP server not responding:**
```bash
# Enter container and check
docker exec -it rtpi-maldev-agent bash
ps aux | grep node
cat /mcp/dist/index.js  # Verify build exists
```

**Base image missing:**
```bash
# Verify base image exists
docker images | grep rtpi/offsec-base

# Rebuild if missing
docker compose --profile build-only build offsec-base
```

---

## SysReptor Reporting Platform

[SysReptor](https://docs.sysreptor.com/) is an optional, self-hosted penetration testing reporting platform bundled with RTPI. It provides engagement documentation, finding templates, and branded report export (PDF/HTML). It runs behind its own Caddy reverse proxy and is gated behind the `sysreptor` Compose profile — it does **not** start with the default `docker compose up`.

### Architecture

Three containers ship together under the `sysreptor` profile:

| Container | Image | Role |
|---|---|---|
| `rtpi-sysreptor-app` | `syslifters/sysreptor:2025.37` | Django app + API |
| `rtpi-sysreptor-caddy` | `caddy:2.8` | Reverse proxy on port 7777 (primary entry point) |
| `rtpi-sysreptor-redis` | `bitnami/redis:latest` | Celery broker/result backend |

SysReptor reuses the shared `rtpi-postgres` instance — its `sysreptor` database is created automatically on first init via `docker/postgres-init/`.

### Configuration

1. **Copy the example env file:**

```bash
cp configs/rtpi-sysreptor/app.env.example configs/rtpi-sysreptor/app.env
```

2. **Generate secrets** and update `configs/rtpi-sysreptor/app.env`:

```bash
# Django SECRET_KEY
openssl rand -base64 50

# AES-256 encryption key for stored finding data (base64-encoded 32-byte key)
openssl rand -base64 32
```

Update the following fields in `app.env`:

- `SECRET_KEY` — Django secret
- `ENCRYPTION_KEYS` — the `key` value inside the JSON blob
- `ALLOWED_HOSTS` — add your actual hostname / IP if accessing remotely

3. **Set matching passwords in the root `.env`** (consumed by `docker-compose.yml`):

```bash
SYSREPTOR_DB_PASSWORD=<match-app.env-DATABASE_PASSWORD>
SYSREPTOR_REDIS_PASSWORD=<match-app.env-REDIS_PASSWORD>
SYSREPTOR_URL=http://rtpi-sysreptor-app:8000
SYSREPTOR_API_TOKEN=            # generate in UI after first login
```

### Starting SysReptor

```bash
# Bring up SysReptor alongside the core stack
docker compose --profile sysreptor up -d

# Logs
docker compose logs -f sysreptor-app sysreptor-caddy sysreptor-redis
```

The Caddy proxy is the supported entry point. Access the UI at **http://localhost:7777**. Direct access to port 9000 (the app container) is exposed for debugging but bypasses Caddy's `X-Forwarded-*` handling.

### First-Time Setup

1. Create a superuser inside the running container:

```bash
docker compose exec sysreptor-app python3 manage.py createsuperuser
```

2. Log in at `http://localhost:7777`, generate an API token under **User Settings → API Tokens**, and paste it into `SYSREPTOR_API_TOKEN` in the root `.env` so the RTPI backend can push findings.

### Integration with RTPI

The RTPI backend exports findings to SysReptor via the API token above. Confirm the wiring:

```bash
curl -H "Authorization: Bearer $SYSREPTOR_API_TOKEN" http://localhost:7777/api/v1/pentestprojects/
```

### Stopping / Removing

```bash
# Stop only the SysReptor profile
docker compose --profile sysreptor down

# Remove SysReptor data volumes (DESTRUCTIVE)
docker volume rm rtpi_sysreptor-app-data rtpi_sysreptor-caddy-data
```

The `sysreptor` database inside `rtpi-postgres` is **not** removed by `down` — drop it manually if you want a clean re-init:

```bash
docker compose exec postgres psql -U rtpi -c "DROP DATABASE sysreptor;"
```

### Troubleshooting SysReptor

- **UI won't load / 502 from Caddy**: the `sysreptor-app` container is still running migrations on first start. Tail logs with `docker compose logs -f sysreptor-app`; first boot can take 1–2 minutes.
- **"DisallowedHost" errors in app logs**: add the hostname you're using to `ALLOWED_HOSTS` in `configs/rtpi-sysreptor/app.env` and restart the app container.
- **Login loops / session errors**: check that `SECURE_SSL_REDIRECT=on` matches your deployment. For local HTTP-only access, set it to `off`.
- **Empty/failed exports**: confirm `REDIS_PASSWORD` in `app.env` matches `SYSREPTOR_REDIS_PASSWORD` — Celery workers fail silently when they can't reach Redis.

---

## VPN Tunnel Manager

The `vpn` profile ships an OpenVPN / WireGuard tunnel host (`rtpi-vpn-manager`) that owns the tunnel interfaces on behalf of every other RTPI container. It does **not** start with the default `docker compose up`.

> **Status (v2.9.2 Phase 1):** The container, entrypoint, and healthcheck are in place. The backend service, REST API, frontend Infrastructure → VPN tab, and per-container routing automation land in later phases of [v2.9.2](enhancements/2.9/v2.9.2-vpn-infrastructure-integration.md). For now the container is operated via `docker exec`; uploading and managing configs through the UI is not yet available.

### Architecture

| Container | Image | Role |
|---|---|---|
| `rtpi-vpn-manager` | `./docker/vpn-manager` (Ubuntu 22.04 + openvpn + wireguard-tools) | Long-running supervisor; spawns `openvpn` / `wg-quick` on demand and tracks their state under `/var/run/vpn`. |

The container runs with `cap_add: NET_ADMIN`, the host's `/dev/net/tun` device passed through, and `net.ipv4.ip_forward=1` so it can program iptables rules and route traffic. The `wireguard` kernel module must be present **on the host** — the container only ships userspace tools.

### Host Prerequisites

Verify TUN/TAP and WireGuard support on the host before bringing the profile up:

```bash
# TUN/TAP device must exist
ls -la /dev/net/tun

# WireGuard kernel module must be loadable
lsmod | grep wireguard || sudo modprobe wireguard

# Persist the module across reboots (Ubuntu/Debian)
echo wireguard | sudo tee -a /etc/modules-load.d/wireguard.conf
```

If `/dev/net/tun` is missing, install the TUN module (`sudo modprobe tun`) and persist it the same way.

### Starting the VPN Manager

```bash
# Build the image and start the container
docker compose --profile vpn build vpn-manager
docker compose --profile vpn up -d vpn-manager

# Confirm it's healthy
docker compose --profile vpn ps vpn-manager
```

Three named volumes are created on first start:

- `vpn-configs` → `/etc/openvpn/configs` inside the container
- `wg-configs` → `/etc/wireguard/configs` inside the container
- `vpn-logs` → `/var/log/vpn` inside the container

### Smoke Test

```bash
# List configs (empty array on first run — no configs uploaded yet)
docker exec rtpi-vpn-manager /usr/local/bin/vpn-entrypoint.sh list

# Status of all known tunnels (empty array on first run)
docker exec rtpi-vpn-manager /usr/local/bin/vpn-entrypoint.sh status

# Healthcheck script (exits 0 when the daemon, /dev/net/tun, and any active
# tunnels are all in a good state)
docker exec rtpi-vpn-manager /usr/local/bin/vpn-health-check.sh && echo OK
```

### Manually Connecting a Tunnel (interim, until Phase 2 ships the UI)

**OpenVPN:**

```bash
# Copy a .ovpn into the configs volume (filename minus .ovpn becomes the tunnel name)
docker cp ./client.ovpn rtpi-vpn-manager:/etc/openvpn/configs/client.ovpn

# Bring it up
docker exec rtpi-vpn-manager /usr/local/bin/vpn-entrypoint.sh connect openvpn client

# Verify
docker exec rtpi-vpn-manager /usr/local/bin/vpn-entrypoint.sh status client
docker exec rtpi-vpn-manager ip addr show tun0

# Tear down
docker exec rtpi-vpn-manager /usr/local/bin/vpn-entrypoint.sh disconnect openvpn client
```

**WireGuard:**

```bash
# Copy a .conf into the wg-configs volume
docker cp ./peer.conf rtpi-vpn-manager:/etc/wireguard/configs/peer.conf

# Bring it up (the entrypoint symlinks it into /etc/wireguard/peer.conf for wg-quick)
docker exec rtpi-vpn-manager /usr/local/bin/vpn-entrypoint.sh connect wireguard peer

# Verify
docker exec rtpi-vpn-manager wg show
docker exec rtpi-vpn-manager /usr/local/bin/vpn-entrypoint.sh status peer

# Tear down
docker exec rtpi-vpn-manager /usr/local/bin/vpn-entrypoint.sh disconnect wireguard peer
```

The container shuts down all active tunnels cleanly on `docker stop` (SIGTERM is trapped by the entrypoint).

### Routing Other Containers Through the VPN

This is **not yet wired up** in Phase 1. Until the Phase 5 Docker executor lands, you can manually route a single container through the tunnel by setting `network_mode: "container:rtpi-vpn-manager"` on it in a compose override file. Note that this pins the container to the VPN manager's lifetime — if `vpn-manager` restarts, the routed container loses connectivity until it restarts too. The Phase 5 executor will replace this with iptables-based per-container NAT that survives restarts.

### Stopping / Removing

```bash
# Stop only the VPN profile
docker compose --profile vpn down

# Remove VPN data volumes (DESTRUCTIVE — wipes all uploaded configs and logs)
docker volume rm rtpi_vpn-configs rtpi_wg-configs rtpi_vpn-logs
```

### Troubleshooting VPN Manager

- **`/dev/net/tun` missing** in the container's healthcheck output: the host doesn't have the TUN module loaded. Run `sudo modprobe tun` on the host and recreate the container.
- **`wg-quick up` fails with `RTNETLINK answers: Operation not supported`**: the host kernel does not have the `wireguard` module loaded. Run `sudo modprobe wireguard` on the host.
- **OpenVPN "auth-user-pass file does not exist"**: the .ovpn references a credentials file that wasn't shipped with the upload. Either embed the credentials inline (`<auth-user-pass>...</auth-user-pass>`) or `docker cp` the credentials file into `/etc/openvpn/configs/` alongside the .ovpn.
- **Stale pidfile** flagged by the healthcheck: an openvpn process exited but its pidfile in `/var/run/vpn/openvpn-<name>.pid` was left behind. Clean up with `docker exec rtpi-vpn-manager rm /var/run/vpn/openvpn-<name>.pid` and re-run `connect`.
- **Container won't start due to "operation not permitted"**: confirm `cap_add: NET_ADMIN` is honored — some hardened Docker daemons block capability adds. Check `docker info | grep -i seccomp` and your host's `/etc/docker/daemon.json`.

---

## Development Deployment

### Local Development Setup

1. **Clone the repository:**

```bash
git clone <repository-url>
cd unified-rtpi
```

2. **Install dependencies:**

```bash
npm install
```

3. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start services with Docker Compose:**

```bash
docker compose up -d
```

5. **Run database migrations:**

```bash
npm run db:push
```

6. **Start development servers:**

The application requires both backend and frontend servers to be running:

```bash
# Terminal 1: Start backend API server
npm run dev

# Terminal 2: Start frontend development server (in a new terminal)
npm run dev:frontend
```

**Access Points:**
- **Frontend UI**: `http://localhost:5000` (or 5001 if 5000 is busy)
- **Backend API**: `http://localhost:3001`
- **API Documentation**: `http://localhost:3001/api/v1`

**Note**: Always access the application through the frontend URL (port 5000/5001). The backend port (3001) serves API responses only and has no user interface.

### Development with Docker

Use the development Docker Compose configuration:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Stop services
docker compose down
```

---

## Production Deployment

### Method 1: Docker Compose (Recommended)

1. **Prepare production environment:**

```bash
# Clone repository
git clone <repository-url>
cd unified-rtpi

# Create production environment file
cp .env.example .env
# Configure .env with production values
```

2. **Build and start services:**

```bash
docker compose -f docker-compose.prod.yml up -d
```

3. **Run database migrations:**

```bash
docker compose -f docker-compose.prod.yml exec app npm run db:push
```

4. **Verify deployment:**

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs
```

### Method 2: Manual Deployment

1. **Install system dependencies:**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm postgresql redis-server nginx certbot python3-certbot-nginx

# Verify installations
node --version
npm --version
psql --version
redis-cli --version
```

2. **Configure PostgreSQL:**

```bash
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE rtpi_main;
CREATE USER rtpi WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE rtpi_main TO rtpi;
\q
```

3. **Configure Redis:**

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

4. **Deploy application:**

```bash
# Create application directory
sudo mkdir -p /opt/rtpi
sudo chown $USER:$USER /opt/rtpi

# Clone and setup
cd /opt/rtpi
git clone <repository-url> .
npm install --production

# Configure environment
cp .env.example .env
# Edit .env with production values

# Build application
npm run build

# Run migrations
npm run db:push
```

5. **Setup process manager (PM2):**

```bash
npm install -g pm2

# Start application
pm2 start npm --name "rtpi" -- start

# Configure PM2 to start on boot
pm2 startup
pm2 save
```

---

## Docker Deployment

### Production Docker Compose

The `docker-compose.prod.yml` file includes optimized production settings:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    container_name: rtpi-postgres
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: rtpi-redis
    restart: always
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: rtpi-app
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads

volumes:
  postgres_data:
  redis_data:
```

### Docker Management Commands

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f app

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop services
docker compose -f docker-compose.prod.yml down

# Stop services and remove volumes (WARNING: deletes data)
docker compose -f docker-compose.prod.yml down -v

# Update application
git pull
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Run database migrations after update
docker compose -f docker-compose.prod.yml exec app npm run db:push

# Database backup
docker exec rtpi-postgres-prod pg_dump -U rtpi rtpi_main > backup.sql

# Database restore
docker exec -i rtpi-postgres-prod psql -U rtpi rtpi_main < backup.sql

# Access PostgreSQL shell
docker exec -it rtpi-postgres-prod psql -U rtpi -d rtpi_main

# Access Redis CLI
docker exec -it rtpi-redis-prod redis-cli -a YOUR_REDIS_PASSWORD
```

---

## Database Setup

### Initial Database Setup

1. **Create database:**

```sql
CREATE DATABASE rtpi_main;
CREATE USER rtpi WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE rtpi_main TO rtpi;
```

2. **Run migrations:**

```bash
npm run db:push
```

3. **Verify schema:**

```bash
npm run db:studio
```

### Database Migrations

**Important**: Drizzle Kit commands have been updated for compatibility with version 0.20.0+.

```bash
# Generate new migration
npm run db:generate

# Apply migrations (push schema changes to database)
npm run db:push

# Open database studio (visual database browser)
npm run db:studio
```

**Using Docker**: If your database is running in Docker, run migrations from the host machine:

```bash
# Ensure .env file has correct DATABASE_URL for Docker
# For Docker: postgresql://rtpi:password@localhost:5434/rtpi_main
npm run db:push

# Or run from within the app container
docker compose exec app npm run db:push
```

### Database Connection Pooling

For production, configure connection pooling in the database URL:

```bash
DATABASE_URL=postgresql://rtpi:password@localhost:5434/rtpi_main?pool_timeout=0&pool_max_conns=10
```

---

## Security Configuration

### SSL/TLS Setup

#### Using Certbot with nginx

1. **Install certbot:**

```bash
sudo apt install certbot python3-certbot-nginx
```

2. **Configure nginx:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

3. **Obtain SSL certificate:**

```bash
sudo certbot --nginx -d yourdomain.com
```

4. **Auto-renewal:**

```bash
sudo certbot renew --dry-run
```

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Deny direct access to database and redis
sudo ufw deny 5434/tcp
sudo ufw deny 6381/tcp
```

### Environment Security

1. **Protect environment files:**

```bash
chmod 600 .env
chown root:root .env
```

2. **Use secure secrets:**

- Never commit `.env` files to version control
- Rotate secrets regularly
- Use strong, randomly generated passwords
- Store secrets in a secure vault (e.g., HashiCorp Vault)

### OAuth Configuration

1. **Google OAuth Setup:**

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - `https://yourdomain.com/api/v1/auth/google/callback`
   - Copy Client ID and Client Secret to `.env`

### Rate Limiting

The application includes built-in rate limiting. Configure in production:

```javascript
// Authentication: 5 requests per 15 minutes
// Password changes: 3 requests per 15 minutes
// General API: 100 requests per 15 minutes
```

---

## Monitoring and Logging

### Application Logging

Logs are written to stdout/stderr and can be captured:

```bash
# Docker logs
docker compose -f docker-compose.prod.yml logs -f app

# PM2 logs
pm2 logs rtpi

# System logs
journalctl -u rtpi -f
```

### Health Check Endpoints

Monitor application health:

```bash
# System health
curl http://localhost:3000/api/v1/health-checks

# Database health
curl http://localhost:3000/api/v1/health-checks/database

# Redis health
curl http://localhost:3000/api/v1/health-checks/redis

# Agent system health
curl http://localhost:3000/api/v1/agents/health

# Workflow orchestrator status
curl http://localhost:3000/api/v1/workflows/status

# Nuclei templates statistics
curl http://localhost:3000/api/v1/nuclei-templates/stats
```

### Monitoring Tools

#### Prometheus + Grafana

1. **Add monitoring to docker-compose:**

```yaml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  volumes:
    - grafana_data:/var/lib/grafana
```

#### Application Performance Monitoring

Consider integrating:
- **Sentry** for error tracking
- **DataDog** for comprehensive monitoring
- **New Relic** for APM

---

## Backup and Recovery

### Database Backups

#### Automated Backup Script

```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/var/backups/rtpi"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/rtpi_backup_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

# Backup database (use correct container name for production)
docker exec rtpi-postgres-prod pg_dump -U rtpi rtpi_main > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

#### Setup Cron Job

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/rtpi/backup-db.sh
```

### Database Restore

```bash
# Decompress backup
gunzip rtpi_backup_20250111_020000.sql.gz

# Restore database
docker exec -i rtpi-postgres psql -U rtpi rtpi_main < rtpi_backup_20250111_020000.sql
```

### File Backups

Backup the uploads directory:

```bash
# Create backup
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz ./uploads

# Restore backup
tar -xzf uploads_backup_20250111.tar.gz
```

### Disaster Recovery Plan

1. **Regular backups**: Daily database, weekly full system
2. **Off-site storage**: Store backups in different location/cloud
3. **Test restores**: Regularly verify backup integrity
4. **Documentation**: Maintain recovery procedures
5. **Monitoring**: Alert on backup failures

---

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check PostgreSQL status (use production container names)
docker compose -f docker-compose.prod.yml ps postgres
docker compose -f docker-compose.prod.yml logs postgres

# Verify connection
docker exec -it rtpi-postgres-prod psql -U rtpi -d rtpi_main

# Check network connectivity
docker network inspect rtpi-network

# Test connection from app container
docker compose -f docker-compose.prod.yml exec app nc -zv postgres 5434
```

#### Redis Connection Errors

```bash
# Check Redis status
docker compose -f docker-compose.prod.yml ps redis
docker compose -f docker-compose.prod.yml logs redis

# Test Redis connection with password
docker exec -it rtpi-redis-prod redis-cli -a YOUR_REDIS_PASSWORD ping

# Should return: PONG

# Test from app container
docker compose -f docker-compose.prod.yml exec app nc -zv redis 6381
```

#### Application Won't Start

```bash
# Check logs
docker compose logs app

# Verify environment variables
docker compose config

# Check port availability
sudo netstat -tlnp | grep 3000
```

#### High Memory Usage

```bash
# Check container stats
docker stats

# Increase memory limits in docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
```

#### OAuth Callback Errors

1. Verify OAuth credentials in `.env`
2. Check authorized redirect URIs in Google Console
3. Ensure callback URL matches exactly (including protocol)
4. Check for CORS issues

### Performance Issues

#### Slow Database Queries

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s

-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

#### Redis Performance

```bash
# Check Redis stats
docker exec rtpi-redis redis-cli INFO stats

# Monitor commands
docker exec rtpi-redis redis-cli MONITOR
```

### Debug Mode

Enable debug logging:

```bash
# In .env
NODE_ENV=development
DEBUG=*
```

---

## Scaling

### Horizontal Scaling

#### Load Balancer Configuration

```nginx
upstream rtpi_backend {
    least_conn;
    server app1.local:3000;
    server app2.local:3000;
    server app3.local:3000;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    location / {
        proxy_pass http://rtpi_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Database Scaling

#### Read Replicas

Configure PostgreSQL streaming replication:

```bash
# Primary server
DATABASE_URL=postgresql://rtpi:pass@primary:5434/rtpi_main

# Read replica
DATABASE_REPLICA_URL=postgresql://rtpi:pass@replica:5434/rtpi_main
```

#### Connection Pooling

Use PgBouncer for connection pooling:

```yaml
pgbouncer:
  image: pgbouncer/pgbouncer
  environment:
    DATABASES: rtpi_main=host=postgres dbname=rtpi_main
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 1000
    DEFAULT_POOL_SIZE: 25
```

### Redis Scaling

#### Redis Cluster

For high availability:

```yaml
redis-cluster:
  image: redis:7-alpine
  command: redis-server --cluster-enabled yes
```

### Vertical Scaling

Increase resources in docker-compose:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

---

## Post-Deploy Verification

`docker compose up -d` exits as soon as containers *start*, not when they're
*working*. Several real classes of failure (broken entrypoint, baked-in
default password, mismatched healthcheck) only surface after the first run
loop. Production deploys must gate on a verification step that catches these
before declaring success.

### Running

```bash
npm run deploy:verify
# or directly:
bash scripts/deploy-verify.sh [--timeout 300] [--stability 30] [--project rtpi]
```

The script polls every container labeled
`com.docker.compose.project=<project>` and fails the deploy if any container:

| Symptom | Detection |
|---|---|
| Restart loop (broken entrypoint / command) | `state=restarting` or `RestartCount` grew during the run |
| Crash loop (e.g. wrong DB password) | `state=exited` with non-zero exit, or rising restart count |
| Pinned unhealthy (wrong healthcheck) | `health=unhealthy` after `start_period` |
| Stuck starting (deadlock) | Stays out of `healthy` past `--timeout` |

One-shot init containers (those declared with `restart: "no"` and used as
`service_completed_successfully` dependencies) are recognized — they pass when
they exit 0.

### Exit codes

- `0` — every container reached a stable healthy state for at least
  `--stability` seconds (default 30s).
- `2` — at least one container is in a hard-fail state. The script dumps the
  last 25 log lines and an inspect summary for each failure.
- `3` — timeout reached and at least one container never settled. Same
  diagnostics.

### Recommended deploy sequence

```bash
npm run deploy:check                    # environment / port / .env validation
docker compose --profile <p> up -d      # start the stack
npm run deploy:verify                   # gate — exits non-zero on failure
# [migrations / smoke tests / etc.]
```

In CI/CD, treat a non-zero exit from `deploy:verify` as a blocker. The
diagnostic output is sufficient to identify the failing container without
opening a shell on the host.

### Tuning

| Flag | Default | When to change |
|---|---|---|
| `--timeout` | 300s | Increase if slow-starting services have long `start_period` healthchecks (e.g. databases initializing storage). |
| `--stability` | 30s | Increase to demand a longer "still healthy" window — useful for catching late-arriving crash loops. |
| `--poll` | 3s | Rarely changed. |
| `--ignore name1,name2` | — | Skip containers known to be optional (profile-gated) but happen to be running. |

Environment variable equivalents: `RTPI_VERIFY_TIMEOUT`,
`RTPI_VERIFY_STABILITY`, `RTPI_VERIFY_POLL`, `RTPI_VERIFY_PROJECT`,
`RTPI_VERIFY_IGNORE`.

### Relationship to `container-healer`

The healer (systemd timer `rtpi-container-healer.timer`) is a *reactive*
watchdog that runs periodically and tries to repair already-broken containers
with `docker restart` or targeted `compose up`. It catches transient drift
*after* a deploy succeeded.

`deploy-verify.sh` runs *during* the deploy and prevents bad state from being
declared "shipped" in the first place. The two are complementary, not
overlapping: verify gates the rollout, healer keeps it healthy in steady
state.

## Maintenance

### Regular Maintenance Tasks

#### Daily

- Monitor application logs
- Check health endpoints
- Review error rates
- Verify backup completion

#### Weekly

- Database vacuum and analyze
- Review slow queries
- Update dependencies (security patches)
- Review disk usage

#### Monthly

- Full system backup
- Security audit
- Performance review
- Dependency updates

### Update Procedure

```bash
# 1. Backup current state
./backup-db.sh

# 2. Pull latest changes
git pull

# 3. Update dependencies
npm install

# 4. Run migrations
npm run db:push

# 5. Build application
npm run build

# 6. Restart services
docker compose -f docker-compose.prod.yml restart app

# 7. Verify deployment
curl http://localhost:3000/api/v1/health-checks
```

---

## Support and Resources

### Documentation

- [README](../README.md) - Project overview
- [Development Guide](DEVELOPMENT.md) - Development setup
- [API Documentation](API.md) - API reference

### Getting Help

- Check logs first: `docker compose logs`
- Review this troubleshooting guide
- Check GitHub issues
- Contact system administrator

### Security Reporting

For security vulnerabilities, please follow responsible disclosure:
1. Do not file public issues
2. Email security concerns directly to administrators
3. Include detailed reproduction steps
4. Allow reasonable time for patching

---

## Checklist for Production Deployment

### Infrastructure
- [ ] System requirements met
- [ ] Docker and Docker Compose installed
- [ ] Firewall rules configured
- [ ] SSL/TLS certificates obtained (if exposing directly to internet)
- [ ] Network isolation configured for containers

### Configuration
- [ ] `.env` file created from `.env.example`
- [ ] All environment variables configured (especially `REDIS_PASSWORD`)
- [ ] Secure secrets generated (`SESSION_SECRET`, `JWT_SECRET`)
- [ ] Database credentials set (`DB_USER`, `DB_PASSWORD`, `DB_NAME`)
- [ ] OAuth providers configured (if used)
- [ ] CORS settings configured for production domain

### Deployment
- [ ] Pre-deployment environment check passed: `npm run deploy:check`
- [ ] Application built: `docker compose -f docker-compose.prod.yml build`
- [ ] Services started: `docker compose -f docker-compose.prod.yml up -d`
- [ ] **Post-deploy verification gate passed: `npm run deploy:verify`** (fails the deploy if any container is in a restart loop, exited unexpectedly, or stays unhealthy past the stability window — see `## Post-Deploy Verification` below)
- [ ] Database migrations applied: `docker compose -f docker-compose.prod.yml exec app npm run db:push`
- [ ] Health endpoints accessible and returning healthy status

### RTPI-Tools Container
- [ ] rtpi-tools container built successfully
- [ ] rtpi-tools container running and healthy
- [ ] Security tools database seeded: `npx tsx scripts/seed-tools.ts`
- [ ] Tool execution tested via API
- [ ] Container volumes configured for persistence
- [ ] Tool execution logs accessible

### Security
- [ ] Container running as non-root user verified
- [ ] Command validation enabled
- [ ] Resource limits configured
- [ ] Audit logging functional
- [ ] Security audit completed

### Agent System (v2.1)
- [ ] `AGENT_AUTO_INITIALIZE=true` set in environment
- [ ] Workflow retry variables configured
- [ ] Agent system auto-initializes on server start
- [ ] Default workflow templates seeded (5 templates)
- [ ] Workflow event triggers functional
- [ ] Agent health endpoint responding: `/api/v1/agents/health`
- [ ] Nuclei templates API accessible
- [ ] Graceful shutdown tested (workflows pause correctly)

### OffSec Agent Containers
- [ ] Base image built: `rtpi/offsec-base:latest`
- [ ] All agent images built successfully
- [ ] Agent containers start without errors
- [ ] MCP servers running in each container
- [ ] Research agent JupyterLab accessible on port 8888
- [ ] Volumes created and mounted correctly
- [ ] Docker socket mounted for container management
- [ ] Health checks passing for all agents

### Operations
- [ ] Backup system configured and tested
- [ ] Monitoring and alerting setup
- [ ] Log aggregation configured
- [ ] Performance baseline established
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Rollback procedure tested
- [ ] Disaster recovery plan documented
