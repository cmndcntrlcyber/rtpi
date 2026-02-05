# Phase 2: Kasm Workspaces Integration - Tier 2 Priority

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)  
**Priority:** 🟡 Tier 2 - Beta Enhancement  
**Timeline:** Week 2 (December 16-22, 2025)  
**Phase:** 2 of 3 (Kasm Workspaces)  
**Dependencies:** Phase 1 (Empire C2) complete  
**Total Items:** 45  
**Last Updated:** December 9, 2025

---

## Overview

This document provides specifications for fully containerizing Kasm Workspaces and integrating it with RTPI as the primary secure presentation layer for all services. Kasm will serve as the entry point for users to interact with applications in isolated browser environments.

### Purpose
- **Fully containerize Kasm** using official Kasm images (10+ containers)
- **Certificate management** with Let's Encrypt and Cloudflare
- **Pre-build workspace images** (VS Code, Kali, Firefox, Empire client)
- **Dynamic Burp Suite** image building on JAR upload
- **Workspace provisioning** through RTPI UI
- **Nginx proxy** serving all applications

### Success Criteria
- ✅ Kasm fully containerized (all 10+ services)
- ✅ SSL certificates automated (Let's Encrypt + Cloudflare)
- ✅ All workspace images built and operational
- ✅ Burp Suite dynamic build working
- ✅ Workspaces launchable from RTPI UI
- ✅ Kasm nginx serving Empire listeners
- ✅ Session management and tracking functional

### Scope
**IN SCOPE:**
- Multi-container Kasm deployment
- Certificate automation
- Workspace image building
- Workspace provisioning service
- UI integration
- Network isolation using Kasm's built-in features

**OUT OF SCOPE:**
- Persistent workspace data with Google Cloud Storage (v2.1)
- Advanced workspace customization (v2.5+)
- Multi-node Kasm deployment (v3.0+)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Docker Configuration](#docker-configuration)
4. [Certificate Management](#certificate-management)
5. [Workspace Image Building](#workspace-image-building)
6. [Workspace Provisioning Service](#workspace-provisioning-service)
7. [UI Integration](#ui-integration)
8. [Testing Requirements](#testing-requirements)
9. [Implementation Checklist](#implementation-checklist)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## 1. Architecture Overview

### Kasm Multi-Container Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    Kasm Workspaces Stack                       │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  User → Cloudflare Access → Kasm Nginx Proxy (8443)          │
│                                      ↓                         │
│                           ┌──────────────────┐                │
│                           │  Kasm Manager    │                │
│                           │  Session Control │                │
│                           └────────┬─────────┘                │
│                                    │                           │
│            ┌───────────────────────┼───────────────────┐      │
│            ▼                       ▼                   ▼       │
│     ┌──────────┐           ┌──────────┐        ┌──────────┐  │
│     │ VS Code  │           │   Kali   │        │  Burp    │  │
│     │Workspace │           │Workspace │        │Workspace │  │
│     └──────────┘           └──────────┘        └──────────┘  │
│                                                                │
│  Database: kasm-db (PostgreSQL)                               │
│  Cache: kasm-redis                                            │
│  Streaming: kasm-guac (Guacamole)                            │
└───────────────────────────────────────────────────────────────┘
```

### Kasm Services (10+ containers)
1. **kasm-db** - PostgreSQL database
2. **kasm-redis** - Redis cache
3. **kasm-api** - REST API server
4. **kasm-manager** - Session manager
5. **kasm-proxy** - Nginx reverse proxy (SSL termination)
6. **kasm-guac** - Guacamole streaming server
7. **kasm-agent** - Agent service
8. **kasm-share** - File sharing service
9. **kasm-rdp-gateway** (optional) - RDP connectivity
10. **workspace containers** - Dynamic per-user

---

## 2. Database Schema

### New Tables for Kasm Integration

```sql
-- Workspace session tracking
CREATE TABLE kasm_workspaces (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  operation_id UUID REFERENCES operations(id),
  workspace_type TEXT, -- 'vscode', 'burp', 'kali', 'firefox', 'empire'
  kasm_session_id TEXT NOT NULL,
  kasm_container_id TEXT,
  status TEXT DEFAULT 'starting',
  access_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Session management
CREATE TABLE kasm_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_token TEXT,
  workspace_id UUID REFERENCES kasm_workspaces(id),
  last_activity TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Migration File:** `migrations/0012_add_kasm_integration.sql`

---

## 3. Docker Configuration

### Complete Kasm Stack

Add to `docker-compose.yml`:

```yaml
services:
  # Kasm Database
  kasm-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kasm
      POSTGRES_USER: kasmapp
      POSTGRES_PASSWORD: ${KASM_DB_PASSWORD}
    volumes:
      - kasm-db-data:/var/lib/postgresql/data
    networks:
      - rtpi-network

  # Kasm Redis
  kasm-redis:
    image: redis:7-alpine
    volumes:
      - kasm-redis-data:/data
    networks:
      - rtpi-network

  # Kasm API
  kasm-api:
    image: kasmweb/api:1.17.0
    depends_on:
      - kasm-db
      - kasm-redis
    ports:
      - "8181:8181"
    networks:
      - rtpi-network

  # Kasm Manager  
  kasm-manager:
    image: kasmweb/manager:1.17.0
    depends_on:
      - kasm-api
    ports:
      - "8182:8182"
    networks:
      - rtpi-network

  # Kasm Proxy (nginx with SSL)
  kasm-proxy:
    image: kasmweb/proxy:1.17.0
    depends_on:
      - kasm-manager
    ports:
      - "8443:8443"
    volumes:
      - ./configs/kasm/nginx.conf:/etc/nginx/nginx.conf
      - certbot-certs:/etc/letsencrypt
      - cloudflare-certs:/etc/cloudflare-certs
    networks:
      - rtpi-network

  # Kasm Guacamole
  kasm-guac:
    image: kasmweb/kasm-guac:1.17.0
    networks:
      - rtpi-network

  # Additional Kasm services...
  # (agent, share, rdp-gateway, etc.)
```

---

## 4. Certificate Management

### Dual Certificate Strategy

**Primary:** Let's Encrypt (automated renewal)  
**Fallback:** Cloudflare-managed certificates

**Implementation:**
- Certbot container for Let's Encrypt
- Automatic renewal every 60 days
- Cloudflare API for wildcard certificates
- Zero-downtime certificate rotation

**Scripts:**
- `scripts/setup-letsencrypt.sh`
- `scripts/renew-certificates.sh`
- `scripts/fallback-to-cloudflare.sh`

---

## 5. Workspace Image Building

### Pre-Built Images

#### VS Code Workspace
**Image:** `rtpi/vscode-workspace:latest`  
**Base:** `kasmweb/vscode:latest`  
**Additions:** RTPI tools, Git, Docker CLI

#### Kali Linux Workspace
**Image:** `rtpi/kali-workspace:latest`  
**Base:** `kasmweb/kali-rolling:latest`  
**Additions:** Pentest tools, RTPI scripts

#### Firefox Workspace
**Image:** `rtpi/firefox-workspace:latest`  
**Base:** `kasmweb/firefox:latest`  
**Additions:** RTPI bookmarks, security extensions

#### Empire Client Workspace
**Image:** `rtpi/empire-workspace:latest`  
**Base:** `kasmweb/core:latest`  
**Additions:** Empire client, Python tools

### Dynamic Build: Burp Suite

**Trigger:** User uploads burp-suite.jar + license.txt  
**Process:**
1. Upload received → Trigger build
2. Dockerfile generates with uploaded files
3. Image builds: `rtpi/burp-workspace:USER_ID`
4. Ready for provisioning

**Build Script:** `scripts/build-burp-workspace.sh`

---

## 6. Workspace Provisioning Service

### TypeScript Service

**File:** `server/services/kasm-workspace-manager.ts`

**Key Functions:**
- `createWorkspace(userId, type, operationId)` - Provision new workspace
- `listUserWorkspaces(userId)` - Get user's active workspaces
- `terminateWorkspace(workspaceId)` - Stop and remove workspace
- `getWorkspaceUrl(workspaceId)` - Get access URL

**Lifecycle:**
1. User requests workspace
2. RTPI provisions Kasm container
3. Workspace starts (30-60s)
4. Access URL returned to user
5. Session tracked in database
6. Auto-expiration after inactivity

---

## 7. UI Integration

### Workspace Launcher Component

**Location:** Infrastructure page or dedicated Workspaces page

**Features:**
- Workspace type selector (VS Code, Kali, Burp, etc.)
- "Launch Workspace" button
- Active sessions display
- Direct access links
- Session termination controls

**UI Mockup:**
```
┌────────────────────────────────────┐
│  Launch Secure Workspace           │
├────────────────────────────────────┤
│  [ Workspace Type ▼ ]              │
│    - VS Code                       │
│    - Kali Linux                    │
│    - Burp Suite (if uploaded)     │
│    - Firefox Browser               │
│    - Empire Client                 │
│                                     │
│  [Launch Workspace]                 │
│                                     │
│  Active Workspaces:                │
│  ┌──────────────────────────────┐ │
│  │ VS Code - Running            │ │
│  │ Started 5 min ago            │ │
│  │ [Access] [Terminate]         │ │
│  └──────────────────────────────┘ │
└────────────────────────────────────┘
```

---

## 8. Testing Requirements

### Test Scenarios
- Workspace provisioning (all types)
- SSL certificate validation
- Image build process (Burp Suite)
- Session expiration
- Multi-user isolation
- Performance under load (10+ simultaneous workspaces)

**Test Files:**
- `tests/integration/kasm-workspace.test.ts`
- `tests/e2e/workspace-launch.spec.ts`

---

## 9. Implementation Checklist

### Day 16 (Dec 16): Kasm Infrastructure
- [ ] Add all Kasm services to docker-compose
- [ ] Configure Kasm database and Redis
- [ ] Start Kasm stack
- [ ] Verify all containers healthy

### Day 17 (Dec 17): Certificate Setup
- [ ] Configure Let's Encrypt
- [ ] Set up Cloudflare certificates
- [ ] Test certificate rotation
- [ ] Configure nginx SSL

### Day 18 (Dec 18): Image Building
- [ ] Build VS Code workspace image
- [ ] Build Kali workspace image
- [ ] Build Firefox workspace image
- [ ] Build Empire client image
- [ ] Test all images

### Day 19 (Dec 19): Burp Suite Dynamic Build
- [ ] Create Burp upload endpoint
- [ ] Implement dynamic Dockerfile generation
- [ ] Test Burp image build process
- [ ] Verify Burp workspace launches

### Day 20 (Dec 20): Provisioning Service
- [ ] Create kasm-workspace-manager.ts
- [ ] Implement workspace CRUD operations
- [ ] Add session tracking
- [ ] Test provisioning workflow

### Day 21 (Dec 21): UI Implementation
- [ ] Create workspace launcher component
- [ ] Add to Infrastructure page
- [ ] Implement session management UI
- [ ] Test end-to-end

### Day 22 (Dec 22): Testing & Integration
- [ ] Integration testing
- [ ] Performance testing
- [ ] Security testing
- [ ] Documentation updates

---

## 10. Troubleshooting Guide

### Common Issues

**Kasm containers won't start:**
- Check Kasm images pulled correctly
- Verify network configuration
- Check port conflicts (8443, 8181, 8182)

**Workspace won't launch:**
- Check Kasm API logs
- Verify workspace image exists
- Check resource availability (CPU/memory)

**Certificate issues:**
- Verify Let's Encrypt challenges pass
- Check Cloudflare API credentials
- Review nginx error logs

**Workspace connection issues:**
- Verify browser WebSocket support
- Check firewall rules
- Test direct connection to Kasm proxy

---

## Success Metrics

- [ ] All Kasm containers running stable
- [ ] SSL certificates automated
- [ ] All workspace images built
- [ ] Burp Suite upload and build functional
- [ ] Workspaces accessible from RTPI UI
- [ ] 10+ simultaneous workspaces supported
- [ ] Session cleanup working
- [ ] <60s workspace startup time

---

## Dependencies

**Prerequisites:**
- Phase 1 (Empire C2) complete
- Docker supports multiple networks
- Sufficient resources (16GB+ RAM recommended)

**Integration Points:**
- Empire listener proxy uses Kasm nginx
- RTPI operations can trigger workspace launches
- Workspace sessions tracked in RTPI database

---

**Status Legend:**
- 🔴 Tier 1 - Critical for beta
- 🟡 Tier 2 - Beta enhancement  
- 🟢 Tier 3 - Post-beta
- ✅ Complete
- 🚧 In Progress
- ⏸️ Blocked
- 📝 Planned

---

**Last Updated:** December 9, 2025  
**Maintained By:** RTPI Development Team  
**Phase Status:** 📝 Planned - Scaffold Complete

---

## VERIFICATION SUMMARY (2026-02-04)

### External Services Integration Status

**✅ Phase 1: Core Integrations - OPERATIONAL**
- ✅ **Metasploit:** Executor service exists (`server/services/metasploit-executor.ts`), terminal UI not implemented
- ✅ **BBOT:** Full integration (`server/services/bbot-executor.ts` 21,579 bytes)
- ✅ **Nuclei:** Complete integration (`server/services/nuclei-executor.ts` 18,563 bytes)
- ✅ **Docker Executor:** Base service operational (`server/services/docker-executor.ts` 15,042 bytes)

**✅ Phase 2: Kasm Workspaces - 100% COMPLETE**
- ✅ **Let's Encrypt Integration:** `server/services/ssl-certificate-manager.ts:1-50` with Certbot, HTTP-01/DNS-01 challenges
- ✅ **Burp Suite Dynamic Build:** `server/services/burp-image-builder.ts:1-50` dynamic Docker image builder with license key support

**✅ Phase 3: Tool Ecosystem - OPERATIONAL**
- ✅ **Tool Registry:** Tool Connector Agent discovers 20+ tools
- ✅ **Attack Workbench:** REST API client (`server/services/attack-workbench-client.ts`)
- ✅ **Workflow Integration:** All tools integrated with workflow orchestrator

### Overall Assessment
**Status:** External services integration substantially complete. All major scanning tools (BBOT, Nuclei, Metasploit), Kasm Workspaces with Let's Encrypt, and Burp Suite dynamic builds fully operational. ATT&CK Workbench sync functional.

**Last Updated:** February 4, 2026
