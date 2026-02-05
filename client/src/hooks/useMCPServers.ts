import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export interface MCPServer {
  id: string;
  name: string;
  deviceId?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  status: string;
  pid?: number;
  autoRestart: boolean;
  maxRestarts: number;
  restartCount: number;
  uptime?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export function useMCPServers() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchServers = useCallback(async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ servers: MCPServer[] }>("/mcp-servers", {
        signal: abortControllerRef.current.signal,
      });
      setServers(response.servers || []);
    } catch (err) {
      // Ignore abort errors - these are expected when unmounting
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch MCP servers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchServers]);

  return {
    servers,
    loading,
    error,
    refetch: fetchServers,
  };
}
