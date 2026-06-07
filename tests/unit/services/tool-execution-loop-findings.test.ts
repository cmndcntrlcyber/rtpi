/**
 * Tests for parseFindingJson — the tolerant parser that turns the reasoning
 * model's finding-extraction reply into a typed Finding[].
 *
 * Pins: handles canonical `{findings: [...]}`, bare arrays, markdown-fenced
 * payloads, unknown kinds (coerced to "other"), missing values (dropped),
 * caps at 5 findings, returns [] on garbage.
 */

import { describe, expect, it } from "vitest";

// Minimal stub for the services this module imports transitively, so we
// don't need a live db / file system to test the pure parser.
import { parseFindingJson } from "../../../server/services/agents/tool-execution-loop";

describe("parseFindingJson", () => {
  it("parses the canonical {findings: [...]} shape", () => {
    const out = parseFindingJson(
      JSON.stringify({
        findings: [
          { kind: "host", value: "10.0.0.1", evidence: "responded to ping" },
          { kind: "url", value: "https://example.com/admin" },
        ],
      }),
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ kind: "host", value: "10.0.0.1", evidence: "responded to ping" });
    expect(out[1]).toEqual({ kind: "url", value: "https://example.com/admin", evidence: undefined });
  });

  it("accepts a bare array", () => {
    const out = parseFindingJson(JSON.stringify([{ kind: "vulnerability", value: "CVE-2024-0001" }]));
    expect(out).toEqual([{ kind: "vulnerability", value: "CVE-2024-0001", evidence: undefined }]);
  });

  it("strips markdown code fences", () => {
    const out = parseFindingJson("```json\n" + JSON.stringify({ findings: [{ kind: "asset", value: "ec2-i-abc" }] }) + "\n```");
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("asset");
  });

  it("coerces unknown kinds to 'other'", () => {
    const out = parseFindingJson(JSON.stringify({ findings: [{ kind: "weird-kind", value: "x" }] }));
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("other");
  });

  it("drops entries with empty or missing value", () => {
    const out = parseFindingJson(
      JSON.stringify({
        findings: [
          { kind: "host", value: "" },
          { kind: "host" },
          { kind: "host", value: "10.0.0.2" },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("10.0.0.2");
  });

  it("caps at 5 findings", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ kind: "host", value: `10.0.0.${i}` }));
    const out = parseFindingJson(JSON.stringify({ findings: many }));
    expect(out).toHaveLength(5);
  });

  it("returns [] for unparseable text", () => {
    expect(parseFindingJson("nope")).toEqual([]);
    expect(parseFindingJson("")).toEqual([]);
    expect(parseFindingJson("{ broken json")).toEqual([]);
  });

  it("returns [] when findings field is missing/empty", () => {
    expect(parseFindingJson(JSON.stringify({ findings: [] }))).toEqual([]);
    expect(parseFindingJson(JSON.stringify({}))).toEqual([]);
  });
});
