# RTPI Harness DMAIC v3 — Cross-Layer Breakage, Synergy & Waste Audit

**Date:** 2026-06-08
**Branch:** `optimization/harness-dmaic-v3`
**Method:** Lean/Six Sigma (DMAIC) — every finding tied to file:line evidence,
every claimed fix verified against source or test.

This cycle was a full-project review for breakage between layers (capabilities ↔
tools ↔ skills ↔ backend data ↔ frontend), synergy opportunities, process/compute
waste, and UI/UX gaps. An evaluator pass produced the initial findings; **each P0
was re-verified against source before action, and two evaluator findings were
corrected during execution (see Corrections).**

---

## Executive Summary

RTPI is structurally sound (shared schema as single source of truth, a feature-flag
registry, resilient build scripts, route-level auth) but fast phased delivery left
specific high-impact defects: the Engagement Dashboard's Workflows tab was always
empty (response-shape mismatch + ignored `operationId`); the `FF_REQUIRE_TOOL_EVIDENCE`
evidence gate was permanently dead because the flag was never registered; a duplicate
import/double-mount in `server/index.ts`; and `GET /agents/:id` shadowed the
`/workflows` and `/capabilities` routes. A half-wired LangGraph integration (service
in docker-compose, client + routes written, never mounted) was completed. Dashboard
polling waste (3s list poll + N+1 task fetch) was reduced via a batch endpoint and
WS-driven refresh. **Two evaluator findings were corrected: the "dead" A2A/SIEM/GML
flags+tables are intentional Phase-A0 forward-declarations, and the "22 orphaned
services" list is mostly false (8/10 sampled are imported).**

---

## Outcomes (this branch)

| Commit | Finding | Result |
|--------|---------|--------|
| `37dbcc2` | P0-3 duplicate import / double mount | Removed |
| `4e1e2c8` | P0-2 `FF_REQUIRE_TOOL_EVIDENCE` dead | Flag registered, both sites unified; resolves `true` at runtime |
| `43c7180` | P0-1 Engagement Workflows tab empty + UI-4 | Response unwrapped, `operationId` filter added, WS-driven refresh |
| `e59261a` | P1-2 `/agents/:id` shadow | UUID guard + `next()` (mirrors `tools.ts`) |
| `1befe83` | P1-1 + SYN-2 orphaned LangGraph routes | Mounted `skills.ts` + `orchestrator.ts`; `ORCHESTRATOR_URL` documented |
| `c966c05` | Control plan | Guardrail tests, `npm run check`, eslint `no-duplicate-imports`/`no-redeclare` |
| `6ef5e83` | P2-4 undocumented env vars | 90+ vars documented in `.env.example` with code-true defaults |
| `d3137e7` | P1-3 + SYN-1 polling/N+1 waste | Batch `/tasks-bulk` endpoint + WS emissions + reduced fallback poll |
| `7631af3` | P1-2 follow-up | Test ids → UUID format; verified zero net new test failures |

---

## CRITICAL (P0) — all fixed & verified

### P0-1 — Engagement Dashboard Workflows tab always empty
`client/src/pages/EngagementDashboard.tsx:52` read `api.get<any[]>` then
`Array.isArray(res)`, but `GET /agent-workflows` returns `{ workflows, count }`
(`server/api/v1/agent-workflows.ts:288`) → guard always fell to `[]`. Compounded:
the handler ignored `operationId` (only `status`/`targetId` filtered). **Fix:** unwrap
`res.workflows`; add `operationId` condition (column exists on `agentWorkflows`).
Verified via `route-contract-guards` test.

### P0-2 — `FF_REQUIRE_TOOL_EVIDENCE` evidence gate permanently dead
`agent-workflow-orchestrator.ts:1554` read `readFeatureFlags(env).requireToolEvidence`,
but the key was absent from `FEATURE_FLAGS` (`shared/feature-flags.ts`) → always
falsy. A second site (line 2175) read `process.env` directly, so the two disagreed.
**Fix:** register `requireToolEvidence: "FF_REQUIRE_TOOL_EVIDENCE"`; route both sites
through `readFeatureFlags`. Verified resolves `true` at runtime with env set.

### P0-3 — duplicate import breaks clean build
`server/index.ts:59` and `:62` both imported `offsecRdArtifactsRoutes`; mounted twice
(`:190`, `:196`). **Fix:** removed the dupes; relocated the B1 comment. (Note: `tsc`
already had 104 pre-existing errors and did not flag this specific dupe, so the build
claim was an overstatement — but the duplicate import + no-op double mount were real
defects and are gone.)

---

## HIGH (P1) — all addressed

### P1-1 — orphaned LangGraph routes (`orchestrator.ts`, `skills.ts`)
Neither was mounted, yet the `rtpi-orchestrator` service **is** in
`docker-compose.yml:1590` and `langgraph-client.ts` exists. Half-wired integration.
**Decision (grep-driven):** mount, not delete. `skills.ts` mounts after the existing
skill routers (no collision: its catch-all `GET /:skillName` only handles paths they
don't claim); `orchestrator.ts` on a fresh prefix. `ORCHESTRATOR_URL` documented.

### P1-2 — `/agents/:id` shadowed `/workflows` and `/capabilities`
`GET /:id` (line 370) had no UUID guard, so `GET /agents/workflows` (1056) and
`/capabilities` (1247) 404'd. **Fix:** UUID-regex guard + `next()` from `tools.ts:149`.
Tests updated to UUID-format ids (see Corrections / commit `7631af3`).

### P1-3 — Dashboard N+1 polling
`useWorkflows.ts:100` (3s list poll) + `Dashboard.tsx` (1 `/tasks` call per running
workflow every 5s). **Fix:** `GET /agent-workflows/tasks-bulk?ids=…` (one `inArray`
query) + WS-driven refresh with a 15s reconcile fallback when connected.

---

## Synergy (delivered)

- **SYN-1 — WS-driven Dashboard** (`d3137e7`): orchestrator now emits `workflow_update`
  on running/progress/completed/failed (it previously emitted **only** on abort and
  approval — the evaluator's premise that the events already existed was false). Client
  subscribes to `"*"`, refreshes on push, polls slowly only as a safety net.
- **SYN-2 — LangGraph surface exposed** (`1befe83`): orchestrator health, engagement
  control, and skill search are now reachable.

Remaining synergy ideas (not done, low risk, future): SYN-4 CTI→vulnerability
auto-enrichment; SYN-5 `FrameworkBindingsPanel` in `AttackFramework.tsx`.

---

## Corrections to the evaluator report

> Recorded so the next cycle doesn't re-flag these.

### CORRECTION 1 — the "dead" A2A/SIEM/GML flags & tables are intentional scaffolding
`FF_NEXUS_MESH`, `FF_MATRIX_A2A`, `FF_GML_TELEMETRY`, `FF_A2A_CAPABILITY_GATE` and the
tables `siemAlerts`, `agentSwarmGraphs`, `a2aAgentCards`, `a2aCapabilityMatrix` were
flagged as dead code to remove (evaluator P1-4 / Stage 4b). **They are not dead.**
`shared/schema.ts:3585-3597` documents them as **Phase A0 forward-declarations** for a
Joint Initiative roadmap (phases B3, G, H0/H), referencing ADR 011, with explicit
guidance: *"defined here in A0 so that parallel B-track work can reference one schema…
Apply with `npm run db:push` when you start the consuming phase, not before."*
**Action taken: deletion declined. No change.**

### CORRECTION 2 — the "22 orphaned services" list is mostly false
Of 10 sampled service files the evaluator called orphaned, **8 are imported** by other
modules (`page-reporter-agent`, `ops-management-orchestrator`, `mcp-grpc-bridge`,
`bbot-executor`, `nuclei-executor`, `dedup-service`, `tool-evidence`,
`output-parser-manager`). The evaluator over-counted by treating transitively-reached
files as dead. Only **two** have zero references (static or dynamic):
`hourly-ops-workflow.ts` and `scan-websocket-manager.ts`. **Action: not deleted —
recorded here as deletion candidates pending owner sign-off.** (`scan-websocket-manager`
appears superseded by `agent-websocket-manager`'s scan-streaming compatibility methods;
confirm before removing.)

---

## Waste inventory

- **Compute (fixed):** Dashboard N+1 `/tasks` loop → 1 batched query; blind 3s/5s polls
  → 15s reconcile fallback when WS live (~5× fewer steady-state calls).
- **Process (fixed):** duplicate import + double route mount removed; eslint
  `no-duplicate-imports`/`no-redeclare` added to prevent recurrence.
- **Dead code (candidates only, not removed):** `hourly-ops-workflow.ts`,
  `scan-websocket-manager.ts` — pending sign-off.

---

## Control plan (in place)

- `tests/unit/feature-flags-completeness.test.ts` — every `FEATURE_FLAGS` entry is
  documented in `.env.example`, unique, FF_-prefixed (guards the P0-2 class).
- `tests/unit/route-contract-guards.test.ts` — static guards for the `/:id` UUID
  fallthrough (P1-2), `{ workflows, count }` + `operationId` filter (P0-1), and
  `/tasks-bulk` ordering before `/:id` (P1-3).
- `npm run check` (`tsc --noEmit`) script added.
- ESLint `no-duplicate-imports` + `no-redeclare` enabled.

**Pre-existing test debt (not introduced here):** ~72 unit-test failures exist on
`main` (mock infrastructure — e.g. `db…innerJoin` not stubbed — and tool-migration /
client-component suites). This branch adds **zero** net new failures (verified by
worktree A/B on `agents.test.ts`: 3 pre-existing failures on both `main` and branch).

---

## Open follow-ups (next Kaizen cycle)

1. **Full poll removal (SYN-1 completion):** the 15s reconcile fallback is retained
   because fully trusting WS events requires live-workflow E2E verification (run a real
   agent workflow, watch a browser, confirm the list/tasks stay current with the poll
   disabled). Gate removal on that evidence.
2. **Dead-service sign-off:** confirm and remove `hourly-ops-workflow.ts` +
   `scan-websocket-manager.ts`.
3. **Pre-existing test debt:** repair the `db` mock (missing `innerJoin`) so the ~72
   `main` failures aren't masking real regressions.
4. **Synergy:** SYN-4 (CTI→vuln enrichment), SYN-5 (ATT&CK FrameworkBindingsPanel).
