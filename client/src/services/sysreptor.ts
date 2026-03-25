import { api } from "@/lib/api";

export interface SysReptorProject {
  id: string;
  name: string;
  language?: string;
  design?: string;
  tags?: string[];
  created?: string;
  updated?: string;
}

export interface SysReptorDesign {
  id: string;
  name: string;
  language?: string;
}

export interface SysReptorStatus {
  connected: boolean;
  version?: string;
  tokenConfigured: boolean;
  url: string;
}

export interface ExportResult {
  success: boolean;
  project: { id: string; name: string; url: string };
  findingsExported: number;
  message: string;
}

export interface SyncResult {
  success: boolean;
  added: number;
  skipped: number;
  total: number;
  message: string;
}

export const sysReptorService = {
  checkStatus: (options?: { signal?: AbortSignal }) =>
    api.get<SysReptorStatus>("/sysreptor/status", { signal: options?.signal }),

  listProjects: (options?: { signal?: AbortSignal }) =>
    api.get<{ projects: SysReptorProject[] }>("/sysreptor/projects", { signal: options?.signal }),

  listDesigns: (options?: { signal?: AbortSignal }) =>
    api.get<{ designs: SysReptorDesign[] }>("/sysreptor/designs", { signal: options?.signal }),

  exportOperation: (data: {
    operationId: string;
    designId: string;
    name?: string;
    tags?: string[];
  }) =>
    api.post<ExportResult>("/sysreptor/export", {
      ...data,
      includeFindings: true,
    }),

  syncProject: (projectId: string, operationId: string) =>
    api.post<SyncResult>(`/sysreptor/projects/${projectId}/sync`, {
      operationId,
    }),
};
