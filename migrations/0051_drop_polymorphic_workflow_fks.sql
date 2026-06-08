-- 0051_drop_polymorphic_workflow_fks.sql
--
-- Fix: FK violation when the DynamicWorkflowOrchestrator logs against a
-- workflow_instances row.
--
--   PostgresError 23503: insert or update on table "workflow_logs" violates
--   foreign key constraint "workflow_logs_workflow_id_agent_workflows_id_fk"
--   Key (workflow_id)=(...) is not present in table "agent_workflows".
--
-- Root cause: workflow_logs.workflow_id and workflow_tasks.workflow_id are
-- polymorphic. Three orchestrators (agent / ops-management / distributed) write
-- ids from agent_workflows; the dynamic orchestrator writes ids from
-- workflow_instances. A single Postgres FK can only target one table, so the
-- constraint pinned to agent_workflows rejected every dynamic-instance id.
--
-- Resolution: drop the two FK constraints, making workflow_id a soft reference.
-- The other constraints on these tables (task_id -> workflow_tasks, agent_id ->
-- agents) remain valid for both orchestrator families and are untouched.
-- Cascade cleanup of logs/tasks is now performed at the application layer.

ALTER TABLE "workflow_logs"  DROP CONSTRAINT IF EXISTS "workflow_logs_workflow_id_agent_workflows_id_fk";
ALTER TABLE "workflow_tasks" DROP CONSTRAINT IF EXISTS "workflow_tasks_workflow_id_agent_workflows_id_fk";
