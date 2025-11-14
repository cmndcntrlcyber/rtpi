import { api } from "@/lib/api";

export interface Target {
  id: string;
  name?: string;
  hostname?: string;
  ipAddress?: string;
  domain?: string;
  port?: number;
  status: string;
  operationId?: string;
  notes?: string;
  lastScanAt?: string;
}

export const targetsService = {
  // List all targets
  list: () => api.get<{ targets: Target[] }>("/targets"),

  // Get single target
  get: (id: string) => api.get<{ target: Target }>(`/targets/${id}`),

  // Create target
  create: (data: Partial<Target>) =>
    api.post<{ target: Target }>("/targets", data),

  // Update target
  update: (id: string, data: Partial<Target>) =>
    api.put<{ target: Target }>(`/targets/${id}`, data),

  // Delete target
  delete: (id: string) => api.delete(`/targets/${id}`),

  // Scan target
  scan: (id: string) => api.post(`/targets/${id}/scan`),
};
