import { Router } from "express";
import { db } from "../../db";
import { agentWorkflows, workflowTasks, workflowLogs } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { agentWorkflowOrchestrator } from "../../services/agent-workflow-orchestrator";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

/**
 * POST /api/v1/agent-workflows/start
 * Start a new agent workflow (penetration test)
 */
router.post("/start", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;
  const { targetId, workflowType, operationId } = req.body;

  if (!targetId) {
    return res.status(400).json({ error: "targetId is required" });
  }

  try {
    let workflow;

    // Currently only support penetration_test workflow
    if (!workflowType || workflowType === "penetration_test") {
      workflow = await agentWorkflowOrchestrator.startPenetrationTestWorkflow(
        targetId,
        user.id,
        operationId
      );
    } else {
      return res.status(400).json({
        error: `Unsupported workflow type: ${workflowType}`,
      });
    }

    await logAudit(
      user.id,
      "start_agent_workflow",
      "/agent-workflows",
      workflow.workflow.id,
      true,
      req
    );

    res.status(201).json({
      success: true,
      workflow: workflow.workflow,
      tasks: workflow.tasks,
    });
  } catch (error) {
    console.error("Start workflow error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    await logAudit(
      user.id,
      "start_agent_workflow",
      "/agent-workflows",
      null,
      false,
      req
    );

    res.status(500).json({
      error: "Failed to start workflow",
      details: errorMsg,
    });
  }
});

/**
 * GET /api/v1/agent-workflows
 * List all workflows
 */
router.get("/", async (req, res) => {
  try {
    const { status, targetId, limit = 50 } = req.query;

    // Build query with filters
    let workflows;
    const conditions = [];
    
    if (status) {
      conditions.push(eq(agentWorkflows.status, status as any));
    }
    
    if (targetId) {
      conditions.push(eq(agentWorkflows.targetId, targetId as string));
    }

    if (conditions.length > 0) {
      workflows = await db
        .select()
        .from(agentWorkflows)
        .where(and(...conditions))
        .orderBy(desc(agentWorkflows.createdAt))
        .limit(Number(limit));
    } else {
      workflows = await db
        .select()
        .from(agentWorkflows)
        .orderBy(desc(agentWorkflows.createdAt))
        .limit(Number(limit));
    }

    res.json({
      workflows,
      count: workflows.length,
    });
  } catch (error) {
    console.error("List workflows error:", error);
    res.status(500).json({ error: "Failed to list workflows" });
  }
});

/**
 * GET /api/v1/agent-workflows/:id
 * Get workflow details with tasks and logs
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await agentWorkflowOrchestrator.getWorkflowStatus(id);

    if (!result) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("Get workflow error:", error);
    res.status(500).json({ error: "Failed to get workflow" });
  }
});

/**
 * GET /api/v1/agent-workflows/:id/tasks
 * Get all tasks for a workflow
 */
router.get("/:id/tasks", async (req, res) => {
  const { id } = req.params;

  try {
    const tasks = await db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.workflowId, id));

    res.json({ tasks });
  } catch (error) {
    console.error("Get workflow tasks error:", error);
    res.status(500).json({ error: "Failed to get workflow tasks" });
  }
});

/**
 * GET /api/v1/agent-workflows/:id/logs
 * Get logs for a workflow
 */
router.get("/:id/logs", async (req, res) => {
  const { id } = req.params;
  const { limit = 100 } = req.query;

  try {
    const logs = await db
      .select()
      .from(workflowLogs)
      .where(eq(workflowLogs.workflowId, id))
      .orderBy(desc(workflowLogs.timestamp))
      .limit(Number(limit));

    res.json({ logs });
  } catch (error) {
    console.error("Get workflow logs error:", error);
    res.status(500).json({ error: "Failed to get workflow logs" });
  }
});

/**
 * POST /api/v1/agent-workflows/:id/cancel
 * Cancel a running workflow
 */
router.post("/:id/cancel", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await agentWorkflowOrchestrator.cancelWorkflow(id);

    await logAudit(user.id, "cancel_agent_workflow", "/agent-workflows", id, true, req);

    res.json({
      success: true,
      message: "Workflow cancelled",
    });
  } catch (error) {
    console.error("Cancel workflow error:", error);
    
    await logAudit(user.id, "cancel_agent_workflow", "/agent-workflows", id, false, req);

    res.status(500).json({ error: "Failed to cancel workflow" });
  }
});

/**
 * GET /api/v1/agent-workflows/target/:targetId/latest
 * Get latest workflow for a target
 */
router.get("/target/:targetId/latest", async (req, res) => {
  const { targetId } = req.params;

  try {
    const workflow = await db
      .select()
      .from(agentWorkflows)
      .where(eq(agentWorkflows.targetId, targetId))
      .orderBy(desc(agentWorkflows.createdAt))
      .limit(1)
      .then((rows) => rows[0]);

    if (!workflow) {
      return res.status(404).json({ error: "No workflows found for this target" });
    }

    // Get tasks for this workflow
    const tasks = await db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.workflowId, workflow.id));

    res.json({
      workflow,
      tasks,
    });
  } catch (error) {
    console.error("Get latest workflow error:", error);
    res.status(500).json({ error: "Failed to get latest workflow" });
  }
});

export default router;
