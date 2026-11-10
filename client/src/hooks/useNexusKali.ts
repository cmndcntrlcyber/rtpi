import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface NexusKaliStatus {
  running: boolean;
  healthy: boolean;
  uptime?: string;
  image?: string;
  containerId?: string;
  state?: string;
  startedAt?: string;
  ports?: Record<string, string>;
}

export interface ScanResultFile {
  name: string;
  size: number;
  modified: string;
  path: string;
}

export interface EngagementEntry {
  name: string;
  files: string[];
  modified: string;
}

export function useNexusKaliStatus(pollInterval = 15000) {
  const [status, setStatus] = useState<NexusKaliStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await api.get<NexusKaliStatus>("/nexus-kali/status").catch(() => null);
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { status, loading, refresh };
}

export function useNexusKaliResults() {
  const [results, setResults] = useState<ScanResultFile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api
        .get<{ files: ScanResultFile[] }>("/nexus-kali/results")
        .catch(() => ({ files: [] }));
      setResults(data?.files || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { results, loading, refresh };
}

export function useNexusKaliLogs(lines = 100) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const text = await api
        .get<string>("/nexus-kali/logs", { params: { lines } })
        .catch(() => "");
      const parsed = typeof text === "string" ? text.split("\n").filter(Boolean) : [];
      setLogs(parsed);
    } finally {
      setLoading(false);
    }
  }, [lines]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { logs, loading, refresh };
}

export function useNexusKaliEngagements() {
  const [engagements, setEngagements] = useState<EngagementEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api
        .get<{ engagements: EngagementEntry[] }>("/nexus-kali/engagements")
        .catch(() => ({ engagements: [] }));
      setEngagements(data?.engagements || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { engagements, loading, refresh };
}
