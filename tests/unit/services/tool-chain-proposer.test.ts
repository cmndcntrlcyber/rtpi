/**
 * Tests for parseChainProposalJson — the tolerant parser that turns the
 * reasoning model's chain-proposal reply into ranked ChainProposal[].
 *
 * Pins:
 *   - Filters out proposals naming tools the agent doesn't have
 *   - Maps 1-based finding indices back to the source findings
 *   - Clamps confidence to [0, 1], defaults to 0.5 when missing
 *   - Sorts by confidence desc (stable on ties)
 *   - Handles bare arrays, markdown fences, empty input → []
 *   - Caps at maxProposals
 */

import { describe, expect, it } from "vitest";

import { parseChainProposalJson } from "../../../server/services/agents/tool-chain-proposer";
import type { Finding } from "../../../server/services/agents/tool-execution-loop";

const candidates = [
  { toolId: "nuclei", name: "Nuclei", registry: "registry" as const, skillBody: null },
  { toolId: "httpx", name: "Httpx", registry: "registry" as const, skillBody: null },
];

const findings: Finding[] = [
  { kind: "host", value: "10.0.0.1" },
  { kind: "url", value: "https://example.com" },
];

describe("parseChainProposalJson", () => {
  it("parses the canonical {proposals:[...]} shape", () => {
    const text = JSON.stringify({
      proposals: [
        { tool: "nuclei", args: ["-u", "https://example.com"], rationale: "vuln scan the URL", consumesFindings: [2], confidence: 0.9 },
        { tool: "httpx", args: ["-l", "hosts.txt"], rationale: "probe hosts", consumesFindings: [1], confidence: 0.6 },
      ],
    });
    const out = parseChainProposalJson(text, candidates, findings, 5);
    expect(out).toHaveLength(2);
    expect(out[0].tool).toBe("nuclei");
    expect(out[0].consumedFindings).toEqual([findings[1]]);
    expect(out[1].tool).toBe("httpx");
    expect(out[1].consumedFindings).toEqual([findings[0]]);
  });

  it("drops proposals naming tools the agent does not have", () => {
    const text = JSON.stringify({
      proposals: [
        { tool: "nuclei", args: [], rationale: "ok", confidence: 0.8 },
        { tool: "metasploit", args: [], rationale: "not on the list", confidence: 0.9 },
      ],
    });
    const out = parseChainProposalJson(text, candidates, findings, 5);
    expect(out).toHaveLength(1);
    expect(out[0].tool).toBe("nuclei");
  });

  it("sorts by confidence descending", () => {
    const text = JSON.stringify({
      proposals: [
        { tool: "nuclei", args: [], rationale: "a", confidence: 0.3 },
        { tool: "httpx", args: [], rationale: "b", confidence: 0.95 },
      ],
    });
    const out = parseChainProposalJson(text, candidates, findings, 5);
    expect(out[0].tool).toBe("httpx");
    expect(out[1].tool).toBe("nuclei");
  });

  it("clamps confidence to [0, 1] and defaults missing to 0.5", () => {
    const text = JSON.stringify({
      proposals: [
        { tool: "nuclei", args: [], rationale: "a", confidence: 99 },
        { tool: "httpx", args: [], rationale: "b" }, // missing confidence
      ],
    });
    const out = parseChainProposalJson(text, candidates, findings, 5);
    const nuclei = out.find((p) => p.tool === "nuclei")!;
    const httpx = out.find((p) => p.tool === "httpx")!;
    expect(nuclei.confidence).toBe(1);
    expect(httpx.confidence).toBe(0.5);
  });

  it("accepts a bare array", () => {
    const text = JSON.stringify([{ tool: "nuclei", args: [], rationale: "x", confidence: 0.5 }]);
    const out = parseChainProposalJson(text, candidates, findings, 5);
    expect(out).toHaveLength(1);
  });

  it("strips markdown code fences", () => {
    const text = "```json\n" + JSON.stringify({ proposals: [{ tool: "nuclei", args: [], rationale: "x" }] }) + "\n```";
    const out = parseChainProposalJson(text, candidates, findings, 5);
    expect(out).toHaveLength(1);
    expect(out[0].tool).toBe("nuclei");
  });

  it("caps at maxProposals", () => {
    const many = Array.from({ length: 8 }, () => ({ tool: "nuclei", args: [], rationale: "x", confidence: 0.5 }));
    const out = parseChainProposalJson(JSON.stringify({ proposals: many }), candidates, findings, 3);
    expect(out).toHaveLength(3);
  });

  it("returns [] on garbage", () => {
    expect(parseChainProposalJson("nope", candidates, findings, 5)).toEqual([]);
    expect(parseChainProposalJson("", candidates, findings, 5)).toEqual([]);
    expect(parseChainProposalJson(JSON.stringify({}), candidates, findings, 5)).toEqual([]);
  });

  it("drops proposals missing a rationale", () => {
    const text = JSON.stringify({
      proposals: [
        { tool: "nuclei", args: [], rationale: "good one" },
        { tool: "httpx", args: [] }, // no rationale
      ],
    });
    const out = parseChainProposalJson(text, candidates, findings, 5);
    expect(out).toHaveLength(1);
    expect(out[0].tool).toBe("nuclei");
  });
});
