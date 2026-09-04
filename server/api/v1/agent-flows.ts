/**
 * Agent Flows API
 *
 * Backs the Langflow-style visual agent-workflow canvas on the Agents page.
 * Every endpoint here is ADDITIVE — it reuses the existing workflowTemplates /
 * workflowInstances tables and the dynamicWorkflowOrchestrator. No schema
 * migration, no change to existing routes.
 *
 * Serialization contract (dual-projection):
 *   - The canvas source of truth lives at workflowTemplates.configuration.flowGraph
 *     = { nodes: ReactFlowNode[], edges: ReactFlowEdge[], viewport }.
 *   - On every PATCH we re-project configuration.agents[] / mcpServerIds[] /
 *     requiredCapabilities from the graph so the legacy linear WorkflowBuilder and
 *     the orchestrator (which resolves `agent:<id>` capabilities) keep working.
 *   - Templates created by the linear builder (no flowGraph) are synthesized into a
 *     graph on read, so every existing template opens in the canvas.
 */

import { Router } from "express";
import { db } from "../../db";
import {
  agents,
  mcpServers,
  securityTools,
  toolRegistry,
  workflowTemplates,
  workflowInstances,
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { dynamicWorkflowOrchestrator } from "../../services/dynamic-workflow-orchestrator";

const router = Router();
router.use(ensureAuthenticated);

// ============================================================================
// Pure helpers (graph <-> configuration projection)
// ============================================================================

type FlowNode = {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data?: Record<string, any>;
};
type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  data?: Record<string, any>;
};
type FlowGraph = { nodes: FlowNode[]; edges: FlowEdge[]; viewport?: any };

/**
 * Order agent nodes by a topological longest-path "phase" over sequence edges,
 * tie-broken by x position. Returns the projected configuration.agents[] shape.
 */
function computeAgentOrder(nodes: FlowNode[], edges: FlowEdge[]): { agentId: string; order: number }[] {
  const agentNodes = nodes.filter((n) => n.type === "agentNode" && n.data?.agentId);
  const ids = new Set(agentNodes.map((n) => n.id));
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  agentNodes.forEach((n) => {
    adj.set(n.id, []);
    indeg.set(n.id, 0);
  });
  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target) && e.source !== e.target) {
      adj.get(e.source)!.push(e.target);
      indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
    }
  }
  const phase = new Map<string, number>();
  const queue = agentNodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id);
  queue.forEach((id) => phase.set(id, 0));
  const work = [...queue];
  while (work.length) {
    const u = work.shift()!;
    for (const v of adj.get(u) || []) {
      phase.set(v, Math.max(phase.get(v) ?? 0, (phase.get(u) ?? 0) + 1));
      indeg.set(v, (indeg.get(v) || 0) - 1);
      if ((indeg.get(v) || 0) === 0) work.push(v);
    }
  }
  const ordered = agentNodes.slice().sort((a, b) => {
    const pa = phase.get(a.id) ?? 0;
    const pb = phase.get(b.id) ?? 0;
    if (pa !== pb) return pa - pb;
    return (a.position?.x ?? 0) - (b.position?.x ?? 0);
  });
  return ordered.map((n, i) => ({ agentId: n.data!.agentId as string, order: i }));
}

/**
 * Extract explicit agent→agent handoff edges from the graph. A handoff edge
 * (portType "handoff") means: when the source agent completes, control + its
 * output are handed to the target agent, which the orchestrator then sequences
 * into a later phase. Returns DB-agent-id pairs (not node ids) plus the optional
 * run-condition the canvas attaches to the edge.
 */
function computeHandoffs(
  nodes: FlowNode[],
  edges: FlowEdge[],
): { from: string; to: string; condition: any | null }[] {
  const agentIdByNode = new Map<string, string>();
  for (const n of nodes) {
    if (n.type === "agentNode" && n.data?.agentId) {
      agentIdByNode.set(n.id, n.data.agentId as string);
    }
  }
  const handoffs: { from: string; to: string; condition: any | null }[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.data?.portType !== "handoff") continue;
    const from = agentIdByNode.get(e.source);
    const to = agentIdByNode.get(e.target);
    if (!from || !to || from === to) continue;
    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    handoffs.push({ from, to, condition: e.data?.handoff?.condition ?? null });
  }
  return handoffs;
}

/**
 * Project a canvas flowGraph back into the workflowTemplates.configuration shape
 * consumed by the linear builder + orchestrator. Preserves unrelated config keys.
 */
function projectFlowGraphToConfig(flowGraph: FlowGraph, existingConfig: Record<string, any> = {}) {
  const nodes = flowGraph?.nodes || [];
  const edges = flowGraph?.edges || [];
  const agentsList = computeAgentOrder(nodes, edges);
  const mcpServerIds = Array.from(
    new Set(
      nodes
        .filter((n) => n.type === "mcpServerNode" && n.data?.serverId)
        .map((n) => n.data!.serverId as string),
    ),
  );
  const handoffs = computeHandoffs(nodes, edges);
  return {
    config: {
      ...existingConfig,
      agents: agentsList,
      mcpServerIds,
      handoffs,
      flowGraph,
      maxParallelAgents: existingConfig.maxParallelAgents ?? 1,
      timeoutMs: existingConfig.timeoutMs ?? 3600000,
      retryConfig: existingConfig.retryConfig ?? { maxRetries: 3 },
    },
    agentCount: agentsList.length,
  };
}

/** Build a flowGraph from a legacy configuration.agents[] (no stored flowGraph). */
function synthesizeFlowGraph(config: Record<string, any> = {}): FlowGraph {
  const agentsList = ((config.agents as any[]) || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  agentsList.forEach((a, i) => {
    nodes.push({
      id: `agent-${a.agentId}`,
      type: "agentNode",
      position: { x: 120 + i * 280, y: 160 },
      data: { agentId: a.agentId, order: a.order ?? i },
    });
    if (i > 0) {
      const prev = agentsList[i - 1];
      edges.push({
        id: `seq-${prev.agentId}-${a.agentId}`,
        source: `agent-${prev.agentId}`,
        target: `agent-${a.agentId}`,
        sourceHandle: "seq-out",
        targetHandle: "seq-in",
        type: "default",
        data: { portType: "sequence" },
      });
    }
  });
  ((config.mcpServerIds as string[]) || []).forEach((sid, i) => {
    nodes.push({
      id: `mcp-${sid}`,
      type: "mcpServerNode",
      position: { x: 120 + i * 280, y: 380 },
      data: { serverId: sid },
    });
  });
  return { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } };
}

/** Hydrate agent/mcp nodes with current DB labels so legacy graphs render with names. */
async function hydrateGraph(graph: FlowGraph): Promise<FlowGraph> {
  const agentIds = graph.nodes
    .filter((n) => n.type === "agentNode" && n.data?.agentId)
    .map((n) => n.data!.agentId as string);
  const serverIds = graph.nodes
    .filter((n) => n.type === "mcpServerNode" && n.data?.serverId)
    .map((n) => n.data!.serverId as string);

  const agentRows = agentIds.length
    ? await db.select().from(agents).where(inArray(agents.id, agentIds))
    : [];
  const serverRows = serverIds.length
    ? await db.select().from(mcpServers).where(inArray(mcpServers.id, serverIds))
    : [];
  const agentById = new Map(agentRows.map((a) => [a.id, a]));
  const serverById = new Map(serverRows.map((s) => [s.id, s]));

  const nodes = graph.nodes.map((n) => {
    if (n.type === "agentNode" && n.data?.agentId) {
      const a = agentById.get(n.data.agentId);
      if (a) {
        return {
          ...n,
          data: {
            ...n.data,
            label: n.data.label ?? a.name,
            agentType: a.type,
            status: a.status,
            config: a.config ?? {},
          },
        };
      }
    }
    if (n.type === "mcpServerNode" && n.data?.serverId) {
      const s = serverById.get(n.data.serverId);
      if (s) {
        return { ...n, data: { ...n.data, label: n.data.label ?? s.name, status: s.status } };
      }
    }
    return n;
  });
  return { ...graph, nodes };
}

// ============================================================================
// GET /api/v1/agent-flows/palette  — unified catalog for the canvas palette
// ============================================================================
router.get("/palette", async (_req, res) => {
  try {
    const [agentRows, mcpRows, secTools, regTools] = await Promise.all([
      db.select().from(agents),
      db.select().from(mcpServers),
      db.select().from(securityTools),
      db.select().from(toolRegistry),
    ]);

    await dynamicWorkflowOrchestrator.refreshCapabilityCache();
    const capabilities = dynamicWorkflowOrchestrator.getAllCapabilities();

    // Merge the two tool sources into one palette shape (registry preferred).
    const tools = [
      ...regTools.map((t) => ({
        id: t.id,
        source: "registry" as const,
        name: t.name,
        category: t.category,
        description: t.description,
        command: t.installCommand ?? t.binaryPath ?? null,
      })),
      ...secTools.map((t) => ({
        id: t.id,
        source: "security" as const,
        name: t.name,
        category: t.category,
        description: t.description,
        command: t.command ?? null,
      })),
    ];

    res.json({
      agents: agentRows.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        status: a.status,
        config: a.config ?? {},
      })),
      mcpServers: mcpRows.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        command: s.command,
      })),
      securityTools: tools,
      capabilities,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load palette", details: error?.message });
  }
});

// ============================================================================
// GET /api/v1/agent-flows/capabilities-bulk  — capabilities + the agents per cap
// ============================================================================
router.get("/capabilities-bulk", async (_req, res) => {
  try {
    await dynamicWorkflowOrchestrator.refreshCapabilityCache();
    const capabilities = dynamicWorkflowOrchestrator.getAllCapabilities().map((capability) => ({
      capability,
      agents: dynamicWorkflowOrchestrator.findAllAgentsForCapability(capability).map((a) => ({
        agentId: a.agentId,
        agentName: a.agentName,
        agentType: a.agentType,
        inputTypes: a.inputTypes,
        outputTypes: a.outputTypes,
        priority: a.priority,
        isAvailable: a.isAvailable,
      })),
    }));
    res.json({ capabilities });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load capabilities", details: error?.message });
  }
});

// ============================================================================
// GET /api/v1/agent-flows/instances/:id/state  — live execution state (poll)
// ============================================================================
router.get("/instances/:id/state", async (req, res) => {
  try {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, req.params.id));
    if (!instance) {
      return res.status(404).json({ error: "Workflow instance not found" });
    }
    const status = await dynamicWorkflowOrchestrator.getWorkflowStatus(req.params.id);
    res.json({ ...status, executionGraph: instance.executionGraph ?? { nodes: {}, edges: [] } });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load instance state", details: error?.message });
  }
});

// ============================================================================
// GET /api/v1/agent-flows/instances/:id/stream  — live execution state (SSE)
// ============================================================================
router.get("/instances/:id/stream", async (req, res) => {
  const { id } = req.params;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const TERMINAL = new Set(["completed", "failed", "cancelled"]);
  let closed = false;

  const push = async () => {
    if (closed) return;
    try {
      const status = await dynamicWorkflowOrchestrator.getWorkflowStatus(id);
      res.write(`data: ${JSON.stringify(status)}\n\n`);
      if (TERMINAL.has(status.status)) {
        cleanup();
        res.end();
      }
    } catch {
      cleanup();
      res.end();
    }
  };

  const interval = setInterval(push, 1500);
  // Orchestrator emits the id as a bare string for some events and as an object
  // for others — match either shape against this stream's workflow id.
  const onUpdate = (payload: any) => {
    const wid = typeof payload === "string" ? payload : payload?.workflowId ?? payload?.instanceId;
    if (wid === id) void push();
  };
  const EVENTS = ["workflow_started", "workflow_resumed", "workflow_completed", "workflow_failed", "workflow_cancelled"];
  EVENTS.forEach((evt) => dynamicWorkflowOrchestrator.on(evt, onUpdate));

  function cleanup() {
    if (closed) return;
    closed = true;
    clearInterval(interval);
    EVENTS.forEach((evt) => dynamicWorkflowOrchestrator.off(evt, onUpdate));
  }

  req.on("close", cleanup);
  void push();
});

// ============================================================================
// GET /api/v1/agent-flows/:templateId/graph  — load (or synthesize) the canvas
// ============================================================================
router.get("/:templateId/graph", async (req, res) => {
  try {
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, req.params.templateId));
    if (!template) {
      return res.status(404).json({ error: "Workflow template not found" });
    }
    const config = (template.configuration as Record<string, any>) || {};
    const rawGraph: FlowGraph = config.flowGraph || synthesizeFlowGraph(config);
    const flowGraph = await hydrateGraph(rawGraph);
    res.json({
      templateId: template.id,
      name: template.name,
      flowGraph,
      agents: config.agents || [],
      mcpServerIds: config.mcpServerIds || [],
      synthesized: !config.flowGraph,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load graph", details: error?.message });
  }
});

// ============================================================================
// PATCH /api/v1/agent-flows/:templateId/graph  — save the canvas + re-project
// ============================================================================
router.patch("/:templateId/graph", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;
  const { templateId } = req.params;
  const { flowGraph } = req.body as { flowGraph?: FlowGraph };

  if (!flowGraph || !Array.isArray(flowGraph.nodes) || !Array.isArray(flowGraph.edges)) {
    return res.status(400).json({ error: "flowGraph with nodes[] and edges[] is required" });
  }

  try {
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, templateId));
    if (!template) {
      return res.status(404).json({ error: "Workflow template not found" });
    }

    const existingConfig = (template.configuration as Record<string, any>) || {};
    const { config, agentCount } = projectFlowGraphToConfig(flowGraph, existingConfig);

    // Guard: never silently blank an existing template that had agents.
    const hadAgents = ((existingConfig.agents as any[]) || []).length > 0;
    if (agentCount === 0 && hadAgents) {
      return res.status(400).json({
        error: "Projection produced zero agents; refusing to blank an existing template",
      });
    }

    const requiredCapabilities = (config.agents as any[]).map((a) => `agent:${a.agentId}`);

    const [updated] = await db
      .update(workflowTemplates)
      .set({ configuration: config, requiredCapabilities, updatedAt: new Date() })
      .where(eq(workflowTemplates.id, templateId))
      .returning();

    await logAudit(user.id, "save_agent_flow_graph", `/agent-flows/${templateId}/graph`, templateId, true, req);
    res.json({ template: updated, agentCount });
  } catch (error: any) {
    await logAudit(user.id, "save_agent_flow_graph", `/agent-flows/${templateId}/graph`, templateId, false, req);
    res.status(500).json({ error: "Failed to save graph", details: error?.message });
  }
});

// ============================================================================
// POST /api/v1/agent-flows/:templateId/validate  — dangling-reference check
// ============================================================================
router.post("/:templateId/validate", async (req, res) => {
  try {
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, req.params.templateId));
    if (!template) {
      return res.status(404).json({ error: "Workflow template not found" });
    }
    const config = (template.configuration as Record<string, any>) || {};
    const graph: FlowGraph = (req.body?.flowGraph as FlowGraph) || config.flowGraph || synthesizeFlowGraph(config);

    const agentIds = graph.nodes
      .filter((n) => n.type === "agentNode" && n.data?.agentId)
      .map((n) => ({ nodeId: n.id, agentId: n.data!.agentId as string }));
    const serverIds = graph.nodes
      .filter((n) => n.type === "mcpServerNode" && n.data?.serverId)
      .map((n) => ({ nodeId: n.id, serverId: n.data!.serverId as string }));

    const liveAgents = agentIds.length
      ? await db.select({ id: agents.id, config: agents.config }).from(agents).where(inArray(agents.id, agentIds.map((a) => a.agentId)))
      : [];
    const liveServers = serverIds.length
      ? await db.select({ id: mcpServers.id }).from(mcpServers).where(inArray(mcpServers.id, serverIds.map((s) => s.serverId)))
      : [];
    const allServers = await db.select({ id: mcpServers.id }).from(mcpServers);
    const liveAgentMap = new Map(liveAgents.map((a) => [a.id, a]));
    const liveServerSet = new Set(liveServers.map((s) => s.id));
    const allServerSet = new Set(allServers.map((s) => s.id));

    const issues: { nodeId: string; kind: string; detail: string }[] = [];

    for (const { nodeId, agentId } of agentIds) {
      const a = liveAgentMap.get(agentId);
      if (!a) {
        issues.push({ nodeId, kind: "missing_agent", detail: `Agent ${agentId} no longer exists` });
        continue;
      }
      // Validate the agent's persisted MCP attachments still resolve.
      const cfg = (a.config as Record<string, any>) || {};
      const attached: string[] = [
        ...((cfg.mcpServerIds as string[]) || []),
        ...(((cfg.toolContainers as any[]) || []).map((t) => t?.serverId).filter(Boolean) as string[]),
      ];
      for (const sid of attached) {
        if (!allServerSet.has(sid)) {
          issues.push({
            nodeId,
            kind: "dangling_mcp_attachment",
            detail: `Agent's attached MCP server ${sid} no longer exists`,
          });
        }
      }
    }
    for (const { nodeId, serverId } of serverIds) {
      if (!liveServerSet.has(serverId)) {
        issues.push({ nodeId, kind: "missing_mcp", detail: `MCP server ${serverId} no longer exists` });
      }
    }

    // Handoff edges become real runtime dependencies, so a cycle among them would
    // make the orchestrator throw "Circular dependency". Detect it here (over the
    // agent-node graph) and flag every node on a cycle so it can be fixed first.
    const agentNodeIds = new Set(agentIds.map((a) => a.nodeId));
    const handoffAdj = new Map<string, string[]>();
    agentNodeIds.forEach((id) => handoffAdj.set(id, []));
    for (const e of graph.edges) {
      if (e.data?.portType !== "handoff") continue;
      if (agentNodeIds.has(e.source) && agentNodeIds.has(e.target) && e.source !== e.target) {
        handoffAdj.get(e.source)!.push(e.target);
      }
    }
    const WHITE = 0, GREY = 1, BLACK = 2;
    const color = new Map<string, number>();
    agentNodeIds.forEach((id) => color.set(id, WHITE));
    const onCycle = new Set<string>();
    const stack: string[] = [];
    const dfs = (u: string) => {
      color.set(u, GREY);
      stack.push(u);
      for (const v of handoffAdj.get(u) || []) {
        if (color.get(v) === GREY) {
          // back-edge: mark the cycle slice from v..u plus v itself
          const idx = stack.lastIndexOf(v);
          if (idx >= 0) stack.slice(idx).forEach((id) => onCycle.add(id));
          else onCycle.add(v);
        } else if (color.get(v) === WHITE) {
          dfs(v);
        }
      }
      stack.pop();
      color.set(u, BLACK);
    };
    agentNodeIds.forEach((id) => {
      if (color.get(id) === WHITE) dfs(id);
    });
    for (const nodeId of onCycle) {
      issues.push({ nodeId, kind: "handoff_cycle", detail: "Handoff edges form a cycle" });
    }

    res.json({ valid: issues.length === 0, issues });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to validate graph", details: error?.message });
  }
});

export default router;
