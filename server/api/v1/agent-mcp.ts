import { Router } from "express";
import { db } from "../../db";
import { agents, mcpServers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { mcpInvoker, MCPInvokerError } from "../../services/agents/mcp-invoker";
import { resolveAgentMcpServerIds } from "../../services/agents/mcp-resolve";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// POST /api/v1/agents/:agentId/mcp-call - Call MCP server tool from agent
// v2.9.1 Phase 5: replaced the mock stub with a real JSON-RPC 2.0 invocation
// against the spawned MCP server's stdio (via mcpInvoker).
// v2.9.3: when the agent has multiple MCP servers attached
// (`config.mcpServerIds`), iterate over them and dispatch to whichever owns
// the requested toolName. The first attached server whose listTools()
// includes the tool wins; ordering matches the operator's selection order.
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

    const serverIds = resolveAgentMcpServerIds(agent.config);
    if (serverIds.length === 0) {
      return res.status(400).json({ error: "Agent has no MCP servers configured" });
    }

    // Hydrate full server rows for everything attached so we can return
    // useful diagnostic info (running state, names) regardless of which one
    // ends up handling the call.
    const attachedServers = await Promise.all(
      serverIds.map((id) =>
        db
          .select()
          .from(mcpServers)
          .where(eq(mcpServers.id, id))
          .limit(1)
          .then((rows) => rows[0]),
      ),
    );
    const liveServers = attachedServers.filter((s): s is NonNullable<typeof s> => Boolean(s));
    const runningServers = liveServers.filter((s) => s.status === "running");

    if (liveServers.length === 0) {
      return res.status(404).json({
        error: "No attached MCP servers exist (rows missing)",
        attached: serverIds,
      });
    }
    if (runningServers.length === 0) {
      return res.status(503).json({
        error: "mcp_not_running",
        retryable: true,
        remediation: `Start one of the attached MCP servers (${liveServers.map((s) => s.name).join(", ")}) before invoking tools.`,
      });
    }

    // Find which running server owns the tool. listTools is cached per
    // server (60s TTL inside mcpInvoker) so this loop stays cheap on
    // repeated calls.
    let targetServer: typeof runningServers[number] | null = null;
    for (const candidate of runningServers) {
      try {
        const tools = await mcpInvoker.listTools(candidate.id);
        if (tools.some((t) => t.name === toolName)) {
          targetServer = candidate;
          break;
        }
      } catch {
        // Skip — server might have crashed mid-loop; try the next one.
      }
    }

    if (!targetServer) {
      return res.status(404).json({
        error: `Tool '${toolName}' not found on any attached MCP server`,
        servers: runningServers.map((s) => ({ id: s.id, name: s.name })),
      });
    }

    const result = await mcpInvoker.callTool(
      targetServer.id,
      toolName,
      typeof args === "object" && args ? args : {},
    );

    await logAudit(user.id, "agent_mcp_call", "/agents", agentId, true, req);

    res.json({
      success: !result.isError,
      toolName,
      server: { id: targetServer.id, name: targetServer.name },
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
// v2.9.3: aggregates listTools() across every attached MCP server
// (`config.mcpServerIds`). Each tool object is tagged with `_serverId` and
// `_serverName` so the UI / agent runtime can show which server provides it.
// Response also includes a `servers: [{id, name, status, toolCount, warning?}]`
// array so the operator can see at a glance which attachments contributed.
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

    const serverIds = resolveAgentMcpServerIds(agent.config);
    if (serverIds.length === 0) {
      return res.json({ tools: [], servers: [] });
    }

    type ServerSummary = {
      id: string;
      name: string;
      status: string;
      toolCount: number;
      warning?: { code: string; message: string };
    };
    const aggregatedTools: Array<Record<string, unknown>> = [];
    const serverSummaries: ServerSummary[] = [];

    for (const id of serverIds) {
      const server = await db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.id, id))
        .limit(1)
        .then((rows) => rows[0]);
      if (!server) {
        // Attached id no longer exists in DB — surface in summary so the
        // operator can clean up dangling references.
        serverSummaries.push({
          id,
          name: "(missing)",
          status: "missing",
          toolCount: 0,
          warning: { code: "missing", message: "MCP server row not found in DB" },
        });
        continue;
      }
      if (server.status !== "running") {
        serverSummaries.push({
          id: server.id,
          name: server.name,
          status: server.status,
          toolCount: 0,
        });
        continue;
      }
      try {
        const tools = await mcpInvoker.listTools(server.id);
        for (const tool of tools) {
          aggregatedTools.push({
            ...(tool as Record<string, unknown>),
            _serverId: server.id,
            _serverName: server.name,
          });
        }
        serverSummaries.push({
          id: server.id,
          name: server.name,
          status: server.status,
          toolCount: tools.length,
        });
      } catch (err: any) {
        if (err instanceof MCPInvokerError) {
          serverSummaries.push({
            id: server.id,
            name: server.name,
            status: server.status,
            toolCount: 0,
            warning: { code: err.code, message: err.message },
          });
          continue;
        }
        throw err;
      }
    }

    res.json({ tools: aggregatedTools, servers: serverSummaries });
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
