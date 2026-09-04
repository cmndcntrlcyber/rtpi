import { Router } from "express";
import { db } from "../../db";
import { knowledgeBase } from "@shared/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { embedder, EmbedderError } from "../../services/knowledge/embedder";
import { z } from "zod";
import { createLogger } from '../../lib/logger';
const log = createLogger("offsec-rd-knowledge");

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// Columns returned to clients. Deliberately EXCLUDES the 2560-dim `embedding`
// vector — it is large, never useful to the UI, and would bloat every payload.
// A computed `similarity` is appended only by the vector-search path.
const ARTICLE_COLUMNS = {
  id: knowledgeBase.id,
  title: knowledgeBase.title,
  summary: knowledgeBase.summary,
  content: knowledgeBase.content,
  category: knowledgeBase.category,
  tags: knowledgeBase.tags,
  sourceUrl: knowledgeBase.sourceUrl,
  author: knowledgeBase.author,
  publishedDate: knowledgeBase.publishedDate,
  contentType: knowledgeBase.contentType,
  attackTactics: knowledgeBase.attackTactics,
  attackTechniques: knowledgeBase.attackTechniques,
  relatedProjectId: knowledgeBase.relatedProjectId,
  viewCount: knowledgeBase.viewCount,
  usefulnessScore: knowledgeBase.usefulnessScore,
  embeddingModel: knowledgeBase.embeddingModel,
  createdBy: knowledgeBase.createdBy,
  createdAt: knowledgeBase.createdAt,
  updatedAt: knowledgeBase.updatedAt,
} as const;

// ---------------------------------------------------------------------------
// Embedding helpers
// ---------------------------------------------------------------------------

/**
 * Best-effort embedding of an article. Returns the vector + model, or null
 * when no provider is configured or the provider's dimension doesn't match the
 * schema's vector(2560). A null result is NOT an error: the article is still
 * persisted and remains searchable via full-text / ILIKE; it just won't
 * participate in semantic search until re-embedded.
 */
async function embedArticle(
  title: string,
  summary: string | null | undefined,
  content: string,
): Promise<{ vector: number[]; model: string | undefined } | null> {
  const text = [title, summary ?? "", content].filter(Boolean).join("\n\n").slice(0, 24_000);
  try {
    const result = await embedder.embed([text]);
    if (result && result.vectors[0]) {
      return { vector: result.vectors[0], model: result.model };
    }
    return null;
  } catch (err) {
    if (err instanceof EmbedderError) {
      log.warn("[offsec-rd-knowledge] embed failed, persisting without vector:", err.message);
      return null;
    }
    throw err;
  }
}

/** Attach an embedding to an existing row via the raw vector literal — drizzle
 *  has no first-class writer for the pgvector type. */
async function attachEmbedding(id: string, vector: number[], model: string | undefined): Promise<void> {
  const literal = `[${vector.join(",")}]`;
  await db.execute(sql`
    UPDATE knowledge_base
       SET embedding = ${literal}::vector(2560),
           embedding_model = ${model ?? null}
     WHERE id = ${id}::uuid
  `);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  summary: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  author: z.string().optional(),
  publishedDate: z.string().optional(),
  contentType: z.enum(["article", "tutorial", "paper", "poc", "tool_doc", "technique"]).optional(),
  attackTactics: z.array(z.string()).optional(),
  attackTechniques: z.array(z.string()).optional(),
  relatedProjectId: z.string().uuid().optional(),
});

// All fields optional for PUT, but at least one must be present.
const updateSchema = createSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" },
);

const searchSchema = z.object({
  query: z.string().min(1, "query is required"),
  category: z.string().optional(),
  contentType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  topK: z.number().int().min(1).max(50).optional(),
});

// ---------------------------------------------------------------------------
// Status probe (unchanged) — used by the Knowledge Base tab to decide whether
// to surface the "install pgvector" banner, and now also returns category /
// content-type breakdowns so the stat cards show real numbers.
// ---------------------------------------------------------------------------
router.get("/status", async (_req, res) => {
  try {
    const extRows: any = await db.execute(sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`);
    const pgvectorInstalled = ((extRows as any).rows ?? extRows).length > 0;

    const tableRows: any = await db.execute(sql`
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'knowledge_base'
    `);
    const tableExists = ((tableRows as any).rows ?? tableRows).length > 0;

    let totalArticles = 0;
    let categoryCount = 0;
    let pocCount = 0;
    let techniqueCount = 0;
    let embeddingReady = false;
    if (tableExists) {
      const aggRows: any = await db.execute(sql`
        SELECT COUNT(*)::int                                            AS total,
               COUNT(DISTINCT category)::int                           AS categories,
               COUNT(*) FILTER (WHERE content_type = 'poc')::int       AS pocs,
               COUNT(*) FILTER (WHERE content_type = 'technique')::int AS techniques
          FROM knowledge_base
      `);
      const agg = ((aggRows as any).rows ?? aggRows)[0] ?? {};
      totalArticles = agg.total ?? 0;
      categoryCount = agg.categories ?? 0;
      pocCount = agg.pocs ?? 0;
      techniqueCount = agg.techniques ?? 0;

      const colRows: any = await db.execute(sql`
        SELECT format_type(a.atttypid, a.atttypmod) AS coltype
          FROM pg_attribute a
          JOIN pg_class c ON a.attrelid = c.oid
         WHERE c.relname = 'knowledge_base' AND a.attname = 'embedding'
      `);
      const coltype = ((colRows as any).rows ?? colRows)[0]?.coltype;
      embeddingReady = coltype === "vector(2560)";
    }

    res.json({
      ready: pgvectorInstalled && tableExists && embeddingReady,
      pgvectorInstalled,
      tableExists,
      embeddingReady,
      totalArticles,
      categoryCount,
      pocCount,
      techniqueCount,
    });
  } catch (error: any) {
    res.status(500).json({
      ready: false,
      error: "status_check_failed",
      details: error?.message,
    });
  }
});

// ---------------------------------------------------------------------------
// Search: semantic (cosine) → full-text → ILIKE, in that order. Each tier
// degrades to the next so a caller always gets results regardless of whether
// an embedding provider is configured or pgvector FTS is present.
// ---------------------------------------------------------------------------
interface SearchOpts {
  query: string;
  category?: string;
  contentType?: string;
  tags?: string[];
  topK: number;
}

async function searchArticles(opts: SearchOpts): Promise<any[]> {
  const { query, category, contentType, tags, topK } = opts;

  const catFilter = category ? sql`AND category = ${category}` : sql``;
  const ctFilter = contentType ? sql`AND content_type = ${contentType}` : sql``;
  const tagFilter = tags && tags.length > 0 ? sql`AND tags @> ${tags}::text[]` : sql``;

  // Tier 1 — semantic similarity (only if we can embed the query).
  const embedded = await embedArticle(query, null, "").catch(() => null);
  if (embedded) {
    const literal = `[${embedded.vector.join(",")}]`;
    const rows = await db.execute(sql`
      SELECT id::text AS id, title, summary, content, category, tags,
             source_url AS "sourceUrl", author, published_date AS "publishedDate",
             content_type AS "contentType", attack_tactics AS "attackTactics",
             attack_techniques AS "attackTechniques", related_project_id AS "relatedProjectId",
             view_count AS "viewCount", usefulness_score AS "usefulnessScore",
             created_at AS "createdAt", updated_at AS "updatedAt",
             1 - (embedding <=> ${literal}::vector(2560)) AS similarity
        FROM knowledge_base
       WHERE embedding IS NOT NULL ${catFilter} ${ctFilter} ${tagFilter}
       ORDER BY embedding <=> ${literal}::vector(2560)
       LIMIT ${topK}
    `);
    const list = (rows as any).rows ?? rows;
    if (list.length > 0) {
      return list.map((r: any) => ({ ...r, source: "vector" }));
    }
  }

  // Tier 2 — full-text via the generated search_vector column.
  try {
    const rows = await db.execute(sql`
      SELECT id::text AS id, title, summary, content, category, tags,
             source_url AS "sourceUrl", author, published_date AS "publishedDate",
             content_type AS "contentType", attack_tactics AS "attackTactics",
             attack_techniques AS "attackTechniques", related_project_id AS "relatedProjectId",
             view_count AS "viewCount", usefulness_score AS "usefulnessScore",
             created_at AS "createdAt", updated_at AS "updatedAt",
             ts_rank(search_vector, websearch_to_tsquery('english', ${query})) AS rank
        FROM knowledge_base
       WHERE search_vector @@ websearch_to_tsquery('english', ${query})
             ${catFilter} ${ctFilter} ${tagFilter}
       ORDER BY rank DESC
       LIMIT ${topK}
    `);
    const list = (rows as any).rows ?? rows;
    if (list.length > 0) {
      return list.map((r: any) => ({ ...r, similarity: null, source: "fulltext" }));
    }
  } catch (err: any) {
    // search_vector column may not exist in older schemas — fall through.
    log.warn("[offsec-rd-knowledge] full-text search unavailable, falling back to ILIKE:", err?.message);
  }

  // Tier 3 — ILIKE substring match (always available).
  const conds = [
    or(
      ilike(knowledgeBase.title, `%${query}%`),
      ilike(knowledgeBase.content, `%${query}%`),
      ilike(knowledgeBase.summary, `%${query}%`),
    ),
  ];
  if (category) conds.push(eq(knowledgeBase.category, category));
  if (contentType) conds.push(eq(knowledgeBase.contentType, contentType));
  const rows = await db
    .select(ARTICLE_COLUMNS)
    .from(knowledgeBase)
    .where(and(...conds))
    .orderBy(desc(knowledgeBase.createdAt))
    .limit(topK);
  return rows.map((r) => ({ ...r, similarity: null, source: "ilike" }));
}

// GET /api/v1/offsec-rd/knowledge - List or search the knowledge base
router.get("/", async (req, res) => {
  const { search, category, tags, contentType, attackTechnique, limit } = req.query;
  const topK = Math.min(100, Math.max(1, parseInt(String(limit ?? "50"), 10) || 50));

  try {
    if (search && String(search).trim().length > 0) {
      const articles = await searchArticles({
        query: String(search).trim(),
        category: category ? String(category) : undefined,
        contentType: contentType ? String(contentType) : undefined,
        tags: tags ? String(tags).split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        topK,
      });
      return res.json({ articles });
    }

    // Plain filtered listing (no search term).
    const conds = [];
    if (category) conds.push(eq(knowledgeBase.category, String(category)));
    if (contentType) conds.push(eq(knowledgeBase.contentType, String(contentType)));
    if (tags) {
      const tagList = String(tags).split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) conds.push(sql`${knowledgeBase.tags} @> ${tagList}::text[]`);
    }
    if (attackTechnique) {
      conds.push(sql`${knowledgeBase.attackTechniques} @> ${[String(attackTechnique)]}::text[]`);
    }

    const articles = await db
      .select(ARTICLE_COLUMNS)
      .from(knowledgeBase)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(knowledgeBase.createdAt))
      .limit(topK);

    res.json({ articles });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to search knowledge base", details: error.message });
  }
});

// POST /api/v1/offsec-rd/knowledge/search - Advanced semantic search
router.post("/search", async (req, res) => {
  try {
    const parsed = searchSchema.parse(req.body);
    const results = await searchArticles({
      query: parsed.query,
      category: parsed.category,
      contentType: parsed.contentType,
      tags: parsed.tags,
      topK: parsed.topK ?? 10,
    });
    res.json({ results });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to search knowledge base", details: error.message });
  }
});

// GET /api/v1/offsec-rd/knowledge/:id - Get a single article (increments views)
router.get("/:id", async (req, res) => {
  try {
    const [article] = await db
      .select(ARTICLE_COLUMNS)
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, req.params.id))
      .limit(1);

    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    // Fire-and-forget view increment — never block the read on it.
    db.update(knowledgeBase)
      .set({ viewCount: sql`${knowledgeBase.viewCount} + 1` })
      .where(eq(knowledgeBase.id, req.params.id))
      .catch((e) => log.warn("[offsec-rd-knowledge] view increment failed:", e?.message));

    res.json({ article });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch article", details: error.message });
  }
});

// POST /api/v1/offsec-rd/knowledge - Create an article
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const data = createSchema.parse(req.body);

    const [created] = await db
      .insert(knowledgeBase)
      .values({
        title: data.title,
        content: data.content,
        summary: data.summary ?? null,
        category: data.category,
        tags: data.tags ?? [],
        sourceUrl: data.sourceUrl ? data.sourceUrl : null,
        author: data.author ?? null,
        publishedDate: data.publishedDate ? new Date(data.publishedDate) : null,
        contentType: data.contentType ?? "article",
        attackTactics: data.attackTactics ?? [],
        attackTechniques: data.attackTechniques ?? [],
        relatedProjectId: data.relatedProjectId ?? null,
        createdBy: user.id,
      })
      .returning(ARTICLE_COLUMNS);

    // Best-effort embedding so the new article is immediately semantically
    // searchable. Failure is non-fatal (FTS/ILIKE still find it).
    const embedded = await embedArticle(data.title, data.summary, data.content);
    if (embedded) {
      await attachEmbedding(created.id, embedded.vector, embedded.model);
    }

    await logAudit(user.id, "offsec_rd_knowledge_create", "/offsec-rd/knowledge", created.id, true, req);

    res.status(201).json({ article: created, embedded: !!embedded });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    await logAudit(user.id, "offsec_rd_knowledge_create", "/offsec-rd/knowledge", null, false, req);
    res.status(500).json({ error: "Failed to create article", details: error.message });
  }
});

// PUT /api/v1/offsec-rd/knowledge/:id - Update an article
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const data = updateSchema.parse(req.body);

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.content !== undefined) updates.content = data.content;
    if (data.summary !== undefined) updates.summary = data.summary;
    if (data.category !== undefined) updates.category = data.category;
    if (data.tags !== undefined) updates.tags = data.tags;
    if (data.sourceUrl !== undefined) updates.sourceUrl = data.sourceUrl ? data.sourceUrl : null;
    if (data.author !== undefined) updates.author = data.author;
    if (data.publishedDate !== undefined) {
      updates.publishedDate = data.publishedDate ? new Date(data.publishedDate) : null;
    }
    if (data.contentType !== undefined) updates.contentType = data.contentType;
    if (data.attackTactics !== undefined) updates.attackTactics = data.attackTactics;
    if (data.attackTechniques !== undefined) updates.attackTechniques = data.attackTechniques;
    if (data.relatedProjectId !== undefined) updates.relatedProjectId = data.relatedProjectId;

    const [updated] = await db
      .update(knowledgeBase)
      .set(updates)
      .where(eq(knowledgeBase.id, req.params.id))
      .returning(ARTICLE_COLUMNS);

    if (!updated) {
      return res.status(404).json({ error: "Article not found" });
    }

    // Re-embed when any text-bearing field changed, so semantic search stays
    // consistent with the new content.
    const textChanged =
      data.title !== undefined || data.content !== undefined || data.summary !== undefined;
    if (textChanged) {
      const embedded = await embedArticle(updated.title, updated.summary, updated.content);
      if (embedded) {
        await attachEmbedding(updated.id, embedded.vector, embedded.model);
      }
    }

    await logAudit(user.id, "offsec_rd_knowledge_update", "/offsec-rd/knowledge", updated.id, true, req);

    res.json({ article: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update article", details: error.message });
  }
});

// DELETE /api/v1/offsec-rd/knowledge/:id - Delete an article
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const [deleted] = await db
      .delete(knowledgeBase)
      .where(eq(knowledgeBase.id, req.params.id))
      .returning({ id: knowledgeBase.id });

    if (!deleted) {
      return res.status(404).json({ error: "Article not found" });
    }

    await logAudit(user.id, "offsec_rd_knowledge_delete", "/offsec-rd/knowledge", deleted.id, true, req);

    res.json({ success: true, id: deleted.id });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete article", details: error.message });
  }
});

export default router;
