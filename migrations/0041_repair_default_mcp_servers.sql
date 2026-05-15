-- v2.9.3 self-healing — repair known-bad default MCP server rows
--
-- The first cut of v2.9.3 shipped three default servers with commands that
-- don't work upstream (see server/services/mcp/repair-known-bad.ts for the
-- canonical reasoning). This migration applies targeted UPDATEs *only* when
-- the row still matches the legacy bad shape — operator edits are preserved.
-- Idempotent: re-running is a no-op once the rows have been updated.
--
-- The boot-time `repairKnownBadCatalogEntries()` runs the same logic for
-- `npm run db:push` users; this file exists for `drizzle-kit migrate`
-- (production-style) installs.
--
-- ⚠️  The `default:filesystem` row has a runtime-resolved path argument
-- (defaults to `<cwd>/mcp-workspace`). We can't compute that path from SQL,
-- so this file uses `./mcp-workspace` as a sensible fallback. The boot-time
-- repair (which runs before the manager spawns anything) will overwrite it
-- with the absolute resolved path on first boot. Operators running pure
-- migrations should set `MCP_FS_ROOT` and re-run boot to lock in the path.

-- 1) default:filesystem — replace /workspace with a relative root
UPDATE "mcp_servers"
SET
  "args" = '["-y","@modelcontextprotocol/server-filesystem","./mcp-workspace"]'::json,
  "last_error" = NULL,
  "status" = 'stopped',
  "restart_count" = 0,
  "pid" = NULL,
  "updated_at" = NOW()
WHERE "seed_key" = 'default:filesystem'
  AND "command" = 'npx'
  AND "args"::text = '["-y","@modelcontextprotocol/server-filesystem","/workspace"]';

-- 2) default:searchcode — npm package not published; mark disabled
UPDATE "mcp_servers"
SET
  "auto_restart" = false,
  "last_error" = '[disabled] npm package ''searchcode-mcp'' is not published — edit command to use a working searchcode integration',
  "status" = 'stopped',
  "restart_count" = 0,
  "pid" = NULL,
  "updated_at" = NOW()
WHERE "seed_key" = 'default:searchcode'
  AND "command" = 'npx'
  AND "args"::text = '["-y","searchcode-mcp"]';

-- 3) default:arxiv — switch to GitHub-source uvx invocation
UPDATE "mcp_servers"
SET
  "args" = '["--from","git+https://github.com/blazickjp/arxiv-mcp-server","arxiv-mcp-server"]'::json,
  "last_error" = NULL,
  "status" = 'stopped',
  "restart_count" = 0,
  "pid" = NULL,
  "updated_at" = NOW()
WHERE "seed_key" = 'default:arxiv'
  AND "command" = 'uvx'
  AND "args"::text = '["arxiv-mcp-server"]';
