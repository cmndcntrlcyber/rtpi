import { describe, it, expect } from "vitest";
import { reviewCompletion } from "../../../server/services/agents/completion-reviewer";

const mockIteration = (toolUsed: string | null, exitCode: number) => ({
  toolUsed,
  executionResult: exitCode !== null ? { exitCode } : null,
});

const mockFinding = (kind: string, value: string) => ({ kind, value });

describe("reviewCompletion", () => {
  it("rejects when no tools executed", () => {
    const result = reviewCompletion({
      iterations: [],
      findings: [],
      objective: "scan the target",
      toolsUsed: [],
      availableTools: [{ toolId: "nmap" }],
    });
    expect(result.accepted).toBe(false);
    expect(result.requiredActions).toBeDefined();
    expect(result.requiredActions!.some((a) => a.includes("Execute at least one tool"))).toBe(true);
  });

  it("rejects when no tools succeeded", () => {
    const result = reviewCompletion({
      iterations: [mockIteration("nmap", 1), mockIteration("nuclei", 1)],
      findings: [],
      objective: "scan the target",
      toolsUsed: ["nmap", "nuclei"],
      availableTools: [{ toolId: "nmap" }, { toolId: "nuclei" }],
    });
    expect(result.accepted).toBe(false);
  });

  it("rejects discovery objective with zero findings", () => {
    const result = reviewCompletion({
      iterations: [mockIteration("nmap", 0), mockIteration("nuclei", 0)],
      findings: [],
      objective: "scan the target",
      toolsUsed: ["nmap", "nuclei"],
      availableTools: [{ toolId: "nmap" }, { toolId: "nuclei" }],
    });
    expect(result.accepted).toBe(false);
    expect(result.requiredActions!.some((a) => /finding/i.test(a))).toBe(true);
  });

  it("rejects when fewer than 2 iterations", () => {
    const result = reviewCompletion({
      iterations: [mockIteration("nmap", 0)],
      findings: [mockFinding("host", "10.0.0.1")],
      objective: "scan the target",
      toolsUsed: ["nmap"],
      availableTools: [{ toolId: "nmap" }],
    });
    expect(result.accepted).toBe(false);
  });

  it("accepts with strong evidence", () => {
    const result = reviewCompletion({
      iterations: [
        mockIteration("nmap", 0),
        mockIteration("nuclei", 0),
        mockIteration("bbot", 0),
      ],
      findings: [
        mockFinding("host", "10.0.0.1"),
        mockFinding("vulnerability", "CVE-2024-1234"),
        mockFinding("url", "https://target.com/admin"),
      ],
      objective: "scan the target",
      toolsUsed: ["nmap", "nuclei", "bbot"],
      availableTools: [{ toolId: "nmap" }, { toolId: "nuclei" }, { toolId: "bbot" }],
    });
    expect(result.accepted).toBe(true);
    expect(result.evidence.evidenceStrength).toBe("strong");
  });

  it("accepts with moderate evidence", () => {
    const result = reviewCompletion({
      iterations: [
        mockIteration("nmap", 0),
        mockIteration("nuclei", 0),
      ],
      findings: [
        mockFinding("host", "10.0.0.1"),
        mockFinding("url", "https://target.com"),
      ],
      objective: "scan the target",
      toolsUsed: ["nmap", "nuclei"],
      availableTools: [{ toolId: "nmap" }, { toolId: "nuclei" }],
    });
    expect(result.accepted).toBe(true);
    expect(result.evidence.evidenceStrength).toBe("moderate");
  });

  it("computes coverage metrics correctly", () => {
    const result = reviewCompletion({
      iterations: [
        mockIteration("nmap", 0),
        mockIteration("nuclei", 0),
      ],
      findings: [mockFinding("host", "10.0.0.1"), mockFinding("url", "https://target.com")],
      objective: "scan the target",
      toolsUsed: ["nmap", "nuclei"],
      availableTools: [{ toolId: "nmap" }, { toolId: "nuclei" }, { toolId: "bbot" }],
    });
    expect(result.evidence.coverageMetrics.coverageRatio).toBeCloseTo(2 / 3);
  });

  it("non-discovery objective accepts without findings", () => {
    const result = reviewCompletion({
      iterations: [
        mockIteration("writer", 0),
        mockIteration("reporter", 0),
      ],
      findings: [],
      objective: "document the infrastructure",
      toolsUsed: ["writer", "reporter"],
      availableTools: [{ toolId: "writer" }, { toolId: "reporter" }],
    });
    expect(result.accepted).toBe(true);
  });
});
