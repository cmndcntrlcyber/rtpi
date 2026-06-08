/**
 * Knowledge Base reader — general-purpose semantic/full-text search over
 * `knowledge_base`, usable from anywhere in the server (agents, services).
 *
 * Unlike `bug-hunter-skill-retriever.ts` (locked to category
 * `bug_hunter_skill`), this searches ALL categories by default so it surfaces
 * the rows the synergy paths write — `research_finding` (S1) and
 * `promoted_tool` (S4) — which is what lets R&D agents consult prior work
 * before making external calls (S2).
 *
 * Degrades through three tiers so it returns signal regardless of whether an
 * embedding provider or pgvector FTS is available:
 *   1. embedding cosine   (when the query embeds)
 *   2. full-text (search_vector)
 *   3. ILIKE substring     (always available)
 */

import { sql } from "drizzle-orm";
import { db } from "../../db";
import { embedder, EmbedderError } from "./embedder";

export interface KnowledgeSearchOptions {
  query: string;
  category?: string;
  contentType?: string;
  /** Restrict to rows carrying ALL of these tags. */
  tags?: string[];
  topK?: number;
}

export interface KnowledgeHit {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  category: string;
  tags: string[];
  attackTactics: string[];
  attackTechniques: string[];
  similarity: number | null;
  source: "vector" | "fulltext" | "ilike";
}

const SELECT_COLS = sql`
  id::text AS id, title, summary, content, category,
  COALESCE(tags, ARRAY[]::text[]) AS tags,
  COALESCE(attack_tactics, ARRAY[]::text[]) AS "attackTactics",
  COALESCE(attack_techniques, ARRAY[]::text[]) AS "attackTechniques"
`;

async function embedQuery(query: string): Promise<number[] | null> {
  try {
    const result = await embedder.embed([query]);
    return result?.vectors[0] ?? null;
  } catch (err) {
    if (err instanceof EmbedderError) return null;
    throw err;
  }
}

/**
 * Search the knowledge base. Returns at most `topK` hits ordered by relevance.
 * Never throws on a missing embedding provider or missing FTS column.
 */
export async function searchKnowledge(opts: KnowledgeSearchOptions): Promise<KnowledgeHit[]> {
  const topK = Math.max(1, Math.min(50, opts.topK ?? 6));
  const catFilter = opts.category ? sql`AND category = ${opts.category}` : sql``;
  const ctFilter = opts.contentType ? sql`AND content_type = ${opts.contentType}` : sql``;
  const tagFilter = opts.tags && opts.tags.length > 0 ? sql`AND tags @> ${opts.tags}::text[]` : sql``;

  // Tier 1 — embedding cosine.
  const vec = await embedQuery(opts.query);
  if (vec) {
    const literal = `[${vec.join(",")}]`;
    const rows = await db.execute(sql`
      SELECT ${SELECT_COLS}, 1 - (embedding <=> ${literal}::vector(2560)) AS similarity
        FROM knowledge_base
       WHERE embedding IS NOT NULL ${catFilter} ${ctFilter} ${tagFilter}
       ORDER BY embedding <=> ${literal}::vector(2560)
       LIMIT ${topK}
    `);
    const list = (rows as any).rows ?? rows;
    if (list.length > 0) return list.map((r: any) => ({ ...r, source: "vector" as const }));
  }

  // Tier 2 — full-text.
  try {
    const rows = await db.execute(sql`
      SELECT ${SELECT_COLS}, NULL::float8 AS similarity
        FROM knowledge_base
       WHERE search_vector @@ websearch_to_tsquery('english', ${opts.query})
             ${catFilter} ${ctFilter} ${tagFilter}
       ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${opts.query})) DESC
       LIMIT ${topK}
    `);
    const list = (rows as any).rows ?? rows;
    if (list.length > 0) return list.map((r: any) => ({ ...r, source: "fulltext" as const }));
  } catch {
    // search_vector absent — fall through.
  }

  // Tier 3 — ILIKE.
  const like = `%${opts.query}%`;
  const rows = await db.execute(sql`
    SELECT ${SELECT_COLS}, NULL::float8 AS similarity
      FROM knowledge_base
     WHERE (title ILIKE ${like} OR content ILIKE ${like} OR summary ILIKE ${like})
           ${catFilter} ${ctFilter} ${tagFilter}
     ORDER BY created_at DESC
     LIMIT ${topK}
  `);
  const list = (rows as any).rows ?? rows;
  return list.map((r: any) => ({ ...r, source: "ilike" as const }));
}

/** Extract distinct CVE IDs mentioned in a set of hits (title/summary/content). */
export function extractCvesFromHits(hits: KnowledgeHit[]): string[] {
  const found = new Set<string>();
  for (const h of hits) {
    const text = `${h.title}\n${h.summary ?? ""}\n${h.content}`;
    const matches = text.match(/CVE-\d{4}-\d{4,}/g);
    if (matches) for (const m of matches) found.add(m);
  }
  return [...found];
}
