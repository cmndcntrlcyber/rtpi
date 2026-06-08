/**
 * Tests for renderToolSummaryPrompt — the pure helper that builds the AI
 * summarization prompt for a sequential tool batch.
 *
 * Pins the user-visible Phase 6 + 7 outcomes:
 *   - SKILL.md body is inlined under each completed tool when present
 *   - SKILL.md trimmed at 2 KB (keeps prompt budget bounded)
 *   - No skill block when skillBody is null (clean fallback)
 *   - Failed tools render structured detail (stderr, attemptedCommand,
 *     exitCode) instead of opaque "Unknown error"
 *   - The orchestrator's prior "## Tool Execution Results" + "### <name>"
 *     structure is preserved so downstream parsers don't break
 */

import { describe, expect, it, vi } from "vitest";

// Heavy deps the orchestrator pulls in transitively — mocked so the test
// importing renderToolSummaryPrompt stays hermetic.
vi.mock("../../../server/db", () => ({ db: {} }));
vi.mock("../../../server/services/agent-tool-connector", () => ({ agentToolConnector: {} }));
vi.mock("../../../server/services/metasploit-executor", () => ({ metasploitExecutor: {} }));
vi.mock("../../../server/services/empire-executor", () => ({ empireExecutor: {} }));
vi.mock("../../../server/services/report-generator", () => ({ generateMarkdownReport: vi.fn() }));
vi.mock("../../../server/services/ollama-ai-client", () => ({ ollamaAIClient: {} }));
vi.mock("../../../server/services/inference/inference-router", () => ({
  routeAgent: vi.fn(),
  routeReasoning: vi.fn(),
  NoInferenceProviderAvailable: class extends Error {},
}));
vi.mock("../../../server/services/ai-clients", () => ({ getAnthropicClient: vi.fn() }));
vi.mock("../../../server/services/tool-executor", () => ({ executeTool: vi.fn() }));
vi.mock("../../../server/services/agents/multi-container-executor", () => ({ multiContainerExecutor: {} }));
vi.mock("../../../server/services/agents/tool-execution-loop", () => ({
  ToolExecutionLoop: class {},
}));
vi.mock("../../../server/services/agent-websocket-manager", () => ({ agentWebSocketManager: {} }));
vi.mock("../../../server/services/skills/skill-loader", () => ({
  loadSkillFileByRelativePath: vi.fn(),
}));

import {
  renderToolSummaryPrompt,
  type ToolExecutionStepResult,
} from "../../../server/services/agent-workflow-orchestrator";

function completedResult(overrides: Partial<ToolExecutionStepResult> = {}): ToolExecutionStepResult {
  return {
    toolId: "uuid-1",
    toolStringId: "bbot",
    toolName: "Bbot",
    category: "reconnaissance",
    containerName: "rtpi-tools",
    execution: {
      success: true,
      exitCode: 0,
      stdout: "subdomain.example.com",
      stderr: "",
      parsedOutput: null,
      duration: 1234,
      timestamp: "2026-05-19T20:00:00Z",
      executionId: "exec-1",
      command: "bbot -t example.com",
    },
    error: null,
    status: "completed",
    skillPath: null,
    skillBody: null,
    failureDetail: null,
    ...overrides,
  };
}

function failedResult(overrides: Partial<ToolExecutionStepResult> = {}): ToolExecutionStepResult {
  return {
    toolId: "uuid-2",
    toolStringId: "nmap",
    toolName: "Nmap",
    category: "scanning",
    containerName: "rtpi-tools",
    execution: null,
    error: "Tool exited 127",
    status: "failed",
    skillPath: null,
    skillBody: null,
    failureDetail: null,
    ...overrides,
  };
}

describe("renderToolSummaryPrompt — happy paths", () => {
  it("preserves the prior structure (agent name, target, ## Tool Execution Results)", () => {
    const out = renderToolSummaryPrompt("Surface Assessment Agent", "example.com", [completedResult()]);
    expect(out).toContain('Surface Assessment Agent');
    expect(out).toContain('example.com');
    expect(out).toContain("## Tool Execution Results");
    expect(out).toContain("### Bbot (bbot)");
    expect(out).toContain("- Command: bbot -t example.com");
  });

  it("does NOT include a SKILL.md block when skillBody is null", () => {
    const out = renderToolSummaryPrompt("A", "t", [completedResult({ skillBody: null })]);
    expect(out).not.toContain("Tool Manual");
  });
});

describe("renderToolSummaryPrompt — SKILL.md injection", () => {
  it("inlines the SKILL.md body under each completed tool when present", () => {
    const out = renderToolSummaryPrompt("A", "t", [
      completedResult({
        skillPath: "skills/tools/registry/bbot.md",
        skillBody: "## BBOT MANUAL\nUsage: bbot -t <target>\nFlags: ...",
      }),
    ]);
    expect(out).toContain("Tool Manual (SKILL.md");
    expect(out).toContain("BBOT MANUAL");
    expect(out).toContain("Usage: bbot -t <target>");
  });

  it("trims the SKILL.md body at 2 KB so prompts stay bounded", () => {
    const huge = "x".repeat(5000);
    const out = renderToolSummaryPrompt("A", "t", [completedResult({ skillBody: huge })]);
    // Body inside the fenced block must be at most 2000 chars.
    const fenced = out.match(/```md\n([\s\S]*?)\n```/);
    expect(fenced).not.toBeNull();
    expect(fenced![1].length).toBeLessThanOrEqual(2000);
  });
});

describe("renderToolSummaryPrompt — failure detail (Bug C fix)", () => {
  it("renders structured stderr, attemptedCommand, and exitCode", () => {
    const out = renderToolSummaryPrompt("A", "t", [
      failedResult({
        toolName: "Bbot",
        error: "Tool exited 127",
        failureDetail: {
          message: "Tool exited 127",
          stderr: "/bin/sh: 1: bbot: not found",
          attemptedCommand: 'bbot -t "example.com"',
          exitCode: 127,
        },
      }),
    ]);
    expect(out).toContain("### Failed Tools");
    expect(out).toContain("- Bbot: Tool exited 127");
    expect(out).toContain("Exit code: 127");
    expect(out).toContain('Command attempted: `bbot -t "example.com"`');
    expect(out).toContain("Stderr: `/bin/sh: 1: bbot: not found`");
  });

  it("falls back to the old line shape when failureDetail is null", () => {
    const out = renderToolSummaryPrompt("A", "t", [
      failedResult({ failureDetail: null, error: "boom" }),
    ]);
    expect(out).toContain("- Nmap: boom");
    expect(out).not.toContain("Exit code:");
    expect(out).not.toContain("Command attempted:");
  });

  it("truncates large stderr at 500 chars", () => {
    const bigStderr = "x".repeat(2000);
    const out = renderToolSummaryPrompt("A", "t", [
      failedResult({
        failureDetail: { message: "m", stderr: bigStderr, attemptedCommand: null, exitCode: null },
      }),
    ]);
    const match = out.match(/Stderr: `([^`]*)`/);
    expect(match).not.toBeNull();
    expect(match![1].length).toBeLessThanOrEqual(500);
  });
});

describe("renderToolSummaryPrompt — mixed batch", () => {
  it("renders completed and failed in their respective sections", () => {
    const out = renderToolSummaryPrompt("A", "t", [
      completedResult({ toolName: "Bbot", skillBody: "manual body" }),
      failedResult({
        toolName: "Nmap",
        error: "Tool exited 1",
        failureDetail: { message: "Tool exited 1", stderr: "denied", attemptedCommand: "nmap t", exitCode: 1 },
      }),
    ]);
    expect(out).toContain("### Bbot (bbot)");
    expect(out).toContain("manual body");
    expect(out).toContain("### Failed Tools");
    expect(out).toContain("- Nmap: Tool exited 1");
    expect(out).toContain("Exit code: 1");
  });
});
