import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export interface ReporterAgent {
  id: string;
  name: string;
  type: string;
  status: string;
  config: any;
  latestReport: any;
  lastReportAt: string | null;
}

export function useReporterAgents() {
  const [agents, setAgents] = useState<ReporterAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/operations-management/reporters");
      setAgents(response.reporters || []);
    } catch (err: any) {
      console.error("Failed to fetch reporter agents:", err);
      setError(err.response?.data?.error || err.message || "Failed to fetch reporter agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();

    // Poll every 5 minutes
    const interval = setInterval(fetchAgents, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    agents,
    loading,
    error,
    refetch: fetchAgents,
  };
}
