/**
 * useAgentWebSocket - React hook for Agent WebSocket connection
 *
 * Provides real-time agent activity events, tool execution progress,
 * and human-in-the-loop approval actions.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

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

export interface ApprovalRequest {
  approvalId: string;
  tool: string;
  args: string[];
  reason: string;
  timeoutMs: number;
}

export interface UseAgentWebSocketOptions {
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Operation IDs to subscribe to (empty = all) */
  subscriptions?: string[];
  /** Reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Max reconnect attempts (default: 5) */
  maxReconnectAttempts?: number;
}

export interface UseAgentWebSocketReturn {
  /** Whether the WebSocket is connected */
  connected: boolean;
  /** Recent events (last 100) */
  events: AgentEvent[];
  /** Pending approval requests */
  pendingApprovals: ApprovalRequest[];
  /** Approve a pending request */
  approve: (approvalId: string, reason?: string) => void;
  /** Deny a pending request */
  deny: (approvalId: string, reason?: string) => void;
  /** Subscribe to operations/agents */
  subscribe: (ids: string[]) => void;
  /** Unsubscribe from operations/agents */
  unsubscribe: (ids: string[]) => void;
  /** Manually connect */
  connect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Connection error if any */
  error: string | null;
}

// ============================================================================
// Hook
// ============================================================================

const MAX_EVENTS = 100;

export function useAgentWebSocket(
  options: UseAgentWebSocketOptions = {},
): UseAgentWebSocketReturn {
  const {
    autoConnect = true,
    subscriptions = [],
    autoReconnect = true,
    maxReconnectAttempts = 5,
  } = options;

  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendMessage = useCallback((msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const handleEvent = useCallback((event: AgentEvent) => {
    setEvents((prev) => {
      const next = [event, ...prev];
      return next.slice(0, MAX_EVENTS);
    });

    // Track approval requests
    if (event.type === "approval_request" && event.data?.approvalId) {
      setPendingApprovals((prev) => [
        ...prev,
        {
          approvalId: event.data.approvalId,
          tool: event.data.tool,
          args: event.data.args || [],
          reason: event.data.reason,
          timeoutMs: event.data.timeoutMs || 300000,
        },
      ]);
    }

    // Remove resolved approvals
    if (event.type === "workflow_update" && event.data?.approvalId) {
      setPendingApprovals((prev) =>
        prev.filter((a) => a.approvalId !== event.data.approvalId),
      );
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/agents`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Send initial subscriptions
        if (subscriptions.length > 0) {
          sendMessage({ type: "subscribe", subscriptions });
        }
      };

      ws.onmessage = (msg) => {
        try {
          const event: AgentEvent = JSON.parse(msg.data);
          handleEvent(event);
        } catch {
          // Ignore unparseable messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection error");
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [subscriptions, autoReconnect, maxReconnectAttempts, sendMessage, handleEvent]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, [maxReconnectAttempts]);

  const approve = useCallback(
    (approvalId: string, reason?: string) => {
      sendMessage({ type: "approve", approvalId, reason });
      setPendingApprovals((prev) => prev.filter((a) => a.approvalId !== approvalId));
    },
    [sendMessage],
  );

  const deny = useCallback(
    (approvalId: string, reason?: string) => {
      sendMessage({ type: "deny", approvalId, reason });
      setPendingApprovals((prev) => prev.filter((a) => a.approvalId !== approvalId));
    },
    [sendMessage],
  );

  const subscribe = useCallback(
    (ids: string[]) => sendMessage({ type: "subscribe", subscriptions: ids }),
    [sendMessage],
  );

  const unsubscribe = useCallback(
    (ids: string[]) => sendMessage({ type: "unsubscribe", subscriptions: ids }),
    [sendMessage],
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [autoConnect, connect]);

  return {
    connected,
    events,
    pendingApprovals,
    approve,
    deny,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
    error,
  };
}
