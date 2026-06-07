-- Ensure ollama_models.model_size is BIGINT.
--
-- db/migrations/0017_add_ollama.sql already creates the column as BIGINT,
-- but the legacy migrations/0002_premium_sandman.sql created it as INTEGER.
-- Live databases that were initialized from the legacy migration overflow
-- when models exceed 2 GB (e.g. deepseek-r1:14b ~ 8.4 GB).
--
-- ALTER COLUMN ... TYPE bigint is a no-op when the column is already bigint,
-- so this migration is safe to run on either lineage.

ALTER TABLE ollama_models
  ALTER COLUMN model_size TYPE bigint USING model_size::bigint;
