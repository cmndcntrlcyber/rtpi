# RTPI Harness Optimization — DMAIC Report

> **Scope:** the agent-workflow harness + agent layer.
> **Method:** Lean/Six Sigma DMAIC, with evidence/truth-based objective verification.
> **Constraint:** this report proposes; it changes **no** harness source. All
> instrumentation referenced lives under [`tools/harness-eval/`](../../tools/harness-eval/) and is read-only.
> **Baseline run:** 2026-06-02, dev DB (`workflow_logs`, `ai_enrichment_logs`).

---

## Executive Summary

**Overall effectiveness verdict: UNVERIFIABLE (P0).** The harness is running —
3 workflows, 24 AI calls, 52 enrichment calls are recorded — but **not one
workflow produced an "Attack tree execution completed" event**, so the success
signal (`overallSuccess`) is `0/0`. By the truth-based-evaluation rule, absence
of a success record is *not* success: we currently **cannot prove the harness
meets its objective on any run**. Fixing the *observability* of outcomes is the
prerequisite for any optimization, and is the #1 action.

Top 3 prioritized actions:
1. **P0 — Make run outcomes observable.** Persist a structured per-run result
   (success/fail + tree stats) so success rate is computable. Today it isn't.
2. **P0 — Close the token-cost blind spot.** Harness `ai_call`s log char counts,
   never tokens; cost per run is unmeasured. The proxy data already shows AI
   latency p95 = **52.1 s** — a dominant cost that's only half-instrumented.
3. **P1 — Unify defect capture.** A real enrichment failure (invalid model id
   `claude-sonnet-4-5`) exists, yet `workflow_logs` error count is **0** — defects
   are scattered across tables, so the Pareto is blind.

---

## Define

### Stated objective
RTPI is "a unified platform for red team operations combining target management,
vulnerability tracking, AI-powered agents, and security tool orchestration"
(`CLAUDE.md`). The harness — `agent-workflow-orchestrator.ts` +
`agents/tool-execution-loop.ts` + `inference/inference-router.ts` +
`mcp-server-manager.ts` + the 25+ agents under `server/services/agents/` —
exists to **autonomously drive multi-stage penetration tests to a successful,
reported outcome**.

The completion tracker reports "262/262 items (100%)" — but that measures
*feature delivery*, not *harness effectiveness*. There is no stated definition of
"an effective run." This report proposes the CTQs below.

### CTQs (Critical-to-Quality)
| Dimension | CTQ | Definition of an effective run |
|-----------|-----|--------------------------------|
| Effectiveness | Workflow success rate; exploit-success rate; aux-discovery yield | A run that reaches `Attack tree execution completed` with `overallSuccess=true` |
| Efficiency | Wall-clock per workflow/phase; AI-call latency p50/p95; tool execs per objective | Completes within the 2 h ceiling without latency outliers |
| Cost | Tokens per run / per finding | Within a per-run token budget (currently unmeasured) |
| Reliability | Tool-exec failure rate; retry-recovery rate; provider-fallback rate; % runs hitting limits | Few defects; retries that recover; rare limit truncation |
| Autonomy quality | Approval-gate hit rate; aborted-run rate | Runs to completion without unplanned human gate or abort |

### Defect definition
For this harness a *defect* is any of: an unrecovered tool/AI error, a
hallucinated success (claims done, no evidence), a run truncated by a safety
limit, or a budget/latency violation.

---

## Measure — the truthful baseline

Computed read-only from the durable logs (see
[`tools/harness-eval/`](../../tools/harness-eval/); regenerate with
`node tools/harness-eval/normalize-kpis.mjs && node tools/harness-eval/report.mjs`).

**Data volume:** 138 `workflow_logs` rows across 3 workflows; 24 `ai_call`
events; 0 error events; 52 `ai_enrichment_logs` rows.

| CTQ | Measured value | Source |
|-----|----------------|--------|
| Workflow success rate | **n/a (0/0)** — no completion events | `workflow_logs` `overallSuccess` |
| AI-call failure rate | 0.0% (0/24) | `ai_call` `error` present |
| **AI-call latency p50 / p95** | **42,899 ms / 52,103 ms** | `ai_call` `durationMs` (`agent-workflow-orchestrator.ts:322`) |
| Provider-fallback rate | n/a (no failed calls) | `ai_call` `attempts[]` |
| Runs hitting execution/depth limit | 0 / 0 | skip log lines (`:2856-2869`) |

**Token/cost (enrichment only — vuln-scoped, NOT harness):**
| provider | model | calls | failures | avg ms | avg tokens | total tokens |
|----------|-------|------:|---------:|-------:|-----------:|-------------:|
| anthropic | claude-sonnet-4-5-20250929 | 49 | 0 | 34,513 | 3,140 | 153,852 |
| ollama | qwen3:14b | 2 | 0 | **97,378** | 6,711 | 13,422 |
| anthropic | claude-sonnet-4-5 | 1 | **1** | 2,767 | 0 | 0 |

### Coverage gaps (reported, never assumed zero)
| Gap | Why unmeasurable today | Proposed (not applied) fix |
|-----|------------------------|----------------------------|
| Harness token cost | `ai_call` logs `promptCharCount`/`responseCharCount` only (`:323-324`) | Log `usage` tokens, mirroring `ai_enrichment_logs` columns (`shared/schema.ts:1990-1992`) |
| Per-tool failure rate | tool-loop emits via EventEmitter only, not persisted (`tool-execution-loop.ts:153-159`) | Persist tool outcomes (exitCode, durationMs, timedOut) |
| Retry-recovery rate | retries not tagged retry-of-N (`WORKFLOW_RETRY_MAX_RETRIES=3`) | Tag attempts with parent id + final outcome |
| Wall-clock per phase | phase boundaries are free-text messages | Emit structured `phase_start`/`phase_end` |

---

## Verify objectives via evidence (NON-NEGOTIABLE)

| Objective | Claim | Verification method available | Evidence found | Verdict |
|-----------|-------|-------------------------------|----------------|---------|
| Harness completes pentest workflows | Tracker: "100% complete" | `workflow_logs` completion events | **0** completion events across 3 workflows | **UNVERIFIABLE** |
| AI inference is reliable | — | `ai_call` error rate | 0/24 errored at the orchestrator layer | PASS (layer-local) |
| AI enrichment is reliable | — | `ai_enrichment_logs.success` | 1 failure (model id `claude-sonnet-4-5`, 0 tokens) | **PARTIAL** (1 real defect) |
| Runs stay within cost budget | — | tokens per run | Not logged for harness | **UNVERIFIABLE** |

The headline: the platform's own logs cannot today substantiate that a single
harness run achieved its objective. This is the gap to close first.

---

## Analyze — root cause

### Pareto of what the data shows
With 0 errors in `workflow_logs` but a real failure in `ai_enrichment_logs`, the
dominant issue is **not** crashes — it is **latency and unobservability**:
1. **Latency (vital few).** AI-call p95 = 52.1 s; ollama enrichment avg = 97.4 s.
   These dominate wall-clock. A multi-call workflow spends most of its 2 h budget
   *waiting* on inference.
2. **Unobservable outcomes.** 3 workflows, 0 completion records → the success CTQ
   is structurally uncomputable.
3. **Scattered defects.** The one real failure isn't in the harness log stream.

### Fishbone — "objective cannot be verified met"
- **Orchestration:** completion event only emitted on the attack-tree path
  (`:1298-1305`); runs that don't reach it leave no success/fail record.
- **Context/Memory:** `ai_call` `context` is free-text `json`, not queryable KPIs.
- **Model/Tooling:** invalid model id (`claude-sonnet-4-5` vs dated
  `…-20250929`) produced a silent 0-token failure — a config defect, not a logged harness error.
- **Environment:** ollama local inference (~97 s) vs hosted anthropic (~35 s) —
  provider choice is a latency lever.

### 8-wastes (DOWNTIME) on a representative run — each tied to evidence
- **Waiting:** AI-call p95 52 s; ollama 97 s avg — the largest waste.
- **Defects:** invalid-model-id enrichment failure (1/52); embedding test failure
  class (`ai-clients.ts:35`, `memory-service.ts:664`).
- **Over-processing:** hardcoded `maxTotalExecutions=50`, `maxDepth=5`
  (`:1224-1230`) applied uniformly regardless of target — not data-derived.
- **Non-utilized data:** char counts logged but tokens (the real cost signal)
  discarded at `:323-324`.
- **Motion (loops):** `tool-execution-loop` `maxIterations=10` with no persisted
  per-iteration outcome — loop efficiency is invisible.

---

## Improve — prioritized recommendations (PROPOSALS ONLY — not applied)

Ranked by ICE (Impact × Confidence ÷ Effort). None of these are implemented in
this task; each names the CTQ it moves and how to verify.

| # | Priority | Recommendation | CTQ moved | Expected effect | How to verify | Risk |
|---|----------|----------------|-----------|-----------------|---------------|------|
| 1 | **P0** | Emit a structured per-run outcome record (success/fail + tree stats) for **every** run path, not just the attack-tree branch | Workflow success rate | Makes success rate computable (today 0/0) | `normalize-kpis.mjs` shows non-zero `completed_runs` | Low — additive logging |
| 2 | **P0** | Log inference `usage` tokens on `ai_call` (mirror `ai_enrichment_logs` columns) | Harness token cost | Cost per run becomes measurable | `ai-calls.csv` gains token columns | Low |
| 3 | **P1** | Unify defect capture: route tool/model failures into `workflow_logs` at `level='error'` | Defect rate / Pareto | The real failure (invalid model id) appears in the Pareto | Defect Pareto non-empty when failures occur | Low |
| 4 | **P1** | Replace hardcoded limits (`maxDepth=5`, `maxTotalExecutions=50`, `maxIterations=10`) with config-driven, evidence-derived defaults + per-agent override | Efficiency / reliability | Limits justified by where runs actually terminate | Re-baseline: % runs hitting limits stays low | Medium — behavior change, gate behind config |
| 5 | **P1** | Latency budget: prefer hosted inference for latency-critical phases; cap ollama use where its ~97 s avg blows the phase budget | Efficiency (latency) | Cut p95 well below 52 s | AI-call p95 drops on re-baseline | Medium — cost/locality tradeoff |
| 6 | **P2** | Add timeout-budget compensation across BBOT(30 m)→Nuclei(3 m)→assessment so a long upstream scan shrinks downstream budgets | Reliability | Fewer 2 h-ceiling overruns | No run truncated by global timeout | Medium |
| 7 | **P2** | Fix embedding-test defect class (`dangerouslyAllowBrowser` / env guard) | Defect rate | Embedding tests run in CI | `npm test` green for memory-service | Low |

**Lean ordering principle applied:** items 1–3 *eliminate measurement waste*
(make the system observable) before items 4–6 *add tuning* — you cannot optimize
what you cannot see.

---

## Control — sustain the gains

- **Re-baseline cadence:** run `tools/harness-eval/normalize-kpis.mjs` +
  `report.mjs` on a schedule (wire later via `/loop` or `/schedule`; not
  auto-created here) and compare against control limits.
- **Control limits (initial, refine after more data):** AI-call p95 ≤ 30 s;
  workflow success rate tracked once computable; defect Pareto reviewed each cycle.
- **Regression guardrail:** any new run with 0 completion events or a token-less
  `ai_call` is a control breach — flag, don't ignore.
- **Retrospective loop:** convert the ad-hoc `docs/archive/improvements/` practice
  into a recurring postmortem using
  [`retrospectives/TEMPLATE.md`](retrospectives/TEMPLATE.md). Each cycle's
  findings seed the next Improve backlog (Kaizen).

---

## Retrospective & next Kaizen cycle

- **What this cycle found:** the harness's biggest problem isn't crashes — it's
  that **success is unobservable and cost is unmeasured**. The instrumentation,
  not the orchestration logic, is the constraint.
- **What to do next cycle:** implement P0 items 1–2 (observability), re-baseline,
  then revisit limits (item 4) with real termination data instead of magic numbers.
- **Truth-based invariant carried forward:** never report a CTQ as "good" from
  absence of bad data. `0/0` is unverified, not success.
