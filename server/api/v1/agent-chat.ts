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
  targets,
  vulnerabilities,
} from "../../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { ollamaAIClient } from "../../services/ollama-ai-client";
import { agentConversationService } from "../../services/agent-conversation-service";

const router = express.Router();

// ============================================================================
// Agent-specific system prompts
// ============================================================================

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  operations_manager: `You are the Operations Manager for the Red Team Portable Infrastructure (RTPI). You help coordinate security operations, manage agent workflows, and provide insights.

YOUR RESPONSIBILITIES:
- Answer questions about operation status, targets, vulnerabilities, and workflows
- Provide accurate counts and statistics from the operation context
- Recommend next steps based on current operation state
- Help troubleshoot issues using recent activity reports
- Coordinate insights from different page reporter agents
- Suggest workflow improvements and optimizations

RESPONSE GUIDELINES:
- Be concise but thorough
- Use data from the context to provide accurate answers
- Reference specific metrics when available
- Use technical language appropriate for security professionals
- If you don't have specific data to answer a question, say so clearly`,
};

// ============================================================================
// Helper: Build operation context for Operations Manager
// ============================================================================

async function buildOperationContext(operationId: string) {
  const operation = await db
    .select()
    .from(operations)
    .where(eq(operations.id, operationId))
    .limit(1);

  if (operation.length === 0) return null;

  // Fetch context data in parallel
  const [
    allOperations,
    recentReports,
    allQuestions,
    allWorkflows,
    operationTargets,
    operationVulns,
    allAgents,
    latestSynthesis,
  ] = await Promise.all([
    db.select().from(operations),
    db
      .select()
      .from(agentActivityReports)
      .where(eq(agentActivityReports.operationId, operationId))
      .orderBy(desc(agentActivityReports.generatedAt))
      .limit(10),
    db
      .select()
      .from(assetQuestions)
      .where(eq(assetQuestions.operationId, operationId))
      .orderBy(desc(assetQuestions.askedAt))
      .limit(20),
    db
      .select()
      .from(agentWorkflows)
      .where(eq(agentWorkflows.operationId, operationId))
      .orderBy(desc(agentWorkflows.createdAt))
      .limit(10),
    db
      .select()
      .from(targets)
      .where(eq(targets.operationId, operationId)),
    db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.operationId, operationId))
      .orderBy(desc(vulnerabilities.discoveredAt))
      .limit(20),
    db.select().from(agents),
    db
      .select()
      .from(operationsManagerTasks)
      .where(
        and(
          eq(operationsManagerTasks.operationId, operationId),
          eq(operationsManagerTasks.taskType, "synthesis")
        )
      )
      .orderBy(desc(operationsManagerTasks.completedAt))
      .limit(1),
  ]);

  const pendingQuestions = allQuestions.filter((q) => q.status === "pending");
  const reporters = allAgents.filter((agent) => {
    const config = agent.config as any;
    return config?.role === "page_reporter";
  });

  return {
    currentOperation: {
      id: operation[0].id,
      name: operation[0].name,
      description: operation[0].description,
      status: operation[0].status,
      objectives: operation[0].objectives,
      scope: operation[0].scope,
      startDate: operation[0].startDate,
      endDate: operation[0].endDate,
    },
    operationsOverview: {
      total: allOperations.length,
      active: allOperations.filter((o) => o.status === "active").length,
      planning: allOperations.filter((o) => o.status === "planning").length,
      completed: allOperations.filter((o) => o.status === "completed").length,
    },
    targets: {
      total: operationTargets.length,
      list: operationTargets.slice(0, 10).map((t) => ({
        name: t.name,
        type: t.type,
        value: t.value,
        priority: t.priority,
      })),
    },
    vulnerabilities: {
      total: operationVulns.length,
      critical: operationVulns.filter((v) => v.severity === "critical").length,
      high: operationVulns.filter((v) => v.severity === "high").length,
      medium: operationVulns.filter((v) => v.severity === "medium").length,
      low: operationVulns.filter((v) => v.severity === "low").length,
      recent: operationVulns.slice(0, 5).map((v) => ({
        title: v.title,
        severity: v.severity,
        status: v.status,
      })),
    },
    workflows: {
      total: allWorkflows.length,
      running: allWorkflows.filter((w) => w.status === "running").length,
      completed: allWorkflows.filter((w) => w.status === "completed").length,
      failed: allWorkflows.filter((w) => w.status === "failed").length,
    },
    reporters: {
      total: reporters.length,
      active: reporters.filter((a) => a.status === "running").length,
    },
    recentActivity: recentReports.slice(0, 5).map((r) => ({
      pageRole: r.agentPageRole,
      activitySummary: r.activitySummary,
      keyMetrics: r.keyMetrics,
      generatedAt: r.generatedAt,
    })),
    questions: {
      pending: pendingQuestions.length,
      total: allQuestions.length,
    },
    latestSynthesis:
      latestSynthesis.length > 0
        ? {
            completedAt: latestSynthesis[0].completedAt,
            decisions: latestSynthesis[0].decisions,
          }
        : null,
  };
}

// ============================================================================
// POST /api/v1/agent-chat/:agentRole/message
// Send a message to an agent and get a response (with persistence)
// ============================================================================

const sendMessageSchema = z.object({
  operationId: z.string().uuid(),
  message: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
});

router.post("/:agentRole/message", async (req, res) => {
  try {
    const { agentRole } = req.params;
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const { operationId, message, conversationId: existingConversationId } = parsed.data;

    // Verify operation exists
    const operation = await db
      .select()
      .from(operations)
      .where(eq(operations.id, operationId))
      .limit(1);

    if (operation.length === 0) {
      return res.status(404).json({ error: "Operation not found" });
    }

    // Get or create conversation
    // Use a placeholder userId for now (auth integration will provide real userId)
    const userId = (req as any).user?.id || "00000000-0000-0000-0000-000000000001";

    let conversation;
    if (existingConversationId) {
      conversation = await agentConversationService.getConversation(existingConversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
    } else {
      conversation = await agentConversationService.getOrCreateConversation({
        userId,
        agentRole,
        operationId,
      });
    }

    // Save user message
    await agentConversationService.addMessage({
      conversationId: conversation.id,
      role: "user",
      content: message,
    });

    // Load conversation history from DB
    const historyMessages = await agentConversationService.getMessages(conversation.id, 40);

    // Build context based on agent role
    let contextStr = "";
    let contextSummary: Record<string, unknown> = {};

    if (agentRole === "operations_manager") {
      const context = await buildOperationContext(operationId);
      if (context) {
        contextStr = `\nCOMPREHENSIVE OPERATION CONTEXT:\n${JSON.stringify(context, null, 2)}`;
        contextSummary = { type: "operation_context", operationId };
      }
    }

    // Build AI messages
    const systemPrompt = AGENT_SYSTEM_PROMPTS[agentRole] ||
      `You are an AI agent assistant for the Red Team Portable Infrastructure (RTPI). Your role is: ${agentRole}. Help the user with their security operations questions and tasks.`;

    const aiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: systemPrompt + contextStr,
      },
    ];

    // Add conversation history (skip system messages, include user/assistant)
    for (const msg of historyMessages) {
      if (msg.role === "user" || msg.role === "assistant") {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // Call AI inference
    const aiResponse = await ollamaAIClient.complete(aiMessages, {
      temperature: 0.7,
      maxTokens: 1024,
      provider: undefined,
      useCache: false,
    });

    if (!aiResponse.success) {
      throw new Error(aiResponse.error || "AI inference failed");
    }

    // Save assistant response
    const assistantMessage = await agentConversationService.addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: aiResponse.content,
      provider: aiResponse.provider,
      model: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      promptTokens: aiResponse.promptTokens,
      completionTokens: aiResponse.completionTokens,
      durationMs: aiResponse.durationMs,
      contextSummary,
    });

    res.json({
      conversationId: conversation.id,
      message: {
        id: assistantMessage.id,
        role: "assistant",
        content: aiResponse.content,
        createdAt: assistantMessage.createdAt,
      },
      provider: aiResponse.provider,
      model: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
    });
  } catch (error) {
    console.error("Error in agent chat:", error);
    res.status(500).json({
      error: "Failed to process chat message",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// GET /api/v1/agent-chat/:agentRole/conversation
// Get the active conversation and its messages for a given agent + operation
// ============================================================================

router.get("/:agentRole/conversation", async (req, res) => {
  try {
    const { agentRole } = req.params;
    const { operationId } = req.query;

    if (!operationId || typeof operationId !== "string") {
      return res.status(400).json({ error: "operationId query parameter required" });
    }

    const userId = (req as any).user?.id || "00000000-0000-0000-0000-000000000001";

    const conversations = await agentConversationService.listConversations({
      userId,
      operationId,
      agentRole,
      limit: 1,
    });

    if (conversations.length === 0) {
      return res.json({ conversation: null, messages: [] });
    }

    const conversation = conversations[0];
    const messages = await agentConversationService.getMessages(conversation.id);

    res.json({
      conversation,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        provider: m.provider,
        model: m.model,
        tokensUsed: m.tokensUsed,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// ============================================================================
// GET /api/v1/agent-chat/conversations
// List all conversations for the current user
// ============================================================================

router.get("/conversations", async (req, res) => {
  try {
    const { operationId } = req.query;
    const userId = (req as any).user?.id || "00000000-0000-0000-0000-000000000001";

    const conversations = await agentConversationService.listConversations({
      userId,
      operationId: operationId as string | undefined,
    });

    res.json({ conversations });
  } catch (error) {
    console.error("Error listing conversations:", error);
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

// ============================================================================
// GET /api/v1/agent-chat/:conversationId/messages
// Get messages for a specific conversation
// ============================================================================

router.get("/:conversationId/messages", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await agentConversationService.getMessages(conversationId);

    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        provider: m.provider,
        model: m.model,
        tokensUsed: m.tokensUsed,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ============================================================================
// DELETE /api/v1/agent-chat/:agentRole/conversation
// Archive (soft-delete) the active conversation for an agent + operation
// ============================================================================

router.delete("/:agentRole/conversation", async (req, res) => {
  try {
    const { agentRole } = req.params;
    const { operationId } = req.query;

    if (!operationId || typeof operationId !== "string") {
      return res.status(400).json({ error: "operationId query parameter required" });
    }

    const userId = (req as any).user?.id || "00000000-0000-0000-0000-000000000001";

    const conversations = await agentConversationService.listConversations({
      userId,
      operationId,
      agentRole,
      limit: 1,
    });

    if (conversations.length === 0) {
      return res.json({ success: true, message: "No active conversation to archive" });
    }

    await agentConversationService.archiveConversation(conversations[0].id);
    res.json({ success: true, message: "Conversation archived" });
  } catch (error) {
    console.error("Error archiving conversation:", error);
    res.status(500).json({ error: "Failed to archive conversation" });
  }
});

export default router;
