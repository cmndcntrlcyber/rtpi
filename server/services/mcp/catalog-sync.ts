/**
 * Default MCP catalog sync (v2.9.3 Phase 2).
 *
 * Idempotently inserts every entry from default-servers-catalog.ts that is
 * not already present in the mcp_servers table, keyed by `seed_key`. Never
 * UPDATEs existing rows — operator edits to managed rows are preserved
 * across reboots. The Phase 3 `POST /:id/reset` endpoint is the explicit
 * drift-recovery path that re-applies catalog defaults to a single row.
 *
 * Called from MCPServerManager's constructor when FF_DEFAULT_MCP_SERVERS=true.
 */

import path from "path";
import { db } from "../../db";
import { mcpServers } from "@shared/schema";
import {
  DEFAULT_MCP_CATALOG,
  DefaultMcpEntry,
  MCP_FS_ROOT_PLACEHOLDER,
} from "./default-servers-catalog";
import { enqueueSkillGeneration } from "../skill-generator";
import { createLogger } from '../../lib/logger';
const log = createLogger("catalog-sync");

export interface CatalogSyncResult {
  inserted: number;
  alreadyPresent: number;
}

/**
 * Default filesystem root for `default:filesystem` (and any future filesystem
 * MCP server). Honors `MCP_FS_ROOT` from env; falls back to a per-deployment
 * directory under the process's working directory so the path is always
 * writable by the app user. Preflight (preflight.ts) creates the dir if
 * missing on every start.
 */
export function resolveMcpFsRoot(): string {
  const fromEnv = process.env.MCP_FS_ROOT?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return path.resolve(process.cwd(), "mcp-workspace");
}

/**
 * Substitute the `${MCP_FS_ROOT}` placeholder with the resolved path. Pure
 * function so callers can use it both for sync (DB insert) and for preflight
 * (path-creation lookup) without divergence.
 */
export function resolveCatalogArgs(args: readonly string[]): string[] {
  const fsRoot = resolveMcpFsRoot();
  return args.map((arg) =>
    arg === MCP_FS_ROOT_PLACEHOLDER ? fsRoot : arg.replace(/\$\{MCP_FS_ROOT\}/g, fsRoot),
  );
}

export async function syncDefaultCatalog(): Promise<CatalogSyncResult> {
  let inserted = 0;
  let alreadyPresent = 0;

  for (const entry of DEFAULT_MCP_CATALOG) {
    // .onConflictDoNothing on the seed_key unique index returns the inserted
    // row when the insert took effect, or no rows when the conflict skipped
    // it. We use the returned-row count as the truthful signal.
    const result = await db
      .insert(mcpServers)
      .values({
        seedKey: entry.seedKey,
        name: entry.name,
        command: entry.command,
        args: resolveCatalogArgs(entry.args),
        env: entry.env,
        status: "stopped",
        autoRestart: !entry.disabledByDefault,
        maxRestarts: 3,
        // Surface the disable reason in last_error so the UI gets a useful
        // message without needing a separate column. Cleared the moment the
        // operator edits command/args.
        lastError: entry.disabledByDefault
          ? `[disabled] ${entry.disabledReason ?? "Disabled by default"}`
          : null,
      })
      .onConflictDoNothing({ target: mcpServers.seedKey })
      .returning({ id: mcpServers.id });

    if (result.length > 0) {
      inserted += 1;
      // FF_TOOL_SKILL_GENERATION — kick off SKILL.md generation for newly
      // seeded defaults. Guarded inside enqueueSkillGeneration.
      enqueueSkillGeneration("mcp", result[0].id);
    } else {
      alreadyPresent += 1;
    }
  }

  log.info(
    `[catalog-sync] inserted ${inserted}, already-present ${alreadyPresent}`,
  );
  return { inserted, alreadyPresent };
}

/**
 * Whether a managed server row is missing any of the env-var values its
 * catalog entry declares as required. Drives the future "Needs configuration"
 * UI badge — Phase 4 will surface this in DefaultServersPanel.
 *
 * Treats `undefined`, empty string, and whitespace-only values as missing.
 */
export function needsConfig(
  serverEnv: Record<string, unknown> | null | undefined,
  entry: Pick<DefaultMcpEntry, "requiredSecrets">,
): boolean {
  if (entry.requiredSecrets.length === 0) return false;
  const env = (serverEnv ?? {}) as Record<string, unknown>;
  return entry.requiredSecrets.some((key) => {
    const value = env[key];
    return typeof value !== "string" || value.trim() === "";
  });
}
