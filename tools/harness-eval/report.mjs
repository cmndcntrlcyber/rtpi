#!/usr/bin/env node
// ============================================================================
// RTPI Harness Baseline Report Generator — READ-ONLY (no DB access)
// ============================================================================
// Consumes tools/harness-eval/out/kpi-extract.json (produced by
// normalize-kpis.mjs) and emits out/baseline-report.md with the CTQ baseline,
// p50/p95 latency, defect Pareto, and — explicitly — the CTQs that CANNOT be
// computed from today's instrumentation. The "cannot compute" list is a
// first-class output: silent gaps read as "we measured everything" when we did not.
//
//   node tools/harness-eval/normalize-kpis.mjs    # produces the extract first
//   node tools/harness-eval/report.mjs
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "out");

let extract;
try {
  extract = JSON.parse(readFileSync(join(OUT_DIR, "kpi-extract.json"), "utf8"));
} catch {
  console.error(
    "[harness-eval] No kpi-extract.json found. Run `node tools/harness-eval/normalize-kpis.mjs` first.",
  );
  process.exit(2);
}

const num = (v) => (v === null || v === undefined ? NaN : Number(v));
const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "n/a");

function percentile(values, p) {
  const xs = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!xs.length) return NaN;
  const idx = Math.min(xs.length - 1, Math.floor((p / 100) * xs.length));
  return xs[idx];
}
const fmt = (x) => (Number.isFinite(x) ? Math.round(x) : "—");

const { volume, aiCalls, runs, limits, enrichment, defects } = extract;

// --- Effectiveness ---
const completed = runs.length;
const successful = runs.filter((r) => r.overall_success === true).length;

// --- Inference reliability/latency (harness ai_calls) ---
const aiDurations = aiCalls.map((c) => num(c.duration_ms));
const aiFailed = aiCalls.filter((c) => c.failed === true).length;
const fallbackCalls = aiCalls.filter((c) => num(c.attempt_count) > 1).length;

const lines = [];
lines.push("# RTPI Harness — Measured Baseline");
lines.push("");
lines.push(`_Run label: \`${extract.generatedLabel}\`. Generated from \`out/kpi-extract.json\` (read-only)._`);
lines.push("");
lines.push("## Data volume");
lines.push("");
lines.push(`- workflow_logs rows: **${volume.workflow_log_rows}** across **${volume.distinct_workflows}** workflows`);
lines.push(`- ai_call events: **${volume.ai_call_events}** · error events: **${volume.error_events}**`);
lines.push(`- ai_enrichment_logs rows: **${volume.enrichment_rows}**`);
lines.push("");

if (Number(volume.workflow_log_rows) === 0) {
  lines.push("> ⚠️ **No harness runs recorded yet.** Baseline is empty — run the harness at least once, then re-run this tool. The CTQ scaffolding below is still valid; it will populate once data exists.");
  lines.push("");
}

lines.push("## CTQ baseline (computed)");
lines.push("");
lines.push("| CTQ | Value | Source |");
lines.push("|-----|-------|--------|");
lines.push(`| Workflow success rate | ${pct(successful, completed)} (${successful}/${completed}) | workflow_logs \`overallSuccess\` |`);
lines.push(`| AI-call failure rate | ${pct(aiFailed, aiCalls.length)} (${aiFailed}/${aiCalls.length}) | ai_call \`error\` present |`);
lines.push(`| AI-call latency p50 / p95 | ${fmt(percentile(aiDurations, 50))} / ${fmt(percentile(aiDurations, 95))} ms | ai_call \`durationMs\` |`);
lines.push(`| Provider-fallback rate | ${pct(fallbackCalls, aiFailed)} of failures retried | ai_call \`attempts[]\` length |`);
lines.push(`| Runs hitting execution limit | ${limits.hit_execution_limit} | skip log lines |`);
lines.push(`| Runs hitting depth limit | ${limits.hit_depth_limit} | skip log lines |`);
lines.push("");

// --- Token/cost from the only table that has tokens ---
lines.push("## Token/cost — enrichment only (vuln-scoped, NOT harness)");
lines.push("");
if (enrichment.length) {
  lines.push("| provider | model | calls | failures | avg ms | avg tokens | total tokens |");
  lines.push("|----------|-------|-------|----------|--------|------------|--------------|");
  for (const e of enrichment) {
    lines.push(`| ${e.provider} | ${e.model_used} | ${e.calls} | ${e.failures} | ${fmt(num(e.avg_duration_ms))} | ${fmt(num(e.avg_tokens))} | ${e.total_tokens ?? "—"} |`);
  }
} else {
  lines.push("_No enrichment rows._");
}
lines.push("");

// --- Defect Pareto ---
lines.push("## Defect Pareto (workflow_logs error/warning)");
lines.push("");
if (defects.length) {
  lines.push("| level | message | count |");
  lines.push("|-------|---------|-------|");
  for (const d of defects) lines.push(`| ${d.level} | ${d.message_prefix} | ${d.occurrences} |`);
} else {
  lines.push("_No error/warning rows._");
}
lines.push("");

// --- Coverage gaps: first-class output ---
lines.push("## CTQs that CANNOT be computed today (instrumentation gaps)");
lines.push("");
lines.push("These are the truthful limits of the current baseline. Each names the minimal *proposed* (not-yet-applied) change that would close it.");
lines.push("");
lines.push("| Gap | Why it can't be measured now | Proposed (not applied) fix |");
lines.push("|-----|-------------------------------|----------------------------|");
lines.push("| **Harness token cost** | `ai_call` context logs `promptCharCount`/`responseCharCount` only — never tokens (agent-workflow-orchestrator.ts:323-324). Char count is a rough proxy, not cost. | Capture `usage` from the inference response and log `tokensUsed`/`promptTokens`/`completionTokens`, mirroring `ai_enrichment_logs` columns. |");
lines.push("| **Per-tool failure rate** | `tool-execution-loop.ts` emits `tool_start`/`tool_complete` via EventEmitter only — nothing is persisted (tool-execution-loop.ts:153-159 + emit sites). | Persist tool-execution outcomes (exitCode, durationMs, timedOut) to a durable table. |");
lines.push("| **Retry-recovery rate** | Retries (`WORKFLOW_RETRY_MAX_RETRIES=3`) are not tagged in logs as retry-of-N, so 'did the retry succeed' is unrecoverable. | Tag retry attempts with a parent-attempt id + final outcome. |");
lines.push("| **Wall-clock per phase** | Phase boundaries are free-text messages; no structured start/end timestamps per phase. | Emit structured `phase_start`/`phase_end` events with a phase id. |");
lines.push("");
lines.push("> Interpretation rule (truth-based eval): a blank or `n/a` cell above means *unmeasured*, never *zero*. Do not infer success from absence of data.");
lines.push("");

writeFileSync(join(OUT_DIR, "baseline-report.md"), lines.join("\n"));
console.log("[harness-eval] Wrote tools/harness-eval/out/baseline-report.md");
