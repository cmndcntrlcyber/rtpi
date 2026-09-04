import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDockerExec = vi.fn();
const mockDockerExecWithRetry = vi.fn();
vi.mock('../../../server/services/docker-executor', () => ({
  dockerExecutor: {
    exec: (...args: any[]) => mockDockerExec(...args),
    execWithRetry: (...args: any[]) => mockDockerExecWithRetry(...args),
  },
  keepDatabaseAlive: vi.fn().mockResolvedValue(vi.fn()),
}));

const mockDbInsertReturning = vi.fn().mockResolvedValue([{ id: 'scan-1' }]);
const mockDbInsertOnConflict = vi.fn().mockReturnValue({ returning: mockDbInsertReturning });
const mockDbInsertValues = vi.fn().mockReturnValue({
  returning: mockDbInsertReturning,
  onConflictDoUpdate: mockDbInsertOnConflict,
  onConflictDoNothing: vi.fn().mockReturnValue({ returning: mockDbInsertReturning }),
});
const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });

const mockDbUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
const mockDbUpdateSet = vi.fn().mockReturnValue({ where: mockDbUpdateSetWhere });
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });

const mockDbSelectFromWhere = vi.fn().mockResolvedValue([]);
const mockDbSelectFrom = vi.fn().mockReturnValue({ where: mockDbSelectFromWhere });
const mockDbSelect = vi.fn().mockReturnValue({ from: mockDbSelectFrom });

vi.mock('../../../server/db', () => ({
  db: {
    insert: (...args: any[]) => mockDbInsert(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    select: (...args: any[]) => mockDbSelect(...args),
  },
}));

vi.mock('../../../server/services/target-resolver', () => ({
  resolveTargetId: vi.fn().mockResolvedValue('target-1'),
}));

vi.mock('../../../server/services/workflow-event-handlers', () => ({
  workflowEventHandlers: {
    handleScanCompleted: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn(),
  },
}));

vi.mock('../../../server/auth/middleware', () => ({
  logToolAudit: vi.fn(),
}));

vi.mock('../../../server/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

vi.mock('../../../server/lib/metrics', () => ({
  scanDuration: { observe: vi.fn() },
  toolExecutionsTotal: { inc: vi.fn() },
}));

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 50));

let bbotExecutor: any;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDbInsert.mockReturnValue({ values: mockDbInsertValues });
  mockDbInsertValues.mockReturnValue({
    returning: mockDbInsertReturning,
    onConflictDoUpdate: mockDbInsertOnConflict,
    onConflictDoNothing: vi.fn().mockReturnValue({ returning: mockDbInsertReturning }),
  });
  mockDbInsertReturning.mockResolvedValue([{ id: 'scan-1', startedAt: new Date() }]);
  mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
  mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateSetWhere });
  mockDbSelect.mockReturnValue({ from: mockDbSelectFrom });
  mockDbSelectFrom.mockReturnValue({ where: mockDbSelectFromWhere });

  const mod = await import('../../../server/services/bbot-executor');
  bbotExecutor = new mod.BBOTExecutor();
});

describe('BBOTExecutor', () => {
  describe('startScan', () => {
    it('should create a scan record and return scanId', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      const result = await bbotExecutor.startScan(
        ['example.com'],
        { preset: 'subdomain-enum' },
        'op-1',
        'user-1'
      );

      expect(result.scanId).toBe('scan-1');
      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should pass targets to docker exec', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await bbotExecutor.startScan(['example.com', 'test.com'], {}, 'op-1', 'user-1');
      await flushPromises();

      const execCall = mockDockerExecWithRetry.mock.calls[0];
      const args = execCall[1];
      expect(args).toContain('-t');

      const argsStr = args.join(' ');
      expect(argsStr).toContain('example.com');
      expect(argsStr).toContain('test.com');
    });
  });

  describe('output parsing (via startScan integration)', () => {
    it('should handle NDJSON output with mixed event types', async () => {
      const ndjsonOutput = [
        JSON.stringify({ type: 'DNS_NAME', data: 'sub.example.com', timestamp: '2024-01-01T00:00:00Z' }),
        JSON.stringify({ type: 'IP_ADDRESS', data: '10.0.0.1', timestamp: '2024-01-01T00:00:01Z' }),
        JSON.stringify({ type: 'OPEN_TCP_PORT', data: '10.0.0.1:80', timestamp: '2024-01-01T00:00:02Z' }),
        JSON.stringify({ type: 'URL', data: 'https://sub.example.com/', timestamp: '2024-01-01T00:00:03Z' }),
        JSON.stringify({ type: 'TECHNOLOGY', data: 'nginx', timestamp: '2024-01-01T00:00:04Z' }),
        JSON.stringify({ type: 'EMAIL_ADDRESS', data: 'admin@example.com', timestamp: '2024-01-01T00:00:05Z' }),
      ].join('\n');

      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: ndjsonOutput, stderr: '' });

      await bbotExecutor.startScan(['example.com'], {}, 'op-1', 'user-1');

      // Scan should have been created
      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should handle empty output gracefully', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      const result = await bbotExecutor.startScan(['example.com'], {}, 'op-1', 'user-1');
      expect(result.scanId).toBe('scan-1');
    });

    it('should handle non-JSON lines in output', async () => {
      const mixedOutput = [
        '[INFO] Starting scan...',
        JSON.stringify({ type: 'DNS_NAME', data: 'example.com', timestamp: '2024-01-01T00:00:00Z' }),
        '[INFO] Scan complete.',
      ].join('\n');

      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: mixedOutput, stderr: '' });

      const result = await bbotExecutor.startScan(['example.com'], {}, 'op-1', 'user-1');
      expect(result.scanId).toBe('scan-1');
    });
  });

  describe('command argument construction', () => {
    it('should include -y flag for auto-confirm', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await bbotExecutor.startScan(['example.com'], {}, 'op-1', 'user-1');
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      expect(args).toContain('-y');
    });

    it('should include --json flag for parseable output', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await bbotExecutor.startScan(['example.com'], {}, 'op-1', 'user-1');
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      expect(args).toContain('--json');
    });

    it('should include preset when specified', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await bbotExecutor.startScan(['example.com'], { preset: 'subdomain-enum' }, 'op-1', 'user-1');
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      const pIdx = args.indexOf('-p');
      expect(pIdx).toBeGreaterThan(-1);
      expect(args[pIdx + 1]).toBe('subdomain-enum');
    });

    it('should include modules when specified', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await bbotExecutor.startScan(['example.com'], { modules: ['httpx', 'nmap'] }, 'op-1', 'user-1');
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      const mIdx = args.indexOf('-m');
      expect(mIdx).toBeGreaterThan(-1);
      expect(args[mIdx + 1]).toBe('httpx,nmap');
    });

    it('should include --no-deps by default', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await bbotExecutor.startScan(['example.com'], {}, 'op-1', 'user-1');
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      expect(args).toContain('--no-deps');
    });

    it('should normalize additional args with -- prefix', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await bbotExecutor.startScan(['example.com'], { args: ['allow-deadly'] }, 'op-1', 'user-1');
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      expect(args).toContain('--allow-deadly');
    });
  });
});
