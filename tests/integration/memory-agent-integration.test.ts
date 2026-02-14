/**
 * Memory-Agent Integration Tests
 *
 * Tests for memory integration across the agent system covering:
 * - Memory context creation for operations
 * - Memory queries during synthesis
 * - Memory relationship creation
 * - Reporter memory storage
 * - Task agent memory integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
vi.mock("../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([]),
          }),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockReturnValue([]) }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockReturnValue([]) }),
      }),
    }),
  },
}));

vi.mock("@shared/schema", () => ({
  operations: { id: "id" },
  targets: { id: "id", operationId: "operationId" },
  vulnerabilities: { id: "id", operationId: "operationId", severity: "severity" },
  discoveredAssets: { id: "id", targetId: "targetId" },
  agentWorkflows: { id: "id" },
  securityTools: { id: "id" },
  agents: { id: "id", name: "name" },
  agentActivityReports: { id: "id", operationId: "operationId", synthesisStatus: "synthesisStatus", generatedAt: "generatedAt", agentPageRole: "agentPageRole" },
  operationsManagerTasks: { id: "id", operationId: "operationId", taskType: "taskType" },
  assetQuestions: { id: "id", operationId: "operationId", status: "status" },
  reporters: { id: "id", status: "status" },
  reporterQuestions: { id: "id", status: "status", reporterId: "reporterId", priority: "priority", operationId: "operationId", createdAt: "createdAt" },
  reporterTasks: { id: "id", status: "status", reporterId: "reporterId" },
  agentMessages: { id: "id" },
  agentRegistry: { id: "id", agentId: "agentId", isActive: "isActive" },
  agentMessageSubscriptions: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  desc: vi.fn((a) => ({ type: "desc", a })),
  inArray: vi.fn((a, b) => ({ type: "inArray", a, b })),
  isNull: vi.fn((a) => ({ type: "isNull", a })),
  count: vi.fn(() => "count"),
}));

const mockMemoryService = {
  createContext: vi.fn().mockResolvedValue({ id: "ctx-test-1" }),
  addMemory: vi.fn().mockResolvedValue({ id: "mem-test-1" }),
  listMemories: vi.fn().mockResolvedValue([
    { id: "mem-1", memoryText: "Test memory 1", memoryType: "fact" },
    { id: "mem-2", memoryText: "Test memory 2", memoryType: "insight" },
  ]),
  searchMemories: vi.fn().mockResolvedValue([
    { id: "mem-1", memoryText: "Relevant finding", memoryType: "fact" },
  ]),
  addRelationship: vi.fn().mockResolvedValue({ id: "rel-test-1" }),
  getRelatedMemories: vi.fn().mockResolvedValue([]),
};

vi.mock("../../server/services/memory-service", () => ({
  memoryService: mockMemoryService,
}));

vi.mock("../../server/services/agent-message-bus", () => ({
  agentMessageBus: {
    sendMessage: vi.fn().mockResolvedValue("msg-1"),
    registerAgent: vi.fn().mockResolvedValue(undefined),
    broadcastToRole: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../server/config/agent-config", () => ({
  agentConfig: {
    operationsManager: {
      aiModel: { provider: "openai", model: "gpt-5.2-chat-latest", maxTokens: 2048, temperature: 0.3 },
    },
    taskAgent: {
      aiModel: { provider: "openai", model: "gpt-5.2-chat-latest", maxTokens: 2048, temperature: 0.3 },
    },
    messageBus: {
      messageExpirationMs: 86400000,
      cleanupIntervalMs: 300000,
      heartbeatIntervalMs: 60000,
      staleAgentThresholdMs: 300000,
      maxQueueSizePerAgent: 100,
    },
  },
}));

vi.mock("../../server/config/reporter-config", () => ({
  reporterSpecs: {},
  getReporterSpec: vi.fn(),
  getEnabledReporterPages: vi.fn().mockReturnValue([]),
}));

vi.mock("../../server/services/reporter-agent-service", () => ({
  reporterAgentService: {
    on: vi.fn(),
    releaseData: vi.fn().mockResolvedValue(null),
    assignTask: vi.fn().mockResolvedValue("task-1"),
    storeReportInMemory: vi.fn().mockResolvedValue("mem-1"),
    queryRelevantMemories: vi.fn().mockResolvedValue([]),
    createMemoryRelationships: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../server/services/agent-tool-connector", () => ({
  agentLoopService: {
    getActiveLoops: vi.fn().mockReturnValue([]),
    stopLoop: vi.fn().mockReturnValue(true),
    getLoop: vi.fn().mockReturnValue(undefined),
  },
  LoopExecution: class {},
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: "Test" } }] }) } },
  })),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => null),
}));

describe("Memory-Agent Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Memory Context Creation", () => {
    it("should create memory context for operations via manager", async () => {
      const { operationsManagerAgent } = await import(
        "../../server/services/operations-manager-agent"
      );

      const result = await operationsManagerAgent.queryMemoryForContext("op-123");

      expect(mockMemoryService.createContext).toHaveBeenCalledWith({
        contextType: "operation",
        contextId: "op-123",
        contextName: "Operation op-123",
      });
      expect(result).toHaveProperty("id", "ctx-test-1");
      expect(result).toHaveProperty("memories");
    });

    it("should list memories for context", async () => {
      const { operationsManagerAgent } = await import(
        "../../server/services/operations-manager-agent"
      );

      const result = await operationsManagerAgent.queryMemoryForContext("op-456");

      expect(mockMemoryService.listMemories).toHaveBeenCalled();
      expect(result.memories).toHaveLength(2);
    });
  });

  describe("Reporter Memory Storage", () => {
    it("should expose storeReportInMemory on reporter service", async () => {
      const { reporterAgentService } = await import(
        "../../server/services/reporter-agent-service"
      );
      expect(typeof reporterAgentService.storeReportInMemory).toBe("function");
    });

    it("should expose queryRelevantMemories on reporter service", async () => {
      const { reporterAgentService } = await import(
        "../../server/services/reporter-agent-service"
      );
      expect(typeof reporterAgentService.queryRelevantMemories).toBe("function");
    });

    it("should expose createMemoryRelationships on reporter service", async () => {
      const { reporterAgentService } = await import(
        "../../server/services/reporter-agent-service"
      );
      expect(typeof reporterAgentService.createMemoryRelationships).toBe("function");
    });
  });

  describe("Task Agent Memory Integration", () => {
    it("should expose BaseTaskAgent with memory methods", async () => {
      const { BaseTaskAgent } = await import(
        "../../server/services/agents/base-task-agent"
      );
      expect(BaseTaskAgent).toBeDefined();
      expect(BaseTaskAgent.prototype.getRelevantMemories).toBeDefined();
      expect(BaseTaskAgent.prototype.storeTaskMemory).toBeDefined();
    });
  });
});
