# RTPI Health Check Reference

Single reference for all health monitoring: application endpoints, Docker container checks, deployment gates, live healing daemons, and codebase quality signals.

**Audiences:** operators (sections 1-6), developers (sections 1, 3, 7-9).
**Last audited:** 2026-06-15

---

## Table of Contents

0. [Component Health Scorecard](#0-component-health-scorecard)
1. [Quick Reference Commands](#1-quick-reference-commands)
2. [Application Health Endpoints](#2-application-health-endpoints)
3. [Docker Container Health](#3-docker-container-health)
4. [Deployment Health Gates](#4-deployment-health-gates)
5. [Live Healing Daemons](#5-live-healing-daemons)
6. [UI Dashboard](#6-ui-dashboard)
7. [Codebase Health Audit](#7-codebase-health-audit)
8. [Dependency Health](#8-dependency-health)
9. [Repair Plans (by grade, lowest first)](#9-repair-plans-by-grade-lowest-first)

---

## 0. Component Health Scorecard

Grades are evidence-based, assessed against: functional completeness, error handling, test coverage, operational reliability, and security. Repair plans for each component are in [Section 9](#9-repair-plans-by-grade-lowest-first), ordered worst-first.

**Grading rubric:** **A** = production-ready, well-tested, no critical gaps. **B** = functional/reliable, minor gaps. **C** = works but significant gaps risk operational issues. **D** = major gaps actively undermine reliability or security. **F** = non-functional or critically broken.

| Grade | Component | One-Line Justification | Repair Plan |
|-------|-----------|------------------------|-------------|
| **D** | Observability & Logging | Console-only logging, no structured output, no metrics, no request tracing | [9.1](#91-observability--logging-d--b) |
| **C-** | C2 Framework Integration | Empire functional; Sliver/Havoc are schema-only stubs; Rust-Nexus incomplete | [9.2](#92-c2-framework-integration-c---b) |
| **C** | Testing | 62 test files but zero component tests, zero tool executor tests, auth gaps | [9.3](#93-testing-c--b) |
| **C+** | Security Posture | XSS in markdown renderer, CSRF not distributed, input validation inconsistent | [9.4](#94-security-posture-c--a-) |
| **B-** | Docker Infrastructure | 10 stub healthchecks always report healthy; 6 services have no check at all | [9.5](#95-docker-infrastructure-b---a-) |
| **B** | CI/CD Pipeline | Good 5-job structure; port bug fixed; no staging deploy or E2E in CI | [9.6](#96-cicd-pipeline-b--a-) |
| **B** | Security Tool Integrations | All 4 executors (MSF, BBOT, Nuclei, Nmap) functional; zero dedicated tests | [9.7](#97-security-tool-integrations-b--a-) |
| **B** | Frontend UI | 29 pages, solid a11y hooks, responsive; no error boundaries or component tests | [9.8](#98-frontend-ui-b--a-) |
| **B+** | Authentication & Authorization | 3 auth strategies, RBAC on 40+ routes; CSRF is single-server only | [9.9](#99-authentication--authorization-b--a) |
| **A-** | MCP Server Management | Full lifecycle, auto-recovery, catalog sync, preflight checks; 4 test files | [9.10](#910-mcp-server-management-a---a) |
| **A** | Database & Schema | Strict types, 20+ enums, pgvector, 3,689 lines well-organized by domain | [9.11](#911-database--schema-a) |
| **A** | Agent System | Multi-pattern orchestration, anti-fabrication guards, exponential retry, audit trail | [9.12](#912-agent-system-a) |

---

## 1. Quick Reference Commands

```bash
# Application health (unauthenticated, checks DB connectivity)
curl -s http://localhost:3001/api/v1/health | jq .

# Pre-deploy validation (Docker, disk, memory, ports, .env)
npm run deploy:check

# Post-deploy container stability gate
npm run deploy:verify

# All container statuses at a glance
docker ps --filter label=com.docker.compose.project=rtpi \
  --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# Unhealthy or restarting containers only
docker ps --filter health=unhealthy --filter status=restarting \
  --format '{{.Names}} {{.Status}}'

# Watcher daemon logs (live)
journalctl -u rtpi-watcher.service -f

# Container healer recent activity
journalctl -u rtpi-container-healer.service --since '1 hour ago'

# Database connectivity
docker exec rtpi-postgres pg_isready -U rtpi

# Redis connectivity
docker exec rtpi-redis redis-cli ping
```

---

## 2. Application Health Endpoints

### Root Health (Unauthenticated)

| Endpoint | Source | What It Checks |
|----------|--------|----------------|
| `GET /api/v1/health` | `server/index.ts:130` | PostgreSQL connectivity. Returns 200/503 with `{status, timestamp, database}` |

Used by `rtpi-watcher.sh` for API liveness polling.

### Service-Specific Endpoints (Session Auth Required)

| Endpoint | Service | What It Checks |
|----------|---------|----------------|
| `/api/v1/health-checks` | Core | CRUD health records from DB |
| `/api/v1/health-checks/containers` | Core | Aggregated container + MCP server readiness |
| `/api/v1/orchestrator/health` | Orchestrator | LangGraph orchestrator status |
| `/api/v1/orchestrator/tools/containers/health` | Orchestrator | All tool container health |
| `/api/v1/orchestrator/tools/containers/:agentRole/health` | Orchestrator | Per-agent container health |
| `/api/v1/ollama/health` | Ollama | LLM inference service connectivity |
| `/api/v1/burp-activation/health` | Burp Suite | MCP server health for Burp |
| `/api/v1/burp-builder/health` | Burp Builder | Builder service status |
| `/api/v1/docmost/health` | DocMost | Documentation platform connectivity |
| `/api/v1/sysreptor/health` | SysReptor | Reporting platform status + version |
| `/api/v1/workbench/health` | ATT&CK Workbench | Workbench API connectivity |
| `/api/v1/ssl-certificates/health/check` | SSL Certs | Certificate manager availability |
| `/api/v1/kasm-proxy/health` | KASM Proxy | Proxy auth token validity |
| `/api/v1/kasm-workspaces/runtime-health` | KASM | Workspace runtime status |
| `/api/v1/framework-deploy/:name/health` | Framework Deploy | Per-framework container health |

### MCP Server Probing

Individual MCP servers can be probed via `GET /api/v1/agents/mcp-servers/:id/probe`. The `mcpServers` table tracks `lastProbeAt` and `lastProbeOk`. Servers may define a custom `livenessPath` for HTTP-based health checks.

### Health Check Database Table

The `healthChecks` table (`shared/schema.ts`) stores persistent records with: `service`, `status`, `message`, `details`, `failureCount`, `lastCheck`, `nextCheck`.

---

## 3. Docker Container Health

### Real Healthchecks

**Databases & Caches:**

| Container | Check | Interval | Timeout | Retries |
|-----------|-------|----------|---------|---------|
| `rtpi-postgres` | `pg_isready -U rtpi` | 10s | 5s | 5 |
| `rtpi-redis` | `redis-cli ping` | 10s | 5s | 5 |
| `kasm-db` | `pg_isready -U kasmapp` | 10s | 5s | 5 |
| `kasm-redis` | `redis-cli ping` | 10s | 5s | 5 |
| `workbench-db` | `mongosh` auth ping | 10s | 5s | 5 |

**Web Services:**

| Container | Check | Interval | Start Period |
|-----------|-------|----------|-------------|
| `empire-server` | `curl -sf http://0.0.0.0:1337/` | 30s | 60s |
| `workbench-api` | `curl -s http://localhost:3010/api/collections` | 30s | 40s |
| `rtpi-mem0` | `curl -f http://localhost:8000/health` | 15s | — |
| `rtpi-orchestrator` (Dockerfile) | `curl -f http://localhost:8080/health` | 15s | — |

**Kasm Workspace Images:**

| Container | Check | Interval | Start Period |
|-----------|-------|----------|-------------|
| `kasm-kali` | HTTPS status code check | 30s | 60s |
| `kasm-vscode` | HTTPS status code check | 30s | 30s |

### Stub Healthchecks (Always Report Healthy)

These containers pass `deploy-verify.sh` even if broken. Replace with real probes.

| Container | Current Check | Suggested Replacement |
|-----------|---------------|----------------------|
| `rtpi-tools` | `echo "healthy"` | Check that a core tool binary exists (e.g., `nmap --version`) |
| OffSec agents (8+): maldev, azure-ad, burp, empire, framework, fuzzing, llm-sec, research, cloud | `CMD-SHELL "true"` | Check entrypoint PID alive or internal readiness file |

### No Healthcheck

**Expected (init/one-shot containers):** `kasm-db-init`, `kasm-proxy-init`, `rtpi-bootstrap`, `certbot` — these run once and exit. No healthcheck needed.

**Should add healthchecks:**

| Container | Has API? | Suggested Check |
|-----------|----------|----------------|
| `rtpi-workbench-frontend` | Yes (port 3020) | `curl -sf http://localhost:3020/` |
| `kasm-manager` | Yes | Internal API ping |
| `kasm-guac` | Yes | Guacamole status endpoint |
| `kasm-share` | Yes | Share service ping |
| `empire-proxy` | Yes (nginx) | `curl -sf http://localhost:1337/` |
| `rtpi-sysreptor-caddy` | Yes | `curl -sf http://localhost:80/` |

---

## 4. Deployment Health Gates

### Pre-Deploy: `npm run deploy:check`

Runs `scripts/pre-deployment-check.sh` (257 lines). Validates:
- Docker daemon running (v24+) and Docker Compose
- Disk space (20GB+ minimum, 50GB+ recommended)
- System memory (4GB+ minimum, 8GB+ recommended)
- Critical ports available (5434, 6381, 1337, 3010, 27017)
- `.env` file with required secrets (`DATABASE_URL`, `REDIS_PASSWORD`, `SESSION_SECRET`, `JWT_SECRET`)
- Node.js v20+
- OffSec base image (if building agents)

### Post-Deploy: `npm run deploy:verify`

Runs `scripts/deploy-verify.sh` (333 lines). Polls all compose-project containers, demanding stable + healthy status for a configurable window.

| Exit Code | Meaning |
|-----------|---------|
| 0 | All containers stable and healthy |
| 2 | Hard failure (crash loop, restart loop, exited) |
| 3 | Timeout (containers didn't stabilize in time) |

**Tuning via environment variables:**

| Variable | Default | Purpose |
|----------|---------|---------|
| `RTPI_VERIFY_TIMEOUT` | 300s | Max wait before timeout (exit 3) |
| `RTPI_VERIFY_STABILITY` | 30s | How long containers must stay healthy |
| `RTPI_VERIFY_POLL` | 3s | Poll interval |
| `RTPI_VERIFY_PROJECT` | `rtpi` | Docker Compose project name |
| `RTPI_VERIFY_IGNORE` | (none) | Comma-separated container names to skip |

Full documentation: [DEPLOYMENT.md](DEPLOYMENT.md) — "Post-Deploy Verification" section.

---

## 5. Live Healing Daemons

| Daemon | Execution Model | Targets | Rate Limiting |
|--------|----------------|---------|---------------|
| `rtpi-watcher.service` | Long-running (systemd) | API health, `pg_isready`, container state | 3 restarts / 600s per target, 15s cooldown |
| `rtpi-container-healer.timer` | Periodic one-shot (systemd timer) | Docker container state (exited, restarting, high RestartCount) | Exponential cooldown: 60s * 2^attempts, capped at 1h |

**Key differences:** The watcher checks application-level health (API endpoint, DB connectivity). The healer only checks Docker-level state. Both have deny/ignore lists for profile-gated containers (mem0, ollama).

**Configuration (watcher):**

| Variable | Default |
|----------|---------|
| `RTPI_WATCHER_INTERVAL` | 60s |
| `RTPI_WATCHER_API_HEALTH_URL` | `http://localhost:3000/api/v1/health` |
| `RTPI_WATCHER_MAX_RESTARTS` | 3 |
| `RTPI_WATCHER_WINDOW` | 600s |
| `RTPI_WATCHER_DRY_RUN` | 0 (set 1 to simulate) |

Scripts: `scripts/rtpi-watcher.sh`, `scripts/container-healer.sh`.

---

## 6. UI Dashboard

The **Infrastructure** page (`/infrastructure`) provides live monitoring across tabs:

- **Containers** — running state, image, health status for all Docker containers
- **Health Checks** — persistent health check records from the DB
- **Deployments** — framework deployment status
- **Devices** — registered devices
- **C2 Frameworks** — command-and-control framework status
- **Workspaces** — KASM workspace status

Data refreshes via the `useInfrastructure` hook polling `/api/v1/health-checks/containers`, `/api/v1/devices`, and `/api/v1/health-checks`.

Additional health banners appear on feature pages: `DocmostHealthBanner` and `SysReptorHealthBanner` on the Reports page.

Source: `client/src/pages/Infrastructure.tsx`, `client/src/hooks/useInfrastructure.ts`.

---

## 7. Codebase Health Audit

### TypeScript Strictness

`tsconfig.json` enables `strict: true` with additional checks: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`. Only 1 `@ts-ignore` exists in the entire codebase. `@typescript-eslint/no-explicit-any` is set to `warn` (not `error`).

### Linting

ESLint extends `eslint:recommended`, `@typescript-eslint/recommended`, `react/recommended`, `react-hooks/recommended`. Key custom rules: `no-duplicate-imports: error`, `no-redeclare: error`, unused vars with `_` prefix exemption.

### Test Coverage

| Category | Count | Framework |
|----------|-------|-----------|
| Unit tests | 53 files | Vitest |
| Integration tests | 4 files | Vitest |
| E2E tests | 5 specs | Playwright (Chromium) |

Coverage provider: v8 (reporters: text, json, html). Playwright is CI-aware (retries=2, single worker in CI).

### CI Pipeline

`workflows/ci.yml` runs 5 jobs on push/PR to main & develop:

1. **Lint** — ESLint + Prettier check
2. **Test** — Unit tests with PostgreSQL 16 + Redis 7 services, coverage upload to Codecov
3. **Build** — Vite production build, artifact upload (7-day retention)
4. **Security** — Snyk vulnerability scan
5. **rust-nexus** — Cargo test matrix (default, mesh, all-features)

### Server Boot & Shutdown

**Boot sequence** (`server/index.ts`): dotenv → Express middleware (helmet, cors, session, passport) → 70+ API route modules → DB connection check (fatal) → admin seeding → tool registry repair → ATT&CK bootstrap → delayed service init (inference cache warm at 2s, agent-MCP connector at 6s, autonomous agents conditional).

**Graceful shutdown**: Handles `SIGTERM` and `SIGINT`. Shuts down ops-manager scheduler, scan scheduler, agent system, then HTTP server. 10-second forced exit timeout.

### Schema Quality

`shared/schema.ts` (3,689 lines): 20+ enums for type safety, UUID primary keys with `defaultRandom()`, pgvector for embeddings, tsvector for full-text search. Well-organized by domain (auth, operations, agents, MCP, tools, reports).

---

## 8. Dependency Health

| Package | Current | Latest | Gap | Risk |
|---------|---------|--------|-----|------|
| `@anthropic-ai/sdk` | 0.68.0 | 0.104.2 | 36 versions | Breaking tool-use and streaming API changes |
| `@typescript-eslint/*` | 6.x | 8.x | 2 major | Flat config migration, rule changes |
| `@vitest/coverage-v8` | 1.x | 4.x | 3 major | Coverage config and snapshot API changes |
| `@playwright/test` | 1.57.0 | 1.61.0 | Minor | Low risk |
| `@tanstack/react-query` | 5.90.x | 5.101.x | Minor | Low risk |

---

## 9. Repair Plans (by grade, lowest first)

Effort key: **S** = hours, **M** = 1-2 days, **L** = 3-5 days, **XL** = 1-2 weeks.

---

### 9.1 Observability & Logging (D → B)

**Evidence:** All logging is `console.log`/`console.error` with ad-hoc prefixes (`[Metasploit]`, emoji decorators). No structured JSON output, no log levels enforced, no logging library. No Prometheus/StatsD metrics. No Sentry or error aggregation. No request correlation IDs or OpenTelemetry tracing. Audit trail exists (`auditLogs` table) but only covers API route access — tool executions, C2 operations, and credential access are unaudited.

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | Replace `console.*` with pino structured JSON logger | S | `server/index.ts`, all services |
| 2 | Add request correlation ID middleware (`X-Request-ID` header) | S | `server/middleware/` |
| 3 | Integrate Sentry for error aggregation in production | M | `server/index.ts`, `package.json` |
| 4 | Add Prometheus client — instrument tool execution duration, scan count, error rate | M | `server/services/*-executor.ts` |
| 5 | Extend audit trail to tool executions, C2 operations, credential access | M | `server/services/empire-executor.ts`, tool executors |
| 6 | Add audit log retention policy (90-day default) and append-only constraint | L | `shared/schema.ts`, migration |

---

### 9.2 C2 Framework Integration (C- → B)

**Evidence:** Empire integration is production-ready (OAuth2 + legacy auth, listener/stager/agent CRUD, credential sync). But Sliver and Havoc have schema-level enums only — no executor, no routes, no tests. Rust-Nexus has early WebSocket + mTLS scaffolding but implementation is incomplete (no audit logging, telemetry storage opaque). Empire API routes lack auth middleware.

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | Add `ensureAuthenticated` middleware to Empire API routes | S | `server/api/v1/empire.ts` |
| 2 | Add Empire task polling for background completion status | M | `server/services/empire-executor.ts` |
| 3 | Implement Sliver executor service (schema tables already exist) | L | New: `server/services/sliver-executor.ts`, `server/api/v1/sliver.ts` |
| 4 | Complete Rust-Nexus — add audit logging, persist telemetry, task result storage | L | `server/services/rust-nexus-controller.ts` |
| 5 | Add C2 integration tests (Empire auth flows, listener lifecycle) | M | `tests/integration/` |

---

### 9.3 Testing (C → B+)

**Evidence:** 62 test files (53 unit, 4 integration, 5 E2E Playwright). Good regression guards (anti-fabrication test for agent tool connector). But zero React component tests, zero tool executor tests, no retry/backoff unit tests, no OAuth or API key auth tests, no rate limiter tests. Coverage tooling is 3 major versions behind.

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | Add rate limiter unit tests | S | `tests/unit/server/middleware/` |
| 2 | Add retry/backoff isolated tests for dynamic workflow orchestrator | M | `tests/unit/services/` |
| 3 | Add OAuth and API key auth integration tests | M | `tests/integration/` |
| 4 | Add unit tests for tool executors (MSF, BBOT, Nuclei, Nmap) | L | `tests/unit/services/` |
| 5 | Add React Testing Library component tests for critical pages (Dashboard, Operations, Agents) | L | `tests/unit/client/` |
| 6 | Update `@vitest/coverage-v8` to 4.x, align Vitest config | M | `package.json`, `vitest.config.ts` |

---

### 9.4 Security Posture (C+ → A-)

**Evidence:** XSS vulnerability in `MarkdownEditor.tsx` — `dangerouslySetInnerHTML` with unsanitized `renderMarkdown()` output. CSRF tokens stored in an in-memory `Map` (doesn't scale, no TTL). `SESSION_SECRET` defaults to an unsafe string without failing in production. Input validation uses Zod in some routes but many parse `req.body` directly. Helmet.js enabled but no explicit Content-Security-Policy configuration.

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | **CRITICAL:** Fix XSS — add DOMPurify to sanitize markdown output | S | `client/src/components/markdown/MarkdownEditor.tsx` |
| 2 | Fail hard if `SESSION_SECRET` is the default value in production (`NODE_ENV=production`) | S | `server/auth/session.ts` |
| 3 | Configure Content-Security-Policy header via Helmet | S | `server/index.ts` |
| 4 | Move CSRF token storage from in-memory Map to Redis with 1-hour TTL | M | `server/middleware/csrf.ts` |
| 5 | Apply Zod validation schemas systematically to all POST/PUT/PATCH routes | XL | `server/api/v1/*.ts` |

---

### 9.5 Docker Infrastructure (B- → A-)

**Evidence:** 25 containers have real healthchecks. 10 containers use stub checks (`CMD-SHELL "true"` or `echo "healthy"`) that always report healthy — `deploy-verify.sh` trusts these and passes broken containers. 6 long-running services (`rtpi-workbench-frontend`, `kasm-manager`, `kasm-guac`, `kasm-share`, `empire-proxy`, `rtpi-sysreptor-caddy`) have no healthcheck at all. Main `Dockerfile` also has no `HEALTHCHECK`.

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | Add `HEALTHCHECK` to main `Dockerfile` | S | `Dockerfile` |
| 2 | Replace 10 stub healthchecks with real probes (tool binary check for rtpi-tools, PID check for offsec agents) | M | `docker-compose.yml`, `docker/offsec-agents/Dockerfile.*` |
| 3 | Add healthchecks to 6 long-running services missing them | M | `docker-compose.yml` |

---

### 9.6 CI/CD Pipeline (B → A-)

**Evidence:** 5-job GitHub Actions pipeline (lint, test, build, security/Snyk, rust-nexus). CI port mismatch was fixed (ports 5434/6381 → 5432/6379). Missing: no staging deployment job, no E2E tests in CI, Codecov action is v3 (current is v4). No deploy-on-merge automation.

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | Update Codecov action from v3 to v4 | S | `workflows/ci.yml` |
| 2 | Add E2E test job (Playwright) in CI pipeline | M | `workflows/ci.yml` |
| 3 | Add staging deployment job (Docker build + push to registry) | L | `workflows/ci.yml` or new workflow |

---

### 9.7 Security Tool Integrations (B → A-)

**Evidence:** All 4 executors are fully functional — not stubs. Metasploit: resource script execution, module search, lock-based concurrency. BBOT: async JSON pipeline, 11 event types, severity filtering. Nuclei: sparse-checkout templates, JSONL parsing, CVSS scoring. Nmap: XML parsing, service discovery. But zero dedicated unit tests for any executor. Metasploit result parsing lacks CVE/CVSS extraction. BBOT and Nmap have no retry on scan failure.

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | Add retry logic to BBOT and Nmap on scan failure | M | `server/services/bbot-executor.ts`, `nmap-executor.ts` |
| 2 | Add Metasploit result parsing for CVE/CVSS extraction | M | `server/services/metasploit-executor.ts` |
| 3 | Add dedicated unit tests for all 4 executors | L | `tests/unit/services/` |

---

### 9.8 Frontend UI (B → A-)

**Evidence:** 29 fully implemented pages, 33 component subdirectories, shadcn/ui design system. Excellent accessibility: 9 a11y hooks (`useAriaAnnounce`, `useFocusTrap`, `useSkipLink`, etc.), 120+ ARIA attributes. Responsive with mobile touch targets. Good loading/empty states. But no React Error Boundary — a component crash takes down the entire app. Zero component-level unit tests (E2E only). XSS in markdown (overlaps Security Posture).

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | Add React Error Boundary wrapping the app root | S | `client/src/App.tsx` or new `ErrorBoundary.tsx` |
| 2 | Add DOMPurify for markdown rendering (shared fix with Security Posture 9.4.1) | S | `client/src/components/markdown/MarkdownEditor.tsx` |
| 3 | Add React Testing Library component tests for critical pages | L | `tests/unit/client/` |

---

### 9.9 Authentication & Authorization (B+ → A)

**Evidence:** Three auth strategies: local (bcrypt factor 12, account lockout after 5 attempts), Google OAuth 2.0, API keys (SHA256 hashed, expiration, per-key rate limits). RBAC with admin/operator/viewer roles enforced on 40+ routes via `ensureRole()` middleware. Redis-backed sessions. But CSRF is in-memory only (single-server). No fine-grained resource-level permissions. No OAuth or API key auth tests.

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | Add API key authentication tests | S | `tests/unit/server/` |
| 2 | Move CSRF to Redis (shared fix with Security Posture 9.4.4) | M | `server/middleware/csrf.ts` |
| 3 | Add OAuth flow integration tests | M | `tests/integration/` |
| 4 | Add fine-grained resource-level permissions (operation-scoped access) | L | `server/auth/middleware.ts`, route files |

---

### 9.10 MCP Server Management (A- → A)

**Evidence:** Full server lifecycle: spawn with 30s timeout, graceful shutdown (SIGTERM → 5s → SIGKILL), auto-recovery of errored/stale servers on startup, exponential backoff restarts. Preflight checks prevent bad spawns. CRUD API with secret redaction. Default catalog sync via `INSERT ... ON CONFLICT DO NOTHING`. 4 test files. Gaps: no per-server response time metrics, no capability drift detection, no bulk operations.

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | Add bulk operations (start/stop multiple servers) to API | S | `server/api/v1/mcp-servers.ts` |
| 2 | Add response time metrics per MCP server | M | `server/services/mcp-server-manager.ts` |
| 3 | Add capability drift detection (alert when server capabilities change unexpectedly) | M | `server/services/agent-mcp-connector.ts` |

---

### 9.11 Database & Schema (A)

**Evidence:** `shared/schema.ts` (3,689 lines) with `strict: true` TypeScript. 20+ enums for type safety. UUID primary keys with `defaultRandom()`. pgvector for embeddings, tsvector for full-text search. Well-organized by domain (auth, operations, agents, MCP, tools, reports). Drizzle ORM prevents SQL injection. Defensive comments protecting destructive operations (FTS column guard).

No critical repairs needed. Optional improvements:

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | Optional: add database migration smoke test (apply → rollback → reapply) | S | `tests/integration/` |

---

### 9.12 Agent System (A)

**Evidence:** Multi-pattern orchestration (sequential pipeline, template-driven, attack tree branching, autonomous tool loop). Anti-fabrication regression guard tested — stub methods that returned fictional success strings have been removed and guarded against re-introduction. Dynamic workflow orchestrator with exponential backoff retries (configurable `maxRetries`, `backoffMultiplier`). Capability-based agent matching with topological sort. Comprehensive audit trail via `workflowLogs` table. 9 agent-related test files. Per-agent AI model/provider override. 14 feature flags.

No critical repairs needed. Optional improvements:

| # | Repair Item | Effort | Files |
|---|-------------|--------|-------|
| 1 | Optional: add isolated retry/timeout unit tests for backoff calculations | S | `tests/unit/services/` |
| 2 | Optional: resolve WebSocket auth TODO (`agent-websocket-manager.ts:116`) | S | `server/services/agent-websocket-manager.ts` |
