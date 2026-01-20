import { Router } from "express";
import { db } from "../../db";
import { rdExperiments, researchProjects, agents, agentWorkflows } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { z } from "zod";

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

// POST /api/v1/offsec-rd/experiments/:id/execute - Execute experiment via workflow
router.post("/:id/execute", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    // Get experiment
    const experiment = await db
      .select()
      .from(rdExperiments)
      .where(eq(rdExperiments.id, id))
      .limit(1);

    if (!experiment || experiment.length === 0) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    // Check if already running
    if (experiment[0].status === "running") {
      return res.status(400).json({ error: "Experiment is already running" });
    }

    // TODO: Create and start workflow via agent-workflow-orchestrator
    // This will be implemented in Phase 6 with the experiment executor service
    // For now, just update status to running

    const [updatedExperiment] = await db
      .update(rdExperiments)
      .set({
        status: "running",
        startedAt: new Date(),
      })
      .where(eq(rdExperiments.id, id))
      .returning();

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_experiment_execute",
      `/offsec-rd/experiments/${id}/execute`,
      id,
      true,
      req
    );

    res.json({
      experiment: updatedExperiment,
      message: "Experiment execution started (workflow integration pending)"
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to execute experiment",
      details: error.message
    });
  }
});

// POST /api/v1/offsec-rd/experiments/:id/cancel - Cancel running experiment
router.post("/:id/cancel", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const experiment = await db
      .select()
      .from(rdExperiments)
      .where(eq(rdExperiments.id, id))
      .limit(1);

    if (!experiment || experiment.length === 0) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    if (experiment[0].status !== "running") {
      return res.status(400).json({ error: "Experiment is not running" });
    }

    // TODO: Cancel associated workflow if exists
    // This will be implemented in Phase 6

    const [updatedExperiment] = await db
      .update(rdExperiments)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(eq(rdExperiments.id, id))
      .returning();

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_experiment_cancel",
      `/offsec-rd/experiments/${id}/cancel`,
      id,
      true,
      req
    );

    res.json({ experiment: updatedExperiment });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to cancel experiment",
      details: error.message
    });
  }
});

export default router;
