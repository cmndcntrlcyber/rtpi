import { useState, useEffect, useCallback, useRef } from "react";
import { targetsService } from "@/services/targets";

interface Target {
  id: string;
  name?: string;
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTargets = useCallback(async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await targetsService.list({
        signal: abortControllerRef.current.signal,
      });
      setTargets(response.targets || []);
    } catch (err) {
      // Ignore abort errors - these are expected when unmounting
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch targets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTargets();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTargets]);

  return {
    targets,
    loading,
    error,
    refetch: fetchTargets,
  };
}
