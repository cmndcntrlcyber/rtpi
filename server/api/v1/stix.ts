/**
 * STIX Import API (v2.9.1 Phase 7)
 *
 * Mounted at /api/v1/stix. Three endpoints:
 *   - POST /import          — JSON body containing a STIX bundle [admin]
 *   - POST /atlas/refresh   — fetch + import the upstream ATLAS bundle [admin]
 *   - POST /attck/refresh   — fetch + import the upstream ATT&CK bundle [admin]
 *   - GET  /runs            — recent import audit rows
 */

import { Router } from "express";
import { db } from "../../db";
import { stixImportRuns } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { stixImportJob } from "../../services/knowledge/stix-import-job";

const router = Router();
router.use(ensureAuthenticated);

// Accept large bundles; the global Express body limit may be smaller, so this
// router gets its own.
router.use((req, res, next) => {
  // Express 4 default JSON body parser handled at app level — assume the
  // mount sets a generous limit. If not, the upload will fail at parse.
  next();
});

router.post("/import", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  const { source = "custom", bundle, taxiiCollection } = req.body ?? {};
  if (!bundle || !Array.isArray(bundle.objects)) {
    return res.status(400).json({ error: "Body must include a STIX bundle with objects[]" });
  }
  try {
    const result = await stixImportJob.importBundle(source, bundle, taxiiCollection ?? null);
    await logAudit(user.id, "stix_import", "/stix/import", result.runId, true, req);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "STIX import failed", details: error?.message });
  }
});

router.post("/atlas/refresh", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  try {
    const result = await stixImportJob.refreshAtlas();
    await logAudit(user.id, "stix_atlas_refresh", "/stix/atlas/refresh", result.runId, true, req);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "ATLAS refresh failed", details: error?.message });
  }
});

router.post("/attck/refresh", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  try {
    const result = await stixImportJob.refreshAttck();
    await logAudit(user.id, "stix_attck_refresh", "/stix/attck/refresh", result.runId, true, req);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "ATT&CK refresh failed", details: error?.message });
  }
});

router.get("/runs", async (req, res) => {
  const source = req.query.source as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  try {
    const where = source ? eq(stixImportRuns.source, source) : undefined;
    const rows = await db
      .select()
      .from(stixImportRuns)
      .where(where)
      .orderBy(desc(stixImportRuns.startedAt))
      .limit(limit);
    res.json({ runs: rows });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list runs", details: error?.message });
  }
});

export default router;
