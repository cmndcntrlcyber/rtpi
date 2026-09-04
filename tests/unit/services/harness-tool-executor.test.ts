import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted above imports
// ---------------------------------------------------------------------------

const mockSubmitTask = vi.fn();

vi.mock('../../../server/services/ferry-client', () => ({
  ferryClient: {
    submitTask: (...args: any[]) => mockSubmitTask(...args),
  },
  FerryClientError: class FerryClientError extends Error {
    constructor(
      message: string,
      public readonly httpStatus: number,
      public readonly grpcCode?: number,
    ) {
      super(message);
      this.name = 'FerryClientError';
    }
  },
}));

vi.mock('../../../server/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

import {
  TOOL_SKILL_MAP,
  resolveSkillName,
  hasSkillMapping,
  needsApproval,
  executeViaHarness,
} from '../../../server/services/harness-tool-executor';
import { FerryClientError } from '../../../server/services/ferry-client';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('harness-tool-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // TOOL_SKILL_MAP
  // -------------------------------------------------------------------------
  describe('TOOL_SKILL_MAP', () => {
    it('is a non-empty record of skill mappings', () => {
      expect(Object.keys(TOOL_SKILL_MAP).length).toBeGreaterThan(0);
    });

    it('each entry has skillPath and requiresApproval', () => {
      for (const [key, mapping] of Object.entries(TOOL_SKILL_MAP)) {
        expect(mapping).toHaveProperty('skillPath');
        expect(mapping).toHaveProperty('requiresApproval');
        expect(typeof mapping.skillPath).toBe('string');
        expect(typeof mapping.requiresApproval).toBe('boolean');
      }
    });
  });

  // -------------------------------------------------------------------------
  // resolveSkillName
  // -------------------------------------------------------------------------
  describe('resolveSkillName', () => {
    it('resolves "nmap" to offense/recon/nmap-scan', () => {
      expect(resolveSkillName('nmap')).toBe('offense/recon/nmap-scan');
    });

    it('resolves case-insensitively ("NMAP" -> offense/recon/nmap-scan)', () => {
      expect(resolveSkillName('NMAP')).toBe('offense/recon/nmap-scan');
    });

    it('resolves "nuclei" to offense/web/nuclei-scan', () => {
      expect(resolveSkillName('nuclei')).toBe('offense/web/nuclei-scan');
    });

    it('resolves "sqlmap" to offense/web/sqlmap-inject', () => {
      expect(resolveSkillName('sqlmap')).toBe('offense/web/sqlmap-inject');
    });

    it('returns null for an unknown tool', () => {
      expect(resolveSkillName('totally-unknown')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(resolveSkillName('')).toBeNull();
    });

    it('handles tool names with special characters (normalized away)', () => {
      // "n-m-a-p" normalizes to "nmap" after stripping non-alphanum
      expect(resolveSkillName('n-m-a-p')).toBe('offense/recon/nmap-scan');
    });
  });

  // -------------------------------------------------------------------------
  // hasSkillMapping
  // -------------------------------------------------------------------------
  describe('hasSkillMapping', () => {
    it('returns true for a mapped tool', () => {
      expect(hasSkillMapping('nuclei')).toBe(true);
    });

    it('returns true for a case-variant of a mapped tool', () => {
      expect(hasSkillMapping('Nuclei')).toBe(true);
    });

    it('returns false for an unknown tool', () => {
      expect(hasSkillMapping('unknown')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // needsApproval
  // -------------------------------------------------------------------------
  describe('needsApproval', () => {
    it('returns true for exploitation tools (sqlmap)', () => {
      expect(needsApproval('sqlmap')).toBe(true);
    });

    it('returns true for hydra (password brute-force)', () => {
      expect(needsApproval('hydra')).toBe(true);
    });

    it('returns true for metasploit', () => {
      expect(needsApproval('metasploit')).toBe(true);
    });

    it('returns true for impacket', () => {
      expect(needsApproval('impacket')).toBe(true);
    });

    it('returns false for recon tools (nmap)', () => {
      expect(needsApproval('nmap')).toBe(false);
    });

    it('returns false for enumeration tools (gobuster)', () => {
      expect(needsApproval('gobuster')).toBe(false);
    });

    it('returns false for an unknown tool', () => {
      expect(needsApproval('unknown-tool')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // executeViaHarness
  // -------------------------------------------------------------------------
  describe('executeViaHarness', () => {
    it('calls ferryClient.submitTask with resolved skill path and returns result', async () => {
      const taskResult = {
        task_id: 'ferry-abc-123',
        output: 'PORT  STATE SERVICE\n22/tcp open  ssh',
        is_error: false,
        execution_duration_ms: 3200,
        bytes_sent: 512,
        bytes_recv: 1024,
        commands_run: 1,
      };
      mockSubmitTask.mockResolvedValue(taskResult);

      const result = await executeViaHarness(
        'nmap',
        { target: '10.0.0.1' },
        'session-1',
        'agent-1',
      );

      expect(mockSubmitTask).toHaveBeenCalledOnce();
      const call = mockSubmitTask.mock.calls[0][0];
      expect(call.tool_name).toBe('offense/recon/nmap-scan');
      expect(call.json_arguments).toBe(JSON.stringify({ target: '10.0.0.1' }));
      expect(call.session_id).toBe('session-1');
      expect(call.target_agent_id).toBe('agent-1');
      expect(call.task_id).toMatch(/^ferry-/);

      expect(result.success).toBe(true);
      expect(result.output).toContain('22/tcp open');
      expect(result.executionTimeMs).toBe(3200);
      expect(result.skillName).toBe('offense/recon/nmap-scan');
      expect(result.taskId).toBe('ferry-abc-123');
    });

    it('returns success=false when ferry result has is_error=true', async () => {
      mockSubmitTask.mockResolvedValue({
        task_id: 'ferry-err-1',
        output: 'command failed',
        is_error: true,
        execution_duration_ms: 100,
        bytes_sent: 0,
        bytes_recv: 0,
        commands_run: 0,
      });

      const result = await executeViaHarness('nmap', {});

      expect(result.success).toBe(false);
      expect(result.output).toBe('command failed');
    });

    it('throws Error for an unmapped tool name', async () => {
      await expect(
        executeViaHarness('unknown-tool', {}),
      ).rejects.toThrow('No harness skill mapping for tool: unknown-tool');
    });

    it('catches FerryClientError and returns a failure result instead of throwing', async () => {
      mockSubmitTask.mockRejectedValue(
        new FerryClientError('gateway down', 503),
      );

      const result = await executeViaHarness('nmap', { target: '10.0.0.1' });

      expect(result.success).toBe(false);
      expect(result.output).toContain('Ferry error');
      expect(result.output).toContain('gateway down');
      expect(result.executionTimeMs).toBe(0);
      expect(result.skillName).toBe('offense/recon/nmap-scan');
    });

    it('re-throws non-FerryClientError exceptions', async () => {
      mockSubmitTask.mockRejectedValue(new TypeError('unexpected'));

      await expect(
        executeViaHarness('nmap', {}),
      ).rejects.toThrow(TypeError);
    });

    it('passes optional sessionId and targetAgentId through to submitTask', async () => {
      mockSubmitTask.mockResolvedValue({
        task_id: 'ferry-x',
        output: '',
        is_error: false,
        execution_duration_ms: 0,
        bytes_sent: 0,
        bytes_recv: 0,
        commands_run: 0,
      });

      await executeViaHarness('nuclei', { url: 'http://target' }, 'sess-99', 'agent-77');

      const call = mockSubmitTask.mock.calls[0][0];
      expect(call.session_id).toBe('sess-99');
      expect(call.target_agent_id).toBe('agent-77');
    });

    it('omits sessionId and targetAgentId when not provided', async () => {
      mockSubmitTask.mockResolvedValue({
        task_id: 'ferry-y',
        output: '',
        is_error: false,
        execution_duration_ms: 0,
        bytes_sent: 0,
        bytes_recv: 0,
        commands_run: 0,
      });

      await executeViaHarness('gobuster', { wordlist: '/usr/share/wordlists/common.txt' });

      const call = mockSubmitTask.mock.calls[0][0];
      expect(call.session_id).toBeUndefined();
      expect(call.target_agent_id).toBeUndefined();
    });
  });
});
