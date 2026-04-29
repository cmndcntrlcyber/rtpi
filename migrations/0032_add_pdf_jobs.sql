-- v2.9.1 Phase 3: Async PDF render jobs (FF_PDF_NATIVE)
-- One row per render request; persisted across server restarts so a worker
-- can reattach status. file_path is relative to REPORTS_DIR. A cleanup job
-- deletes rows + files older than the configured retention (default 24h).

DO $$ BEGIN
  CREATE TYPE pdf_job_status AS ENUM ('queued', 'rendering', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS pdf_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,

  status pdf_job_status NOT NULL DEFAULT 'queued',
  file_path TEXT,
  file_size INTEGER,
  error TEXT,
  duration_ms INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pdf_jobs_status ON pdf_jobs(status);
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_created_at ON pdf_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_report_id ON pdf_jobs(report_id);
