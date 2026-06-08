/**
 * Tool SKILL.md generator orchestrator (FF_TOOL_SKILL_GENERATION).
 *
 * Per-tool pipeline: Tavily research → LLM synthesis → markdown render →
 * write to /skills/tools/{registry}/<id>.md → update DB row with skill_path,
 * skill_generated_at, skill_source_hash.
 *
 * `enqueueSkillGeneration()` is the fire-and-forget wrapper used by the
 * three registration hooks (tool-registry-manager, mcp-server-manager,
 * POST /api/v1/tools). It returns immediately and logs failures to console
 * — install paths must never block on this work.
 */

import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { mcpServers, toolRegistry, securityTools } from "@shared/schema";
import { readFeatureFlags } from "@shared/feature-flags";
import { researchTool, type ToolResearchInput } from "./skills/tavily-researcher";
import { synthesizeSkill, type SynthesisInput } from "./skills/skill-synthesizer";
import { renderSkillDocument } from "./skills/skill-renderer";
import {
  skillFilePath,
  skillRelativePath,
  slugifyId,
  type SkillRegistry,
} from "./skills/skill-paths";

export interface GenerateOptions {
  force?: boolean;
}

export interface GenerateResult {
  registry: SkillRegistry;
  toolId: string;
  status: "generated" | "skipped_unchanged" | "skipped_missing_row" | "failed";
  skillPath?: string;
  generatedBy?: "anthropic" | "openai" | "template";
  durationMs: number;
  error?: string;
}

interface RowMetadata {
  rowId: string;          // DB UUID for the row
  stableId: string;       // Slug used for the file (e.g. seedKey, toolId, slugified name)
  research: ToolResearchInput;
  synthesisExtras: Pick<SynthesisInput, "command" | "args" | "version">;
}

async function loadMcpRow(serverId: string): Promise<{ row: typeof mcpServers.$inferSelect; meta: RowMetadata } | null> {
  const [row] = await db.select().from(mcpServers).where(eq(mcpServers.id, serverId));
  if (!row) return null;
  const stableId = row.seedKey?.trim() || `mcp-${row.id}`;
  return {
    row,
    meta: {
      rowId: row.id,
      stableId,
      research: {
        name: row.name,
        category: "mcp-server",
        description: row.lastError?.startsWith("[disabled]") ? null : null,
        command: row.command,
      },
      synthesisExtras: {
        command: row.command,
        args: row.args,
        version: null,
      },
    },
  };
}

async function loadRegistryRow(rowId: string): Promise<{ row: typeof toolRegistry.$inferSelect; meta: RowMetadata } | null> {
  const [row] = await db.select().from(toolRegistry).where(eq(toolRegistry.id, rowId));
  if (!row) return null;
  return {
    row,
    meta: {
      rowId: row.id,
      stableId: row.toolId,
      research: {
        name: row.name,
        category: row.category,
        description: row.description,
        command: row.installCommand ?? row.binaryPath,
        homepage: row.homepage,
        githubUrl: row.githubUrl,
        documentation: row.documentation,
      },
      synthesisExtras: {
        command: row.installCommand ?? row.binaryPath,
        args: null,
        version: row.version,
      },
    },
  };
}

async function loadSecurityRow(rowId: string): Promise<{ row: typeof securityTools.$inferSelect; meta: RowMetadata } | null> {
  const [row] = await db.select().from(securityTools).where(eq(securityTools.id, rowId));
  if (!row) return null;
  return {
    row,
    meta: {
      rowId: row.id,
      stableId: slugifyId(row.name) || `security-${row.id}`,
      research: {
        name: row.name,
        category: row.category,
        description: row.description,
        command: row.command,
      },
      synthesisExtras: {
        command: row.command,
        args: null,
        version: row.version,
      },
    },
  };
}

function loadRow(
  registry: SkillRegistry,
  rowId: string,
): Promise<{ row: Record<string, any>; meta: RowMetadata } | null> {
  if (registry === "mcp") return loadMcpRow(rowId) as any;
  if (registry === "registry") return loadRegistryRow(rowId) as any;
  return loadSecurityRow(rowId) as any;
}

function computeSourceHash(meta: RowMetadata): string {
  const payload = JSON.stringify({
    name: meta.research.name,
    category: meta.research.category,
    description: meta.research.description,
    command: meta.synthesisExtras.command,
    args: meta.synthesisExtras.args,
    version: meta.synthesisExtras.version,
    homepage: meta.research.homepage,
    githubUrl: meta.research.githubUrl,
  });
  return createHash("sha256").update(payload).digest("hex");
}

async function updateRowSkillFields(
  registry: SkillRegistry,
  rowId: string,
  skillPath: string,
  sourceHash: string,
): Promise<void> {
  const values = {
    skillPath,
    skillGeneratedAt: new Date(),
    skillSourceHash: sourceHash,
  };
  if (registry === "mcp") {
    await db.update(mcpServers).set(values).where(eq(mcpServers.id, rowId));
  } else if (registry === "registry") {
    await db.update(toolRegistry).set(values).where(eq(toolRegistry.id, rowId));
  } else {
    await db.update(securityTools).set(values).where(eq(securityTools.id, rowId));
  }
}

export async function generateSkillForRegistry(
  registry: SkillRegistry,
  rowId: string,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const started = Date.now();
  const loaded = await loadRow(registry, rowId);
  if (!loaded) {
    return {
      registry,
      toolId: rowId,
      status: "skipped_missing_row",
      durationMs: Date.now() - started,
    };
  }

  const { row, meta } = loaded;
  const sourceHash = computeSourceHash(meta);

  if (!options.force && row.skillSourceHash === sourceHash && row.skillPath) {
    return {
      registry,
      toolId: meta.stableId,
      status: "skipped_unchanged",
      skillPath: row.skillPath,
      durationMs: Date.now() - started,
    };
  }

  try {
    const research = await researchTool(meta.research);
    const synth = await synthesizeSkill({
      registry,
      toolId: meta.stableId,
      name: meta.research.name,
      description: meta.research.description ?? null,
      category: meta.research.category ?? null,
      homepage: meta.research.homepage ?? null,
      githubUrl: meta.research.githubUrl ?? null,
      documentation: meta.research.documentation ?? null,
      research,
      ...meta.synthesisExtras,
    });

    const markdown = renderSkillDocument({
      frontmatter: { ...synth.frontmatter, source_hash: sourceHash },
      sections: synth.sections,
    });

    const filePath = skillFilePath(registry, meta.stableId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, markdown, "utf-8");

    const relPath = skillRelativePath(registry, meta.stableId);
    await updateRowSkillFields(registry, rowId, relPath, sourceHash);

    return {
      registry,
      toolId: meta.stableId,
      status: "generated",
      skillPath: relPath,
      generatedBy: synth.generatedBy,
      durationMs: Date.now() - started,
    };
  } catch (err: any) {
    console.error(`[skill-generator] ${registry}/${meta.stableId} failed:`, err);
    return {
      registry,
      toolId: meta.stableId,
      status: "failed",
      durationMs: Date.now() - started,
      error: err?.message ?? String(err),
    };
  }
}

/**
 * Fire-and-forget wrapper used by install/registration hooks. Guards on the
 * feature flag and ensures the caller's promise chain is never blocked.
 *
 * Mirrors the setTimeout(..., 1000) pattern at mcp-server-manager.ts:45 so
 * the work runs after the install transaction commits.
 *
 * On successful regeneration, triggers a downstream prompt-sync for every
 * agent that uses this tool so their `## Tool Skills` section reflects the
 * new SKILL.md. The sync is also fire-and-forget — agent prompt edits
 * tolerate the lag.
 */
export function enqueueSkillGeneration(registry: SkillRegistry, rowId: string): void {
  if (!readFeatureFlags(process.env).toolSkillGeneration) return;
  setTimeout(() => {
    generateSkillForRegistry(registry, rowId)
      .then(async (result) => {
        if (result.status === "generated") {
          console.log(
            `[skill-generator] ${registry}/${result.toolId} → ${result.skillPath} (${result.generatedBy}, ${result.durationMs}ms)`,
          );
          try {
            const { syncAllAgentsForSkillChange } = await import("./agents/tool-skill-prompt-sync");
            const sync = await syncAllAgentsForSkillChange({
              registry,
              rowId,
              reason: "skill_regenerated",
            });
            if (sync.changed > 0 || sync.errors > 0) {
              console.log(
                `[skill-generator] post-sync: scanned=${sync.scanned} changed=${sync.changed} errors=${sync.errors}`,
              );
            }
          } catch (err) {
            console.error(`[skill-generator] post-sync trigger failed:`, err);
          }
        }
      })
      .catch((err) => console.error(`[skill-generator] ${registry}/${rowId} failed:`, err));
  }, 1000);
}

/**
 * Lists every registered tool across the three registries, suitable for the
 * one-shot backfill script.
 */
export async function listAllRegisteredTools(): Promise<Array<{
  registry: SkillRegistry;
  rowId: string;
  displayName: string;
}>> {
  const out: Array<{ registry: SkillRegistry; rowId: string; displayName: string }> = [];
  const mcps = await db.select({ id: mcpServers.id, name: mcpServers.name }).from(mcpServers);
  for (const r of mcps) out.push({ registry: "mcp", rowId: r.id, displayName: r.name });
  const registries = await db.select({ id: toolRegistry.id, name: toolRegistry.name }).from(toolRegistry);
  for (const r of registries) out.push({ registry: "registry", rowId: r.id, displayName: r.name });
  const securities = await db.select({ id: securityTools.id, name: securityTools.name }).from(securityTools);
  for (const r of securities) out.push({ registry: "security", rowId: r.id, displayName: r.name });
  return out;
}
