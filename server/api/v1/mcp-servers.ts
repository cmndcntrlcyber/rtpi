import { Router } from "express";
import { db } from "../../db";
import { mcpServers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { mcpServerManager } from "../../services/mcp-server-manager";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/mcp-servers - List all MCP servers
router.get("/", async (_req, res) => {
  try {
    const allServers = await db.select().from(mcpServers);
    res.json({ servers: allServers });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list MCP servers", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/mcp-servers/:id - Get server details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "MCP server not found" });
    }

    res.json({ server: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get MCP server", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/mcp-servers - Create new MCP server
router.post("/", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const server = await db
      .insert(mcpServers)
      .values(req.body)
      .returning();

    await logAudit(user.id, "create_mcp_server", "/mcp-servers", server[0].id, true, req);

    res.status(201).json({ server: server[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "create_mcp_server", "/mcp-servers", null, false, req);
    res.status(500).json({ error: "Failed to create MCP server", details: error?.message || "Internal server error" });
  }
});

// PUT /api/v1/mcp-servers/:id - Update server
router.put("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(mcpServers)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(mcpServers.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "MCP server not found" });
    }

    await logAudit(user.id, "update_mcp_server", "/mcp-servers", id, true, req);

    res.json({ server: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "update_mcp_server", "/mcp-servers", id, false, req);
    res.status(500).json({ error: "Failed to update MCP server", details: error?.message || "Internal server error" });
  }
});

// DELETE /api/v1/mcp-servers/:id - Delete server
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db.delete(mcpServers).where(eq(mcpServers.id, id));

    await logAudit(user.id, "delete_mcp_server", "/mcp-servers", id, true, req);

    res.json({ message: "MCP server deleted successfully" });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "delete_mcp_server", "/mcp-servers", id, false, req);
    res.status(500).json({ error: "Failed to delete MCP server", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/mcp-servers/:id/start - Start server
router.post("/:id/start", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const success = await mcpServerManager.startServer(id);
    
    if (!success) {
      await logAudit(user.id, "start_mcp_server", "/mcp-servers", id, false, req);
      return res.status(500).json({ error: "Failed to start server", details: error?.message || "Internal server error" });
    }

    const result = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);

    await logAudit(user.id, "start_mcp_server", "/mcp-servers", id, true, req);

    res.json({ server: result[0], message: "Server started" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to start server", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/mcp-servers/:id/stop - Stop server
router.post("/:id/stop", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const success = await mcpServerManager.stopServer(id);
    
    if (!success) {
      await logAudit(user.id, "stop_mcp_server", "/mcp-servers", id, false, req);
      return res.status(500).json({ error: "Failed to stop server", details: error?.message || "Internal server error" });
    }

    const result = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);

    await logAudit(user.id, "stop_mcp_server", "/mcp-servers", id, true, req);

    res.json({ server: result[0], message: "Server stopped" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to stop server", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/mcp-servers/:id/restart - Restart server
router.post("/:id/restart", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const success = await mcpServerManager.restartServer(id);
    
    if (!success) {
      await logAudit(user.id, "restart_mcp_server", "/mcp-servers", id, false, req);
      return res.status(500).json({ error: "Failed to restart server", details: error?.message || "Internal server error" });
    }

    const result = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);

    await logAudit(user.id, "restart_mcp_server", "/mcp-servers", id, true, req);

    res.json({ server: result[0], message: "Server restarted" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to restart server", details: error?.message || "Internal server error" });
  }
});

export default router;
