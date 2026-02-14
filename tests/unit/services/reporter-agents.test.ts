/**
 * Reporter Agents Unit Tests
 *
 * Tests for the individual page reporter agents covering:
 * - BaseReporter abstract class
 * - Individual reporter implementations
 * - Change detection
 * - Memory storage
 * - Reporter agent service memory integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB chain
const mockReturning = vi.fn().mockReturnValue([]);
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockLimit = vi.fn().mockReturnValue([]);
const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });

vi.mock("../../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({ from: mockFrom }),
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
  agentWorkflows: { id: "id", operationId: "operationId" },
  discoveredAssets: { id: "id", targetId: "targetId" },
  securityTools: { id: "id" },
  agents: { id: "id" },
  agentActivityReports: { id: "id", operationId: "operationId" },
  reporters: { id: "id", status: "status", operationId: "operationId" },
  reporterQuestions: { id: "id", status: "status", reporterId: "reporterId", operationId: "operationId", priority: "priority", createdAt: "createdAt" },
  reporterTasks: { id: "id", status: "status", reporterId: "reporterId", priority: "priority", createdAt: "createdAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  desc: vi.fn((a) => ({ type: "desc", a })),
  inArray: vi.fn((a, b) => ({ type: "inArray", a, b })),
  count: vi.fn(() => "count"),
}));

vi.mock("../../../server/services/memory-service", () => ({
  memoryService: {
    createContext: vi.fn().mockResolvedValue({ id: "ctx-1" }),
    addMemory: vi.fn().mockResolvedValue({ id: "mem-1" }),
    listMemories: vi.fn().mockResolvedValue([]),
    searchMemories: vi.fn().mockResolvedValue([]),
    addRelationship: vi.fn().mockResolvedValue({ id: "rel-1" }),
  },
}));

vi.mock("../../../server/config/reporter-config", () => ({
  reporterSpecs: {
    dashboard: {
      pageId: "dashboard",
      pageName: "Dashboard",
      pageUrl: "/dashboard",
      description: "Test",
      enabled: true,
      pollingIntervalMs: 3600000,
      monitoredMetrics: ["activeOperations"],
      summaryPromptTemplate: "Summarize dashboard",
    },
  },
  getReporterSpec: vi.fn().mockReturnValue({
    pageId: "dashboard",
    pageName: "Dashboard",
    summaryPromptTemplate: "Summarize dashboard",
  }),
  getEnabledReporterPages: vi.fn().mockReturnValue(["dashboard"]),
}));

describe("Individual Reporters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DashboardReporter", () => {
    it("should export a singleton instance", async () => {
      const { dashboardReporter } = await import(
        "../../../server/services/reporters/dashboard-reporter"
      );
      expect(dashboardReporter).toBeDefined();
    });

    it("should have fetchPageData method", async () => {
      const { dashboardReporter } = await import(
        "../../../server/services/reporters/dashboard-reporter"
      );
      expect(typeof dashboardReporter.fetchPageData).toBe("function");
    });

    it("should have executeReport method from base class", async () => {
      const { dashboardReporter } = await import(
        "../../../server/services/reporters/dashboard-reporter"
      );
      expect(typeof dashboardReporter.executeReport).toBe("function");
    });
  });

  describe("OperationsReporter", () => {
    it("should export a singleton instance", async () => {
      const { operationsReporter } = await import(
        "../../../server/services/reporters/operations-reporter"
      );
      expect(operationsReporter).toBeDefined();
    });

    it("should have fetchPageData method", async () => {
      const { operationsReporter } = await import(
        "../../../server/services/reporters/operations-reporter"
      );
      expect(typeof operationsReporter.fetchPageData).toBe("function");
    });
  });

  describe("TargetsReporter", () => {
    it("should export a singleton instance", async () => {
      const { targetsReporter } = await import(
        "../../../server/services/reporters/targets-reporter"
      );
      expect(targetsReporter).toBeDefined();
    });

    it("should have fetchPageData method", async () => {
      const { targetsReporter } = await import(
        "../../../server/services/reporters/targets-reporter"
      );
      expect(typeof targetsReporter.fetchPageData).toBe("function");
    });
  });

  describe("VulnerabilitiesReporter", () => {
    it("should export a singleton instance", async () => {
      const { vulnerabilitiesReporter } = await import(
        "../../../server/services/reporters/vulnerabilities-reporter"
      );
      expect(vulnerabilitiesReporter).toBeDefined();
    });

    it("should have fetchPageData method", async () => {
      const { vulnerabilitiesReporter } = await import(
        "../../../server/services/reporters/vulnerabilities-reporter"
      );
      expect(typeof vulnerabilitiesReporter.fetchPageData).toBe("function");
    });
  });

  describe("AssetsReporter", () => {
    it("should export a singleton instance", async () => {
      const { assetsReporter } = await import(
        "../../../server/services/reporters/assets-reporter"
      );
      expect(assetsReporter).toBeDefined();
    });

    it("should have fetchPageData method", async () => {
      const { assetsReporter } = await import(
        "../../../server/services/reporters/assets-reporter"
      );
      expect(typeof assetsReporter.fetchPageData).toBe("function");
    });
  });

  describe("ToolsReporter", () => {
    it("should export a singleton instance", async () => {
      const { toolsReporter } = await import(
        "../../../server/services/reporters/tools-reporter"
      );
      expect(toolsReporter).toBeDefined();
    });
  });

  describe("WorkflowsReporter", () => {
    it("should export a singleton instance", async () => {
      const { workflowsReporter } = await import(
        "../../../server/services/reporters/workflows-reporter"
      );
      expect(workflowsReporter).toBeDefined();
    });
  });

  describe("AgentsReporter", () => {
    it("should export a singleton instance", async () => {
      const { agentsReporter } = await import(
        "../../../server/services/reporters/agents-reporter"
      );
      expect(agentsReporter).toBeDefined();
    });
  });
});

describe("ReporterAgentService Memory Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have storeReportInMemory method", async () => {
    const { reporterAgentService } = await import(
      "../../../server/services/reporter-agent-service"
    );
    expect(typeof reporterAgentService.storeReportInMemory).toBe("function");
  });

  it("should have queryRelevantMemories method", async () => {
    const { reporterAgentService } = await import(
      "../../../server/services/reporter-agent-service"
    );
    expect(typeof reporterAgentService.queryRelevantMemories).toBe("function");
  });

  it("should have createMemoryRelationships method", async () => {
    const { reporterAgentService } = await import(
      "../../../server/services/reporter-agent-service"
    );
    expect(typeof reporterAgentService.createMemoryRelationships).toBe("function");
  });

  it("should be an EventEmitter", async () => {
    const { reporterAgentService } = await import(
      "../../../server/services/reporter-agent-service"
    );
    expect(typeof reporterAgentService.on).toBe("function");
    expect(typeof reporterAgentService.emit).toBe("function");
  });
});
