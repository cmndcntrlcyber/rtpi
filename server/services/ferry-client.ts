/**
 * Ferry Client — v3.10 WS2
 *
 * Typed HTTP client for the rust-nexus REST ferry gateway.
 * Replaces langgraph-client.ts for tool execution routing.
 * Calls the axum gateway on port 9100 (co-hosted with /metrics).
 */

import { createLogger } from '../lib/logger';
const log = createLogger('ferry-client');

const FERRY_URL = process.env.NEXUS_FERRY_URL || 'http://127.0.0.1:9100';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FerryTaskRequest {
  task_id: string;
  tool_name: string;
  json_arguments: string;
  session_id?: string;
  target_agent_id?: string;
}

export interface FerryTaskResult {
  task_id: string;
  output: string;
  is_error: boolean;
  execution_duration_ms: number;
  bytes_sent: number;
  bytes_recv: number;
  commands_run: number;
}

export interface FerryAgent {
  peer_id: string;
  os: string;
  version: string;
  tag: string;
  last_seen_unix: number;
}

export interface FerryAgentsResponse {
  agents: FerryAgent[];
}

export interface FerryAnomalyResponse {
  barometer: number;
  agent_attributions: Record<string, number>;
  throttling_active: boolean;
}

export interface FerryHealthResponse {
  status: string;
  server_name: string;
  version: string;
  agents_connected: number;
}

export interface FerryRateResponse {
  agent_id: string;
  multiplier: number;
}

export interface FerryError {
  error: string;
  code: number;
}

// ---------------------------------------------------------------------------
// HTTP transport
// ---------------------------------------------------------------------------

async function ferryFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${FERRY_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      let parsed: FerryError | undefined;
      try { parsed = JSON.parse(body); } catch { /* not JSON */ }
      const msg = parsed?.error || body || `HTTP ${res.status}`;
      throw new FerryClientError(msg, res.status, parsed?.code);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof FerryClientError) throw err;
    throw new FerryClientError(
      `Ferry gateway unreachable at ${FERRY_URL}: ${(err as Error).message}`,
      0,
    );
  }
}

export class FerryClientError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly grpcCode?: number,
  ) {
    super(message);
    this.name = 'FerryClientError';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function submitTask(req: FerryTaskRequest): Promise<FerryTaskResult> {
  log.info(`[ferry] submitTask tool=${req.tool_name} task=${req.task_id}`);
  return ferryFetch<FerryTaskResult>('/ferry/task', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function listAgents(): Promise<FerryAgentsResponse> {
  return ferryFetch<FerryAgentsResponse>('/ferry/agents');
}

export async function queryAnomaly(): Promise<FerryAnomalyResponse> {
  return ferryFetch<FerryAnomalyResponse>('/ferry/anomaly');
}

export async function checkHealth(): Promise<FerryHealthResponse> {
  return ferryFetch<FerryHealthResponse>('/ferry/health');
}

export async function submitTelemetry(snapshot: {
  window_start: number;
  window_end: number;
  node_features?: Record<string, { peer_id: string; message_count: number }>;
}): Promise<void> {
  await ferryFetch<void>('/ferry/telemetry', {
    method: 'POST',
    body: JSON.stringify(snapshot),
  });
}

export async function adjustRate(agentId: string): Promise<FerryRateResponse> {
  return ferryFetch<FerryRateResponse>('/ferry/rate-adjust', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId }),
  });
}

export function isAvailable(): boolean {
  return !!FERRY_URL;
}

export const ferryClient = {
  submitTask,
  listAgents,
  queryAnomaly,
  checkHealth,
  submitTelemetry,
  adjustRate,
  isAvailable,
};
