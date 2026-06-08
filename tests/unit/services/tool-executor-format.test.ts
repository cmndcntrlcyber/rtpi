/**
 * Tests for formatParameter — the function that turns ParameterDef + value
 * into a shell-arg fragment. Verifies the Bug A fix:
 *
 *   - `positional: true`  → bare value, no flag, no quotes
 *   - `flag: "-t"`        → "-t <value>"
 *   - default             → "--<name> <value>"
 *   - boolean / array     → same precedence
 *   - NO literal double-quotes wrap the value (the old bug that left
 *     `"traveler.marriott.com"` in argv)
 */

import { describe, expect, it, vi } from "vitest";

// formatParameter calls into the db only via buildCommand — pulling it
// directly is safe, but tool-executor.ts imports db/runtime modules at top
// level. Mock the heavy deps so the unit test stays hermetic.
vi.mock("../../../server/db", () => ({ db: {} }));
vi.mock("../../../server/services/runtime/container-runtime", () => ({
  containerRuntime: { exec: vi.fn() },
}));
vi.mock("../../../server/services/runtime/error-classifier", () => ({
  ContainerError: class extends Error {},
  classifyContainerError: () => ({ code: "unknown" }),
}));
vi.mock("../../../server/services/docker-executor", () => ({ dockerExecutor: {} }));
vi.mock("../../../server/services/output-parser-manager", () => ({ outputParserManager: { parseOutput: vi.fn() } }));
vi.mock("../../../server/services/tool-registry-manager", () => ({
  getToolByToolId: vi.fn(),
  getToolOutputParser: vi.fn(),
}));
vi.mock("../../../server/validation/tool-config-schema", () => ({
  validateToolExecutionRequest: () => ({ error: null }),
}));

import { formatParameter } from "../../../server/services/tool-executor";

describe("formatParameter — positional", () => {
  it("emits the bare value when positional is true (no flag, no quotes)", () => {
    expect(formatParameter({ name: "target", type: "string", positional: true }, "example.com")).toBe("example.com");
  });

  it("space-joins positional arrays", () => {
    expect(formatParameter({ name: "targets", type: "array", positional: true }, ["a", "b"])).toBe("a b");
  });
});

describe("formatParameter — explicit flag", () => {
  it("uses the explicit flag for string values", () => {
    expect(formatParameter({ name: "target", type: "string", flag: "-t" }, "example.com")).toBe("-t example.com");
  });

  it("uses long-form flags too", () => {
    expect(formatParameter({ name: "url", type: "string", flag: "--url" }, "https://example.com")).toBe(
      "--url https://example.com",
    );
  });

  it("emits just the flag for truthy boolean", () => {
    expect(formatParameter({ name: "verbose", type: "boolean", flag: "-v" }, true)).toBe("-v");
  });

  it("emits empty string for falsy boolean", () => {
    expect(formatParameter({ name: "verbose", type: "boolean", flag: "-v" }, false)).toBe("");
  });

  it("repeats the flag for each array element", () => {
    expect(formatParameter({ name: "host", type: "array", flag: "-H" }, ["a", "b"])).toBe("-H a -H b");
  });
});

describe("formatParameter — legacy default (no flag, not positional)", () => {
  it("falls back to --<name> <value>", () => {
    expect(formatParameter({ name: "target", type: "string" }, "example.com")).toBe("--target example.com");
  });

  it("falls back to --<name> for truthy boolean", () => {
    expect(formatParameter({ name: "silent", type: "boolean" }, true)).toBe("--silent");
  });

  it("falls back to repeated --<name> for arrays", () => {
    expect(formatParameter({ name: "ip", type: "array" }, ["a", "b"])).toBe("--ip a --ip b");
  });
});

describe("formatParameter — no literal quotes (Bug A regression)", () => {
  it("never wraps string values in literal double-quotes", () => {
    const out = formatParameter({ name: "target", type: "string", flag: "-t" }, "traveler.marriott.com");
    expect(out).not.toContain('"');
  });

  it("never wraps positional values in literal double-quotes", () => {
    const out = formatParameter({ name: "target", type: "string", positional: true }, "traveler.marriott.com");
    expect(out).not.toContain('"');
  });
});
