-- ============================================================================
-- Phase 3: Operations Management Automation
-- Migration 0023: Add pipeline automation columns and target-asset linking
-- ============================================================================

-- ============================================================================
-- ADD COLUMNS TO TARGETS (link to discovered assets)
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE targets ADD COLUMN discovered_asset_id UUID REFERENCES discovered_assets(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE targets ADD COLUMN auto_created BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE targets ADD COLUMN source_scan_id UUID REFERENCES ax_scan_results(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- ============================================================================
-- ADD BACK-REFERENCE ON DISCOVERED_ASSETS
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE discovered_assets ADD COLUMN target_id UUID REFERENCES targets(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- ============================================================================
-- ADD PIPELINE AUTOMATION COLUMNS TO OPERATIONS
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE operations ADD COLUMN pipeline_status JSONB;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE operations ADD COLUMN automation_enabled BOOLEAN NOT NULL DEFAULT true;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- ============================================================================
-- DEDUPLICATE DISCOVERED_ASSETS BEFORE ADDING UNIQUE INDEX
-- ============================================================================

DELETE FROM discovered_assets a USING discovered_assets b
  WHERE a.id > b.id
    AND a.operation_id IS NOT NULL
    AND a.operation_id = b.operation_id
    AND a.value = b.value
    AND a.type = b.type;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_discovered_assets_unique_value
  ON discovered_assets(operation_id, value, type)
  WHERE operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_targets_discovered_asset ON targets(discovered_asset_id);
CREATE INDEX IF NOT EXISTS idx_targets_auto_created ON targets(auto_created);
CREATE INDEX IF NOT EXISTS idx_targets_operation_auto ON targets(operation_id, auto_created) WHERE auto_created = true;
CREATE INDEX IF NOT EXISTS idx_discovered_assets_target ON discovered_assets(target_id);
CREATE INDEX IF NOT EXISTS idx_discovered_assets_no_target ON discovered_assets(operation_id) WHERE target_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_operations_automation ON operations(automation_enabled);
