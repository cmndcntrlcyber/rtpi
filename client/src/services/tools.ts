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
  list: () => api.get<{ tools: Tool[] }>("/tools"),

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

  // Launch tool (for web-based tools)
  launch: (id: string) =>
    api.post<{ message: string; url?: string; tool: Tool }>(`/tools/${id}/launch`, {}),
};
