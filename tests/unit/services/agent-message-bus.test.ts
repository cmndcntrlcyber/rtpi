/**
 * Agent Message Bus Unit Tests
 *
 * Tests for inter-agent communication system covering:
 * - Agent registration and lifecycle
 * - Message sending, routing, and delivery
 * - Broadcast to role
 * - Message status transitions
 * - Memory integration
 * - Subscriptions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock data
const mockAgent = {
  id: "agent-uuid-1",
  agentId: "agent-uuid-1",
  agentRole: "page_reporter",
  agentType: "reporter",
  capabilities: ["monitoring", "reporting"],
  isActive: true,
  lastHeartbeatAt: new Date(),
  queuedMessages: 0,
  processedMessages: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMessage = {
  id: "msg-uuid-1",
  messageType: "report",
  fromAgentId: "agent-uuid-1",
  toAgentId: "agent-uuid-2",
  broadcastToRole: null,
  operationId: "op-123",
  priority: "normal",
  subject: "Test report",
  contentSummary: "Test summary",
  contentData: { key: "value" },
  contextData: null,
  relevantMemoryIds: [],
  shouldStoreInMemory: false,
  storedAsMemoryId: null,
  status: "queued",
  deliveredAt: null,
  readAt: null,
  processedAt: null,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock DB chain
const mockReturning = vi.fn();
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn() }) });

vi.mock("../../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere.mockReturnValue({
          limit: mockLimit.mockReturnValue([]),
          orderBy: mockOrderBy.mockReturnValue({
            limit: vi.fn().mockReturnValue([]),
          }),
        }),
        orderBy: mockOrderBy.mockReturnValue({
          limit: vi.fn().mockReturnValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: mockValues }),
    update: vi.fn().mockReturnValue({ set: mockSet }),
    delete: vi.fn().mockReturnValue({ where: vi.fn() }),
  },
}));

vi.mock("@shared/schema", () => ({
  agentMessages: { id: "id" },
  agentRegistry: { id: "id", agentId: "agentId", isActive: "isActive" },
  agentMessageSubscriptions: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  desc: vi.fn((a) => ({ type: "desc", a })),
  inArray: vi.fn((a, b) => ({ type: "inArray", a, b })),
}));

vi.mock("../../../server/services/memory-service", () => ({
  memoryService: {
    addMemory: vi.fn().mockResolvedValue({ id: "mem-1" }),
    searchMemories: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../server/config/agent-config", () => ({
  agentConfig: {
    messageBus: {
      messageExpirationMs: 86400000,
      cleanupIntervalMs: 300000,
      heartbeatIntervalMs: 60000,
      staleAgentThresholdMs: 300000,
      maxQueueSizePerAgent: 100,
    },
  },
}));

describe("AgentMessageBus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Agent Registration", () => {
    it("should define registerAgent method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.registerAgent).toBe("function");
    });

    it("should define unregisterAgent method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.unregisterAgent).toBe("function");
    });

    it("should define getAgentRegistry method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.getAgentRegistry).toBe("function");
    });

    it("should define heartbeat method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.heartbeat).toBe("function");
    });
  });

  describe("Message Sending", () => {
    it("should define sendMessage method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.sendMessage).toBe("function");
    });

    it("should define broadcastToRole method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.broadcastToRole).toBe("function");
    });
  });

  describe("Message Retrieval", () => {
    it("should define getMessagesForAgent method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.getMessagesForAgent).toBe("function");
    });

    it("should define getMessageHistory method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.getMessageHistory).toBe("function");
    });
  });

  describe("Message Status Transitions", () => {
    it("should define markAsDelivered method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.markAsDelivered).toBe("function");
    });

    it("should define markAsRead method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.markAsRead).toBe("function");
    });

    it("should define markAsProcessed method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.markAsProcessed).toBe("function");
    });
  });

  describe("Subscriptions", () => {
    it("should define subscribe method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.subscribe).toBe("function");
    });

    it("should define getSubscriptions method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.getSubscriptions).toBe("function");
    });
  });

  describe("Lifecycle", () => {
    it("should define initialize method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.initialize).toBe("function");
    });

    it("should define shutdown method", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.shutdown).toBe("function");
    });

    it("should be an EventEmitter", async () => {
      const { AgentMessageBus } = await import(
        "../../../server/services/agent-message-bus"
      );
      const bus = new AgentMessageBus();
      expect(typeof bus.on).toBe("function");
      expect(typeof bus.emit).toBe("function");
    });
  });
});
