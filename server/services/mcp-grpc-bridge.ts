import { EventEmitter } from "events";
import { db } from "../db";
import { agents, rustNexusImplants, rustNexusTasks } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * MCP Tool Request - represents a tool call from an agent
 */
interface MCPToolRequest {
  requestId: string;
  agentId: string;
  toolName: string;
  toolCategory: string;
  parameters: Record<string, any>;
  implantId?: string; // Optional target implant
  timeout?: number;
}

/**
 * MCP Tool Response - result from tool execution
 */
interface MCPToolResponse {
  requestId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTimeMs: number;
  implantId?: string;
}

/**
 * Implant capability mapping for MCP tools
 */
interface ImplantCapability {
  implantId: string;
  implantName: string;
  capabilities: string[];
  status: string;
  connectionQuality: number;
}

/**
 * MCP-gRPC Bridge Service
 *
 * Bridges MCP tool calls from agents to rust-nexus implants via gRPC-style communication.
 * This enables agents to execute tools and commands through deployed implants.
 */
class MCPGRPCBridge extends EventEmitter {
  private isActive = false;
  private pendingRequests: Map<string, {
    request: MCPToolRequest;
    resolve: (response: MCPToolResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  private readonly DEFAULT_TIMEOUT_MS = 60000; // 1 minute default timeout

  constructor() {
    super();
  }

  /**
   * Start the bridge service
   */
  async start(): Promise<void> {
    if (this.isActive) return;

    console.log("[MCPGRPCBridge] Starting MCP-gRPC Bridge service...");
    this.isActive = true;
    this.emit("started");
    console.log("[MCPGRPCBridge] MCP-gRPC Bridge service started");
  }

  /**
   * Stop the bridge service
   */
  async stop(): Promise<void> {
    if (!this.isActive) return;

    console.log("[MCPGRPCBridge] Stopping MCP-gRPC Bridge service...");

    // Cancel all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Bridge service stopped"));
    }
    this.pendingRequests.clear();

    this.isActive = false;
    this.emit("stopped");
    console.log("[MCPGRPCBridge] MCP-gRPC Bridge service stopped");
  }

  /**
   * Execute an MCP tool on an implant
   */
  async executeToolOnImplant(request: MCPToolRequest): Promise<MCPToolResponse> {
    if (!this.isActive) {
      throw new Error("MCP-gRPC Bridge is not active");
    }

    const startTime = Date.now();

    try {
      // Find the best implant if not specified
      let targetImplantId = request.implantId;
      if (!targetImplantId) {
        const implant = await this.findBestImplantForTool(request.toolName, request.toolCategory);
        if (!implant) {
          return {
            requestId: request.requestId,
            success: false,
            error: "No suitable implant found for tool execution",
            executionTimeMs: Date.now() - startTime,
          };
        }
        targetImplantId = implant.implantId;
      }

      // Verify implant is connected
      const [implant] = await db
        .select()
        .from(rustNexusImplants)
        .where(eq(rustNexusImplants.id, targetImplantId))
        .limit(1);

      if (!implant || implant.status !== "connected") {
        return {
          requestId: request.requestId,
          success: false,
          error: `Implant ${targetImplantId} is not connected`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Translate MCP tool call to rust-nexus task
      const task = this.translateToolToTask(request, targetImplantId);

      // Create task in database
      const [createdTask] = await db
        .insert(rustNexusTasks)
        .values({
          implantId: targetImplantId,
          taskType: task.taskType,
          taskName: task.taskName,
          taskDescription: `MCP tool: ${request.toolName}`,
          command: task.command,
          parameters: task.parameters,
          timeoutSeconds: Math.floor((request.timeout || this.DEFAULT_TIMEOUT_MS) / 1000),
          status: "queued",
          createdBy: request.agentId,
        })
        .returning();

      // Wait for task completion (with timeout)
      const result = await this.waitForTaskCompletion(
        createdTask.id,
        request.timeout || this.DEFAULT_TIMEOUT_MS
      );

      return {
        requestId: request.requestId,
        success: result.success,
        result: result.data,
        error: result.error,
        executionTimeMs: Date.now() - startTime,
        implantId: targetImplantId,
      };

    } catch (error) {
      return {
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Find the best implant for executing a specific tool
   */
  async findBestImplantForTool(
    toolName: string,
    toolCategory: string
  ): Promise<ImplantCapability | null> {
    // Get all connected implants
    const implants = await db
      .select()
      .from(rustNexusImplants)
      .where(eq(rustNexusImplants.status, "connected"));

    if (implants.length === 0) return null;

    // Map tool categories to implant capabilities
    const requiredCapability = this.getRequiredCapability(toolCategory);

    // Find implants with matching capability
    const matchingImplants = implants.filter(implant => {
      const capabilities = (implant.capabilities as string[]) || [];
      return capabilities.includes(requiredCapability) || capabilities.includes("general");
    });

    if (matchingImplants.length === 0) {
      // Fall back to any connected implant
      const fallback = implants[0];
      return {
        implantId: fallback.id,
        implantName: fallback.implantName,
        capabilities: (fallback.capabilities as string[]) || [],
        status: fallback.status,
        connectionQuality: fallback.connectionQuality || 100,
      };
    }

    // Sort by connection quality and pick the best
    matchingImplants.sort((a, b) => (b.connectionQuality || 100) - (a.connectionQuality || 100));
    const best = matchingImplants[0];

    return {
      implantId: best.id,
      implantName: best.implantName,
      capabilities: (best.capabilities as string[]) || [],
      status: best.status,
      connectionQuality: best.connectionQuality || 100,
    };
  }

  /**
   * Get available implant capabilities
   */
  async getAvailableCapabilities(): Promise<ImplantCapability[]> {
    const implants = await db
      .select()
      .from(rustNexusImplants)
      .where(eq(rustNexusImplants.status, "connected"));

    return implants.map(implant => ({
      implantId: implant.id,
      implantName: implant.implantName,
      capabilities: (implant.capabilities as string[]) || [],
      status: implant.status,
      connectionQuality: implant.connectionQuality || 100,
    }));
  }

  /**
   * Translate MCP tool call to rust-nexus task
   */
  private translateToolToTask(
    request: MCPToolRequest,
    implantId: string
  ): {
    taskType: string;
    taskName: string;
    command: string;
    parameters: Record<string, any>;
  } {
    // Map tool categories to task types
    const taskTypeMap: Record<string, string> = {
      reconnaissance: "reconnaissance",
      scanning: "reconnaissance",
      vulnerability: "exploitation",
      exploitation: "exploitation",
      web: "shell_command",
      network: "shell_command",
      file: "file_download",
      credential: "shell_command",
    };

    const taskType = taskTypeMap[request.toolCategory] || "shell_command";

    // Build command based on tool
    let command = request.toolName;
    const params = request.parameters;

    // Handle common parameter patterns
    if (params.target) {
      command += ` ${params.target}`;
    }
    if (params.options) {
      command += ` ${params.options}`;
    }

    return {
      taskType,
      taskName: `MCP: ${request.toolName}`,
      command,
      parameters: params,
    };
  }

  /**
   * Map tool category to implant capability
   */
  private getRequiredCapability(toolCategory: string): string {
    const capabilityMap: Record<string, string> = {
      reconnaissance: "network_scan",
      scanning: "vulnerability_scan",
      vulnerability: "exploit_execution",
      exploitation: "exploit_execution",
      web: "command_execution",
      network: "network_scan",
      file: "file_operations",
      credential: "credential_harvesting",
    };

    return capabilityMap[toolCategory] || "command_execution";
  }

  /**
   * Wait for task completion with timeout
   */
  private async waitForTaskCompletion(
    taskId: string,
    timeoutMs: number
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second

    while (Date.now() - startTime < timeoutMs) {
      const [task] = await db
        .select()
        .from(rustNexusTasks)
        .where(eq(rustNexusTasks.id, taskId))
        .limit(1);

      if (!task) {
        return { success: false, error: "Task not found" };
      }

      if (task.status === "completed") {
        return { success: true, data: task.parameters };
      }

      if (task.status === "failed") {
        return { success: false, error: task.errorMessage || "Task failed" };
      }

      if (task.status === "timeout") {
        return { success: false, error: "Task timed out" };
      }

      if (task.status === "cancelled") {
        return { success: false, error: "Task cancelled" };
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return { success: false, error: "Timeout waiting for task completion" };
  }

  /**
   * Stream results from implant to agent
   */
  async streamResults(
    taskId: string,
    onData: (data: any) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<void> {
    const pollInterval = 500; // 500ms
    let lastResultCount = 0;

    const poll = async () => {
      try {
        const [task] = await db
          .select()
          .from(rustNexusTasks)
          .where(eq(rustNexusTasks.id, taskId))
          .limit(1);

        if (!task) {
          onError(new Error("Task not found"));
          return;
        }

        // Check for new results
        const results = (task.parameters as any)?.results || [];
        if (results.length > lastResultCount) {
          for (let i = lastResultCount; i < results.length; i++) {
            onData(results[i]);
          }
          lastResultCount = results.length;
        }

        // Check if task is complete
        if (["completed", "failed", "timeout", "cancelled"].includes(task.status)) {
          onComplete();
          return;
        }

        // Continue polling
        setTimeout(poll, pollInterval);
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    poll();
  }

  /**
   * Register an agent to receive implant results
   */
  registerAgentForResults(agentId: string, callback: (result: MCPToolResponse) => void): void {
    this.on(`result:${agentId}`, callback);
  }

  /**
   * Unregister an agent from results
   */
  unregisterAgentForResults(agentId: string): void {
    this.removeAllListeners(`result:${agentId}`);
  }

  /**
   * Handle incoming result from implant
   */
  handleImplantResult(taskId: string, result: any): void {
    // Find pending request for this task
    for (const [requestId, pending] of this.pendingRequests) {
      // Match by some criteria (would need task ID tracking)
      // For now, emit a general event
      this.emit("implant_result", { taskId, result });
    }
  }

  /**
   * Get bridge status
   */
  getStatus(): {
    isActive: boolean;
    pendingRequests: number;
  } {
    return {
      isActive: this.isActive,
      pendingRequests: this.pendingRequests.size,
    };
  }
}

// Export singleton instance
export const mcpGrpcBridge = new MCPGRPCBridge();
export default mcpGrpcBridge;
