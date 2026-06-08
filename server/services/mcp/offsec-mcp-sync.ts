/**
 * OffSec container → managed MCP server registration (FF_OFFSEC_MANAGED_MCP).
 *
 * The target architecture for the offsec tool bridge (HARNESS-EVALUATION.md
 * §4.1): instead of shelling `docker exec … --list-tools` per call (the working
 * Phase-1 stopgap in offsec-agents.ts), register each running offsec container
 * as a first-class **managed MCP server** so it participates in the same
 * lifecycle, liveness probing, and JSON-RPC tooling as every other MCP server
 * (agent-mcp-connector, mcp-invoker, the MCP UI).
 *
 * Each offsec container already embeds an stdio MCP server
 * (docker/offsec-agents/mcp-server). Spawned as a persistent stdio process via
 *   docker exec -i <container> node /mcp/dist/index.js
 * it speaks MCP JSON-RPC over the pipe — exactly the command/args model
 * MCPServerManager.startServer expects.
 *
 * This sync is intentionally **additive and idempotent**, mirroring the default
 * catalog sync (catalog-sync.ts):
 *   - keyed by `seed_key = offsec:<containerName>`, `ON CONFLICT DO NOTHING`,
 *     so it never clobbers operator edits and is safe to run repeatedly;
 *   - rows are registered with `autoRestart: false` and `status: stopped` —
 *     they are NOT auto-spawned at boot. An operator starts one explicitly
 *     (MCP UI / start endpoint) once the container is up and its MCP dist is
 *     built. This avoids restart-loop noise against containers that are down
 *     or not yet built, and is why the CLI bridge remains the default path
 *     until a live-container validation pass flips the default.
 */

import { db } from "../../db";
import { mcpServers } from "@shared/schema";
import { dockerExecutor } from "../docker-executor";
import { readFeatureFlags } from "@shared/feature-flags";

/** Matches the offsec container naming convention `rtpi-<type>-agent`. */
const OFFSEC_CONTAINER_PATTERN = /^rtpi-.+-agent$/;

export interface OffsecMcpSyncResult {
  inserted: number;
  alreadyPresent: number;
  skipped: number;
  containers: Array<{ name: string; action: "inserted" | "exists" }>;
}

/** Derive a friendly agent type from the container name (`rtpi-burp-agent` →
 *  `burp`). Display-only; the canonical type lives in offsec-agents AGENT_TYPES. */
function deriveType(containerName: string): string {
  return containerName.replace(/^rtpi-/, "").replace(/-agent$/, "");
}

/**
 * Register every running offsec container as a managed MCP server. Returns a
 * summary; no-op (all-skipped) when FF_OFFSEC_MANAGED_MCP is off so callers can
 * invoke it unconditionally.
 */
export async function syncOffsecContainerMcpServers(): Promise<OffsecMcpSyncResult> {
  const result: OffsecMcpSyncResult = {
    inserted: 0,
    alreadyPresent: 0,
    skipped: 0,
    containers: [],
  };

  if (!readFeatureFlags(process.env).offsecManagedMcp) {
    result.skipped = 1;
    return result;
  }

  const dockerContainers = await dockerExecutor.listContainers();

  for (const dc of dockerContainers) {
    if (!OFFSEC_CONTAINER_PATTERN.test(dc.name)) continue;

    const seedKey = `offsec:${dc.name}`;
    const type = deriveType(dc.name);

    const inserted = await db
      .insert(mcpServers)
      .values({
        seedKey,
        name: `OffSec MCP: ${type}`,
        command: "docker",
        // Persistent stdio MCP server inside the container. `-i` keeps stdin
        // open for the JSON-RPC pipe; no `-t` (no TTY) so framing is clean.
        args: ["exec", "-i", dc.name, "node", "/mcp/dist/index.js"],
        env: {},
        status: "stopped",
        // Operator-started, not boot-spawned — see file header.
        autoRestart: false,
        maxRestarts: 3,
        lastError: `[managed] Start to connect. Requires running container ${dc.name} with its MCP server built at /mcp/dist/index.js.`,
      })
      .onConflictDoNothing({ target: mcpServers.seedKey })
      .returning({ id: mcpServers.id });

    if (inserted.length > 0) {
      result.inserted += 1;
      result.containers.push({ name: dc.name, action: "inserted" });
    } else {
      result.alreadyPresent += 1;
      result.containers.push({ name: dc.name, action: "exists" });
    }
  }

  console.log(
    `[offsec-mcp-sync] inserted ${result.inserted}, already-present ${result.alreadyPresent}`,
  );
  return result;
}
