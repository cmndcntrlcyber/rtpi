import { db } from "../db";
import {
  rustNexusImplants,
  rustNexusTasks,
  rustNexusTaskResults,
} from "@shared/schema";
import { eq, and, inArray, or, sql, desc, asc } from "drizzle-orm";

/**
 * Advanced Task Distribution System for rust-nexus Implants
 *
 * Phase 3 Features:
 * - #AI-12: Task queue system with priority ordering
 * - #AI-13: Intelligent task assignment algorithm
 * - #AI-14: Priority-based scheduling
 * - #AI-15: Task result aggregation
 * - #AI-16: Failed task retry logic with exponential backoff
 * - #AI-17: Enhanced task cancellation support
 */

// Types for task distribution
export interface TaskAssignment {
  taskId: string;
  implantId: string;
  priority: number;
  score: number; // Suitability score for this assignment
}

export interface ImplantLoadInfo {
  implantId: string;
  implantName: string;
  implantType: string;
  capabilities: string[];
  status: string;
  connectionQuality: number;
  maxConcurrentTasks: number;
  currentLoad: number;
  availableSlots: number;
  avgExecutionTimeMs: number;
}

export interface TaskQueueStats {
  totalQueued: number;
  totalRunning: number;
  totalCompleted: number;
  totalFailed: number;
  totalCancelled: number;
  avgWaitTimeMs: number;
  avgExecutionTimeMs: number;
  successRate: number;
}

export interface TaskAggregation {
  implantId: string;
  implantName: string;
  totalTasks: number;
  completed: number;
  failed: number;
  running: number;
  queued: number;
  avgExecutionTimeMs: number;
  successRate: number;
  lastTaskAt: string;
}

class RustNexusTaskDistributor {
  /**
   * #AI-12: Get prioritized task queue
   * Returns tasks ordered by priority and dependency resolution
   */
  async getPrioritizedQueue(options?: {
    implantId?: string;
    limit?: number;
    includeBlocked?: boolean;
  }): Promise<any[]> {
    const { implantId, limit = 100, includeBlocked = false } = options || {};

    // Build base query
    const conditions = [inArray(rustNexusTasks.status, ["queued", "assigned"])];

    if (implantId) {
      conditions.push(eq(rustNexusTasks.implantId, implantId));
    }

    // Get tasks with priority ordering
    let tasks = await db.query.rustNexusTasks.findMany({
      where: and(...conditions),
      orderBy: [desc(rustNexusTasks.priority), asc(rustNexusTasks.createdAt)],
      limit,
    });

    // Filter out blocked tasks (those with unresolved dependencies)
    if (!includeBlocked) {
      tasks = await this.filterBlockedTasks(tasks);
    }

    return tasks;
  }

  /**
   * #AI-12: Filter tasks blocked by dependencies
   */
  private async filterBlockedTasks(tasks: any[]): Promise<any[]> {
    const unblocked: any[] = [];

    for (const task of tasks) {
      // Check if task has dependencies
      if (!task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0) {
        unblocked.push(task);
        continue;
      }

      // Check if all dependencies are completed
      const dependencies = await db.query.rustNexusTasks.findMany({
        where: inArray(rustNexusTasks.id, task.dependsOnTaskIds),
      });

      const allCompleted = dependencies.every((dep) => dep.status === "completed");

      if (allCompleted) {
        unblocked.push(task);
      }
    }

    return unblocked;
  }

  /**
   * #AI-13: Get implant load information for assignment decisions
   */
  async getImplantLoadInfo(implantId: string): Promise<ImplantLoadInfo | null> {
    const implant = await db.query.rustNexusImplants.findFirst({
      where: eq(rustNexusImplants.id, implantId),
    });

    if (!implant) return null;

    // Count current active tasks
    const activeTasks = await db
      .select({ count: sql<number>`count(*)` })
      .from(rustNexusTasks)
      .where(
        and(
          eq(rustNexusTasks.implantId, implantId),
          inArray(rustNexusTasks.status, ["assigned", "running"])
        )
      );

    const currentLoad = Number(activeTasks[0]?.count || 0);
    const maxTasks = implant.maxConcurrentTasks || 5;

    // Calculate average execution time
    const avgExecTime = await db
      .select({
        avg: sql<number>`AVG(${rustNexusTasks.executionTimeMs})`,
      })
      .from(rustNexusTasks)
      .where(
        and(
          eq(rustNexusTasks.implantId, implantId),
          eq(rustNexusTasks.status, "completed"),
          sql`${rustNexusTasks.executionTimeMs} IS NOT NULL`
        )
      );

    return {
      implantId: implant.id,
      implantName: implant.implantName,
      implantType: implant.implantType,
      capabilities: implant.capabilities || [],
      status: implant.status,
      connectionQuality: implant.connectionQuality || 0,
      maxConcurrentTasks: maxTasks,
      currentLoad,
      availableSlots: Math.max(0, maxTasks - currentLoad),
      avgExecutionTimeMs: Number(avgExecTime[0]?.avg || 0),
    };
  }

  /**
   * #AI-13: Intelligent task assignment algorithm
   * Assigns tasks to implants based on:
   * - Implant availability (connection status, load)
   * - Task priority
   * - Implant capabilities matching task requirements
   * - Connection quality
   * - Historical performance
   */
  async assignTasksToImplants(options?: {
    maxAssignments?: number;
  }): Promise<TaskAssignment[]> {
    const { maxAssignments = 50 } = options || {};

    // Get all connected/idle/busy implants
    const availableImplants = await db.query.rustNexusImplants.findMany({
      where: inArray(rustNexusImplants.status, ["connected", "idle", "busy"]),
    });

    if (availableImplants.length === 0) {
      return [];
    }

    // Get load info for all implants
    const implantLoads = await Promise.all(
      availableImplants.map((i) => this.getImplantLoadInfo(i.id))
    );

    // Filter to only implants with available slots
    const availableLoads = implantLoads.filter(
      (load) => load && load.availableSlots > 0
    ) as ImplantLoadInfo[];

    if (availableLoads.length === 0) {
      return [];
    }

    // Get prioritized queue
    const queuedTasks = await this.getPrioritizedQueue({
      limit: maxAssignments * 2, // Get extra to account for filtering
    });

    if (queuedTasks.length === 0) {
      return [];
    }

    // Assign tasks using scoring algorithm
    const assignments: TaskAssignment[] = [];
    const implantSlots = new Map(
      availableLoads.map((load) => [load.implantId, load.availableSlots])
    );

    for (const task of queuedTasks) {
      // Find best implant for this task
      const bestMatch = this.findBestImplantForTask(task, availableLoads, implantSlots);

      if (bestMatch) {
        assignments.push({
          taskId: task.id,
          implantId: bestMatch.implantId,
          priority: task.priority,
          score: bestMatch.score,
        });

        // Reduce available slots
        const slots = implantSlots.get(bestMatch.implantId) || 0;
        implantSlots.set(bestMatch.implantId, slots - 1);

        // Stop if we've reached max assignments
        if (assignments.length >= maxAssignments) {
          break;
        }

        // Remove implants with no slots
        if (slots - 1 <= 0) {
          const index = availableLoads.findIndex(
            (l) => l.implantId === bestMatch.implantId
          );
          if (index >= 0) {
            availableLoads.splice(index, 1);
          }
        }
      }

      // Stop if no more implants available
      if (availableLoads.length === 0) {
        break;
      }
    }

    // Apply assignments to database
    for (const assignment of assignments) {
      await db
        .update(rustNexusTasks)
        .set({
          implantId: assignment.implantId,
          status: "assigned",
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rustNexusTasks.id, assignment.taskId));
    }

    return assignments;
  }

  /**
   * #AI-13: Score implant suitability for a task
   */
  private findBestImplantForTask(
    task: any,
    availableImplants: ImplantLoadInfo[],
    slots: Map<string, number>
  ): { implantId: string; score: number } | null {
    let bestMatch: { implantId: string; score: number } | null = null;

    for (const implant of availableImplants) {
      // Check if implant has slots
      if ((slots.get(implant.implantId) || 0) <= 0) {
        continue;
      }

      // Check if task is already assigned to this implant
      if (task.implantId && task.implantId !== implant.implantId) {
        continue;
      }

      // Calculate suitability score
      let score = 0;

      // 1. Connection quality (0-40 points)
      score += (implant.connectionQuality / 100) * 40;

      // 2. Load factor (0-30 points) - prefer less loaded implants
      const loadFactor =
        1 - implant.currentLoad / implant.maxConcurrentTasks;
      score += loadFactor * 30;

      // 3. Performance history (0-20 points)
      if (implant.avgExecutionTimeMs > 0) {
        // Normalize execution time (faster is better)
        const perfScore = Math.max(0, 20 - (implant.avgExecutionTimeMs / 1000));
        score += Math.min(perfScore, 20);
      }

      // 4. Capability matching (0-10 points)
      // If task requires specific capabilities, bonus for matching
      if (task.metadata?.requiredCapabilities) {
        const required = task.metadata.requiredCapabilities as string[];
        const matches = required.filter((cap) =>
          implant.capabilities.includes(cap)
        ).length;
        score += (matches / required.length) * 10;
      } else {
        score += 5; // Default bonus for tasks without requirements
      }

      // Track best match
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { implantId: implant.implantId, score };
      }
    }

    return bestMatch;
  }

  /**
   * #AI-14: Priority-based scheduler
   * Promotes high-priority waiting tasks
   */
  async priorityScheduler(): Promise<void> {
    // Get all queued tasks that have been waiting too long
    const waitingThreshold = 5 * 60 * 1000; // 5 minutes
    const thresholdTime = new Date(Date.now() - waitingThreshold);

    const waitingTasks = await db.query.rustNexusTasks.findMany({
      where: and(
        eq(rustNexusTasks.status, "queued"),
        sql`${rustNexusTasks.createdAt} < ${thresholdTime}`
      ),
    });

    // Increase priority for tasks waiting too long
    for (const task of waitingTasks) {
      if (task.priority < 10) {
        await db
          .update(rustNexusTasks)
          .set({
            priority: Math.min(10, task.priority + 1),
            updatedAt: new Date(),
          })
          .where(eq(rustNexusTasks.id, task.id));
      }
    }

    console.log(
      `[TaskDistributor] Priority scheduler promoted ${waitingTasks.length} waiting tasks`
    );
  }

  /**
   * #AI-15: Aggregate task results by implant
   */
  async aggregateTaskResults(options?: {
    implantId?: string;
    since?: Date;
  }): Promise<TaskAggregation[]> {
    const { implantId, since } = options || {};

    const conditions = [];
    if (implantId) {
      conditions.push(eq(rustNexusTasks.implantId, implantId));
    }
    if (since) {
      conditions.push(sql`${rustNexusTasks.createdAt} >= ${since}`);
    }

    // Aggregate by implant
    const aggregations = await db
      .select({
        implantId: rustNexusTasks.implantId,
        totalTasks: sql<number>`COUNT(*)`,
        completed: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
        running: sql<number>`COUNT(*) FILTER (WHERE status = 'running')`,
        queued: sql<number>`COUNT(*) FILTER (WHERE status = 'queued')`,
        avgExecutionTimeMs: sql<number>`AVG(${rustNexusTasks.executionTimeMs})`,
        lastTaskAt: sql<string>`MAX(${rustNexusTasks.createdAt})`,
      })
      .from(rustNexusTasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(rustNexusTasks.implantId);

    // Enrich with implant names
    const enriched: TaskAggregation[] = [];
    for (const agg of aggregations) {
      const implant = await db.query.rustNexusImplants.findFirst({
        where: eq(rustNexusImplants.id, agg.implantId),
      });

      const totalCompleted = Number(agg.completed) + Number(agg.failed);
      const successRate =
        totalCompleted > 0 ? (Number(agg.completed) / totalCompleted) * 100 : 0;

      enriched.push({
        implantId: agg.implantId,
        implantName: implant?.implantName || "Unknown",
        totalTasks: Number(agg.totalTasks),
        completed: Number(agg.completed),
        failed: Number(agg.failed),
        running: Number(agg.running),
        queued: Number(agg.queued),
        avgExecutionTimeMs: Number(agg.avgExecutionTimeMs) || 0,
        successRate,
        lastTaskAt: agg.lastTaskAt,
      });
    }

    return enriched;
  }

  /**
   * #AI-15: Get overall queue statistics
   */
  async getQueueStats(): Promise<TaskQueueStats> {
    const stats = await db
      .select({
        totalQueued: sql<number>`COUNT(*) FILTER (WHERE status = 'queued')`,
        totalRunning: sql<number>`COUNT(*) FILTER (WHERE status = 'running')`,
        totalCompleted: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
        totalFailed: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
        totalCancelled: sql<number>`COUNT(*) FILTER (WHERE status = 'cancelled')`,
        avgExecutionTimeMs: sql<number>`AVG(${rustNexusTasks.executionTimeMs})`,
      })
      .from(rustNexusTasks);

    // Calculate average wait time (time between creation and assignment)
    const waitTimes = await db
      .select({
        avgWaitMs: sql<number>`AVG(EXTRACT(EPOCH FROM (${rustNexusTasks.assignedAt} - ${rustNexusTasks.createdAt})) * 1000)`,
      })
      .from(rustNexusTasks)
      .where(sql`${rustNexusTasks.assignedAt} IS NOT NULL`);

    const totalFinished =
      Number(stats[0].totalCompleted) + Number(stats[0].totalFailed);
    const successRate =
      totalFinished > 0
        ? (Number(stats[0].totalCompleted) / totalFinished) * 100
        : 0;

    return {
      totalQueued: Number(stats[0].totalQueued),
      totalRunning: Number(stats[0].totalRunning),
      totalCompleted: Number(stats[0].totalCompleted),
      totalFailed: Number(stats[0].totalFailed),
      totalCancelled: Number(stats[0].totalCancelled),
      avgWaitTimeMs: Number(waitTimes[0]?.avgWaitMs) || 0,
      avgExecutionTimeMs: Number(stats[0].avgExecutionTimeMs) || 0,
      successRate,
    };
  }

  /**
   * #AI-16: Retry failed tasks with exponential backoff
   */
  async retryFailedTasks(options?: {
    maxRetries?: number;
    backoffMultiplier?: number;
  }): Promise<number> {
    const { maxRetries = 3, backoffMultiplier = 2 } = options || {};

    // Find failed tasks that can be retried
    const failedTasks = await db.query.rustNexusTasks.findMany({
      where: and(
        eq(rustNexusTasks.status, "failed"),
        sql`${rustNexusTasks.retryCount} < ${rustNexusTasks.maxRetries}`
      ),
      limit: 100,
    });

    let retriedCount = 0;

    for (const task of failedTasks) {
      const retryCount = task.retryCount + 1;

      // Calculate backoff delay (exponential: 1min, 2min, 4min, etc.)
      const baseDelay = 60 * 1000; // 1 minute
      const backoffDelay = baseDelay * Math.pow(backoffMultiplier, retryCount - 1);
      const failedAt = task.completedAt || task.updatedAt;
      const canRetryAt = new Date(failedAt.getTime() + backoffDelay);

      // Check if enough time has passed for retry
      if (new Date() >= canRetryAt) {
        await db
          .update(rustNexusTasks)
          .set({
            status: "queued",
            retryCount,
            errorMessage: null,
            errorStack: null,
            assignedAt: null,
            startedAt: null,
            completedAt: null,
            executionTimeMs: null,
            progressPercentage: 0,
            updatedAt: new Date(),
          })
          .where(eq(rustNexusTasks.id, task.id));

        retriedCount++;

        console.log(
          `[TaskDistributor] Retrying task ${task.id} (attempt ${retryCount}/${task.maxRetries})`
        );
      }
    }

    return retriedCount;
  }

  /**
   * #AI-16: Mark tasks as permanently failed after max retries
   */
  async markPermanentFailures(): Promise<number> {
    const result = await db
      .update(rustNexusTasks)
      .set({
        status: "cancelled",
        errorMessage: "Max retries exceeded",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rustNexusTasks.status, "failed"),
          sql`${rustNexusTasks.retryCount} >= ${rustNexusTasks.maxRetries}`
        )
      )
      .returning();

    return result.length;
  }

  /**
   * #AI-17: Cancel task and all dependent tasks
   */
  async cancelTaskCascade(taskId: string): Promise<{
    cancelled: string[];
    alreadyCompleted: string[];
  }> {
    const cancelled: string[] = [];
    const alreadyCompleted: string[] = [];
    const toProcess = [taskId];
    const processed = new Set<string>();

    while (toProcess.length > 0) {
      const currentId = toProcess.shift()!;

      if (processed.has(currentId)) {
        continue;
      }
      processed.add(currentId);

      const task = await db.query.rustNexusTasks.findFirst({
        where: eq(rustNexusTasks.id, currentId),
      });

      if (!task) {
        continue;
      }

      // Skip if already completed/failed
      if (task.status === "completed" || task.status === "failed") {
        alreadyCompleted.push(currentId);
        continue;
      }

      // Cancel the task
      await db
        .update(rustNexusTasks)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(rustNexusTasks.id, currentId));

      cancelled.push(currentId);

      // Find tasks that depend on this task
      const dependentTasks = await db.query.rustNexusTasks.findMany({
        where: sql`${currentId} = ANY(${rustNexusTasks.dependsOnTaskIds})`,
      });

      // Add dependent tasks to processing queue
      for (const depTask of dependentTasks) {
        if (!processed.has(depTask.id)) {
          toProcess.push(depTask.id);
        }
      }
    }

    return { cancelled, alreadyCompleted };
  }

  /**
   * #AI-17: Cancel all tasks for an implant
   */
  async cancelImplantTasks(implantId: string): Promise<number> {
    const result = await db
      .update(rustNexusTasks)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rustNexusTasks.implantId, implantId),
          inArray(rustNexusTasks.status, ["queued", "assigned", "running"])
        )
      )
      .returning();

    return result.length;
  }

  /**
   * Detect and handle timeout tasks
   */
  async handleTimeouts(): Promise<number> {
    const runningTasks = await db.query.rustNexusTasks.findMany({
      where: eq(rustNexusTasks.status, "running"),
    });

    let timeoutCount = 0;

    for (const task of runningTasks) {
      if (!task.startedAt) continue;

      const elapsedMs = Date.now() - task.startedAt.getTime();
      const timeoutMs = task.timeoutSeconds * 1000;

      if (elapsedMs > timeoutMs) {
        await db
          .update(rustNexusTasks)
          .set({
            status: "failed",
            errorMessage: `Task timed out after ${task.timeoutSeconds}s`,
            completedAt: new Date(),
            executionTimeMs: elapsedMs,
            updatedAt: new Date(),
          })
          .where(eq(rustNexusTasks.id, task.id));

        timeoutCount++;
        console.log(`[TaskDistributor] Task ${task.id} timed out`);
      }
    }

    return timeoutCount;
  }
}

// Export singleton instance
export const taskDistributor = new RustNexusTaskDistributor();
