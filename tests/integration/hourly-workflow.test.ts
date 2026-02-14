/**
 * Hourly Ops Workflow Integration Tests
 *
 * Tests for the full hourly reporting cycle covering:
 * - Complete hourly cycle execution
 * - Reporter triggering
 * - Synthesis from reports
 * - Task generation from insights
 * - Orchestrator integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB chain
const mockReturning = vi.fn().mockReturnValue([]);
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

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
    insert: vi.fn().mockReturnValue({ values: mockValues }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockReturnValue([]) }),
      }),
    }),
  },
}));

vi.mock("@shared/schema", () => ({
  operations: { id: "id", status: "status" },
  targets: { id: "id", operationId: "operationId" },
  vulnerabilities: { id: "id", operationId: "operationId", severity: "severity" },
  agentWorkflows: { id: "id", operationId: "operationId", workflowType: "workflowType", createdAt: "createdAt" },
  workflowTasks: { id: "id", workflowId: "workflowId", sequenceOrder: "sequenceOrder" },
  workflowLogs: { id: "id" },
  discoveredAssets: { id: "id", targetId: "targetId" },
  securityTools: { id: "id" },
  agents: { id: "id", name: "name" },
  agentActivityReports: { id: "id", operationId: "operationId", synthesisStatus: "synthesisStatus", generatedAt: "generatedAt", agentPageRole: "agentPageRole" },
  operationsManagerTasks: { id: "id", operationId: "operationId", taskType: "taskType", createdAt: "createdAt", completedAt: "completedAt" },
  assetQuestions: { id: "id", operationId: "operationId", status: "status", askedAt: "askedAt" },
  reporters: { id: "id", status: "status" },
  reporterQuestions: { id: "id", status: "status", reporterId: "reporterId", priority: "priority", operationId: "operationId", createdAt: "createdAt" },
  reporterTasks: { id: "id", status: "status", reporterId: "reporterId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  desc: vi.fn((a) => ({ type: "desc", a })),
  asc: vi.fn((a) => ({ type: "asc", a })),
  inArray: vi.fn((a, b) => ({ type: "inArray", a, b })),
  isNull: vi.fn((a) => ({ type: "isNull", a })),
  count: vi.fn(() => "count"),
}));

vi.mock("../../server/services/memory-service", () => ({
  memoryService: {
    createContext: vi.fn().mockResolvedValue({ id: "ctx-1" }),
    addMemory: vi.fn().mockResolvedValue({ id: "mem-1" }),
    listMemories: vi.fn().mockResolvedValue([]),
    searchMemories: vi.fn().mockResolvedValue([]),
    addRelationship: vi.fn().mockResolvedValue({ id: "rel-1" }),
  },
}));

vi.mock("../../server/services/agent-message-bus", () => ({
  agentMessageBus: {
    sendMessage: vi.fn().mockResolvedValue("msg-1"),
    broadcastToRole: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../server/config/agent-config", () => ({
  agentConfig: {
    operationsManager: {
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

describe("HourlyOpsWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export hourlyOpsWorkflow singleton", async () => {
    const { hourlyOpsWorkflow } = await import(
      "../../server/services/hourly-ops-workflow"
    );
    expect(hourlyOpsWorkflow).toBeDefined();
  });

  it("should have executeHourlyCycle method", async () => {
    const { hourlyOpsWorkflow } = await import(
      "../../server/services/hourly-ops-workflow"
    );
    expect(typeof hourlyOpsWorkflow.executeHourlyCycle).toBe("function");
  });

  it("should have triggerReporters method", async () => {
    const { hourlyOpsWorkflow } = await import(
      "../../server/services/hourly-ops-workflow"
    );
    expect(typeof hourlyOpsWorkflow.triggerReporters).toBe("function");
  });

  it("should have executeViaOrchestrator method", async () => {
    const { hourlyOpsWorkflow } = await import(
      "../../server/services/hourly-ops-workflow"
    );
    expect(typeof hourlyOpsWorkflow.executeViaOrchestrator).toBe("function");
  });

  it("should return correct result shape from executeHourlyCycle", async () => {
    const { hourlyOpsWorkflow } = await import(
      "../../server/services/hourly-ops-workflow"
    );

    const result = await hourlyOpsWorkflow.executeHourlyCycle("op-123");

    expect(result).toHaveProperty("operationId", "op-123");
    expect(result).toHaveProperty("reportsGenerated");
    expect(result).toHaveProperty("reportsFailed");
    expect(result).toHaveProperty("synthesisResult");
    expect(result).toHaveProperty("tasksGenerated");
    expect(result).toHaveProperty("durationMs");
    expect(typeof result.durationMs).toBe("number");
  });
});
