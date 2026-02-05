import { Router } from "express";
import { db } from "../../db";
import { toolWorkflows, securityTools } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Validation schemas
const createWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  operationId: z.string().uuid().nullish(),
  workflowData: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }),
  category: z.string().optional(),
  isTemplate: z.boolean().optional(),
  isShared: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  workflowData: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }).optional(),
  status: z.enum(["draft", "active", "completed"]).optional(),
  category: z.string().optional(),
  isTemplate: z.boolean().optional(),
  isShared: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * List all tool workflows
 */
router.get("/", async (req, res) => {
  try {
    const { operationId, isTemplate, isShared, category } = req.query;

    const conditions: any[] = [];

    if (operationId) {
      conditions.push(eq(toolWorkflows.operationId, operationId as string));
    }

    if (isTemplate === "true") {
      conditions.push(eq(toolWorkflows.isTemplate, true));
    }

    if (isShared === "true") {
      conditions.push(eq(toolWorkflows.isShared, true));
    }

    if (category) {
      conditions.push(eq(toolWorkflows.category, category as string));
    }

    let workflows;
    if (conditions.length > 0) {
      workflows = await db.query.toolWorkflows.findMany({
        where: and(...conditions),
        orderBy: [desc(toolWorkflows.updatedAt)],
      });
    } else {
      workflows = await db.query.toolWorkflows.findMany({
        orderBy: [desc(toolWorkflows.updatedAt)],
      });
    }

    res.json({ workflows });
  } catch (error: any) {
    console.error("Failed to list tool workflows:", error);
    res.status(500).json({
      error: "Failed to list tool workflows",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Get a specific tool workflow
 */
router.get("/:id", async (req, res) => {
  try {
    const workflow = await db.query.toolWorkflows.findFirst({
      where: eq(toolWorkflows.id, req.params.id),
    });

    if (!workflow) {
      return res.status(404).json({ error: "Tool workflow not found" });
    }

    res.json(workflow);
  } catch (error: any) {
    console.error("Failed to get tool workflow:", error);
    res.status(500).json({
      error: "Failed to get tool workflow",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Create a new tool workflow
 */
router.post("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = createWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors
      });
    }

    const data = parsed.data;

    const [workflow] = await db
      .insert(toolWorkflows)
      .values({
        name: data.name,
        description: data.description || null,
        operationId: data.operationId || null,
        workflowData: data.workflowData,
        category: data.category || null,
        isTemplate: data.isTemplate || false,
        isShared: data.isShared || false,
        createdBy: userId,
        metadata: data.metadata || {},
      })
      .returning();

    res.status(201).json(workflow);
  } catch (error: any) {
    console.error("Failed to create tool workflow:", error);
    res.status(500).json({
      error: "Failed to create tool workflow",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Update a tool workflow
 */
router.put("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = updateWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors
      });
    }

    const data = parsed.data;

    // Check if workflow exists
    const existing = await db.query.toolWorkflows.findFirst({
      where: eq(toolWorkflows.id, req.params.id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Tool workflow not found" });
    }

    // Update the workflow
    const [updated] = await db
      .update(toolWorkflows)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(toolWorkflows.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    console.error("Failed to update tool workflow:", error);
    res.status(500).json({
      error: "Failed to update tool workflow",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Delete a tool workflow
 */
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if workflow exists
    const existing = await db.query.toolWorkflows.findFirst({
      where: eq(toolWorkflows.id, req.params.id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Tool workflow not found" });
    }

    // Check if user owns the workflow
    if (existing.createdBy !== userId) {
      return res.status(403).json({ error: "Forbidden: You can only delete your own workflows" });
    }

    await db
      .delete(toolWorkflows)
      .where(eq(toolWorkflows.id, req.params.id));

    res.status(204).send();
  } catch (error: any) {
    console.error("Failed to delete tool workflow:", error);
    res.status(500).json({
      error: "Failed to delete tool workflow",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Duplicate a tool workflow (create a copy)
 */
router.post("/:id/duplicate", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get the original workflow
    const original = await db.query.toolWorkflows.findFirst({
      where: eq(toolWorkflows.id, req.params.id),
    });

    if (!original) {
      return res.status(404).json({ error: "Tool workflow not found" });
    }

    // Create a duplicate
    const [duplicate] = await db
      .insert(toolWorkflows)
      .values({
        name: `${original.name} (Copy)`,
        description: original.description,
        operationId: original.operationId,
        workflowData: original.workflowData,
        category: original.category,
        isTemplate: original.isTemplate,
        isShared: false, // Copies are private by default
        createdBy: userId,
        metadata: original.metadata,
      })
      .returning();

    res.status(201).json(duplicate);
  } catch (error: any) {
    console.error("Failed to duplicate tool workflow:", error);
    res.status(500).json({
      error: "Failed to duplicate tool workflow",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Execute a tool workflow
 */
router.post("/:id/execute", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get the workflow
    const workflow = await db.query.toolWorkflows.findFirst({
      where: eq(toolWorkflows.id, req.params.id),
    });

    if (!workflow) {
      return res.status(404).json({ error: "Tool workflow not found" });
    }

    // Update execution tracking
    await db
      .update(toolWorkflows)
      .set({
        lastExecutedAt: new Date(),
        executionCount: (workflow.executionCount || 0) + 1,
      })
      .where(eq(toolWorkflows.id, req.params.id));

    // TODO: Implement actual workflow execution logic
    // This would involve:
    // 1. Parsing the workflow nodes and edges
    // 2. Executing tools in order based on the graph
    // 3. Passing outputs from one tool to the next
    // 4. Handling errors and retries
    // 5. Logging execution progress

    res.json({
      success: true,
      message: "Workflow execution started",
      workflowId: workflow.id,
      // In a real implementation, this would return an execution ID
    });
  } catch (error: any) {
    console.error("Failed to execute tool workflow:", error);
    res.status(500).json({
      error: "Failed to execute tool workflow",
      details: error?.message || "Internal server error"
    });
  }
});

/**
 * Get available tools for workflow builder
 */
router.get("/meta/available-tools", async (_req, res) => {
  try {
    const tools = await db.query.securityTools.findMany({
      where: eq(securityTools.status, "available"),
      orderBy: [desc(securityTools.name)],
    });

    res.json({ tools });
  } catch (error: any) {
    console.error("Failed to get available tools:", error);
    res.status(500).json({
      error: "Failed to get available tools",
      details: error?.message || "Internal server error"
    });
  }
});

export default router;
