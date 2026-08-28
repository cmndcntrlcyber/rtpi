/**
 * Ferry Skill Catalog — v3.10.3a Sprint 2.3
 *
 * Lists nexus-harness skills that are available via the ferry gateway.
 * Phase 1: derives the catalog from the local TOOL_SKILL_MAP.
 * Phase 2 (future): query nexus-harness directly via a /ferry/skills endpoint.
 */

import { TOOL_SKILL_MAP } from "./harness-tool-executor";

export interface FerrySkill {
  name: string;
  skillPath: string;
  domain: string;
  category: string;
  source: "harness";
}

export function listFerrySkills(): FerrySkill[] {
  return Object.entries(TOOL_SKILL_MAP).map(([name, mapping]) => {
    const parts = mapping.skillPath.split("/");
    return {
      name,
      skillPath: mapping.skillPath,
      domain: parts[0] || "general",
      category: parts[1] || "unknown",
      source: "harness" as const,
    };
  });
}

export function searchFerrySkills(query: string): FerrySkill[] {
  const q = query.toLowerCase();
  return listFerrySkills().filter(
    (s) =>
      s.name.includes(q) ||
      s.skillPath.includes(q) ||
      s.category.includes(q),
  );
}
