-- ============================================================================
-- RTPI Harness Baseline — READ-ONLY KPI queries
-- ============================================================================
-- Every statement here is a SELECT. Nothing in this file writes, alters, or
-- migrates. It mines the two durable execution records that already exist:
--   * workflow_logs       (shared/schema.ts:740-748) — the only per-run record
--                          of the agent-workflow harness. AI calls are stored
--                          with level='ai_call' and a JSON `context` blob
--                          (orchestrator log site: agent-workflow-orchestrator.ts:311-325).
--   * ai_enrichment_logs  (shared/schema.ts:1982-2000) — the ONLY table with
--                          real token metrics, but scoped to vulnerability
--                          enrichment, NOT harness/agent runs.
--
-- Run read-only against the dev DB (default DATABASE_URL port 5434):
--   psql "$DATABASE_URL" -f tools/harness-eval/sql/baseline.sql
-- or via the normalizer:  node tools/harness-eval/normalize-kpis.mjs
-- ============================================================================

-- Q1. Volume: how much harness execution data exists at all.
SELECT
  (SELECT count(*) FROM workflow_logs)                              AS workflow_log_rows,
  (SELECT count(DISTINCT workflow_id) FROM workflow_logs)           AS distinct_workflows,
  (SELECT count(*) FROM workflow_logs WHERE level = 'ai_call')      AS ai_call_events,
  (SELECT count(*) FROM workflow_logs WHERE level = 'error')        AS error_events,
  (SELECT count(*) FROM ai_enrichment_logs)                         AS enrichment_rows;

-- Q2. Effectiveness — attack-tree run outcomes.
-- "Attack tree execution completed" carries context.overallSuccess + treeStats
-- (agent-workflow-orchestrator.ts:1298-1305).
-- Reads BOTH completion paths: the attack-tree event and the generic
-- 'workflow_outcome' event added in agent-workflow-orchestrator.ts (P0-3).
SELECT
  count(*)                                                          AS completed_runs,
  count(*) FILTER (WHERE (context->>'overallSuccess')::bool)        AS successful_runs,
  round(avg((context->>'totalExecutions')::numeric), 2)            AS avg_total_executions,
  round(avg((context->>'maxDepthReached')::numeric), 2)            AS avg_max_depth_reached,
  round(avg((context->>'auxiliaryDiscoveries')::numeric), 2)       AS avg_aux_discoveries
FROM workflow_logs
WHERE message IN ('Attack tree execution completed', 'Workflow completed successfully')
  AND context->'overallSuccess' IS NOT NULL;

-- Q3. Reliability — how often runs hit the hardcoded safety limits.
-- Skip log lines are emitted at agent-workflow-orchestrator.ts:2856-2869.
SELECT
  count(*) FILTER (WHERE message ILIKE '%execution limit reached%') AS hit_execution_limit,
  count(*) FILTER (WHERE message ILIKE '%max depth reached%')       AS hit_depth_limit
FROM workflow_logs;

-- Q4. Inference reliability/latency — per provider, from ai_call events.
-- NOTE: token usage is absent here by design — the harness only logs
-- promptCharCount / responseCharCount, never tokens. That gap is the point.
SELECT
  context->>'provider'                                              AS provider,
  context->>'kind'                                                  AS kind,
  count(*)                                                          AS calls,
  count(*) FILTER (WHERE context->>'error' IS NOT NULL)            AS failed_calls,
  round(avg((context->>'durationMs')::numeric), 0)                 AS avg_duration_ms,
  round(avg((context->>'promptCharCount')::numeric), 0)            AS avg_prompt_chars,
  round(avg((context->>'responseCharCount')::numeric), 0)          AS avg_response_chars
FROM workflow_logs
WHERE level = 'ai_call'
GROUP BY 1, 2
ORDER BY calls DESC;

-- Q5. Provider fallback frequency — failed ai_calls carry context.attempts[]
-- (the AttemptRecord[] from inference-router.ts:58-65).
SELECT
  count(*)                                                          AS failed_ai_calls,
  round(avg(jsonb_array_length((context->'attempts')::jsonb)), 2) AS avg_attempts_per_failure
FROM workflow_logs
WHERE level = 'ai_call'
  AND context->>'error' IS NOT NULL
  AND context->'attempts' IS NOT NULL;

-- Q6. Cost/latency baseline from the ONE table that has tokens (vuln-scoped).
SELECT
  provider,
  model_used,
  count(*)                                                          AS calls,
  count(*) FILTER (WHERE success = false)                           AS failures,
  round(avg(duration_ms), 0)                                        AS avg_duration_ms,
  round(avg(tokens_used), 0)                                        AS avg_tokens,
  sum(tokens_used)                                                  AS total_tokens
FROM ai_enrichment_logs
GROUP BY 1, 2
ORDER BY calls DESC;

-- Q7. Defect Pareto — most frequent error/warning messages.
SELECT
  level,
  left(message, 80)                                                 AS message_prefix,
  count(*)                                                          AS occurrences
FROM workflow_logs
WHERE level IN ('error', 'warning')
GROUP BY 1, 2
ORDER BY occurrences DESC
LIMIT 25;
