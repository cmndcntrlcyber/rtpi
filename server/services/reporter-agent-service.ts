import { db } from "../db";
import {
  reporters,
  reporterQuestions,
  reporterTasks,
  agents,
} from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { EventEmitter } from "events";

interface ReporterConfig {
  pollIntervalMs?: number;
  maxHistorySize?: number;
  autoAnalyze?: boolean;
}

interface PolledData {
  timestamp: Date;
  data: Record<string, any>;
  changes: string[];
}

interface ReporterStatus {
  reporterId: string;
  status: string;
  lastPollAt: Date | null;
  polledData: Record<string, any>;
  pendingQuestions: number;
  activeTasks: number;
}

class ReporterAgentService extends EventEmitter {
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize the reporter service and start all active reporters
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log("[ReporterService] Initializing reporter agent service...");

    // Get all active reporters and start polling
    const activeReporters = await db
      .select()
      .from(reporters)
      .where(eq(reporters.status, "active"));

    for (const reporter of activeReporters) {
      await this.startPolling(reporter.id);
    }

    this.isInitialized = true;
    console.log(`[ReporterService] Initialized with ${activeReporters.length} active reporters`);
  }

  /**
   * Create a new reporter
   */
  async createReporter(params: {
    agentId: string;
    name: string;
    pageId: string;
    pageUrl?: string;
    description?: string;
    operationId?: string;
    config?: ReporterConfig;
    userId: string;
  }): Promise<string> {
    const [reporter] = await db
      .insert(reporters)
      .values({
        agentId: params.agentId,
        name: params.name,
        pageId: params.pageId,
        pageUrl: params.pageUrl,
        description: params.description,
        operationId: params.operationId,
        pollIntervalMs: params.config?.pollIntervalMs || 60000,
        config: params.config || {},
        createdBy: params.userId,
      })
      .returning();

    console.log(`[ReporterService] Created reporter ${reporter.id} for page ${params.pageId}`);
    return reporter.id;
  }

  /**
   * Start polling for a reporter
   */
  async startPolling(reporterId: string): Promise<boolean> {
    // Stop existing interval if any
    this.stopPolling(reporterId);

    const [reporter] = await db
      .select()
      .from(reporters)
      .where(eq(reporters.id, reporterId))
      .limit(1);

    if (!reporter) {
      console.error(`[ReporterService] Reporter ${reporterId} not found`);
      return false;
    }

    // Update status to active
    await db
      .update(reporters)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(reporters.id, reporterId));

    // Set up polling interval
    const interval = setInterval(async () => {
      await this.pollData(reporterId);
    }, reporter.pollIntervalMs);

    this.pollIntervals.set(reporterId, interval);

    // Do an immediate poll
    await this.pollData(reporterId);

    console.log(`[ReporterService] Started polling for reporter ${reporterId} every ${reporter.pollIntervalMs}ms`);
    return true;
  }

  /**
   * Stop polling for a reporter
   */
  stopPolling(reporterId: string): void {
    const interval = this.pollIntervals.get(reporterId);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(reporterId);
      console.log(`[ReporterService] Stopped polling for reporter ${reporterId}`);
    }
  }

  /**
   * Poll data for a reporter
   */
  async pollData(reporterId: string): Promise<PolledData | null> {
    try {
      const [reporter] = await db
        .select()
        .from(reporters)
        .where(eq(reporters.id, reporterId))
        .limit(1);

      if (!reporter) return null;

      // Update status to polling
      await db
        .update(reporters)
        .set({ status: "polling", updatedAt: new Date() })
        .where(eq(reporters.id, reporterId));

      // Get the associated agent to perform the actual polling
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, reporter.agentId))
        .limit(1);

      if (!agent) {
        console.error(`[ReporterService] Agent ${reporter.agentId} not found for reporter ${reporterId}`);
        return null;
      }

      // Simulate polling (in real implementation, this would use the agent to fetch data)
      const newData: Record<string, any> = {
        polledAt: new Date().toISOString(),
        pageId: reporter.pageId,
        pageUrl: reporter.pageUrl,
        // This would be replaced with actual data fetching logic
        status: "active",
      };

      // Compare with previous data to detect changes
      const previousData = reporter.polledData as Record<string, any> || {};
      const changes = this.detectChanges(previousData, newData);

      // Update reporter with new data
      const dataHistory = (reporter.dataHistory as any[]) || [];
      dataHistory.push({
        timestamp: new Date().toISOString(),
        data: newData,
        changes,
      });

      // Keep only last 100 history entries
      const trimmedHistory = dataHistory.slice(-100);

      await db
        .update(reporters)
        .set({
          status: "active",
          polledData: newData,
          dataHistory: trimmedHistory,
          lastPollAt: new Date(),
          totalPolls: reporter.totalPolls + 1,
          updatedAt: new Date(),
        })
        .where(eq(reporters.id, reporterId));

      // If there are significant changes, emit event
      if (changes.length > 0) {
        this.emit("data_changed", {
          reporterId,
          changes,
          newData,
          previousData,
        });
      }

      return {
        timestamp: new Date(),
        data: newData,
        changes,
      };
    } catch (error) {
      console.error(`[ReporterService] Poll failed for reporter ${reporterId}:`, error);

      // Update status to error
      await db
        .update(reporters)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(reporters.id, reporterId));

      return null;
    }
  }

  /**
   * Detect changes between old and new data
   */
  private detectChanges(oldData: Record<string, any>, newData: Record<string, any>): string[] {
    const changes: string[] = [];

    // Check for new or modified keys
    for (const key of Object.keys(newData)) {
      if (!(key in oldData)) {
        changes.push(`Added: ${key}`);
      } else if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes.push(`Modified: ${key}`);
      }
    }

    // Check for removed keys
    for (const key of Object.keys(oldData)) {
      if (!(key in newData)) {
        changes.push(`Removed: ${key}`);
      }
    }

    return changes;
  }

  /**
   * Submit a question to the Operations Manager
   */
  async submitQuestion(params: {
    reporterId: string;
    question: string;
    context?: Record<string, any>;
    priority?: number;
  }): Promise<string> {
    const [reporter] = await db
      .select()
      .from(reporters)
      .where(eq(reporters.id, params.reporterId))
      .limit(1);

    if (!reporter) {
      throw new Error(`Reporter ${params.reporterId} not found`);
    }

    const [question] = await db
      .insert(reporterQuestions)
      .values({
        reporterId: params.reporterId,
        operationId: reporter.operationId,
        question: params.question,
        context: params.context || {},
        priority: params.priority || 5,
      })
      .returning();

    // Update reporter stats
    await db
      .update(reporters)
      .set({
        totalQuestions: reporter.totalQuestions + 1,
        updatedAt: new Date(),
      })
      .where(eq(reporters.id, params.reporterId));

    // Emit event for Operations Manager
    this.emit("question_submitted", {
      questionId: question.id,
      reporterId: params.reporterId,
      question: params.question,
      priority: params.priority || 5,
    });

    console.log(`[ReporterService] Question submitted by reporter ${params.reporterId}`);
    return question.id;
  }

  /**
   * Assign a task to a reporter
   */
  async assignTask(params: {
    reporterId: string;
    taskName: string;
    taskDescription?: string;
    taskType: string;
    instructions: string;
    parameters?: Record<string, any>;
    priority?: number;
    dueAt?: Date;
    questionId?: string;
    assignedBy: string;
  }): Promise<string> {
    const [reporter] = await db
      .select()
      .from(reporters)
      .where(eq(reporters.id, params.reporterId))
      .limit(1);

    if (!reporter) {
      throw new Error(`Reporter ${params.reporterId} not found`);
    }

    const [task] = await db
      .insert(reporterTasks)
      .values({
        reporterId: params.reporterId,
        questionId: params.questionId,
        operationId: reporter.operationId,
        taskName: params.taskName,
        taskDescription: params.taskDescription,
        taskType: params.taskType,
        instructions: params.instructions,
        parameters: params.parameters || {},
        priority: params.priority || 5,
        dueAt: params.dueAt,
        assignedBy: params.assignedBy,
      })
      .returning();

    // Update reporter stats
    await db
      .update(reporters)
      .set({
        totalTasks: reporter.totalTasks + 1,
        updatedAt: new Date(),
      })
      .where(eq(reporters.id, params.reporterId));

    // If this task is from a question, link them
    if (params.questionId) {
      await db
        .update(reporterQuestions)
        .set({
          generatedTaskId: task.id,
          status: "answered",
          updatedAt: new Date(),
        })
        .where(eq(reporterQuestions.id, params.questionId));
    }

    // Emit event
    this.emit("task_assigned", {
      taskId: task.id,
      reporterId: params.reporterId,
      taskName: params.taskName,
    });

    console.log(`[ReporterService] Task ${task.id} assigned to reporter ${params.reporterId}`);
    return task.id;
  }

  /**
   * Get reporter status
   */
  async getReporterStatus(reporterId: string): Promise<ReporterStatus | null> {
    const [reporter] = await db
      .select()
      .from(reporters)
      .where(eq(reporters.id, reporterId))
      .limit(1);

    if (!reporter) return null;

    // Get pending questions count
    const pendingQuestions = await db
      .select()
      .from(reporterQuestions)
      .where(
        and(
          eq(reporterQuestions.reporterId, reporterId),
          eq(reporterQuestions.status, "pending")
        )
      );

    // Get active tasks count
    const activeTasks = await db
      .select()
      .from(reporterTasks)
      .where(
        and(
          eq(reporterTasks.reporterId, reporterId),
          inArray(reporterTasks.status, ["pending", "in_progress"])
        )
      );

    return {
      reporterId: reporter.id,
      status: reporter.status,
      lastPollAt: reporter.lastPollAt,
      polledData: reporter.polledData as Record<string, any>,
      pendingQuestions: pendingQuestions.length,
      activeTasks: activeTasks.length,
    };
  }

  /**
   * Release polled data to Operations Manager
   */
  async releaseData(reporterId: string): Promise<Record<string, any> | null> {
    const [reporter] = await db
      .select()
      .from(reporters)
      .where(eq(reporters.id, reporterId))
      .limit(1);

    if (!reporter) return null;

    const data = {
      reporterId: reporter.id,
      pageId: reporter.pageId,
      polledData: reporter.polledData,
      statusContext: reporter.statusContext,
      lastPollAt: reporter.lastPollAt,
      dataHistory: reporter.dataHistory,
    };

    this.emit("data_released", {
      reporterId,
      data,
    });

    return data;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    // Stop all polling intervals
    for (const [reporterId] of this.pollIntervals) {
      this.stopPolling(reporterId);
    }

    // Update all active reporters to idle
    await db
      .update(reporters)
      .set({ status: "idle", updatedAt: new Date() })
      .where(eq(reporters.status, "active"));

    this.isInitialized = false;
    console.log("[ReporterService] Shutdown complete");
  }
}

// Export singleton instance
export const reporterAgentService = new ReporterAgentService();
export default reporterAgentService;
