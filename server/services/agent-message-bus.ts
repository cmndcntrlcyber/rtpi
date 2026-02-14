import { EventEmitter } from "events";
import { db } from "../db";
import {
  agentMessages,
  agentRegistry,
  agentMessageSubscriptions,
} from "@shared/schema";
import { eq, and, or, desc, lt, sql } from "drizzle-orm";
import { agentConfig } from "../config/agent-config";

// ============================================================================
// Types
// ============================================================================

export interface AgentMessage {
  messageType: "report" | "task" | "question" | "response" | "alert" | "status" | "data";
  from: {
    agentId: string;
    agentRole: string;
  };
  to?: {
    agentId?: string;
    agentRole?: string;
  };
  broadcastToRole?: string;
  operationId?: string;
  targetId?: string;
  workflowId?: string;
  priority?: "critical" | "high" | "normal" | "low" | "background";
  subject: string;
  content: {
    summary: string;
    data: Record<string, any>;
    context?: Record<string, any>;
  };
  memoryContext?: {
    relevantMemories: string[];
    shouldStore: boolean;
    memoryType?: "fact" | "event" | "insight" | "pattern";
  };
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface AgentInfo {
  agentId: string;
  agentRole: string;
  agentType: string;
  capabilities?: string[];
  messageTypesHandled?: string[];
  maxQueueSize?: number;
  processingTimeoutMs?: number;
}

export interface MessageFilter {
  status?: string;
  messageType?: string;
  operationId?: string;
  fromAgentId?: string;
  toAgentId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Agent Message Bus
// ============================================================================

export class AgentMessageBus extends EventEmitter {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (!agentConfig.messageBus.enabled) {
      console.log("[MessageBus] Message bus disabled by configuration");
      return;
    }

    console.log("[MessageBus] Initializing Agent Message Bus...");
    this.startCleanupTask();
    this.startHeartbeatMonitoring();
    console.log("[MessageBus] Agent Message Bus initialized");
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    console.log("[MessageBus] Agent Message Bus shutdown");
  }

  // ============================================================================
  // Agent Registration
  // ============================================================================

  async registerAgent(agentInfo: AgentInfo): Promise<void> {
    const existing = await db
      .select()
      .from(agentRegistry)
      .where(eq(agentRegistry.agentId, agentInfo.agentId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(agentRegistry)
        .set({
          agentRole: agentInfo.agentRole,
          agentType: agentInfo.agentType,
          capabilities: agentInfo.capabilities || [],
          messageTypesHandled: agentInfo.messageTypesHandled || [],
          isActive: true,
          lastHeartbeatAt: new Date(),
          maxQueueSize: agentInfo.maxQueueSize || agentConfig.messageBus.maxQueueSizePerAgent,
          processingTimeoutMs: agentInfo.processingTimeoutMs || 300000,
          updatedAt: new Date(),
        })
        .where(eq(agentRegistry.agentId, agentInfo.agentId));
    } else {
      await db.insert(agentRegistry).values({
        agentId: agentInfo.agentId,
        agentRole: agentInfo.agentRole,
        agentType: agentInfo.agentType,
        capabilities: agentInfo.capabilities || [],
        messageTypesHandled: agentInfo.messageTypesHandled || [],
        maxQueueSize: agentInfo.maxQueueSize || agentConfig.messageBus.maxQueueSizePerAgent,
        processingTimeoutMs: agentInfo.processingTimeoutMs || 300000,
      });
    }

    this.emit("agent_registered", { agentId: agentInfo.agentId, agentRole: agentInfo.agentRole });
    console.log(`[MessageBus] Agent registered: ${agentInfo.agentRole} (${agentInfo.agentId})`);
  }

  async unregisterAgent(agentId: string): Promise<void> {
    await db
      .update(agentRegistry)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(agentRegistry.agentId, agentId));

    this.emit("agent_unregistered", { agentId });
    console.log(`[MessageBus] Agent unregistered: ${agentId}`);
  }

  async getAgentRegistry(): Promise<(typeof agentRegistry.$inferSelect)[]> {
    return db
      .select()
      .from(agentRegistry)
      .where(eq(agentRegistry.isActive, true))
      .orderBy(desc(agentRegistry.lastHeartbeatAt));
  }

  async heartbeat(agentId: string): Promise<void> {
    await db
      .update(agentRegistry)
      .set({ lastHeartbeatAt: new Date(), updatedAt: new Date() })
      .where(eq(agentRegistry.agentId, agentId));
  }

  // ============================================================================
  // Message Sending
  // ============================================================================

  async sendMessage(message: AgentMessage): Promise<string> {
    if (!message.from.agentId || !message.from.agentRole) {
      throw new Error("Message must have valid from.agentId and from.agentRole");
    }
    if (!message.to?.agentId && !message.to?.agentRole && !message.broadcastToRole) {
      throw new Error("Message must have either 'to' or 'broadcastToRole'");
    }

    const [stored] = await db
      .insert(agentMessages)
      .values({
        messageType: message.messageType as any,
        fromAgentId: message.from.agentId,
        fromAgentRole: message.from.agentRole,
        toAgentId: message.to?.agentId || null,
        toAgentRole: message.to?.agentRole || null,
        broadcastToRole: message.broadcastToRole || null,
        operationId: message.operationId || null,
        targetId: message.targetId || null,
        workflowId: message.workflowId || null,
        priority: (message.priority || "normal") as any,
        subject: message.subject,
        contentSummary: message.content.summary,
        contentData: message.content.data,
        contextData: message.content.context || {},
        relevantMemoryIds: message.memoryContext?.relevantMemories || [],
        shouldStoreInMemory: message.memoryContext?.shouldStore || false,
        memoryType: message.memoryContext?.memoryType || null,
        expiresAt: message.expiresAt || null,
        metadata: message.metadata || {},
      })
      .returning();

    this.emit("message_sent", {
      messageId: stored.id,
      messageType: message.messageType,
      from: message.from,
      to: message.to,
      broadcastToRole: message.broadcastToRole,
    });

    console.log(
      `[MessageBus] Message sent: ${message.messageType} from ${message.from.agentRole} → ${message.to?.agentRole || message.broadcastToRole || "unknown"}`,
    );

    return stored.id;
  }

  async broadcastToRole(
    role: string,
    message: Omit<AgentMessage, "to" | "broadcastToRole">,
  ): Promise<string> {
    return this.sendMessage({ ...message, broadcastToRole: role });
  }

  // ============================================================================
  // Message Retrieval
  // ============================================================================

  async getMessagesForAgent(
    agentId: string,
    filter?: Partial<MessageFilter>,
  ): Promise<(typeof agentMessages.$inferSelect)[]> {
    // Get the agent's role for broadcast matching
    const [reg] = await db
      .select()
      .from(agentRegistry)
      .where(eq(agentRegistry.agentId, agentId))
      .limit(1);

    const agentRole = reg?.agentRole;

    const conditions = [
      or(
        eq(agentMessages.toAgentId, agentId),
        agentRole ? eq(agentMessages.broadcastToRole, agentRole) : undefined,
      ),
    ].filter(Boolean);

    if (filter?.status) {
      conditions.push(eq(agentMessages.status, filter.status as any));
    }

    const query = db
      .select()
      .from(agentMessages)
      .where(and(...(conditions as any)))
      .orderBy(desc(agentMessages.createdAt))
      .limit(filter?.limit || 50)
      .offset(filter?.offset || 0);

    return query;
  }

  async getMessageHistory(filter: MessageFilter): Promise<(typeof agentMessages.$inferSelect)[]> {
    const conditions: any[] = [];

    if (filter.operationId) {
      conditions.push(eq(agentMessages.operationId, filter.operationId));
    }
    if (filter.fromAgentId) {
      conditions.push(eq(agentMessages.fromAgentId, filter.fromAgentId));
    }
    if (filter.toAgentId) {
      conditions.push(eq(agentMessages.toAgentId, filter.toAgentId));
    }
    if (filter.messageType) {
      conditions.push(eq(agentMessages.messageType, filter.messageType as any));
    }

    const query = db
      .select()
      .from(agentMessages)
      .orderBy(desc(agentMessages.createdAt))
      .limit(filter.limit || 100)
      .offset(filter.offset || 0);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }

  // ============================================================================
  // Message Status Updates
  // ============================================================================

  async markAsDelivered(messageId: string): Promise<void> {
    await db
      .update(agentMessages)
      .set({ status: "delivered" as any, deliveredAt: new Date() })
      .where(eq(agentMessages.id, messageId));
    this.emit("message_delivered", { messageId });
  }

  async markAsRead(messageId: string): Promise<void> {
    await db
      .update(agentMessages)
      .set({ status: "read" as any, readAt: new Date() })
      .where(eq(agentMessages.id, messageId));
    this.emit("message_read", { messageId });
  }

  async markAsProcessed(messageId: string): Promise<void> {
    await db
      .update(agentMessages)
      .set({ status: "processed" as any, processedAt: new Date() })
      .where(eq(agentMessages.id, messageId));
    this.emit("message_processed", { messageId });
  }

  // ============================================================================
  // Subscriptions
  // ============================================================================

  async subscribe(params: {
    agentId: string;
    messageType?: string;
    fromAgentRole?: string;
    operationId?: string;
    autoProcess?: boolean;
  }): Promise<string> {
    const [sub] = await db
      .insert(agentMessageSubscriptions)
      .values({
        agentId: params.agentId,
        messageType: params.messageType as any,
        fromAgentRole: params.fromAgentRole || null,
        operationId: params.operationId || null,
        autoProcess: params.autoProcess || false,
      })
      .returning();

    return sub.id;
  }

  async getSubscriptions(agentId: string): Promise<(typeof agentMessageSubscriptions.$inferSelect)[]> {
    return db
      .select()
      .from(agentMessageSubscriptions)
      .where(
        and(
          eq(agentMessageSubscriptions.agentId, agentId),
          eq(agentMessageSubscriptions.isActive, true),
        ),
      );
  }

  // ============================================================================
  // Background Tasks
  // ============================================================================

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        const now = new Date();
        await db
          .update(agentMessages)
          .set({ status: "expired" as any })
          .where(
            and(
              eq(agentMessages.status, "queued" as any),
              lt(agentMessages.expiresAt, now),
            ),
          );
      } catch (error) {
        console.error("[MessageBus] Cleanup failed:", error);
      }
    }, agentConfig.messageBus.cleanupIntervalMs);
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const staleThreshold = new Date(
          Date.now() - agentConfig.messageBus.staleAgentThresholdMs,
        );
        await db
          .update(agentRegistry)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(agentRegistry.isActive, true),
              lt(agentRegistry.lastHeartbeatAt, staleThreshold),
            ),
          );
      } catch (error) {
        console.error("[MessageBus] Heartbeat monitoring failed:", error);
      }
    }, agentConfig.messageBus.heartbeatIntervalMs);
  }
}

// Singleton instance
export const agentMessageBus = new AgentMessageBus();
