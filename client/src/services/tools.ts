import { api } from "@/lib/api";

export interface Tool {
  id: string;
  name: string;
  category: string;
  description?: string;
  status: string;
  command?: string;
  dockerImage?: string;
  endpoint?: string;
  configPath?: string;
  version?: string;
  lastUsed?: string;
  usageCount: number;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export const toolsService = {
  // List all tools
  list: (options?: { signal?: AbortSignal }) =>
    api.get<{ tools: Tool[] }>("/tools", { signal: options?.signal }),

  // Get single tool
  get: (id: string) => api.get<{ tool: Tool }>(`/tools/${id}`),

  // Add tool
  create: (data: Partial<Tool>) =>
    api.post<{ tool: Tool }>("/tools", data),

  // Update tool
  update: (id: string, data: Partial<Tool>) =>
    api.put<{ tool: Tool }>(`/tools/${id}`, data),

  // Upload file for tool (e.g., Burp Suite JAR)
  upload: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/v1/tools/${id}/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Upload failed");
    }

    return response.json();
  },

  // Execute tool
  execute: (id: string, params?: any) =>
    api.post<{ message: string; tool: Tool; executionId: string }>(`/tools/${id}/execute`, params || {}),

  // Execute tool in Docker container
  executeDocker: (id: string, params: { targetId?: string; agentId?: string; params?: any; command?: string[] }) =>
    api.post<{ success: boolean; tool: string; result: any }>(`/tools/${id}/execute-docker`, params),

  // Launch tool (for web-based tools)
  launch: (id: string) =>
    api.post<{ message: string; url?: string; tool: Tool }>(`/tools/${id}/launch`, {}),

  // Delete tool
  delete: (id: string) =>
    api.delete<{ message: string; tool: Tool }>(`/tools/${id}`),

  // Refresh tools registry from Dockerfile.tools and /opt/tools/
  refresh: () =>
    api.post<{
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
    }>("/tools/refresh", {}),
};
