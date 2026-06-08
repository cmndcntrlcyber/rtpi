#!/usr/bin/env node
// ============================================================================
// RTPI Harness KPI Normalizer — READ-ONLY
// ============================================================================
// Mines the durable execution records (workflow_logs, ai_enrichment_logs) and
// flattens them into a tabular KPI extract under tools/harness-eval/out/.
//
//   node tools/harness-eval/normalize-kpis.mjs
//
// Safety: every query runs inside a `SET TRANSACTION READ ONLY` block, so the
// database itself rejects any accidental write (belt-and-suspenders on top of
// the fact that this script only issues SELECTs). It touches NO harness source
// and changes NO schema.
//
// Reuses the project's existing `postgres` (porsager) dependency — no new deps.
// ============================================================================

import postgres from "postgres";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "out");
const CONN =
  process.env.DATABASE_URL || "postgresql://rtpi:rtpi@localhost:5434/rtpi_main";

const sql = postgres(CONN, { max: 2, idle_timeout: 5, prepare: false });

/** Run a set of read-only selects inside one read-only transaction. */
async function collect() {
  return sql.begin(async (tx) => {
    await tx.unsafe("SET TRANSACTION READ ONLY");

    const volume = await tx`
      SELECT
        (SELECT count(*) FROM workflow_logs)                         AS workflow_log_rows,
        (SELECT count(DISTINCT workflow_id) FROM workflow_logs)      AS distinct_workflows,
        (SELECT count(*) FROM workflow_logs WHERE level = 'ai_call') AS ai_call_events,
        (SELECT count(*) FROM workflow_logs WHERE level = 'error')   AS error_events,
        (SELECT count(*) FROM ai_enrichment_logs)                    AS enrichment_rows`;

    // Raw ai_call rows — flattened so report.mjs can compute percentiles.
    const aiCalls = await tx`
      SELECT
        workflow_id                                       AS workflow_id,
        context->>'provider'                              AS provider,
        context->>'model'                                 AS model,
        context->>'kind'                                  AS kind,
        context->>'phase'                                 AS phase,
        (context->>'error' IS NOT NULL)                   AS failed,
        (context->>'durationMs')::numeric                 AS duration_ms,
        (context->>'promptCharCount')::numeric            AS prompt_chars,
        (context->>'responseCharCount')::numeric          AS response_chars,
        CASE WHEN context->'attempts' IS NOT NULL
             THEN jsonb_array_length((context->'attempts')::jsonb)
             ELSE NULL END                                AS attempt_count
      FROM workflow_logs
      WHERE level = 'ai_call'`;

    // Attack-tree run outcomes (effectiveness).
    const runs = await tx`
      SELECT
        workflow_id                                       AS workflow_id,
        (context->>'overallSuccess')::bool                AS overall_success,
        (context->>'totalExecutions')::numeric            AS total_executions,
        (context->>'maxDepthReached')::numeric            AS max_depth_reached,
        (context->>'auxiliaryDiscoveries')::numeric       AS aux_discoveries,
        (context->>'realFindingsCount')::numeric          AS real_findings
      FROM workflow_logs
      WHERE message IN ('Attack tree execution completed', 'Workflow completed successfully')
        AND context->'overallSuccess' IS NOT NULL`;

    // Safety-limit hits (reliability).
    const limits = await tx`
      SELECT
        count(*) FILTER (WHERE message ILIKE '%execution limit reached%') AS hit_execution_limit,
        count(*) FILTER (WHERE message ILIKE '%max depth reached%')       AS hit_depth_limit
      FROM workflow_logs`;

    // Token metrics from the ONLY table that has them (vuln-scoped).
    const enrichment = await tx`
      SELECT
        provider, model_used,
        count(*)                          AS calls,
        count(*) FILTER (WHERE success = false) AS failures,
        avg(duration_ms)                  AS avg_duration_ms,
        avg(tokens_used)                  AS avg_tokens,
        sum(tokens_used)                  AS total_tokens
      FROM ai_enrichment_logs
      GROUP BY 1, 2
      ORDER BY calls DESC`;

    // Defect Pareto.
    const defects = await tx`
      SELECT level, left(message, 80) AS message_prefix, count(*) AS occurrences
      FROM workflow_logs
      WHERE level IN ('error', 'warning')
      GROUP BY 1, 2
      ORDER BY occurrences DESC
      LIMIT 25`;

    return { volume: volume[0], aiCalls, runs, limits: limits[0], enrichment, defects };
  });
}

function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) =>
    v === null || v === undefined ? "" : `"${String(v).replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let data;
  try {
    data = await collect();
  } catch (err) {
    console.error("[harness-eval] DB query failed:", err.message);
    if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].includes(err.code)) {
      console.error(
        "[harness-eval] Could not reach the database. Default DATABASE_URL targets port 5434.\n" +
          "               Start it with: docker compose up -d  (from rtpi root)",
      );
    }
    await sql.end({ timeout: 2 });
    process.exit(2);
  }

  const stamp = process.argv[2] || "unstamped"; // pass an ISO date to label the run
  const extract = { generatedLabel: stamp, ...data };

  writeFileSync(join(OUT_DIR, "kpi-extract.json"), JSON.stringify(extract, null, 2));
  writeFileSync(join(OUT_DIR, "ai-calls.csv"), toCsv(data.aiCalls));
  writeFileSync(join(OUT_DIR, "runs.csv"), toCsv(data.runs));

  const v = data.volume;
  console.log("[harness-eval] Extract written to tools/harness-eval/out/");
  console.log(
    `[harness-eval] volume: ${v.workflow_log_rows} log rows, ${v.distinct_workflows} workflows, ` +
      `${v.ai_call_events} ai_calls, ${v.enrichment_rows} enrichment rows`,
  );
  if (Number(v.workflow_log_rows) === 0) {
    console.warn(
      "[harness-eval] NOTE: no workflow_logs yet — run the harness at least once to build a baseline.",
    );
  }
  await sql.end({ timeout: 2 });
}

main();
