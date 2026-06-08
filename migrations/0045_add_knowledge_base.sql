-- Create the knowledge_base table (R&D knowledge repository with full-text
-- search and pgvector embeddings). The sibling R&D tables (research_projects,
-- rd_experiments, tool_library) were already applied by an earlier partial
-- run of db/migrations/0019_add_offsec_rd_team.sql; this migration completes
-- the set and aligns the embedding column with the system-wide pgvector
-- width (2560 dims, set by migrations/0043_resize_embeddings_to_2560.sql).
--
-- Idempotent: IF NOT EXISTS on table + indexes + triggers; the vector
-- column is sized correctly on creation so no follow-up ALTER is needed.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,

  -- Classification
  category VARCHAR(100) NOT NULL,
  tags TEXT[] DEFAULT '{}',

  -- Source & Attribution
  source_url TEXT,
  author TEXT,
  published_date DATE,

  -- Content Type
  content_type VARCHAR(50) DEFAULT 'article' CHECK (content_type IN ('article', 'tutorial', 'paper', 'poc', 'tool_doc', 'technique')),

  -- MITRE ATT&CK Mapping
  attack_tactics TEXT[] DEFAULT '{}',
  attack_techniques TEXT[] DEFAULT '{}',

  -- RAG/Embedding Support. Width matches memory_entries.embedding_vec and
  -- cti_items.embedding (resized to 2560 in migration 0043 to accommodate
  -- qwen3-embedding:4b output).
  embedding VECTOR(2560),
  embedding_model VARCHAR(100),

  -- Metrics
  view_count INTEGER DEFAULT 0,
  usefulness_score DECIMAL(3,2) DEFAULT 0.0,

  -- Relationships
  related_project_id UUID REFERENCES research_projects(id) ON DELETE SET NULL,
  related_articles UUID[] DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(summary, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'C')
  ) STORED
);

-- Defensive: if a prior deploy created the column at 1536 dims, resize to 2560.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base' AND column_name = 'embedding' AND udt_name = 'vector'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'knowledge_base' AND a.attname = 'embedding'
      AND format_type(a.atttypid, a.atttypmod) = 'vector(2560)'
  ) THEN
    UPDATE knowledge_base SET embedding = NULL WHERE embedding IS NOT NULL;
    ALTER TABLE knowledge_base ALTER COLUMN embedding TYPE vector(2560) USING NULL;
  END IF;
END $$;

-- Indexes (mirror db/migrations/0019_add_offsec_rd_team.sql)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_attack_tactics ON knowledge_base USING GIN(attack_tactics);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_attack_techniques ON knowledge_base USING GIN(attack_techniques);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_content_type ON knowledge_base(content_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_created_at ON knowledge_base(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search ON knowledge_base USING GIN(search_vector);
-- No HNSW index on `embedding`: pgvector caps HNSW at 2000 dims and our
-- embedding column is vector(2560) (qwen3-embedding:4b). Sequential scan
-- works fine for small datasets; switch to IVFFlat when the table grows.

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS knowledge_base_updated_at ON knowledge_base;
CREATE TRIGGER knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_base_updated_at();

COMMENT ON TABLE knowledge_base IS 'R&D knowledge base with full-text search and vector embeddings for RAG';
