import { useState, useEffect, useCallback, useRef } from "react";
import {
  sysReptorService,
  SysReptorStatus,
  SysReptorProject,
  SysReptorDesign,
  ExportResult,
} from "@/services/sysreptor";

export function useSysReptorStatus() {
  const [status, setStatus] = useState<SysReptorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await sysReptorService.checkStatus({
        signal: abortControllerRef.current.signal,
      });
      setStatus(response);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to check SysReptor status");
      setStatus({ connected: false, tokenConfigured: false, url: "" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchStatus]);

  return { status, loading, error, refetch: fetchStatus };
}

export function useSysReptorProjects() {
  const [projects, setProjects] = useState<SysReptorProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchProjects = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await sysReptorService.listProjects({
        signal: abortControllerRef.current.signal,
      });
      setProjects(response.projects || []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchProjects]);

  return { projects, loading, error, refetch: fetchProjects };
}

export function useSysReptorDesigns() {
  const [designs, setDesigns] = useState<SysReptorDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchDesigns = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await sysReptorService.listDesigns({
        signal: abortControllerRef.current.signal,
      });
      setDesigns(response.designs || []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch designs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDesigns();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDesigns]);

  return { designs, loading, error, refetch: fetchDesigns };
}

export function useExportToSysReptor() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportOperation = async (data: {
    operationId: string;
    designId: string;
    name?: string;
    tags?: string[];
  }): Promise<ExportResult> => {
    try {
      setExporting(true);
      setError(null);
      const response = await sysReptorService.exportOperation(data);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setError(message);
      throw err;
    } finally {
      setExporting(false);
    }
  };

  return { exportOperation, exporting, error };
}
