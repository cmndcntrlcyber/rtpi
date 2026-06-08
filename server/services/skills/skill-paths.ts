import path from "path";

export type SkillRegistry = "mcp" | "registry" | "security";

export const SKILL_REGISTRIES: readonly SkillRegistry[] = ["mcp", "registry", "security"] as const;

/**
 * Repo-root /skills/tools tree. Honors SKILL_DIR_ROOT so tests can point at a
 * temp dir; falls back to the workspace path so production writes alongside
 * the existing /skills/rtpi-custom catalog.
 */
export function skillsRoot(): string {
  const fromEnv = process.env.SKILL_DIR_ROOT?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return path.resolve(process.cwd(), "skills", "tools");
}

/**
 * Sanitize a registry-supplied identifier into a filesystem-safe slug.
 * Replaces : / and whitespace with -, strips anything outside [A-Za-z0-9._-],
 * collapses runs of -, and lowercases.
 */
export function slugifyId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s/:]+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function skillFilePath(registry: SkillRegistry, id: string): string {
  const slug = slugifyId(id) || "unknown";
  return path.join(skillsRoot(), registry, `${slug}.md`);
}

/**
 * Path stored in DB and rendered into agent prompts. Always relative to the
 * repo root so it travels through git and is interpretable by agents running
 * in different working directories.
 */
export function skillRelativePath(registry: SkillRegistry, id: string): string {
  const slug = slugifyId(id) || "unknown";
  return path.posix.join("skills", "tools", registry, `${slug}.md`);
}
