# OffSec Team R&D — Harness Evaluation & Remediation

**Status:** Phase 1 (P0/P1) **and** Phase 2 (P2 backlog) landed on branch `RT-Mod-2-Submission` · 2026-06-06
**Scope:** The `/offsec-rd` subsystem — the AI-agent research & development harness inside RTPI.
**Method:** Static analysis + source spot-verification (every Critical/High finding cited to `file:line`). The app was not run; findings are marked **statically verified** unless noted **inferred**.

---

## 1. System map (as-is)

End-to-end trace of the six `/offsec-rd` tabs (`client/src/pages/OffSecTeam.tsx`), surfaced from `client/src/App.tsx:79` and `client/src/config/nav-groups.ts`.

| Tab | Frontend | API | Service | Table(s) |
|-----|----------|-----|---------|----------|
| R&D Agents | `RDAgentsTab.tsx` | `GET /api/v1/agents` | — | `agents` (seeded `0046_seed_rd_agents.sql`) |
| Tool Lab | `ToolLabTab.tsx` | `GET /api/v1/offsec-rd/tools` | `offsec-rd-tools.ts` | `tool_library` ⨝ `security_tools` |
| Research Projects | `ResearchProjectsTab.tsx` | `GET/POST /api/v1/offsec-rd/projects`, `POST …/experiments/projects/:id/execute` | `offsec-rd-projects.ts`, `rd-experiment-orchestrator.ts` | `research_projects` |
| Experiments | `ExperimentsTab.tsx` | `GET/POST/PUT /api/v1/offsec-rd/experiments`, `…/:id/execute`, `…/:id/cancel`, `…/:id/artifacts`, `…/:id/agent-log`, **`POST /api/v1/offsec-rd/artifacts/:id/promote`** | `offsec-rd-experiments.ts`, `offsec-rd-artifacts.ts`, `rd-experiment-orchestrator.ts`, `rd-tool-promotion.ts` | `rd_experiments`, `rd_artifacts`, `tool_registry`, `agent_messages` |
| Knowledge Base | `KnowledgeBaseTab.tsx` | `GET /api/v1/offsec-rd/knowledge/status` (rest `501`) | `offsec-rd-knowledge.ts` | `knowledge_base` (pgvector) |
| ATT&CK Workflows | `TacticWorkflowsView.tsx` | `GET /api/v1/agents`, `/attack/tactics`, `POST/DELETE /api/v1/agents/:id/tactics`, `POST /api/v1/offsec-agents/:type/start\|stop` | `agents.ts`, `offsec-agents.ts` | `agents`, `agent_tactics`, `attack_tactics` |

**Orchestration chain (experiment execute):**
`POST /offsec-rd/experiments/:id/execute` → `rdExperimentOrchestrator.executeExperiment()` → dispatch by `experiment.type` → `researchAgent` / `pocDevelopmentAgent` / `nucleiTemplateAgent` (`base-task-agent.ts` + `agentMessageBus`) → persist `rd_artifacts` → (operator) promote to `tool_registry`. Runs fire-and-forget; the HTTP call returns immediately.

**Container subsystem:** 14 offsec agent containers in `docker-compose.yml` (`profiles: [offsec-agents]`), each embedding the stdio MCP server in `docker/offsec-agents/mcp-server/`. Lifecycle via `offsec-agents.ts` (`docker run`/`stop`/`exec`).

**Skill corpus:** 53 `SKILL.md` files in `knowledge_seed/bug_hunter_skills/`; ingested by `scripts/import-bug-hunter-skills.ts` into `knowledge_base`; consumed by `bug-hunter-skill-retriever.ts` (pgvector + FTS fallback), gated by `FF_BUG_HUNTER`.

---

## 2. Broken-workflow register

Severity uses Critical / High / Medium / Low. "Fixed" = addressed in Phase 1 on this branch.

| # | Workflow defect | Evidence | Severity | Status |
|---|-----------------|----------|----------|--------|
| **B1** | "Promote artifact to Tool Registry" always **404** — frontend POSTs `/offsec-rd/artifacts/:id/promote` but the route was defined inside the experiments router (mounted at `/offsec-rd/experiments`), so the real path was `…/experiments/artifacts/…`. | `ExperimentsTab.tsx:194` vs `offsec-rd-experiments.ts` (old `:444`) + mount `server/index.ts:187` | Critical | **Fixed** — extracted `offsec-rd-artifacts.ts`, mounted at `/api/v1/offsec-rd/artifacts` (`server/index.ts:189`) |
| **B3** | Container MCP tool bridge always returns **empty** — `offsec-agents.ts` shelled `node /mcp/dist/index.js --list-tools`, but the MCP server only wired a stdio transport and ignored `process.argv`; `\|\| echo "[]"` masked it, `docker exec` exit 0 hid the failure. | `offsec-agents.ts` (old `:539`,`:556`); `mcp-server/src/index.ts:391` | Critical | **Fixed** — added one-shot `--list-tools`/`--execute-tool` CLI mode to the MCP server; bridge now warns (not silently `[]`) on zero tools / non-JSON |
| **B6** | Artifact/project fetch in promotion silently returns `undefined` — used Drizzle relational `db.query.rdArtifacts?.findFirst`, but schema declares **0** `relations()`; optional-chain swallowed it. Also referenced `artifact.project_id` (Drizzle returns `projectId`). | `rd-tool-promotion.ts` (old `:118`,`:217`); `grep -c "relations(" shared/schema.ts` → 0 | High | **Fixed** — replaced with explicit `db.select().from(...).where(...).limit(1)`; corrected field to `projectId` |
| **B5** | Experiment dispatch threw "Unknown experiment type" for any name lacking a keyword — brittle name-string matching, a 500-class failure. | `rd-experiment-orchestrator.ts` (old `:160-174`) | High | **Fixed** — added `rd_experiments.type` column (`0050_add_rd_experiment_type.sql`), dispatch on `type` with name inference as legacy fallback; creators set `type` explicitly |
| **B4** | Cancel did not stop sub-agents — `controller.abort()` fired but the signal never reached `executeTask`; agents ran to completion. | `rd-experiment-orchestrator.ts` (old `:592`, phases `:273/:359/:421`) | High | **Fixed** — `signal` added to `TaskDefinition`, threaded into all three phases, checked at research phase boundaries; catch block now records `cancelled` (not `failed`) |
| **B11** | No output-quality gate — with `TAVILY_API_KEY` empty (the `.env.example` default) the research agent returns an empty package, and the orchestrator persisted a blank artifact as `completed/success`. | `research-agent.ts:240,309,472`; orchestrator persisted regardless | Medium | **Fixed** — orchestrator fails the experiment when research yields 0 CVEs **and** 0 exploits, with an actionable reason |
| **B8** | Dead nav link — `setLocation("/offsec-team")` but the route is `/offsec-rd`; the "R&D Project created" toast landed on a blank page. | `Vulnerabilities.tsx:240` vs `App.tsx:79` | Medium | **Fixed** — target corrected; regression guarded by `tests/unit/client/routing/route-existence.test.ts` |
| **B2** | "Test Tool" button is dead — no `onClick`; backend stub emits "not yet implemented". | `ToolLabTab.tsx:188-191`; `offsec-rd-tools.ts:288-350` | High | **Fixed (P2)** — button wired with in-flight state; endpoint resolves the library tool's `tool_registry` row and runs real container tests via `runAllTests`, mirroring the verdict to `testing_status` |
| **B7** | Knowledge Base CRUD entirely `501` — tab polls a live `/status` probe but every read/write/search is stubbed. | `offsec-rd-knowledge.ts:87-167` | High | **Fixed (P2)** — full CRUD + search (embedding cosine → FTS → ILIKE fallback) on `knowledge_base`; `/status` now returns category/POC/technique counts that populate the stat cards |
| **B9** | 7 of 14 offsec container types unmanageable individually — `AGENT_TYPES` lists 7; start/stop/tools rely on a raw-segment fallback for the rest. | `offsec-agents.ts:29-79,103-114`; `docker-compose.yml` | Medium | **Fixed (P2)** — all 14 typed with explicit `containerName` (also fixes the latent `burp-suite`→`rtpi-burp-suite-agent` mismatch); routes resolve via `resolveContainerName`; guarded by `offsec-agent-registry.test.ts` |
| **B10** | 53-skill corpus not auto-ingested — requires manual `npm run bug-hunter:import-skills`; no startup/migration hook; `FF_BUG_HUNTER` off by default. | `scripts/import-bug-hunter-skills.ts`; `.env.example` | Medium | **Fixed (P2)** — `importBugHunterSkills()` extracted + reused by a count-gated, `FF_BUG_HUNTER`-gated startup seed (`skill-seed-startup.ts`), mirroring catalog-sync |
| **B12** | R&D feedback loop never triggers — `rd-feedback-loop.ts` listens to `toolTestEvents`, but `tool-tester.ts` is wired to no endpoint/scheduler. | `server/index.ts:94`; no `tool-tester` import in any route | Low | **Fixed (P2)** — closed transitively by B2: the Tool Lab test endpoint now calls `runAllTests`, which emits `toolTestEvents` → the feedback loop spawns refinement experiments for failing R&D-promoted tools |

---

## 3. Agent-harness assessment

### Strengths
- **Real data/API layer.** The four `offsec-rd-*` routers are fully implemented with Zod validation, RBAC guards (`ensureRole`), and audit logging — not stubs. Schema (`research_projects`, `rd_experiments`, `rd_artifacts`, `tool_library`) is FK-correct.
- **Sound 3-phase design.** Research → POC → Nuclei delegates to specialized agents over a shared message bus; fire-and-forget with immediate HTTP response is the right pattern for long runs.
- **ATT&CK Workflows is complete end-to-end** — data-driven tactic assignment with seeding, fully wired routes.
- **Mature skill corpus + resilient build** — 53 skills with a dual pgvector/FTS retriever; `scripts/build-resilient.sh` serializes `offsec-base` then fans out 14 children with per-image retry.

### Waste & variance (Lean / Six Sigma)
- **Defects at the boundary layer (dominant waste).** The two paths that *close the harness loop* were both broken (B1 promote, B3 tool bridge) — and silently (exit 0, masked `[]`). This is the "process completes, effective outcome is zero" pathology. Fixed in Phase 1, with detectability added (B3 now logs instead of masking).
- **Over-processing / wrong coupling surface.** Dispatch keyed on English keywords in the experiment *name* (B5) — replaced with an explicit `type` column.
- **Non-utilized capability.** 7 container types invisible to the management API (B9); the feedback loop is an orphaned listener (B12); the skill corpus ships un-ingested (B10).
- **Variance from external dependency.** Experiment success silently depended on `TAVILY_API_KEY`; with it unset every research experiment "succeeded" with empty content (B11) — now gated.
- **Waiting.** Research makes 8+ sequential Tavily calls that are independent and parallelizable (P2-3).

---

## 4. Target architecture (3.0)

These were the deferred items; **all six have since landed in Phase 2** (see the
roadmap in §5 for status, and §2 for per-defect notes). Each makes an existing
surface actually work within RTPI's patterns (REST `/api/v1`, Drizzle, Redis,
`MCPServerManager`, `FF_*`). The descriptions below are retained as the design
record.

1. **MCP via `MCPServerManager` / `agent-mcp-connector`** — replace the CLI-flag `docker exec` bridge (the Phase-1 stopgap) with registration of running offsec containers as managed MCP servers over stdio/TCP. `offsec-burp` already exposes `9876:9876`. Mirrors `FF_DEFAULT_MCP_SERVERS` → catalog sync.
2. **Knowledge Base CRUD (B7)** — replace the `501` stubs in `offsec-rd-knowledge.ts:87-167` with pgvector-backed handlers on the existing `knowledge_base` table (`shared/schema.ts`), reusing `bug-hunter-skill-retriever.ts` query patterns.
3. **Skill-seed startup hook (B10)** — idempotent, count-gated, `FF_BUG_HUNTER`-gated import on startup, mirroring `MCPServerManager`'s catalog-sync (`INSERT … ON CONFLICT DO NOTHING`).
4. **Typed container registry (B9)** — promote all 14 compose offsec services to first-class `AGENT_TYPES` entries; drop reliance on the raw-segment fallback.
5. **Tool Lab wiring (B2 → B12)** — `ToolLabTab` "Test Tool" → real handler → `tool-tester.ts` → `toolTestEvents` → `rd-feedback-loop.ts`, closing the auto-refinement loop.
6. **Parallelize Tavily (P2-3)** — `Promise.all` the independent CVE/exploit queries in `research-agent.ts`.

---

## 5. Prioritized roadmap

P0/P1 are **done** (Phase 1, this branch). P2 is the backlog, ordered by value/effort.

| Priority | Item | Sev | Effort | Status |
|----------|------|-----|--------|--------|
| P0-1 | Promote route mount (B1) | Critical | 30 min | ✅ |
| P0-2 | MCP tool bridge — CLI one-shot mode + detectability (B3) | Critical | ½ day | ✅ |
| P0-3 | Dead nav link + regression test (B8) | Medium | 1 line | ✅ |
| P1-1 | Explicit artifact/project fetch in promotion (B6) | High | 30 min | ✅ |
| P1-2 | `rd_experiments.type` + dispatch (B5) | High | ½ day | ✅ |
| P1-3 | Thread cancel signal into sub-agents (B4) | High | ½ day | ✅ |
| P1-4 | Research output-quality gate (B11) | Medium | 1 hr | ✅ |
| P2-1 | MCP via `MCPServerManager` (additive, opt-in) | Critical | 2-3 days | ✅* |
| P2-2 | Knowledge Base CRUD (B7) | High | 2-3 days | ✅ |
| P2-3 | Skill-seed startup hook (B10) | Medium | ½ day | ✅ |
| P2-4 | Typed container registry, 14/14 (B9) | Medium | 2 hr | ✅ |
| P2-5 | Tool Lab test wiring → feedback loop (B2, B12) | Low/High | ½–1 day | ✅ |
| P2-6 | Parallelize Tavily research calls | Low | 2 hr | ✅ |

\* **P2-1 landed as an *additive, opt-in* capability, not a destructive swap.**
`FF_OFFSEC_MANAGED_MCP` + `POST /api/v1/offsec-agents/register-mcp` register
running offsec containers as managed MCP servers (`docker exec -i <c> node
/mcp/dist/index.js` over stdio, keyed `seed_key=offsec:<container>`, idempotent,
`autoRestart:false` so nothing boot-spawns). The Phase-1 CLI bridge remains the
**default** tool-discovery/execution path because flipping the default safely
requires a live-container validation pass (running containers with a built MCP
`dist`), which can't be done from static analysis. That validation + default
flip is the one remaining follow-up.

### Control plan
- **Route regression:** `tests/unit/client/routing/route-existence.test.ts` asserts every `setLocation("literal")` maps to a registered `<Route>` (guards B8 class).
- **Container registry regression:** `tests/unit/server/offsec-agent-registry.test.ts` asserts every `container_name: rtpi-*-agent` in `docker-compose.yml` has a typed `AGENT_TYPES.containerName` entry (guards B9 class).
- **MCP bridge:** zero-tool / non-JSON responses from a *running* container now emit a structured warning (B3) — distinguishes "no tools discovered" from "bridge failed".
- **Quality gate:** research experiments that yield no CVEs/exploits end `failed` with a reason, not blank-`completed` (B11).
- **Cancel correctness:** cancelled experiments persist `status='cancelled'`, not `failed` (B4 race fix).
- **Feedback loop liveness:** the Tool Lab test endpoint drives `runAllTests` → `toolTestEvents` → `rd-feedback-loop`; a failing R&D-promoted tool now produces a refinement experiment row, making the loop observable (B2/B12).
- **Knowledge search degradation:** KB search falls through embedding → full-text → ILIKE, so it returns results regardless of embedding-provider availability (B7).
- **Skill corpus seeding:** count-gated startup import means a fresh DB self-populates the bug-hunter corpus on first boot under `FF_BUG_HUNTER`, and reboots are no-ops (B10).

---

*Retrospective: consistent with the prior DMAIC cycle, the costliest defects sat at the boundary layer and were invisible because the transport (`docker exec`, HTTP routing) returned success while the payload was empty. The durable lesson: trace the actual end-to-end path (HTTP URL → mount → handler; `docker exec` stdout → parse) before declaring a feature "wired."*

---

## 6. Cycle 2 — Research-harness deep dive + cross-tab synergy (2026-06-06)

A second evaluation focused on the **Research Project lifecycle** (project → experiment → artifact → promoted tool) and **cross-tab synergy**. It surfaced defects *not* in the B1–B12 register — notably two correctness blockers, one a residual of the B6 fix.

### New findings (N-series)

| # | Finding | Evidence | Sev | Status |
|---|---------|----------|-----|--------|
| **N1** | Promote **always** fails — `rd-tool-promotion.ts` read `artifact.artifact_type`/`artifact.experiment_id` (snake_case), but `fetchArtifact`'s Drizzle `.select()` returns camelCase, so the type guard saw `undefined !== 'poc_code'` for every artifact. Residual of the B6 camelCase fix (the adjacent helper was corrected; these two in the main method were missed). | `rd-tool-promotion.ts:63,82` vs `schema.ts:2219` | Critical | **Fixed** — `artifactType` / `experimentId` |
| **N3** | Every UI-created project's experiments crash — `project.sourceVulnerabilityId \|\| ''` flows into `WHERE id = ''`, an invalid UUID cast that throws before any phase runs. The create-project dialog never sets `sourceVulnerabilityId`. | `offsec-rd-experiments.ts:312`, `rd-experiment-orchestrator.ts:300,589` | High | **Fixed** — early guard fails the experiment with an actionable message before the vuln fetch |
| **N5** | `executeProject` marks an **empty** project `completed` — with 0 experiments, `0+0===0 && failed===0` is true. | `rd-experiment-orchestrator.ts:630` | Medium | **Fixed** — `experiments.length > 0 &&` guard |
| **N2** | No experiment-creation UI — `ExperimentsTab` only reads/executes/cancels; experiments can only be created via raw API. Funnel is unbootstrappable from the UI. | `ExperimentsTab.tsx` (no create path) | High | **Fixed** — "New Experiment" dialog (project + type + hypothesis/methodology) POSTing the existing `POST /offsec-rd/experiments`; empty-state CTA |
| **N4** | "Artifacts" stat card counts `research_projects.artifacts` (JSONB, manual) not the `rd_artifacts` table where orchestrator output lands → shows 0. | `ResearchProjectsTab.tsx:178`, `offsec-rd-projects.ts:56` | Medium | **Fixed** — projects list returns a real `artifactCount` grouped from `rd_artifacts`; stat card + per-project badge consume it |
| **N7** | KB API is fully built but `KnowledgeBaseTab` is a static placeholder (status probe + "Planned Features") — no search/list/CRUD UI. The B7 fix landed API-only. | `KnowledgeBaseTab.tsx` | Medium | **Fixed** — full UI: search (semantic+FTS), category/type filters, article list with similarity badges, create + delete + preview; stat cards on real counts |
| **N8** | *Claimed:* R&D-promoted tools never reach the feedback loop. | `rd-tool-promotion.ts`, `offsec-rd-tools.ts:303-327` | Low/Med | **Not a defect (verified)** — `POST /api/v1/tools/registry/:id/test` (`tools.ts:1028`) calls `runAllTests` directly on the promoted `tool_registry` row, emitting `toolTestEvents` → the feedback loop fires. The evaluator missed this path. The only real gap is UX (promoted tools surface in the Tool Registry, not the R&D Tool Lab) — by design. No code change. |
| **N6** | Agent-log view is a global time-window + role filter with no `experimentId` FK on `agentMessages` → concurrent same-role experiments cross-contaminate the *messages* pane (the execution-log pane is already experiment-scoped). | `offsec-rd-experiments.ts:488-500` | Medium | **Deferred** — diagnosability only. A correct fix needs an `agent_messages.experiment_id` column **plus** threading it through `TaskDefinition` → orchestrator → every agent's `agentMessageBus.sendMessage` (5+ files in the agent runtime). Not shippable without live-execution validation; a column without population would scope the pane to empty. Path documented for a dedicated cycle. |

### Cross-tab synergy register (S-series, ranked) — ALL LANDED

| # | Connection | Status |
|---|-----------|--------|
| **S1** | Completed `research_document` artifacts → auto-insert embedded `knowledge_base` rows | **Done** — `persistArtifact` calls `createKnowledgeArticle` (shared `knowledge-base-writer.ts`), idempotent via `artifact:<id>` tag, `category=research_finding`, linked by `relatedProjectId`. Best-effort/non-fatal. |
| **S2** | R&D agents consult KB **before** Tavily | **Done** — new general `knowledge-base-reader.ts` (`searchKnowledge`, not category-locked). `research-agent` Phase 0 retrieves prior findings + seeds known CVEs (also softens B11 when prior knowledge exists); `poc-development-agent` injects prior POC/tool docs as reference patterns into its prompt. (Nuclei agent already has its own `similarTemplates` retrieval.) |
| **S4** | Promoted tools → `tool_doc` KB entry | **Done** — `promoteToToolRegistry` writes a `promoted_tool`/`tool_doc` article (usage/deps/evasion + ATT&CK mappings), idempotent via `tool:<id>`. |
| **S5** | Project card → drill into that project's experiments | **Done** — `OffSecTeam` tabs are controlled; project card "View Experiments" jumps to a `projectId`-filtered Experiments tab with a clearable filter chip. |
| **S3** | ATT&CK tactic assignments scope projects | **Done** — projects list returns `leadAgentTactics` (lead agent's `agent_tactics`⨝`attack_tactics`); rendered as an "ATT&CK scope" badge row on each card. |
| **S6** | Nuclei-template artifacts get a promotion path | **Done** — `promoteToNucleiTemplates` registers the YAML into `nuclei_templates` (severity/category parsed from YAML, idempotent on `templateId`); `POST …/artifacts/:id/deploy-nuclei` + a "Deploy" button on nuclei artifacts. Container file-deploy (`filePath` recorded) is the one follow-up needing a live container. |

### Research-harness waste (Lean/Six Sigma)
- **Defects (dominant):** N1 (100% promote failure) + N3 (~100% UI-execution failure) meant both the input and output ends of the harness were effectively non-functional for UI users. Both now fixed.
- **Non-utilized capability:** the entire KB + 53-skill RAG substrate is invisible to the R&D agents (S1/S2/S4) — ~0% of available retrieval is used in experiment planning.
- **Over-processing / inventory:** every research run re-queries Tavily from scratch (parallelized in P2-6 but still redundant across runs) and artifacts pile up in `rd_artifacts` with no retrieval path.
- **Waiting:** `executeProject` runs experiments strictly sequentially (`:607`) — ~3× latency for an independent research/POC/nuclei trio.
- **Transport:** `research-agent` routes `task_assignment` to the maldev mailbox via the bus, but no consumer polls it (INFERRED — unverified consumer).

### Remaining roadmap (Cycle 2)
**Landed (correctness):** N1, N3, N5 — verified blockers.
**Landed (repairs):** N2 experiment-create UI, N4 real artifact count, N7 full KB UI.
**Verified non-defect:** N8 (feedback loop already reachable via `tools.ts:1028`).
**Deferred (documented):** N6 per-experiment log scoping (needs `agent_messages.experiment_id` + runtime threading).
**Synergies (not yet built — enhancements, not repairs):** S1 artifact→KB (High value/low effort), S2 agents-consult-KB (highest leverage; depends on S1/S4), S4 promoted-tool→KB, S5 project drill-down, S3 ATT&CK scoping, S6 nuclei promotion; plus parallel `executeProject`.

*Retrospective (Cycle 2): the boundary-layer pathology recurred in a new form — N1 shows a partial fix (B6) can leave sibling bugs two lines away when the correction is made by pattern-matching one symptom rather than auditing the whole function. And N7 mirrors B7: "API landed" was scored as "fixed" while the UI stayed a placeholder. Going forward, a boundary fix should carry an end-to-end integration test (artifact row → `promoteToToolRegistry` → `tool_registry` row), and a "Fixed" verdict for a user-facing feature should require both API and UI evidence.*
