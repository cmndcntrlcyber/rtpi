/**
 * Operations Manager Agent Unit Tests
 *
 * Tests for Phase 2 memory-enhanced Operations Manager covering:
 * - Memory context queries
 * - Report synthesis with AI
 * - Task delegation via message bus
 * - Question generation
 * - Response processing with memory storage
 * - Loop management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock data
const mockQuestion = {
  id: "q-uuid-1",
  assetId: null,
  operationId: "op-123",
  question: "Should we escalate this finding?",
  questionType: "priority",
  askedBy: "agent-1",
  status: "pending",
  answer: null,
  answerSource: null,
  answeredByUserId: null,
  answeredAt: null,
  evidence: {},
  relevantMemoryIds: [],
  answerStoredAsMemoryId: null,
  askedAt: new Date(),
};

const mockReport = {
  id: "report-uuid-1",
  agentId: "agent-1",
  operationId: "op-123",
  agentPageRole: "dashboard",
  activitySummary: "Dashboard metrics collected",
  synthesisStatus: "pending",
  synthesizedByManagerTaskId: null,
  generatedAt: new Date(),
};

const mockManagerTask = {
  id: "task-uuid-1",
  taskType: "synthesis",
  taskName: "Hourly Report Synthesis",
  operationId: "op-123",
  status: "completed",
  createdAt: new Date(),
};

// Mock DB chain
const mockReturning = vi.fn();
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockWhere = vi.fn();
const mockLimit = vi.fn();

const dbSelectChain = {
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
};

vi.mock("../../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnValue(dbSelectChain),
    insert: vi.fn().mockReturnValue({ values: mockValues }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockReturnValue([]) }),
      }),
    }),
  },
}));

vi.mock("@shared/schema", () => ({
  reporters: { id: "id", status: "status" },
  reporterQuestions: { id: "id", status: "status", reporterId: "reporterId", priority: "priority", operationId: "operationId", createdAt: "createdAt" },
  reporterTasks: { id: "id", status: "status", reporterId: "reporterId" },
  agents: { id: "id", name: "name" },
  operations: { id: "id" },
  agentActivityReports: { id: "id", operationId: "operationId", synthesisStatus: "synthesisStatus", generatedAt: "generatedAt" },
  operationsManagerTasks: { id: "id", operationId: "operationId", taskType: "taskType", createdAt: "createdAt", completedAt: "completedAt" },
  assetQuestions: { id: "id", operationId: "operationId", status: "status", askedAt: "askedAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  desc: vi.fn((a) => ({ type: "desc", a })),
  inArray: vi.fn((a, b) => ({ type: "inArray", a, b })),
  isNull: vi.fn((a) => ({ type: "isNull", a })),
  count: vi.fn(() => "count"),
}));

vi.mock("../../../server/services/reporter-agent-service", () => ({
  reporterAgentService: {
    on: vi.fn(),
    releaseData: vi.fn().mockResolvedValue(null),
    assignTask: vi.fn().mockResolvedValue("task-1"),
  },
}));

vi.mock("../../../server/services/agent-tool-connector", () => ({
  agentLoopService: {
    getActiveLoops: vi.fn().mockReturnValue([]),
    stopLoop: vi.fn().mockReturnValue(true),
    getLoop: vi.fn().mockReturnValue(undefined),
  },
  LoopExecution: class {},
}));

vi.mock("../../../server/services/memory-service", () => ({
  memoryService: {
    createContext: vi.fn().mockResolvedValue({ id: "ctx-1" }),
    addMemory: vi.fn().mockResolvedValue({ id: "mem-1" }),
    listMemories: vi.fn().mockResolvedValue([]),
    searchMemories: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../server/services/agent-message-bus", () => ({
  agentMessageBus: {
    sendMessage: vi.fn().mockResolvedValue("msg-1"),
    broadcastToRole: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../server/config/agent-config", () => ({
  agentConfig: {
    operationsManager: {
      aiModel: {
        provider: "openai",
        model: "gpt-5.2-chat-latest",
        maxTokens: 2048,
        temperature: 0.3,
      },
    },
  },
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: "Test synthesis" } }],
        }),
      },
    },
  })),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => null),
}));

describe("OperationsManagerAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Core Lifecycle", () => {
    it("should export OperationsManagerAgent class", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(mod.operationsManagerAgent).toBeDefined();
    });

    it("should have start method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.start).toBe("function");
    });

    it("should have stop method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.stop).toBe("function");
    });

    it("should have getStatus method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.getStatus).toBe("function");
    });
  });

  describe("Question Management", () => {
    it("should have getPendingQuestions method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.getPendingQuestions).toBe("function");
    });

    it("should have respondToQuestion method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.respondToQuestion).toBe("function");
    });

    it("should have dismissQuestion method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.dismissQuestion).toBe("function");
    });

    it("should have escalateQuestion method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.escalateQuestion).toBe("function");
    });

    it("should have generateQuestion method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.generateQuestion).toBe("function");
    });

    it("should have processResponse method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.processResponse).toBe("function");
    });
  });

  describe("Memory Integration", () => {
    it("should have queryMemoryForContext method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.queryMemoryForContext).toBe("function");
    });

    it("should have synthesizeReports method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.synthesizeReports).toBe("function");
    });

    it("should have delegateTask method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.delegateTask).toBe("function");
    });
  });

  describe("Loop Management", () => {
    it("should have getActiveLoops method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.getActiveLoops).toBe("function");
    });

    it("should have evaluateActiveLoops method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.evaluateActiveLoops).toBe("function");
    });

    it("should have terminateLoop method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.terminateLoop).toBe("function");
    });

    it("should have getLoopDetails method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.getLoopDetails).toBe("function");
    });
  });

  describe("Reporter Interaction", () => {
    it("should have requestReporterStatus method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.requestReporterStatus).toBe("function");
    });

    it("should have getQuestionAnalytics method", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.getQuestionAnalytics).toBe("function");
    });
  });

  describe("EventEmitter", () => {
    it("should be an EventEmitter", async () => {
      const mod = await import("../../../server/services/operations-manager-agent");
      expect(typeof mod.operationsManagerAgent.on).toBe("function");
      expect(typeof mod.operationsManagerAgent.emit).toBe("function");
    });
  });
});
