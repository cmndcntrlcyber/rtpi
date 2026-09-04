import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../server/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

// The module reads process.env.NEXUS_FERRY_URL at load time (line 12).
// We accept the default http://127.0.0.1:9100 and verify calls against it.
const EXPECTED_BASE = 'http://127.0.0.1:9100';

import {
  submitTask,
  listAgents,
  queryAnomaly,
  checkHealth,
  submitTelemetry,
  adjustRate,
  isAvailable,
  FerryClientError,
  type FerryTaskRequest,
} from '../../../server/services/ferry-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function mockFetchError(status: number, body?: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve(body ?? ''),
  });
}

function mockFetchErrorJson(status: number, errorBody: { error: string; code: number }) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(JSON.stringify(errorBody)),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ferry-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // -------------------------------------------------------------------------
  // submitTask
  // -------------------------------------------------------------------------
  describe('submitTask', () => {
    it('sends POST to /ferry/task with correct body and returns parsed result', async () => {
      const taskResult = {
        task_id: 'task-123',
        output: 'scan complete',
        is_error: false,
        execution_duration_ms: 450,
        bytes_sent: 1024,
        bytes_recv: 2048,
        commands_run: 3,
      };
      globalThis.fetch = mockFetchOk(taskResult);

      const req: FerryTaskRequest = {
        task_id: 'task-123',
        tool_name: 'nmap',
        json_arguments: '{"target":"10.0.0.1"}',
        session_id: 'sess-1',
      };

      const result = await submitTask(req);

      expect(globalThis.fetch).toHaveBeenCalledOnce();
      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${EXPECTED_BASE}/ferry/task`);
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(req);
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(result).toEqual(taskResult);
    });
  });

  // -------------------------------------------------------------------------
  // listAgents
  // -------------------------------------------------------------------------
  describe('listAgents', () => {
    it('sends GET to /ferry/agents and returns parsed response', async () => {
      const agentsResponse = {
        agents: [
          { peer_id: 'p1', os: 'linux', version: '1.0', tag: 'recon', last_seen_unix: 1000 },
        ],
      };
      globalThis.fetch = mockFetchOk(agentsResponse);

      const result = await listAgents();

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${EXPECTED_BASE}/ferry/agents`);
      expect(options.method).toBeUndefined(); // GET by default
      expect(result).toEqual(agentsResponse);
    });
  });

  // -------------------------------------------------------------------------
  // queryAnomaly
  // -------------------------------------------------------------------------
  describe('queryAnomaly', () => {
    it('sends GET to /ferry/anomaly', async () => {
      const anomalyResponse = {
        barometer: 0.75,
        agent_attributions: { 'agent-1': 0.5 },
        throttling_active: false,
      };
      globalThis.fetch = mockFetchOk(anomalyResponse);

      const result = await queryAnomaly();

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${EXPECTED_BASE}/ferry/anomaly`);
      expect(result).toEqual(anomalyResponse);
    });
  });

  // -------------------------------------------------------------------------
  // checkHealth
  // -------------------------------------------------------------------------
  describe('checkHealth', () => {
    it('sends GET to /ferry/health and returns health info', async () => {
      const healthResponse = {
        status: 'ok',
        server_name: 'nexus-gw',
        version: '3.10.0',
        agents_connected: 5,
      };
      globalThis.fetch = mockFetchOk(healthResponse);

      const result = await checkHealth();

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${EXPECTED_BASE}/ferry/health`);
      expect(result).toEqual(healthResponse);
    });
  });

  // -------------------------------------------------------------------------
  // submitTelemetry
  // -------------------------------------------------------------------------
  describe('submitTelemetry', () => {
    it('sends POST to /ferry/telemetry with snapshot body', async () => {
      globalThis.fetch = mockFetchOk(undefined);

      const snapshot = {
        window_start: 1000,
        window_end: 2000,
        node_features: { 'n1': { peer_id: 'p1', message_count: 10 } },
      };

      await submitTelemetry(snapshot);

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${EXPECTED_BASE}/ferry/telemetry`);
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(snapshot);
    });
  });

  // -------------------------------------------------------------------------
  // adjustRate
  // -------------------------------------------------------------------------
  describe('adjustRate', () => {
    it('sends POST to /ferry/rate-adjust with agent_id', async () => {
      const rateResponse = { agent_id: 'agent-42', multiplier: 1.5 };
      globalThis.fetch = mockFetchOk(rateResponse);

      const result = await adjustRate('agent-42');

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${EXPECTED_BASE}/ferry/rate-adjust`);
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ agent_id: 'agent-42' });
      expect(result).toEqual(rateResponse);
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable
  // -------------------------------------------------------------------------
  describe('isAvailable', () => {
    it('returns true when FERRY_URL is set (default fallback is truthy)', () => {
      // The module defaults to 'http://127.0.0.1:9100' which is truthy
      expect(isAvailable()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('throws FerryClientError with httpStatus on HTTP error (plain text body)', async () => {
      globalThis.fetch = mockFetchError(500, 'Internal Server Error');

      await expect(submitTask({
        task_id: 't1',
        tool_name: 'nmap',
        json_arguments: '{}',
      })).rejects.toThrow(FerryClientError);

      try {
        await submitTask({ task_id: 't1', tool_name: 'nmap', json_arguments: '{}' });
      } catch (err) {
        expect(err).toBeInstanceOf(FerryClientError);
        expect((err as FerryClientError).httpStatus).toBe(500);
        expect((err as FerryClientError).message).toBe('Internal Server Error');
      }
    });

    it('throws FerryClientError with parsed error message from JSON body', async () => {
      globalThis.fetch = mockFetchErrorJson(422, { error: 'Invalid task_id', code: 3 });

      try {
        await listAgents();
      } catch (err) {
        expect(err).toBeInstanceOf(FerryClientError);
        expect((err as FerryClientError).httpStatus).toBe(422);
        expect((err as FerryClientError).message).toBe('Invalid task_id');
        expect((err as FerryClientError).grpcCode).toBe(3);
      }
    });

    it('throws FerryClientError with httpStatus=0 on network failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      try {
        await checkHealth();
      } catch (err) {
        expect(err).toBeInstanceOf(FerryClientError);
        expect((err as FerryClientError).httpStatus).toBe(0);
        expect((err as FerryClientError).message).toContain('Ferry gateway unreachable');
        expect((err as FerryClientError).message).toContain('ECONNREFUSED');
      }
    });

    it('FerryClientError has correct name property', () => {
      const err = new FerryClientError('test', 404, 5);
      expect(err.name).toBe('FerryClientError');
      expect(err.httpStatus).toBe(404);
      expect(err.grpcCode).toBe(5);
      expect(err).toBeInstanceOf(Error);
    });
  });
});
