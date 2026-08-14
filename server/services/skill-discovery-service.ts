/**
 * Skill Discovery Service — v3.10.3a
 *
 * Provides skill search with caching. Routes through the ferry-based
 * skill catalog when FF_FERRY_BRIDGE is enabled, falling back to the
 * legacy LangGraph orchestrator when disabled.
 */

import type {
  SkillSearchRequest,
  SkillSearchResult,
  SkillSearchResponse,
  SkillContentResponse,
} from "../../shared/types/skill-types";
import { searchFerrySkills, listFerrySkills } from "./ferry-skill-catalog";
import { readFeatureFlags } from "@shared/feature-flags";
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

  let results: SkillSearchResult[] = [];

  if (readFeatureFlags(process.env).ferryBridge) {
    const ferryResults = searchFerrySkills(req.query);
    results = ferryResults.map((s) => ({
      name: s.name,
      skill_path: s.skillPath,
      domain: s.domain,
      score: 1.0,
      snippet: `Harness skill: ${s.skillPath}`,
    }));
  }

  if (results.length === 0) {
    try {
      const { searchSkills } = await import("./langgraph-client");
      const response = await searchSkills(req);
      results = response.results;
    } catch (error) {
      log.error("[SkillDiscovery] Search failed:", error);
      return [];
    }
  }

  searchCache.set(key, { data: results, expires: Date.now() + CACHE_TTL_MS });
  return results;
}

export async function loadSkill(skillName: string): Promise<string | null> {
  try {
    const { getSkillContent } = await import("./langgraph-client");
    const response = await getSkillContent(skillName);
    return response.content;
  } catch {
    return null;
  }
}

export function clearSkillCache(): void {
  searchCache.clear();
}
