-- Phase B1: Enable pgvector extension and add vector column to memory_entries
-- This migration enables native vector similarity search, replacing JS-side cosine similarity

-- Enable pgvector extension (requires pgvector/pgvector Docker image)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column alongside existing JSON embedding column
ALTER TABLE memory_entries ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);

-- Backfill existing JSON embeddings into the vector column
-- The JSON column stores arrays like [0.1, 0.2, ...] which can be cast to vector
UPDATE memory_entries
SET embedding_vec = embedding::text::vector
WHERE embedding IS NOT NULL
  AND embedding_vec IS NULL;

-- Create HNSW index for cosine distance search (better than IVFFlat for small-to-medium datasets)
CREATE INDEX IF NOT EXISTS idx_memory_entries_embedding_hnsw
  ON memory_entries
  USING hnsw (embedding_vec vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create partial index for context-scoped searches (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_memory_entries_context_embedding
  ON memory_entries (context_id)
  WHERE embedding_vec IS NOT NULL;
