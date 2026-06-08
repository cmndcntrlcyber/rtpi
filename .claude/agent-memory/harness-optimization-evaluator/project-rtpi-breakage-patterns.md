---
name: rtpi-breakage-patterns
description: RTPI project recurring breakage patterns: route ordering shadows, response format mismatches, orphaned files, feature flag drift — found 2026-06-08
metadata:
  type: project
---

RTPI has several recurring defect classes confirmed in the 2026-06-08 audit.

**Why:** Platform grew rapidly across 11 phases with many contributors; route files accumulated post-/:id routes without the UUID-guard pattern that tools.ts uses as a workaround.

**How to apply:** When reviewing new Express route files, always check that single-segment named routes (e.g. /categories, /config, /workflows) are declared BEFORE the /:id catch-all, or that /:id uses next() with a UUID guard.

## Confirmed P0 Breakages

1. **EngagementDashboard.tsx:52** — `api.get<any[]>('/agent-workflows?operationId=...')` — backend returns `{workflows:[], count:N}` not an array. `Array.isArray()` is false so `setWorkflows([])` always fires. Workflows tab always empty. ALSO: `operationId` query param is silently dropped (GET / in agent-workflows.ts:259 only filters on `status` and `targetId`).
   - Fix: unwrap `res.workflows`, add `operationId` filter to GET handler.

2. **FF_REQUIRE_TOOL_EVIDENCE** — documented in `.env.example`, used via `readFeatureFlags().requireToolEvidence` at `agent-workflow-orchestrator.ts:1554` which ALWAYS returns false because the key is absent from `shared/feature-flags.ts` FEATURE_FLAGS object. Direct env check at line 2175 works. Split code paths for same flag.
   - Fix: add `requireToolEvidence: "FF_REQUIRE_TOOL_EVIDENCE"` to shared/feature-flags.ts.

## Confirmed P1 Breakages

3. **server/index.ts:59+62** — duplicate `import offsecRdArtifactsRoutes` (TypeScript redeclare error suppressed by tsx). Also mounted twice at `/api/v1/offsec-rd/artifacts` (lines 190+196). tsc --noEmit fails.

4. **server/api/v1/orchestrator.ts** and **server/api/v1/skills.ts** — orphaned route files, NOT imported in server/index.ts. orchestrator.ts proxies to the langgraph Python service; skills.ts has /search, /:skillName, /cache/clear endpoints. Both are dead code.

## Route Shadow Pattern (systemic risk)

Express single-segment named routes defined AFTER `router.get("/:id")` without a UUID guard are silently shadowed. Files affected: agents.ts (/workflows line 1056, /capabilities line 1247 — shadow /:id at 370). No frontend calls these directly so user-facing impact is low, but internal API callers would get 404.

tools.ts uses a UUID guard + next() workaround to avoid this; that pattern should be the standard.

## N+1 Polling (waste)

Dashboard: useWorkflows polls every 3s. A separate 5s interval then calls `/agent-workflows/:id/tasks` for EACH running workflow in a serial for-loop. With N running workflows = 1+N API calls per 5s cycle.

## Dead Services (waste)

22 service files not imported anywhere: page-reporter-agent, mcp-grpc-bridge, dynamic-workflow-orchestrator (only via dynamic import), hourly-ops-workflow, http-service-detection-automation, ops-management-orchestrator, dedup-service, output-parser-manager, tool-evidence, vulnerability-reporter-agent, scan-websocket-manager, target-auto-creation-service, tool-config-deriver, rd-feedback-loop (side-effect import), bbot-executor, nuclei-executor, rust-nexus-security.

## Schema Tables Without Migrations

siemAlerts, a2aAgentCards, a2aCapabilityMatrix, agentSwarmGraphs — defined in shared/schema.ts, no migration SQL, no server code references. Orphaned schema stubs.

## Feature Flags With No Backend Implementation

nexusMesh (FF_NEXUS_MESH), matrixA2a (FF_MATRIX_A2A), gmlTelemetry (FF_GML_TELEMETRY), a2aCapabilityGate (FF_A2A_CAPABILITY_GATE) — declared in shared/feature-flags.ts, documented in .env.example, but zero server-side code checks them.
