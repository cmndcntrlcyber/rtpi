import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = '/api/v1';

// ============================================================================
// Types
// ============================================================================

export interface KasmWorkspace {
  id: string;
  userId: string;
  operationId?: string;
  workspaceType: 'vscode' | 'burp' | 'kali' | 'firefox' | 'empire';
  workspaceName?: string;
  kasmSessionId: string;
  kasmContainerId?: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  accessUrl?: string;
  internalIp?: string;
  cpuLimit: string;
  memoryLimit: string;
  createdAt: string;
  startedAt?: string;
  lastAccessed?: string;
  expiresAt: string;
  terminatedAt?: string;
  metadata: Record<string, any>;
  errorMessage?: string;
}

export interface WorkspaceProvisionRequest {
  workspaceType: 'vscode' | 'burp' | 'kali' | 'firefox' | 'empire';
  workspaceName?: string;
  operationId?: string;
  cpuLimit?: string;
  memoryLimit?: string;
  expiryHours?: number;
}

export interface ResourceUsage {
  workspaceCount: number;
  workspaceLimit: number;
  totalCpuUsage: number;
  totalMemoryUsage: number;
  cpuLimit: number;
  memoryLimit: number;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get all workspaces for current user
 */
export function useKasmWorkspaces() {
  return useQuery({
    queryKey: ['kasm-workspaces'],
    queryFn: async () => {
      const { data } = await axios.get<KasmWorkspace[]>(`${API_URL}/kasm-workspaces`);
      return data;
    },
    refetchInterval: 5000, // Poll every 5 seconds for status updates
  });
}

/**
 * Get specific workspace
 */
export function useKasmWorkspace(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['kasm-workspace', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data } = await axios.get<KasmWorkspace>(`${API_URL}/kasm-workspaces/${workspaceId}`);
      return data;
    },
    enabled: !!workspaceId,
    refetchInterval: 5000,
  });
}

/**
 * Get resource usage
 */
export function useResourceUsage() {
  return useQuery({
    queryKey: ['kasm-resources'],
    queryFn: async () => {
      const { data } = await axios.get<ResourceUsage>(`${API_URL}/kasm-workspaces/resources/usage`);
      return data;
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

/**
 * Get expiring workspaces
 */
export function useExpiringWorkspaces() {
  return useQuery({
    queryKey: ['kasm-expiring'],
    queryFn: async () => {
      const { data } = await axios.get<KasmWorkspace[]>(`${API_URL}/kasm-workspaces/expiring`);
      return data;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

/**
 * Provision new workspace
 */
export function useProvisionWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: WorkspaceProvisionRequest) => {
      const { data } = await axios.post(`${API_URL}/kasm-workspaces`, request);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kasm-workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['kasm-resources'] });
    },
  });
}

/**
 * Terminate workspace
 */
export function useTerminateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workspaceId: string) => {
      await axios.delete(`${API_URL}/kasm-workspaces/${workspaceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kasm-workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['kasm-resources'] });
    },
  });
}

/**
 * Extend workspace expiry
 */
export function useExtendWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, hours }: { workspaceId: string; hours: number }) => {
      const { data } = await axios.post(`${API_URL}/kasm-workspaces/${workspaceId}/extend`, {
        additionalHours: hours,
      });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kasm-workspace', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['kasm-workspaces'] });
    },
  });
}

/**
 * Create workspace session
 */
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, metadata }: { workspaceId: string; metadata?: Record<string, any> }) => {
      const { data } = await axios.post(`${API_URL}/kasm-workspaces/${workspaceId}/sessions`, { metadata });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kasm-workspace', variables.workspaceId] });
    },
  });
}

/**
 * Send session heartbeat
 */
export function useSendHeartbeat() {
  return useMutation({
    mutationFn: async (sessionToken: string) => {
      await axios.post(`${API_URL}/kasm-workspaces/sessions/${sessionToken}/heartbeat`);
    },
  });
}

/**
 * Terminate session
 */
export function useTerminateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionToken: string) => {
      await axios.delete(`${API_URL}/kasm-workspaces/sessions/${sessionToken}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kasm-workspaces'] });
    },
  });
}

/**
 * Share workspace
 */
export function useShareWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, targetUserId }: { workspaceId: string; targetUserId: string }) => {
      const { data } = await axios.post(`${API_URL}/kasm-workspaces/${workspaceId}/share`, { targetUserId });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kasm-workspace', variables.workspaceId] });
    },
  });
}

/**
 * Revoke workspace sharing
 */
export function useRevokeSharing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, targetUserId }: { workspaceId: string; targetUserId: string }) => {
      await axios.delete(`${API_URL}/kasm-workspaces/${workspaceId}/share/${targetUserId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kasm-workspace', variables.workspaceId] });
    },
  });
}
