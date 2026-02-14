import { Router } from "express";
import { z } from "zod";
import { db } from "../../db";
import { agentMessages, agentRegistry } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";
import { agentMessageBus } from "../../services/agent-message-bus";

const router = Router();

router.use(ensureAuthenticated);

// ============================================================================
// Agent Registry
// ============================================================================

/**
 * GET /api/v1/agent-messages/agents/registry
 * List all registered agents
 */
router.get("/agents/registry", async (_req, res) => {
  try {
    const registry = await agentMessageBus.getAgentRegistry();
    res.json({ agents: registry });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get agent registry", details: error?.message });
  }
});

// ============================================================================
// Messages
// ============================================================================

/**
 * GET /api/v1/agent-messages/messages/:agentId
 * Get messages for a specific agent
 */
router.get("/messages/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status, messageType, limit = "50" } = req.query;

    const messages = await agentMessageBus.getMessagesForAgent(agentId, {
      status: status as string | undefined,
      messageType: messageType as string | undefined,
      limit: Math.min(parseInt(limit as string) || 50, 200),
    });

    res.json({ messages, count: messages.length });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get messages", details: error?.message });
  }
});

const sendMessageSchema = z.object({
  messageType: z.enum(["report", "task", "question", "response", "alert", "status", "data"]),
  toAgentId: z.string().optional(),
  broadcastToRole: z.string().optional(),
  operationId: z.string().optional(),
  priority: z.enum(["critical", "high", "normal", "low", "background"]).default("normal"),
  subject: z.string().min(1),
  contentSummary: z.string().optional(),
  contentData: z.record(z.any()).optional(),
});

/**
 * POST /api/v1/agent-messages/messages
 * Send a message (requires admin or operator role)
 */
router.post("/messages", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    const data = parsed.data;

    const messageId = await agentMessageBus.sendMessage({
      messageType: data.messageType,
      from: { agentId: "system", agentRole: "system" },
      toAgentId: data.toAgentId,
      broadcastToRole: data.broadcastToRole,
      operationId: data.operationId,
      priority: data.priority,
      subject: data.subject,
      content: {
        summary: data.contentSummary || data.subject,
        data: data.contentData || {},
      },
    });

    res.status(201).json({ messageId, success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to send message", details: error?.message });
  }
});

/**
 * GET /api/v1/agent-messages/messages/history
 * Get message history with filters
 */
router.get("/history", async (req, res) => {
  try {
    const { operationId, agentId, messageType, limit = "50", offset = "0" } = req.query;

    const messages = await agentMessageBus.getMessageHistory({
      operationId: operationId as string | undefined,
      agentId: agentId as string | undefined,
      messageType: messageType as string | undefined,
      limit: Math.min(parseInt(limit as string) || 50, 200),
      offset: parseInt(offset as string) || 0,
    });

    res.json({ messages, count: messages.length });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get message history", details: error?.message });
  }
});

export default router;
