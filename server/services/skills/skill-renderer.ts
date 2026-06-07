import yaml from "yaml";
import type { SkillRegistry } from "./skill-paths";

export interface SkillFrontmatter {
  name: string;
  description: string;
  registry: SkillRegistry;
  tool_id: string;
  category?: string;
  tags?: string[];
  mitre_techniques?: string[];
  summary: string;
  sources?: string[];
  generated_at: string;
  generated_by: "anthropic" | "openai" | "template";
  source_hash: string;
}

export interface SkillSection {
  heading: string;
  body: string;
}

export interface SkillDocument {
  frontmatter: SkillFrontmatter;
  sections: SkillSection[];
}

const SECTION_ORDER = [
  "Overview",
  "When to use",
  "Authentication & setup",
  "Key commands / parameters",
  "Example workflows",
  "Output format",
  "Common pitfalls",
  "References",
] as const;

/**
 * Stable section list — synthesis must emit each heading, even if the body
 * is "_No information available._", so the rendered file has a predictable
 * shape across tools.
 */
export const REQUIRED_SECTIONS = SECTION_ORDER;

export function renderSkillDocument(doc: SkillDocument): string {
  const fm = yaml.stringify(stripUndefined(doc.frontmatter)).trimEnd();
  const orderedSections = orderSections(doc.sections);
  const body = orderedSections
    .map((s) => `## ${s.heading}\n\n${s.body.trim() || "_No information available._"}`)
    .join("\n\n");

  return `---\n${fm}\n---\n\n# ${doc.frontmatter.name}\n\n${body}\n`;
}

function orderSections(sections: SkillSection[]): SkillSection[] {
  const byHeading = new Map(sections.map((s) => [s.heading.toLowerCase(), s]));
  const ordered: SkillSection[] = [];
  for (const heading of SECTION_ORDER) {
    const found = byHeading.get(heading.toLowerCase());
    ordered.push(found ?? { heading, body: "" });
    byHeading.delete(heading.toLowerCase());
  }
  // Preserve any extra sections at the end (rare; defensive)
  for (const remaining of byHeading.values()) {
    ordered.push(remaining);
  }
  return ordered;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k as keyof T] = v as T[keyof T];
  }
  return out;
}
