import express from "express";
import { z } from "zod";
import { db } from "../../db";
import {
  operations,
  agents,
  agentActivityReports,
  operationsManagerTasks,
  assetQuestions,
  agentWorkflows,
} from "../../../shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { opsManagerScheduler } from "../../services/ops-manager-scheduler";
import { operationsManagerAgent } from "../../services/operations-manager-agent";
import { memoryService } from "../../services/memory-service";

const router = express.Router();

// ============================================================================
// REPORTER AGENTS
// ============================================================================

/**
 * GET /api/v1/operations-management/reporters
 * Get all page reporter agents with their latest reports
 */
router.get("/reporters", async (req, res) => {
  try {
    // Get all reporter agents
    const allAgents = await db.select().from(agents);
    const reporters = allAgents.filter((agent) => {
      const config = agent.config as any;
      return config?.role === "page_reporter";
    });

    // Get latest report for each reporter
    const reportersWithStats = await Promise.all(
      reporters.map(async (reporter) => {
        const latestReport = await db
          .select()
          .from(agentActivityReports)
          .where(eq(agentActivityReports.agentId, reporter.id))
          .orderBy(desc(agentActivityReports.generatedAt))
          .limit(1);

        return {
          ...reporter,
          latestReport: latestReport[0] || null,
          lastReportAt: latestReport[0]?.generatedAt || null,
        };
      })
    );

    res.json({
      reporters: reportersWithStats,
      totalCount: reportersWithStats.length,
    });
  } catch (error) {
    console.error("Error fetching reporters:", error);
    res.status(500).json({
      error: "Failed to fetch reporter agents",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/v1/operations-management/reports/:operationId
 * Get reports for a specific operation
 */
router.get("/reports/:operationId", async (req, res) => {
  try {
    const { operationId } = req.params;
    const { pageRole, limit = 50, offset = 0 } = req.query;

    let query = db
      .select()
      .from(agentActivityReports)
      .where(eq(agentActivityReports.operationId, operationId))
      .orderBy(desc(agentActivityReports.generatedAt))
      .limit(Number(limit))
      .offset(Number(offset));

    if (pageRole) {
      query = db
        .select()
        .from(agentActivityReports)
        .where(
          and(
            eq(agentActivityReports.operationId, operationId),
            eq(agentActivityReports.agentPageRole, pageRole as string)
          )
        )
        .orderBy(desc(agentActivityReports.generatedAt))
        .limit(Number(limit))
        .offset(Number(offset));
    }

    const reportsList = await query;

    res.json({
      reports: reportsList,
      totalCount: reportsList.length,
      hasMore: reportsList.length === Number(limit),
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({
      error: "Failed to fetch reports",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/v1/operations-management/reports/latest/:pageRole
 * Get latest report for a specific page role
 */
router.get("/reports/latest/:pageRole", async (req, res) => {
  try {
    const { pageRole } = req.params;

    const report = await db
      .select()
      .from(agentActivityReports)
      .where(eq(agentActivityReports.agentPageRole, pageRole))
      .orderBy(desc(agentActivityReports.generatedAt))
      .limit(1);

    if (report.length === 0) {
      return res.status(404).json({ error: "No report found for this page role" });
    }

    res.json({ report: report[0] });
  } catch (error) {
    console.error("Error fetching latest report:", error);
    res.status(500).json({
      error: "Failed to fetch latest report",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// OPERATIONS MANAGER
// ============================================================================

/**
 * GET /api/v1/operations-management/manager/tasks/:operationId
 * Get operations manager tasks for an operation
 */
router.get("/manager/tasks/:operationId", async (req, res) => {
  try {
    const { operationId } = req.params;

    const tasks = await db
      .select()
      .from(operationsManagerTasks)
      .where(eq(operationsManagerTasks.operationId, operationId))
      .orderBy(desc(operationsManagerTasks.createdAt));

    res.json({ tasks });
  } catch (error) {
    console.error("Error fetching manager tasks:", error);
    res.status(500).json({
      error: "Failed to fetch manager tasks",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/v1/operations-management/manager/synthesis/:operationId
 * Get latest synthesis report for an operation
 */
router.get("/manager/synthesis/:operationId", async (req, res) => {
  try {
    const { operationId } = req.params;

    const synthesis = await db
      .select()
      .from(operationsManagerTasks)
      .where(
        and(
          eq(operationsManagerTasks.operationId, operationId),
          eq(operationsManagerTasks.taskType, "synthesis")
        )
      )
      .orderBy(desc(operationsManagerTasks.completedAt))
      .limit(1);

    if (synthesis.length === 0) {
      return res.status(404).json({ error: "No synthesis found for this operation" });
    }

    res.json({ synthesis: synthesis[0] });
  } catch (error) {
    console.error("Error fetching synthesis:", error);
    res.status(500).json({
      error: "Failed to fetch synthesis",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// ASSET QUESTIONS
// ============================================================================

/**
 * GET /api/v1/operations-management/questions/:operationId
 * Get asset questions for an operation
 */
router.get("/questions/:operationId", async (req, res) => {
  try {
    const { operationId } = req.params;
    const { status } = req.query;

    let query = db
      .select()
      .from(assetQuestions)
      .where(eq(assetQuestions.operationId, operationId))
      .orderBy(desc(assetQuestions.askedAt));

    if (status) {
      query = db
        .select()
        .from(assetQuestions)
        .where(
          and(
            eq(assetQuestions.operationId, operationId),
            eq(assetQuestions.status, status as any)
          )
        )
        .orderBy(desc(assetQuestions.askedAt));
    }

    const questions = await query;

    res.json({ questions });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({
      error: "Failed to fetch questions",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/v1/operations-management/questions/:questionId/answer
 * Answer an asset question
 */
router.post("/questions/:questionId/answer", async (req, res) => {
  try {
    const { questionId } = req.params;
    const { answer, helpful } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const updated = await db
      .update(assetQuestions)
      .set({
        answer,
        answerSource: "user",
        answeredByUserId: req.user.id,
        answeredAt: new Date(),
        status: "answered",
        helpful: helpful !== undefined ? helpful : null,
      })
      .where(eq(assetQuestions.id, questionId))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json({ question: updated[0] });
  } catch (error) {
    console.error("Error answering question:", error);
    res.status(500).json({
      error: "Failed to answer question",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// ENHANCED QUESTION MANAGEMENT (Phase 2 Memory Integration)
// ============================================================================

/**
 * GET /api/v1/operations-management/questions/pending
 * Get pending questions enriched with memory context
 */
router.get("/questions/pending", async (req, res) => {
  try {
    const { operationId } = req.query;

    const questions = await db
      .select()
      .from(assetQuestions)
      .where(eq(assetQuestions.status, "pending"))
      .orderBy(desc(assetQuestions.askedAt));

    // Enrich with memory context
    const enriched = await Promise.all(
      questions
        .filter((q) => !operationId || q.operationId === operationId)
        .map(async (question) => {
          let memoryContext: any[] = [];
          if (question.operationId) {
            try {
              memoryContext = await memoryService.searchMemories({
                query: question.question,
                contextId: question.operationId,
                limit: 3,
              });
            } catch {
              // Memory search is best-effort
            }
          }
          return {
            ...question,
            memoryContext: memoryContext.map((m) => ({
              id: m.id,
              text: m.memoryText,
              type: m.memoryType,
            })),
          };
        }),
    );

    res.json({ questions: enriched, count: enriched.length });
  } catch (error) {
    console.error("Error fetching pending questions:", error);
    res.status(500).json({
      error: "Failed to fetch pending questions",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

const respondSchema = z.object({
  answer: z.string().min(1),
});

/**
 * POST /api/v1/operations-management/questions/:id/respond
 * Respond to a question with memory storage
 */
router.post("/questions/:id/respond", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;
    const parsed = respondSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const result = await operationsManagerAgent.processResponse(
      id,
      parsed.data.answer,
      req.user.id,
    );

    res.json({
      success: true,
      memoryId: result.memoryId,
      taskGenerated: result.taskGenerated,
    });
  } catch (error) {
    console.error("Error responding to question:", error);
    res.status(500).json({
      error: "Failed to respond to question",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/v1/operations-management/questions/:id/dismiss
 * Dismiss a question with optional reason
 */
router.post("/questions/:id/dismiss", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await db
      .update(assetQuestions)
      .set({
        status: "dismissed",
        answer: reason || "Dismissed by operator",
        answeredAt: new Date(),
      })
      .where(eq(assetQuestions.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error dismissing question:", error);
    res.status(500).json({
      error: "Failed to dismiss question",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// ENABLE/DISABLE HOURLY REPORTING
// ============================================================================

/**
 * POST /api/v1/operations-management/enable/:operationId
 * Enable hourly reporting for an operation
 */
router.post("/enable/:operationId", async (req, res) => {
  try {
    const { operationId } = req.params;

    const updated = await db
      .update(operations)
      .set({ hourlyReportingEnabled: true })
      .where(eq(operations.id, operationId))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    res.json({
      success: true,
      operation: updated[0],
      message: "Hourly reporting enabled",
    });
  } catch (error) {
    console.error("Error enabling hourly reporting:", error);
    res.status(500).json({
      error: "Failed to enable hourly reporting",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/v1/operations-management/disable/:operationId
 * Disable hourly reporting for an operation
 */
router.post("/disable/:operationId", async (req, res) => {
  try {
    const { operationId } = req.params;

    const updated = await db
      .update(operations)
      .set({ hourlyReportingEnabled: false })
      .where(eq(operations.id, operationId))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    res.json({
      success: true,
      operation: updated[0],
      message: "Hourly reporting disabled",
    });
  } catch (error) {
    console.error("Error disabling hourly reporting:", error);
    res.status(500).json({
      error: "Failed to disable hourly reporting",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/v1/operations-management/trigger-now/:operationId
 * Manually trigger an operations management workflow
 */
router.post("/trigger-now/:operationId", async (req, res) => {
  try {
    const { operationId } = req.params;

    const workflowId = await opsManagerScheduler.triggerNow(operationId);

    res.json({
      success: true,
      workflowId,
      message: "Operations management workflow triggered",
    });
  } catch (error) {
    console.error("Error triggering workflow:", error);
    res.status(500).json({
      error: "Failed to trigger workflow",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// DASHBOARD STATS
// ============================================================================

/**
 * GET /api/v1/operations-management/dashboard/:operationId
 * Get dashboard stats for operations management
 */
router.get("/dashboard/:operationId", async (req, res) => {
  try {
    const { operationId } = req.params;

    // Get operation
    const operation = await db
      .select()
      .from(operations)
      .where(eq(operations.id, operationId))
      .limit(1);

    if (operation.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    // Count active reporters
    const allAgents = await db.select().from(agents);
    const reporters = allAgents.filter((agent) => {
      const config = agent.config as any;
      return config?.role === "page_reporter";
    });

    // Count pending questions
    const pendingQuestions = await db
      .select()
      .from(assetQuestions)
      .where(
        and(eq(assetQuestions.operationId, operationId), eq(assetQuestions.status, "pending"))
      );

    // Get recent manager tasks
    const recentTasks = await db
      .select()
      .from(operationsManagerTasks)
      .where(eq(operationsManagerTasks.operationId, operationId))
      .orderBy(desc(operationsManagerTasks.createdAt))
      .limit(5);

    // Get recent workflows
    const recentWorkflows = await db
      .select()
      .from(agentWorkflows)
      .where(
        and(
          eq(agentWorkflows.operationId, operationId),
          eq(agentWorkflows.workflowType, "ops_management_hourly")
        )
      )
      .orderBy(desc(agentWorkflows.createdAt))
      .limit(10);

    // Get scheduler status
    const schedulerStatus = opsManagerScheduler.getStatus();

    res.json({
      operation: operation[0],
      stats: {
        activeReporters: reporters.length,
        pendingQuestions: pendingQuestions.length,
        recentTasksCount: recentTasks.length,
        recentWorkflowsCount: recentWorkflows.length,
      },
      recentTasks,
      recentWorkflows,
      schedulerStatus,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      error: "Failed to fetch dashboard stats",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/v1/operations-management/scheduler/status
 * Get scheduler status
 */
router.get("/scheduler/status", async (req, res) => {
  try {
    const status = opsManagerScheduler.getStatus();

    res.json({ status });
  } catch (error) {
    console.error("Error fetching scheduler status:", error);
    res.status(500).json({
      error: "Failed to fetch scheduler status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
