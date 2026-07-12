import { describe, it, expect } from "vitest";

import { ContextFramer } from "../../../server/services/agents/context-framer";
import { STAGE_FRAMES } from "../../../server/services/agents/stage-context-frames";

const contextFramer = new ContextFramer();

describe("STAGE_FRAMES", () => {
  it("has all 6 stages", () => {
    const keys = Object.keys(STAGE_FRAMES);
    expect(keys).toContain("scope");
    expect(keys).toContain("recon");
    expect(keys).toContain("hunt");
    expect(keys).toContain("validate");
    expect(keys).toContain("capture");
    expect(keys).toContain("report");
  });

  it("each frame has required fields", () => {
    for (const frame of Object.values(STAGE_FRAMES)) {
      expect(frame.roleDescription).toBeDefined();
      expect(frame.roleDescription.length).toBeGreaterThan(0);
      expect(frame.visibleData).toBeDefined();
      expect(frame.visibleData.length).toBeGreaterThan(0);
      expect(frame.hiddenData).toBeDefined();
      expect(frame.hiddenData.length).toBeGreaterThan(0);
      expect(frame.successCriteria).toBeDefined();
      expect(frame.successCriteria.length).toBeGreaterThan(0);
      expect(frame.antiPatterns).toBeDefined();
      expect(frame.antiPatterns.length).toBeGreaterThan(0);
    }
  });

  it("validate stage hides hunt reasoning", () => {
    expect(STAGE_FRAMES.validate.hiddenData).toContain("hunt_reasoning");
  });
});

describe("ContextFramer.buildFrame", () => {
  it("returns formatted prompt preamble", () => {
    const result = contextFramer.buildFrame("hunt", { operationId: "op1" });
    expect(result).toContain("Your Role");
    expect(result).toContain("Success Criteria");
    expect(result).toContain("Anti-Patterns");
  });

  it("returns empty for unknown stage", () => {
    const result = contextFramer.buildFrame("unknown_stage", { operationId: "op1" });
    expect(result).toBe("");
  });
});

describe("ContextFramer.filterData", () => {
  it("keeps only visible keys", () => {
    const data = {
      single_finding: "xss",
      hunt_reasoning: "tried sqli first",
      other_findings: [{ kind: "host", value: "10.0.0.1" }],
      scope_rules: { exclude: ["*.internal"] },
    };
    const filtered = contextFramer.filterData("validate", data);
    expect(filtered).toHaveProperty("single_finding");
    expect(filtered).toHaveProperty("scope_rules");
    expect(filtered).not.toHaveProperty("hunt_reasoning");
    expect(filtered).not.toHaveProperty("other_findings");
  });

  it("returns full data for unknown stage", () => {
    const fullData = {
      a: 1,
      b: "two",
      c: [3],
    };
    const result = contextFramer.filterData("unknown", fullData);
    expect(result).toEqual(fullData);
  });
});

describe("ContextFramer.getFrame", () => {
  it("returns frame or null", () => {
    expect(contextFramer.getFrame("hunt")).not.toBeNull();
    expect(contextFramer.getFrame("unknown")).toBeNull();
  });
});
