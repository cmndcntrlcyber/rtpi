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

let nucleiExecutor: any;

beforeEach(async () => {
  vi.clearAllMocks();
  // Default: template check passes (exit code 0)
  mockDockerExec.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
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

  const mod = await import('../../../server/services/nuclei-executor');
  nucleiExecutor = mod.nucleiExecutor;
});

describe('NucleiExecutor', () => {
  describe('startScan', () => {
    it('should create a scan record and return scanId', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      const result = await nucleiExecutor.startScan(
        ['https://example.com'],
        { severity: 'critical,high' },
        'op-1',
        'user-1'
      );

      expect(result.scanId).toBe('scan-1');
      expect(mockDbInsert).toHaveBeenCalled();
    });
  });

  describe('command argument construction', () => {
    it('should include -jsonl flag for parseable output', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await nucleiExecutor.startScan(['https://example.com'], {}, 'op-1', 'user-1');
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      expect(args).toContain('-jsonl');
    });

    it('should include -disable-update-check flag', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await nucleiExecutor.startScan(['https://example.com'], {}, 'op-1', 'user-1');
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      expect(args).toContain('-disable-update-check');
    });

    it('should add severity filter when specified', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await nucleiExecutor.startScan(
        ['https://example.com'],
        { severity: 'critical,high' },
        'op-1',
        'user-1'
      );
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      const sevIdx = args.indexOf('-severity');
      expect(sevIdx).toBeGreaterThan(-1);
      expect(args[sevIdx + 1]).toBe('critical,high');
    });

    it('should add tags when specified', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await nucleiExecutor.startScan(
        ['https://example.com'],
        { tags: ['cve', 'xss'] },
        'op-1',
        'user-1'
      );
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      const tagIdx = args.indexOf('-tags');
      expect(tagIdx).toBeGreaterThan(-1);
      expect(args[tagIdx + 1]).toBe('cve,xss');
    });

    it('should add exclude tags when specified', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await nucleiExecutor.startScan(
        ['https://example.com'],
        { excludeTags: ['dos'] },
        'op-1',
        'user-1'
      );
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      const exIdx = args.indexOf('-exclude-tags');
      expect(exIdx).toBeGreaterThan(-1);
      expect(args[exIdx + 1]).toBe('dos');
    });

    it('should add rate limit when specified', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await nucleiExecutor.startScan(
        ['https://example.com'],
        { rateLimit: 100 },
        'op-1',
        'user-1'
      );
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      const rlIdx = args.indexOf('-rate-limit');
      expect(rlIdx).toBeGreaterThan(-1);
      expect(args[rlIdx + 1]).toBe('100');
    });

    it('should include performance tuning flags', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await nucleiExecutor.startScan(['https://example.com'], {}, 'op-1', 'user-1');
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      expect(args).toContain('-c');
      expect(args).toContain('-bulk-size');
      expect(args).toContain('-pc');
    });

    it('should add target with -u flag', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await nucleiExecutor.startScan(['https://example.com'], {}, 'op-1', 'user-1');
      await flushPromises();

      const args = mockDockerExecWithRetry.mock.calls[0][1];
      const uIdx = args.indexOf('-u');
      expect(uIdx).toBeGreaterThan(-1);
      expect(args[uIdx + 1]).toBe('https://example.com');
    });
  });

  describe('output parsing (via startScan integration)', () => {
    it('should handle JSONL vulnerability output', async () => {
      const jsonlOutput = [
        JSON.stringify({
          'template-id': 'cve-2021-44228',
          info: {
            name: 'Log4Shell RCE',
            severity: 'critical',
            classification: { 'cve-id': ['CVE-2021-44228'], 'cvss-score': 10.0 },
          },
          host: 'https://example.com',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'http',
        }),
        JSON.stringify({
          'template-id': 'xss-reflected',
          info: {
            name: 'Reflected XSS',
            severity: 'high',
          },
          host: 'https://example.com/search',
          timestamp: '2024-01-01T00:00:01Z',
          type: 'http',
        }),
      ].join('\n');

      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: jsonlOutput, stderr: '' });

      await nucleiExecutor.startScan(['https://example.com'], {}, 'op-1', 'user-1');

      // Scan created and results stored
      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should handle empty scan results', async () => {
      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      const result = await nucleiExecutor.startScan(['https://example.com'], {}, 'op-1', 'user-1');
      expect(result.scanId).toBe('scan-1');
    });

    it('should handle mixed JSON and progress lines', async () => {
      const mixedOutput = [
        '[INF] Using Nuclei Engine 3.1.0',
        '[INF] Templates loaded: 7500',
        JSON.stringify({
          'template-id': 'tech-detect',
          info: { name: 'Tech Detection', severity: 'info' },
          host: 'https://example.com',
          timestamp: '2024-01-01T00:00:00Z',
          type: 'http',
        }),
        '[INF] Scan completed in 30s',
      ].join('\n');

      mockDockerExecWithRetry.mockResolvedValue({ exitCode: 0, stdout: mixedOutput, stderr: '' });

      const result = await nucleiExecutor.startScan(['https://example.com'], {}, 'op-1', 'user-1');
      expect(result.scanId).toBe('scan-1');
    });
  });
});
