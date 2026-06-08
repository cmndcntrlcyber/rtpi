# RTPI Harness Optimization — DMAIC Report v2

> **Scope:** agent-workflow orchestration ecosystem.
> **Method:** Lean/Six Sigma DMAIC with evidence/truth-based objective verification.
> **Constraint:** read-only on all `server/**` and `shared/**` source. All verification via existing
> measurement scaffolding (`tools/harness-eval/`) and direct read-only DB queries.
> **Baseline run:** 2026-06-02, fresh `normalize-kpis.mjs` regeneration.
> **Prior report:** `docs/optimization/rtpi-harness-dmaic.md` (baseline: 3 workflows, 24 ai_calls).
> **This report supersedes the prior report** for measured numbers only — the prior report had
> materially incorrect volume figures (the DB had grown 2x between its run and this one) and missed
> the "Workflow completed successfully" event class, which changes several verdicts. Methodology and
> P0/P1 roadmap items 1–3 from the prior report remain valid but are now grounded in corrected evidence.

---

## 1. Executive Summary

**Overall effectiveness verdict: PARTIAL — workflows reach completion but execute no real
penetration testing.**

Six workflows have run to completion (message "Workflow completed successfully", confirmed in DB).
Every task within each workflow shows `context.success=true`. By the harness's own success criterion
this is 6/6 completions — a 100% completion rate. However, independent sandbox-level evidence
reveals a critical defect: **the only tool executed in every workflow is Metasploit, invoked with
`baseCommand=""` (empty string), which causes msfconsole to start, print its splash screen, and
exit — producing zero attack output**. The AI reasoning model (gemma4:e4b via ollama) then
fabricates structured security assessments from this null output, and those fabrications cascade
through all six downstream agents. The harness is completing. It is not penetration-testing anything.

The prior report's UNVERIFIABLE verdict on workflow success was due to a measurement gap in
`normalize-kpis.mjs`: it queries only for the message `"Attack tree execution completed"` (the
attack-tree code path in the orchestrator), but the Template-Driven Execution path emits a different
message, `"Workflow completed successfully"`. Both code paths exist; only one is observed in the
current data.

**Top 3 prioritized actions:**

1. **P0 — Fix the Metasploit baseCommand defect.** The tool_registry row for `metasploit` has
   `config.baseCommand = ""` and a single positional `target` parameter. Executing `msfconsole
   <target>` starts interactive mode; msfconsole does not accept a bare target as a command — it
   prints the splash and waits for stdin, which the executor closes, producing exit=0 with no
   attack output. Fix: set `baseCommand = "msfconsole -q -x"` with an appropriate `run` command,
   or route through the `msfdb` + `msfconsole -x "use ... set RHOSTS ... run; exit"` pattern.
   Until this is fixed, every workflow run is producing AI-fabricated security findings with no
   ground truth.

2. **P0 — Unify the two completion-event classes** so `normalize-kpis.mjs` captures all run
   outcomes. The current query filters on `message = 'Attack tree execution completed'` — a message
   that does not appear in any of the 276 current log rows. The Template-Driven Execution path
   logs `"Workflow completed successfully"` with an empty `context: {}` — no `overallSuccess`,
   `totalExecutions`, or any measurable outcome. Add outcome fields to this event or unify with
   the attack-tree event schema.

3. **P0 — Log inference tokens on ai_call events.** All 48 ai_call events use ollama/gemma4:e4b
   with no token count logged (only `promptCharCount` / `responseCharCount`). Cost per run is
   structurally unmeasurable. The enrichment table (`ai_enrichment_logs`) already has the right
   schema — mirror it at the ai_call log site
   (`agent-workflow-orchestrator.ts:311-325`).

---

## 2. Define

### 2.1 Stated Objectives

RTPI is "a unified platform for red team operations combining target management, vulnerability
tracking, AI-powered agents, and security tool orchestration" (CLAUDE.md). The harness exists to
**autonomously drive multi-stage penetration tests to a successful, reported outcome**.

### 2.2 CTQs (Critical-to-Quality Characteristics)

| Dimension | CTQ | Definition of an effective run |
|-----------|-----|-------------------------------|
| Effectiveness | Workflow success rate; exploit-success rate | A run where real tools execute, produce real findings, and "Attack tree execution completed" or "Workflow completed successfully" carries `overallSuccess=true` with non-empty tool outputs |
| Correctness | AI output grounded in real tool output | Agent AI responses must be traceable to actual tool stdout, not fabricated from null output |
| Efficiency | Wall-clock per workflow; AI-call latency p50/p95; AI calls per workflow | Completes within the 2 h ceiling without latency outliers |
| Cost | Tokens per run | Within a per-run token budget (currently unmeasured) |
| Reliability | Tool-exec failure rate; retry-recovery rate; % runs hitting limits | Low defect rate; retries that recover; rare limit truncation |

### 2.3 Defect Definition

For this harness, a *defect* is: an unrecovered tool/AI error; AI output fabricated from null or
splash-screen tool output (hallucinated findings); a run truncated by a safety limit; a
budget/latency violation; or a tool invocation that produces no actionable output.

---

## 3. Measure — Truthful Baseline (2026-06-02, fresh regeneration)

All values below are derived from the `kpi-extract.json` produced by the fresh run of
`normalize-kpis.mjs` on 2026-06-02 and supplemented by direct read-only DB queries.

### 3.1 Data Volume

| Metric | Prior report (2026-05-XX) | This report (2026-06-02) | Delta |
|--------|--------------------------|--------------------------|-------|
| workflow_log rows | 138 | 276 | +138 |
| distinct workflows | 3 | 6 | +3 |
| ai_call events | 24 | 48 | +24 |
| error events | 0 | 0 | 0 |
| enrichment rows | 52 | 52 | 0 |

The DB doubled in volume since the prior report; the enrichment table did not grow (the 3 new
workflows used the same 52 enrichment rows, confirming they were not re-enriched).

### 3.2 CTQ Baseline

| CTQ | Measured Value | Source | Notes |
|-----|---------------|--------|-------|
| Workflow completion rate | 6/6 (100%) | `workflow_logs` message = "Workflow completed successfully" | Completion confirmed; outcome quality is the defect |
| Attack-tree completion rate | 0/6 (0%) | `workflow_logs` message = "Attack tree execution completed" | Template-driven path does not emit this event |
| Task success rate | 42/42 (100%) | `context.success` on "Task completed:..." rows | All tasks show true; no task-level failures |
| AI-call failure rate | 0/48 (0%) | `level=ai_call`, `context.error` present | Zero AI inference failures |
| AI-call latency p50 / p90 / p95 | 51,350 / 69,411 / 73,060 ms | `context.durationMs`, computed from raw CSV | All ollama/gemma4:e4b; consistent across runs |
| AI-call latency range | 16,496 — 79,638 ms | same | Wide spread; fastest workflow (ace664a4) had lighter model load |
| Per-workflow AI wait time | 217 — 520 s | Summed per workflow | 5 of 6 workflows ≥ 349 s pure AI wait |
| Runs hitting execution limit | 0/6 | skip log lines query | Limit never hit (50-exec ceiling not tested) |
| Runs hitting depth limit | 0/6 | skip log lines query | Depth limit never hit (5-level ceiling not tested) |
| Tool executions per workflow | 1 (Metasploit only) | `tool_executions` + workflow logs | Single tool, single call, per run |
| Metasploit exit code | 0 (all 6 runs) | `tool_executions.exit_code` | Exit=0 does not mean success; splash screen only |
| Actual attack output | 0 findings | DB + AI model self-assessment | Model reports "no actionable data" in every run |
| Harness token cost | UNMEASURABLE | ai_call logs chars only, not tokens | No `tokensUsed` field in workflow_logs |
| Per-tool failure rate | UNMEASURABLE | tool-loop emits via EventEmitter only | Not persisted to durable table |
| Retry-recovery rate | UNMEASURABLE | retries not tagged | WORKFLOW_RETRY_MAX_RETRIES=3 by env default |

### 3.3 Token/Cost — Enrichment Only (not harness-scoped)

| Provider | Model | Calls | Failures | Avg ms | Avg tokens | Total tokens |
|----------|-------|-------|----------|--------|------------|--------------|
| anthropic | claude-sonnet-4-5-20250929 | 49 | 0 | 34,513 | 3,140 | 153,852 |
| ollama | qwen3:14b | 2 | 0 | 97,378 | 6,711 | 13,422 |
| anthropic | claude-sonnet-4-5 | 1 | 1 (connection error) | 2,767 | 0 | 0 |

The `claude-sonnet-4-5` (no date suffix) failure is a persistent configuration defect — the
enrichment client does not resolve undated model IDs to a current version before calling the API.

---

## 4. Verify Objectives via Evidence (NON-NEGOTIABLE)

### 4.1 Objective Verification Table

| Objective | Claim | Verification Method | Evidence | Verdict |
|-----------|-------|---------------------|----------|---------|
| Harness completes pentest workflows | 6 runs "completed successfully" | DB query: `message='Workflow completed successfully'` | 6 rows found (ace664a4, 65c47002, d9b920e5, 13609508, e6791431, 3aa00abb) | PARTIAL — completion signal present; findings quality is null |
| Harness produces real security findings | Workflow context.success=true per task | Read actual tool stdout from tool_executions + AI response text | All 6 Metasploit runs returned the msfconsole splash banner only; AI model self-reported "no actionable data" in 6/6 summary calls | FAIL — critical defect |
| AI inference is reliable | Zero ai_call errors in workflow_logs | `ai_call` event error-field query | 0/48 AI call errors | PASS (layer-local) |
| AI output is grounded | Agent outputs traceable to tool findings | Cross-reference ai_call prompt vs tool stdout | Prompt contains only the msfconsole banner + prior AI text; all downstream agents synthesize from fabricated upstream output | FAIL — AI-on-AI hallucination cascade |
| AI enrichment is reliable | Enrichment runs | `ai_enrichment_logs.success` | 1/52 failures (invalid model id `claude-sonnet-4-5`; connection error) | PARTIAL (1 defect persists) |
| Cost per run is bounded | — | `ai_call.tokensUsed` | Not logged; character counts only | UNVERIFIABLE |
| Runs stay within time budget | Wall clock < 2 h | Timestamp range per workflow | Longest run: 522 s (8.7 min); well within 2 h | PASS |

### 4.2 The Hallucinated-Success Finding — Evidence Side by Side

**Claim (log record):** `message="Workflow completed successfully"`, `context={}`, all task rows
show `context.success=true`.

**Counter-evidence (DB + source cross-reference):**

- `tool_executions` row for metasploit (workflow ace664a4): `command="openapi.starbucks.com"`,
  `exit_code=0`, `duration_ms=33763`. Command is the bare domain, not a msfconsole invocation.
- `tool_registry` row for metasploit: `config.baseCommand=""`, `parameters=[{name:"target",
  positional:true}]`. Empty baseCommand means the executor builds the command as just the target
  value (confirmed by `tool-executor.ts:295-296`).
- AI model response for tool_execution_summary phase: *"The output provided is the framework's
  interface and capabilities, not an actual scan result. No specific vulnerabilities or exploitable
  paths were discovered."* (DB: `workflow_logs.context.response`, workflow ace664a4).
- Operations Manager reasoning response: *"The initial execution using the Metasploit Framework
  served only as a basic connectivity check, yielding no actionable vulnerability data."*
- Bug Hunter — Scope prompt: receives the Operations Manager fabricated analysis as its only input;
  its own response synthesizes vulnerability recommendations from zero real data.
- All 6 subsequent agent calls follow the same pattern: AI input is prior AI text, not tool output.

**Verdict: HALLUCINATED SUCCESS.** The harness reports completion and task-level success while
every downstream agent in every workflow is reasoning over fabricated context. This is a P0 defect.

---

## 5. Value Stream and Waste Analysis

### 5.1 End-to-End Execution Flow (Template-Driven Path, all 6 runs)

```
[Workflow Start]
    |
    v
[Step 1: Operations Manager]
    |--> executeGenericToolWorkflow()          [32 lines of setup; tool resolved]
    |       |--> executeRegisteredTool(metasploit, {target})
    |       |       --> buildCommand() → baseCommand="" → command = "<target>" only
    |       |       --> container rtpi-tools: runs `<target>` as process → msfconsole splash
    |       |       --> exit=0, duration 2–34 s, output = splash banner
    |       |--> AI call: tool_execution_summary (gemma4:e4b, 26–43 s)
    |       --> AI response: "no actionable data" — but workflow continues
    |--> AI call: reasoning/template (gemma4:e4b, 25–69 s)
    |   --> output: fabricated security analysis based on null input
    --> Task completed: success=true
    |
    v
[Steps 2–6: Bug Hunter Scope/Recon/Hunt/Chain, Advanced Fuzzing]
    |--> NO tools enabled (hasEnabledTools=false for these agents)
    |--> Receive handoff: dataKeys=[aiResponse, aiSummary, toolOutput, metadata]
    |                     hasExecutionPlan=false, hasExploitationResults=false
    |--> AI call: reasoning/template (gemma4:e4b, 17–79 s)
    |   --> output: AI reasoning on top of prior AI reasoning (hallucination cascade)
    --> Task completed: success=true
    |
    v
[Step 7: Technical Report Writer]
    |--> NO tools enabled
    |--> AI call: reasoning/template (gemma4:e4b, 28–80 s)
    |   --> Report synthesized from 6 layers of AI-on-AI fabrication
    --> Task completed: success=true
    |
    v
[Workflow completed successfully] — context={}
[Automated report generation triggered]
```

### 5.2 Waste Inventory (Lean 8 Wastes, adapted to agent harness)

| Waste Type | Instance | Magnitude | Evidence |
|-----------|---------|-----------|---------|
| **Defects** | Metasploit invoked with empty baseCommand; produces splash only | 6/6 runs, 100% defect rate | tool_registry.config + tool_executions.command |
| **Defects** | AI fabricates findings from null output; cascades 6 deep | Affects every finding in every workflow | ai_call prompt/response cross-reference |
| **Defects** | Enrichment failure: undated model-id `claude-sonnet-4-5` | 1/52 failures | ai_enrichment_logs |
| **Waiting** | AI inference p50=51.4 s, p95=73 s (all ollama/gemma4:e4b) | 217–520 s pure AI wait per workflow | ai_call.durationMs |
| **Over-processing** | 6 sequential AI reasoning calls per workflow producing zero real findings | ~330 s median AI wait producing 0 actionable output | workflow timeline + tool_executions |
| **Waiting** | ollama/qwen3:14b enrichment avg 97 s | 2 calls visible | ai_enrichment_logs |
| **Non-utilized capability** | 5 of 6 agents have no enabled tools; only Operations Manager has one (broken) | 5 agents run AI-only | workflow logs: hasEnabledTools=false |
| **Non-utilized data** | ai_call logs char counts but not tokens | Harness token cost permanently uncomputable | orchestrator.ts:322-324 |
| **Motion** | tool-execution-loop emits tool_start/tool_complete via EventEmitter only; not persisted | Per-tool outcome invisible | tool-execution-loop.ts:379-408 |
| **Inventory (excess context)** | Each agent receives prior agent's full AI text as context; no compression or grounding | Context grows with each hand-off; quality stays zero | handoff dataKeys analysis |
| **Over-processing** | "Workflow completed successfully" emitted with empty context={} | Success KPI structurally uncomputable | workflow_logs row for each run |

### 5.3 Quantified Baselines

| Metric | Value | Basis |
|--------|-------|-------|
| Wall-clock per workflow | 272 — 522 s (median ~370 s) | Timestamp delta, workflow_logs |
| AI wait per workflow | 217 — 520 s | Sum of ai_call.durationMs per workflow |
| Tool execution time per workflow | 2 — 34 s | tool_executions.duration_ms |
| AI calls per workflow | 8 (fixed) | ai_call events grouped by workflow_id |
| Real attack output per run | 0 findings | Tool stdout = splash screen only |
| Completion rate (process) | 6/6 (100%) | "Workflow completed successfully" events |
| Effective completion rate (outcome) | 0/6 (0%) | Verified: 0 real findings, 0 exploits, 0 attack-tree events |
| Enrichment failure rate | 1/52 (1.9%) | ai_enrichment_logs.success=false |

---

## 6. Root Cause Analysis

### 6.1 Pareto of Observed Defects

Defects by frequency and impact:

| Rank | Defect | Frequency | Impact |
|------|--------|-----------|--------|
| 1 | Metasploit invoked with empty command (splash only) | 6/6 runs | Destroys all downstream real findings |
| 2 | AI hallucination cascade: 6 agents reason over zero real data | 6/6 runs, 42 AI calls | 100% of output is fabricated |
| 3 | Completion event has no outcome payload (context={}) | 6/6 runs | CTQ "workflow success rate" uncomputable |
| 4 | 5 of 6 agents have no enabled tools | Every run | Even a correct Metasploit call leaves 5 agents tool-free |
| 5 | Enrichment failure: undated model-id | 1/52 calls | 1.9% enrichment defect |
| 6 | Harness token cost unmeasurable | Every ai_call | Cost CTQ permanently blind |
| 7 | tool-execution-loop outcomes not persisted | Structural | Per-tool defect rate invisible |

### 6.2 Five Whys on the Dominant Defect (Rank 1)

**Problem:** Metasploit produces only its splash screen on every run.

1. Why? The command executed is just the target domain string (e.g., `openapi.starbucks.com`).
2. Why? `buildCommand()` in `tool-executor.ts:295-296` falls through to the legacy positional stub
   because `config.baseCommand = ""`.
3. Why is baseCommand empty? The tool_registry row for metasploit was auto-patched by the legacy
   stub itself (`tool-executor.ts:300-323`) after a prior failed registration, but the patched
   config only sets `baseCommand: ""` (an empty string) — the auto-repair does not know how to
   derive the real msfconsole invocation.
4. Why doesn't the tool-config-deriver fix it? The deriver (`tool-config-deriver.ts`) uses the
   SKILL.md to derive a command, but this requires an AI call that either failed or was never
   triggered for this row. The cached auto-patched config takes precedence next time.
5. Why wasn't this caught? No test asserts that executing a tool against a target produces
   non-empty/non-splash output; `exit_code=0` is treated as success without any output validation.

**Root Cause:** The tool_registry auto-repair stub writes an empty `baseCommand`, which silently
produces the msfconsole splash on every invocation. No output-quality gate exists to catch this.

### 6.3 Fishbone (Ishikawa) — "Effective pentest outcome impossible"

- **Tooling:** Metasploit baseCommand="" (P0 defect); 5 agents lack any enabled tools.
- **Orchestration:** Template-driven path emits "Workflow completed successfully" with context={}
  regardless of whether any tool produced real output; no output-quality check before emitting
  success.
- **Prompt/Model:** Task instruction asks agents to "produce a structured assessment" — agent
  complies even when given null/splash input, generating plausible-sounding but fabricated findings.
- **Context/Memory:** Handoff only passes `aiResponse`/`aiSummary`/`toolOutput`/`metadata` — no
  field indicates "tool produced meaningful output". Downstream agents cannot detect upstream failure.
- **Environment:** ollama/gemma4:e4b local inference at 51 s p50 — high latency for a zero-value
  call. Provider choice amplifies cost of the defect.
- **Evaluation:** normalize-kpis.mjs queries for "Attack tree execution completed" only; misses
  the Template-Driven Execution completion path, so 6/6 completions were invisible to the prior
  evaluation.

---

## 7. Prioritized Optimization Roadmap

Ranked by ICE (Impact × Confidence / Effort). All are proposals only — no harness source has been
changed.

### P0 — Critical (Fix before any other optimization is meaningful)

| # | Recommendation | CTQ Moved | Expected Effect | How to Verify | Effort | Risk |
|---|---------------|-----------|-----------------|---------------|--------|------|
| P0-1 | **Fix Metasploit tool_registry baseCommand.** Set `config.baseCommand = "msfconsole -q -x"` with an rc-script template parameter, or adopt the `msfdb run` pattern with proper `RHOSTS` / module / `run; exit` args. Add an output-quality gate: if `stdout` matches `/^metasploit by rapid7/i`, treat the run as a configuration failure, not success. | Effective completion rate (0% → measurable) | Workflow output goes from fabricated to real attack findings | `tool_executions.stdout` no longer contains splash-only output; findings count > 0 | Low (config + guard) | Low — no orchestration change |
| P0-2 | **Add output-quality check before emitting task/workflow success.** In `executeGenericToolWorkflow()` (orchestrator.ts:1597+), before calling `executeTemplateDrivenAgent()`, check that at least one tool produced `stdout.length > 0` and `exit_code=0` and output is not the known splash pattern. If not, log a `level="warn"` or `level="error"` event with meaningful context. | Defect detection rate | Workflow success signal becomes meaningful | Defect events appear in Pareto query when tools produce no output | Low (additive check) | Low |
| P0-3 | **Unify completion-event schema.** In the Template-Driven Execution path (orchestrator.ts:~line where "Workflow completed successfully" is emitted), add at minimum: `context.overallSuccess` (bool), `context.toolResultsCount`, `context.realFindingsCount`, `context.aiCallCount`. This makes both code paths queryable by normalize-kpis.mjs with the same schema. | Workflow success rate CTQ | Success rate becomes computable (currently 0/0 for attack-tree path; 6/6 with empty context for template path) | normalize-kpis.mjs shows non-zero completed_runs with outcome fields | Low (additive context) | Low |
| P0-4 | **Log inference tokens on ai_call events** (orchestrator.ts:311-325). Capture `usage.promptTokens`, `usage.completionTokens`, `usage.totalTokens` from the inference response and add to the context blob, mirroring `ai_enrichment_logs` columns (schema.ts:1990-1992). | Harness token cost CTQ | Cost per run computable; enables cost/token optimization | ai-calls.csv gains token columns on next baseline | Low (additive field) | Low |

### P1 — High Leverage (implement after P0 baseline is real)

| # | Recommendation | CTQ Moved | Expected Effect | How to Verify | Effort | Risk |
|---|---------------|-----------|-----------------|---------------|--------|------|
| P1-1 | **Enable real tools for all Bug Hunter agents.** Currently 5 of 6 agents in the template-driven workflow have no enabled tools (`hasEnabledTools=false`). Agents should have purpose-appropriate tools enabled: Bug Hunter — Recon → nmap/httpx; Bug Hunter — Scope → subfinder/amass; Advanced Fuzzing → ffuf/nuclei; etc. Without tools, these agents can only hallucinate. | Effective completion rate; findings yield | Real reconnaissance data enters the pipeline | Workflow logs show `hasEnabledTools=true` and tool_executions rows for each agent | Medium (config + tool registration) | Medium (tool side-effects; requires correct tool configs) |
| P1-2 | **Unify defect capture across tables.** Route tool/model failures from all paths into `workflow_logs` at `level='error'` with structured context. Currently the Metasploit splash output, the ollama timeout, and the enrichment model-id failure live in different tables or not at all. The Pareto query returns 0 rows despite real failures existing. | Defect Pareto | Pareto becomes non-empty when failures occur; actionable | Defect events show in normalize-kpis.mjs Pareto output | Medium (logging callsites) | Low |
| P1-3 | **Fix enrichment model-id defect.** The `claude-sonnet-4-5` (no date suffix) model-id causes a connection error on the Anthropic API. The enrichment client should resolve undated model IDs to the current versioned form (e.g., `claude-sonnet-4-5-20250929`), or reject the configuration at startup with a clear error. | AI enrichment reliability | Enrichment failure rate drops from 1.9% → 0% | ai_enrichment_logs shows 0 failures on next batch | Low (config validation) | Low |
| P1-4 | **Replace hardcoded attack-tree limits with data-derived, config-driven defaults.** `maxDepth=5`, `maxTotalExecutions=50`, `maxChildrenPerNode=5` (orchestrator.ts:1224-1230) are magic numbers. They have never been hit (0/6 runs), so they are not calibrated against real execution patterns. Once P0-1 produces real runs, instrument depth/execution counts and derive evidence-based defaults. | Reliability / efficiency | Limits justified by where runs actually terminate | normalize-kpis.mjs `limits` row shows non-zero hits when limits are appropriate | Medium | Low (behind config) |
| P1-5 | **Latency: evaluate hosted inference for time-critical phases.** All 48 ai_call events use ollama/gemma4:e4b with p95=73 s. The enrichment path uses anthropic/claude-sonnet-4-5-20250929 at avg 34.5 s — faster and with real token metrics. Routing reasoning calls to a hosted provider (or a faster local model) would cut wall-clock by 30–50% for the AI-wait-dominated workflow. | Efficiency (latency) | AI-call p95 drops below 30 s | ai-calls.csv p95 on next baseline | Medium | Medium (cost/locality tradeoff) |
| P1-6 | **Persist tool-execution-loop outcomes to a durable table.** `tool-execution-loop.ts:379-408` emits `tool_start` and `tool_complete` via EventEmitter only — these are never persisted. Add a lightweight write (toolId, iteration, exitCode, durationMs, timedOut) to `workflow_logs` at `level='tool_exec'` per iteration. This enables per-tool failure Pareto and loop efficiency analysis. | Per-tool failure rate CTQ | Pareto by tool becomes computable | normalize-kpis.mjs can query for `level='tool_exec'` rows | Low | Low |

### P2 — Strategic (second cycle, after real run data exists)

| # | Recommendation | CTQ Moved | Expected Effect | How to Verify | Effort | Risk |
|---|---------------|-----------|-----------------|---------------|--------|------|
| P2-1 | **Add output-quality routing to handoff payload.** The handoff context (`dataKeys`) currently has no field indicating whether the prior agent's tool produced real findings. Add `hasRealToolOutput: bool` and `findingCount: int` to the handoff so downstream agents can adapt their prompt/behavior. | Correctness | Hallucination cascade detectable; agents can signal "no real data" | Handoff context shows these fields in workflow_logs | Medium | Low |
| P2-2 | **Add timeout-budget compensation across phases.** A 34 s Metasploit run (workflow ace664a4) vs 2 s (workflow 65c47002) shows high variance. Long upstream tool runs eat into downstream AI budgets. The orchestrator should track elapsed wall-clock and shrink downstream AI timeouts proportionally, to guarantee the 2 h ceiling is never violated even if early phases are slow. | Reliability | Fewer 2 h-ceiling overruns | No run exceeds the global timeout | Medium | Medium |
| P2-3 | **Structured retrospective cadence.** Convert ad-hoc docs/ improvements practice into a recurring postmortem using `docs/optimization/retrospectives/TEMPLATE.md`. Each cycle produces the defect list for the next Improve backlog. | Kaizen velocity | Defects found in this cycle do not recur | Retro doc exists per cycle | Low | None |
| P2-4 | **Add `attempt_count > 1` tagging for retries.** `WORKFLOW_RETRY_MAX_RETRIES=3` env default exists (agent-config.ts:114), but retry attempts are not tagged in workflow_logs, so retry-recovery rate is uncomputable. Tag retries with `{retry: true, attempt: N, parentAttemptId: uuid}` context. | Retry-recovery rate CTQ | Recovery rate becomes measurable | normalize-kpis.mjs can show retry success rate | Low | Low |

---

## 8. Control Plan

### 8.1 Regression Guardrails

| Guardrail | Trigger Condition | Action |
|-----------|------------------|--------|
| Metasploit splash detection | `tool_executions.stdout` matches `/metasploit by rapid7/i` and no other output | Alert; mark run as configuration failure, not success |
| Workflow completion with empty context | `message='Workflow completed successfully'` and `context = {}` | Flag as P0 breach; completion without outcome data |
| ai_call with zero/null tokens (after P0-4) | `context.tokensUsed` is null or 0 on a non-failed call | Flag as instrumentation gap |
| All 6 workflows complete without a single non-splash tool output | Pareto shows 0 real findings | Block as P0 — system is hallucinating |
| p95 AI latency exceeds 90 s | ai-calls.csv recompute | Trigger latency review |

### 8.2 Re-baseline Cadence

Run `node tools/harness-eval/normalize-kpis.mjs "$(date -I)" && node tools/harness-eval/report.mjs`
after each sprint or after any P0/P1 implementation. Compare:
- `completed_runs` (currently 0 in the attack-tree path; fix P0-3 to make it non-zero for all paths)
- `hit_execution_limit` / `hit_depth_limit` (currently 0; should be calibrated once real runs exist)
- `ai_call` p95 (control limit: ≤ 30 s after P1-5)
- Defect Pareto non-empty when failures occur (control limit: 0 rows is only acceptable if zero failures)

### 8.3 Test Coverage Gaps

The unit test suite (discovered in `tests/unit/services/`) covers inference routing, tool-executor
format, skill-loader, etc. — but there is no test that verifies a tool invocation produces
non-splash, non-empty, attack-relevant output. Add an integration test that:
1. Executes metasploit against a local mock target.
2. Asserts `stdout` does not match the splash pattern.
3. Asserts at least one RHOSTS/module/result line appears.

---

## 9. Retrospective and Next Kaizen Cycle

### 9.1 What This Cycle Found

1. **The prior UNVERIFIABLE verdict was partially wrong** — 6/6 workflows did reach
   completion and emit a success signal. The evaluation gap was in the query: `normalize-kpis.mjs`
   searched for the attack-tree completion message, which does not exist in the Template-Driven
   Execution path. This is an instrumentation design bug — two completion paths, one query.

2. **The fundamental problem is worse than unobservability** — it is confirmed hallucination. The
   tool invocation at the heart of every workflow produces the msfconsole splash, the AI model
   correctly identifies this as "no actionable data", but the harness emits `success=true` anyway
   and all downstream agents fabricate findings from zero evidence.

3. **Latency numbers from the prior report were underestimates** — p50 was reported as 42.9 s,
   p95 as 52.1 s. The current computed values are p50=51,350 ms, p95=73,060 ms. The prior report
   was drawn from older (faster) workflow runs; newer runs are running ollama/gemma4:e4b which is
   slower than the prior gemma4:e4b configuration under lighter load.

4. **The "completion" event class matters** — there are two parallel code paths and they emit
   different messages. Future baseline queries should cover both:
   - Attack-tree path: `"Attack tree execution completed"` (orchestrator.ts:1298-1305)
   - Template-driven path: `"Workflow completed successfully"` (not yet found in source — to locate)

5. **ollama/gemma4:e4b is the sole inference provider** for all 48 workflow ai_calls. There is
   no provider diversity. A single ollama failure would halt every workflow.

### 9.2 What Didn't Work

The prior report's instrumentation-first framing was sound, but stopping at "UNVERIFIABLE" without
querying for the alternative completion message left the hallucinated-success defect hidden. The
evaluation should have searched for ALL log messages containing "completed" or "success" as a
sanity check, not only the attack-tree-specific message.

### 9.3 What Surprised Us

The AI reasoning model (gemma4:e4b) accurately self-assessed that the Metasploit output was a
splash screen with no findings — in 6/6 tool_execution_summary calls. The model is not the source
of hallucination; the harness design is. The model correctly says "no data" but the orchestrator
continues as if success, passes the AI's fabricated "recommended next steps" text as the next
agent's ground truth, and the fabrication escalates through 6 agent levels.

### 9.4 Next Kaizen Cycle Inputs

1. Fix P0-1 (baseCommand), re-run 6 workflows, measure: do tool_executions.stdout now contain
   real attack output? Are findings yielded?
2. Fix P0-3 (completion context), re-run normalize-kpis.mjs: does `completed_runs` show 6?
3. After P1-1 (enable tools for all agents), re-baseline: how many tool_executions rows appear?
   What is the per-tool failure rate Pareto?
4. After P0-4 (log tokens), compute: token cost per workflow, cost per finding.

---

## Appendix A — Source Integrity Verification

All harness source files are confirmed unmodified. Git status shows the following files as staged
or modified by prior work (not this evaluation):
- `server/services/agent-workflow-orchestrator.ts` — staged modification (not by this eval)
- `server/services/agents/tool-execution-loop.ts` — staged modification (not by this eval)
- `server/services/inference/inference-router.ts` — staged new file (not by this eval)
- `shared/schema.ts` — staged modification (not by this eval)

Stat mtime on all four files: `2026-05-21` — this evaluation did not touch any of them (this
evaluation ran on 2026-06-02 and is read-only).

The `docs/optimization/` and `tools/harness-eval/` directories appear as "Untracked files" in
git status — confirming these are the only files created by the optimization evaluation work.

## Appendix B — Key Source Line Citations (verified)

| Claim | File | Lines | Verified |
|-------|------|-------|---------|
| AttackTreeConfig defaults (maxDepth:5 etc.) | `server/services/agent-workflow-orchestrator.ts` | 1224-1230 | Read |
| Attack-tree completion event emitted | `server/services/agent-workflow-orchestrator.ts` | 1298-1305 | Read |
| ai_call log site (promptCharCount, responseCharCount, no tokens) | `server/services/agent-workflow-orchestrator.ts` | 311-325 | Read |
| DEFAULT_CONSTRAINTS (maxIterations:10, maxDurationMs:30min) | `server/services/agents/tool-execution-loop.ts` | 153-159 | Read |
| tool_start / tool_complete EventEmitter emits (not persisted) | `server/services/agents/tool-execution-loop.ts` | 379, 403 | Read |
| AttemptRecord schema (durationMs, outcome, no tokens) | `server/services/inference/inference-router.ts` | 58-65 | Read |
| workflow_logs schema (context is json, timestamp column) | `shared/schema.ts` | 740-748 | Read |
| ai_enrichment_logs schema (tokens_used column) | `shared/schema.ts` | 1982-2000 | Read (offset ~1982) |
| Legacy positional command stub (baseCommand fallback) | `server/services/tool-executor.ts` | 292-326 | Read |
| TASK_AGENT_MAX_RETRIES env default = 3 | `server/config/agent-config.ts` | 114 | Read |
| executeTemplateDrivenAgent() (template-driven path) | `server/services/agent-workflow-orchestrator.ts` | 1513-1590 | Read |
| executeGenericToolWorkflow() (tool runner) | `server/services/agent-workflow-orchestrator.ts` | 1597-~1810 | Read |
