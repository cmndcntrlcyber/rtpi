import { useState, useEffect } from "react";
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

  const fetchServers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ servers: MCPServer[] }>("/mcp-servers");
      setServers(response.servers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch MCP servers");
      // Error handled by component
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  return {
    servers,
    loading,
    error,
    refetch: fetchServers,
  };
}
