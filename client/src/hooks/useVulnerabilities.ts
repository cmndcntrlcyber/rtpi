import { useState, useEffect } from "react";
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

  const fetchVulnerabilities = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await vulnerabilitiesService.list();
      setVulnerabilities(response.vulnerabilities || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch vulnerabilities");
      console.error("Error fetching vulnerabilities:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVulnerabilities();
  }, []);

  return {
    vulnerabilities,
    loading,
    error,
    refetch: fetchVulnerabilities,
  };
}
