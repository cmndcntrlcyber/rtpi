# harness-eval — read-only harness measurement

Non-invasive measurement scaffolding for the RTPI agent-workflow harness. It
**reads** the execution records the harness already writes and produces a CTQ
(Critical-to-Quality) baseline for the Lean/Six Sigma optimization loop. It
changes **no** harness source and **no** schema, and every database access runs
inside a `SET TRANSACTION READ ONLY` block.

See the full analysis in [`docs/optimization/rtpi-harness-dmaic.md`](../../docs/optimization/rtpi-harness-dmaic.md).

## What it reads

| Source | What it provides | Limitation |
|--------|------------------|------------|
| `workflow_logs` (`shared/schema.ts:740-748`) | The only durable per-run record. AI calls stored with `level='ai_call'` + JSON `context` (`agent-workflow-orchestrator.ts:311-325). Attack-tree outcomes in the `Attack tree execution completed` event (`:1298-1305`). Safety-limit skips (`:2856-2869`). | `context` is free-text JSON, not queryable KPIs. No tokens — only char counts. |
| `ai_enrichment_logs` (`shared/schema.ts:1982-2000`) | The **only** table with real token metrics (`tokensUsed`, `promptTokens`, `completionTokens`, `durationMs`, `success`). | Scoped to vulnerability enrichment, **not** harness/agent runs. |

## Usage

From the rtpi project root (so `node_modules` resolves the existing `postgres` dep):

```bash
# 1. Mine the durable logs into a flat extract (read-only transaction)
node tools/harness-eval/normalize-kpis.mjs "$(date -I)"   # optional ISO label

# 2. Render the baseline report + the explicit "cannot compute" gap list
node tools/harness-eval/report.mjs

# Or run the raw SQL directly:
psql "$DATABASE_URL" -f tools/harness-eval/sql/baseline.sql
```

Outputs land in `out/` (git-ignored except `.gitkeep`):

- `kpi-extract.json` — raw aggregates + flattened rows
- `ai-calls.csv`, `runs.csv` — tabular extracts for spreadsheets/control charts
- `baseline-report.md` — CTQ baseline, defect Pareto, **and the coverage-gap table**

`DATABASE_URL` defaults to `postgresql://rtpi:rtpi@localhost:5434/rtpi_main`
(matches `server/db.ts`). The dev DB must be up (`docker compose up -d`).

## Documented CTQ coverage gaps (truth-based eval)

These cannot be measured from today's instrumentation. They are reported as
gaps — never silently treated as zero:

- **Harness token cost** — `ai_call` logs char counts, not tokens.
- **Per-tool failure rate** — tool-loop events are EventEmitter-only, not persisted.
- **Retry-recovery rate** — retries are not tagged retry-of-N.
- **Wall-clock per phase** — no structured phase start/end timestamps.

Each gap's minimal *proposed* (not-yet-applied) fix is listed in the generated
`baseline-report.md` and in the DMAIC report's Improve section.

## Guarantees

- **Read-only:** only `SELECT`s, inside `SET TRANSACTION READ ONLY`.
- **No new dependencies:** reuses the project's `postgres` (porsager) driver.
- **No harness edits:** lives entirely under `tools/harness-eval/`.
