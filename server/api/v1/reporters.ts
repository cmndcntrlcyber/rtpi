import { Router } from "express";
import { db } from "../../db";
import { reporters, reporterQuestions, reporterTasks } from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { reporterAgentService } from "../../services/reporter-agent-service";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// ============================================================================
// Reporter Management Routes
// ============================================================================

// GET /api/v1/reporters - List all reporters
router.get("/", async (req, res) => {
  const { operationId, status } = req.query;

  try {
    let query = db.select().from(reporters);

    if (operationId && typeof operationId === "string") {
      query = query.where(eq(reporters.operationId, operationId)) as typeof query;
    }

    if (status && typeof status === "string") {
      query = query.where(eq(reporters.status, status as any)) as typeof query;
    }

    const allReporters = await query.orderBy(desc(reporters.createdAt));
    res.json({ reporters: allReporters });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list reporters", details: error?.message });
  }
});

// GET /api/v1/reporters/:id - Get reporter details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [reporter] = await db
      .select()
      .from(reporters)
      .where(eq(reporters.id, id))
      .limit(1);

    if (!reporter) {
      return res.status(404).json({ error: "Reporter not found" });
    }

    res.json({ reporter });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get reporter", details: error?.message });
  }
});

// POST /api/v1/reporters - Create new reporter
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const { agentId, name, pageId, pageUrl, description, operationId, config } = req.body;
  const user = req.user as any;

  if (!agentId || !name || !pageId) {
    return res.status(400).json({ error: "agentId, name, and pageId are required" });
  }

  try {
    const reporterId = await reporterAgentService.createReporter({
      agentId,
      name,
      pageId,
      pageUrl,
      description,
      operationId,
      config,
      userId: user.id,
    });

    const [reporter] = await db
      .select()
      .from(reporters)
      .where(eq(reporters.id, reporterId))
      .limit(1);

    await logAudit(user.id, "create_reporter", "/reporters", reporterId, true, req);

    res.status(201).json({ reporter });
  } catch (error: any) {
    await logAudit(user.id, "create_reporter", "/reporters", null, false, req);
    res.status(500).json({ error: "Failed to create reporter", details: error?.message });
  }
});

// DELETE /api/v1/reporters/:id - Delete reporter
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    // Stop polling first
    reporterAgentService.stopPolling(id);

    await db.delete(reporters).where(eq(reporters.id, id));

    await logAudit(user.id, "delete_reporter", "/reporters", id, true, req);

    res.json({ message: "Reporter deleted successfully" });
  } catch (error: any) {
    await logAudit(user.id, "delete_reporter", "/reporters", id, false, req);
    res.status(500).json({ error: "Failed to delete reporter", details: error?.message });
  }
});

// ============================================================================
// Reporter Control Routes
// ============================================================================

// POST /api/v1/reporters/:id/start - Start polling
router.post("/:id/start", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const success = await reporterAgentService.startPolling(id);

    if (!success) {
      return res.status(404).json({ error: "Reporter not found" });
    }

    await logAudit(user.id, "start_reporter", "/reporters", id, true, req);

    res.json({ message: "Reporter polling started" });
  } catch (error: any) {
    await logAudit(user.id, "start_reporter", "/reporters", id, false, req);
    res.status(500).json({ error: "Failed to start reporter", details: error?.message });
  }
});

// POST /api/v1/reporters/:id/stop - Stop polling
router.post("/:id/stop", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    reporterAgentService.stopPolling(id);

    // Update status
    await db
      .update(reporters)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(reporters.id, id));

    await logAudit(user.id, "stop_reporter", "/reporters", id, true, req);

    res.json({ message: "Reporter polling stopped" });
  } catch (error: any) {
    await logAudit(user.id, "stop_reporter", "/reporters", id, false, req);
    res.status(500).json({ error: "Failed to stop reporter", details: error?.message });
  }
});

// POST /api/v1/reporters/:id/poll - Trigger immediate poll
router.post("/:id/poll", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const data = await reporterAgentService.pollData(id);

    if (!data) {
      return res.status(404).json({ error: "Reporter not found or poll failed" });
    }

    await logAudit(user.id, "poll_reporter", "/reporters", id, true, req);

    res.json({ data });
  } catch (error: any) {
    await logAudit(user.id, "poll_reporter", "/reporters", id, false, req);
    res.status(500).json({ error: "Failed to poll reporter", details: error?.message });
  }
});

// ============================================================================
// Reporter Data Routes
// ============================================================================

// GET /api/v1/reporters/:id/data - Get polled data
router.get("/:id/data", async (req, res) => {
  const { id } = req.params;

  try {
    const data = await reporterAgentService.releaseData(id);

    if (!data) {
      return res.status(404).json({ error: "Reporter not found" });
    }

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get reporter data", details: error?.message });
  }
});

// GET /api/v1/reporters/:id/status - Get reporter status
router.get("/:id/status", async (req, res) => {
  const { id } = req.params;

  try {
    const status = await reporterAgentService.getReporterStatus(id);

    if (!status) {
      return res.status(404).json({ error: "Reporter not found" });
    }

    res.json({ status });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get reporter status", details: error?.message });
  }
});

// ============================================================================
// Reporter Questions Routes
// ============================================================================

// GET /api/v1/reporters/:id/questions - Get questions for a reporter
router.get("/:id/questions", async (req, res) => {
  const { id } = req.params;
  const { status } = req.query;

  try {
    let query = db
      .select()
      .from(reporterQuestions)
      .where(eq(reporterQuestions.reporterId, id));

    if (status && typeof status === "string") {
      query = query.where(eq(reporterQuestions.status, status as any)) as typeof query;
    }

    const questions = await query.orderBy(desc(reporterQuestions.priority), desc(reporterQuestions.createdAt));

    res.json({ questions });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get questions", details: error?.message });
  }
});

// POST /api/v1/reporters/:id/questions - Submit a question
router.post("/:id/questions", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const { question, context, priority } = req.body;
  const user = req.user as any;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  try {
    const questionId = await reporterAgentService.submitQuestion({
      reporterId: id,
      question,
      context,
      priority,
    });

    const [createdQuestion] = await db
      .select()
      .from(reporterQuestions)
      .where(eq(reporterQuestions.id, questionId))
      .limit(1);

    await logAudit(user.id, "submit_question", "/reporters/questions", questionId, true, req);

    res.status(201).json({ question: createdQuestion });
  } catch (error: any) {
    await logAudit(user.id, "submit_question", "/reporters/questions", null, false, req);
    res.status(500).json({ error: "Failed to submit question", details: error?.message });
  }
});

// PUT /api/v1/reporters/questions/:questionId/respond - Respond to a question
router.put("/questions/:questionId/respond", ensureRole("admin", "operator"), async (req, res) => {
  const { questionId } = req.params;
  const { response } = req.body;
  const user = req.user as any;

  if (!response) {
    return res.status(400).json({ error: "response is required" });
  }

  try {
    const [updatedQuestion] = await db
      .update(reporterQuestions)
      .set({
        response,
        respondedBy: user.id,
        respondedAt: new Date(),
        status: "answered",
        updatedAt: new Date(),
      })
      .where(eq(reporterQuestions.id, questionId))
      .returning();

    if (!updatedQuestion) {
      return res.status(404).json({ error: "Question not found" });
    }

    await logAudit(user.id, "respond_question", "/reporters/questions", questionId, true, req);

    res.json({ question: updatedQuestion });
  } catch (error: any) {
    await logAudit(user.id, "respond_question", "/reporters/questions", questionId, false, req);
    res.status(500).json({ error: "Failed to respond to question", details: error?.message });
  }
});

// ============================================================================
// Reporter Tasks Routes
// ============================================================================

// GET /api/v1/reporters/:id/tasks - Get tasks for a reporter
router.get("/:id/tasks", async (req, res) => {
  const { id } = req.params;
  const { status } = req.query;

  try {
    let query = db
      .select()
      .from(reporterTasks)
      .where(eq(reporterTasks.reporterId, id));

    if (status && typeof status === "string") {
      query = query.where(eq(reporterTasks.status, status as any)) as typeof query;
    }

    const tasks = await query.orderBy(desc(reporterTasks.priority), desc(reporterTasks.createdAt));

    res.json({ tasks });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get tasks", details: error?.message });
  }
});

// POST /api/v1/reporters/:id/tasks - Assign a task
router.post("/:id/tasks", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const { taskName, taskDescription, taskType, instructions, parameters, priority, dueAt, questionId } = req.body;
  const user = req.user as any;

  if (!taskName || !taskType || !instructions) {
    return res.status(400).json({ error: "taskName, taskType, and instructions are required" });
  }

  try {
    const taskId = await reporterAgentService.assignTask({
      reporterId: id,
      taskName,
      taskDescription,
      taskType,
      instructions,
      parameters,
      priority,
      dueAt: dueAt ? new Date(dueAt) : undefined,
      questionId,
      assignedBy: user.id,
    });

    const [task] = await db
      .select()
      .from(reporterTasks)
      .where(eq(reporterTasks.id, taskId))
      .limit(1);

    await logAudit(user.id, "assign_task", "/reporters/tasks", taskId, true, req);

    res.status(201).json({ task });
  } catch (error: any) {
    await logAudit(user.id, "assign_task", "/reporters/tasks", null, false, req);
    res.status(500).json({ error: "Failed to assign task", details: error?.message });
  }
});

// PUT /api/v1/reporters/tasks/:taskId/status - Update task status
router.put("/tasks/:taskId/status", ensureRole("admin", "operator"), async (req, res) => {
  const { taskId } = req.params;
  const { status, result, errorMessage } = req.body;
  const user = req.user as any;

  if (!status) {
    return res.status(400).json({ error: "status is required" });
  }

  try {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "in_progress") {
      updateData.startedAt = new Date();
    } else if (status === "completed" || status === "failed") {
      updateData.completedAt = new Date();
    }

    if (result) {
      updateData.result = result;
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    const [updatedTask] = await db
      .update(reporterTasks)
      .set(updateData)
      .where(eq(reporterTasks.id, taskId))
      .returning();

    if (!updatedTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    await logAudit(user.id, "update_task_status", "/reporters/tasks", taskId, true, req);

    res.json({ task: updatedTask });
  } catch (error: any) {
    await logAudit(user.id, "update_task_status", "/reporters/tasks", taskId, false, req);
    res.status(500).json({ error: "Failed to update task status", details: error?.message });
  }
});

// ============================================================================
// Global Question Queue Routes (for Operations Manager)
// ============================================================================

// GET /api/v1/reporters/questions/pending - Get all pending questions
router.get("/questions/pending", async (req, res) => {
  const { operationId } = req.query;

  try {
    let query = db
      .select()
      .from(reporterQuestions)
      .where(eq(reporterQuestions.status, "pending"));

    if (operationId && typeof operationId === "string") {
      query = query.where(eq(reporterQuestions.operationId, operationId)) as typeof query;
    }

    const questions = await query.orderBy(desc(reporterQuestions.priority), desc(reporterQuestions.createdAt));

    res.json({ questions });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get pending questions", details: error?.message });
  }
});

export default router;
