/**
 * Skill Discovery Service — v3.10.3a
 *
 * Provides skill search and content loading with caching. Routes
 * through the ferry-based skill catalog backed by nexus-harness.
 */

import type {
  SkillSearchRequest,
  SkillSearchResult,
} from "../../shared/types/skill-types";
import { searchFerrySkills, listFerrySkills } from "./ferry-skill-catalog";
import { ferryClient } from "./ferry-client";
import { createLogger } from '../lib/logger';
const log = createLogger("skill-discovery-service");

const searchCache = new Map<string, { data: SkillSearchResult[]; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(req: SkillSearchRequest): string {
  return JSON.stringify(req);
}

export async function findSkills(req: SkillSearchRequest): Promise<SkillSearchResult[]> {
  const key = cacheKey(req);
  const cached = searchCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const ferryResults = searchFerrySkills(req.query);
  const results: SkillSearchResult[] = ferryResults.map((s) => ({
    name: s.name,
    skill_path: s.skillPath,
    domain: s.domain,
    score: 1.0,
    snippet: `Harness skill: ${s.skillPath}`,
  }));

  searchCache.set(key, { data: results, expires: Date.now() + CACHE_TTL_MS });
  return results;
}

export async function loadSkill(skillName: string): Promise<string | null> {
  const skills = listFerrySkills();
  const match = skills.find(
    (s) => s.name === skillName || s.skillPath.endsWith(`/${skillName}`),
  );
  if (!match) return null;

  try {
    const result = await ferryClient.submitTask({
      task_id: `skill-load-${skillName}-${Date.now()}`,
      tool_name: match.skillPath,
      json_arguments: JSON.stringify({ action: "describe" }),
    });
    return result.output;
  } catch (err) {
    log.error(`[SkillDiscovery] Failed to load skill ${skillName}:`, err);
    return null;
  }
}

export function clearSkillCache(): void {
  searchCache.clear();
}
