import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { FEATURE_FLAGS } from "@shared/feature-flags";

/**
 * Guardrail for the FF_REQUIRE_TOOL_EVIDENCE class of drift (harness-dmaic-v3
 * P0-2): a flag was consumed via readFeatureFlags(...).requireToolEvidence but
 * never registered in FEATURE_FLAGS, so it silently resolved undefined. These
 * tests keep the registry and .env.example documentation in lockstep.
 */
describe("feature flag registry completeness", () => {
  const envExample = readFileSync(resolve(__dirname, "../../.env.example"), "utf8");
  const flagValues = Object.values(FEATURE_FLAGS);

  it("documents every registered flag in .env.example", () => {
    const undocumented = flagValues.filter(
      (envVar) => !new RegExp(`^${envVar}=`, "m").test(envExample),
    );
    expect(undocumented, `flags missing from .env.example: ${undocumented.join(", ")}`).toEqual([]);
  });

  it("has no duplicate env var mappings", () => {
    const unique = new Set(flagValues);
    expect(unique.size).toBe(flagValues.length);
  });

  it("maps every flag to an FF_-prefixed env var", () => {
    const malformed = flagValues.filter((v) => !v.startsWith("FF_"));
    expect(malformed, `flags not FF_-prefixed: ${malformed.join(", ")}`).toEqual([]);
  });
});
