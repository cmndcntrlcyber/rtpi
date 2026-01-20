import { Router } from "express";
import { promises as fs } from "fs";
import path from "path";
import { db } from "../../db";
import {
  rustNexusImplants,
  rustNexusTasks,
  rustNexusTaskResults,
  rustNexusCertificates,
  rustNexusTelemetry,
  agentBuilds,
  agentBundles,
  agentDownloadTokens,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { rustNexusController } from "../../services/rust-nexus-controller";
import { taskDistributor } from "../../services/rust-nexus-task-distributor";
import { distributedWorkflowOrchestrator, KillSwitchReason } from "../../services/distributed-workflow-orchestrator";
import { agentBuildService, AVAILABLE_FEATURES } from "../../services/agent-build-service";
import { agentBundleGenerator } from "../../services/agent-bundle-generator";
import { agentTokenService } from "../../services/agent-token-service";

const router = Router();

/**
 * rust-nexus Agentic Implants API
 */

// ============================================================================
// IMPLANTS
// ============================================================================

// List all implants
router.get("/implants", async (req, res) => {
  try {
    const { status, operation_id } = req.query;

    let query = db.select().from(rustNexusImplants);

    // Apply filters
    const conditions = [];
    if (status) {
      conditions.push(eq(rustNexusImplants.status, status as string));
    }
    if (operation_id) {
      conditions.push(eq(rustNexusImplants.operationId, operation_id as string));
    }

    const implants = await db.query.rustNexusImplants.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(rustNexusImplants.lastHeartbeat)],
    });

    res.json(implants);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list implants", details: error?.message || "Internal server error" });
  }
});

// Get implant by ID
router.get("/implants/:id", async (req, res) => {
  try {
    const implant = await db.query.rustNexusImplants.findFirst({
      where: eq(rustNexusImplants.id, req.params.id),
    });

    if (!implant) {
      return res.status(404).json({ error: "Implant not found" });
    }

    // Get task statistics
    const taskStats = await db
      .select({
        total: sql<number>`count(*)`,
        queued: sql<number>`count(*) filter (where status = 'queued')`,
        running: sql<number>`count(*) filter (where status = 'running')`,
        completed: sql<number>`count(*) filter (where status = 'completed')`,
        failed: sql<number>`count(*) filter (where status = 'failed')`,
      })
      .from(rustNexusTasks)
      .where(eq(rustNexusTasks.implantId, req.params.id));

    // Get latest telemetry
    const latestTelemetry = await db.query.rustNexusTelemetry.findFirst({
      where: eq(rustNexusTelemetry.implantId, req.params.id),
      orderBy: [desc(rustNexusTelemetry.collectedAt)],
    });

    res.json({
      ...implant,
      taskStats: taskStats[0],
      latestTelemetry,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get implant", details: error?.message || "Internal server error" });
  }
});

// Update implant configuration
router.patch("/implants/:id", async (req, res) => {
  try {
    const { autonomyLevel, aiProvider, aiModel, maxConcurrentTasks, tags } = req.body;

    const updateData: any = { updatedAt: new Date() };

    if (autonomyLevel !== undefined) updateData.autonomyLevel = autonomyLevel;
    if (aiProvider !== undefined) updateData.aiProvider = aiProvider;
    if (aiModel !== undefined) updateData.aiModel = aiModel;
    if (maxConcurrentTasks !== undefined)
      updateData.maxConcurrentTasks = maxConcurrentTasks;
    if (tags !== undefined) updateData.tags = tags;

    const [updated] = await db
      .update(rustNexusImplants)
      .set(updateData)
      .where(eq(rustNexusImplants.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Implant not found" });
    }

    res.json(updated);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to update implant", details: error?.message || "Internal server error" });
  }
});

// Terminate implant
router.delete("/implants/:id", async (req, res) => {
  try {
    await rustNexusController.terminateImplant(req.params.id);
    res.json({ success: true, message: "Implant terminated" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to terminate implant", details: error?.message || "Internal server error" });
  }
});

// Get implant connection status
router.get("/implants/:id/status", async (req, res) => {
  try {
    const connectedImplants = rustNexusController.getConnectedImplants();
    const connection = connectedImplants.find((c) => c.implantId === req.params.id);

    const implant = await db.query.rustNexusImplants.findFirst({
      where: eq(rustNexusImplants.id, req.params.id),
    });

    if (!implant) {
      return res.status(404).json({ error: "Implant not found" });
    }

    res.json({
      implantId: req.params.id,
      implantName: implant.implantName,
      status: implant.status,
      isConnected: !!connection,
      connectionDetails: connection
        ? {
            connectedAt: connection.connectedAt,
            lastHeartbeat: connection.lastHeartbeat,
          }
        : null,
      lastHeartbeat: implant.lastHeartbeat,
      connectionQuality: implant.connectionQuality,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get implant status", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// TASKS
// ============================================================================

// List tasks for an implant
router.get("/implants/:implantId/tasks", async (req, res) => {
  try {
    const { status, limit = "50" } = req.query;

    let query = db.query.rustNexusTasks.findMany({
      where: status
        ? and(
            eq(rustNexusTasks.implantId, req.params.implantId),
            eq(rustNexusTasks.status, status as string)
          )
        : eq(rustNexusTasks.implantId, req.params.implantId),
      orderBy: [desc(rustNexusTasks.createdAt)],
      limit: parseInt(limit as string),
    });

    const tasks = await query;
    res.json(tasks);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list tasks", details: error?.message || "Internal server error" });
  }
});

// Create a new task
router.post("/implants/:implantId/tasks", async (req, res) => {
  try {
    const {
      taskType,
      taskName,
      taskDescription,
      command,
      parameters,
      environmentVars,
      priority,
      timeoutSeconds,
      requiresAiApproval,
    } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [task] = await db
      .insert(rustNexusTasks)
      .values({
        implantId: req.params.implantId,
        taskType,
        taskName,
        taskDescription,
        command,
        parameters: parameters || {},
        environmentVars: environmentVars || {},
        priority: priority || 5,
        timeoutSeconds: timeoutSeconds || 300,
        requiresAiApproval: requiresAiApproval || false,
        status: "queued",
        createdBy: req.user.id,
      })
      .returning();

    res.status(201).json(task);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to create task", details: error?.message || "Internal server error" });
  }
});

// Get task by ID
router.get("/tasks/:id", async (req, res) => {
  try {
    const task = await db.query.rustNexusTasks.findFirst({
      where: eq(rustNexusTasks.id, req.params.id),
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Get task results
    const results = await db.query.rustNexusTaskResults.findMany({
      where: eq(rustNexusTaskResults.taskId, req.params.id),
      orderBy: [desc(rustNexusTaskResults.createdAt)],
    });

    res.json({
      ...task,
      results,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get task", details: error?.message || "Internal server error" });
  }
});

// Cancel a task
router.delete("/tasks/:id", async (req, res) => {
  try {
    const [updated] = await db
      .update(rustNexusTasks)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(rustNexusTasks.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(updated);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to cancel task", details: error?.message || "Internal server error" });
  }
});

// Cancel task with cascade (cancels dependent tasks)
router.post("/tasks/:id/cancel-cascade", async (req, res) => {
  try {
    const result = await taskDistributor.cancelTaskCascade(req.params.id);
    res.json({
      success: true,
      cancelled: result.cancelled,
      alreadyCompleted: result.alreadyCompleted,
      totalCancelled: result.cancelled.length,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to cascade cancel task", details: error?.message || "Internal server error" });
  }
});

// Get prioritized task queue
router.get("/tasks/queue/prioritized", async (req, res) => {
  try {
    const { implant_id, limit = "50", include_blocked = "false" } = req.query;

    const queue = await taskDistributor.getPrioritizedQueue({
      implantId: implant_id as string | undefined,
      limit: parseInt(limit as string),
      includeBlocked: include_blocked === "true",
    });

    res.json(queue);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get prioritized queue", details: error?.message || "Internal server error" });
  }
});

// Get queue statistics
router.get("/tasks/queue/stats", async (req, res) => {
  try {
    const stats = await taskDistributor.getQueueStats();
    res.json(stats);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get queue stats", details: error?.message || "Internal server error" });
  }
});

// Trigger manual task assignment
router.post("/tasks/assign", async (req, res) => {
  try {
    const { max_assignments = 50 } = req.body;

    const assignments = await taskDistributor.assignTasksToImplants({
      maxAssignments: max_assignments,
    });

    res.json({
      success: true,
      assignments,
      totalAssigned: assignments.length,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to assign tasks", details: error?.message || "Internal server error" });
  }
});

// Retry failed tasks manually
router.post("/tasks/retry-failed", async (req, res) => {
  try {
    const retriedCount = await taskDistributor.retryFailedTasks();
    res.json({
      success: true,
      retriedCount,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to retry tasks", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// TASK RESULTS
// ============================================================================

// Get task results
router.get("/tasks/:taskId/results", async (req, res) => {
  try {
    const results = await db.query.rustNexusTaskResults.findMany({
      where: eq(rustNexusTaskResults.taskId, req.params.taskId),
      orderBy: [desc(rustNexusTaskResults.createdAt)],
    });

    res.json(results);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get task results", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// TELEMETRY
// ============================================================================

// Get implant telemetry
router.get("/implants/:implantId/telemetry", async (req, res) => {
  try {
    const { limit = "100", since } = req.query;

    let whereClause = eq(rustNexusTelemetry.implantId, req.params.implantId);

    if (since) {
      whereClause = and(
        whereClause,
        sql`${rustNexusTelemetry.collectedAt} >= ${new Date(since as string)}`
      );
    }

    const telemetry = await db.query.rustNexusTelemetry.findMany({
      where: whereClause,
      orderBy: [desc(rustNexusTelemetry.collectedAt)],
      limit: parseInt(limit as string),
    });

    res.json(telemetry);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get telemetry", details: error?.message || "Internal server error" });
  }
});

// Get aggregated telemetry stats
router.get("/implants/:implantId/telemetry/stats", async (req, res) => {
  try {
    const { hours = "24" } = req.query;
    const since = new Date(Date.now() - parseInt(hours as string) * 60 * 60 * 1000);

    const stats = await db
      .select({
        avgCpuUsage: sql<number>`AVG(${rustNexusTelemetry.cpuUsagePercent})`,
        maxCpuUsage: sql<number>`MAX(${rustNexusTelemetry.cpuUsagePercent})`,
        avgMemoryUsage: sql<number>`AVG(${rustNexusTelemetry.memoryUsageMb})`,
        maxMemoryUsage: sql<number>`MAX(${rustNexusTelemetry.memoryUsageMb})`,
        avgNetworkLatency: sql<number>`AVG(${rustNexusTelemetry.networkLatencyMs})`,
        totalTasksCompleted: sql<number>`SUM(${rustNexusTelemetry.completedTasksLastHour})`,
        totalTasksFailed: sql<number>`SUM(${rustNexusTelemetry.failedTasksLastHour})`,
        anomalyCount: sql<number>`COUNT(*) FILTER (WHERE ${rustNexusTelemetry.anomalyDetected} = true)`,
      })
      .from(rustNexusTelemetry)
      .where(
        and(
          eq(rustNexusTelemetry.implantId, req.params.implantId),
          sql`${rustNexusTelemetry.collectedAt} >= ${since}`
        )
      );

    res.json(stats[0]);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get telemetry stats", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// CERTIFICATES
// ============================================================================

// List certificates
router.get("/certificates", async (req, res) => {
  try {
    const { implant_id, revoked } = req.query;

    const conditions = [];
    if (implant_id) {
      conditions.push(eq(rustNexusCertificates.implantId, implant_id as string));
    }
    if (revoked !== undefined) {
      conditions.push(eq(rustNexusCertificates.revoked, revoked === "true"));
    }

    const certificates = await db.query.rustNexusCertificates.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(rustNexusCertificates.issuedAt)],
    });

    // Don't send private keys to client
    const sanitized = certificates.map((cert) => ({
      ...cert,
      certificatePem: undefined,
    }));

    res.json(sanitized);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list certificates", details: error?.message || "Internal server error" });
  }
});

// Get certificate by ID
router.get("/certificates/:id", async (req, res) => {
  try {
    const certificate = await db.query.rustNexusCertificates.findFirst({
      where: eq(rustNexusCertificates.id, req.params.id),
    });

    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    // Include full certificate for download
    res.json(certificate);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get certificate", details: error?.message || "Internal server error" });
  }
});

// Revoke certificate
router.post("/certificates/:id/revoke", async (req, res) => {
  try {
    const { reason } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [updated] = await db
      .update(rustNexusCertificates)
      .set({
        revoked: true,
        revokedAt: new Date(),
        revocationReason: reason,
        revokedBy: req.user.id,
        isValid: false,
        updatedAt: new Date(),
      })
      .where(eq(rustNexusCertificates.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    res.json(updated);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to revoke certificate", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// TASK AGGREGATIONS & ANALYTICS
// ============================================================================

// Get task result aggregations by implant
router.get("/tasks/aggregations", async (req, res) => {
  try {
    const { implant_id, since } = req.query;

    const aggregations = await taskDistributor.aggregateTaskResults({
      implantId: implant_id as string | undefined,
      since: since ? new Date(since as string) : undefined,
    });

    res.json(aggregations);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get task aggregations", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// DASHBOARD & STATISTICS
// ============================================================================

// Get overall statistics
router.get("/stats", async (req, res) => {
  try {
    const implantStats = await db
      .select({
        total: sql<number>`COUNT(*)`,
        connected: sql<number>`COUNT(*) FILTER (WHERE status = 'connected')`,
        idle: sql<number>`COUNT(*) FILTER (WHERE status = 'idle')`,
        busy: sql<number>`COUNT(*) FILTER (WHERE status = 'busy')`,
        disconnected: sql<number>`COUNT(*) FILTER (WHERE status = 'disconnected')`,
        terminated: sql<number>`COUNT(*) FILTER (WHERE status = 'terminated')`,
      })
      .from(rustNexusImplants);

    const taskStats = await db
      .select({
        total: sql<number>`COUNT(*)`,
        queued: sql<number>`COUNT(*) FILTER (WHERE status = 'queued')`,
        running: sql<number>`COUNT(*) FILTER (WHERE status = 'running')`,
        completed: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
        cancelled: sql<number>`COUNT(*) FILTER (WHERE status = 'cancelled')`,
      })
      .from(rustNexusTasks);

    const activeConnections = rustNexusController.getConnectedImplants();

    // Convert string counts to numbers (PostgreSQL COUNT returns bigint as string)
    const implantData = implantStats[0];
    const taskData = taskStats[0];

    res.json({
      implants: {
        total: Number(implantData.total),
        connected: Number(implantData.connected),
        idle: Number(implantData.idle),
        busy: Number(implantData.busy),
        disconnected: Number(implantData.disconnected),
        terminated: Number(implantData.terminated),
      },
      tasks: {
        total: Number(taskData.total),
        queued: Number(taskData.queued),
        running: Number(taskData.running),
        completed: Number(taskData.completed),
        failed: Number(taskData.failed),
        cancelled: Number(taskData.cancelled),
      },
      connections: {
        total: activeConnections.length,
        authenticated: activeConnections.filter((c) => c.implantId).length,
      },
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get stats", details: error?.message || "Internal server error" });
  }
});

// Get active connections
router.get("/connections", async (_req, res) => {
  try {
    const connections = rustNexusController.getConnectedImplants();
    res.json(connections);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get connections", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// DISTRIBUTED WORKFLOWS (Phase 4)
// ============================================================================

// Find best implant for task (capability matching)
router.post("/implants/match", async (req, res) => {
  try {
    const {
      required_capabilities,
      preferred_implant_type,
      exclude_implants,
      require_connected = true,
      minimum_connection_quality = 50,
    } = req.body;

    const match = await distributedWorkflowOrchestrator.findBestImplantForTask(
      required_capabilities || [],
      preferred_implant_type,
      {
        excludeImplants: exclude_implants,
        requireConnected: require_connected,
        minimumConnectionQuality: minimum_connection_quality,
      }
    );

    if (!match) {
      return res.status(404).json({ error: "No suitable implant found" });
    }

    res.json({
      implant: match.implant,
      score: match.score,
      matchedCapabilities: match.matchedCapabilities,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to match implant", details: error?.message || "Internal server error" });
  }
});

// Execute distributed workflow across multiple implants
router.post("/workflows/distributed", async (req, res) => {
  try {
    const {
      workflow_id,
      tasks,
      autonomy_level = 5,
      safety_limits,
      max_parallel_tasks = 5,
    } = req.body;

    if (!workflow_id || !tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "workflow_id and tasks array required" });
    }

    const result = await distributedWorkflowOrchestrator.executeDistributedWorkflow(
      workflow_id,
      tasks,
      {
        autonomyLevel: autonomy_level,
        safetyLimits: safety_limits,
        maxParallelTasks: max_parallel_tasks,
      }
    );

    res.json(result);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to execute distributed workflow", details: error?.message || "Internal server error" });
  }
});

// Execute single task on implant
router.post("/workflows/:workflow_id/tasks/:task_id/execute", async (req, res) => {
  try {
    const { workflow_id, task_id } = req.params;
    const {
      implant_id,
      task_definition,
      autonomy_level = 5,
    } = req.body;

    if (!implant_id || !task_definition) {
      return res.status(400).json({ error: "implant_id and task_definition required" });
    }

    const result = await distributedWorkflowOrchestrator.executeTaskOnImplant(
      workflow_id,
      task_id,
      implant_id,
      task_definition,
      autonomy_level
    );

    res.json(result);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to execute task on implant", details: error?.message || "Internal server error" });
  }
});

// Exfiltrate data from implant
router.post("/implants/:implant_id/exfiltrate", async (req, res) => {
  try {
    const { implant_id } = req.params;
    const {
      workflow_id,
      source_type,
      source_path,
      command,
      max_size_mb = 100,
      compression_enabled = true,
      encryption_enabled = true,
    } = req.body;

    if (!workflow_id || !source_type) {
      return res.status(400).json({ error: "workflow_id and source_type required" });
    }

    const result = await distributedWorkflowOrchestrator.exfiltrateData(
      implant_id,
      workflow_id,
      {
        sourceType: source_type,
        sourcePath: source_path,
        command,
        maxSizeMb: max_size_mb,
        compressionEnabled: compression_enabled,
        encryptionEnabled: encryption_enabled,
      }
    );

    res.json(result);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to exfiltrate data", details: error?.message || "Internal server error" });
  }
});

// Activate kill switch for workflow
router.post("/workflows/:workflow_id/kill-switch", async (req, res) => {
  try {
    const { workflow_id } = req.params;
    const { reason = "user_initiated", details } = req.body;

    await distributedWorkflowOrchestrator.activateKillSwitch(
      workflow_id,
      reason as KillSwitchReason,
      details
    );

    res.json({
      success: true,
      message: `Kill switch activated for workflow ${workflow_id}`,
      reason,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to activate kill switch", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// AGENT DEPLOYMENT (Phase 5)
// Enhancement #04 - Agentic Implants Deployment
// ============================================================================

// Get available build features
router.get("/agents/features", async (req, res) => {
  try {
    res.json({
      features: AVAILABLE_FEATURES,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get features", details: error?.message || "Internal server error" });
  }
});

// Generate a new agent bundle
router.post("/agents/generate", async (req, res) => {
  try {
    const {
      name,
      platform,
      architecture = "x64",
      features = [],
      implantType = "general",
      controllerUrl,
      operationId,
      autonomyLevel = 1,
      heartbeatInterval = 30,
      expiresAt,
    } = req.body;

    // Validation
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required" });
    }

    if (!platform || !["windows", "linux"].includes(platform)) {
      return res.status(400).json({ error: "Platform must be 'windows' or 'linux'" });
    }

    if (!controllerUrl || typeof controllerUrl !== "string") {
      return res.status(400).json({ error: "Controller URL is required" });
    }

    // Get user ID from authenticated user
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Generate bundle
    const bundle = await agentBundleGenerator.generateBundle({
      name,
      platform,
      architecture,
      features,
      implantType,
      controllerUrl,
      userId,
      operationId,
      autonomyLevel,
      heartbeatInterval,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.json({
      success: true,
      bundle: {
        id: bundle.bundleId,
        downloadUrl: bundle.downloadUrl,
        publicDownloadUrl: bundle.publicDownloadUrl,
        tokenId: bundle.tokenId,
        tokenExpiresAt: bundle.tokenExpiresAt,
        fileSize: bundle.fileSize,
        fileHash: bundle.fileHash,
        certificateSerial: bundle.certificateSerial,
        certificateFingerprint: bundle.certificateFingerprint,
      },
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to generate agent bundle", details: error?.message || "Internal server error" });
  }
});

// List all agent bundles
router.get("/agents/bundles", async (req, res) => {
  try {
    const { platform, isActive, limit = 50 } = req.query;

    const bundles = await db.query.agentBundles.findMany({
      orderBy: [desc(agentBundles.createdAt)],
      limit: Number(limit),
    });

    res.json(bundles);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list bundles", details: error?.message || "Internal server error" });
  }
});

// Get bundle by ID
router.get("/agents/bundles/:id", async (req, res) => {
  try {
    const bundle = await agentBundleGenerator.getBundle(req.params.id);

    if (!bundle) {
      return res.status(404).json({ error: "Bundle not found" });
    }

    res.json(bundle);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get bundle", details: error?.message || "Internal server error" });
  }
});

// Download bundle (authenticated)
router.get("/agents/bundles/:id/download", async (req, res) => {
  try {
    const bundle = await agentBundleGenerator.getBundle(req.params.id);

    if (!bundle) {
      return res.status(404).json({ error: "Bundle not found" });
    }

    if (!bundle.isActive) {
      return res.status(410).json({ error: "Bundle is no longer available" });
    }

    // Check file exists
    try {
      await fs.access(bundle.filePath);
    } catch {
      return res.status(404).json({ error: "Bundle file not found" });
    }

    // Increment download count
    await agentBundleGenerator.incrementDownloadCount(bundle.id);

    // Set headers and stream file
    const fileName = `${bundle.name}-${bundle.platform}-${bundle.architecture}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", bundle.fileSize);

    const fileContent = await fs.readFile(bundle.filePath);
    res.send(fileContent);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to download bundle", details: error?.message || "Internal server error" });
  }
});

// Deactivate/delete bundle
router.delete("/agents/bundles/:id", async (req, res) => {
  try {
    const bundle = await agentBundleGenerator.getBundle(req.params.id);

    if (!bundle) {
      return res.status(404).json({ error: "Bundle not found" });
    }

    await agentBundleGenerator.deactivateBundle(req.params.id);

    res.json({ success: true, message: "Bundle deactivated" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to deactivate bundle", details: error?.message || "Internal server error" });
  }
});

// Generate shareable download token
router.post("/agents/bundles/:bundleId/generate-token", async (req, res) => {
  try {
    const { bundleId } = req.params;
    const {
      maxDownloads = 1,
      expiresInHours = 24,
      description,
      allowedIpRanges,
    } = req.body;

    // Get user ID from authenticated user
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = await agentTokenService.generateToken({
      bundleId,
      userId,
      maxDownloads,
      expiresInHours,
      description,
      allowedIpRanges,
    });

    res.json({
      success: true,
      token: {
        id: token.tokenId,
        downloadUrl: token.downloadUrl,
        expiresAt: token.expiresAt,
        maxDownloads: token.maxDownloads,
      },
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to generate token", details: error?.message || "Internal server error" });
  }
});

// List tokens for a bundle
router.get("/agents/bundles/:bundleId/tokens", async (req, res) => {
  try {
    const tokens = await agentTokenService.listTokensForBundle(req.params.bundleId);
    res.json(tokens);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list tokens", details: error?.message || "Internal server error" });
  }
});

// List all active tokens
router.get("/agents/tokens", async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const tokens = await agentTokenService.listActiveTokens(Number(limit));
    res.json(tokens);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list tokens", details: error?.message || "Internal server error" });
  }
});

// Revoke a token
router.delete("/agents/tokens/:id", async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    await agentTokenService.revokeToken(req.params.id, userId);
    res.json({ success: true, message: "Token revoked" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to revoke token", details: error?.message || "Internal server error" });
  }
});

// List agent builds
router.get("/agents/builds", async (req, res) => {
  try {
    const { limit = 20, status, platform } = req.query;
    const builds = await agentBuildService.listBuilds({
      limit: Number(limit),
      platform: platform as any,
      status: status as string,
    });
    res.json(builds);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list builds", details: error?.message || "Internal server error" });
  }
});

// Get build status
router.get("/agents/builds/:id", async (req, res) => {
  try {
    const build = await agentBuildService.getBuildStatus(req.params.id);

    if (!build) {
      return res.status(404).json({ error: "Build not found" });
    }

    res.json(build);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get build status", details: error?.message || "Internal server error" });
  }
});

// Cancel a build
router.delete("/agents/builds/:id", async (req, res) => {
  try {
    await agentBuildService.cancelBuild(req.params.id);
    res.json({ success: true, message: "Build cancelled" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to cancel build", details: error?.message || "Internal server error" });
  }
});

export default router;
