---
name: rtpi-research-harness-cycle2
description: Cycle 2 findings for the Research Project harness and cross-tab synergy evaluation (branch RT-Mod-2-Submission, 2026-06-06)
metadata:
  type: project
---

Evaluation of the Research Project harness and 6-tab cross-tab synergy after B1-B12 remediation.

**Why:** User requested a READ-ONLY deep evaluation of the remaining gaps after Phase 1+2 remediation; prior pass only touched the harness shallowly.

**How to apply:** Treat these as the known unresolved gaps when planning future work.

## Critical finding (N1 — promotes always fail)

`server/services/rd-tool-promotion.ts:63` checks `artifact.artifact_type !== 'poc_code'` but Drizzle returns `artifactType` (camelCase). `artifact.artifact_type` is always `undefined`, so `undefined !== 'poc_code'` → `true` → every promotion attempt returns failure with "Can only promote poc_code artifacts. Got: undefined". Same file `:82` also uses `artifact.experiment_id` (snake_case, undefined). These are the two residual B6-class snake_case field access bugs that survived the Phase 1 fix.

## High findings

**N2 — Missing experiment creation UI:** `ExperimentsTab.tsx` has no "Create Experiment" button or dialog. The only way to create experiments is via API. The empty-state message at `:531` says "Create a research project first, then add experiments to it" but provides no UI to actually do the second step. This breaks the project→experiment funnel at the very top.

**N3 — empty vulnerabilityId propagation:** Both `offsec-rd-experiments.ts:314` (single execute) and `rd-experiment-orchestrator.ts:589` (executeProject) pass `project.sourceVulnerabilityId || ""` as `vulnerabilityId`. When `sourceVulnerabilityId` is null (common for projects created without a source vuln), `""` is passed to all three agent phases, which then try `WHERE id = ''` on a UUID column → always throw "Vulnerability  not found" → every experiment in every fresh project fails immediately.

**N4 — Dual artifact model (JSONB vs rd_artifacts) causes stat card lie:** `research_projects.artifacts` is a JSONB array (`schema.ts:2167`) for manual file-path records. `rd_artifacts` is the actual experiment output table. `ResearchProjectsTab.tsx:178` counts `p.artifacts?.length` from the JSONB array, which is always 0 for orchestrator-created projects. The "Artifacts" stat card shows 0 even when dozens of real experiment artifacts exist in `rd_artifacts`.

**N5 — executeProject auto-completes empty projects:** `rd-experiment-orchestrator.ts:617` computes `allComplete = completed + failed === experiments.length`. When `experiments.length === 0` (no experiments), `0 + 0 === 0` = true and `failed === 0` sets project status to `completed`. Any fresh project with no experiments is auto-completed on "Execute All."

## Medium findings

**N6 — Agent-log messages not scoped to experiment:** `offsec-rd-experiments.ts:488-500` filters `agentMessages` by time window + role list only. No `experimentId` column on `agentMessages` means two concurrent experiments produce interleaved logs.

**N7 — KnowledgeBase tab has API but no UI:** Full CRUD+search API landed (B7 fix) but `KnowledgeBaseTab.tsx` is still a status card with "Planned Features" section. No search input, no article list, no create form.

**N8 — R&D-promoted tools are invisible to feedback loop:** `rd-tool-promotion.ts` inserts to `tool_registry` only, not `tool_library`. Tool Lab test endpoint resolves via `tool_library → security_tools → tool_registry` by name. Promoted R&D tools have no `tool_library` row, so they can never be reached by the Tool Lab test button, and therefore `toolTestEvents` never fires for them.

## Cross-tab synergy gaps (missing connections)

**S1 (highest value):** Research artifacts (research_document type) are never auto-ingested into `knowledge_base`. This is the highest-leverage connection: every completed research experiment produces structured CVE+exploit intelligence that could be embedded and made retrievable for future experiments via `retrieveBugHunterSkills`.

**S2:** `retrieveBugHunterSkills` / `bug-hunter-skill-retriever.ts` is called by bug-hunter agents (chain-agent, hunt loop, report agent) but NEVER by `research-agent.ts`, `poc-development-agent.ts`, or `nuclei-template-agent.ts`. The 53-skill corpus that cost significant effort to build is walled off from the R&D pipeline.

**S3:** ATT&CK tactic assignments (agent_tactics, attack_tactics tables) have no connection to research project or experiment scoping. A project of type `technique_development` could be auto-seeded with ATT&CK techniques relevant to the agent's assigned tactics.

**S4:** `tool_registry` rows from promotion have no `tool_library` entry and no `knowledge_base` entry. Tool docs, usage examples, known issues should auto-flow to KB as `contentType: tool_doc`.

**S5:** `ResearchProjectsTab` has no drill-down to experiments. Clicking a project card shows artifact count but provides no way to view/add experiments for that project.

## Key file:line citations

- `server/services/rd-tool-promotion.ts:63` — artifact_type snake_case bug (N1)
- `server/services/rd-tool-promotion.ts:82` — experiment_id snake_case bug (N1)
- `client/src/components/offsec-team/ExperimentsTab.tsx:531` — no create UI (N2)
- `server/api/v1/offsec-rd-experiments.ts:314` — empty vulnerabilityId (N3)
- `server/services/rd-experiment-orchestrator.ts:589` — empty vulnerabilityId (N3)
- `client/src/components/offsec-team/ResearchProjectsTab.tsx:178` — wrong artifact count (N4)
- `server/services/rd-experiment-orchestrator.ts:617` — empty project auto-complete (N5)
- `server/api/v1/offsec-rd-experiments.ts:488-500` — unscoped agent log messages (N6)
- `client/src/components/offsec-team/KnowledgeBaseTab.tsx` — no CRUD UI (N7)
- `server/services/rd-tool-promotion.ts` (no toolLibrary insert) — feedback loop gap (N8)
