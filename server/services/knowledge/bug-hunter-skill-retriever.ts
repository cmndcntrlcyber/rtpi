/**
 * Bug-Hunter Skill Retriever (FF_BUG_HUNTER)
 *
 * Queries the bug-hunter skill corpus in knowledge_base. Embeds the query
 * via the embedding role (Ollama default `qwen3-embedding:4b`) and ranks
 * skill chunks by cosine similarity, with tag filters scoping the search
 * to the relevant phase / mode / vuln class.
 *
 * Falls back to a tag + full-text search when no embedding provider is
 * available, so callers always get some signal.
 *
 * Used by:
 *   - HuntAgent's per-iteration pre-prompt hook (most contextual: feeds
 *     current findings/URL fragments as the query)
 *   - ChainAgent (looks up chain patterns by accumulated finding kinds)
 *   - ScopeAgent (consults `discipline:methodology` chunks for program
 *     parsing patterns)
 *   - the /api/v1/bug-hunter/admin/retrieve endpoint (RAG sanity check)
 */

import { sql } from "drizzle-orm";
import { db } from "../../db";
import { embedder, EmbedderError } from "./embedder";

export type BugHunterPhase =
  | "scope"
  | "recon"
  | "hunt"
  | "chain"
  | "validate"
  | "capture"
  | "report";

export interface RetrieveOptions {
  query: string;
  phase?: BugHunterPhase;
  mode?: "redteam" | "wapt";
  vuln?: string;
  platform?: string;
  discipline?: string;
  /** Extra tag filters in `key:value` form. Combined with the above via AND. */
  extraTags?: string[];
  /** Exclude `chunk:meta` rows by default (set true to include them). */
  includeMeta?: boolean;
  topK?: number;
}

export interface RetrievedSkill {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  tags: string[];
  similarity: number | null;
  source: "vector" | "fulltext";
}

const DEFAULT_TOP_K = 6;

function buildTagFilter(opts: RetrieveOptions): string[] {
  const tags: string[] = [];
  if (opts.phase) tags.push(`phase:${opts.phase}`);
  if (opts.mode) tags.push(`mode:${opts.mode}`);
  if (opts.vuln) tags.push(`vuln:${opts.vuln}`);
  if (opts.platform) tags.push(`platform:${opts.platform}`);
  if (opts.discipline) tags.push(`discipline:${opts.discipline}`);
  for (const t of opts.extraTags ?? []) tags.push(t);
  return tags;
}

/**
 * Retrieve skill chunks by semantic similarity, optionally constrained to
 * a phase / mode / vuln-class. Returns at most `topK` rows, ordered by
 * decreasing similarity (or full-text rank when embedding is unavailable).
 */
export async function retrieveBugHunterSkills(opts: RetrieveOptions): Promise<RetrievedSkill[]> {
  const topK = Math.max(1, Math.min(50, opts.topK ?? DEFAULT_TOP_K));
  const tagsRequired = buildTagFilter(opts);
  const excludeMeta = !opts.includeMeta;

  // 1) Try embedding-backed cosine search.
  let queryVec: number[] | null = null;
  try {
    const result = await embedder.embed([opts.query]);
    if (result && result.vectors[0]) queryVec = result.vectors[0];
  } catch (err) {
    if (!(err instanceof EmbedderError)) throw err;
    // Dimension mismatch / no provider → fall through to text search.
    console.warn("[bug-hunter-retriever] embed failed, falling back to text:", err.message);
  }

  if (queryVec) {
    const literal = `[${queryVec.join(",")}]`;
    const rows = await db.execute<{
      id: string;
      title: string;
      summary: string | null;
      content: string;
      tags: string[];
      similarity: number;
    }>(sql`
      SELECT id::text AS id,
             title,
             summary,
             content,
             tags,
             1 - (embedding <=> ${literal}::vector(2560)) AS similarity
        FROM knowledge_base
       WHERE category = 'bug_hunter_skill'
         AND embedding IS NOT NULL
         ${tagsRequired.length > 0 ? sql`AND tags @> ${tagsRequired}::text[]` : sql``}
         ${excludeMeta ? sql`AND NOT (tags @> ARRAY['chunk:meta']::text[])` : sql``}
       ORDER BY embedding <=> ${literal}::vector(2560)
       LIMIT ${topK}
    `);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      content: r.content,
      tags: r.tags ?? [],
      similarity: typeof r.similarity === "number" ? r.similarity : null,
      source: "vector" as const,
    }));
  }

  // 2) Fallback: tag + full-text search via search_vector.
  const rows = await db.execute<{
    id: string;
    title: string;
    summary: string | null;
    content: string;
    tags: string[];
    rank: number;
  }>(sql`
    SELECT id::text AS id,
           title,
           summary,
           content,
           tags,
           ts_rank(search_vector, websearch_to_tsquery('english', ${opts.query})) AS rank
      FROM knowledge_base
     WHERE category = 'bug_hunter_skill'
       ${tagsRequired.length > 0 ? sql`AND tags @> ${tagsRequired}::text[]` : sql``}
       ${excludeMeta ? sql`AND NOT (tags @> ARRAY['chunk:meta']::text[])` : sql``}
       AND search_vector @@ websearch_to_tsquery('english', ${opts.query})
     ORDER BY rank DESC
     LIMIT ${topK}
  `);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    content: r.content,
    tags: r.tags ?? [],
    similarity: null,
    source: "fulltext" as const,
  }));
}

/**
 * Compact a list of retrieved skills into a single prompt-friendly string
 * that an agent can paste into a `### BUG HUNTER SKILLS` section.
 */
export function formatSkillsForPrompt(skills: RetrievedSkill[], maxChars = 6_000): string {
  const lines: string[] = [];
  let used = 0;
  for (const s of skills) {
    const header = `## ${s.title}`;
    const tagLine = s.tags.length ? `tags: ${s.tags.join(", ")}` : "";
    const body = s.content.length > 1_200 ? s.content.slice(0, 1_200) + "…" : s.content;
    const block = [header, tagLine, "", body, ""].filter(Boolean).join("\n");
    if (used + block.length > maxChars) break;
    lines.push(block);
    used += block.length;
  }
  return lines.join("\n").trim();
}
