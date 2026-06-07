import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Guard against the C1 "architectural hallucination" regression: the agent-tool
 * connector previously had stub branches (executeOpenAI / executeAnthropic /
 * executeMCP / executeCustom) that returned hard-coded fictional success
 * strings — so a workflow could "execute a tool" and report success with
 * fabricated output. Those were removed; real execution now goes through
 * Docker (executeToolInDocker), the registry executor (executeWithNewFramework
 * → tool-executor), or MCP (executeMCP → mcpInvoker.callTool), and any path
 * without a real backend THROWS.
 *
 * Pure source parsing — runs in CI without a DB or containers.
 */

const FILE = path.resolve(
  __dirname,
  "../../../server/services/agent-tool-connector.ts",
);

describe("agent-tool-connector — no fabricated execution", () => {
  const src = readFileSync(FILE, "utf-8");

  it("contains none of the old fabricated-success literals", () => {
    const banned = [
      "Tool execution successful",
      "MCP server processing complete",
      "Automated vulnerability assessment initiated",
      "Exploit chain development",
      "Security posture evaluated",
      "Custom processing complete",
    ];
    const present = banned.filter((s) => src.includes(s));
    expect(
      present,
      `Fabricated-output literal(s) reintroduced into the connector:\n` +
        present.map((s) => `  "${s}"`).join("\n"),
    ).toEqual([]);
  });

  it("no longer defines the fabricating stub methods", () => {
    const bannedDefs = [
      /private\s+async\s+executeOpenAI\s*\(/,
      /private\s+async\s+executeAnthropic\s*\(/,
      /private\s+async\s+executeCustom\s*\(/,
    ];
    const present = bannedDefs.filter((re) => re.test(src)).map((re) => re.source);
    expect(
      present,
      `Fabricating stub method(s) still defined:\n${present.join("\n")}`,
    ).toEqual([]);
  });

  it("executeMCP routes to the real mcpInvoker", () => {
    // The real MCP path must call the invoker, not return a canned string.
    expect(src).toMatch(/mcpInvoker\.callTool\(/);
  });

  it("execute() returns the canonical AgentToolResult (H2)", () => {
    // Structured return, not a bare string — callers depend on exitCode/stdout.
    expect(src).toMatch(/async execute\([\s\S]*?\):\s*Promise<AgentToolResult>/);
  });

  it("resolves tools through the single resolveTool (M2)", () => {
    // No ad-hoc getToolById→securityTools fallback inside the connector anymore.
    expect(src).toMatch(/resolveTool\(/);
    expect(src).not.toMatch(/\bgetToolById\(/);
  });
});
