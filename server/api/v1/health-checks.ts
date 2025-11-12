import { Router } from "express";
import { db } from "../../db";
import { healthChecks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/health-checks - List all health checks
router.get("/", async (req, res) => {
  try {
    const allChecks = await db.select().from(healthChecks);
    res.json({ healthChecks: allChecks });
  } catch (error) {
    console.error("List health checks error:", error);
    res.status(500).json({ error: "Failed to list health checks" });
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
  } catch (error) {
    console.error("Get health check error:", error);
    res.status(500).json({ error: "Failed to get health check" });
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
  } catch (error) {
    console.error("Create health check error:", error);
    res.status(500).json({ error: "Failed to create health check" });
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
  } catch (error) {
    console.error("Update health check error:", error);
    res.status(500).json({ error: "Failed to update health check" });
  }
});

// DELETE /api/v1/health-checks/:id - Delete health check
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    await db.delete(healthChecks).where(eq(healthChecks.id, id));
    res.json({ message: "Health check deleted successfully" });
  } catch (error) {
    console.error("Delete health check error:", error);
    res.status(500).json({ error: "Failed to delete health check" });
  }
});

export default router;
