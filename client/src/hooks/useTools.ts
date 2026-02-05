import { useState, useEffect, useCallback, useRef } from "react";
import { toolsService, Tool } from "@/services/tools";

export function useTools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTools = useCallback(async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const response = await toolsService.list({
        signal: abortControllerRef.current.signal,
      });
      setTools(response.tools || []);
    } catch (err) {
      // Ignore abort errors - these are expected when unmounting
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to fetch tools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTools]);

  return {
    tools,
    loading,
    error,
    refetch: fetchTools,
  };
}

export function useExecuteTool() {
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async (id: string, params?: any) => {
    try {
      setExecuting(true);
      setError(null);
      const response = await toolsService.execute(id, params);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute tool");
      // Error handled by component
      throw err;
    } finally {
      setExecuting(false);
    }
  };

  return {
    execute,
    executing,
    error,
  };
}

export function useLaunchTool() {
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const launch = async (id: string) => {
    try {
      setLaunching(true);
      setError(null);
      const response = await toolsService.launch(id);
      
      // Open URL in new window if provided
      if (response.url) {
        window.open(response.url, "_blank");
      }
      
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch tool");
      // Error handled by component
      throw err;
    } finally {
      setLaunching(false);
    }
  };

  return {
    launch,
    launching,
    error,
  };
}

export function useUploadToolFile() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (toolId: string, file: File) => {
    try {
      setUploading(true);
      setError(null);
      const response = await toolsService.upload(toolId, file);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
      // Error handled by component
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return {
    upload,
    uploading,
    error,
  };
}

export function useExecuteDockerTool() {
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeDocker = async (
    id: string,
    params: { targetId?: string; agentId?: string; params?: any; command?: string[] }
  ) => {
    try {
      setExecuting(true);
      setError(null);
      const response = await toolsService.executeDocker(id, params);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute tool");
      // Error handled by component
      throw err;
    } finally {
      setExecuting(false);
    }
  };

  return {
    executeDocker,
    executing,
    error,
  };
}

export function useDeleteTool() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteTool = async (id: string) => {
    try {
      setDeleting(true);
      setError(null);
      const response = await toolsService.delete(id);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tool");
      // Error handled by component
      throw err;
    } finally {
      setDeleting(false);
    }
  };

  return {
    deleteTool,
    deleting,
    error,
  };
}

export interface RefreshResult {
  success: boolean;
  message: string;
  added: number;
  updated: number;
  total: number;
  summary: {
    total: number;
    installed: number;
    notInstalled: number;
    byCategory: Record<string, number>;
    byMethod: Record<string, number>;
  };
  tools: Array<{
    toolId: string;
    name: string;
    category: string;
    description: string;
    command: string;
    installMethod: string;
    installPath?: string;
    githubUrl?: string;
    isInstalled: boolean;
    version?: string;
  }>;
}

export function useRefreshTools() {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (): Promise<RefreshResult> => {
    try {
      setRefreshing(true);
      setError(null);
      const response = await toolsService.refresh();
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh tools registry");
      throw err;
    } finally {
      setRefreshing(false);
    }
  };

  return {
    refresh,
    refreshing,
    error,
  };
}
