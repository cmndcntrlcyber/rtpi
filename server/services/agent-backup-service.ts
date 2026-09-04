/**
 * Agent backup service.
 *
 * Snapshots the editable surface of an agent (config + tactics + MCP
 * attachments) to JSON files on disk so customizations survive a DB
 * truncate/reset. See ../../../.claude/plans/please-troubleshoot-why-agents-stateful-milner.md
 * for the design rationale.
 */

import { promises as fs } from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { db } from "../db";
import { agents, agentTactics, attackTactics, mcpServers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { agentMCPConnector } from "./agent-mcp-connector";
import { createLogger } from '../lib/logger';
const log = createLogger("agent-backup-service");

const BACKUPS_ROOT =
  process.env.AGENT_BACKUPS_DIR ||
  path.resolve(process.cwd(), "backups", "agents");
const MAX_SNAPSHOTS_PER_AGENT = 20;
const SNAPSHOT_VERSION = 1;

export type SnapshotTrigger = "create" | "edit" | "tactic" | "mcp" | "manual";

export interface SnapshotPayload {
  version: number;
  snapshotId: string;
  snapshotTime: string;
  trigger: SnapshotTrigger;
  agent: {
    name: string;
    type: string;
    config: unknown;
    capabilities: unknown;
    inferenceProviderId: string | null;
    toolChoiceStrategy: string | null;
    isA2aEnabled: boolean;
    meshEnabled: boolean;
  };
  tactics: Array<{ attackId: string; shortName: string | null }>;
  mcpAttachments: Array<{
    mcpServerName: string;
    priority: number;
    enabledTools: string[];
  }>;
}

export interface SnapshotMeta {
  snapshotId: string;
  snapshotTime: string;
  trigger: SnapshotTrigger;
}

export interface AgentBackupListEntry {
  agentName: string;
  slug: string;
  latestSnapshotTime: string | null;
  snapshots: SnapshotMeta[];
}

export interface RestoreResult {
  agentName: string;
  action: "updated" | "created" | "skipped";
  agentId: string | null;
  snapshotId: string;
  restored: { config: boolean; tactics: number; mcp: number };
  errors: string[];
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    || "unnamed";
}

function timestampForFile(d: Date = new Date()): string {
  return d.toISOString().replace(/[:.]/g, "-");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function snapshotIdFromFilename(filename: string): string {
  return filename.replace(/\.json$/, "");
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function atomicWriteJson(filePath: string, payload: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tmp = path.join(dir, `.tmp-${randomUUID()}.json`);
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
  await fs.rename(tmp, filePath);
}

async function loadTactics(agentId: string): Promise<SnapshotPayload["tactics"]> {
  const rows = await db
    .select({
      attackId: attackTactics.attackId,
      shortName: attackTactics.shortName,
    })
    .from(agentTactics)
    .innerJoin(attackTactics, eq(agentTactics.tacticId, attackTactics.id))
    .where(eq(agentTactics.agentId, agentId));
  return rows.map((r) => ({ attackId: r.attackId, shortName: r.shortName }));
}

async function loadMcpAttachments(
  agentId: string
): Promise<SnapshotPayload["mcpAttachments"]> {
  const attachments = agentMCPConnector.getAgentAttachments(agentId);
  if (attachments.length === 0) return [];

  const serverIds = Array.from(new Set(attachments.map((a) => a.mcpServerId)));
  const servers = await db
    .select({ id: mcpServers.id, name: mcpServers.name })
    .from(mcpServers);
  const nameById = new Map(servers.map((s) => [s.id, s.name]));

  return attachments
    .map((a) => {
      const name = nameById.get(a.mcpServerId);
      if (!name) return null;
      return {
        mcpServerName: name,
        priority: a.priority,
        enabledTools: a.enabledTools,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/**
 * Write a snapshot file for one agent. Best-effort; logs failures.
 */
export async function snapshotAgent(
  agentId: string,
  trigger: SnapshotTrigger
): Promise<void> {
  try {
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);
    if (!agent) {
      log.warn(`[agent-backup] snapshot skipped: agent ${agentId} not found`);
      return;
    }

    const [tactics, mcpAttachments] = await Promise.all([
      loadTactics(agentId),
      loadMcpAttachments(agentId),
    ]);

    const now = new Date();
    const snapshotId = timestampForFile(now);
    const payload: SnapshotPayload = {
      version: SNAPSHOT_VERSION,
      snapshotId,
      snapshotTime: now.toISOString(),
      trigger,
      agent: {
        name: agent.name,
        type: agent.type,
        config: agent.config,
        capabilities: agent.capabilities,
        inferenceProviderId: agent.inferenceProviderId,
        toolChoiceStrategy: agent.toolChoiceStrategy,
        isA2aEnabled: agent.isA2aEnabled,
        meshEnabled: agent.meshEnabled,
      },
      tactics,
      mcpAttachments,
    };

    const slug = slugify(agent.name);
    const dir = path.join(BACKUPS_ROOT, slug);
    const filePath = path.join(dir, `${snapshotId}.json`);
    await atomicWriteJson(filePath, payload);
    await pruneSnapshots(slug, MAX_SNAPSHOTS_PER_AGENT);
  } catch (err: any) {
    log.error(`[agent-backup] snapshot failed for ${agentId} (${trigger}):`, err?.message || err);
  }
}

export async function pruneSnapshots(slug: string, keep = MAX_SNAPSHOTS_PER_AGENT): Promise<void> {
  const dir = path.join(BACKUPS_ROOT, slug);
  try {
    const entries = await fs.readdir(dir);
    const snapshotFiles = entries
      .filter((f) => f.endsWith(".json") && !f.startsWith(".tmp-"))
      .sort();
    if (snapshotFiles.length <= keep) return;
    const toDelete = snapshotFiles.slice(0, snapshotFiles.length - keep);
    await Promise.all(toDelete.map((f) => fs.unlink(path.join(dir, f))));
  } catch (err: any) {
    if (err?.code === "ENOENT") return;
    log.warn(`[agent-backup] prune failed for ${slug}:`, err?.message || err);
  }
}

export async function listAgentNames(): Promise<Array<{ agentName: string; slug: string }>> {
  try {
    const entries = await fs.readdir(BACKUPS_ROOT, { withFileTypes: true });
    const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    const out: Array<{ agentName: string; slug: string }> = [];
    for (const slug of slugs) {
      try {
        const meta = await readLatestForSlug(slug);
        if (meta) out.push({ agentName: meta.agent.name, slug });
      } catch {
        // skip malformed dirs
      }
    }
    return out;
  } catch (err: any) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

export async function listSnapshots(slug: string): Promise<SnapshotMeta[]> {
  const dir = path.join(BACKUPS_ROOT, slug);
  try {
    const entries = await fs.readdir(dir);
    const files = entries
      .filter((f) => f.endsWith(".json") && !f.startsWith(".tmp-"))
      .sort()
      .reverse(); // newest first
    const metas: SnapshotMeta[] = [];
    for (const f of files) {
      try {
        const payload = await readJson<SnapshotPayload>(path.join(dir, f));
        metas.push({
          snapshotId: payload.snapshotId || snapshotIdFromFilename(f),
          snapshotTime: payload.snapshotTime,
          trigger: payload.trigger,
        });
      } catch {
        // skip unreadable file
      }
    }
    return metas;
  } catch (err: any) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

async function readLatestForSlug(slug: string): Promise<SnapshotPayload | null> {
  const dir = path.join(BACKUPS_ROOT, slug);
  const entries = await fs.readdir(dir);
  const files = entries
    .filter((f) => f.endsWith(".json") && !f.startsWith(".tmp-"))
    .sort();
  const latest = files[files.length - 1];
  if (!latest) return null;
  return readJson<SnapshotPayload>(path.join(dir, latest));
}

export async function readSnapshot(
  slug: string,
  snapshotId?: string
): Promise<SnapshotPayload | null> {
  if (!snapshotId) return readLatestForSlug(slug);
  const filePath = path.join(BACKUPS_ROOT, slug, `${snapshotId}.json`);
  try {
    return await readJson<SnapshotPayload>(filePath);
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Restore a single agent from a snapshot. See plan §4 for semantics.
 */
export async function restoreAgent(
  slug: string,
  snapshotId?: string
): Promise<RestoreResult> {
  const payload = await readSnapshot(slug, snapshotId);
  if (!payload) {
    return {
      agentName: slug,
      action: "skipped",
      agentId: null,
      snapshotId: snapshotId || "",
      restored: { config: false, tactics: 0, mcp: 0 },
      errors: [`no snapshot found for slug=${slug}${snapshotId ? ` id=${snapshotId}` : ""}`],
    };
  }

  const errors: string[] = [];
  const fields = {
    config: payload.agent.config as any,
    capabilities: payload.agent.capabilities as any,
    inferenceProviderId: payload.agent.inferenceProviderId,
    toolChoiceStrategy: payload.agent.toolChoiceStrategy,
    isA2aEnabled: payload.agent.isA2aEnabled,
    meshEnabled: payload.agent.meshEnabled,
  };

  // 4a — Agent row
  const [existing] = await db
    .select()
    .from(agents)
    .where(eq(agents.name, payload.agent.name))
    .limit(1);

  let agentId: string;
  let action: RestoreResult["action"];
  if (existing) {
    const [updated] = await db
      .update(agents)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(agents.id, existing.id))
      .returning();
    agentId = updated.id;
    action = "updated";
  } else {
    const [created] = await db
      .insert(agents)
      .values({
        name: payload.agent.name,
        type: payload.agent.type as any,
        status: "idle",
        ...fields,
      })
      .returning();
    agentId = created.id;
    action = "created";
  }

  // 4b — Tactics (snapshot is canonical)
  let tacticsApplied = 0;
  if (payload.tactics.length > 0) {
    const attackIds = payload.tactics.map((t) => t.attackId);
    const tacticRows = await db.select().from(attackTactics);
    const idByAttackId = new Map(tacticRows.map((r) => [r.attackId, r.id]));
    const resolved: string[] = [];
    for (const t of payload.tactics) {
      const id = idByAttackId.get(t.attackId);
      if (id) resolved.push(id);
      else errors.push(`tactic missing in attack_tactics: ${t.attackId}`);
    }
    await db.delete(agentTactics).where(eq(agentTactics.agentId, agentId));
    if (resolved.length > 0) {
      await db.insert(agentTactics).values(
        resolved.map((tacticId) => ({ agentId, tacticId }))
      );
      tacticsApplied = resolved.length;
    }
    void attackIds; // referenced for clarity above
  } else {
    // Snapshot had no tactics: clear current tactics to match snapshot.
    await db.delete(agentTactics).where(eq(agentTactics.agentId, agentId));
  }

  // 4c — MCP attachments (additive, not destructive)
  let mcpApplied = 0;
  if (payload.mcpAttachments.length > 0) {
    const allServers = await db
      .select({ id: mcpServers.id, name: mcpServers.name })
      .from(mcpServers);
    const idByName = new Map(allServers.map((s) => [s.name, s.id]));
    for (const att of payload.mcpAttachments) {
      const mcpServerId = idByName.get(att.mcpServerName);
      if (!mcpServerId) {
        errors.push(`mcp server missing: ${att.mcpServerName}`);
        continue;
      }
      try {
        const ok = await agentMCPConnector.attachAgentToMCP(agentId, mcpServerId, {
          priority: att.priority,
          enabledTools: att.enabledTools,
        });
        if (ok) mcpApplied += 1;
        else errors.push(`attach failed for mcp ${att.mcpServerName}`);
      } catch (err: any) {
        errors.push(`attach error for mcp ${att.mcpServerName}: ${err?.message || err}`);
      }
    }
  }

  return {
    agentName: payload.agent.name,
    action,
    agentId,
    snapshotId: payload.snapshotId,
    restored: {
      config: true,
      tactics: tacticsApplied,
      mcp: mcpApplied,
    },
    errors,
  };
}

/**
 * Restore every agent that has at least one snapshot.
 * Per-agent errors don't abort the others.
 */
export async function restoreAll(
  snapshotIds: Record<string, string> = {}
): Promise<RestoreResult[]> {
  const slugs = await listAgentNames();
  const results: RestoreResult[] = [];
  for (const { slug, agentName } of slugs) {
    const requestedId = snapshotIds[agentName] || snapshotIds[slug];
    try {
      results.push(await restoreAgent(slug, requestedId));
    } catch (err: any) {
      results.push({
        agentName,
        action: "skipped",
        agentId: null,
        snapshotId: requestedId || "",
        restored: { config: false, tactics: 0, mcp: 0 },
        errors: [err?.message || String(err)],
      });
    }
  }
  return results;
}
