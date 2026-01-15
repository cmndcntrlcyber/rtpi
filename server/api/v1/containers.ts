import { Router } from "express";
import { db } from "../../db";
import { containers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { dockerExecutor } from "../../services/docker-executor";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/containers - List all containers
router.get("/", async (_req, res) => {
  try {
    const allContainers = await db.select().from(containers);
    res.json({ containers: allContainers });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list containers", details: error?.message || "Internal server error" });
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
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get container", details: error?.message || "Internal server error" });
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
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "register_container", "/containers", null, false, req);
    res.status(500).json({ error: "Failed to register container", details: error?.message || "Internal server error" });
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
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "update_container", "/containers", id, false, req);
    res.status(500).json({ error: "Failed to update container", details: error?.message || "Internal server error" });
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
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "delete_container", "/containers", id, false, req);
    res.status(500).json({ error: "Failed to delete container", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/containers/rtpi-tools/status - Get rtpi-tools container status
router.get("/rtpi-tools/status", async (_req, res) => {
  try {
    const status = await dockerExecutor.getContainerStatus("rtpi-tools");
    res.json({ status });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      error: "Failed to get container status",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/v1/containers/rtpi-tools/restart - Restart rtpi-tools container
router.post("/rtpi-tools/restart", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    await dockerExecutor.restartContainer("rtpi-tools");
    await logAudit(user.id, "restart_container", "/containers", "rtpi-tools", true, req);
    res.json({ message: "Container restarted successfully" });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "restart_container", "/containers", "rtpi-tools", false, req);
    res.status(500).json({ 
      error: "Failed to restart container",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/v1/containers/rtpi-tools/logs - Get rtpi-tools container logs
router.get("/rtpi-tools/logs", async (req, res) => {
  const { tail = "100" } = req.query;

  try {
    const logs = await dockerExecutor.getContainerLogs("rtpi-tools", parseInt(tail as string));
    res.json({ logs });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ 
      error: "Failed to get container logs",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/v1/containers/docker/list - List all Docker containers
router.get("/docker/list", async (_req, res) => {
  try {
    const containersList = await dockerExecutor.listContainers();
    res.json({ containers: containersList });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      error: "Failed to list Docker containers",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
