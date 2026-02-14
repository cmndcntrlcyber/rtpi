-- ============================================================================
-- Phase 2: Agent System Architecture - Operations Manager Enhancement
-- Migration 0021: Enhance existing tables with memory integration
-- ============================================================================

-- Add memory integration to operations table
ALTER TABLE operations
ADD COLUMN IF NOT EXISTS memory_context_id UUID REFERENCES memory_contexts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_synthesis_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS synthesis_summary TEXT;

-- Enhance agent_activity_reports with memory and synthesis tracking
ALTER TABLE agent_activity_reports
ADD COLUMN IF NOT EXISTS memory_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS synthesis_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS synthesized_by_manager_task_id UUID REFERENCES operations_manager_tasks(id) ON DELETE SET NULL;

-- Add memory integration to operations_manager_tasks
ALTER TABLE operations_manager_tasks
ADD COLUMN IF NOT EXISTS memory_context TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stored_memory_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;

-- Enhance asset_questions with memory context
ALTER TABLE asset_questions
ADD COLUMN IF NOT EXISTS relevant_memory_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS answer_stored_as_memory_id UUID REFERENCES memory_entries(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_operations_memory_context ON operations(memory_context_id) WHERE memory_context_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_reports_synthesis_status ON agent_activity_reports(synthesis_status);
CREATE INDEX IF NOT EXISTS idx_agent_reports_manager_task ON agent_activity_reports(synthesized_by_manager_task_id) WHERE synthesized_by_manager_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_manager_tasks_operation ON operations_manager_tasks(operation_id) WHERE operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_questions_memory ON asset_questions(answer_stored_as_memory_id) WHERE answer_stored_as_memory_id IS NOT NULL;
