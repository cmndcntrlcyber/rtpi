import { db } from "../db";
import {
  agentConversations,
  agentConversationMessages,
} from "../../shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export class AgentConversationService {
  /**
   * Get or create an active conversation for a user + agent + operation combo.
   * Returns the existing active conversation or creates a new one.
   */
  async getOrCreateConversation(params: {
    userId: string;
    agentRole: string;
    operationId: string;
    agentId?: string;
  }) {
    // Look for an existing active conversation
    const existing = await db
      .select()
      .from(agentConversations)
      .where(
        and(
          eq(agentConversations.userId, params.userId),
          eq(agentConversations.agentRole, params.agentRole),
          eq(agentConversations.operationId, params.operationId),
          eq(agentConversations.status, "active")
        )
      )
      .orderBy(desc(agentConversations.lastMessageAt))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Create a new conversation
    const [conversation] = await db
      .insert(agentConversations)
      .values({
        userId: params.userId,
        agentRole: params.agentRole,
        operationId: params.operationId,
        agentId: params.agentId || null,
      })
      .returning();

    return conversation;
  }

  /**
   * Add a message to a conversation and update conversation metadata.
   */
  async addMessage(params: {
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    provider?: string;
    model?: string;
    tokensUsed?: number;
    promptTokens?: number;
    completionTokens?: number;
    durationMs?: number;
    contextSummary?: Record<string, unknown>;
  }) {
    const [message] = await db
      .insert(agentConversationMessages)
      .values({
        conversationId: params.conversationId,
        role: params.role,
        content: params.content,
        provider: params.provider,
        model: params.model,
        tokensUsed: params.tokensUsed,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        durationMs: params.durationMs,
        contextSummary: params.contextSummary,
      })
      .returning();

    // Update conversation metadata
    const preview = params.content.slice(0, 200);
    const tokenIncrement = params.tokensUsed || 0;

    await db
      .update(agentConversations)
      .set({
        lastMessagePreview: preview,
        lastMessageAt: new Date(),
        messageCount: sql`${agentConversations.messageCount} + 1`,
        totalTokensUsed: sql`${agentConversations.totalTokensUsed} + ${tokenIncrement}`,
        lastProvider: params.provider || undefined,
        lastModel: params.model || undefined,
        updatedAt: new Date(),
        // Auto-generate title from first user message
        ...(params.role === "user"
          ? {
              title: sql`CASE WHEN ${agentConversations.title} IS NULL THEN ${params.content.slice(0, 100)} ELSE ${agentConversations.title} END`,
            }
          : {}),
      })
      .where(eq(agentConversations.id, params.conversationId));

    return message;
  }

  /**
   * Get conversation messages for loading history.
   */
  async getMessages(conversationId: string, limit = 50) {
    return db
      .select()
      .from(agentConversationMessages)
      .where(eq(agentConversationMessages.conversationId, conversationId))
      .orderBy(agentConversationMessages.createdAt)
      .limit(limit);
  }

  /**
   * List conversations for a user, optionally filtered by operation or agent role.
   */
  async listConversations(params: {
    userId: string;
    operationId?: string;
    agentRole?: string;
    limit?: number;
  }) {
    const conditions = [
      eq(agentConversations.userId, params.userId),
      eq(agentConversations.status, "active"),
    ];

    if (params.operationId) {
      conditions.push(eq(agentConversations.operationId, params.operationId));
    }
    if (params.agentRole) {
      conditions.push(eq(agentConversations.agentRole, params.agentRole));
    }

    return db
      .select()
      .from(agentConversations)
      .where(and(...conditions))
      .orderBy(desc(agentConversations.lastMessageAt))
      .limit(params.limit || 20);
  }

  /**
   * Archive a conversation.
   */
  async archiveConversation(conversationId: string) {
    await db
      .update(agentConversations)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(agentConversations.id, conversationId));
  }

  /**
   * Delete a conversation (soft delete).
   */
  async deleteConversation(conversationId: string) {
    await db
      .update(agentConversations)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(agentConversations.id, conversationId));
  }

  /**
   * Get a single conversation by ID.
   */
  async getConversation(conversationId: string) {
    const [conversation] = await db
      .select()
      .from(agentConversations)
      .where(eq(agentConversations.id, conversationId))
      .limit(1);

    return conversation || null;
  }
}

export const agentConversationService = new AgentConversationService();
