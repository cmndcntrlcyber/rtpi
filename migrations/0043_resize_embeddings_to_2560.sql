-- Resize pgvector columns from vector(1536) to vector(2560) to match
-- EMBEDDING_MODEL=qwen3-embedding:4b output. Existing embedding values are
-- truncated to NULL (pgvector cannot reshape dimensions in place); they will
-- be re-populated lazily as rows are accessed or rewritten.
--
-- Affected columns:
--   * memory_entries.embedding_vec  (created by 0030_enable_pgvector.sql)
--   * cti_items.embedding           (created by 0036_add_cti_tables.sql)
--
-- Re-running this migration on already-2560 columns is harmless: the UPDATE
-- becomes a no-op (no rows match IS NOT NULL after the first run) and the
-- ALTER COLUMN type change is idempotent.

BEGIN;

-- memory_entries.embedding_vec ---------------------------------------------
DROP INDEX IF EXISTS idx_memory_entries_embedding_hnsw;
DROP INDEX IF EXISTS idx_memory_entries_context_embedding;

UPDATE memory_entries SET embedding_vec = NULL WHERE embedding_vec IS NOT NULL;

ALTER TABLE memory_entries
  ALTER COLUMN embedding_vec TYPE vector(2560) USING NULL;

-- pgvector caps HNSW at 2000 dims, so we cannot recreate the HNSW index at
-- vector(2560). Keep the partial context-scoped index (which doesn't store
-- the vector itself, just `context_id` where the vector is non-null) and
-- rely on sequential scan for vector similarity. Switch to IVFFlat (no
-- dim cap) if/when this table grows past ~10k rows.
CREATE INDEX IF NOT EXISTS idx_memory_entries_context_embedding
  ON memory_entries (context_id)
  WHERE embedding_vec IS NOT NULL;

-- cti_items.embedding ------------------------------------------------------
DROP INDEX IF EXISTS cti_items_embedding_hnsw_idx;

UPDATE cti_items SET embedding = NULL WHERE embedding IS NOT NULL;

ALTER TABLE cti_items
  ALTER COLUMN embedding TYPE vector(2560) USING NULL;

-- No HNSW recreation here either — same 2000-dim cap as above.

COMMIT;
