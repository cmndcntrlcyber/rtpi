/**
 * Tests for the SKILL.md → tool_registry.config deriver — the pure parser
 * `parseDerivedToolConfig` and the public entry point's null-fallback
 * behavior. Live reasoning calls are mocked so tests are hermetic.
 *
 * Pins:
 *   - Accepts canonical {baseCommand, parameters[]} shape
 *   - Tolerates markdown fences and trailing prose
 *   - Filters out hallucinated parameters not in allowedKeys
 *   - Coerces unknown types to "string"
 *   - Drops the whole config when both baseCommand and parameters are empty
 *   - deriveToolConfigFromSkill returns null for too-short SKILL.md (no LLM call)
 *   - deriveToolConfigFromSkill returns null when reasoning provider unavailable
 */

import { describe, expect, it, vi } from "vitest";

// Hoisted mocks because vi.mock factories run before imports.
const mocks = vi.hoisted(() => {
  const routeReasoningMock = vi.fn();
  class NoInferenceProviderAvailableMock extends Error {
    attempts: any[] = [];
    kind = "reasoning" as const;
  }
  return { routeReasoningMock, NoInferenceProviderAvailableMock };
});

vi.mock("../../../server/services/inference/inference-router", () => ({
  routeReasoning: mocks.routeReasoningMock,
  NoInferenceProviderAvailable: mocks.NoInferenceProviderAvailableMock,
}));

const { routeReasoningMock, NoInferenceProviderAvailableMock } = mocks;

import {
  deriveToolConfigFromSkill,
  parseDerivedToolConfig,
} from "../../../server/services/tool-config-deriver";

describe("parseDerivedToolConfig", () => {
  it("parses the canonical {baseCommand, parameters[]} shape", () => {
    const text = JSON.stringify({
      baseCommand: "bbot",
      parameters: [{ name: "target", type: "string", flag: "-t", required: true }],
    });
    const out = parseDerivedToolConfig(text, ["target"]);
    expect(out).not.toBeNull();
    expect(out!.baseCommand).toBe("bbot");
    expect(out!.parameters).toEqual([
      { name: "target", type: "string", flag: "-t", positional: false, required: true },
    ]);
  });

  it("strips markdown fences and trailing prose", () => {
    const text = "```json\n" + JSON.stringify({ baseCommand: "nuclei", parameters: [] }) + "\n```\n\nTrailing chatter.";
    const out = parseDerivedToolConfig(text, []);
    expect(out).not.toBeNull();
    expect(out!.baseCommand).toBe("nuclei");
  });

  it("filters out hallucinated parameters not in allowedKeys", () => {
    const text = JSON.stringify({
      baseCommand: "nmap",
      parameters: [
        { name: "target", type: "string", positional: true },
        { name: "output", type: "string", flag: "-oN" }, // hallucinated
      ],
    });
    const out = parseDerivedToolConfig(text, ["target"]);
    expect(out!.parameters).toHaveLength(1);
    expect(out!.parameters[0].name).toBe("target");
  });

  it("coerces unknown types to 'string'", () => {
    const text = JSON.stringify({
      baseCommand: "x",
      parameters: [{ name: "target", type: "weirdtype" }],
    });
    const out = parseDerivedToolConfig(text, ["target"]);
    expect(out!.parameters[0].type).toBe("string");
  });

  it("returns null when both baseCommand and parameters are empty", () => {
    const text = JSON.stringify({ baseCommand: "", parameters: [] });
    expect(parseDerivedToolConfig(text, ["target"])).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(parseDerivedToolConfig("nope", ["target"])).toBeNull();
    expect(parseDerivedToolConfig("", ["target"])).toBeNull();
    expect(parseDerivedToolConfig("{ broken json", ["target"])).toBeNull();
  });

  it("accepts a config with only parameters (no baseCommand)", () => {
    const text = JSON.stringify({
      baseCommand: "",
      parameters: [{ name: "target", type: "string", positional: true }],
    });
    const out = parseDerivedToolConfig(text, ["target"]);
    expect(out).not.toBeNull();
    expect(out!.baseCommand).toBe("");
    expect(out!.parameters[0].positional).toBe(true);
  });

  it("accepts a config with only baseCommand (no params)", () => {
    const text = JSON.stringify({ baseCommand: "help", parameters: [] });
    const out = parseDerivedToolConfig(text, []);
    expect(out).not.toBeNull();
    expect(out!.baseCommand).toBe("help");
    expect(out!.parameters).toEqual([]);
  });
});

describe("deriveToolConfigFromSkill", () => {
  it("returns null without calling the reasoning model for short SKILL.md", async () => {
    routeReasoningMock.mockReset();
    const out = await deriveToolConfigFromSkill({
      toolId: "bbot",
      toolName: "Bbot",
      skillBody: "too short",
      agentInputs: { target: "x" },
    });
    expect(out).toBeNull();
    expect(routeReasoningMock).not.toHaveBeenCalled();
  });

  it("returns null and does not throw when the reasoning provider is unavailable", async () => {
    routeReasoningMock.mockReset();
    routeReasoningMock.mockRejectedValueOnce(new NoInferenceProviderAvailableMock("exhausted"));
    const out = await deriveToolConfigFromSkill({
      toolId: "bbot",
      toolName: "Bbot",
      skillBody: "x".repeat(200), // long enough to pass the MIN_SKILL_BYTES gate
      agentInputs: { target: "x" },
    });
    expect(out).toBeNull();
  });

  it("returns the derived config on a clean model response", async () => {
    routeReasoningMock.mockReset();
    routeReasoningMock.mockResolvedValueOnce({
      response: {
        text: JSON.stringify({
          baseCommand: "bbot",
          parameters: [{ name: "target", type: "string", flag: "-t", required: true }],
        }),
      },
      provider: "anthropic",
      model: "test",
      source: "settings_kind",
      attempts: [],
    });
    const out = await deriveToolConfigFromSkill({
      toolId: "bbot",
      toolName: "Bbot",
      skillBody: "x".repeat(200),
      agentInputs: { target: "example.com" },
    });
    expect(out).not.toBeNull();
    expect(out!.baseCommand).toBe("bbot");
    expect(out!.parameters[0].flag).toBe("-t");
  });
});
