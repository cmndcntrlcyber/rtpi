import { Router } from "express";
import { db } from "../../db";
import { operations, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { z } from "zod";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// FIX BUG #1: Validation schema for operation data
// Validates and transforms date strings to Date objects safely
const operationSchema = z.object({
  name: z.string().min(1, "Operation name is required"),
  description: z.string().optional(),
  status: z.enum(["planning", "active", "paused", "completed", "cancelled"]),
  startDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  objectives: z.string().optional(),
  scope: z.string().optional(),
  metadata: z.any().optional(),
});

// GET /api/v1/operations - List all operations
router.get("/", async (_req, res) => {
  try {
    const allOperations = await db
      .select({
        id: operations.id,
        name: operations.name,
        description: operations.description,
        status: operations.status,
        objectives: operations.objectives,
        scope: operations.scope,
        startDate: operations.startDate,
        endDate: operations.endDate,
        ownerId: operations.ownerId,
        teamMembers: operations.teamMembers,
        metadata: operations.metadata,
        createdAt: operations.createdAt,
        updatedAt: operations.updatedAt,
        createdBy: users.username,
      })
      .from(operations)
      .leftJoin(users, eq(operations.ownerId, users.id));

    res.json({ operations: allOperations });
  } catch (error) {
    console.error("List operations error:", error);
    res.status(500).json({ error: "Failed to list operations" });
  }
});

// GET /api/v1/operations/:id - Get operation details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select({
        id: operations.id,
        name: operations.name,
        description: operations.description,
        status: operations.status,
        objectives: operations.objectives,
        scope: operations.scope,
        startDate: operations.startDate,
        endDate: operations.endDate,
        ownerId: operations.ownerId,
        teamMembers: operations.teamMembers,
        metadata: operations.metadata,
        createdAt: operations.createdAt,
        updatedAt: operations.updatedAt,
        createdBy: users.username,
      })
      .from(operations)
      .leftJoin(users, eq(operations.ownerId, users.id))
      .where(eq(operations.id, id))
      .limit(1);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    res.json({ operation: result[0] });
  } catch (error) {
    console.error("Get operation error:", error);
    res.status(500).json({ error: "Failed to get operation" });
  }
});

// POST /api/v1/operations - Create new operation
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    // FIX BUG #1: Validate and parse input with proper date transformation
    const validated = operationSchema.parse(req.body);

    const operation = await db
      .insert(operations)
      .values({
        ...validated,
        ownerId: user.id,
      })
      .returning();

    await logAudit(user.id, "create_operation", "/operations", operation[0].id, true, req);

    res.status(201).json({ operation: operation[0] });
  } catch (error) {
    console.error("Create operation error:", error);
    
    // Better error messages for validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    
    await logAudit(user.id, "create_operation", "/operations", null, false, req);
    res.status(500).json({ error: "Failed to create operation" });
  }
});

// PUT /api/v1/operations/:id - Update operation
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    // FIX BUG #1: Validate and parse input (partial schema for updates)
    const validated = operationSchema.partial().parse(req.body);

    const result = await db
      .update(operations)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(operations.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    await logAudit(user.id, "update_operation", "/operations", id, true, req);

    res.json({ operation: result[0] });
  } catch (error) {
    console.error("Update operation error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    
    await logAudit(user.id, "update_operation", "/operations", id, false, req);
    res.status(500).json({ error: "Failed to update operation" });
  }
});

// DELETE /api/v1/operations/:id - Delete operation
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db.delete(operations).where(eq(operations.id, id));

    await logAudit(user.id, "delete_operation", "/operations", id, true, req);

    res.json({ message: "Operation deleted successfully" });
  } catch (error) {
    console.error("Delete operation error:", error);
    await logAudit(user.id, "delete_operation", "/operations", id, false, req);
    res.status(500).json({ error: "Failed to delete operation" });
  }
});

// POST /api/v1/operations/:id/start - Start operation
router.post("/:id/start", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(operations)
      .set({
        status: "active",
        startDate: new Date(),
      })
      .where(eq(operations.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    await logAudit(user.id, "start_operation", "/operations", id, true, req);

    res.json({ operation: result[0], message: "Operation started" });
  } catch (error) {
    console.error("Start operation error:", error);
    await logAudit(user.id, "start_operation", "/operations", id, false, req);
    res.status(500).json({ error: "Failed to start operation" });
  }
});

// POST /api/v1/operations/:id/complete - Complete operation
router.post("/:id/complete", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(operations)
      .set({
        status: "completed",
        endDate: new Date(),
      })
      .where(eq(operations.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    await logAudit(user.id, "complete_operation", "/operations", id, true, req);

    res.json({ operation: result[0], message: "Operation completed" });
  } catch (error) {
    console.error("Complete operation error:", error);
    await logAudit(user.id, "complete_operation", "/operations", id, false, req);
    res.status(500).json({ error: "Failed to complete operation" });
  }
});

// FIX BUG #2: PATCH /api/v1/operations/:id/status - Quick status update
router.patch("/:id/status", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const user = req.user as any;

  // Validate status
  const validStatuses = ["planning", "active", "paused", "completed", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ 
      error: "Invalid status", 
      validStatuses 
    });
  }

  try {
    // Get current operation to check dates
    const existing = await db
      .select()
      .from(operations)
      .where(eq(operations.id, id))
      .limit(1);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    const updates: any = {
      status,
      updatedAt: new Date(),
    };

    // Auto-set dates based on status transitions
    if (status === "active" && !existing[0].startDate) {
      updates.startDate = new Date();
    }
    
    if (status === "completed" || status === "cancelled") {
      updates.endDate = new Date();
    }

    const result = await db
      .update(operations)
      .set(updates)
      .where(eq(operations.id, id))
      .returning();

    await logAudit(user.id, "update_operation_status", "/operations", id, true, req);

    res.json({ operation: result[0] });
  } catch (error) {
    console.error("Update operation status error:", error);
    await logAudit(user.id, "update_operation_status", "/operations", id, false, req);
    res.status(500).json({ error: "Failed to update operation status" });
  }
});

export default router;
