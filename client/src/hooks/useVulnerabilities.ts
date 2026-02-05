import { useState, useEffect, useCallback, useRef } from "react";
import { vulnerabilitiesService } from "@/services/vulnerabilities";

interface Vulnerability {
  id: string;
  title: string;
  description?: string;
  severity: string;
  cvss?: number;
  cve?: string;
  status: string;
  targetId?: string;
  operationId?: string;
  discoveredAt: string;
  remediatedAt?: string;
}

export function useVulnerabilities() {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchVulnerabilities = useCallback(async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await vulnerabilitiesService.list({
        signal: abortControllerRef.current.signal,
      });
      setVulnerabilities(response.vulnerabilities || []);
    } catch (err) {
      // Ignore abort errors - these are expected when unmounting
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch vulnerabilities");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVulnerabilities();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchVulnerabilities]);

  return {
    vulnerabilities,
    loading,
    error,
    refetch: fetchVulnerabilities,
  };
}
