import { Router } from "express";
import { db } from "../../db";
import { containers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/containers - List all containers
router.get("/", async (req, res) => {
  try {
    const allContainers = await db.select().from(containers);
    res.json({ containers: allContainers });
  } catch (error) {
    console.error("List containers error:", error);
    res.status(500).json({ error: "Failed to list containers" });
  }
});

// GET /api/v1/containers/:id - Get container details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(containers)
      .where(eq(containers.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Container not found" });
    }

    res.json({ container: result[0] });
  } catch (error) {
    console.error("Get container error:", error);
    res.status(500).json({ error: "Failed to get container" });
  }
});

// POST /api/v1/containers - Register container
router.post("/", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const container = await db
      .insert(containers)
      .values(req.body)
      .returning();

    await logAudit(user.id, "register_container", "/containers", container[0].id, true, req);

    res.status(201).json({ container: container[0] });
  } catch (error) {
    console.error("Register container error:", error);
    await logAudit(user.id, "register_container", "/containers", null, false, req);
    res.status(500).json({ error: "Failed to register container" });
  }
});

// PUT /api/v1/containers/:id - Update container
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(containers)
      .set({
        ...req.body,
        lastChecked: new Date(),
      })
      .where(eq(containers.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Container not found" });
    }

    await logAudit(user.id, "update_container", "/containers", id, true, req);

    res.json({ container: result[0] });
  } catch (error) {
    console.error("Update container error:", error);
    await logAudit(user.id, "update_container", "/containers", id, false, req);
    res.status(500).json({ error: "Failed to update container" });
  }
});

// DELETE /api/v1/containers/:id - Delete container
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db.delete(containers).where(eq(containers.id, id));

    await logAudit(user.id, "delete_container", "/containers", id, true, req);

    res.json({ message: "Container deleted successfully" });
  } catch (error) {
    console.error("Delete container error:", error);
    await logAudit(user.id, "delete_container", "/containers", id, false, req);
    res.status(500).json({ error: "Failed to delete container" });
  }
});

export default router;
