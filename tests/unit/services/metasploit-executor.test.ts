import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDockerExec = vi.fn();
vi.mock('../../../server/services/docker-executor', () => ({
  dockerExecutor: {
    exec: (...args: any[]) => mockDockerExec(...args),
  },
}));

const mockDbUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
const mockDbUpdateSet = vi.fn().mockReturnValue({ where: mockDbUpdateSetWhere });
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });

const mockDbSelectFromWhereLimit = vi.fn().mockResolvedValue([{
  metadata: {},
}]);
const mockDbSelectFromWhere = vi.fn().mockReturnValue({ limit: mockDbSelectFromWhereLimit });
const mockDbSelectFrom = vi.fn().mockReturnValue({ where: mockDbSelectFromWhere });
const mockDbSelect = vi.fn().mockReturnValue({ from: mockDbSelectFrom });

vi.mock('../../../server/db', () => ({
  db: {
    update: (...args: any[]) => mockDbUpdate(...args),
    select: (...args: any[]) => mockDbSelect(...args),
  },
}));

vi.mock('../../../server/auth/middleware', () => ({
  logToolAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../server/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

vi.mock('../../../server/lib/metrics', () => ({
  toolExecutionDuration: { observe: vi.fn() },
  toolExecutionsTotal: { inc: vi.fn() },
}));

let metasploitExecutor: any;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDbUpdate.mockReturnValue({ set: mockDbUpdateSet });
  mockDbUpdateSet.mockReturnValue({ where: mockDbUpdateSetWhere });
  mockDbSelect.mockReturnValue({ from: mockDbSelectFrom });
  mockDbSelectFrom.mockReturnValue({ where: mockDbSelectFromWhere });
  mockDbSelectFromWhere.mockReturnValue({ limit: mockDbSelectFromWhereLimit });
  mockDbSelectFromWhereLimit.mockResolvedValue([{ metadata: {} }]);

  const mod = await import('../../../server/services/metasploit-executor');
  metasploitExecutor = mod.metasploitExecutor;
});

describe('MetasploitExecutor', () => {
  describe('execute - command construction', () => {
    it('should build correct msfconsole command for auxiliary module', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 0,
        stdout: 'Module output',
        stderr: '',
      });

      await metasploitExecutor.execute('tool-1', {
        type: 'auxiliary',
        path: 'scanner/http/http_version',
        parameters: { THREADS: '10' },
      }, '192.168.1.1');

      expect(mockDockerExec).toHaveBeenCalledWith(
        'rtpi-tools',
        expect.arrayContaining(['msfconsole', '-q', '-x']),
        expect.objectContaining({ timeout: 600000 })
      );

      const cmdArg = mockDockerExec.mock.calls[0][1][3];
      expect(cmdArg).toContain('use auxiliary/scanner/http/http_version');
      expect(cmdArg).toContain('set RHOST 192.168.1.1');
      expect(cmdArg).toContain('set THREADS 10');
      expect(cmdArg).toContain('run');
      expect(cmdArg).toContain('exit');
    });

    it('should use "exploit" action for exploit modules', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 0, stdout: '', stderr: '',
      });

      await metasploitExecutor.execute('tool-2', {
        type: 'exploit',
        path: 'multi/handler',
        parameters: {},
      }, '10.0.0.1');

      const cmdArg = mockDockerExec.mock.calls[0][1][3];
      expect(cmdArg).toContain('exploit');
      expect(cmdArg).not.toContain('; run');
    });

    it('should use "generate" action for payload modules', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 0, stdout: '', stderr: '',
      });

      await metasploitExecutor.execute('tool-3', {
        type: 'payload',
        path: 'windows/meterpreter/reverse_tcp',
        parameters: { LHOST: '10.0.0.2', LPORT: '4444' },
      }, '');

      const cmdArg = mockDockerExec.mock.calls[0][1][3];
      expect(cmdArg).toContain('generate');
      expect(cmdArg).toContain('set LHOST 10.0.0.2');
      expect(cmdArg).toContain('set LPORT 4444');
    });

    it('should strip duplicate type prefix from module path', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 0, stdout: '', stderr: '',
      });

      await metasploitExecutor.execute('tool-4', {
        type: 'auxiliary',
        path: 'auxiliary/scanner/portscan/tcp',
        parameters: {},
      }, '10.0.0.1');

      const cmdArg = mockDockerExec.mock.calls[0][1][3];
      expect(cmdArg).toContain('use auxiliary/scanner/portscan/tcp');
      expect(cmdArg).not.toContain('use auxiliary/auxiliary/');
    });
  });

  describe('execute - result handling', () => {
    it('should return success when exit code is 0', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 0,
        stdout: 'Scan complete',
        stderr: '',
      });

      const result = await metasploitExecutor.execute('tool-5', {
        type: 'auxiliary',
        path: 'scanner/http/http_version',
        parameters: {},
      }, '192.168.1.1');

      expect(result.success).toBe(true);
      expect(result.output).toBe('Scan complete');
      expect(result.exitCode).toBe(0);
    });

    it('should return failure when exit code is non-zero', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'Module failed',
      });

      const result = await metasploitExecutor.execute('tool-6', {
        type: 'auxiliary',
        path: 'scanner/http/http_version',
        parameters: {},
      }, '192.168.1.1');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should include duration in result', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 0, stdout: '', stderr: '',
      });

      const result = await metasploitExecutor.execute('tool-7', {
        type: 'auxiliary',
        path: 'scanner/http/http_version',
        parameters: {},
      }, '192.168.1.1');

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should update tool status to running then available', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 0, stdout: '', stderr: '',
      });

      await metasploitExecutor.execute('tool-8', {
        type: 'auxiliary',
        path: 'scanner/http/http_version',
        parameters: {},
      }, '192.168.1.1');

      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'running' })
      );
    });
  });

  describe('execute - locking', () => {
    it('should prevent concurrent execution on same tool', async () => {
      mockDockerExec.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ exitCode: 0, stdout: '', stderr: '' }), 100))
      );

      const module = { type: 'auxiliary' as const, path: 'scanner/http/http_version', parameters: {} };

      const p1 = metasploitExecutor.execute('tool-lock', module, '10.0.0.1');

      await expect(
        metasploitExecutor.execute('tool-lock', module, '10.0.0.1')
      ).rejects.toThrow('Another execution is already in progress');

      await p1;
    });

    it('should unlock after execution completes', async () => {
      mockDockerExec.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await metasploitExecutor.execute('tool-unlock', {
        type: 'auxiliary', path: 'scanner/http/http_version', parameters: {},
      }, '10.0.0.1');

      expect(metasploitExecutor.isLocked('tool-unlock')).toBe(false);
    });

    it('should unlock after execution fails', async () => {
      mockDockerExec.mockRejectedValue(new Error('Docker error'));

      try {
        await metasploitExecutor.execute('tool-fail', {
          type: 'auxiliary', path: 'scanner/http/http_version', parameters: {},
        }, '10.0.0.1');
      } catch (_) { /* expected */ }

      expect(metasploitExecutor.isLocked('tool-fail')).toBe(false);
    });
  });

  describe('execute - CVE/CVSS/CWE extraction', () => {
    it('should extract CVE IDs from module output', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 0,
        stdout: 'Module: exploit/windows/smb/ms17_010_eternalblue\nReferences: CVE-2017-0143, CVE-2017-0144\nExploit completed.',
        stderr: '',
      });

      const result = await metasploitExecutor.execute('tool-cve', {
        type: 'exploit',
        path: 'windows/smb/ms17_010_eternalblue',
        parameters: {},
      }, '10.0.0.1');

      expect(result.cveIds).toBeDefined();
      expect(result.cveIds).toContain('CVE-2017-0143');
      expect(result.cveIds).toContain('CVE-2017-0144');
    });

    it('should extract CWE IDs from module output', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 0,
        stdout: 'Vulnerability details: CWE-264 Permissions issue\nAlso see CWE-20',
        stderr: '',
      });

      const result = await metasploitExecutor.execute('tool-cwe', {
        type: 'auxiliary',
        path: 'scanner/http/http_version',
        parameters: {},
      }, '10.0.0.1');

      expect(result.cweIds).toBeDefined();
      expect(result.cweIds).toContain('CWE-264');
      expect(result.cweIds).toContain('CWE-20');
    });

    it('should return undefined for cveIds when no CVEs found', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 0,
        stdout: 'Scan complete, no vulnerabilities',
        stderr: '',
      });

      const result = await metasploitExecutor.execute('tool-no-cve', {
        type: 'auxiliary',
        path: 'scanner/portscan/tcp',
        parameters: {},
      }, '10.0.0.1');

      expect(result.cveIds).toBeUndefined();
    });

    it('should deduplicate CVE IDs', async () => {
      mockDockerExec.mockResolvedValue({
        exitCode: 0,
        stdout: 'CVE-2021-34527 found. Also CVE-2021-34527 again.',
        stderr: '',
      });

      const result = await metasploitExecutor.execute('tool-dedup', {
        type: 'exploit',
        path: 'windows/smb/printnightmare',
        parameters: {},
      }, '10.0.0.1');

      expect(result.cveIds).toHaveLength(1);
      expect(result.cveIds).toContain('CVE-2021-34527');
    });
  });
});
