import { Router } from "express";
import { db } from "../../db";
import { targets } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { dockerExecutor } from "../../services/docker-executor";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/targets - List all targets
router.get("/", async (req, res) => {
  try {
    const allTargets = await db.select().from(targets);
    res.json({ targets: allTargets });
  } catch (error) {
    console.error("List targets error:", error);
    res.status(500).json({ error: "Failed to list targets" });
  }
});

// GET /api/v1/targets/:id - Get target details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(targets)
      .where(eq(targets.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Target not found" });
    }

    res.json({ target: result[0] });
  } catch (error) {
    console.error("Get target error:", error);
    res.status(500).json({ error: "Failed to get target" });
  }
});

// POST /api/v1/targets - Add new target
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const target = await db
      .insert(targets)
      .values(req.body)
      .returning();

    await logAudit(user.id, "create_target", "/targets", target[0].id, true, req);

    res.status(201).json({ target: target[0] });
  } catch (error) {
    console.error("Create target error:", error);
    await logAudit(user.id, "create_target", "/targets", null, false, req);
    res.status(500).json({ error: "Failed to create target" });
  }
});

// PUT /api/v1/targets/:id - Update target
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    // Exclude timestamp fields from request body to avoid Date conversion errors
    const { createdAt, updatedAt, ...updateData } = req.body;

    const result = await db
      .update(targets)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(targets.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Target not found" });
    }

    await logAudit(user.id, "update_target", "/targets", id, true, req);

    res.json({ target: result[0] });
  } catch (error) {
    console.error("Update target error:", error);
    await logAudit(user.id, "update_target", "/targets", id, false, req);
    res.status(500).json({ error: "Failed to update target" });
  }
});

// DELETE /api/v1/targets/:id - Delete target
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db.delete(targets).where(eq(targets.id, id));

    await logAudit(user.id, "delete_target", "/targets", id, true, req);

    res.json({ message: "Target deleted successfully" });
  } catch (error) {
    console.error("Delete target error:", error);
    await logAudit(user.id, "delete_target", "/targets", id, false, req);
    res.status(500).json({ error: "Failed to delete target" });
  }
});

// POST /api/v1/targets/:id/scan - Initiate nmap scan
router.post("/:id/scan", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    // Get target details
    const result = await db
      .select()
      .from(targets)
      .where(eq(targets.id, id))
      .limit(1);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Target not found" });
    }

    const target = result[0];

    console.log(`[Nmap] Starting scan on target: ${target.name} (${target.value})`);

    // Execute nmap scan with specified arguments
    const scanResult = await dockerExecutor.exec(
      "rtpi-tools",
      ["nmap", "-sV", "-T5", "-v5", "-p1-65535", target.value],
      { timeout: 600000 } // 10 minutes timeout for full port scan
    );

    console.log(`[Nmap] Scan completed for ${target.name} in ${scanResult.duration}ms`);

    // Parse scan results for key information
    const openPorts = (scanResult.stdout.match(/open/gi) || []).length;
    const scanTimestamp = new Date().toISOString();

    // Store scan results in metadata
    const currentMetadata = (target.metadata as any) || {};
    const updatedMetadata = {
      ...currentMetadata,
      lastScan: {
        timestamp: scanTimestamp,
        duration: scanResult.duration,
        openPorts,
        output: scanResult.stdout,
        command: `nmap -sV -T5 -v5 -p1-65535 ${target.value}`,
        success: scanResult.exitCode === 0,
      },
    };

    // Update target with scan results
    await db
      .update(targets)
      .set({
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(targets.id, id));

    await logAudit(user.id, "scan_target", "/targets", id, true, req);

    res.json({
      message: "Scan completed successfully",
      targetId: id,
      scanOutput: scanResult.stdout,
      scanDuration: scanResult.duration,
      openPorts,
      exitCode: scanResult.exitCode,
    });
  } catch (error) {
    console.error("Scan target error:", error);

    await logAudit(user.id, "scan_target", "/targets", id, false, req);
    
    res.status(500).json({
      error: "Failed to complete scan",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
