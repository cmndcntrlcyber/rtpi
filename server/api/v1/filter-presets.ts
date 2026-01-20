import { Router } from "express";
import { db } from "../../db";
import { filterPresets } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import { ensureAuthenticated } from "../../auth/middleware";
import { z } from "zod";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

const filterPresetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  context: z.string().min(1, "Context is required"),
  filters: z.any(), // Filter state object
  isShared: z.boolean().optional().default(false),
});

// GET /api/v1/filter-presets - List all filter presets (user's own + shared)
router.get("/", async (req, res) => {
  const user = req.user as any;
  const { context } = req.query;

  try {
    let query = db.select().from(filterPresets).where(
      or(
        eq(filterPresets.userId, user.id), // User's own presets
        eq(filterPresets.isShared, true)   // Shared presets
      )
    );

    // Filter by context if provided
    if (context && typeof context === "string") {
      query = query.where(eq(filterPresets.context, context)) as any;
    }

    const presets = await query;

    res.json({ presets });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve filter presets",
      details: error.message,
    });
  }
});

// GET /api/v1/filter-presets/:id - Get specific preset
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const preset = await db
      .select()
      .from(filterPresets)
      .where(
        and(
          eq(filterPresets.id, id),
          or(
            eq(filterPresets.userId, user.id),
            eq(filterPresets.isShared, true)
          )
        )
      )
      .limit(1);

    if (!preset || preset.length === 0) {
      return res.status(404).json({ error: "Filter preset not found" });
    }

    res.json({ preset: preset[0] });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve filter preset",
      details: error.message,
    });
  }
});

// POST /api/v1/filter-presets - Create new preset
router.post("/", async (req, res) => {
  const user = req.user as any;

  try {
    const validated = filterPresetSchema.parse(req.body);

    const preset = await db
      .insert(filterPresets)
      .values({
        ...validated,
        userId: user.id,
      })
      .returning();

    res.status(201).json({ preset: preset[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    res.status(500).json({
      error: "Failed to create filter preset",
      details: error.message,
    });
  }
});

// PUT /api/v1/filter-presets/:id - Update preset
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const validated = filterPresetSchema.partial().parse(req.body);

    const result = await db
      .update(filterPresets)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(filterPresets.id, id),
          eq(filterPresets.userId, user.id) // Only update own presets
        )
      )
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Filter preset not found" });
    }

    res.json({ preset: result[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    res.status(500).json({
      error: "Failed to update filter preset",
      details: error.message,
    });
  }
});

// DELETE /api/v1/filter-presets/:id - Delete preset
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db
      .delete(filterPresets)
      .where(
        and(
          eq(filterPresets.id, id),
          eq(filterPresets.userId, user.id) // Only delete own presets
        )
      );

    res.json({ message: "Filter preset deleted successfully" });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to delete filter preset",
      details: error.message,
    });
  }
});

export default router;
