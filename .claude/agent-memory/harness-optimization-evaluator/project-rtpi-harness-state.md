---
name: project-rtpi-harness-state
description: Current state of the RTPI agent-workflow harness evaluation — key findings, defects, baselines, and what has been verified vs. proposed as of 2026-06-02.
metadata:
  type: project
---

## Confirmed Facts (evidence-grounded, 2026-06-02)

The harness runs 6 completed workflows (message "Workflow completed successfully") but produces
0 real security findings per run.

**The dominant P0 defect:** `tool_registry.config.baseCommand = ""` for the metasploit tool
(UUID b7469e5f-1a32-4ef1-a3b6-fbfe8e80e9ca). The executor's legacy stub (`tool-executor.ts:292-326`)
built the command as just the bare target domain string (e.g., "openapi.starbucks.com"), which
invokes msfconsole interactively, prints the splash banner, and exits with code 0. No attack runs.

All 6 downstream agents (Bug Hunter Scope/Recon/Hunt/Chain, Advanced Fuzzing, Technical Report
Writer) have no enabled tools and receive the Operations Manager's AI fabrication as their only
input — an AI-on-AI hallucination cascade 6 layers deep per workflow.

The AI model (gemma4:e4b) correctly self-reported "no actionable data" in every tool_execution_summary
call — the model is not the source of the problem; the orchestrator design is.

**Why:** The tool-config-deriver (`tool-config-deriver.ts`) either was never triggered or failed
for this row, and the auto-repair stub wrote an empty baseCommand. No output-quality gate blocks
the workflow from proceeding on splash-screen output.

**Measurement gap (prior report):** `normalize-kpis.mjs` queries for message = 'Attack tree
execution completed' only. The Template-Driven Execution path emits "Workflow completed
successfully" (with context={} — no outcome data). The prior report showed 0/0 completions
(UNVERIFIABLE); the correct reading is 6/6 process completions, 0/6 effective completions.

## Current Baselines (2026-06-02)

- workflow_log rows: 276 / 6 workflows / 48 ai_call events / 0 error events
- AI-call p50 / p90 / p95: 51,350 / 69,411 / 73,060 ms (all ollama/gemma4:e4b)
- Per-workflow AI wait: 217 — 520 s
- Tool executions per workflow: 1 (Metasploit, splash-only, exit=0)
- Real findings per run: 0
- Enrichment: 49 successful (claude-sonnet-4-5-20250929), 1 failure (claude-sonnet-4-5 no date suffix, connection error)

## What Remains Unmeasurable

- Harness token cost: ai_call logs charCount only, never tokens (orchestrator.ts:322-324)
- Per-tool failure rate: tool-execution-loop emits via EventEmitter only, not persisted
- Retry-recovery rate: retries not tagged in workflow_logs

## Key Source Locations

- Metasploit tool_registry config defect: DB, tool_registry table, UUID b7469e5f
- AttackTreeConfig defaults (maxDepth:5, maxTotalExecutions:50): orchestrator.ts:1224-1230
- Attack-tree completion event: orchestrator.ts:1298-1305
- Template-driven path: orchestrator.ts:1513-1590 (executeTemplateDrivenAgent)
- ai_call log site (no tokens): orchestrator.ts:311-325
- Tool command builder legacy stub: tool-executor.ts:292-326
- DEFAULT_CONSTRAINTS (maxIterations:10, maxDurationMs:30min): tool-execution-loop.ts:153-159
- tool_start/tool_complete EventEmitter (not persisted): tool-execution-loop.ts:379, 403

## P0 Proposals (NOT yet implemented)

1. Fix metasploit baseCommand in tool_registry (DB config, not source)
2. Add output-quality gate before task success signal
3. Add outcome fields to "Workflow completed successfully" event
4. Log inference tokens on ai_call events

**Why:** The effective completion rate is 0/6. The hallucination cascade is architectural.
**How to apply:** Fix P0-1 first — all other improvements are meaningless until real tool output
flows through the pipeline.

See `docs/optimization/rtpi-harness-dmaic-v2.md` for the full DMAIC report.
See `docs/optimization/retrospectives/2026-06-02-dmaic-v2.md` for the retrospective.
