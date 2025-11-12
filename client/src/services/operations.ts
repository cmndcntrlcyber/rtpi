import { api } from "@/lib/api";

export interface Operation {
  id: string;
  name: string;
  description?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  createdBy: string;
}

export const operationsService = {
  // List all operations
  list: () => api.get<{ operations: Operation[] }>("/operations"),

  // Get single operation
  get: (id: string) => api.get<{ operation: Operation }>(`/operations/${id}`),

  // Create operation
  create: (data: Partial<Operation>) =>
    api.post<{ operation: Operation }>("/operations", data),

  // Update operation
  update: (id: string, data: Partial<Operation>) =>
    api.put<{ operation: Operation }>(`/operations/${id}`, data),

  // Delete operation
  delete: (id: string) => api.delete(`/operations/${id}`),

  // Operation statistics
  stats: () => api.get<{ stats: any }>("/operations/stats"),
};
