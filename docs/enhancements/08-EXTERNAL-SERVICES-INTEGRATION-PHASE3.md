# Phase 3: Ollama & Remaining Services - Tier 2 Priority

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)  
**Priority:** 🟡 Tier 2 - Beta Enhancement (Ollama) / Monitoring (Others)  
**Timeline:** Week 3 (December 23-29, 2025)  
**Phase:** 3 of 3 (Ollama, Portainer, SysReptor)  
**Dependencies:** Phases 1 & 2 complete  
**Total Items:** 30  
**Last Updated:** December 9, 2025

---

## Overview

This document provides specifications for integrating Ollama (local AI inference), Portainer (container management), and SysReptor (report generation) into RTPI. This phase focuses on optional AI capabilities and service monitoring.

### Purpose
- **Ollama integration** for local AI inference (GPU + CPU fallback)
- **Model management** (llama3:8b, qwen2.5-coder:7b)
- **Replace mock AI enrichment** with real local models
- **Portainer monitoring** for container management
- **SysReptor monitoring** for report status
- **llama.cpp fallback** for non-GPU systems

### Success Criteria
- ✅ Ollama running with GPU support (or CPU fallback)
- ✅ Models downloaded and operational (llama3:8b, qwen2.5-coder:7b)
- ✅ AI enrichment using local models
- ✅ Agents can use Ollama as AI backend
- ✅ Portainer accessible from RTPI UI
- ✅ SysReptor health monitored
- ✅ Auto-unload models after 30 min inactivity

### Scope
**IN SCOPE:**
- Ollama containerization (optional service)
- llama.cpp CPU fallback
- Model download and management
- AI enrichment replacement
- Portainer & SysReptor monitoring
- Basic UI integration

**OUT OF SCOPE:**
- SysReptor Technical Writer plugin (v2.5)
- Advanced model fine-tuning (v3.0+)
- Multi-GPU support (v3.0+)
- Model quantization pipeline (v3.0+)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Docker Configuration](#docker-configuration)
4. [Ollama Integration](#ollama-integration)
5. [llama.cpp CPU Fallback](#llamacpp-cpu-fallback)
6. [Model Management System](#model-management-system)
7. [AI Enrichment Replacement](#ai-enrichment-replacement)
8. [Service Monitoring](#service-monitoring)
9. [Implementation Checklist](#implementation-checklist)
10. [Testing & Validation](#testing-validation)

---

## 1. Architecture Overview

### Ollama Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Ollama AI Stack                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  RTPI Agents (need AI) → AI Enrichment Service             │
│                                      ↓                       │
│                           ┌──────────────────┐              │
│                           │  GPU Detected?   │              │
│                           └────────┬─────────┘              │
│                                    │                         │
│                    ┌───────────────┴───────────────┐        │
│                    ▼                               ▼         │
│            ┌──────────────┐              ┌──────────────┐   │
│            │    Ollama    │              │  llama.cpp   │   │
│            │   (GPU)      │              │   (CPU)      │   │
│            │ Port: 11434  │              │ Port: 11435  │   │
│            └──────────────┘              └──────────────┘   │
│                    │                               │         │
│                    └───────────┬───────────────────┘        │
│                                ▼                             │
│                        ┌───────────────┐                     │
│                        │  Ollama WebUI │                     │
│                        │  Port: 3001   │                     │
│                        └───────────────┘                     │
│                                                              │
│  Models: llama3:8b (4.7GB), qwen2.5-coder:7b (4.1GB)        │
│  Auto-unload: 30 minutes inactivity                         │
└─────────────────────────────────────────────────────────────┘
```

### Services
1. **Ollama (GPU)** - GPU-accelerated inference (if available)
2. **llama.cpp (CPU)** - CPU fallback (if no GPU)
3. **Ollama WebUI** - Model management interface
4. **Portainer** - Container management (existing, add monitoring)
5. **SysReptor** - Report generation (existing, add health checks)

---

## 2. Database Schema

### Ollama Tracking Tables

```sql
-- Model management
CREATE TABLE ollama_models (
  id UUID PRIMARY KEY,
  model_name TEXT NOT NULL,
  model_size BIGINT,
  downloaded_at TIMESTAMP,
  last_used TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available'
);

-- AI enrichment logs
CREATE TABLE ai_enrichment_logs (
  id UUID PRIMARY KEY,
  vulnerability_id UUID REFERENCES vulnerabilities(id),
  model_used TEXT,
  prompt TEXT,
  response TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Migration File:** `migrations/0013_add_ollama_integration.sql`

---

## 3. Docker Configuration

### Ollama Services

```yaml
services:
  # Ollama (GPU-enabled)
  ollama:
    image: ollama/ollama:latest
    container_name: rtpi-ollama
    profiles: ["gpu"]  # Only if GPU detected
    ports:
      - "11434:11434"
    volumes:
      - ollama-models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    networks:
      - rtpi-network

  # llama.cpp (CPU fallback)
  ollama-cpu:
    build: ./services/ollama-cpu
    container_name: rtpi-ollama-cpu
    profiles: ["cpu"]  # If no GPU
    ports:
      - "11435:11434"
    volumes:
      - ollama-models:/models
    networks:
      - rtpi-network

  # Ollama WebUI
  ollama-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: rtpi-ollama-webui
    ports:
      - "3001:8080"  # Adjusted to avoid conflict
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
    networks:
      - rtpi-network
```

**GPU Detection Script:** `scripts/detect-gpu.sh`

---

## 4. Ollama Integration

### Model Management

**Pre-Download Models:**
- `llama3:8b` (4.7GB) - General purpose AI
- `qwen2.5-coder:7b` (4.1GB) - Code-focused AI

**Download Script:** `scripts/download-ollama-models.sh`

```bash
#!/bin/bash
docker exec ollama ollama pull llama3:8b
docker exec ollama ollama pull qwen2.5-coder:7b
```

**Auto-Unload Configuration:**
- Models unload after 30 minutes of inactivity
- Frees memory for other processes
- Reload on next request (~10s startup)

---

## 5. llama.cpp CPU Fallback

### When GPU Not Available

**Dockerfile:** `services/ollama-cpu/Dockerfile`

```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y git build-essential
RUN git clone https://github.com/ggml-org/llama.cpp
RUN cd llama.cpp && make
COPY models/*.gguf /models/
CMD ["./llama.cpp/server", "-m", "/models/llama3-8b-q4.gguf"]
```

**Model Format:** GGUF (quantized for CPU efficiency)

---

## 6. Model Management System

### TypeScript Service

**File:** `server/services/ollama-manager.ts`

**Key Functions:**
- `listModels()` - Get available models
- `downloadModel(name)` - Pull new model
- `deleteModel(name)` - Remove model
- `getModelStatus(name)` - Check if loaded
- `unloadModel(name)` - Free memory

**Auto-Unload Logic:**
- Track last usage timestamp
- Background job checks every 5 minutes
- Unload if inactive >30 minutes

---

## 7. AI Enrichment Replacement

### Update Vulnerability AI Enrichment

**File:** `server/services/vulnerability-ai-enrichment.ts`

**Changes:**
- Replace mock implementation
- Call Ollama API instead of OpenAI/Anthropic
- Use llama3:8b for general enrichment
- Use qwen2.5-coder for code analysis
- Fallback to cloud APIs if Ollama unavailable

**AI Tasks:**
- Vulnerability description generation
- Impact analysis
- Remediation suggestions
- CVE matching and correlation

---

## 8. Service Monitoring

### Portainer Integration

**Monitoring:**
- Health check via Portainer API
- Container stats displayed in RTPI dashboard
- Direct link to Portainer UI from RTPI
- Quick actions: restart, logs

**UI:** Add Portainer status card to Infrastructure page

### SysReptor Integration

**Monitoring:**
- Health check via SysReptor API
- Report generation status
- Direct link to SysReptor UI
- Basic report listing

**Note:** Full Technical Writer plugin deferred to v2.5

---

## 9. Implementation Checklist

### Day 23 (Dec 23): Ollama Setup
- [ ] Add Ollama to docker-compose
- [ ] Configure GPU passthrough
- [ ] Download models
- [ ] Test inference

### Day 24 (Dec 24): llama.cpp Fallback
- [ ] Create llama.cpp Dockerfile
- [ ] Build CPU-only image
- [ ] Test CPU inference
- [ ] Implement auto-detection

### Day 25 (Dec 25): Christmas - Light Work
- [ ] Documentation updates
- [ ] Code review

### Day 26 (Dec 26): AI Enrichment
- [ ] Update vulnerability-ai-enrichment.ts
- [ ] Implement Ollama API calls
- [ ] Test enrichment quality
- [ ] Add fallback logic

### Day 27 (Dec 27): Agent Integration
- [ ] Configure agents to use Ollama
- [ ] Add "Local AI" option in agent config
- [ ] Test agent with local models

### Day 28 (Dec 28): Service Monitoring
- [ ] Add Portainer health checks
- [ ] Add SysReptor health checks
- [ ] Update Infrastructure page UI
- [ ] Test monitoring

### Day 29 (Dec 29): Testing & Polish
- [ ] Integration testing
- [ ] Performance testing
- [ ] Documentation complete
- [ ] Final review

---

## 10. Testing & Validation

### Test Scenarios
- GPU detection and selection
- Model download and loading
- AI enrichment quality
- CPU fallback performance
- Model auto-unload
- Service health monitoring

### Performance Benchmarks
- GPU inference: <2s per request
- CPU inference: <10s per request
- Model load time: <30s
- Memory usage: <8GB per model

---

## Success Metrics

- [ ] Ollama operational (GPU or CPU)
- [ ] Models downloaded and tested
- [ ] AI enrichment producing quality results
- [ ] Agents can use local AI
- [ ] Model auto-unload working
- [ ] All services monitored
- [ ] Performance acceptable

---

## Optional Features

If time permits:

- [ ] Additional models (codellama, mistral)
- [ ] Model performance comparison
- [ ] Advanced model configuration
- [ ] RAG integration for documentation

---

## Dependencies

**Prerequisites:**
- Phases 1 & 2 complete
- GPU drivers (if using GPU)
- nvidia-docker runtime (if using GPU)
- 20GB+ disk space for models

**Integration Points:**
- Agents use Ollama for AI tasks
- Vulnerability enrichment uses local models
- Workspaces can access Ollama WebUI

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
