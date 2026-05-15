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

export type SysReptorHealthReason =
  | "not_configured"
  | "profile_not_enabled"
  | "service_unreachable"
  | "timeout"
  | "auth_error"
  | "service_error";

export interface SysReptorHealth {
  up: boolean;
  profileEnabled: boolean | undefined;
  url: string;
  tokenConfigured: boolean;
  version?: string;
  reason?: SysReptorHealthReason;
  error?: string;
  suggestion?: string;
}

/** Legacy status shape; kept for the existing /status consumers. */
export interface SysReptorStatus {
  connected: boolean;
  version?: string;
  tokenConfigured: boolean;
  url: string;
  profileEnabled?: boolean;
  reason?: SysReptorHealthReason;
  error?: string;
  suggestion?: string;
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

  checkHealth: (options?: { signal?: AbortSignal }) =>
    api.get<SysReptorHealth>("/sysreptor/health", { signal: options?.signal }),

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

  autoConnect: () =>
    api.post<AutoConnectResult>(`/sysreptor/auto-connect`, {}),
};

export interface AutoConnectResult {
  ok: boolean;
  message: string;
  action?: "minted" | "already_configured" | "skipped";
  reason?:
    | "container_not_running"
    | "no_superuser"
    | "exec_failed"
    | "token_parse_failed"
    | "persist_failed";
  persistedToEnv?: boolean;
}
