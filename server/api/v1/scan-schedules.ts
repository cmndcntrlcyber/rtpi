/**
 * Scan Schedules API
 *
 * Endpoints for managing scheduled scans with cron expressions.
 */

import { Router } from "express";
import { db } from "../../db";
import { scanSchedules } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";
import {
  scanScheduler,
  validateCronExpression,
  cronToHumanReadable,
  CRON_PRESETS,
} from "../../services/scan-scheduler";

const router = Router();

// Apply authentication
router.use(ensureAuthenticated);

// GET /api/v1/scan-schedules - List all scan schedules
router.get("/", async (req, res) => {
  try {
    const { operationId } = req.query;

    let query = db.select().from(scanSchedules);

    if (operationId) {
      const schedules = await db
        .select()
        .from(scanSchedules)
        .where(eq(scanSchedules.operationId, operationId as string));
      return res.json(schedules);
    }

    const allSchedules = await query;
    res.json(allSchedules);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list schedules", details: error?.message });
  }
});

// GET /api/v1/scan-schedules/:id - Get schedule by ID
router.get("/:id", async (req, res) => {
  try {
    const schedule = await db.query.scanSchedules.findFirst({
      where: eq(scanSchedules.id, req.params.id),
    });

    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get schedule", details: error?.message });
  }
});

// POST /api/v1/scan-schedules - Create new schedule
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const user = req.user as any;
    const { name, description, operationId, cronExpression, toolConfig, targets, enabled } =
      req.body;

    // Validation
    if (!name || !cronExpression || !operationId || !toolConfig || !targets) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!validateCronExpression(cronExpression)) {
      return res.status(400).json({ error: "Invalid cron expression" });
    }

    // Create schedule
    const [schedule] = await db
      .insert(scanSchedules)
      .values({
        name,
        description,
        operationId,
        cronExpression,
        toolConfig,
        targets,
        enabled: enabled !== false,
        createdBy: user.id,
      })
      .returning();

    // Add to scheduler if enabled
    if (schedule.enabled) {
      await scanScheduler.addSchedule(schedule as any);
    }

    res.status(201).json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create schedule", details: error?.message });
  }
});

// PUT /api/v1/scan-schedules/:id - Update schedule
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const { name, description, cronExpression, toolConfig, targets, enabled } = req.body;

    const existing = await db.query.scanSchedules.findFirst({
      where: eq(scanSchedules.id, req.params.id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // Validate cron if provided
    if (cronExpression && !validateCronExpression(cronExpression)) {
      return res.status(400).json({ error: "Invalid cron expression" });
    }

    // Update schedule
    const [updated] = await db
      .update(scanSchedules)
      .set({
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        cronExpression: cronExpression || existing.cronExpression,
        toolConfig: toolConfig || existing.toolConfig,
        targets: targets || existing.targets,
        enabled: enabled !== undefined ? enabled : existing.enabled,
        updatedAt: new Date(),
      })
      .where(eq(scanSchedules.id, req.params.id))
      .returning();

    // Remove from scheduler
    await scanScheduler.removeSchedule(req.params.id);

    // Add back if enabled
    if (updated.enabled) {
      await scanScheduler.addSchedule(updated as any);
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update schedule", details: error?.message });
  }
});

// DELETE /api/v1/scan-schedules/:id - Delete schedule
router.delete("/:id", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const existing = await db.query.scanSchedules.findFirst({
      where: eq(scanSchedules.id, req.params.id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // Remove from scheduler
    await scanScheduler.removeSchedule(req.params.id);

    // Delete from database
    await db.delete(scanSchedules).where(eq(scanSchedules.id, req.params.id));

    res.json({ message: "Schedule deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete schedule", details: error?.message });
  }
});

// POST /api/v1/scan-schedules/:id/enable - Enable schedule
router.post("/:id/enable", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const [schedule] = await db
      .update(scanSchedules)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(scanSchedules.id, req.params.id))
      .returning();

    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // Add to scheduler
    await scanScheduler.addSchedule(schedule as any);

    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to enable schedule", details: error?.message });
  }
});

// POST /api/v1/scan-schedules/:id/disable - Disable schedule
router.post("/:id/disable", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const [schedule] = await db
      .update(scanSchedules)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(scanSchedules.id, req.params.id))
      .returning();

    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // Remove from scheduler
    await scanScheduler.removeSchedule(req.params.id);

    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to disable schedule", details: error?.message });
  }
});

// POST /api/v1/scan-schedules/:id/trigger - Manually trigger schedule
router.post("/:id/trigger", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const schedule = await db.query.scanSchedules.findFirst({
      where: eq(scanSchedules.id, req.params.id),
    });

    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // Trigger scan
    await scanScheduler.triggerSchedule(req.params.id);

    res.json({ message: "Schedule triggered successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to trigger schedule", details: error?.message });
  }
});

// GET /api/v1/scan-schedules/presets - Get cron presets
router.get("/presets/list", async (_req, res) => {
  try {
    const presets = Object.entries(CRON_PRESETS).map(([name, expression]) => ({
      name,
      expression,
      readable: cronToHumanReadable(expression),
    }));

    res.json(presets);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get presets", details: error?.message });
  }
});

// POST /api/v1/scan-schedules/validate-cron - Validate cron expression
router.post("/validate-cron", async (req, res) => {
  try {
    const { cronExpression } = req.body;

    if (!cronExpression) {
      return res.status(400).json({ error: "Cron expression is required" });
    }

    const isValid = validateCronExpression(cronExpression);
    const readable = isValid ? cronToHumanReadable(cronExpression) : null;

    res.json({
      isValid,
      readable,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to validate cron", details: error?.message });
  }
});

// GET /api/v1/scan-schedules/statistics - Get scheduler statistics
router.get("/statistics/summary", async (_req, res) => {
  try {
    const stats = await scanScheduler.getStatistics();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get statistics", details: error?.message });
  }
});

export default router;
