import { Router } from "express";
import { db } from "../../db";
import { cisControls, cisSafeguards } from "@shared/schema";
import { eq } from "drizzle-orm";
import { importCISControls, getCISStats } from "../../services/cis-parser";

const router = Router();

/**
 * Get CIS Controls statistics
 */
router.get("/stats", async (_req, res) => {
  try {
    const stats = await getCISStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get CIS statistics", details: error?.message });
  }
});

/**
 * Import CIS Controls v8
 */
router.post("/import", async (_req, res) => {
  try {
    const stats = await importCISControls();
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to import CIS Controls", message: error.message });
  }
});

/**
 * List all CIS Controls
 */
router.get("/controls", async (_req, res) => {
  try {
    const controls = await db.select().from(cisControls).orderBy(cisControls.sortOrder);
    res.json(controls);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch controls" });
  }
});

/**
 * Get full CIS tree: controls → safeguards
 */
router.get("/all", async (_req, res) => {
  try {
    const controls = await db.select().from(cisControls).orderBy(cisControls.sortOrder);
    const allSafeguards = await db.select().from(cisSafeguards).orderBy(cisSafeguards.sortOrder);

    const tree = controls.map((ctrl) => ({
      ...ctrl,
      safeguards: allSafeguards.filter((sg) => sg.controlId === ctrl.id),
    }));

    res.json(tree);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch CIS Controls tree" });
  }
});

/**
 * Get control with safeguards
 */
router.get("/controls/:id", async (req, res) => {
  try {
    const controlResult = await db.select().from(cisControls).where(eq(cisControls.id, req.params.id));
    const control = controlResult[0];

    if (!control) {
      return res.status(404).json({ error: "Control not found" });
    }

    const safeguards = await db.select().from(cisSafeguards).where(eq(cisSafeguards.controlId, req.params.id)).orderBy(cisSafeguards.sortOrder);

    res.json({ ...control, safeguards });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch control" });
  }
});

export default router;
