/**
 * Knowledge Base writer — shared helper for programmatically creating
 * `knowledge_base` rows with a best-effort embedding.
 *
 * Used by the cross-tab synergy paths (HARNESS-EVALUATION.md §3):
 *   - S1: research_document artifacts → KB (rd-experiment-orchestrator)
 *   - S4: promoted tools → KB tool_doc (rd-tool-promotion)
 * and mirrors the inline logic in the offsec-rd-knowledge route so all three
 * produce identically-shaped, immediately-searchable rows.
 *
 * Idempotency: callers pass a `dedupeTag` (e.g. `artifact:<id>` or
 * `tool:<id>`). If a row already carries that tag, we skip the insert and
 * return the existing id — so a re-run experiment or a re-promotion doesn't
 * spawn duplicate articles.
 */

import { sql } from "drizzle-orm";
import { db } from "../../db";
import { knowledgeBase } from "@shared/schema";
import { embedder, EmbedderError } from "./embedder";

export interface KnowledgeArticleInput {
  title: string;
  content: string;
  summary?: string | null;
  category: string;
  contentType?: string;
  tags?: string[];
  sourceUrl?: string | null;
  author?: string | null;
  attackTactics?: string[];
  attackTechniques?: string[];
  relatedProjectId?: string | null;
  createdBy?: string | null;
  /** Tag that uniquely identifies the source; re-inserts with the same tag
   *  are skipped (returns the existing row). Also added to `tags`. */
  dedupeTag?: string;
}

export interface KnowledgeArticleResult {
  id: string;
  embedded: boolean;
  /** true when an existing row matched dedupeTag and no insert happened. */
  deduped: boolean;
}

async function embed(
  title: string,
  summary: string | null | undefined,
  content: string,
): Promise<{ vector: number[]; model: string | undefined } | null> {
  const text = [title, summary ?? "", content].filter(Boolean).join("\n\n").slice(0, 24_000);
  try {
    const result = await embedder.embed([text]);
    if (result && result.vectors[0]) return { vector: result.vectors[0], model: result.model };
    return null;
  } catch (err) {
    if (err instanceof EmbedderError) {
      console.warn("[kb-writer] embed failed, persisting without vector:", err.message);
      return null;
    }
    throw err;
  }
}

async function findByTag(tag: string): Promise<string | null> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT id::text AS id FROM knowledge_base
     WHERE tags @> ARRAY[${tag}]::text[]
     LIMIT 1
  `);
  const list = (rows as any).rows ?? rows;
  return list.length ? list[0].id : null;
}

/**
 * Create a knowledge_base row (with embedding when a provider is available).
 * Never throws on embedding failure — the row is still persisted and remains
 * findable via full-text / ILIKE.
 */
export async function createKnowledgeArticle(
  input: KnowledgeArticleInput,
): Promise<KnowledgeArticleResult> {
  const tags = [...(input.tags ?? [])];
  if (input.dedupeTag && !tags.includes(input.dedupeTag)) tags.push(input.dedupeTag);

  if (input.dedupeTag) {
    const existing = await findByTag(input.dedupeTag);
    if (existing) return { id: existing, embedded: false, deduped: true };
  }

  const [created] = await db
    .insert(knowledgeBase)
    .values({
      title: input.title,
      content: input.content,
      summary: input.summary ?? null,
      category: input.category,
      tags,
      contentType: input.contentType ?? "article",
      sourceUrl: input.sourceUrl ?? null,
      author: input.author ?? null,
      attackTactics: input.attackTactics ?? [],
      attackTechniques: input.attackTechniques ?? [],
      relatedProjectId: input.relatedProjectId ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning({ id: knowledgeBase.id });

  const embedded = await embed(input.title, input.summary, input.content);
  if (embedded) {
    const literal = `[${embedded.vector.join(",")}]`;
    await db.execute(sql`
      UPDATE knowledge_base
         SET embedding = ${literal}::vector(2560),
             embedding_model = ${embedded.model ?? null}
       WHERE id = ${created.id}::uuid
    `);
  }

  return { id: created.id, embedded: !!embedded, deduped: false };
}
