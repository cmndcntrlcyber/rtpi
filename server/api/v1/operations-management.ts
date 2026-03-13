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
import { ollamaAIClient } from "../../services/ollama-ai-client";

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

// ============================================================================
// OPERATIONS MANAGER CHAT (OpenAI/Anthropic Inference)
// ============================================================================

const chatSchema = z.object({
  operationId: z.string().uuid(),
  message: z.string().min(1),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional(),
});

/**
 * POST /api/v1/operations-management/chat
 * Interactive chat with Operations Manager using OpenAI/Anthropic inference
 */
router.post("/chat", async (req, res) => {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const { operationId, message, conversationHistory = [] } = parsed.data;

    // Fetch comprehensive operation context
    const operation = await db
      .select()
      .from(operations)
      .where(eq(operations.id, operationId))
      .limit(1);

    if (operation.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    // DATA SOURCE 1: All operations (for global context)
    const allOperations = await db.select().from(operations);
    const operationsStats = {
      total: allOperations.length,
      active: allOperations.filter(o => o.status === "active").length,
      planning: allOperations.filter(o => o.status === "planning").length,
      paused: allOperations.filter(o => o.status === "paused").length,
      completed: allOperations.filter(o => o.status === "completed").length,
      cancelled: allOperations.filter(o => o.status === "cancelled").length,
    };

    // DATA SOURCE 2: Recent activity reports for current operation
    const recentReports = await db
      .select()
      .from(agentActivityReports)
      .where(eq(agentActivityReports.operationId, operationId))
      .orderBy(desc(agentActivityReports.generatedAt))
      .limit(10);

    // DATA SOURCE 3: Pending and recent answered questions
    const allQuestions = await db
      .select()
      .from(assetQuestions)
      .where(eq(assetQuestions.operationId, operationId))
      .orderBy(desc(assetQuestions.askedAt))
      .limit(20);

    const pendingQuestions = allQuestions.filter(q => q.status === "pending");
    const answeredQuestions = allQuestions.filter(q => q.status === "answered");

    // DATA SOURCE 4: All workflows for current operation
    const allWorkflows = await db
      .select()
      .from(agentWorkflows)
      .where(eq(agentWorkflows.operationId, operationId))
      .orderBy(desc(agentWorkflows.createdAt))
      .limit(10);

    const workflowStats = {
      total: allWorkflows.length,
      running: allWorkflows.filter(w => w.status === "running").length,
      completed: allWorkflows.filter(w => w.status === "completed").length,
      failed: allWorkflows.filter(w => w.status === "failed").length,
      recent: allWorkflows.slice(0, 5).map(w => ({
        name: w.name,
        status: w.status,
        progress: w.progress,
        startedAt: w.startedAt,
        completedAt: w.completedAt,
      })),
    };

    // DATA SOURCE 5: Targets for current operation
    const { targets } = await import("../../../shared/schema");
    const operationTargets = await db
      .select()
      .from(targets)
      .where(eq(targets.operationId, operationId));

    const targetsSummary = {
      total: operationTargets.length,
      list: operationTargets.map(t => ({
        name: t.name,
        type: t.type,
        value: t.value,
        priority: t.priority,
      })),
    };

    // DATA SOURCE 6: Vulnerabilities for current operation
    const { vulnerabilities } = await import("../../../shared/schema");
    const operationVulns = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.operationId, operationId))
      .orderBy(desc(vulnerabilities.discoveredAt))
      .limit(20);

    const vulnStats = {
      total: operationVulns.length,
      critical: operationVulns.filter(v => v.severity === "critical").length,
      high: operationVulns.filter(v => v.severity === "high").length,
      medium: operationVulns.filter(v => v.severity === "medium").length,
      low: operationVulns.filter(v => v.severity === "low").length,
      informational: operationVulns.filter(v => v.severity === "informational").length,
      recent: operationVulns.slice(0, 5).map(v => ({
        title: v.title,
        severity: v.severity,
        status: v.status,
        targetId: v.targetId,
        discoveredAt: v.discoveredAt,
      })),
    };

    // DATA SOURCE 7: Reporter agents
    const allAgents = await db.select().from(agents);
    const reporters = allAgents.filter((agent) => {
      const config = agent.config as any;
      return config?.role === "page_reporter";
    });

    const reportersSummary = {
      total: reporters.length,
      active: reporters.filter(a => a.status === "running").length,
      pages: reporters.map(r => {
        const config = r.config as any;
        return config?.pageId || "unknown";
      }),
    };

    // DATA SOURCE 8: Latest operations manager synthesis
    const latestSynthesis = await db
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

    // Build comprehensive context for Operations Manager
    const contextSummary = {
      // Current Operation
      currentOperation: {
        id: operation[0].id,
        name: operation[0].name,
        description: operation[0].description,
        status: operation[0].status,
        objectives: operation[0].objectives,
        scope: operation[0].scope,
        startDate: operation[0].startDate,
        endDate: operation[0].endDate,
        hourlyReportingEnabled: operation[0].hourlyReportingEnabled,
        createdAt: operation[0].createdAt,
      },
      
      // Global Operations Stats
      operationsOverview: operationsStats,
      
      // Targets
      targets: targetsSummary,
      
      // Vulnerabilities
      vulnerabilities: vulnStats,
      
      // Workflows
      workflows: workflowStats,
      
      // Reporter Agents
      reporters: reportersSummary,
      
      // Recent Activity Reports
      recentActivity: recentReports.slice(0, 5).map(r => ({
        pageRole: r.agentPageRole,
        activitySummary: r.activitySummary,
        keyMetrics: r.keyMetrics,
        changesDetected: r.changesDetected,
        issuesReported: r.issuesReported,
        recommendations: r.recommendations,
        generatedAt: r.generatedAt,
      })),
      
      // Questions
      questions: {
        pending: pendingQuestions.length,
        answered: answeredQuestions.length,
        recentPending: pendingQuestions.slice(0, 3).map(q => ({
          question: q.question,
          questionType: q.questionType,
          askedAt: q.askedAt,
        })),
      },
      
      // Latest Manager Synthesis
      latestSynthesis: latestSynthesis.length > 0 ? {
        completedAt: latestSynthesis[0].completedAt,
        decisions: latestSynthesis[0].decisions,
        outputData: latestSynthesis[0].outputData,
      } : null,
    };

    // Build messages for AI
    const aiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: `You are the Operations Manager for the Red Team Portable Infrastructure (RTPI). You help coordinate security operations, manage agent workflows, and provide insights.

COMPREHENSIVE OPERATION CONTEXT:
${JSON.stringify(contextSummary, null, 2)}

DATA SOURCES AVAILABLE TO YOU:
1. Current Operation Details - Name, status, objectives, scope, dates
2. Global Operations Stats - Total count across all statuses
3. Targets - All targets associated with this operation (${contextSummary.targets.total} total)
4. Vulnerabilities - Severity breakdown and recent findings (${contextSummary.vulnerabilities.total} total)
5. Workflows - Execution history and current status (${contextSummary.workflows.total} total)
6. Reporter Agents - Active page reporters monitoring different sections (${contextSummary.reporters.total} reporters)
7. Recent Activity - Latest reports from page reporters (last 10 reports)
8. Questions - Pending and answered questions from the system
9. Latest Synthesis - Most recent manager analysis (if available)

YOUR RESPONSIBILITIES:
- Answer questions about operation status, targets, vulnerabilities, and workflows
- Provide accurate counts and statistics from the data above
- Recommend next steps based on current operation state
- Help troubleshoot issues using recent activity reports
- Coordinate insights from different page reporter agents
- Suggest workflow improvements and optimizations

RESPONSE GUIDELINES:
- Be concise but thorough
- Use data from the context above to provide accurate answers
- Reference specific metrics when available (e.g., "3 active operations", "15 vulnerabilities found")
- Use technical language appropriate for security professionals
- If you don't have specific data to answer a question, say so clearly`,
      },
    ];

    // Add conversation history
    conversationHistory.forEach((msg) => {
      aiMessages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    });

    // Add current message
    aiMessages.push({
      role: "user",
      content: message,
    });

    // Call AI inference (will use OpenAI/Anthropic if configured, fallback to Ollama)
    const aiResponse = await ollamaAIClient.complete(aiMessages, {
      temperature: 0.7,
      maxTokens: 1024,
      provider: undefined, // Auto-select best provider
      useCache: false, // Don't cache chat responses
    });

    if (!aiResponse.success) {
      throw new Error(aiResponse.error || "AI inference failed");
    }

    res.json({
      response: aiResponse.content,
      provider: aiResponse.provider,
      model: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
    });
  } catch (error) {
    console.error("Error in operations manager chat:", error);
    res.status(500).json({
      error: "Failed to process chat message",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
