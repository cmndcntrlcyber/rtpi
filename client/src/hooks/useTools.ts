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
