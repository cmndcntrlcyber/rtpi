/**
 * Skill Discovery Service — v2.5
 *
 * TypeScript wrapper that delegates to the Python orchestrator's
 * skill discovery endpoints. Provides caching and local fallback.
 */

import type {
  SkillSearchRequest,
  SkillSearchResponse,
  SkillSearchResult,
  SkillContentResponse,
} from "../../shared/types/skill-types";
import { searchSkills, getSkillContent } from "./langgraph-client";

// Simple in-memory cache for skill searches
const searchCache = new Map<string, { data: SkillSearchResponse; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(req: SkillSearchRequest): string {
  return JSON.stringify(req);
}

/**
 * Search for relevant skills with caching.
 */
export async function findSkills(req: SkillSearchRequest): Promise<SkillSearchResult[]> {
  const key = cacheKey(req);
  const cached = searchCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data.results;
  }

  try {
    const response = await searchSkills(req);
    searchCache.set(key, { data: response, expires: Date.now() + CACHE_TTL_MS });
    return response.results;
  } catch (error) {
    // If orchestrator is unavailable, return empty results
    console.error("[SkillDiscovery] Search failed:", error);
    return [];
  }
}

/**
 * Get full content of a specific skill.
 */
export async function loadSkill(skillName: string): Promise<string | null> {
  try {
    const response = await getSkillContent(skillName);
    return response.content;
  } catch {
    return null;
  }
}

/**
 * Clear the search cache (e.g., after skills are updated).
 */
export function clearSkillCache(): void {
  searchCache.clear();
}
