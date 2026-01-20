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
