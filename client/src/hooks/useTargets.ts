import { useState, useEffect } from "react";
import { targetsService } from "@/services/targets";

interface Target {
  id: string;
  hostname?: string;
  ipAddress?: string;
  domain?: string;
  port?: number;
  status: string;
  operationId?: string;
  notes?: string;
  lastScanAt?: string;
}

export function useTargets() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await targetsService.list();
      setTargets(response.targets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch targets");
      console.error("Error fetching targets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  return {
    targets,
    loading,
    error,
    refetch: fetchTargets,
  };
}
