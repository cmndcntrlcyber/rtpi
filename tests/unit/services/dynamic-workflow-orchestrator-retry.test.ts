import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReturning = vi.fn();
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockWhere = vi.fn();

vi.mock('../../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: mockValues }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock('@shared/schema', () => ({
  agents: { id: 'id', name: 'name', type: 'type', config: 'config' },
  workflowTasks: { id: 'id', workflowId: 'workflowId', status: 'status', taskName: 'taskName' },
  workflowLogs: { id: 'id', workflowId: 'workflowId' },
  workflowInstances: { id: 'id', status: 'status', context: 'context', templateId: 'templateId' },
  workflowTemplates: { id: 'id', configuration: 'configuration' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: any[]) => ({ type: 'and', args })),
  inArray: vi.fn((a, b) => ({ type: 'inArray', a, b })),
}));

vi.mock('../../../server/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  }),
}));

describe('DynamicWorkflowOrchestrator — retry loop', () => {
  let DynamicWorkflowOrchestrator: any;
  let calculateBackoffDelay: any;
  let orchestrator: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    delete process.env.WORKFLOW_RETRY_BASE_DELAY_MS;

    const mod = await import('../../../server/services/dynamic-workflow-orchestrator');
    DynamicWorkflowOrchestrator = mod.DynamicWorkflowOrchestrator;
    calculateBackoffDelay = mod.calculateBackoffDelay;
    orchestrator = new DynamicWorkflowOrchestrator();

    // Stub sleep to avoid real delays
    orchestrator.sleep = vi.fn().mockResolvedValue(undefined);
  });

  describe('calculateBackoffDelay integration with retry loop', () => {
    it('uses baseDelay * multiplier^(attempt-1) formula', () => {
      expect(calculateBackoffDelay(1, 1000, 2)).toBe(1000);
      expect(calculateBackoffDelay(2, 1000, 2)).toBe(2000);
      expect(calculateBackoffDelay(3, 1000, 2)).toBe(4000);
    });

    it('caps at maxDelayMs', () => {
      expect(calculateBackoffDelay(10, 1000, 2, 5000)).toBe(5000);
    });
  });

  describe('executeAgentTask retry behavior', () => {
    const workflowId = 'wf-test-1';
    const baseAgent = {
      agentId: 'agent-1',
      capability: 'recon',
      phase: 0,
      dependencies: [],
      status: 'pending' as const,
    };
    const retryConfig = { maxRetries: 2, backoffMultiplier: 2 };
    const context = { target: '10.0.0.1' };

    function setupDbAgent(agent: any) {
      mockWhere.mockResolvedValue([agent]);
      mockReturning.mockResolvedValue([{ id: 'task-1' }]);
    }

    function getExecuteAgentTask(orch: any) {
      return orch.executeAgentTask.bind(orch);
    }

    it('succeeds on first attempt without retrying', async () => {
      setupDbAgent({
        id: 'agent-1',
        name: 'recon-agent',
        type: 'custom',
        config: { handlerPath: './mock-handler' },
      });

      orchestrator.executeCustomAgent = vi.fn().mockResolvedValue({ found: true });

      await getExecuteAgentTask(orchestrator)(workflowId, baseAgent, context, retryConfig);

      expect(orchestrator.sleep).not.toHaveBeenCalled();
      expect(orchestrator.executeCustomAgent).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds on second attempt', async () => {
      setupDbAgent({
        id: 'agent-1',
        name: 'recon-agent',
        type: 'custom',
        config: { handlerPath: './mock-handler' },
      });

      orchestrator.executeCustomAgent = vi.fn()
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({ found: true });

      await getExecuteAgentTask(orchestrator)(workflowId, baseAgent, context, retryConfig);

      expect(orchestrator.executeCustomAgent).toHaveBeenCalledTimes(2);
      expect(orchestrator.sleep).toHaveBeenCalledTimes(1);
      // attempt=1 backoff: 1000 * 2^(1-1) = 1000
      expect(orchestrator.sleep).toHaveBeenCalledWith(1000);
    });

    it('throws after all retries are exhausted', async () => {
      setupDbAgent({
        id: 'agent-1',
        name: 'recon-agent',
        type: 'custom',
        config: { handlerPath: './mock-handler' },
      });

      const error = new Error('Persistent failure');
      orchestrator.executeCustomAgent = vi.fn().mockRejectedValue(error);

      await expect(
        getExecuteAgentTask(orchestrator)(workflowId, baseAgent, context, retryConfig)
      ).rejects.toThrow('Persistent failure');

      // maxRetries=2 → 3 total attempts (initial + 2 retries)
      expect(orchestrator.executeCustomAgent).toHaveBeenCalledTimes(3);
      // sleep called between attempts: after attempt 1 and attempt 2, not after final failure
      expect(orchestrator.sleep).toHaveBeenCalledTimes(2);
    });

    it('applies increasing backoff delays between retries', async () => {
      const config3 = { maxRetries: 3, backoffMultiplier: 2 };
      setupDbAgent({
        id: 'agent-1',
        name: 'recon-agent',
        type: 'custom',
        config: { handlerPath: './mock-handler' },
      });

      orchestrator.executeCustomAgent = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(
        getExecuteAgentTask(orchestrator)(workflowId, baseAgent, context, config3)
      ).rejects.toThrow();

      // 4 attempts, 3 sleeps
      expect(orchestrator.sleep).toHaveBeenCalledTimes(3);
      const delays = orchestrator.sleep.mock.calls.map((c: any[]) => c[0]);
      // attempt 1: 1000*2^0=1000, attempt 2: 1000*2^1=2000, attempt 3: 1000*2^2=4000
      expect(delays).toEqual([1000, 2000, 4000]);
    });

    it('respects WORKFLOW_RETRY_BASE_DELAY_MS env var', async () => {
      process.env.WORKFLOW_RETRY_BASE_DELAY_MS = '500';

      setupDbAgent({
        id: 'agent-1',
        name: 'recon-agent',
        type: 'custom',
        config: { handlerPath: './mock-handler' },
      });

      orchestrator.executeCustomAgent = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ ok: true });

      await getExecuteAgentTask(orchestrator)(workflowId, baseAgent, context, retryConfig);

      // baseDelay=500, attempt=1: 500*2^0=500
      expect(orchestrator.sleep).toHaveBeenCalledWith(500);

      delete process.env.WORKFLOW_RETRY_BASE_DELAY_MS;
    });

    it('throws immediately when agent is not found', async () => {
      mockWhere.mockResolvedValue([]); // no agent found
      mockReturning.mockResolvedValue([{ id: 'task-1' }]);

      await expect(
        getExecuteAgentTask(orchestrator)(workflowId, baseAgent, context, retryConfig)
      ).rejects.toThrow('Agent agent-1 not found');

      expect(orchestrator.sleep).not.toHaveBeenCalled();
    });

    it('handles unsupported agent type without retry', async () => {
      setupDbAgent({
        id: 'agent-1',
        name: 'unknown-agent',
        type: 'unknown_type',
        config: {},
      });

      // Should succeed with a skipped result, not throw
      await getExecuteAgentTask(orchestrator)(workflowId, baseAgent, context, retryConfig);

      expect(orchestrator.sleep).not.toHaveBeenCalled();
    });

    it('uses default retryConfig when none provided', async () => {
      setupDbAgent({
        id: 'agent-1',
        name: 'recon-agent',
        type: 'custom',
        config: { handlerPath: './mock-handler' },
      });

      orchestrator.executeCustomAgent = vi.fn().mockRejectedValue(new Error('fail'));

      // No retryConfig passed — defaults to maxRetries=3
      await expect(
        getExecuteAgentTask(orchestrator)(workflowId, baseAgent, context)
      ).rejects.toThrow();

      // Default maxRetries=3 → 4 total attempts
      expect(orchestrator.executeCustomAgent).toHaveBeenCalledTimes(4);
    });
  });
});
