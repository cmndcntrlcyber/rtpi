import { EventEmitter } from "events";
import { db } from "../../db";
import { agents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { memoryService, SearchResult, AddMemoryParams } from "../memory-service";
import { agentMessageBus, AgentMessage } from "../agent-message-bus";
import { agentConfig } from "../../config/agent-config";

// ============================================================================
// Types
// ============================================================================

export interface TaskDefinition {
  id?: string;
  taskType: string;
  taskName: string;
  description?: string;
  operationId?: string;
  targetId?: string;
  parameters: Record<string, any>;
  priority?: number;
}

export interface TaskResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  memoryIds?: string[];
}

// ============================================================================
// Base Task Agent
// ============================================================================

export abstract class BaseTaskAgent extends EventEmitter {
  protected agentId: string | null = null;
  protected agentName: string;
  protected agentRole: string;
  protected capabilities: string[];
  private _initialized = false;

  constructor(name: string, role: string, capabilities: string[]) {
    super();
    this.agentName = name;
    this.agentRole = role;
    this.capabilities = capabilities;
  }

  /** Must be implemented by subclasses */
  abstract executeTask(task: TaskDefinition): Promise<TaskResult>;

  /** Initialize agent: ensure DB record exists, register with message bus */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    // Find or create agent in database
    const existing = await db
      .select()
      .from(agents)
      .where(eq(agents.name, this.agentName))
      .limit(1);

    if (existing.length > 0) {
      this.agentId = existing[0].id;
    } else {
      const [created] = await db
        .insert(agents)
        .values({
          name: this.agentName,
          type: "custom",
          status: "idle",
          description: `${this.agentName} - ${this.agentRole}`,
          capabilities: this.capabilities,
          config: { agentRole: this.agentRole },
        })
        .returning();
      this.agentId = created.id;
    }

    // Register with message bus
    await agentMessageBus.registerAgent({
      agentId: this.agentId,
      agentRole: this.agentRole,
      agentType: "task_agent",
      capabilities: this.capabilities,
      messageTypesHandled: ["task", "question"],
    });

    this._initialized = true;
    console.log(`[${this.agentName}] Initialized with ID ${this.agentId}`);
  }

  // ============================================================================
  // Memory Integration
  // ============================================================================

  async getRelevantMemories(context: {
    operationId?: string;
    targetId?: string;
    taskType?: string;
    limit?: number;
  }): Promise<SearchResult[]> {
    if (!agentConfig.taskAgent.memoryEnabled) return [];

    const query = [context.taskType, this.agentRole].filter(Boolean).join(" ");
    if (!query || !context.operationId) return [];

    try {
      return await memoryService.searchMemories({
        query,
        contextId: context.operationId,
        limit: context.limit || 10,
      });
    } catch (error) {
      console.error(`[${this.agentName}] Memory query failed:`, error);
      return [];
    }
  }

  async storeTaskMemory(params: {
    task: TaskDefinition;
    result: TaskResult;
    memoryType?: "fact" | "event" | "insight" | "pattern";
  }): Promise<string | null> {
    if (!agentConfig.taskAgent.memoryEnabled || !params.task.operationId) return null;

    try {
      // Ensure operation has a memory context
      const context = await memoryService.createContext({
        contextType: "operation",
        contextId: params.task.operationId,
        contextName: `Operation ${params.task.operationId}`,
      });

      const memoryParams: AddMemoryParams = {
        contextId: context.id,
        memoryText: `[${params.task.taskType}] ${params.task.taskName}: ${params.result.success ? "Completed" : "Failed"}${params.result.error ? ` - ${params.result.error}` : ""}`,
        memoryType: params.memoryType || "event",
        sourceAgentId: this.agentId || undefined,
        tags: [params.task.taskType, this.agentRole, params.result.success ? "success" : "failure"],
        metadata: {
          taskId: params.task.id,
          taskType: params.task.taskType,
          agentName: this.agentName,
          resultData: params.result.data,
        },
      };

      const memory = await memoryService.addMemory(memoryParams);
      return memory.id;
    } catch (error) {
      console.error(`[${this.agentName}] Failed to store task memory:`, error);
      return null;
    }
  }

  // ============================================================================
  // Communication
  // ============================================================================

  async reportProgress(taskId: string, progress: number, message: string): Promise<void> {
    this.emit("task_progress", { taskId, progress, message, agentId: this.agentId });

    if (this.agentId) {
      await agentMessageBus.sendMessage({
        messageType: "status",
        from: { agentId: this.agentId, agentRole: this.agentRole },
        broadcastToRole: "operations_manager",
        subject: `Task Progress: ${progress}%`,
        content: {
          summary: message,
          data: { taskId, progress },
        },
      });
    }
  }

  async askQuestion(question: string, context: Record<string, any>, priority: number = 5): Promise<void> {
    this.emit("question_generated", {
      question,
      context,
      priority,
      agentId: this.agentId,
      agentName: this.agentName,
    });
  }

  // ============================================================================
  // Status Management
  // ============================================================================

  protected async updateStatus(status: "idle" | "running" | "error"): Promise<void> {
    if (!this.agentId) return;
    await db
      .update(agents)
      .set({ status, lastActivity: new Date() })
      .where(eq(agents.id, this.agentId));
  }

  get isInitialized(): boolean {
    return this._initialized;
  }
}
