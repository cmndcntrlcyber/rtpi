import { api } from "@/lib/api";

export interface Vulnerability {
  id: string;
  title: string;
  description?: string;
  severity: string;
  cvss?: number;
  cve?: string;
  status: string;
  targetId?: string;
  operationId?: string;
  discoveredAt: string;
  remediatedAt?: string;
}

export const vulnerabilitiesService = {
  // List all vulnerabilities
  list: (options?: { signal?: AbortSignal }) =>
    api.get<{ vulnerabilities: Vulnerability[] }>("/vulnerabilities", { signal: options?.signal }),

  // Get single vulnerability
  get: (id: string) => api.get<{ vulnerability: Vulnerability }>(`/vulnerabilities/${id}`),

  // Create vulnerability
  create: (data: Partial<Vulnerability>) =>
    api.post<{ vulnerability: Vulnerability }>("/vulnerabilities", data),

  // Update vulnerability
  update: (id: string, data: Partial<Vulnerability>) =>
    api.put<{ vulnerability: Vulnerability }>(`/vulnerabilities/${id}`, data),

  // Delete vulnerability
  delete: (id: string) => api.delete(`/vulnerabilities/${id}`),

  // Vulnerability statistics
  stats: () => api.get<{ stats: any }>("/vulnerabilities/stats"),
};
