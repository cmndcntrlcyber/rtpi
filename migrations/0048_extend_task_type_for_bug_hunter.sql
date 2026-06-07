-- Migration: Extend task_type enum for bug-hunter workflow
-- Date: 2026-05-20
-- Description:
--   Adds the 7 bug-hunter phase task types (scope/recon/hunt/chain/validate/
--   capture/report) used by the AgentWorkflowOrchestrator switch. Also adds
--   execute_tools and autonomous_tools — both already referenced by the
--   orchestrator and the Drizzle taskTypeEnum, but absent from the initial
--   0001_initial.sql CREATE TYPE. IF NOT EXISTS keeps re-runs and partial
--   prior states safe.
--
-- Postgres rule: ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- block. Each ALTER lives on its own statement so the migration runner can
-- replay individually without wrapping in BEGIN/COMMIT.

ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'execute_tools';
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'autonomous_tools';
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'bug_hunter_scope';
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'bug_hunter_recon';
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'bug_hunter_hunt';
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'bug_hunter_chain';
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'bug_hunter_validate';
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'bug_hunter_capture';
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'bug_hunter_report';
