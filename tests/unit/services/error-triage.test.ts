import { describe, it, expect } from "vitest";
import { triageError, formatTriagedError } from "../../../server/services/agents/error-triage";

describe("triageError", () => {
  it("classifies timeout when timedOut is true", () => {
    const result = triageError("", 1, "nmap", true);
    expect(result.errorClass).toBe("timeout");
    expect(result.retryable).toBe(true);
  });

  it("classifies timeout from exit code 124", () => {
    const result = triageError("", 124, "nmap", false);
    expect(result.errorClass).toBe("timeout");
  });

  it("classifies network from connection refused", () => {
    const result = triageError("connect ECONNREFUSED 10.0.0.1:443", 1, "nuclei", false);
    expect(result.errorClass).toBe("network");
  });

  it("classifies permission from EACCES", () => {
    const result = triageError("EACCES: permission denied", 1, "nmap", false);
    expect(result.errorClass).toBe("permission");
  });

  it("classifies missing_dep from command not found", () => {
    const result = triageError("bash: nuclei: command not found", 127, "nuclei", false);
    expect(result.errorClass).toBe("missing_dep");
  });

  it("classifies auth from 401", () => {
    const result = triageError("HTTP 401 Unauthorized", 1, "api-client", false);
    expect(result.errorClass).toBe("auth");
  });

  it("classifies runtime from segfault", () => {
    const result = triageError("Segmentation fault (core dumped)", 139, "tool", false);
    expect(result.errorClass).toBe("runtime");
  });

  it("classifies config from invalid option", () => {
    const result = triageError("nmap: unrecognized option '--foo'", 1, "nmap", false);
    expect(result.errorClass).toBe("config");
  });

  it("classifies unknown for unrecognized errors", () => {
    const result = triageError("something weird happened", 1, "tool", false);
    expect(result.errorClass).toBe("unknown");
    expect(result.retryable).toBe(false);
  });
});

describe("formatTriagedError", () => {
  it("includes error class and message", () => {
    const result = triageError("ECONNREFUSED", 1, "nuclei", false);
    const formatted = formatTriagedError(result, "ECONNREFUSED");
    expect(formatted).toContain("[ERROR:");
    expect(formatted).toContain(result.userMessage);
  });

  it("omits Fix line when fixAction is null", () => {
    const result = triageError("something weird happened", 1, "tool", false);
    expect(result.fixAction).toBeNull();
    const formatted = formatTriagedError(result, "something weird happened");
    expect(formatted).not.toContain("Fix:");
  });

  it("truncates raw stderr to 500 chars", () => {
    const longStderr = "x".repeat(1000);
    const result = triageError(longStderr, 1, "tool", false);
    const formatted = formatTriagedError(result, longStderr);
    const rawLine = formatted.split("\n").find((l) => l.startsWith("Raw (truncated):"));
    expect(rawLine).toBeDefined();
    const rawContent = rawLine!.replace("Raw (truncated): ", "");
    expect(rawContent.length).toBeLessThanOrEqual(500);
  });
});
