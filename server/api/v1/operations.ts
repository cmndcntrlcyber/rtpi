import { Router } from "express";
import { db } from "../../db";
import { operations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/operations - List all operations
router.get("/", async (req, res) => {
  try {
    const allOperations = await db.select().from(operations);
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
      .select()
      .from(operations)
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
    const operation = await db
      .insert(operations)
      .values({
        ...req.body,
        ownerId: user.id,
      })
      .returning();

    await logAudit(user.id, "create_operation", "/operations", operation[0].id, true, req);

    res.status(201).json({ operation: operation[0] });
  } catch (error) {
    console.error("Create operation error:", error);
    await logAudit(user.id, "create_operation", "/operations", null, false, req);
    res.status(500).json({ error: "Failed to create operation" });
  }
});

// PUT /api/v1/operations/:id - Update operation
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(operations)
      .set({
        ...req.body,
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

export default router;
