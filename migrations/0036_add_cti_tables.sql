-- v2.9.1 Phase 7: CTI feeds + vectorized knowledge base
-- Sources represent external feeds (TAXII, RSS, JSON, GitHub releases, Atom).
-- Ingestion runs are append-only audit; items are deduplicated by
-- (source_id, external_id) and content_hash.
-- Embedding column is vector(1536) — sized to OpenAI text-embedding-3-small.
-- pgvector extension is already enabled by migration 0030.

DO $$ BEGIN
  CREATE TYPE cti_source_kind AS ENUM ('rss', 'taxii', 'json', 'atom', 'github');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE cti_ingestion_run_status AS ENUM ('running', 'ok', 'partial', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS cti_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  kind cti_source_kind NOT NULL,
  url TEXT NOT NULL,
  collection TEXT,
  auth_headers JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  cadence_seconds INTEGER NOT NULL DEFAULT 3600,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cti_ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES cti_sources(id) ON DELETE CASCADE,
  status cti_ingestion_run_status NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  items_seen INTEGER NOT NULL DEFAULT 0,
  items_new INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS cti_runs_source_started_idx
  ON cti_ingestion_runs (source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS cti_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES cti_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  link TEXT,
  published_at TIMESTAMPTZ,
  tags JSONB DEFAULT '[]'::jsonb,
  raw_json JSONB,
  content_hash TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cti_items_source_external_idx
  ON cti_items (source_id, external_id);

CREATE INDEX IF NOT EXISTS cti_items_published_idx
  ON cti_items (published_at DESC);

-- HNSW index on the embedding for fast cosine-similarity search. Only added
-- after the table has data — empty HNSW indexes are cheap, but documenting
-- here that callers should EXPLAIN to confirm scan type.
CREATE INDEX IF NOT EXISTS cti_items_embedding_hnsw_idx
  ON cti_items USING hnsw (embedding vector_cosine_ops);
