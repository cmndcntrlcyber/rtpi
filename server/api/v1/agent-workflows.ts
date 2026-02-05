import { Router } from "express";
import { db } from "../../db";
import { agentWorkflows, workflowTasks, workflowLogs, targets, operations, workflowTemplates } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { agentWorkflowOrchestrator } from "../../services/agent-workflow-orchestrator";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

/**
 * POST /api/v1/agent-workflows/start
 * Start a new agent workflow (penetration test or custom)
 */
router.post("/start", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;
  const {
    targetId,
    workflowType,
    operationId,
    templateId,
    name,
    agents: agentsList,
    mcpServerIds,
    metadata
  } = req.body;

  if (!targetId) {
    return res.status(400).json({ error: "targetId is required" });
  }

  try {
    let workflow;

    // Support both penetration_test and custom workflow types
    if (!workflowType || workflowType === "penetration_test") {
      // Existing behavior for penetration test workflows
      workflow = await agentWorkflowOrchestrator.startPenetrationTestWorkflow(
        targetId,
        user.id,
        operationId
      );

      await logAudit(
        user.id,
        "start_agent_workflow",
        "/agent-workflows",
        workflow.workflow.id,
        true,
        req
      );

      return res.status(201).json({
        success: true,
        workflow: workflow.workflow,
        tasks: workflow.tasks,
      });
    } else if (workflowType === "custom") {
      // New: Handle custom workflows from WorkflowBuilder
      const { dynamicWorkflowOrchestrator } = await import("../../services/dynamic-workflow-orchestrator");

      // Get or create an operation for this target
      let opId = operationId;
      if (!opId) {
        // Find the target to check if it's already linked to an operation
        const [targetRecord] = await db
          .select()
          .from(targets)
          .where(eq(targets.id, targetId))
          .limit(1);

        if (targetRecord?.operationId) {
          opId = targetRecord.operationId;
        } else {
          // Create a new operation for this workflow
          const [newOp] = await db
            .insert(operations)
            .values({
              name: name || `Custom Workflow - ${new Date().toISOString()}`,
              status: "active",
              createdBy: user.id,
            })
            .returning();
          opId = newOp.id;

          // Link target to operation if target exists
          if (targetRecord) {
            await db
              .update(targets)
              .set({ operationId: opId })
              .where(eq(targets.id, targetId));
          }
        }
      }

      // Create or use existing template
      let templId = templateId;
      if (!templId && agentsList?.length > 0) {
        // Create a workflow template on-the-fly
        const [template] = await db
          .insert(workflowTemplates)
          .values({
            name: name || `Custom Workflow ${Date.now()}`,
            description: metadata?.description || "",
            requiredCapabilities: agentsList.map((a: any) => `agent:${a.agentId}`),
            optionalCapabilities: [],
            configuration: {
              agents: agentsList,
              mcpServerIds: mcpServerIds || [],
              maxParallelAgents: 1,
              timeoutMs: 3600000,
              retryConfig: { maxRetries: 3 },
            },
            isActive: true,
          })
          .returning();
        templId = template.id;
      }

      if (!templId) {
        return res.status(400).json({
          error: "templateId or agents array required for custom workflows"
        });
      }

      // Build and execute workflow using dynamic orchestrator
      const workflowId = await dynamicWorkflowOrchestrator.buildWorkflow(
        templId,
        opId,
        {
          userId: user.id,
          targetId,
          ...metadata,
        }
      );

      // Execute async - don't wait for completion
      dynamicWorkflowOrchestrator.executeWorkflow(workflowId).catch((err: Error) => {
        console.error("Custom workflow execution failed:", err);
      });

      await logAudit(
        user.id,
        "start_custom_workflow",
        "/agent-workflows",
        workflowId,
        true,
        req
      );

      return res.status(201).json({
        success: true,
        workflow: { id: workflowId, templateId: templId, operationId: opId },
        message: "Custom workflow started",
      });
    } else {
      return res.status(400).json({
        error: `Unsupported workflow type: ${workflowType}`,
      });
    }
  } catch (error: any) {
    // Error logged for debugging
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
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list workflows", details: error?.message || "Internal server error" });
  }
});

/**
 * GET /api/v1/agent-workflows/target/:targetId/latest
 * Get latest workflow for a target
 * NOTE: This route must be defined BEFORE /:id to avoid being caught by the generic route
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
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get latest workflow", details: error?.message || "Internal server error" });
  }
});

/**
 * GET /api/v1/agent-workflows/:id
 * Get workflow details with tasks and logs
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  // Validate UUID format to prevent invalid IDs from reaching the database
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: "Invalid workflow ID format" });
  }

  try {
    const result = await agentWorkflowOrchestrator.getWorkflowStatus(id);

    if (!result) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    res.json(result);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get workflow", details: error?.message || "Internal server error" });
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
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get workflow tasks", details: error?.message || "Internal server error" });
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
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get workflow logs", details: error?.message || "Internal server error" });
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
  } catch (error: any) {
    // Error logged for debugging
    
    await logAudit(user.id, "cancel_agent_workflow", "/agent-workflows", id, false, req);

    res.status(500).json({ error: "Failed to cancel workflow", details: error?.message || "Internal server error" });
  }
});

/**
 * DELETE /api/v1/agent-workflows/:id
 * Delete a workflow and its associated tasks and logs
 */
router.delete("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    // Check if workflow exists
    const workflow = await db
      .select()
      .from(agentWorkflows)
      .where(eq(agentWorkflows.id, id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    // Delete workflow (cascade will handle tasks and logs)
    await db.delete(agentWorkflows).where(eq(agentWorkflows.id, id));

    await logAudit(user.id, "delete_agent_workflow", "/agent-workflows", id, true, req);

    res.json({
      success: true,
      message: "Workflow deleted successfully",
    });
  } catch (error: any) {
    // Error logged for debugging
    
    await logAudit(user.id, "delete_agent_workflow", "/agent-workflows", id, false, req);

    res.status(500).json({ error: "Failed to delete workflow", details: error?.message || "Internal server error" });
  }
});

export default router;
