/**
 * Knowledge / Semantic Search API (v2.9.1 Phase 7)
 *
 * Mounted at /api/v1/knowledge. Two endpoints:
 *   - POST /search  — top-k vector search across cti_items.embedding
 *   - GET /stats    — counts and dimension info for the runtime panel
 *
 * Vector arithmetic is delegated to pgvector via a raw SQL fragment; the
 * results are ranked by cosine distance ascending (smaller = closer).
 */

import { Router } from "express";
import { db } from "../../db";
import { ctiItems, ctiSources } from "@shared/schema";
import { sql } from "drizzle-orm";
import { ensureAuthenticated } from "../../auth/middleware";
import { embedder, EmbedderError } from "../../services/knowledge/embedder";

const router = Router();
router.use(ensureAuthenticated);

// POST /api/v1/knowledge/search { q, k, sourceId? }
router.post("/search", async (req, res) => {
  const { q, k, sourceId } = req.body ?? {};
  if (typeof q !== "string" || q.trim().length === 0) {
    return res.status(400).json({ error: "q is required" });
  }
  const topK = Math.min(Number(k) || 10, 50);

  let queryVector: number[];
  try {
    const result = await embedder.embed([q]);
    if (!result) {
      return res.status(503).json({
        error: "no_embedding_provider",
        message:
          "No embedding-capable provider is configured. Set RTPI_EMBEDDING_PROVIDER and EMBEDDING_MODEL.",
      });
    }
    queryVector = result.vectors[0];
  } catch (err) {
    if (err instanceof EmbedderError) {
      return res.status(503).json({
        error: err.code,
        message: err.message,
        details: err.details,
      });
    }
    return res.status(500).json({
      error: "embed_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const literal = `[${queryVector.join(",")}]`;
    // Cosine distance via pgvector's `<=>` operator.
    const filterSql = sourceId
      ? sql`AND ${ctiItems.sourceId} = ${sourceId}`
      : sql``;
    const rows = await db.execute(sql`
      SELECT
        ${ctiItems.id} AS id,
        ${ctiItems.sourceId} AS source_id,
        ${ctiItems.externalId} AS external_id,
        ${ctiItems.title} AS title,
        ${ctiItems.summary} AS summary,
        ${ctiItems.link} AS link,
        ${ctiItems.publishedAt} AS published_at,
        ${ctiItems.tags} AS tags,
        (${ctiItems.embedding} <=> ${literal}::vector) AS distance
      FROM ${ctiItems}
      WHERE ${ctiItems.embedding} IS NOT NULL
        ${filterSql}
      ORDER BY distance ASC
      LIMIT ${topK}
    `);

    const results = (rows as any).rows ?? rows;
    res.json({
      query: q,
      k: topK,
      results: results.map((r: any) => ({
        id: r.id,
        sourceId: r.source_id,
        externalId: r.external_id,
        title: r.title,
        summary: r.summary,
        link: r.link,
        publishedAt: r.published_at,
        tags: r.tags,
        distance: Number(r.distance),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Search failed", details: error?.message });
  }
});

// GET /api/v1/knowledge/stats
router.get("/stats", async (_req, res) => {
  try {
    const totalRows = await db.execute(sql`SELECT COUNT(*)::int AS total FROM ${ctiItems}`);
    const embeddedRows = await db.execute(
      sql`SELECT COUNT(*)::int AS total FROM ${ctiItems} WHERE ${ctiItems.embedding} IS NOT NULL`,
    );
    const sourcesRows = await db.execute(sql`SELECT COUNT(*)::int AS total FROM ${ctiSources}`);

    const totalItems = ((totalRows as any).rows ?? totalRows)[0]?.total ?? 0;
    const embeddedItems = ((embeddedRows as any).rows ?? embeddedRows)[0]?.total ?? 0;
    const totalSources = ((sourcesRows as any).rows ?? sourcesRows)[0]?.total ?? 0;

    res.json({
      sources: totalSources,
      items: totalItems,
      itemsEmbedded: embeddedItems,
      embeddingDim: 1536,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load stats", details: error?.message });
  }
});

export default router;
