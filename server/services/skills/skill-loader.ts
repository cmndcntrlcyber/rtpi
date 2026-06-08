import { promises as fs } from "fs";
import path from "path";
import yaml from "yaml";
import { skillFilePath, skillRelativePath, type SkillRegistry } from "./skill-paths";
import type { SkillFrontmatter } from "./skill-renderer";

export interface SkillSummary {
  name: string;
  summary: string;
  skillPath: string; // repo-relative, e.g. skills/tools/mcp/default-tavily.md
  registry: SkillRegistry;
  toolId: string;
  frontmatter: SkillFrontmatter;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

/**
 * Parses leading YAML frontmatter from a markdown string. Returns null if no
 * frontmatter block is present, or if YAML parsing fails. Never throws — the
 * agent prompt path must keep working even if a SKILL.md is malformed.
 */
export function parseFrontmatter(raw: string): SkillFrontmatter | null {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return null;
  try {
    const parsed = yaml.parse(match[1]);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.name || !parsed.summary) return null;
    return parsed as SkillFrontmatter;
  } catch {
    return null;
  }
}

export async function loadSkillSummary(
  registry: SkillRegistry,
  toolId: string,
): Promise<SkillSummary | null> {
  const filePath = skillFilePath(registry, toolId);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    console.error(`[skill-loader] read ${filePath} failed:`, err);
    return null;
  }
  const fm = parseFrontmatter(raw);
  if (!fm) return null;
  return {
    name: fm.name,
    summary: fm.summary,
    skillPath: skillRelativePath(registry, toolId),
    registry,
    toolId,
    frontmatter: fm,
  };
}

export async function loadSkillBody(
  registry: SkillRegistry,
  toolId: string,
): Promise<string | null> {
  const filePath = skillFilePath(registry, toolId);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    console.error(`[skill-loader] read ${filePath} failed:`, err);
    return null;
  }
}

/**
 * Reads a SKILL.md file by repo-relative path (as stored in the
 * tool_registry / mcp_servers / security_tools `skill_path` column). Absolute
 * paths pass through unchanged. Returns null on miss — never throws.
 */
export async function loadSkillFileByRelativePath(relPath: string): Promise<string | null> {
  try {
    const abs = path.isAbsolute(relPath) ? relPath : path.resolve(process.cwd(), relPath);
    return await fs.readFile(abs, "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    console.warn(`[skill-loader] read ${relPath} failed:`, err?.message ?? err);
    return null;
  }
}
