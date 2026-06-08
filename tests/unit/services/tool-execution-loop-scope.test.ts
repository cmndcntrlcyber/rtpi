/**
 * Unit tests for the per-agent scoping of ToolExecutionLoop
 * (FF_AGENT_SCOPED_ATTACK_TREE engine convergence):
 *  - scoped tool catalog (enabledTools UUID -> slug, installed-only, + synthetic)
 *  - composed system prompt (agent persona + ## Tool Skills + action protocol)
 *  - synthetic MSF tool dispatch + result normalization + soft-degrade
 *
 * Heavy dependencies are mocked so importing the loop is side-effect free.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted so the (hoisted) vi.mock factories below can reference these safely.
const { mockRows, mockSearch, mockExec } = vi.hoisted(() => ({
  mockRows: vi.fn(),
  mockSearch: vi.fn(),
  mockExec: vi.fn(),
}));

vi.mock("../../../server/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => mockRows() }) }) },
}));
vi.mock("../../../server/services/agents/multi-container-executor", () => ({
  multiContainerExecutor: {
    listToolsByContainer: vi.fn().mockResolvedValue(new Map()),
    executeTool: vi.fn(),
  },
}));
vi.mock("../../../server/services/metasploit-executor", () => ({
  metasploitExecutor: { searchModules: mockSearch, execute: mockExec },
}));
vi.mock("../../../server/services/empire-executor", () => ({
  empireExecutor: { executeTask: vi.fn() },
}));
vi.mock("../../../server/services/docker-executor", () => ({}));
vi.mock("../../../server/services/memory-service", () => ({ memoryService: { searchMemories: vi.fn() } }));
vi.mock("../../../server/services/agent-message-bus", () => ({ agentMessageBus: {} }));
vi.mock("../../../server/services/inference/inference-router", () => ({
  routeReasoning: vi.fn(),
  NoInferenceProviderAvailable: class {},
}));
vi.mock("../../../server/services/skills/skill-loader", () => ({ loadSkillBody: vi.fn() }));
vi.mock("../../../server/services/skills/skill-paths", () => ({ slugifyId: (s: string) => s }));
vi.mock("../../../server/services/agents/tool-chain-proposer", () => ({ proposeChains: vi.fn() }));

import {
  ToolExecutionLoop,
  ATTACK_SYNTHETIC_TOOLS,
  type AgentToolScope,
} from "../../../server/services/agents/tool-execution-loop";

function makeLoop(scope: AgentToolScope | null) {
  return new ToolExecutionLoop("agent-1", "RT Agent", "wf-1", "target-1", "objective", {}, scope);
}

const SYNTH_MSF = ATTACK_SYNTHETIC_TOOLS.filter((t) => t.toolId !== "empire_task");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ToolExecutionLoop per-agent scope", () => {
  it("scopes the catalog to enabledTools (UUID->slug), drops non-installed, appends synthetic", async () => {
    mockRows.mockResolvedValue([
      { toolId: "nmap", name: "Nmap", binaryPath: "/usr/bin/nmap", containerName: "rtpi-tools", containerUser: "rtpi-tools", category: "recon", version: "7.9", installStatus: "installed" },
      { toolId: "halfbaked", name: "Half", binaryPath: "/x", containerName: "rtpi-tools", containerUser: "rtpi-tools", category: "recon", version: null, installStatus: "pending" },
    ]);
    const loop = makeLoop({ enabledToolIds: ["uuid-a", "uuid-b"], syntheticTools: SYNTH_MSF });
    const tools = await (loop as any).getAvailableTools();
    const ids = tools.map((t: any) => t.toolId);
    expect(ids).toContain("nmap");        // installed registry tool, slug not UUID
    expect(ids).not.toContain("halfbaked"); // not installed -> excluded
    expect(ids).toContain("msf_search");  // synthetic appended
    expect(ids).toContain("msf_run");
  });

  it("composes the system prompt: agent persona + ## Tool Skills + action protocol + synthetic usage", () => {
    const agentPrompt = "You are RT-Agent, a focused recon operator.\n\n## Tool Skills\n\n### nmap\n\nNetwork scanner.";
    const loop = makeLoop({ enabledToolIds: [], agentSystemPrompt: agentPrompt, syntheticTools: SYNTH_MSF });
    const prompt = (loop as any).buildSystemPrompt([
      { toolId: "nmap", category: "recon", name: "Nmap", containerName: "rtpi-tools" },
    ]);
    expect(prompt).toContain("You are RT-Agent");           // agent persona preserved
    expect(prompt).toContain("## Tool Skills");             // injected skills preserved
    expect(prompt).toContain("AVAILABLE TOOLS:");           // authoritative tool list
    expect(prompt).toContain("nmap (recon)");
    expect(prompt).toContain("SYNTHETIC TOOL USAGE");       // synthetic arg contract
    expect(prompt).toContain("RESPOND WITH VALID JSON ONLY"); // action protocol last
  });

  it("falls back to the generic preamble when no agent prompt is scoped", () => {
    const loop = makeLoop(null);
    const prompt = (loop as any).buildSystemPrompt([
      { toolId: "nmap", category: "recon", name: "Nmap", containerName: "rtpi-tools" },
    ]);
    expect(prompt).toContain("You are an autonomous security assessment agent");
    expect(prompt).toContain("RESPOND WITH VALID JSON ONLY");
  });

  it("msf_search dispatches to searchModules and returns exit 0 with formatted modules", async () => {
    mockSearch.mockResolvedValue([
      { type: "exploit", path: "unix/ftp/vsftpd_234_backdoor", rank: "excellent", description: "VSFTPD backdoor" },
    ]);
    const loop = makeLoop({ enabledToolIds: [], syntheticTools: SYNTH_MSF, msfToolId: "msf-sec-id", targetValue: "10.0.0.1" });
    const r = await (loop as any).executeSyntheticTool("msf_search", ["vsftpd"]);
    expect(mockSearch).toHaveBeenCalledWith("vsftpd", undefined);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("exploit/unix/ftp/vsftpd_234_backdoor");
  });

  it("msf_run dispatches to metasploitExecutor.execute and maps output/success -> stdout/exitCode", async () => {
    mockExec.mockResolvedValue({ success: true, output: "Meterpreter session 1 opened", stderr: "", exitCode: 0 });
    const loop = makeLoop({ enabledToolIds: [], syntheticTools: SYNTH_MSF, msfToolId: "msf-sec-id", targetValue: "10.0.0.1" });
    const r = await (loop as any).executeSyntheticTool("msf_run", ["exploit", "unix/ftp/vsftpd_234_backdoor", "RPORT=21"]);
    expect(mockExec).toHaveBeenCalledWith(
      "msf-sec-id",
      { type: "exploit", path: "unix/ftp/vsftpd_234_backdoor", parameters: { RPORT: "21" } },
      "10.0.0.1",
    );
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("session 1 opened");
  });

  it("msf_run soft-degrades (exit 1, no throw) when no MSF tool/target is bound", async () => {
    const loop = makeLoop({ enabledToolIds: [], syntheticTools: SYNTH_MSF });
    const r = await (loop as any).executeSyntheticTool("msf_run", ["exploit", "unix/x"]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/unavailable/i);
    expect(mockExec).not.toHaveBeenCalled();
  });
});
