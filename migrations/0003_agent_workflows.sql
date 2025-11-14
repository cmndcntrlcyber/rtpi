-- Agent Workflow System
-- Implements database queue for multi-agent orchestration

-- Workflow status enum
DO $$ BEGIN
  CREATE TYPE workflow_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Task status enum
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Task type enum
DO $$ BEGIN
  CREATE TYPE task_type AS ENUM ('analyze', 'exploit', 'report', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Agent workflow instances
CREATE TABLE IF NOT EXISTS agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  workflow_type TEXT NOT NULL, -- 'penetration_test', 'vulnerability_scan', etc.
  target_id UUID REFERENCES targets(id) ON DELETE CASCADE,
  operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
  current_agent_id UUID REFERENCES agents(id),
  current_task_id UUID,
  status workflow_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0, -- 0-100 percentage
  metadata JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Workflow tasks (queue for each agent)
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES agent_workflows(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id),
  task_type task_type NOT NULL,
  task_name TEXT NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  sequence_order INTEGER NOT NULL, -- Order of execution in workflow
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Workflow execution logs (for debugging and audit)
CREATE TABLE IF NOT EXISTS workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES agent_workflows(id) ON DELETE CASCADE,
  task_id UUID REFERENCES workflow_tasks(id) ON DELETE CASCADE,
  level TEXT NOT NULL, -- 'info', 'warning', 'error', 'debug'
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_workflows_status ON agent_workflows(status);
CREATE INDEX IF NOT EXISTS idx_agent_workflows_target ON agent_workflows(target_id);
CREATE INDEX IF NOT EXISTS idx_agent_workflows_created_by ON agent_workflows(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_workflow ON workflow_tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_agent ON workflow_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_status ON workflow_tasks(status);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_sequence ON workflow_tasks(workflow_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON workflow_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_timestamp ON workflow_logs(timestamp DESC);

-- Add foreign key constraint for current_task_id
ALTER TABLE agent_workflows 
  ADD CONSTRAINT fk_current_task 
  FOREIGN KEY (current_task_id) 
  REFERENCES workflow_tasks(id) 
  ON DELETE SET NULL;

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agent_workflows_updated_at 
  BEFORE UPDATE ON agent_workflows 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_tasks_updated_at 
  BEFORE UPDATE ON workflow_tasks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
