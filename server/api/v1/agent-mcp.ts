import { Router } from "express";
import { db } from "../../db";
import { agents, mcpServers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { mcpInvoker, MCPInvokerError } from "../../services/agents/mcp-invoker";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// POST /api/v1/agents/:agentId/mcp-call - Call MCP server tool from agent
// v2.9.1 Phase 5: replaced the mock stub with a real JSON-RPC 2.0 invocation
// against the spawned MCP server's stdio (via mcpInvoker).
router.post("/:agentId/mcp-call", ensureRole("admin", "operator"), async (req, res) => {
  const { agentId } = req.params;
  const { toolName, args } = req.body ?? {};
  const user = req.user as any;

  if (typeof toolName !== "string" || !toolName) {
    return res.status(400).json({ error: "toolName is required" });
  }

  try {
    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const config = agent.config as any;
    const mcpServerId = config?.mcpServerId;

    if (!mcpServerId) {
      return res.status(400).json({ error: "Agent has no MCP server configured" });
    }

    const mcpServer = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, mcpServerId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!mcpServer) {
      return res.status(404).json({ error: "MCP server not found" });
    }

    if (mcpServer.status !== "running") {
      return res.status(503).json({
        error: "mcp_not_running",
        retryable: true,
        remediation: `Start the MCP server '${mcpServer.name}' before invoking its tools.`,
      });
    }

    const result = await mcpInvoker.callTool(
      mcpServerId,
      toolName,
      typeof args === "object" && args ? args : {},
    );

    await logAudit(user.id, "agent_mcp_call", "/agents", agentId, true, req);

    res.json({
      success: !result.isError,
      toolName,
      server: { id: mcpServer.id, name: mcpServer.name },
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    await logAudit(user.id, "agent_mcp_call", "/agents", agentId, false, req);
    if (error instanceof MCPInvokerError) {
      const status = error.code === "not_running" ? 503 : error.code === "timeout" ? 504 : 502;
      return res.status(status).json({
        error: "mcp_invocation_failed",
        code: error.code,
        rpcCode: error.rpcCode,
        message: error.message,
      });
    }
    res.status(500).json({
      error: "Failed to execute MCP tool call",
      details: error?.message || "Internal server error",
    });
  }
});

// GET /api/v1/agents/:agentId/mcp-tools - Get available MCP tools for agent
router.get("/:agentId/mcp-tools", async (req, res) => {
  const { agentId } = req.params;

  try {
    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const config = agent.config as any;
    const mcpServerId = config?.mcpServerId;

    if (!mcpServerId) {
      return res.json({ tools: [] });
    }

    const mcpServer = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, mcpServerId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!mcpServer) {
      return res.json({ tools: [] });
    }

    // v2.9.1 Phase 5: ask the live MCP server for its tool list (cached
    // 60s by mcpInvoker). Falls back to an empty list if the server is
    // unreachable so the UI degrades gracefully.
    if (mcpServer.status !== "running") {
      return res.json({ tools: [], server: mcpServer });
    }

    try {
      const tools = await mcpInvoker.listTools(mcpServer.id);
      res.json({ tools, server: mcpServer });
    } catch (err: any) {
      if (err instanceof MCPInvokerError) {
        return res.json({
          tools: [],
          server: mcpServer,
          warning: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get MCP tools", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/agents/mcp-servers/:id/probe - Force a liveness probe right now
// (separate from the 30s background loop)
router.get("/mcp-servers/:id/probe", async (req, res) => {
  const { id } = req.params;
  try {
    const ok = await mcpInvoker.probe(id);
    res.json({ ok, probedAt: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: "Probe failed", details: error?.message });
  }
});

export default router;
