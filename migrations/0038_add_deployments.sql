-- v2.9.1 Phase 9: Per-framework deployments + collective bundles
-- The orchestrator owns lifecycle (start/stop) of named containers via
-- dockerode; this schema persists the desired-vs-current state machine and
-- audit events.

DO $$ BEGIN
  CREATE TYPE deployment_kind AS ENUM (
    'c2_empire', 'c2_sliver', 'c2_c3', 'c2_adaptix', 'c2_loki',
    'kasm', 'sysreptor', 'docmost', 'vllm', 'chromium',
    'bundle', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE deployment_state AS ENUM (
    'down', 'starting', 'up', 'degraded', 'stopping', 'error', 'unknown'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE deployment_event_type AS ENUM (
    'plan', 'up', 'down', 'health_change', 'error'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  kind deployment_kind NOT NULL,
  compose_profile TEXT,
  desired_state deployment_state NOT NULL DEFAULT 'down',
  current_state deployment_state NOT NULL DEFAULT 'unknown',
  last_transition_at TIMESTAMPTZ,
  params JSONB DEFAULT '{}'::jsonb,
  health_summary JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deployment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  event_type deployment_event_type NOT NULL,
  payload JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deployment_events_deployment_at_idx
  ON deployment_events (deployment_id, at DESC);

CREATE TABLE IF NOT EXISTS deployment_dependencies (
  parent_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS deployment_dependencies_pk
  ON deployment_dependencies (parent_id, child_id);
