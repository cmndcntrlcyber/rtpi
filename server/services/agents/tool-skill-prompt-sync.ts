/**
 * Tool-skill prompt sync workflow (FF_TOOL_SKILL_GENERATION).
 *
 * When an agent's toolset changes (toolset edited via PUT /api/v1/agents/:id,
 * or a tool's SKILL.md gets regenerated), this module rewrites the agent's
 * `config.systemPrompt` so the prompt's `## Tool Skills` section reflects
 * the current toolset's reference commands.
 *
 * The rewrite is delegated to the reasoning model (routeReasoning) rather
 * than a regex replace: operator-edited prompts are bespoke and a blunt
 * substitution would clobber unrelated wording. The model is asked for a
 * minimal in-place edit that swaps the Tool Skills section only.
 *
 * No-op when FF_TOOL_SKILL_GENERATION is off — the workflow is meaningless
 * without generated skill files.
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { agents, mcpServers, toolRegistry, securityTools } from "@shared/schema";
import { readFeatureFlags } from "@shared/feature-flags";
import { routeReasoning, NoInferenceProviderAvailable } from "../inference/inference-router";
import { loadSkillFileByRelativePath } from "../skills/skill-loader";
import type { SkillRegistry } from "../skills/skill-paths";

export interface ToolSkillEntry {
  registry: SkillRegistry;
  rowId: string;
  name: string;
  /** Repo-relative path from the registry row's skill_path column. */
  skillPath: string;
  /** Full SKILL.md body (frontmatter stripped). null when file read fails. */
  body: string | null;
}

export interface SyncResult {
  changed: boolean;
  reason: "flag_disabled" | "agent_not_found" | "no_skills" | "model_failed" | "synced";
  beforePrompt: string | null;
  afterPrompt: string | null;
  /** stableId of skills present after sync (for dedupe across triggers). */
  syncedSkillIds: string[];
}

const SECTION_HEADER = "## Tool Skills";
const SECTION_END_RE = /\n(##\s|\Z)/;

/** Reads agent.config to get MCP server IDs (supporting both legacy single and array forms). */
function readMcpServerIds(config: unknown): string[] {
  const cfg = (config ?? {}) as { mcpServerIds?: unknown; mcpServerId?: unknown };
  if (Array.isArray(cfg.mcpServerIds)) {
    return cfg.mcpServerIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  }
  if (typeof cfg.mcpServerId === "string" && cfg.mcpServerId.length > 0) {
    return [cfg.mcpServerId];
  }
  return [];
}

/** Reads agent.config.enabledTools (UUIDs into tool_registry / security_tools). */
function readEnabledToolIds(config: unknown): string[] {
  const cfg = (config ?? {}) as { enabledTools?: unknown };
  if (!Array.isArray(cfg.enabledTools)) return [];
  return cfg.enabledTools.filter((id): id is string => typeof id === "string" && id.length > 0);
}


/**
 * Loads the current SKILL.md entries for everything the agent has access to.
 * Looks up the registry rows by ID, takes their `skill_path` column, reads
 * the file from disk. Rows without a populated `skill_path` are skipped
 * (skill generation is still pending or disabled).
 */
export async function loadAgentToolSkills(agentConfig: unknown): Promise<ToolSkillEntry[]> {
  const mcpIds = readMcpServerIds(agentConfig);
  const toolIds = readEnabledToolIds(agentConfig);
  const out: ToolSkillEntry[] = [];

  if (mcpIds.length > 0) {
    const rows = await db
      .select({ id: mcpServers.id, name: mcpServers.name, skillPath: mcpServers.skillPath })
      .from(mcpServers)
      .where(inArray(mcpServers.id, mcpIds));
    for (const r of rows) {
      if (!r.skillPath) continue;
      out.push({
        registry: "mcp",
        rowId: r.id,
        name: r.name,
        skillPath: r.skillPath,
        body: await loadSkillFileByRelativePath(r.skillPath),
      });
    }
  }

  if (toolIds.length > 0) {
    // tool_registry and security_tools share the same id namespace from the
    // agent's POV — try both, dedupe by row id.
    const regRows = await db
      .select({ id: toolRegistry.id, name: toolRegistry.name, skillPath: toolRegistry.skillPath })
      .from(toolRegistry)
      .where(inArray(toolRegistry.id, toolIds));
    for (const r of regRows) {
      if (!r.skillPath) continue;
      out.push({
        registry: "registry",
        rowId: r.id,
        name: r.name,
        skillPath: r.skillPath,
        body: await loadSkillFileByRelativePath(r.skillPath),
      });
    }
    const seenIds = new Set(regRows.map((r) => r.id));
    const remaining = toolIds.filter((id) => !seenIds.has(id));
    if (remaining.length > 0) {
      const secRows = await db
        .select({ id: securityTools.id, name: securityTools.name, skillPath: securityTools.skillPath })
        .from(securityTools)
        .where(inArray(securityTools.id, remaining));
      for (const r of secRows) {
        if (!r.skillPath) continue;
        out.push({
          registry: "security",
          rowId: r.id,
          name: r.name,
          skillPath: r.skillPath,
          body: await loadSkillFileByRelativePath(r.skillPath),
        });
      }
    }
  }

  return out;
}

/**
 * Renders the `## Tool Skills` section that should appear in the agent's
 * system prompt for the given entries. Each entry includes the SKILL.md body
 * inline so the agent has reference commands without needing a follow-up
 * filesystem read.
 */
export function renderSkillSection(entries: ToolSkillEntry[]): string {
  if (entries.length === 0) return "";
  const blocks = entries.map((e) => {
    const bodyOrFallback = e.body
      ? e.body.trim()
      : `_(SKILL.md at \`${e.skillPath}\` could not be loaded — agents should fetch it from disk before invoking this tool.)_`;
    return [
      `### ${e.name} (${e.registry}/${e.rowId})`,
      `_Manual: \`${e.skillPath}\`_`,
      "",
      bodyOrFallback,
    ].join("\n");
  });
  return `${SECTION_HEADER}\n\n${blocks.join("\n\n")}\n`;
}

/**
 * Replaces (or inserts) the `## Tool Skills` section in `systemPrompt`. Used
 * as the deterministic fallback when the reasoning model is unavailable, and
 * as the structured input the model is asked to honor.
 */
export function applySkillSectionDirect(systemPrompt: string, section: string): string {
  const startIdx = systemPrompt.indexOf(SECTION_HEADER);
  if (startIdx === -1) {
    return systemPrompt.trimEnd() + "\n\n" + section;
  }
  // Find the start of the next `## ` header after our section, or EOF.
  const afterHeader = systemPrompt.slice(startIdx + SECTION_HEADER.length);
  const nextMatch = afterHeader.match(SECTION_END_RE);
  const endIdx = nextMatch
    ? startIdx + SECTION_HEADER.length + (nextMatch.index ?? 0) + 1 // include the leading newline before next ##
    : systemPrompt.length;
  const before = systemPrompt.slice(0, startIdx).trimEnd();
  const after = systemPrompt.slice(endIdx).trimStart();
  return [before, section.trimEnd(), after].filter(Boolean).join("\n\n");
}

interface ReasoningRewriteInput {
  systemPrompt: string;
  previousSection: string;
  desiredSection: string;
}

/**
 * Asks the reasoning model for a minimal in-place edit. Returns null on any
 * failure so the caller can fall back to the deterministic splice. The model
 * is instructed to preserve every operator-authored line outside the
 * `## Tool Skills` section.
 */
async function reasoningRewrite(input: ReasoningRewriteInput): Promise<string | null> {
  const prompt = `You are editing an AI agent's system prompt. The agent's toolset just changed and the "## Tool Skills" section needs to be rewritten.

You MUST follow these rules:
1. Output the COMPLETE updated system prompt — no commentary, no markdown fences.
2. Replace the existing "## Tool Skills" section with the desired one supplied below. If the section is absent, insert the desired section near the bottom of the prompt.
3. If the desired section is empty, REMOVE the "## Tool Skills" section entirely.
4. Do not modify any line outside the "## Tool Skills" section. Operator edits to other sections are sacred.
5. Preserve the rest of the prompt's structure, headings, ordering, and whitespace style.

=== CURRENT SYSTEM PROMPT ===
${input.systemPrompt}
=== END CURRENT SYSTEM PROMPT ===

=== PREVIOUS "## Tool Skills" SECTION (for reference; remove from prompt) ===
${input.previousSection || "(none — there is no Tool Skills section in the current prompt)"}
=== END PREVIOUS SECTION ===

=== DESIRED "## Tool Skills" SECTION (insert verbatim, or remove section if empty) ===
${input.desiredSection || "(empty — remove the Tool Skills section entirely)"}
=== END DESIRED SECTION ===

Output the new system prompt now.`;

  try {
    const result = await routeReasoning({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 8000,
      temperature: 0.1,
    });
    const text = result.response.text.trim();
    if (text.length === 0) return null;
    return text;
  } catch (err) {
    if (err instanceof NoInferenceProviderAvailable) {
      console.warn(
        "[tool-skill-prompt-sync] reasoning router exhausted — falling back to deterministic splice:",
        err.message,
      );
    } else {
      console.warn("[tool-skill-prompt-sync] reasoning rewrite failed:", err);
    }
    return null;
  }
}

/** Extracts the existing `## Tool Skills` section verbatim, if present. */
function extractExistingSection(systemPrompt: string): string {
  const start = systemPrompt.indexOf(SECTION_HEADER);
  if (start === -1) return "";
  const after = systemPrompt.slice(start + SECTION_HEADER.length);
  const next = after.match(SECTION_END_RE);
  const end = next ? start + SECTION_HEADER.length + (next.index ?? 0) : systemPrompt.length;
  return systemPrompt.slice(start, end).trimEnd();
}

export interface SyncOptions {
  /** Free-text label written into the audit log to explain the trigger. */
  reason?: string;
  /**
   * Skip the reasoning model and use the deterministic splice instead. Faster
   * and zero-cost, useful from tests or when the operator explicitly opted
   * out of LLM-driven prompt edits.
   */
  skipReasoning?: boolean;
}

/**
 * Sync the agent's `config.systemPrompt` so its `## Tool Skills` section
 * reflects the current toolset. Returns a SyncResult describing what changed.
 *
 * Persists `agents.config.systemPrompt` only when the prompt actually
 * changes. Logs a one-line summary; full diff visibility comes from the
 * existing audit log on PUT /api/v1/agents/:id.
 */
export async function syncAgentPromptForToolset(
  agentId: string,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  if (!readFeatureFlags(process.env).toolSkillGeneration) {
    return {
      changed: false,
      reason: "flag_disabled",
      beforePrompt: null,
      afterPrompt: null,
      syncedSkillIds: [],
    };
  }

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) {
    return {
      changed: false,
      reason: "agent_not_found",
      beforePrompt: null,
      afterPrompt: null,
      syncedSkillIds: [],
    };
  }

  const config = (agent.config ?? {}) as { systemPrompt?: string; [k: string]: unknown };
  const beforePrompt = typeof config.systemPrompt === "string" ? config.systemPrompt : "";

  const entries = await loadAgentToolSkills(agent.config);
  const desiredSection = renderSkillSection(entries);
  const previousSection = extractExistingSection(beforePrompt);

  // Nothing to do: no skills generated and no existing section to remove.
  if (entries.length === 0 && previousSection.length === 0) {
    return {
      changed: false,
      reason: "no_skills",
      beforePrompt,
      afterPrompt: beforePrompt,
      syncedSkillIds: [],
    };
  }

  let afterPrompt = beforePrompt;
  let usedReasoning = false;

  if (!opts.skipReasoning && beforePrompt.length > 0) {
    const rewritten = await reasoningRewrite({
      systemPrompt: beforePrompt,
      previousSection,
      desiredSection,
    });
    if (rewritten) {
      afterPrompt = rewritten;
      usedReasoning = true;
    }
  }

  if (!usedReasoning) {
    // Deterministic splice — either the reasoning model wasn't tried,
    // failed, or the prompt was empty (model would have nothing to preserve).
    afterPrompt = beforePrompt.length === 0 ? desiredSection : applySkillSectionDirect(beforePrompt, desiredSection);
  }

  const changed = afterPrompt !== beforePrompt;
  const syncedIds = entries.map((e) => `${e.registry}/${e.rowId}`);

  if (!changed) {
    return {
      changed: false,
      reason: entries.length === 0 ? "no_skills" : "synced",
      beforePrompt,
      afterPrompt,
      syncedSkillIds: syncedIds,
    };
  }

  const nextConfig = { ...config, systemPrompt: afterPrompt };
  await db
    .update(agents)
    .set({ config: nextConfig, updatedAt: new Date() })
    .where(eq(agents.id, agentId));

  console.log(
    `[tool-skill-prompt-sync] agent=${agentId} reason=${opts.reason || "manual"} skills=${syncedIds.length} ` +
      `mode=${usedReasoning ? "reasoning" : "deterministic"}`,
  );

  return {
    changed: true,
    reason: "synced",
    beforePrompt,
    afterPrompt,
    syncedSkillIds: syncedIds,
  };
}

/**
 * Bulk sync — invoked after a skill regeneration so every agent that uses
 * that tool gets its prompt refreshed. Best-effort; per-agent errors are
 * logged and don't fail the batch.
 */
export async function syncAllAgentsForSkillChange(opts: {
  registry: SkillRegistry;
  rowId: string;
  reason?: string;
}): Promise<{ scanned: number; changed: number; errors: number }> {
  if (!readFeatureFlags(process.env).toolSkillGeneration) {
    return { scanned: 0, changed: 0, errors: 0 };
  }
  const all = await db.select({ id: agents.id, config: agents.config }).from(agents);
  let changed = 0;
  let errors = 0;
  for (const a of all) {
    const mcps = readMcpServerIds(a.config);
    const tools = readEnabledToolIds(a.config);
    const matches =
      (opts.registry === "mcp" && mcps.includes(opts.rowId)) ||
      ((opts.registry === "registry" || opts.registry === "security") && tools.includes(opts.rowId));
    if (!matches) continue;
    try {
      const r = await syncAgentPromptForToolset(a.id, { reason: opts.reason || "skill_regenerated" });
      if (r.changed) changed += 1;
    } catch (err) {
      errors += 1;
      console.error(`[tool-skill-prompt-sync] bulk sync failed for agent ${a.id}:`, err);
    }
  }
  return { scanned: all.length, changed, errors };
}
