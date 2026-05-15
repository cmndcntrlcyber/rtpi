/**
 * v2.9.3 self-healing — boot-time repair of legacy bad catalog rows.
 *
 * The first cut of v2.9.3 shipped three default MCP servers with commands
 * that turned out not to work upstream:
 *   - default:filesystem  → arg /workspace doesn't exist on most hosts
 *   - default:searchcode  → npm package `searchcode-mcp` is not published
 *   - default:arxiv       → PyPI `arxiv-mcp-server` is a different project
 *
 * This module ships fixes for already-installed rows. It runs at boot before
 * `syncDefaultCatalog()` and applies *targeted* UPDATEs only when the row
 * exactly matches the legacy bad shape — operator edits are preserved
 * verbatim. Idempotent: repeat runs are no-ops.
 *
 * `db:push` users get the repair via this code path; `drizzle-kit migrate`
 * users get the equivalent SQL via migrations/0041_repair_default_mcp_servers.sql.
 */

import { eq } from "drizzle-orm";
import { db } from "../../db";
import { mcpServers } from "@shared/schema";
import { resolveMcpFsRoot } from "./catalog-sync";
import { DEFAULT_MCP_CATALOG } from "./default-servers-catalog";

export interface RepairResult {
  repaired: string[];
  skipped: string[];
}

interface RepairRule {
  seedKey: string;
  /** Match on the row's *current* command + args; if it differs, we leave it alone. */
  legacyCommand: string;
  legacyArgsJson: string;
  /** What to set the row to. `args` is computed when needed (e.g. fs root resolution). */
  build: () => {
    command: string;
    args: string[];
    lastError: string | null;
    autoRestart: boolean;
  };
}

/**
 * Lookup the new (post-repair) shape from the catalog so we don't hard-code
 * it twice. Falls back to throwing if the catalog is missing the seedKey.
 */
function newShapeFromCatalog(seedKey: string): {
  command: string;
  args: string[];
  disabledByDefault: boolean;
  disabledReason?: string;
} {
  const entry = DEFAULT_MCP_CATALOG.find((e) => e.seedKey === seedKey);
  if (!entry) {
    throw new Error(`repair-known-bad: catalog missing entry for ${seedKey}`);
  }
  return {
    command: entry.command,
    args: [...entry.args],
    disabledByDefault: Boolean(entry.disabledByDefault),
    disabledReason: entry.disabledReason,
  };
}

const RULES: RepairRule[] = [
  {
    // /workspace doesn't exist on most hosts → swap in the resolved fs root.
    seedKey: "default:filesystem",
    legacyCommand: "npx",
    legacyArgsJson: '["-y","@modelcontextprotocol/server-filesystem","/workspace"]',
    build: () => {
      const shape = newShapeFromCatalog("default:filesystem");
      const fsRoot = resolveMcpFsRoot();
      return {
        command: shape.command,
        args: shape.args.map((a) => (a === "${MCP_FS_ROOT}" ? fsRoot : a)),
        lastError: null,
        autoRestart: true,
      };
    },
  },
  {
    // npm package not published — mark as disabled-by-default.
    seedKey: "default:searchcode",
    legacyCommand: "npx",
    legacyArgsJson: '["-y","searchcode-mcp"]',
    build: () => {
      const shape = newShapeFromCatalog("default:searchcode");
      return {
        command: shape.command,
        args: shape.args,
        lastError: shape.disabledByDefault
          ? `[disabled] ${shape.disabledReason ?? "Disabled"}`
          : null,
        autoRestart: !shape.disabledByDefault,
      };
    },
  },
  {
    // PyPI name collision — install from GitHub source.
    seedKey: "default:arxiv",
    legacyCommand: "uvx",
    legacyArgsJson: '["arxiv-mcp-server"]',
    build: () => {
      const shape = newShapeFromCatalog("default:arxiv");
      return {
        command: shape.command,
        args: shape.args,
        lastError: null,
        autoRestart: true,
      };
    },
  },
];

/**
 * Stable JSON serialization of a Drizzle `json` field for legacy-shape match.
 * Drizzle stores arrays as JSON; round-trip via JSON.stringify normalizes
 * whitespace and ordering so the comparison is deterministic.
 */
function argsAsLegacyJson(args: unknown): string {
  if (!args) return "";
  return JSON.stringify(args);
}

export async function repairKnownBadCatalogEntries(): Promise<RepairResult> {
  const repaired: string[] = [];
  const skipped: string[] = [];

  for (const rule of RULES) {
    const rows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.seedKey, rule.seedKey))
      .limit(1);
    const row = rows[0];
    if (!row) {
      skipped.push(`${rule.seedKey} (not installed)`);
      continue;
    }

    const matchesLegacy =
      row.command === rule.legacyCommand &&
      argsAsLegacyJson(row.args) === rule.legacyArgsJson;

    if (!matchesLegacy) {
      skipped.push(`${rule.seedKey} (operator-edited or already repaired)`);
      continue;
    }

    const next = rule.build();
    await db
      .update(mcpServers)
      .set({
        command: next.command,
        args: next.args,
        lastError: next.lastError,
        autoRestart: next.autoRestart,
        // Reset status so the auto-recovery sweep gives the row a fresh
        // start with the corrected command. restartCount also reset so the
        // maxRestarts budget isn't already burned.
        status: "stopped",
        restartCount: 0,
        pid: null,
        updatedAt: new Date(),
      })
      .where(eq(mcpServers.id, row.id));

    repaired.push(rule.seedKey);
  }

  if (repaired.length > 0 || skipped.length > 0) {
    console.log(
      `[catalog-repair] repaired=${repaired.length}${repaired.length ? ` (${repaired.join(", ")})` : ""}, skipped=${skipped.length}`,
    );
  }
  return { repaired, skipped };
}
