/**
 * Scan WebSocket Manager
 * 
 * FIX BUG #4: Manages WebSocket connections for real-time scan progress
 * 
 * Provides real-time streaming of nmap scan output to connected clients
 */

import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { dockerExecutor } from "./docker-executor";

interface ScanSession {
  targetId: string;
  targetValue: string;
  userId: string;
  ws: WebSocket;
  startedAt: Date;
  aborted: boolean;
}

export class ScanWebSocketManager {
  private wss: WebSocketServer;
  private sessions: Map<string, ScanSession> = new Map();

  constructor(server: any) {
    // Create WebSocket server attached to HTTP server
    this.wss = new WebSocketServer({ noServer: true });

    // Handle upgrade requests
    server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
      // Check if this is a scan WebSocket request
      if (request.url?.startsWith('/api/v1/targets/') && request.url?.includes('/scan/ws')) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      }
    });

    // Handle new connections
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    console.log('[ScanWebSocket] WebSocket manager initialized');
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage) {
    const url = request.url || '';
    console.log(`[ScanWebSocket] New connection: ${url}`);

    // Extract target ID from URL: /api/v1/targets/:id/scan/ws
    const match = url.match(/\/api\/v1\/targets\/([^/]+)\/scan\/ws/);
    if (!match) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid WebSocket URL' 
      }));
      ws.close();
      return;
    }

    const targetId = match[1];
    const sessionId = `${targetId}-${Date.now()}`;

    // Store session (we'll populate target details when scan starts)
    const session: ScanSession = {
      targetId,
      targetValue: '',
      userId: '', // TODO: Extract from session/token
      ws,
      startedAt: new Date(),
      aborted: false,
    };

    this.sessions.set(sessionId, session);

    // Handle messages from client
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(sessionId, message);
      } catch (error) {
        console.error('[ScanWebSocket] Failed to parse client message:', error);
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      console.log(`[ScanWebSocket] Client disconnected: ${sessionId}`);
      const session = this.sessions.get(sessionId);
      if (session) {
        session.aborted = true;
        this.sessions.delete(sessionId);
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[ScanWebSocket] WebSocket error for ${sessionId}:`, error);
      this.sessions.delete(sessionId);
    });

    // Send ready message
    ws.send(JSON.stringify({
      type: 'ready',
      sessionId,
      message: 'WebSocket connection established'
    }));
  }

  private handleClientMessage(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    switch (message.type) {
      case 'ping':
        session.ws.send(JSON.stringify({ type: 'pong' }));
        break;
      
      case 'abort':
        console.log(`[ScanWebSocket] Client requested abort for ${sessionId}`);
        session.aborted = true;
        session.ws.send(JSON.stringify({ 
          type: 'aborted', 
          message: 'Scan aborted by user' 
        }));
        break;
      
      default:
        console.warn(`[ScanWebSocket] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Stream scan output to WebSocket client
   */
  async streamScan(
    targetId: string,
    targetValue: string,
    sanitizedTarget: string,
    timeout: number
  ): Promise<void> {
    // Find active WebSocket session for this target
    const session = Array.from(this.sessions.values()).find(
      s => s.targetId === targetId && !s.aborted
    );

    if (!session) {
      throw new Error('No active WebSocket session for this scan');
    }

    const ws = session.ws;

    try {
      // Send scan start notification
      ws.send(JSON.stringify({
        type: 'scan_start',
        targetId,
        targetValue,
        sanitizedTarget,
        timeout,
        timestamp: new Date().toISOString()
      }));

      // Execute scan with streaming output
      const cmd = ["sudo", "nmap", "-Pn", "-sV", "-T5", "-v5", "-p1-65535", sanitizedTarget];
      
      ws.send(JSON.stringify({
        type: 'command',
        command: cmd.join(' ')
      }));

      // Use docker executor's stream method
      const streamIterator = dockerExecutor.execStream("rtpi-tools", cmd, { timeout });

      // Stream output line by line
      for await (const chunk of streamIterator) {
        if (session.aborted) {
          ws.send(JSON.stringify({
            type: 'scan_aborted',
            message: 'Scan was aborted'
          }));
          throw new Error('Scan aborted by user');
        }

        // Send output chunk to client
        ws.send(JSON.stringify({
          type: 'output',
          data: chunk
        }));
      }

      // Scan completed successfully
      ws.send(JSON.stringify({
        type: 'scan_complete',
        message: 'Scan completed successfully',
        timestamp: new Date().toISOString()
      }));

    } catch (error) {
      // Send error to client
      ws.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Scan failed',
        timestamp: new Date().toISOString()
      }));

      throw error;
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up old sessions
   */
  cleanupSessions(maxAgeMs: number = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.startedAt.getTime() > maxAgeMs) {
        console.log(`[ScanWebSocket] Cleaning up stale session: ${sessionId}`);
        session.ws.close();
        this.sessions.delete(sessionId);
      }
    }
  }
}

// Singleton instance (will be initialized in server/index.ts)
export let scanWebSocketManager: ScanWebSocketManager | null = null;

export function initializeScanWebSocketManager(server: any): ScanWebSocketManager {
  scanWebSocketManager = new ScanWebSocketManager(server);
  
  // Clean up stale sessions every 10 minutes
  setInterval(() => {
    scanWebSocketManager?.cleanupSessions();
  }, 600000);

  return scanWebSocketManager;
}
