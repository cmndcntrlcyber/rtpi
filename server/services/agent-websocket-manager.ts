/**
 * Agent WebSocket Manager
 *
 * General-purpose WebSocket manager for agent activity streaming and
 * human-in-the-loop approval gates. Replaces the scan-only WebSocket
 * with a unified system supporting:
 * - Real-time agent activity events
 * - Tool execution progress streaming
 * - Human approval/deny workflow for sensitive operations
 * - Client subscriptions to specific operations or agents
 */

import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { randomUUID } from "crypto";

// ============================================================================
// Types
// ============================================================================

/** Events sent from server to clients */
export interface AgentEvent {
  type: "agent_activity" | "tool_execution" | "approval_request" | "workflow_update" | "scan_output" | "error";
  eventId: string;
  agentId?: string;
  agentName?: string;
  workflowId?: string;
  operationId?: string;
  data: any;
  timestamp: string;
}

/** Messages sent from clients to server */
export interface ClientMessage {
  type: "approve" | "deny" | "abort" | "subscribe" | "unsubscribe" | "ping" | "scan_start";
  approvalId?: string;
  reason?: string;
  subscriptions?: string[]; // operationIds or agentIds to follow
  data?: any;
}

/** Pending approval request */
interface PendingApproval {
  id: string;
  tool: string;
  args: string[];
  reason: string;
  agentId: string;
  operationId: string;
  resolve: (result: { approved: boolean; reason?: string }) => void;
  timeout: NodeJS.Timeout;
  createdAt: Date;
}

/** Connected client info */
interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  subscriptions: Set<string>; // operationIds, agentIds, or "*" for all
  connectedAt: Date;
}

// ============================================================================
// Agent WebSocket Manager
// ============================================================================

export class AgentWebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map(); // clientId -> client
  private pendingApprovals: Map<string, PendingApproval> = new Map();
  private approvalTimeoutMs: number;

  constructor(server: any, approvalTimeoutMs: number = 300000) {
    this.approvalTimeoutMs = approvalTimeoutMs;
    this.wss = new WebSocketServer({ noServer: true });

    // Handle HTTP upgrade requests
    server.on("upgrade", (request: IncomingMessage, socket: any, head: Buffer) => {
      const url = request.url || "";

      // Agent WebSocket: /api/v1/ws/agents
      if (url.startsWith("/api/v1/ws/agents")) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
        return;
      }

      // Legacy scan WebSocket: /api/v1/targets/:id/scan/ws
      if (url.startsWith("/api/v1/targets/") && url.includes("/scan/ws")) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
        return;
      }
    });

    this.wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    // Cleanup stale connections every 5 minutes
    setInterval(() => this.cleanup(), 300000);

    console.log("[AgentWebSocket] Manager initialized");
  }

  // --------------------------------------------------------------------------
  // Connection handling
  // --------------------------------------------------------------------------

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const url = request.url || "";
    const clientId = randomUUID();

    // Extract userId from query params or cookie (TODO: proper session auth)
    const urlObj = new URL(url, "http://localhost");
    const userId = urlObj.searchParams.get("userId") || "anonymous";

    const client: ConnectedClient = {
      ws,
      userId,
      subscriptions: new Set(["*"]), // Subscribe to all by default
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);
    console.log(`[AgentWebSocket] Client connected: ${clientId} (user: ${userId})`);

    // Send ready event
    this.sendToClient(client, {
      type: "agent_activity",
      eventId: randomUUID(),
      data: { status: "connected", clientId, message: "WebSocket connection established" },
      timestamp: new Date().toISOString(),
    });

    ws.on("message", (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.handleClientMessage(clientId, message);
      } catch (err) {
        console.error("[AgentWebSocket] Invalid message:", err);
      }
    });

    ws.on("close", () => {
      console.log(`[AgentWebSocket] Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    });

    ws.on("error", (err) => {
      console.error(`[AgentWebSocket] Client error ${clientId}:`, err);
      this.clients.delete(clientId);
    });
  }

  private handleClientMessage(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case "ping":
        this.sendToClient(client, {
          type: "agent_activity",
          eventId: randomUUID(),
          data: { pong: true },
          timestamp: new Date().toISOString(),
        });
        break;

      case "subscribe":
        if (message.subscriptions) {
          for (const sub of message.subscriptions) {
            client.subscriptions.add(sub);
          }
        }
        break;

      case "unsubscribe":
        if (message.subscriptions) {
          for (const sub of message.subscriptions) {
            client.subscriptions.delete(sub);
          }
        }
        break;

      case "approve":
        this.handleApprovalResponse(message.approvalId!, true, message.reason);
        break;

      case "deny":
        this.handleApprovalResponse(message.approvalId!, false, message.reason);
        break;

      case "abort":
        // Broadcast abort to interested listeners
        this.broadcastEvent({
          type: "workflow_update",
          eventId: randomUUID(),
          operationId: message.data?.operationId,
          data: { action: "abort", reason: message.reason },
          timestamp: new Date().toISOString(),
        });
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Broadcasting
  // --------------------------------------------------------------------------

  /** Broadcast an event to all subscribed clients */
  broadcastEvent(event: AgentEvent): void {
    for (const client of this.clients.values()) {
      if (this.isClientSubscribed(client, event)) {
        this.sendToClient(client, event);
      }
    }
  }

  /** Send event to a specific user */
  broadcastToUser(userId: string, event: AgentEvent): void {
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        this.sendToClient(client, event);
      }
    }
  }

  /** Broadcast agent tool execution event */
  emitToolExecution(params: {
    agentId: string;
    agentName: string;
    operationId: string;
    tool: string;
    args: string[];
    iteration: number;
    exitCode?: number;
    outputLength?: number;
  }): void {
    this.broadcastEvent({
      type: "tool_execution",
      eventId: randomUUID(),
      agentId: params.agentId,
      agentName: params.agentName,
      operationId: params.operationId,
      data: {
        tool: params.tool,
        args: params.args,
        iteration: params.iteration,
        exitCode: params.exitCode,
        outputLength: params.outputLength,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // --------------------------------------------------------------------------
  // Approval flow
  // --------------------------------------------------------------------------

  /**
   * Request human approval for a sensitive operation.
   * Returns a Promise that resolves when the human approves or denies,
   * or auto-denies after the timeout (safe default).
   */
  requestApproval(request: {
    tool: string;
    args: string[];
    reason: string;
    agentId: string;
    operationId: string;
  }): Promise<{ approved: boolean; reason?: string }> {
    return new Promise((resolve) => {
      const approvalId = randomUUID();

      // Auto-deny after timeout
      const timeout = setTimeout(() => {
        const pending = this.pendingApprovals.get(approvalId);
        if (pending) {
          this.pendingApprovals.delete(approvalId);
          resolve({ approved: false, reason: "Approval timeout — auto-denied" });
        }
      }, this.approvalTimeoutMs);

      this.pendingApprovals.set(approvalId, {
        id: approvalId,
        ...request,
        resolve,
        timeout,
        createdAt: new Date(),
      });

      // Send approval request to all connected clients
      this.broadcastEvent({
        type: "approval_request",
        eventId: randomUUID(),
        agentId: request.agentId,
        operationId: request.operationId,
        data: {
          approvalId,
          tool: request.tool,
          args: request.args,
          reason: request.reason,
          timeoutMs: this.approvalTimeoutMs,
        },
        timestamp: new Date().toISOString(),
      });
    });
  }

  private handleApprovalResponse(approvalId: string, approved: boolean, reason?: string): void {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) {
      console.warn(`[AgentWebSocket] Unknown approval ID: ${approvalId}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingApprovals.delete(approvalId);

    console.log(`[AgentWebSocket] Approval ${approvalId}: ${approved ? "APPROVED" : "DENIED"} — ${reason || "no reason"}`);

    // Notify all clients of the decision
    this.broadcastEvent({
      type: "workflow_update",
      eventId: randomUUID(),
      agentId: pending.agentId,
      operationId: pending.operationId,
      data: {
        action: approved ? "approval_granted" : "approval_denied",
        approvalId,
        tool: pending.tool,
        reason,
      },
      timestamp: new Date().toISOString(),
    });

    pending.resolve({ approved, reason });
  }

  // --------------------------------------------------------------------------
  // Scan streaming (backward compatibility with ScanWebSocketManager)
  // --------------------------------------------------------------------------

  /** Stream scan output to subscribed clients for a specific target */
  sendScanOutput(targetId: string, data: any): void {
    this.broadcastEvent({
      type: "scan_output",
      eventId: randomUUID(),
      data: { targetId, ...data },
      timestamp: new Date().toISOString(),
    });
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private isClientSubscribed(client: ConnectedClient, event: AgentEvent): boolean {
    if (client.subscriptions.has("*")) return true;
    if (event.operationId && client.subscriptions.has(event.operationId)) return true;
    if (event.agentId && client.subscriptions.has(event.agentId)) return true;
    return false;
  }

  private sendToClient(client: ConnectedClient, event: AgentEvent): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(event));
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.connectedAt.getTime() > maxAge && client.ws.readyState !== WebSocket.OPEN) {
        client.ws.close();
        this.clients.delete(clientId);
      }
    }
  }

  /** Get connected client count */
  getClientCount(): number {
    return this.clients.size;
  }

  /** Get pending approval count */
  getPendingApprovalCount(): number {
    return this.pendingApprovals.size;
  }
}

// Singleton (initialized in server/index.ts)
export let agentWebSocketManager: AgentWebSocketManager | null = null;

export function initializeAgentWebSocketManager(server: any): AgentWebSocketManager {
  agentWebSocketManager = new AgentWebSocketManager(server);
  return agentWebSocketManager;
}
