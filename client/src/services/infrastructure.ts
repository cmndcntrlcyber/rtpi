import { api } from "@/lib/api";

export interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports?: string[];
  created: string;
}

export interface Device {
  id: string;
  hostname: string;
  ipAddress: string;
  macAddress?: string;
  osType?: string;
  status: string;
  lastSeen: string;
}

export interface HealthCheck {
  id: string;
  name: string;
  type: string;
  status: string;
  endpoint?: string;
  lastCheck: string;
  message?: string;
}

export const infrastructureService = {
  // Containers
  listContainers: () => api.get<{ containers: Container[] }>("/containers"),
  getContainer: (id: string) => api.get<{ container: Container }>(`/containers/${id}`),
  startContainer: (name: string) => api.post(`/containers/${name}/start`),
  stopContainer: (name: string) => api.post(`/containers/${name}/stop`),
  restartContainer: (name: string) => api.post(`/containers/${name}/restart`),

  // Devices
  listDevices: () => api.get<{ devices: Device[] }>("/devices"),
  getDevice: (id: string) => api.get<{ device: Device }>(`/devices/${id}`),
  createDevice: (data: Partial<Device>) => api.post<{ device: Device }>("/devices", data),
  updateDevice: (id: string, data: Partial<Device>) => api.put<{ device: Device }>(`/devices/${id}`, data),
  deleteDevice: (id: string) => api.delete(`/devices/${id}`),

  // Health Checks
  listHealthChecks: () => api.get<{ healthChecks: HealthCheck[] }>("/health-checks"),
  getHealthCheck: (id: string) => api.get<{ healthCheck: HealthCheck }>(`/health-checks/${id}`),
  runHealthCheck: (id: string) => api.post(`/health-checks/${id}/run`),
};
