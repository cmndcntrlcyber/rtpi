import { Router } from "express";
import { db } from "../../db";
import { agents, agentCapabilities, workflowTemplates, workflowInstances } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/agents - List all agents
router.get("/", async (_req, res) => {
  try {
    const allAgents = await db.select().from(agents);
    res.json({ agents: allAgents });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list agents", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// Workflow Template Routes (must be defined before /:id to avoid being caught)
// ============================================================================

// GET /api/v1/agents/workflow-templates - List all workflow templates
router.get("/workflow-templates", async (req, res) => {
  try {
    const templates = await db
      .select()
      .from(workflowTemplates)
      .orderBy(workflowTemplates.displayOrder);

    res.json({ templates });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list workflow templates", details: error?.message });
  }
});

// PUT /api/v1/agents/workflow-templates/reorder - Bulk update display order (must be before :id)
router.put("/workflow-templates/reorder", ensureRole("admin", "operator"), async (req, res) => {
  const { orderedIds } = req.body;
  const user = req.user as any;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "orderedIds must be an array" });
  }

  try {
    // Update each template's displayOrder based on its position in the array
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(workflowTemplates)
        .set({ displayOrder: i, updatedAt: new Date() })
        .where(eq(workflowTemplates.id, orderedIds[i]));
    }

    await logAudit(user.id, "reorder_workflow_templates", "/agents/workflow-templates/reorder", null, true, req);

    res.json({ success: true, message: "Workflow templates reordered successfully" });
  } catch (error: any) {
    await logAudit(user.id, "reorder_workflow_templates", "/agents/workflow-templates/reorder", null, false, req);
    res.status(500).json({ error: "Failed to reorder workflow templates", details: error?.message });
  }
});

// PUT /api/v1/agents/workflow-templates/:id - Update a workflow template
router.put("/workflow-templates/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const { name, description, displayOrder, isActive, configuration } = req.body;
  const user = req.user as any;

  try {
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;
    if (isActive !== undefined) updates.isActive = isActive;
    if (configuration !== undefined) updates.configuration = configuration;

    const updated = await db
      .update(workflowTemplates)
      .set(updates)
      .where(eq(workflowTemplates.id, id))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: "Workflow template not found" });
    }

    await logAudit(user.id, "update_workflow_template", `/agents/workflow-templates/${id}`, id, true, req);

    res.json({ template: updated[0] });
  } catch (error: any) {
    await logAudit(user.id, "update_workflow_template", `/agents/workflow-templates/${id}`, id, false, req);
    res.status(500).json({ error: "Failed to update workflow template", details: error?.message });
  }
});

// DELETE /api/v1/agents/workflow-templates/:id - Delete a workflow template
router.delete("/workflow-templates/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const deleted = await db
      .delete(workflowTemplates)
      .where(eq(workflowTemplates.id, id))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: "Workflow template not found" });
    }

    await logAudit(user.id, "delete_workflow_template", `/agents/workflow-templates/${id}`, id, true, req);

    res.json({ success: true, message: "Workflow template deleted successfully" });
  } catch (error: any) {
    await logAudit(user.id, "delete_workflow_template", `/agents/workflow-templates/${id}`, id, false, req);
    res.status(500).json({ error: "Failed to delete workflow template", details: error?.message });
  }
});

// POST /api/v1/agents/workflow-templates - Create a workflow template
router.post("/workflow-templates", ensureRole("admin", "operator"), async (req, res) => {
  const { name, description, agents: agentsList, mcpServerIds, isActive } = req.body;
  const user = req.user as any;

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    // Extract required capabilities from agents
    const requiredCapabilities = agentsList?.map((a: any) => `agent:${a.agentId}`) || [];

    const template = await db
      .insert(workflowTemplates)
      .values({
        name,
        description: description || "",
        requiredCapabilities,
        optionalCapabilities: [],
        configuration: {
          agents: agentsList || [],
          mcpServerIds: mcpServerIds || [],
          maxParallelAgents: 1,
          timeoutMs: 3600000, // 1 hour default
          retryConfig: { maxRetries: 3 },
        },
        isActive: isActive !== false,
      })
      .returning();

    await logAudit(user.id, "create_workflow_template", "/agents/workflow-templates", template[0].id, true, req);

    res.status(201).json({ template: template[0] });
  } catch (error: any) {
    await logAudit(user.id, "create_workflow_template", "/agents/workflow-templates", null, false, req);
    res.status(500).json({ error: "Failed to create workflow template", details: error?.message });
  }
});

// ============================================================================
// Agent CRUD Routes (/:id routes must come after specific routes)
// ============================================================================

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
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get agent", details: error?.message || "Internal server error" });
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
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "create_agent", "/agents", null, false, req);
    res.status(500).json({ error: "Failed to create agent", details: error?.message || "Internal server error" });
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
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "update_agent", "/agents", id, false, req);
    res.status(500).json({ error: "Failed to update agent", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/agents/generate-prompt - Generate agent system prompt using AI
router.post("/generate-prompt", ensureRole("admin", "operator"), async (req, res) => {
  const { description, toolContainers, agentType } = req.body;
  const user = req.user as any;

  if (!description) {
    return res.status(400).json({ error: "description is required" });
  }

  try {
    const { generateAgentPrompt } = await import("../../services/agent-prompt-generator");

    const result = await generateAgentPrompt({
      description,
      toolContainers: toolContainers || [],
      agentType: agentType || "anthropic",
    });

    await logAudit(user.id, "generate_agent_prompt", "/agents/generate-prompt", null, true, req);

    res.json({
      prompt: result.prompt,
      generatedBy: result.generatedBy,
    });
  } catch (error: any) {
    await logAudit(user.id, "generate_agent_prompt", "/agents/generate-prompt", null, false, req);
    res.status(500).json({ error: "Failed to generate prompt", details: error?.message });
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
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "delete_agent", "/agents", id, false, req);
    res.status(500).json({ error: "Failed to delete agent", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// Agent Capabilities Routes
// ============================================================================

// GET /api/v1/agents/:agentId/capabilities - Get agent capabilities
router.get("/:agentId/capabilities", async (req, res) => {
  const { agentId } = req.params;

  try {
    const capabilities = await db
      .select()
      .from(agentCapabilities)
      .where(eq(agentCapabilities.agentId, agentId));

    res.json({ capabilities });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get capabilities", details: error?.message });
  }
});

// POST /api/v1/agents/:agentId/capabilities - Add capability to agent
router.post("/:agentId/capabilities", ensureRole("admin", "operator"), async (req, res) => {
  const { agentId } = req.params;
  const user = req.user as any;

  try {
    const capability = await db
      .insert(agentCapabilities)
      .values({ ...req.body, agentId })
      .returning();

    await logAudit(user.id, "add_agent_capability", "/agents/capabilities", agentId, true, req);

    res.status(201).json({ capability: capability[0] });
  } catch (error: any) {
    await logAudit(user.id, "add_agent_capability", "/agents/capabilities", agentId, false, req);
    res.status(500).json({ error: "Failed to add capability", details: error?.message });
  }
});

// ============================================================================
// Agent-MCP Connector Routes
// ============================================================================

// POST /api/v1/agents/:agentId/mcp/attach - Attach agent to MCP server
router.post("/:agentId/mcp/attach", ensureRole("admin", "operator"), async (req, res) => {
  const { agentId } = req.params;
  const { mcpServerId, priority, enabledTools } = req.body;
  const user = req.user as any;

  if (!mcpServerId) {
    return res.status(400).json({ error: "mcpServerId is required" });
  }

  try {
    const { agentMCPConnector } = await import("../../services/agent-mcp-connector");

    const success = await agentMCPConnector.attachAgentToMCP(agentId, mcpServerId, {
      priority,
      enabledTools,
    });

    if (!success) {
      return res.status(400).json({ error: "Failed to attach agent to MCP server" });
    }

    await logAudit(user.id, "attach_agent_mcp", "/agents/mcp/attach", agentId, true, req);

    res.json({ message: "Agent attached to MCP server", agentId, mcpServerId });
  } catch (error: any) {
    await logAudit(user.id, "attach_agent_mcp", "/agents/mcp/attach", agentId, false, req);
    res.status(500).json({ error: "Failed to attach agent", details: error?.message });
  }
});

// DELETE /api/v1/agents/:agentId/mcp/:mcpServerId - Detach agent from MCP server
router.delete("/:agentId/mcp/:mcpServerId", ensureRole("admin", "operator"), async (req, res) => {
  const { agentId, mcpServerId } = req.params;
  const user = req.user as any;

  try {
    const { agentMCPConnector } = await import("../../services/agent-mcp-connector");

    const success = await agentMCPConnector.detachAgentFromMCP(agentId, mcpServerId);

    if (!success) {
      return res.status(400).json({ error: "Agent was not attached to this MCP server" });
    }

    await logAudit(user.id, "detach_agent_mcp", "/agents/mcp/detach", agentId, true, req);

    res.json({ message: "Agent detached from MCP server" });
  } catch (error: any) {
    await logAudit(user.id, "detach_agent_mcp", "/agents/mcp/detach", agentId, false, req);
    res.status(500).json({ error: "Failed to detach agent", details: error?.message });
  }
});

// GET /api/v1/agents/:agentId/mcp/tools - Get all tools available to an agent
router.get("/:agentId/mcp/tools", async (req, res) => {
  const { agentId } = req.params;

  try {
    const { agentMCPConnector } = await import("../../services/agent-mcp-connector");

    const result = await agentMCPConnector.getAgentTools(agentId);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get agent tools", details: error?.message });
  }
});

// GET /api/v1/agents/:agentId/mcp/documentation - Get tool documentation for an agent
router.get("/:agentId/mcp/documentation", async (req, res) => {
  const { agentId } = req.params;

  try {
    const { agentMCPConnector } = await import("../../services/agent-mcp-connector");

    const docs = await agentMCPConnector.getAgentToolDocumentation(agentId);

    res.json({ documentation: docs });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get documentation", details: error?.message });
  }
});

// GET /api/v1/agents/:agentId/mcp/usage - Get complete Usage.md for an agent
router.get("/:agentId/mcp/usage", async (req, res) => {
  const { agentId } = req.params;

  try {
    const { agentMCPConnector } = await import("../../services/agent-mcp-connector");

    const usageDoc = await agentMCPConnector.generateAgentUsageDocument(agentId);

    res.type("text/markdown").send(usageDoc);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate usage document", details: error?.message });
  }
});

// GET /api/v1/agents/mcp/discover - Trigger MCP server discovery
router.get("/mcp/discover", async (_req, res) => {
  try {
    const { agentMCPConnector } = await import("../../services/agent-mcp-connector");

    await agentMCPConnector.discoverAllServerCapabilities();
    const status = agentMCPConnector.getStatus();

    res.json({
      message: "Discovery complete",
      ...status,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to run discovery", details: error?.message });
  }
});

// GET /api/v1/agents/mcp/servers/:serverId/capabilities - Get MCP server capabilities
router.get("/mcp/servers/:serverId/capabilities", async (req, res) => {
  const { serverId } = req.params;

  try {
    const { agentMCPConnector } = await import("../../services/agent-mcp-connector");

    const capabilities = await agentMCPConnector.getServerCapabilities(serverId);

    if (!capabilities) {
      return res.status(404).json({ error: "Server not found or no capabilities discovered" });
    }

    res.json({ capabilities });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get server capabilities", details: error?.message });
  }
});

// GET /api/v1/agents/mcp/servers/:serverId/documentation - Get tool documentation for an MCP server
router.get("/mcp/servers/:serverId/documentation", async (req, res) => {
  const { serverId } = req.params;

  try {
    const { agentMCPConnector } = await import("../../services/agent-mcp-connector");

    const docs = await agentMCPConnector.getServerToolDocumentation(serverId);

    res.json({ documentation: docs });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get server documentation", details: error?.message });
  }
});

// GET /api/v1/agents/mcp/status - Get MCP connector service status
router.get("/mcp/status", async (_req, res) => {
  try {
    const { agentMCPConnector } = await import("../../services/agent-mcp-connector");

    const status = agentMCPConnector.getStatus();

    res.json({ status });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get MCP status", details: error?.message });
  }
});

// ============================================================================
// Autonomous Agent Trigger Routes
// ============================================================================

// POST /api/v1/agents/surface-assessment/trigger - Manually trigger Surface Assessment Agent
router.post("/surface-assessment/trigger", ensureRole("admin", "operator"), async (req, res) => {
  const { operationId } = req.body;
  const user = req.user as any;

  if (!operationId) {
    return res.status(400).json({ error: "operationId is required" });
  }

  try {
    const { surfaceAssessmentAgent } = await import("../../services/agents/surface-assessment-agent");

    // Initialize if needed
    if (!surfaceAssessmentAgent.getStatus().agentId) {
      await surfaceAssessmentAgent.initialize();
    }

    // Trigger async - don't wait for completion
    surfaceAssessmentAgent.processOperation(operationId, user.id).catch((err: Error) => {
      console.error("Surface Assessment Agent failed:", err);
    });

    await logAudit(user.id, "trigger_surface_assessment", "/agents/surface-assessment/trigger", operationId, true, req);

    res.json({ message: "Surface Assessment triggered", operationId });
  } catch (error: any) {
    await logAudit(user.id, "trigger_surface_assessment", "/agents/surface-assessment/trigger", null, false, req);
    res.status(500).json({ error: "Failed to trigger Surface Assessment", details: error?.message });
  }
});

// GET /api/v1/agents/surface-assessment/status - Get Surface Assessment Agent status
router.get("/surface-assessment/status", async (_req, res) => {
  try {
    const { surfaceAssessmentAgent } = await import("../../services/agents/surface-assessment-agent");
    const status = surfaceAssessmentAgent.getStatus();
    res.json({ status });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get status", details: error?.message });
  }
});

// POST /api/v1/agents/web-hacker/trigger - Manually trigger Web Hacker Agent
router.post("/web-hacker/trigger", ensureRole("admin", "operator"), async (req, res) => {
  const { operationId } = req.body;
  const user = req.user as any;

  if (!operationId) {
    return res.status(400).json({ error: "operationId is required" });
  }

  try {
    const { webHackerAgent } = await import("../../services/agents/web-hacker-agent");

    // Initialize if needed
    if (!webHackerAgent.getStatus().agentId) {
      await webHackerAgent.initialize();
    }

    // Trigger async - don't wait for completion
    webHackerAgent.processOperation(operationId, user.id).catch((err: Error) => {
      console.error("Web Hacker Agent failed:", err);
    });

    await logAudit(user.id, "trigger_web_hacker", "/agents/web-hacker/trigger", operationId, true, req);

    res.json({ message: "Web Hacker Agent triggered", operationId });
  } catch (error: any) {
    await logAudit(user.id, "trigger_web_hacker", "/agents/web-hacker/trigger", null, false, req);
    res.status(500).json({ error: "Failed to trigger Web Hacker Agent", details: error?.message });
  }
});

// GET /api/v1/agents/web-hacker/status - Get Web Hacker Agent status
router.get("/web-hacker/status", async (_req, res) => {
  try {
    const { webHackerAgent } = await import("../../services/agents/web-hacker-agent");
    const status = webHackerAgent.getStatus();
    res.json({ status });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get status", details: error?.message });
  }
});

// POST /api/v1/agents/tool-connector/poll - Manually trigger Tool Connector poll
router.post("/tool-connector/poll", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const { toolConnectorAgent } = await import("../../services/agents/tool-connector-agent");

    const tools = await toolConnectorAgent.poll();

    await logAudit(user.id, "trigger_tool_connector_poll", "/agents/tool-connector/poll", null, true, req);

    res.json({ message: "Tool registry updated", toolsFound: tools.length, tools });
  } catch (error: any) {
    await logAudit(user.id, "trigger_tool_connector_poll", "/agents/tool-connector/poll", null, false, req);
    res.status(500).json({ error: "Failed to poll tools", details: error?.message });
  }
});

// GET /api/v1/agents/tool-connector/status - Get Tool Connector Agent status
router.get("/tool-connector/status", async (_req, res) => {
  try {
    const { toolConnectorAgent } = await import("../../services/agents/tool-connector-agent");
    const status = toolConnectorAgent.getStatus();
    res.json({ status });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get status", details: error?.message });
  }
});

// ============================================================================
// Workflow Management Routes
// ============================================================================

// GET /api/v1/agents/workflows - List workflow templates
router.get("/workflows", async (_req, res) => {
  try {
    const templates = await db.select().from(workflowTemplates);
    res.json({ templates });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list workflows", details: error?.message });
  }
});

// GET /api/v1/agents/workflows/instances - List workflow instances
router.get("/workflows/instances", async (req, res) => {
  const { operationId, status } = req.query;

  try {
    let query = db.select().from(workflowInstances);

    if (operationId && typeof operationId === "string") {
      query = query.where(eq(workflowInstances.operationId, operationId)) as typeof query;
    }

    if (status && typeof status === "string") {
      query = query.where(eq(workflowInstances.status, status)) as typeof query;
    }

    const instances = await query;
    res.json({ instances });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list workflow instances", details: error?.message });
  }
});

// GET /api/v1/agents/workflows/:workflowId/status - Get workflow execution status
router.get("/workflows/:workflowId/status", async (req, res) => {
  const { workflowId } = req.params;

  try {
    const { dynamicWorkflowOrchestrator } = await import("../../services/dynamic-workflow-orchestrator");
    const status = await dynamicWorkflowOrchestrator.getWorkflowStatus(workflowId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get workflow status", details: error?.message });
  }
});

// POST /api/v1/agents/workflows/execute - Execute a workflow
router.post("/workflows/execute", ensureRole("admin", "operator"), async (req, res) => {
  const { templateId, operationId, context } = req.body;
  const user = req.user as any;

  if (!templateId || !operationId) {
    return res.status(400).json({ error: "templateId and operationId are required" });
  }

  try {
    const { dynamicWorkflowOrchestrator } = await import("../../services/dynamic-workflow-orchestrator");

    const workflowId = await dynamicWorkflowOrchestrator.buildWorkflow(templateId, operationId, {
      ...context,
      userId: user.id,
    });

    // Execute async
    dynamicWorkflowOrchestrator.executeWorkflow(workflowId).catch((err: Error) => {
      console.error("Workflow execution failed:", err);
    });

    await logAudit(user.id, "execute_workflow", "/agents/workflows/execute", workflowId, true, req);

    res.json({ workflowId, message: "Workflow started" });
  } catch (error: any) {
    await logAudit(user.id, "execute_workflow", "/agents/workflows/execute", null, false, req);
    res.status(500).json({ error: "Failed to execute workflow", details: error?.message });
  }
});

// POST /api/v1/agents/workflows/trigger-by-name - Trigger workflow by template name
router.post("/workflows/trigger-by-name", ensureRole("admin", "operator"), async (req, res) => {
  const { templateName, operationId, context } = req.body;
  const user = req.user as any;

  if (!templateName || !operationId) {
    return res.status(400).json({ error: "templateName and operationId are required" });
  }

  try {
    const { triggerWorkflowByName } = await import("../../services/workflow-event-handlers");

    const workflowId = await triggerWorkflowByName(templateName, operationId, user.id, context || {});

    if (!workflowId) {
      return res.status(404).json({ error: `Workflow template "${templateName}" not found` });
    }

    await logAudit(user.id, "trigger_workflow_by_name", "/agents/workflows/trigger-by-name", workflowId, true, req);

    res.json({ workflowId, message: "Workflow triggered" });
  } catch (error: any) {
    await logAudit(user.id, "trigger_workflow_by_name", "/agents/workflows/trigger-by-name", null, false, req);
    res.status(500).json({ error: "Failed to trigger workflow", details: error?.message });
  }
});

// ============================================================================
// Agent System Management Routes
// ============================================================================

// POST /api/v1/agents/system/initialize - Initialize the agent system
router.post("/system/initialize", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const { initializeAgentSystem } = await import("../../services/workflow-event-handlers");

    await initializeAgentSystem();

    await logAudit(user.id, "initialize_agent_system", "/agents/system/initialize", null, true, req);

    res.json({ message: "Agent system initialized" });
  } catch (error: any) {
    await logAudit(user.id, "initialize_agent_system", "/agents/system/initialize", null, false, req);
    res.status(500).json({ error: "Failed to initialize agent system", details: error?.message });
  }
});

// POST /api/v1/agents/system/shutdown - Shutdown the agent system
router.post("/system/shutdown", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const { shutdownAgentSystem } = await import("../../services/workflow-event-handlers");

    await shutdownAgentSystem();

    await logAudit(user.id, "shutdown_agent_system", "/agents/system/shutdown", null, true, req);

    res.json({ message: "Agent system shut down" });
  } catch (error: any) {
    await logAudit(user.id, "shutdown_agent_system", "/agents/system/shutdown", null, false, req);
    res.status(500).json({ error: "Failed to shutdown agent system", details: error?.message });
  }
});

// GET /api/v1/agents/system/status - Get agent system status
router.get("/system/status", async (_req, res) => {
  try {
    const { workflowEventHandlers } = await import("../../services/workflow-event-handlers");

    const isInitialized = workflowEventHandlers.isInitialized();
    const config = workflowEventHandlers.getConfig();

    // Get individual agent statuses
    let surfaceAssessmentStatus = null;
    let webHackerStatus = null;
    let toolConnectorStatus = null;

    try {
      const { surfaceAssessmentAgent } = await import("../../services/agents/surface-assessment-agent");
      surfaceAssessmentStatus = surfaceAssessmentAgent.getStatus();
    } catch (e) {
      // Agent not loaded
    }

    try {
      const { webHackerAgent } = await import("../../services/agents/web-hacker-agent");
      webHackerStatus = webHackerAgent.getStatus();
    } catch (e) {
      // Agent not loaded
    }

    try {
      const { toolConnectorAgent } = await import("../../services/agents/tool-connector-agent");
      toolConnectorStatus = toolConnectorAgent.getStatus();
    } catch (e) {
      // Agent not loaded
    }

    res.json({
      isInitialized,
      config,
      agents: {
        surfaceAssessment: surfaceAssessmentStatus,
        webHacker: webHackerStatus,
        toolConnector: toolConnectorStatus,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get system status", details: error?.message });
  }
});

// GET /api/v1/agents/capabilities - Get all available capabilities across agents
router.get("/capabilities", async (_req, res) => {
  try {
    const { dynamicWorkflowOrchestrator } = await import("../../services/dynamic-workflow-orchestrator");

    // Refresh capability cache
    await dynamicWorkflowOrchestrator.refreshCapabilityCache();

    // Get all unique capabilities
    const capabilities = Array.from(dynamicWorkflowOrchestrator["capabilityCache"].keys());

    res.json({ capabilities });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get capabilities", details: error?.message });
  }
});

export default router;
