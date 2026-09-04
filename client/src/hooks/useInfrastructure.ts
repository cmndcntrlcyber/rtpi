import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";

// Live infrastructure data for the Infrastructure page. Replaces the page's
// former hardcoded mock arrays. Fetches on mount and polls every 20s so the
// container / device / health views stay current without a manual refresh.

export interface ContainerSummary {
  container: string;
  tools: string[];
  state: string;
  running: boolean;
  image?: string;
  lastHealthAt?: string | null;
  lastHealthOk?: boolean | null;
}

export interface McpServerSummary {
  id: string;
  name: string;
  status: string | null;
  lastProbeAt?: string | null;
  lastProbeOk?: boolean | null;
}

export interface DeviceRow {
  id: string;
  name: string;
  deviceId: string;
  ipAddress: string | null;
  isBlocked: boolean;
  lastSeen: string | null;
}

export interface HealthCheckRow {
  id: string;
  name: string;
  type: string;
  status: string;
  endpoint?: string | null;
  lastCheck?: string | null;
  message?: string | null;
}

const POLL_INTERVAL_MS = 20000;

export function useInfrastructure() {
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerSummary[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthCheckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async (showSpinner = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (showSpinner) setLoading(true);
    try {
      const [containerRes, deviceRes, healthRes] = await Promise.all([
        api.get<{ containers: ContainerSummary[]; mcpServers: McpServerSummary[] }>("/health-checks/containers"),
        api.get<{ devices: DeviceRow[] }>("/devices"),
        api.get<{ healthChecks: HealthCheckRow[] }>("/health-checks"),
      ]);
      setContainers(containerRes.containers || []);
      setMcpServers(containerRes.mcpServers || []);
      setDevices(deviceRes.devices || []);
      setHealthChecks(healthRes.healthChecks || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return {
    containers,
    mcpServers,
    devices,
    healthChecks,
    loading,
    error,
    refetch: () => load(true),
  };
}
