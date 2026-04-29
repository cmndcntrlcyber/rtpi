/**
 * Docmost API (v2.9.1 Phase 8)
 *
 * Mounted at /api/v1/docmost. Two endpoints:
 *   - GET /health       — structured health probe (any auth user)
 *   - POST /pages       — create a Docmost page from a report [operator]
 *
 * Health endpoint always returns 200 with the diagnostic body so the UI
 * can render a banner without hitting an error path. Mirrors the Sysreptor
 * health pattern (Phase 2).
 */

import { Router } from "express";
import { db } from "../../db";
import { reports } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { docmostClient, type DocmostHealth } from "../../services/integrations/docmost-client";

const router = Router();
router.use(ensureAuthenticated);

const HEALTH_CACHE_TTL_MS = 5_000;
let cachedHealth: { at: number; result: DocmostHealth } | null = null;

async function getCachedHealth(): Promise<DocmostHealth> {
  const now = Date.now();
  if (cachedHealth && now - cachedHealth.at < HEALTH_CACHE_TTL_MS) {
    return cachedHealth.result;
  }
  const result = await docmostClient.checkHealth();
  cachedHealth = { at: now, result };
  return result;
}

router.get("/health", async (_req, res) => {
  const result = await getCachedHealth().catch((error) => ({
    up: false,
    url: process.env.DOCMOST_BASE_URL || "http://rtpi-docmost:3000",
    tokenConfigured: docmostClient.configured,
    reason: "service_error" as const,
    error: error instanceof Error ? error.message : "Health probe threw",
  }));
  res.json(result);
});

router.get("/workspaces", async (_req, res) => {
  try {
    if (!docmostClient.configured) {
      return res.status(503).json({ error: "Docmost not configured" });
    }
    const list = await docmostClient.listWorkspaces();
    res.json({ workspaces: list });
  } catch (error: any) {
    res.status(502).json({ error: "List workspaces failed", details: error?.message });
  }
});

// POST /api/v1/docmost/pages [operator]
// Body shape:
//   { reportId?, title?, content?, workspaceId? }
// When reportId is provided, the report's name + content is loaded and used
// as the title + body. Otherwise the caller supplies title + content.
router.post("/pages", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;
  const { reportId, title, content, workspaceId } = req.body ?? {};

  let pageTitle = typeof title === "string" ? title : "";
  let pageContent = typeof content === "string" ? content : "";

  if (reportId) {
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    pageTitle = pageTitle || report.name;
    if (!pageContent) {
      const reportContent = report.content as { markdown?: string; body?: string } | null;
      pageContent =
        reportContent?.markdown ||
        reportContent?.body ||
        (typeof reportContent === "object" ? JSON.stringify(reportContent, null, 2) : String(reportContent ?? ""));
    }
  }

  if (!pageTitle || !pageContent) {
    return res.status(400).json({ error: "title and content are required" });
  }

  try {
    const page = await docmostClient.createPage({
      title: pageTitle,
      content: pageContent,
      workspaceId,
    });
    await logAudit(user.id, "docmost_publish_page", "/docmost/pages", page.id, true, req);
    res.status(201).json({ page });
  } catch (error: any) {
    await logAudit(user.id, "docmost_publish_page", "/docmost/pages", null, false, req);
    res.status(502).json({
      error: "Failed to create Docmost page",
      details: error?.message,
    });
  }
});

export default router;
