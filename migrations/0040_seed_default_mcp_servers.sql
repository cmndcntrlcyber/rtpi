-- v2.9.3 Phase 2 — seed the 11 default MCP servers
--
-- Idempotent: ON CONFLICT (seed_key) DO NOTHING means re-running the
-- migration is a no-op for rows that already exist. Operator edits to
-- existing managed rows are preserved — never overwritten by re-seeding.
--
-- Note: this is the auxiliary path for `drizzle-kit migrate` users. The
-- standard dev workflow (`npm run db:push`) does NOT execute SQL files in
-- this directory; the boot-time syncDefaultCatalog() in
-- server/services/mcp/catalog-sync.ts is the load-bearing install path.
-- This migration exists so that production-style installs that run
-- `drizzle-kit migrate` get the same seed data without depending on
-- FF_DEFAULT_MCP_SERVERS being on at first boot.
--
-- See server/services/mcp/default-servers-catalog.ts — that file is the
-- source of truth. Keep these INSERTs aligned with it.

INSERT INTO "mcp_servers" ("seed_key", "name", "command", "args", "env", "status", "auto_restart", "max_restarts")
VALUES
  ('default:playwright',           'Microsoft Playwright',     'npx',  '["-y","@playwright/mcp@latest"]'::json,                         '{}'::json,                                'stopped', true, 3),
  ('default:fetch',                'MCP Fetch',                'uvx',  '["mcp-server-fetch"]'::json,                                    '{}'::json,                                'stopped', true, 3),
  ('default:chrome-devtools',      'Chrome DevTools',          'npx',  '["-y","chrome-devtools-mcp@latest"]'::json,                     '{}'::json,                                'stopped', true, 3),
  ('default:filesystem',           'MCP Filesystem',           'npx',  '["-y","@modelcontextprotocol/server-filesystem","/workspace"]'::json, '{}'::json,                          'stopped', true, 3),
  ('default:sequential-thinking',  'MCP Sequential Thinking',  'npx',  '["-y","@modelcontextprotocol/server-sequential-thinking"]'::json,'{}'::json,                                'stopped', true, 3),
  ('default:memory',               'MCP Memory',               'npx',  '["-y","@modelcontextprotocol/server-memory"]'::json,            '{}'::json,                                'stopped', true, 3),
  ('default:github',               'MCP GitHub',               'npx',  '["-y","@modelcontextprotocol/server-github"]'::json,            '{"GITHUB_PERSONAL_ACCESS_TOKEN":""}'::json,'stopped', true, 3),
  ('default:searchcode',           'searchcode',               'npx',  '["-y","searchcode-mcp"]'::json,                                 '{}'::json,                                'stopped', true, 3),
  ('default:task-master',          'Claude Task Master',       'npx',  '["-y","task-master-ai"]'::json,                                 '{}'::json,                                'stopped', true, 3),
  ('default:tavily',               'Tavily Search',            'npx',  '["-y","tavily-mcp@latest"]'::json,                              '{"TAVILY_API_KEY":""}'::json,             'stopped', true, 3),
  ('default:arxiv',                'arXiv',                    'uvx',  '["arxiv-mcp-server"]'::json,                                    '{}'::json,                                'stopped', true, 3)
ON CONFLICT (seed_key) DO NOTHING;
