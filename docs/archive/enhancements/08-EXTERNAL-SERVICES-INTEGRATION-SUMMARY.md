# External Services Integration - Master Index

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)  
**Priority:** 🟡 Tier 2 - Beta Enhancement  
**Timeline:** December 9, 2025 - January 1, 2026 (23 days)  
**Total Items:** 110+ across 3 phases  
**Last Updated:** December 9, 2025

---

## Executive Summary

This master document coordinates the integration of Empire C2, Kasm Workspaces, Ollama AI, Portainer, and SysReptor into the RTPI platform. The integration is divided into 3 phases to be completed by January 1, 2026 (Beta launch).

### Integration Goals
- **Unified Platform:** Single access point for all red team tools
- **Secure Presentation:** Kasm Workspaces as secure browser isolation layer
- **C2 Capabilities:** Empire framework for post-exploitation
- **Local AI:** Ollama for air-gapped AI enrichment
- **Containerization:** All services in Docker for portability

---

## Phase Overview

| Phase | Service | Timeline | Status | Completion |
|-------|---------|----------|--------|------------|
| **Phase 1** | Empire C2 | Dec 9-15 | 📝 Planned | 70% documented |
| **Phase 2** | Kasm Workspaces | Dec 16-22 | 📝 Planned | Scaffold ready |
| **Phase 3** | Ollama & Monitoring | Dec 23-29 | 📝 Planned | Scaffold ready |
| **Final** | Integration Testing | Dec 30-31 | 📝 Planned | - |

---

## Document Structure

### Phase 1: Empire C2 Integration (Week 1)

**Main Document:** [08-EXTERNAL-SERVICES-INTEGRATION-PHASE1.md](08-EXTERNAL-SERVICES-INTEGRATION-PHASE1.md)

**Supplementary Documents:**
- [Testing Requirements](08-EXTERNAL-SERVICES-INTEGRATION-PHASE1-TESTING.md)
- [Implementation Guide](08-EXTERNAL-SERVICES-INTEGRATION-PHASE1-IMPLEMENTATION.md)
- [Troubleshooting Guide](08-EXTERNAL-SERVICES-INTEGRATION-PHASE1-TROUBLESHOOTING.md)

**Contents:**
1. Architecture Overview
2. Database Schema (empire_c2 schema + 3 tracking tables)
3. Docker Configuration (bcsecurity/empire:latest)
4. API Bridge (empire-executor.ts ~600 lines)
5. Dynamic Listener Proxy (kasm-nginx-manager.ts)
6. Agent Configuration (Empire C2 Agent seed)
7. UI Integration (React components)
8. Testing Requirements (scaffold)
9. Implementation Checklist (7 days, Dec 9-15)
10. Troubleshooting Guide (scaffold)

**Key Deliverables:**
- Empire C2 containerized
- Per-user token management
- Dynamic proxy through Kasm nginx
- Full RTPI UI integration

---

### Phase 2: Kasm Workspaces Integration (Week 2)

**Document:** [08-EXTERNAL-SERVICES-INTEGRATION-PHASE2.md](08-EXTERNAL-SERVICES-INTEGRATION-PHASE2.md)

**Contents (Scaffold):**
1. Multi-container architecture (10+ services)
2. Database schema (kasm_workspaces, kasm_sessions)
3. Docker configuration (Kasm stack)
4. Certificate management (Let's Encrypt + Cloudflare)
5. Workspace image building (VS Code, Kali, Firefox, Empire)
6. Burp Suite dynamic build (on upload)
7. Workspace provisioning service
8. UI integration (workspace launcher)
9. Implementation checklist (7 days, Dec 16-22)
10. Testing and troubleshooting

**Key Deliverables:**
- Fully containerized Kasm
- Automated SSL certificates
- Pre-built workspace images
- Workspace provisioning from RTPI UI

---

### Phase 3: Ollama & Service Monitoring (Week 3)

**Document:** [08-EXTERNAL-SERVICES-INTEGRATION-PHASE3.md](08-EXTERNAL-SERVICES-INTEGRATION-PHASE3.md)

**Contents (Scaffold):**
1. Ollama architecture (GPU + CPU fallback)
2. Database schema (ollama_models, ai_enrichment_logs)
3. Docker configuration (Ollama + llama.cpp)
4. Model management (llama3:8b, qwen2.5-coder:7b)
5. llama.cpp CPU fallback
6. AI enrichment replacement
7. Service monitoring (Portainer, SysReptor)
8. UI integration
9. Implementation checklist (7 days, Dec 23-29)
10. Testing and validation

**Key Deliverables:**
- Local AI inference operational
- Mock AI replaced with real models
- Service health monitoring
- Complete integration testing

---

## Unified Timeline

### December 2025

```
Week 1 (Dec 9-15): Phase 1 - Empire C2
├── Day 1-2: Database & Docker setup
├── Day 3-4: API bridge & proxy
├── Day 5-6: Agent & UI
└── Day 7: Testing & finalization

Week 2 (Dec 16-22): Phase 2 - Kasm Workspaces
├── Day 8-9: Infrastructure & certificates
├── Day 10-11: Image building
├── Day 12-13: Provisioning service
└── Day 14: UI & testing

Week 3 (Dec 23-29): Phase 3 - Ollama & Services
├── Day 15-16: Ollama setup
├── Day 17-18: AI integration
├── Day 19-20: Service monitoring
└── Day 21: Testing & polish

Week 4 (Dec 30-31): Final Integration
├── Day 22: Complete integration testing
├── Day 23: Security audit & deployment
└── Jan 1: BETA LAUNCH! 🚀
```

---

## Port Allocation Matrix

| Service | Port(s) | Protocol | Access |
|---------|---------|----------|--------|
| **RTPI Core** |
| Frontend | 3000 | HTTP | Internal |
| Backend | 5000 | HTTP | Internal |
| PostgreSQL | 5432 | TCP | Internal |
| Redis | 6379 | TCP | Internal |
| **Empire C2** |
| API | 1337 | HTTP | Internal |
| UI | 5001 | HTTP | Internal |
| Listeners | 8080-8090 | HTTP/HTTPS | External (via proxy) |
| **Kasm Workspaces** |
| Proxy | 8443 | HTTPS | External |
| API | 8181 | HTTP | Internal |
| Manager | 8182 | HTTP | Internal |
| **Ollama** |
| API | 11434 | HTTP | Internal |
| CPU Fallback | 11435 | HTTP | Internal |
| WebUI | 3001 | HTTP | Internal |
| **Other Services** |
| Portainer | 9443 | HTTPS | Internal |
| SysReptor | 7777 | HTTP | Internal |

**Total Containers:** 20-25 (depending on active workspaces)

---

## Environment Variables

### Consolidated .env Structure

```bash
# ============================================================================
# RTPI Core
# ============================================================================
DATABASE_URL=postgresql://rtpi:rtpi@postgres:5432/rtpi_main
REDIS_URL=redis://redis:6379
NODE_ENV=production

# ============================================================================
# Empire C2 (Phase 1)
# ============================================================================
EMPIRE_API_KEY=<generated>
EMPIRE_API_PASSWORD=<generated>
EMPIRE_STAGING_KEY=<generated>
EMPIRE_BASE_URL=http://empire-server:1337
EXTERNAL_IP=<your-public-ip>

# ============================================================================
# Kasm Workspaces (Phase 2)
# ============================================================================
KASM_DB_PASSWORD=<generated>
KASM_DOMAIN=kasm.onoiroi.us
KASM_NGINX_CONTAINER=kasm-proxy

# ============================================================================
# Cloudflare (Phases 1 & 2)
# ============================================================================
CLOUDFLARE_API_TOKEN=<your-token>
CLOUDFLARE_ZONE_ID=<your-zone-id>
CLOUDFLARE_TEAM_NAME=c3s

# ============================================================================
# Ollama (Phase 3)
# ============================================================================
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODELS=llama3:8b,qwen2.5-coder:7b
OLLAMA_AUTO_UNLOAD_MINUTES=30

# ============================================================================
# Google Cloud (v2.1 - Future)
# ============================================================================
GCP_PROJECT_ID=<project-id>
GCP_STORAGE_BUCKET=rtpi-workspaces
```

---

## Cross-Phase Dependencies

### Phase 1 → Phase 2
- ✅ **Empire listener proxy** requires Kasm nginx (from Phase 2)
- ⚠️ **Workaround:** Implement Empire without proxy first, enable proxy after Phase 2

### Phase 2 → Phase 3
- ✅ **Kasm workspaces** can launch Ollama WebUI
- ✅ **Workspace images** can include AI tools
- ✅ No blocking dependencies

### Phase 1 & 2 → Phase 3
- ✅ **Ollama provides AI** for Empire C2 Agent
- ✅ **Ollama enriches** vulnerability data
- ✅ Optional integration - can skip if no time

---

## Testing Strategy

### Unit Tests
- **Phase 1:** Empire API client, proxy manager
- **Phase 2:** Workspace provisioning, image building
- **Phase 3:** Ollama integration, model management

**Target:** 80% coverage

### Integration Tests
- **Phase 1:** Full listener lifecycle, agent sync
- **Phase 2:** Workspace launch end-to-end, certificate rotation
- **Phase 3:** AI enrichment pipeline, service monitoring

**Target:** 70% coverage

### E2E Tests
- **Phase 1:** Create listener → Generate stager → Monitor agent
- **Phase 2:** Launch workspace → Use tools → Terminate
- **Phase 3:** Trigger AI enrichment → Verify results

**Target:** 60% coverage

---

## Risk Assessment

### High Risk Items
🔴 **Kasm Multi-Container Complexity** (Phase 2)
- 10+ containers must coordinate
- Certificate management critical
- **Mitigation:** Test each service independently first

🔴 **Timeline Pressure** (All Phases)
- 23 days is tight for 3 phases
- **Mitigation:** Phased approach, optional features can be skipped

### Medium Risk Items
🟡 **Proxy Integration** (Phase 1)
- Depends on Kasm from Phase 2
- **Mitigation:** Make proxy optional, implement after Phase 2

🟡 **GPU Availability** (Phase 3)
- Ollama optimal with GPU
- **Mitigation:** llama.cpp CPU fallback implemented

### Low Risk Items
🟢 **Service Monitoring** (Phase 3)
- Simple health checks
- **Mitigation:** Well-defined API contracts

---

## Success Metrics

### By January 1, 2026 (Beta Launch):

#### Functional Requirements
- [ ] Empire C2 fully operational
- [ ] Kasm Workspaces providing secure access
- [ ] Ollama enriching vulnerabilities (or cloud APIs as fallback)
- [ ] All services containerized
- [ ] Single sign-on via Cloudflare Access
- [ ] Comprehensive monitoring and health checks

#### Performance Requirements
- [ ] System startup time < 3 minutes
- [ ] Workspace launch time < 60 seconds
- [ ] API response times < 500ms
- [ ] Support 10+ concurrent workspaces
- [ ] Support 50+ Empire agents

#### Security Requirements
- [ ] All services behind Cloudflare Access
- [ ] SSL/TLS for all external connections
- [ ] Per-user isolation (tokens, workspaces)
- [ ] No exposed credentials in logs
- [ ] Audit logging for all actions

---

## Rollback Strategy

### If Integration Fails

**Phase 1 Rollback:**
```bash
docker compose stop empire-server
# Drop empire tables
# Remove from docker-compose
```

**Phase 2 Rollback:**
```bash
docker compose stop kasm-*
# Keep Empire functional
# Proxy disabled but Empire works standalone
```

**Phase 3 Rollback:**
```bash
# Ollama is optional
docker compose stop ollama ollama-webui
# Fall back to cloud APIs for AI
```

**Critical:** Each phase is designed to be independently reversible without affecting prior phases.

---

## Resource Requirements

### Development Environment
- **CPU:** 8+ cores
- **RAM:** 32GB+ (16GB minimum)
- **Disk:** 100GB+ (for Docker images and models)
- **GPU:** Optional (NVIDIA for Ollama GPU support)

### Production Environment
- **CPU:** 16+ cores
- **RAM:** 64GB+
- **Disk:** 500GB+ SSD
- **GPU:** Recommended (NVIDIA with 8GB+ VRAM)
- **Network:** 1Gbps+

---

## Quick Reference

### Key Files by Phase

**Phase 1 (Empire C2):**
- `server/services/empire-executor.ts` - API client
- `server/services/kasm-nginx-manager.ts` - Proxy manager
- `server/api/v1/empire.ts` - REST endpoints
- `migrations/0011_add_empire_integration.sql` - Database
- `client/src/components/empire/` - UI components

**Phase 2 (Kasm):**
- `server/services/kasm-workspace-manager.ts` - Workspace provisioning
- `migrations/0012_add_kasm_integration.sql` - Database
- `scripts/build-*-workspace.sh` - Image building
- `configs/kasm/nginx.conf` - Nginx configuration
- `client/src/components/workspaces/` - UI components

**Phase 3 (Ollama):**
- `server/services/ollama-manager.ts` - Model management
- `server/services/vulnerability-ai-enrichment.ts` - AI integration
- `migrations/0013_add_ollama_integration.sql` - Database
- `scripts/download-ollama-models.sh` - Model downloads
- `services/ollama-cpu/` - CPU fallback

---

## Success Checkpoints

### End of Week 1 (Dec 15)
- ✅ Empire C2 operational
- ✅ All Empire API endpoints functional
- ✅ UI shows Empire status
- ✅ Tests passing for Phase 1

### End of Week 2 (Dec 22)
- ✅ Kasm fully containerized
- ✅ All workspace images built
- ✅ Workspaces launchable from RTPI
- ✅ Empire proxy working through Kasm

### End of Week 3 (Dec 29)
- ✅ Ollama operational (GPU or CPU)
- ✅ AI enrichment using local models
- ✅ All services monitored
- ✅ Complete system tested

### Beta Launch (Jan 1, 2026)
- ✅ All services stable
- ✅ Documentation complete
- ✅ Security audit passed
- ✅ Ready for beta users 🎉

---

## Getting Started

### For Developers

1. **Read Phase 1 main document** for detailed implementation
2. **Follow day-by-day checklists** in implementation guides
3. **Reference troubleshooting guides** when issues arise
4. **Run tests** after each major component
5. **Update progress** in this master document

### For Project Managers

1. **Track progress** using phase checkpoints
2. **Monitor timeline** against December 9 - January 1 schedule
3. **Identify blockers** early using risk assessment
4. **Coordinate resources** across phases
5. **Review** master index weekly

---

## Related Documentation

- [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md) - Parent roadmap
- [01-CRITICAL-BUGS.md](01-CRITICAL-BUGS.md) - Tier 1 priorities
- [07-OFFSEC-TEAM.md](07-OFFSEC-TEAM.md) - OffSec R&D integration

---

## Status Tracking

### Phase 1: Empire C2
**Status:** 📝 Planned (70% documented)  
**Start Date:** December 9, 2025  
**Target Completion:** December 15, 2025  
**Blockers:** None  
**Notes:** Main document complete with production code. Scaffolds created for testing/implementation/troubleshooting.

### Phase 2: Kasm Workspaces
**Status:** 📝 Planned (Scaffold complete)  
**Start Date:** December 16, 2025  
**Target Completion:** December 22, 2025  
**Blockers:** Depends on Phase 1 completion  
**Notes:** Scaffold provides structure, details to be filled during implementation week.

### Phase 3: Ollama & Services
**Status:** 📝 Planned (Scaffold complete)  
**Start Date:** December 23, 2025  
**Target Completion:** December 29, 2025  
**Blockers:** None (optional service)  
**Notes:** Ollama can be skipped if timeline tight. Monitoring is low-risk.

---

## Version History

### Version 1.0 (December 9, 2025)
- Initial master index created
- Phase 1 main document 70% complete
- Phase 1 supplementary scaffolds created
- Phase 2 scaffold created
- Phase 3 scaffold created
- Complete roadmap established

---

## Contact & Support

**Documentation Maintainer:** RTPI Development Team  
**Last Review:** December 9, 2025  
**Next Review:** December 16, 2025 (after Phase 1 completion)

---

**🚀 Goal: Beta Ready by January 1, 2026**

**Status Legend:**
- 🔴 Tier 1 - Critical
- 🟡 Tier 2 - Important
- 🟢 Tier 3 - Optional
- ✅ Complete
- 🚧 In Progress
- 📝 Planned

---

## VERIFICATION SUMMARY (2026-02-04)

### Complete External Services Integration Status

**Phase 1: Core Tool Integration ✅ COMPLETE**
- Metasploit, BBOT, Nuclei, Docker executor all operational
- Tool discovery and registry sync via Tool Connector Agent

**Phase 2: Kasm Workspaces ✅ 100% COMPLETE**
- Let's Encrypt with automatic certificate renewal
- Burp Suite dynamic Docker builds
- SSL certificate management fully automated

**Phase 3: Extended Ecosystem ✅ OPERATIONAL**
- ATT&CK Workbench REST API client
- Tool workflow orchestration
- 20+ security tools in registry

### Overall Integration Health
**Status:** ✅ External services integration successful across all phases. All major security tools, workspace management, and certificate automation operational. System ready for production red team operations.

**Last Updated:** February 4, 2026
