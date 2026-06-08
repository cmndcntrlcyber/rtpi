import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseMcpToolId, MCP_TOOL_PREFIX } from "../../../server/services/agents/tool-execution-loop";

/**
 * M1 — the autonomous tool-execution loop can call managed MCP tools.
 *
 * Two layers of guard:
 *  1. Pure `parseMcpToolId` round-trip (the `mcp::<serverId>::<toolName>`
 *     encoding the dispatcher relies on).
 *  2. Static wiring checks that the loop surfaces MCP tools, presents named
 *     args, and routes `mcp::` ids to mcpInvoker — without needing a live model.
 */

const LOOP = path.resolve(
  __dirname,
  "../../../server/services/agents/tool-execution-loop.ts",
);

describe("M1 — MCP tool id parsing", () => {
  it("round-trips serverId + toolName", () => {
    const id = `${MCP_TOOL_PREFIX}srv-123::tavily_search`;
    expect(parseMcpToolId(id)).toEqual({ serverId: "srv-123", toolName: "tavily_search" });
  });

  it("rejects non-MCP ids", () => {
    expect(parseMcpToolId("nmap")).toBeNull();
    expect(parseMcpToolId("msf_run")).toBeNull();
    expect(parseMcpToolId(`${MCP_TOOL_PREFIX}only-one-part`)).toBeNull();
  });

  it("keeps the first `::` as the serverId boundary", () => {
    // Tool names never contain `::`; the split is on the first delimiter.
    expect(parseMcpToolId(`${MCP_TOOL_PREFIX}uuid-with-no-colons::list_files`)).toEqual({
      serverId: "uuid-with-no-colons",
      toolName: "list_files",
    });
  });
});

describe("M1 — loop wiring", () => {
  const src = readFileSync(LOOP, "utf-8");

  it("discovers the agent's MCP tools into the catalog", () => {
    expect(src).toMatch(/getAgentMcpTools\s*\(/);
    expect(src).toMatch(/mcpInvoker\.listTools\(/);
  });

  it("routes mcp:: tools to a real MCP executor in the dispatch", () => {
    expect(src).toMatch(/startsWith\(MCP_TOOL_PREFIX\)/);
    expect(src).toMatch(/executeMcpTool\(/);
    expect(src).toMatch(/mcpInvoker\.callTool\(/);
  });

  it("accepts named (object) args for MCP tools", () => {
    expect(src).toMatch(/argsObject/);
    expect(src).toMatch(/MCP TOOL USAGE/);
  });
});
