import { useState, useEffect } from "react";
import { toolsService, Tool } from "@/services/tools";

export function useTools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTools = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await toolsService.list();
      setTools(response.tools || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tools");
      console.error("Error fetching tools:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

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
      console.error("Error executing tool:", err);
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
      console.error("Error launching tool:", err);
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
      console.error("Error uploading file:", err);
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
      console.error("Error executing tool:", err);
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
      console.error("Error deleting tool:", err);
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
