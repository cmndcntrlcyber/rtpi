-- v2.9.3 Phase 1 — managed-default identifier on mcp_servers
--
-- Adds a nullable `seed_key` column that the catalog-sync service uses to
-- distinguish built-in default MCP servers from operator-created rows.
-- Default servers carry a stable key (e.g. "default:tavily"); user-created
-- rows leave it NULL.
--
-- Postgres treats NULLs as distinct under UNIQUE, so a plain unique index
-- permits unlimited user rows while constraining the managed catalog to
-- one row per seed_key. The catalog sync uses ON CONFLICT (seed_key) DO
-- NOTHING for idempotent re-runs across boots.
--
-- Note: this migration is auxiliary — the standard dev workflow uses
-- `npm run db:push` (drizzle-kit push) which syncs schema directly from
-- shared/schema.ts. This file is consumed by drizzle-kit migrate (the
-- production-style path).

ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "seed_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "mcp_servers_seed_key_uniq"
    ON "mcp_servers" USING btree ("seed_key");
