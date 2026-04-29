/**
 * CTI Feeds API (v2.9.1 Phase 7)
 *
 * Mounted at /api/v1/cti. Sources are admin-managed; reads + manual refresh
 * are open to operators+. Items endpoint paginates with a generous default.
 */

import { Router } from "express";
import { db } from "../../db";
import { ctiSources, ctiIngestionRuns, ctiItems } from "@shared/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { ctiFeedIngestor } from "../../services/knowledge/cti-feed-ingestor";

const router = Router();
router.use(ensureAuthenticated);

// Sources -------------------------------------------------------------------

router.get("/sources", async (_req, res) => {
  try {
    const all = await db.select().from(ctiSources).orderBy(ctiSources.name);
    res.json({ sources: all });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list CTI sources", details: error?.message });
  }
});

router.post("/sources", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  const {
    name,
    kind,
    url,
    collection,
    authHeaders,
    enabled = true,
    cadenceSeconds = 3600,
  } = req.body ?? {};

  if (!name || !kind || !url) {
    return res.status(400).json({ error: "name, kind, url required" });
  }

  try {
    const inserted = await db
      .insert(ctiSources)
      .values({
        name,
        kind,
        url,
        collection: collection ?? null,
        authHeaders: authHeaders ?? null,
        enabled,
        cadenceSeconds,
        createdBy: user.id,
      })
      .returning();
    await logAudit(user.id, "create_cti_source", "/cti/sources", inserted[0].id, true, req);
    res.status(201).json({ source: inserted[0] });
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Source name already exists" });
    }
    res.status(500).json({ error: "Failed to create CTI source", details: error?.message });
  }
});

router.patch("/sources/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;
  const allowed = ["name", "kind", "url", "collection", "authHeaders", "enabled", "cadenceSeconds"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No updatable fields supplied" });
  }
  try {
    const [updated] = await db
      .update(ctiSources)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(ctiSources.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Source not found" });
    await logAudit(user.id, "update_cti_source", "/cti/sources", id, true, req);
    res.json({ source: updated });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update source", details: error?.message });
  }
});

router.delete("/sources/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;
  try {
    const removed = await db.delete(ctiSources).where(eq(ctiSources.id, id)).returning({ id: ctiSources.id });
    if (removed.length === 0) return res.status(404).json({ error: "Source not found" });
    await logAudit(user.id, "delete_cti_source", "/cti/sources", id, true, req);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete source", details: error?.message });
  }
});

router.post("/sources/:id/refresh", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;
  try {
    const result = await ctiFeedIngestor.runSource(id);
    await logAudit(user.id, "refresh_cti_source", `/cti/sources/${id}`, id, !result.error, req);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Refresh failed", details: error?.message });
  }
});

// Items + runs -------------------------------------------------------------

router.get("/items", async (req, res) => {
  const sourceId = req.query.source as string | undefined;
  const q = req.query.q as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const conditions: any[] = [];
    if (sourceId) conditions.push(eq(ctiItems.sourceId, sourceId));
    if (q) {
      // Simple keyword match against title + summary; vector search lives at
      // /api/v1/knowledge/search for ranked results.
      conditions.push(
        sql`(${ctiItems.title} ILIKE ${"%" + q + "%"} OR ${ctiItems.summary} ILIKE ${"%" + q + "%"})`,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select({
        id: ctiItems.id,
        sourceId: ctiItems.sourceId,
        externalId: ctiItems.externalId,
        title: ctiItems.title,
        summary: ctiItems.summary,
        link: ctiItems.link,
        publishedAt: ctiItems.publishedAt,
        tags: ctiItems.tags,
        createdAt: ctiItems.createdAt,
      })
      .from(ctiItems)
      .where(where)
      .orderBy(desc(ctiItems.publishedAt), desc(ctiItems.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ items: rows, limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list items", details: error?.message });
  }
});

router.get("/runs", async (req, res) => {
  const sourceId = req.query.source as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  try {
    const where = sourceId ? eq(ctiIngestionRuns.sourceId, sourceId) : undefined;
    const rows = await db
      .select()
      .from(ctiIngestionRuns)
      .where(where)
      .orderBy(desc(ctiIngestionRuns.startedAt))
      .limit(limit);
    res.json({ runs: rows });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list runs", details: error?.message });
  }
});

export default router;
