import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  config?: any;
  capabilities?: string[];
  lastActivity?: string;
  tasksCompleted: number;
  tasksFailed: number;
  createdAt: string;
  updatedAt: string;
}

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ agents: Agent[] }>("/agents");
      setAgents(response.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
      // Error handled by component
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  return {
    agents,
    loading,
    error,
    refetch: fetchAgents,
  };
}
