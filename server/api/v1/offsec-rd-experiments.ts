import { Router } from "express";
import { db } from "../../db";
import { rdExperiments, rdArtifacts, researchProjects, agents, agentWorkflows, agentMessages } from "@shared/schema";
import { eq, and, desc, gte, lte, or } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { z } from "zod";
import { rdExperimentOrchestrator } from "../../services/rd-experiment-orchestrator";
import { rdToolPromotion } from "../../services/rd-tool-promotion";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// Validation schema for experiment data
const experimentSchema = z.object({
  projectId: z.string().uuid("Project ID is required"),
  name: z.string().min(1, "Experiment name is required"),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  methodology: z.string().optional(),
  toolsUsed: z.array(z.string()).optional(),
  targets: z.array(z.any()).optional(),
  status: z.enum(["planned", "running", "completed", "failed", "cancelled"]).optional(),
  results: z.any().optional(),
  conclusions: z.string().optional(),
  success: z.boolean().optional(),
  executedByAgentId: z.string().uuid().optional(),
  workflowId: z.string().uuid().optional(),
  executionLog: z.string().optional(),
  errorMessage: z.string().optional(),
});

// GET /api/v1/offsec-rd/experiments - List experiments (with optional projectId filter)
router.get("/", async (req, res) => {
  const { projectId } = req.query;

  try {
    let query = db
      .select({
        id: rdExperiments.id,
        projectId: rdExperiments.projectId,
        projectName: researchProjects.name,
        name: rdExperiments.name,
        description: rdExperiments.description,
        hypothesis: rdExperiments.hypothesis,
        methodology: rdExperiments.methodology,
        toolsUsed: rdExperiments.toolsUsed,
        targets: rdExperiments.targets,
        status: rdExperiments.status,
        results: rdExperiments.results,
        conclusions: rdExperiments.conclusions,
        success: rdExperiments.success,
        executedByAgentId: rdExperiments.executedByAgentId,
        executedByAgentName: agents.name,
        workflowId: rdExperiments.workflowId,
        executionLog: rdExperiments.executionLog,
        errorMessage: rdExperiments.errorMessage,
        createdAt: rdExperiments.createdAt,
        startedAt: rdExperiments.startedAt,
        completedAt: rdExperiments.completedAt,
      })
      .from(rdExperiments)
      .leftJoin(researchProjects, eq(rdExperiments.projectId, researchProjects.id))
      .leftJoin(agents, eq(rdExperiments.executedByAgentId, agents.id));

    // Filter by project if provided
    if (projectId && typeof projectId === "string") {
      query = query.where(eq(rdExperiments.projectId, projectId));
    }

    const experiments = await query.orderBy(desc(rdExperiments.createdAt));

    res.json({ experiments });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve experiments",
      details: error.message
    });
  }
});

// GET /api/v1/offsec-rd/experiments/:id - Get experiment details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select({
        id: rdExperiments.id,
        projectId: rdExperiments.projectId,
        projectName: researchProjects.name,
        name: rdExperiments.name,
        description: rdExperiments.description,
        hypothesis: rdExperiments.hypothesis,
        methodology: rdExperiments.methodology,
        toolsUsed: rdExperiments.toolsUsed,
        targets: rdExperiments.targets,
        status: rdExperiments.status,
        results: rdExperiments.results,
        conclusions: rdExperiments.conclusions,
        success: rdExperiments.success,
        executedByAgentId: rdExperiments.executedByAgentId,
        executedByAgentName: agents.name,
        workflowId: rdExperiments.workflowId,
        workflowStatus: agentWorkflows.status,
        executionLog: rdExperiments.executionLog,
        errorMessage: rdExperiments.errorMessage,
        createdAt: rdExperiments.createdAt,
        startedAt: rdExperiments.startedAt,
        completedAt: rdExperiments.completedAt,
      })
      .from(rdExperiments)
      .leftJoin(researchProjects, eq(rdExperiments.projectId, researchProjects.id))
      .leftJoin(agents, eq(rdExperiments.executedByAgentId, agents.id))
      .leftJoin(agentWorkflows, eq(rdExperiments.workflowId, agentWorkflows.id))
      .where(eq(rdExperiments.id, id))
      .limit(1);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    res.json({ experiment: result[0] });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve experiment",
      details: error.message
    });
  }
});

// POST /api/v1/offsec-rd/experiments - Create new experiment
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const validatedData = experimentSchema.parse(req.body);

    // Verify project exists
    const project = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.id, validatedData.projectId))
      .limit(1);

    if (!project || project.length === 0) {
      return res.status(404).json({ error: "Research project not found" });
    }

    const [newExperiment] = await db
      .insert(rdExperiments)
      .values({
        projectId: validatedData.projectId,
        name: validatedData.name,
        description: validatedData.description,
        hypothesis: validatedData.hypothesis,
        methodology: validatedData.methodology,
        toolsUsed: validatedData.toolsUsed || [],
        targets: validatedData.targets || [],
        status: validatedData.status || "planned",
        results: validatedData.results || {},
        conclusions: validatedData.conclusions,
        success: validatedData.success,
        executedByAgentId: validatedData.executedByAgentId,
        workflowId: validatedData.workflowId,
        executionLog: validatedData.executionLog,
        errorMessage: validatedData.errorMessage,
      })
      .returning();

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_experiment_create",
      "/offsec-rd/experiments",
      newExperiment.id,
      true,
      req
    );

    res.status(201).json({ experiment: newExperiment });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors
      });
    }
    res.status(500).json({
      error: "Failed to create experiment",
      details: error.message
    });
  }
});

// PUT /api/v1/offsec-rd/experiments/:id - Update experiment
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const validatedData = experimentSchema.partial().parse(req.body);

    // Check if experiment exists
    const existing = await db
      .select()
      .from(rdExperiments)
      .where(eq(rdExperiments.id, id))
      .limit(1);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    // Determine timestamps based on status change
    const statusUpdate: any = {};
    if (validatedData.status === "running" && !existing[0].startedAt) {
      statusUpdate.startedAt = new Date();
    }
    if (
      (validatedData.status === "completed" || validatedData.status === "failed") &&
      !existing[0].completedAt
    ) {
      statusUpdate.completedAt = new Date();
    }

    // Update experiment
    const [updatedExperiment] = await db
      .update(rdExperiments)
      .set({
        ...validatedData,
        ...statusUpdate,
      })
      .where(eq(rdExperiments.id, id))
      .returning();

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_experiment_update",
      `/offsec-rd/experiments/${id}`,
      id,
      true,
      req
    );

    res.json({ experiment: updatedExperiment });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors
      });
    }
    res.status(500).json({
      error: "Failed to update experiment",
      details: error.message
    });
  }
});

// POST /api/v1/offsec-rd/experiments/:id/execute - Execute experiment via orchestrator
router.post("/:id/execute", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    // Get experiment with project context
    const [experiment] = await db
      .select()
      .from(rdExperiments)
      .where(eq(rdExperiments.id, id))
      .limit(1);

    if (!experiment) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    if (experiment.status === "running") {
      return res.status(400).json({ error: "Experiment is already running" });
    }

    // Get project for vulnerability context
    const [project] = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.id, experiment.projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: "Associated research project not found" });
    }

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_experiment_execute",
      `/offsec-rd/experiments/${id}/execute`,
      id,
      true,
      req
    );

    // Execute asynchronously via orchestrator
    const context = {
      experimentId: id,
      projectId: experiment.projectId,
      vulnerabilityId: project.sourceVulnerabilityId || "",
      operationId: req.body.operationId || "",
      targetInfo: req.body.targetInfo,
    };

    // Start execution in background, return immediately
    rdExperimentOrchestrator.executeExperiment(id, context).catch((err) => {
      console.error(`[RD Orchestrator] Background experiment ${id} failed:`, err);
    });

    res.json({
      message: "Experiment execution started",
      experimentId: id,
      status: "running",
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to execute experiment",
      details: error.message,
    });
  }
});

// POST /api/v1/offsec-rd/experiments/:id/cancel - Cancel running experiment
router.post("/:id/cancel", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const [experiment] = await db
      .select()
      .from(rdExperiments)
      .where(eq(rdExperiments.id, id))
      .limit(1);

    if (!experiment) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    if (experiment.status !== "running") {
      return res.status(400).json({ error: "Experiment is not running" });
    }

    // Cancel via orchestrator (handles abort + DB update)
    const cancelled = await rdExperimentOrchestrator.cancelExperiment(id);

    if (!cancelled) {
      // Orchestrator didn't have it active, update DB directly
      await db
        .update(rdExperiments)
        .set({ status: "cancelled", completedAt: new Date() })
        .where(eq(rdExperiments.id, id));
    }

    await logAudit(
      user.id,
      "offsec_rd_experiment_cancel",
      `/offsec-rd/experiments/${id}/cancel`,
      id,
      true,
      req
    );

    res.json({ message: "Experiment cancelled", experimentId: id });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to cancel experiment",
      details: error.message,
    });
  }
});

// POST /api/v1/offsec-rd/projects/:projectId/execute - Execute all planned experiments in a project
router.post("/projects/:projectId/execute", ensureRole("admin", "operator"), async (req, res) => {
  const { projectId } = req.params;
  const user = req.user as any;

  try {
    const [project] = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: "Research project not found" });
    }

    await logAudit(
      user.id,
      "offsec_rd_project_execute",
      `/offsec-rd/projects/${projectId}/execute`,
      projectId,
      true,
      req
    );

    // Execute all planned experiments in background
    rdExperimentOrchestrator.executeProject(projectId).catch((err) => {
      console.error(`[RD Orchestrator] Background project ${projectId} execution failed:`, err);
    });

    res.json({
      message: "Project execution started",
      projectId,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to execute project",
      details: error.message,
    });
  }
});

// GET /api/v1/offsec-rd/experiments/:experimentId/artifacts - List artifacts for an experiment
router.get("/:experimentId/artifacts", async (req, res) => {
  const { experimentId } = req.params;

  try {
    const artifacts = await db
      .select()
      .from(rdArtifacts)
      .where(eq(rdArtifacts.experimentId, experimentId))
      .orderBy(desc(rdArtifacts.createdAt));

    res.json({ artifacts });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve artifacts",
      details: error.message,
    });
  }
});

// POST /api/v1/offsec-rd/artifacts/:artifactId/promote - Promote artifact to Tool Registry
router.post("/artifacts/:artifactId/promote", ensureRole("admin", "operator"), async (req, res) => {
  const { artifactId } = req.params;
  const { toolName, category } = req.body;
  const user = req.user as any;

  try {
    const result = await rdToolPromotion.promoteToToolRegistry(artifactId, toolName, category);

    await logAudit(
      user.id,
      "offsec_rd_artifact_promote",
      `/offsec-rd/artifacts/${artifactId}/promote`,
      artifactId,
      result.success,
      req
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error, metadata: result.metadata });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to promote artifact",
      details: error.message,
    });
  }
});

// GET /api/v1/offsec-rd/experiments/:id/agent-log - Get agent communications during experiment execution
router.get("/:id/agent-log", async (req, res) => {
  const { id } = req.params;

  try {
    // Get experiment to determine time window
    const [experiment] = await db
      .select()
      .from(rdExperiments)
      .where(eq(rdExperiments.id, id))
      .limit(1);

    if (!experiment) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    // Build time-range filter for agent messages during execution
    const startTime = experiment.startedAt || experiment.createdAt;
    const endTime = experiment.completedAt || new Date();

    // Fetch agent messages in the execution window
    // Include messages from R&D-related agents (research, maldev, poc, nuclei, rd-team)
    const messages = await db
      .select({
        id: agentMessages.id,
        messageType: agentMessages.messageType,
        fromAgentId: agentMessages.fromAgentId,
        fromAgentRole: agentMessages.fromAgentRole,
        toAgentRole: agentMessages.toAgentRole,
        subject: agentMessages.subject,
        contentSummary: agentMessages.contentSummary,
        contentData: agentMessages.contentData,
        priority: agentMessages.priority,
        status: agentMessages.status,
        createdAt: agentMessages.createdAt,
      })
      .from(agentMessages)
      .where(
        and(
          gte(agentMessages.createdAt, startTime),
          lte(agentMessages.createdAt, endTime),
          or(
            eq(agentMessages.fromAgentRole, "research_agent"),
            eq(agentMessages.fromAgentRole, "maldev_agent"),
            eq(agentMessages.fromAgentRole, "poc_developer"),
            eq(agentMessages.fromAgentRole, "nuclei_template_developer"),
            eq(agentMessages.fromAgentRole, "rd_team"),
            eq(agentMessages.fromAgentRole, "operations_manager"),
          )
        )
      )
      .orderBy(agentMessages.createdAt)
      .limit(200);

    // Also include execution log entries parsed from the experiment results
    const executionLog: Array<{
      id: string;
      level: string;
      message: string;
      timestamp: string;
      context?: any;
    }> = [];

    // Parse execution log from results
    const results = experiment.results as any;
    if (results?.executionLog && Array.isArray(results.executionLog)) {
      results.executionLog.forEach((entry: string, i: number) => {
        const isError = entry.includes("[ERROR]");
        const timestamp = entry.match(/\[([\d-T:.Z]+)\]/)?.[1];
        executionLog.push({
          id: `log-${i}`,
          level: isError ? "error" : "info",
          message: entry.replace(/\[[\d-T:.Z]+\]\s*/, ""),
          timestamp: timestamp || (experiment.startedAt || experiment.createdAt).toISOString(),
        });
      });
    }

    res.json({
      experiment: {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        startedAt: experiment.startedAt,
        completedAt: experiment.completedAt,
      },
      agentMessages: messages,
      executionLog,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve agent log",
      details: error.message,
    });
  }
});

export default router;
