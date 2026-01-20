import { Router } from "express";
import { db } from "../../db";
import { attackFlows } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Validation schemas
const createFlowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  operationId: z.string().uuid().optional(),
  flowData: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }),
  isTemplate: z.boolean().optional(),
  isShared: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateFlowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  flowData: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }).optional(),
  status: z.enum(["draft", "active", "completed"]).optional(),
  isTemplate: z.boolean().optional(),
  isShared: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * List all attack flows
 */
router.get("/", async (req, res) => {
  try {
    const { operationId, isTemplate, isShared } = req.query;

    let query = db.query.attackFlows.findMany({
      orderBy: [desc(attackFlows.updatedAt)],
    });

    // Apply filters
    const conditions: any[] = [];

    if (operationId) {
      conditions.push(eq(attackFlows.operationId, operationId as string));
    }

    if (isTemplate === "true") {
      conditions.push(eq(attackFlows.isTemplate, true));
    }

    if (isShared === "true") {
      conditions.push(eq(attackFlows.isShared, true));
    }

    let flows;
    if (conditions.length > 0) {
      flows = await db.query.attackFlows.findMany({
        where: and(...conditions),
        orderBy: [desc(attackFlows.updatedAt)],
      });
    } else {
      flows = await db.query.attackFlows.findMany({
        orderBy: [desc(attackFlows.updatedAt)],
      });
    }

    res.json({ flows });
  } catch (error: any) {
    console.error("Failed to list attack flows:", error);
    res.status(500).json({
      error: "Failed to list attack flows",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Get a specific attack flow
 */
router.get("/:id", async (req, res) => {
  try {
    const flow = await db.query.attackFlows.findFirst({
      where: eq(attackFlows.id, req.params.id),
    });

    if (!flow) {
      return res.status(404).json({ error: "Attack flow not found" });
    }

    res.json(flow);
  } catch (error: any) {
    console.error("Failed to get attack flow:", error);
    res.status(500).json({
      error: "Failed to get attack flow",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Create a new attack flow
 */
router.post("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = createFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors
      });
    }

    const data = parsed.data;

    const [flow] = await db
      .insert(attackFlows)
      .values({
        name: data.name,
        description: data.description || null,
        operationId: data.operationId || null,
        flowData: data.flowData,
        isTemplate: data.isTemplate || false,
        isShared: data.isShared || false,
        createdBy: userId,
        metadata: data.metadata || {},
      })
      .returning();

    res.status(201).json(flow);
  } catch (error: any) {
    console.error("Failed to create attack flow:", error);
    res.status(500).json({
      error: "Failed to create attack flow",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Update an attack flow
 */
router.put("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = updateFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors
      });
    }

    const data = parsed.data;

    // Check if flow exists
    const existing = await db.query.attackFlows.findFirst({
      where: eq(attackFlows.id, req.params.id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Attack flow not found" });
    }

    // Update the flow
    const [updated] = await db
      .update(attackFlows)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(attackFlows.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    console.error("Failed to update attack flow:", error);
    res.status(500).json({
      error: "Failed to update attack flow",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Delete an attack flow
 */
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if flow exists
    const existing = await db.query.attackFlows.findFirst({
      where: eq(attackFlows.id, req.params.id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Attack flow not found" });
    }

    // Check if user owns the flow
    if (existing.createdBy !== userId) {
      return res.status(403).json({ error: "Forbidden: You can only delete your own flows" });
    }

    await db
      .delete(attackFlows)
      .where(eq(attackFlows.id, req.params.id));

    res.status(204).send();
  } catch (error: any) {
    console.error("Failed to delete attack flow:", error);
    res.status(500).json({
      error: "Failed to delete attack flow",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Duplicate an attack flow (create a copy)
 */
router.post("/:id/duplicate", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get the original flow
    const original = await db.query.attackFlows.findFirst({
      where: eq(attackFlows.id, req.params.id),
    });

    if (!original) {
      return res.status(404).json({ error: "Attack flow not found" });
    }

    // Create a duplicate
    const [duplicate] = await db
      .insert(attackFlows)
      .values({
        name: `${original.name} (Copy)`,
        description: original.description,
        operationId: original.operationId,
        flowData: original.flowData,
        isTemplate: original.isTemplate,
        isShared: false, // Copies are private by default
        createdBy: userId,
        metadata: original.metadata,
      })
      .returning();

    res.status(201).json(duplicate);
  } catch (error: any) {
    console.error("Failed to duplicate attack flow:", error);
    res.status(500).json({
      error: "Failed to duplicate attack flow",
      details: error?.message || "Internal server error"
    });
  }
});

export default router;
