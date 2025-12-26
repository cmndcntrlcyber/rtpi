import { Router } from "express";
import { db } from "../../db";
import { devices } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/devices - List all devices
router.get("/", async (_req, res) => {
  try {
    const allDevices = await db.select().from(devices);
    res.json({ devices: allDevices });
  } catch (error) {
    console.error("List devices error:", error);
    res.status(500).json({ error: "Failed to list devices" });
  }
});

// GET /api/v1/devices/:id - Get device details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(devices)
      .where(eq(devices.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json({ device: result[0] });
  } catch (error) {
    console.error("Get device error:", error);
    res.status(500).json({ error: "Failed to get device" });
  }
});

// POST /api/v1/devices - Register new device
router.post("/", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const device = await db
      .insert(devices)
      .values(req.body)
      .returning();

    await logAudit(user.id, "register_device", "/devices", device[0].id, true, req);

    res.status(201).json({ device: device[0] });
  } catch (error) {
    console.error("Register device error:", error);
    await logAudit(user.id, "register_device", "/devices", null, false, req);
    res.status(500).json({ error: "Failed to register device" });
  }
});

// PUT /api/v1/devices/:id - Update device
router.put("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(devices)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    await logAudit(user.id, "update_device", "/devices", id, true, req);

    res.json({ device: result[0] });
  } catch (error) {
    console.error("Update device error:", error);
    await logAudit(user.id, "update_device", "/devices", id, false, req);
    res.status(500).json({ error: "Failed to update device" });
  }
});

// DELETE /api/v1/devices/:id - Delete device
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db.delete(devices).where(eq(devices.id, id));

    await logAudit(user.id, "delete_device", "/devices", id, true, req);

    res.json({ message: "Device deleted successfully" });
  } catch (error) {
    console.error("Delete device error:", error);
    await logAudit(user.id, "delete_device", "/devices", id, false, req);
    res.status(500).json({ error: "Failed to delete device" });
  }
});

// POST /api/v1/devices/:id/block - Block device
router.post("/:id/block", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(devices)
      .set({ isBlocked: true })
      .where(eq(devices.id, id))
      .returning();

    await logAudit(user.id, "block_device", "/devices", id, true, req);

    res.json({ device: result[0] });
  } catch (error) {
    console.error("Block device error:", error);
    res.status(500).json({ error: "Failed to block device" });
  }
});

// POST /api/v1/devices/:id/unblock - Unblock device
router.post("/:id/unblock", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(devices)
      .set({ isBlocked: false })
      .where(eq(devices.id, id))
      .returning();

    await logAudit(user.id, "unblock_device", "/devices", id, true, req);

    res.json({ device: result[0] });
  } catch (error) {
    console.error("Unblock device error:", error);
    res.status(500).json({ error: "Failed to unblock device" });
  }
});

export default router;
