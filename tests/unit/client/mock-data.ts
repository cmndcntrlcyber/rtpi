export interface MockOperation {
  id: string;
  name: string;
  description?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  createdBy: string;
  type?: string;
  targets?: number;
  findings?: number;
}

export interface MockTarget {
  id: string;
  name: string;
  type: string;
  value: string;
  description?: string;
  priority?: number;
  tags?: string[];
  operationId?: string;
  status?: string;
}

export interface MockVulnerability {
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
}

export interface MockAgent {
  id: string;
  name: string;
  type: string;
  status: string;
  config?: any;
  capabilities?: string[];
  lastActivity?: string;
  tasksCompleted: number;
  tasksFailed: number;
  createdAt: string;
  updatedAt: string;
}

export function createMockOperation(overrides?: Partial<MockOperation>): MockOperation {
  return {
    id: 'op-1',
    name: 'Pentest Alpha',
    status: 'active',
    description: 'Test operation',
    startedAt: '2024-01-15T00:00:00Z',
    createdBy: 'user-1',
    type: 'penetration-test',
    ...overrides,
  };
}

export function createMockTarget(overrides?: Partial<MockTarget>): MockTarget {
  return {
    id: 't-1',
    name: '192.168.1.1',
    type: 'ip',
    value: '192.168.1.1',
    status: 'active',
    ...overrides,
  };
}

export function createMockVulnerability(overrides?: Partial<MockVulnerability>): MockVulnerability {
  return {
    id: 'v-1',
    title: 'SQL Injection',
    severity: 'critical',
    status: 'open',
    discoveredAt: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

export function createMockAgent(overrides?: Partial<MockAgent>): MockAgent {
  return {
    id: 'a-1',
    name: 'Recon Agent',
    type: 'anthropic',
    status: 'running',
    config: {},
    tasksCompleted: 5,
    tasksFailed: 0,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

export const DEFAULT_OPERATIONS = [
  createMockOperation({ id: 'op-1', name: 'Pentest Alpha', status: 'active' }),
  createMockOperation({ id: 'op-2', name: 'Pentest Beta', status: 'completed' }),
  createMockOperation({ id: 'op-3', name: 'Pentest Gamma', status: 'planning' }),
];

export const DEFAULT_TARGETS = [
  createMockTarget({ id: 't-1', name: '192.168.1.1', value: '192.168.1.1' }),
  createMockTarget({ id: 't-2', name: 'example.com', type: 'domain', value: 'example.com' }),
  createMockTarget({ id: 't-3', name: '10.0.0.1', value: '10.0.0.1' }),
];

export const DEFAULT_VULNERABILITIES = [
  createMockVulnerability({ id: 'v-1', title: 'SQL Injection', severity: 'critical' }),
];

export const DEFAULT_AGENTS = [
  createMockAgent({ id: 'a-1', name: 'Recon Agent', status: 'running' }),
  createMockAgent({ id: 'a-2', name: 'Exploit Agent', type: 'openai', status: 'idle', tasksCompleted: 3, tasksFailed: 1 }),
];

export const DEFAULT_SURFACE_DATA = {
  stats: { totalHosts: 0, totalServices: 0, totalVulnerabilities: 0, webVulnerabilities: 0, lastScanTimestamp: null },
  assetBreakdown: { domains: 0, ips: 0, urls: 0, technologies: 0, asns: 0, emails: 0, storageBuckets: 0 },
  severityData: { critical: 0, high: 0, medium: 0, low: 0, informational: 0 },
  statusData: { open: 0, in_progress: 0, fixed: 0, false_positive: 0, accepted_risk: 0 },
};
