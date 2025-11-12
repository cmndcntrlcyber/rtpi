import { api } from "@/lib/api";

export interface Report {
  id: string;
  name: string;
  type: string;
  status: string;
  format: string;
  operationId?: string;
  templateId?: string;
  content?: any;
  generatedBy: string;
  filePath?: string;
  fileSize?: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  type: string;
  format: string;
  structure: any;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const reportsService = {
  // List all reports
  list: () => api.get<{ reports: Report[] }>("/reports"),

  // Get single report
  get: (id: string) => api.get<{ report: Report }>(`/reports/${id}`),

  // Create/generate report
  create: (data: Partial<Report>) =>
    api.post<{ report: Report }>("/reports", data),

  // Update report
  update: (id: string, data: Partial<Report>) =>
    api.put<{ report: Report }>(`/reports/${id}`, data),

  // Delete report
  delete: (id: string) => api.delete(`/reports/${id}`),

  // List templates
  listTemplates: () => api.get<{ templates: ReportTemplate[] }>("/reports/templates/list"),

  // Create template
  createTemplate: (data: Partial<ReportTemplate>) =>
    api.post<{ template: ReportTemplate }>("/reports/templates", data),

  // Delete template
  deleteTemplate: (id: string) => api.delete(`/reports/templates/${id}`),
};
