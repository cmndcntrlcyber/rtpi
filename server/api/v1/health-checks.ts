import { Router } from "express";
import { db } from "../../db";
import { healthChecks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/health-checks - List all health checks
router.get("/", async (_req, res) => {
  try {
    const allChecks = await db.select().from(healthChecks);
    res.json({ healthChecks: allChecks });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list health checks", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/health-checks/:id - Get health check details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(healthChecks)
      .where(eq(healthChecks.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Health check not found" });
    }

    res.json({ healthCheck: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get health check", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/health-checks - Create health check
router.post("/", ensureRole("admin"), async (req, res) => {
  try {
    const check = await db
      .insert(healthChecks)
      .values(req.body)
      .returning();

    res.status(201).json({ healthCheck: check[0] });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to create health check", details: error?.message || "Internal server error" });
  }
});

// PUT /api/v1/health-checks/:id - Update health check
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .update(healthChecks)
      .set({
        ...req.body,
        lastCheck: new Date(),
      })
      .where(eq(healthChecks.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Health check not found" });
    }

    res.json({ healthCheck: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to update health check", details: error?.message || "Internal server error" });
  }
});

// DELETE /api/v1/health-checks/:id - Delete health check
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    await db.delete(healthChecks).where(eq(healthChecks.id, id));
    res.json({ message: "Health check deleted successfully" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to delete health check", details: error?.message || "Internal server error" });
  }
});

export default router;
