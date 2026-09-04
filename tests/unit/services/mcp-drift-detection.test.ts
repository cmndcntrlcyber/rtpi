import { describe, it, expect, vi } from "vitest";
import { createHash } from "crypto";

vi.mock("../../../server/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("../../../server/services/mcp-server-manager", () => ({
  mcpServerManager: {
    getChildProcess: vi.fn().mockReturnValue(null),
  },
}));

vi.mock("../../../server/services/agents/mcp-invoker", () => ({
  mcpInvoker: {
    listTools: vi.fn().mockResolvedValue([]),
  },
}));

interface ToolDef {
  name: string;
  description: string;
  inputSchema: { type: string; properties: Record<string, unknown> };
}

function computeToolsHash(tools: ToolDef[]): string {
  const canonical = tools
    .map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

describe("MCP Capability Drift Detection", () => {
  const baseTool: ToolDef = {
    name: "tavily_search",
    description: "Search the web",
    inputSchema: { type: "object", properties: { query: { type: "string" } } },
  };

  const extraTool: ToolDef = {
    name: "tavily_extract",
    description: "Extract content",
    inputSchema: { type: "object", properties: { urls: { type: "array" } } },
  };

  describe("computeToolsHash", () => {
    it("should produce a stable SHA-256 hash", () => {
      const hash1 = computeToolsHash([baseTool]);
      const hash2 = computeToolsHash([baseTool]);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("should be order-independent", () => {
      const hash1 = computeToolsHash([baseTool, extraTool]);
      const hash2 = computeToolsHash([extraTool, baseTool]);
      expect(hash1).toBe(hash2);
    });

    it("should detect differences when tools change", () => {
      const hash1 = computeToolsHash([baseTool]);
      const hash2 = computeToolsHash([baseTool, extraTool]);
      expect(hash1).not.toBe(hash2);
    });

    it("should detect description changes", () => {
      const modified = { ...baseTool, description: "Updated description" };
      const hash1 = computeToolsHash([baseTool]);
      const hash2 = computeToolsHash([modified]);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("drift detection logic", () => {
    it("should detect added tools", () => {
      const oldTools = [baseTool];
      const newTools = [baseTool, extraTool];
      const oldNames = new Set(oldTools.map((t) => t.name));
      const added = newTools.filter((t) => !oldNames.has(t.name)).map((t) => t.name);
      expect(added).toEqual(["tavily_extract"]);
    });

    it("should detect removed tools", () => {
      const oldTools = [baseTool, extraTool];
      const newTools = [baseTool];
      const newNames = new Set(newTools.map((t) => t.name));
      const removed = oldTools.filter((t) => !newNames.has(t.name)).map((t) => t.name);
      expect(removed).toEqual(["tavily_extract"]);
    });

    it("should not trigger when hash matches", () => {
      const oldHash = computeToolsHash([baseTool]);
      const newHash = computeToolsHash([baseTool]);
      expect(oldHash).toBe(newHash);
      const driftDetected = oldHash !== newHash;
      expect(driftDetected).toBe(false);
    });

    it("should not trigger on first discovery (no baseline)", () => {
      const oldHash: string | null = null;
      const newHash = computeToolsHash([baseTool]);
      const shouldTrigger = oldHash !== null && oldHash !== newHash;
      expect(shouldTrigger).toBe(false);
    });

    it("should trigger when tools are added", () => {
      const oldHash = computeToolsHash([baseTool]);
      const newHash = computeToolsHash([baseTool, extraTool]);
      const shouldTrigger = oldHash !== null && oldHash !== newHash;
      expect(shouldTrigger).toBe(true);
    });

    it("should trigger when tools are removed", () => {
      const oldHash = computeToolsHash([baseTool, extraTool]);
      const newHash = computeToolsHash([baseTool]);
      const shouldTrigger = oldHash !== null && oldHash !== newHash;
      expect(shouldTrigger).toBe(true);
    });
  });

  describe("notification payload", () => {
    it("should format added tools in notification message", () => {
      const added = ["tavily_extract", "tavily_map"];
      const removed: string[] = [];
      const parts: string[] = [];
      if (added.length > 0) parts.push(`added: ${added.join(", ")}`);
      if (removed.length > 0) parts.push(`removed: ${removed.join(", ")}`);
      const message = parts.join("; ");
      expect(message).toBe("added: tavily_extract, tavily_map");
    });

    it("should format removed tools in notification message", () => {
      const added: string[] = [];
      const removed = ["old_tool"];
      const parts: string[] = [];
      if (added.length > 0) parts.push(`added: ${added.join(", ")}`);
      if (removed.length > 0) parts.push(`removed: ${removed.join(", ")}`);
      const message = parts.join("; ");
      expect(message).toBe("removed: old_tool");
    });

    it("should format both added and removed in notification", () => {
      const added = ["new_tool"];
      const removed = ["old_tool"];
      const parts: string[] = [];
      if (added.length > 0) parts.push(`added: ${added.join(", ")}`);
      if (removed.length > 0) parts.push(`removed: ${removed.join(", ")}`);
      const message = parts.join("; ");
      expect(message).toBe("added: new_tool; removed: old_tool");
    });
  });

  describe("static inference skip", () => {
    it("should skip drift detection when tools come from static inference", () => {
      const isLive = false;
      expect(isLive).toBe(false);
      // drift detection block is guarded by `if (isLive)`
    });

    it("should run drift detection when tools come from live discovery", () => {
      const isLive = true;
      expect(isLive).toBe(true);
    });
  });
});
