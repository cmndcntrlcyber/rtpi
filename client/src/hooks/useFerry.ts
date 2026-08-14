import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface FerryHealth {
  status: string;
  server_name?: string;
  version?: string;
  agents_connected?: number;
  message?: string;
}

export interface FerryAgent {
  peer_id: string;
  os: string;
  version: string;
  tag: string;
  last_seen_unix: number;
}

export interface FerryAnomaly {
  barometer: number;
  agent_attributions: Record<string, number>;
  throttling_active: boolean;
}

export function useFerryHealth(pollInterval = 30000) {
  const [health, setHealth] = useState<FerryHealth | null>(null);
  const [agents, setAgents] = useState<FerryAgent[]>([]);
  const [anomaly, setAnomaly] = useState<FerryAnomaly | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [h, a, an] = await Promise.all([
        api.get<FerryHealth>("/ferry/health").catch(() => null),
        api.get<{ agents: FerryAgent[] }>("/ferry/agents").catch(() => ({ agents: [] })),
        api.get<FerryAnomaly>("/ferry/anomaly").catch(() => null),
      ]);
      setHealth(h);
      setAgents(a?.agents || []);
      setAnomaly(an);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { health, agents, anomaly, loading, refresh };
}
