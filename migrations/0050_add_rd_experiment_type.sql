-- Migration: Add type column to rd_experiments
-- Date: 2026-06-06
-- Description:
--   Adds an explicit `type` dispatch column to rd_experiments. Previously the
--   R&D experiment orchestrator (server/services/rd-experiment-orchestrator.ts)
--   inferred the experiment type by scanning the experiment *name* for English
--   keywords ('research', 'poc', 'nuclei', ...) and threw "Unknown experiment
--   type" for any name that didn't match — a brittle 500-class failure.
--
--   The column drives sub-agent dispatch with values:
--     'vulnerability_research' | 'poc_development' | 'nuclei_template'
--   The orchestrator still falls back to name inference for legacy rows that
--   predate this column (resolveExperimentType()).
--
--   DEFAULT keeps existing rows valid (they backfill to 'vulnerability_research',
--   matching the orchestrator's safe default). IF NOT EXISTS keeps re-runs safe.

ALTER TABLE "rd_experiments"
  ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'vulnerability_research';
