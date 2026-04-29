-- v2.9.1 Phase 7: STIX import audit
-- Records every ATT&CK / ATLAS / custom STIX bundle import for observability.
-- Counts are best-effort — empty bundles or partial failures still record a row.

CREATE TABLE IF NOT EXISTS stix_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                   -- 'atlas' | 'attck' | 'custom'
  bundle_id TEXT,
  taxii_collection TEXT,
  objects_total INTEGER NOT NULL DEFAULT 0,
  objects_imported INTEGER NOT NULL DEFAULT 0,
  objects_skipped INTEGER NOT NULL DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stix_runs_source_started_idx
  ON stix_import_runs (source, started_at DESC);
