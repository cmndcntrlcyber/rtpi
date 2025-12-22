import { Router } from "express";
import { db } from "../../db";
import { agents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/agents - List all agents
router.get("/", async (_req, res) => {
  try {
    const allAgents = await db.select().from(agents);
    res.json({ agents: allAgents });
  } catch (error) {
    console.error("List agents error:", error);
    res.status(500).json({ error: "Failed to list agents" });
  }
});

// GET /api/v1/agents/:id - Get agent details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json({ agent: result[0] });
  } catch (error) {
    console.error("Get agent error:", error);
    res.status(500).json({ error: "Failed to get agent" });
  }
});

// POST /api/v1/agents - Create new agent
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const agent = await db
      .insert(agents)
      .values(req.body)
      .returning();

    await logAudit(user.id, "create_agent", "/agents", agent[0].id, true, req);

    res.status(201).json({ agent: agent[0] });
  } catch (error) {
    console.error("Create agent error:", error);
    await logAudit(user.id, "create_agent", "/agents", null, false, req);
    res.status(500).json({ error: "Failed to create agent" });
  }
});

// PUT /api/v1/agents/:id - Update agent
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(agents)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    await logAudit(user.id, "update_agent", "/agents", id, true, req);

    res.json({ agent: result[0] });
  } catch (error) {
    console.error("Update agent error:", error);
    await logAudit(user.id, "update_agent", "/agents", id, false, req);
    res.status(500).json({ error: "Failed to update agent" });
  }
});

// DELETE /api/v1/agents/:id - Delete agent
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db.delete(agents).where(eq(agents.id, id));

    await logAudit(user.id, "delete_agent", "/agents", id, true, req);

    res.json({ message: "Agent deleted successfully" });
  } catch (error) {
    console.error("Delete agent error:", error);
    await logAudit(user.id, "delete_agent", "/agents", id, false, req);
    res.status(500).json({ error: "Failed to delete agent" });
  }
});

export default router;
