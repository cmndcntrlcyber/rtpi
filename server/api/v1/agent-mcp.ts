import { Router } from "express";
import { db } from "../../db";
import { agents, mcpServers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// POST /api/v1/agents/:agentId/mcp-call - Call MCP server tool from agent
router.post("/:agentId/mcp-call", ensureRole("admin", "operator"), async (req, res) => {
  const { agentId } = req.params;
  const { toolName } = req.body;
  const user = req.user as any;

  try {
    // Get agent configuration
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

    // Get MCP server configuration
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
      return res.status(400).json({ error: "MCP server is not running" });
    }

    // TODO: Actual MCP tool execution would go here
    // For now, return mock response
    const mockResponse = {
      success: true,
      toolName,
      result: `Mock result from ${toolName} via ${mcpServer.name}`,
      timestamp: new Date().toISOString(),
    };

    await logAudit(user.id, "agent_mcp_call", "/agents", agentId, true, req);

    res.json(mockResponse);
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "agent_mcp_call", "/agents", agentId, false, req);
    res.status(500).json({ error: "Failed to execute MCP tool call", details: error?.message || "Internal server error" });
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

    // Return Tavily tools if this is a Tavily server
    if (mcpServer.command.includes("tavily")) {
      const tools = [
        {
          name: "tavily-search",
          description: "Powerful web search with customizable parameters",
          category: "search",
        },
        {
          name: "tavily-extract",
          description: "Extract content from specified URLs",
          category: "extraction",
        },
        {
          name: "tavily-crawl",
          description: "Structured web crawl starting from a base URL",
          category: "crawl",
        },
        {
          name: "tavily-map",
          description: "Create structured map of website URLs",
          category: "mapping",
        },
      ];

      res.json({ tools, server: mcpServer });
    } else {
      // Other MCP servers would list their tools here
      res.json({ tools: [], server: mcpServer });
    }
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get MCP tools", details: error?.message || "Internal server error" });
  }
});

export default router;
