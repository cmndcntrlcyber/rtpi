/**
 * Unit tests for assessToolEvidence — the evidence gate that prevents
 * "exit 0 but no real work" tool runs from counting as success (the
 * architectural hallucinated-success defect; see
 * docs/optimization/proposed-fixes/2026-06-02-p0-stop-fabrication.md).
 */

import { describe, it, expect } from "vitest";
import {
  assessToolEvidence,
  MIN_EVIDENCE_BYTES,
} from "../../../server/services/tool-evidence";

const MSF_SPLASH = `
       =[ metasploit v6.3.55-dev                          ]
+ -- --=[ 2398 exploits - 1235 auxiliary - 422 post       ]
+ -- --=[ 1391 payloads - 46 encoders - 11 nops           ]
msf6 >
`;

describe("assessToolEvidence", () => {
  it("flags the exact bare-target stub bug (command === target)", () => {
    const r = assessToolEvidence("openapi.starbucks.com", "openapi.starbucks.com", MSF_SPLASH, null);
    expect(r.hasEvidence).toBe(false);
    expect(r.reason).toMatch(/bare target/i);
  });

  it("flags the msfconsole banner even when the binary is prepended", () => {
    // result.command includes the binary, so command !== target; the banner
    // signature must still catch it.
    const r = assessToolEvidence("msfconsole openapi.starbucks.com", "openapi.starbucks.com", MSF_SPLASH, null);
    expect(r.hasEvidence).toBe(false);
    expect(r.reason).toMatch(/banner/i);
  });

  it("flags the no-target-supplied sentinel command", () => {
    const r = assessToolEvidence("# no-target-supplied for metasploit", null, "", null);
    expect(r.hasEvidence).toBe(false);
    expect(r.reason).toMatch(/sentinel/i);
  });

  it("flags the no-target-supplied sentinel when prefixed with binaryPath", () => {
    const r = assessToolEvidence("msfconsole # no-target-supplied for metasploit", null, "", null);
    expect(r.hasEvidence).toBe(false);
    expect(r.reason).toMatch(/sentinel/i);
  });

  it("treats structured parsedOutput as real evidence", () => {
    const r = assessToolEvidence("nmap -sV 10.0.0.1", "10.0.0.1", "", { ports: [{ port: 22, service: "ssh" }] });
    expect(r.hasEvidence).toBe(true);
    expect(r.reason).toMatch(/structured/i);
  });

  it("treats an honest empty scan with substantive output as real evidence", () => {
    // nmap finding nothing is a REAL result, not a fabrication — must not be flagged.
    const nmapEmpty =
      "Starting Nmap 7.94 ( https://nmap.org )\n" +
      "Nmap scan report for 10.0.0.1\nHost seems down. If it is really up, but blocking ping probes, try -Pn.\n" +
      "Nmap done: 1 IP address (0 hosts up) scanned in 3.21 seconds";
    const r = assessToolEvidence("nmap 10.0.0.1", "10.0.0.1", nmapEmpty, null);
    expect(r.hasEvidence).toBe(true);
  });

  it("flags trivially short unstructured output", () => {
    const r = assessToolEvidence("sometool host", "host", "ok", null);
    expect(r.hasEvidence).toBe(false);
    expect(r.reason).toMatch(/too short/i);
  });

  it("accepts output at/above the minimum-evidence threshold", () => {
    const out = "x".repeat(MIN_EVIDENCE_BYTES);
    const r = assessToolEvidence("sometool host", "host", out, null);
    expect(r.hasEvidence).toBe(true);
  });

  it("does not flag long real output that merely mentions metasploit in passing", () => {
    const longReport =
      "Vulnerability report for host 10.0.0.5:\n" +
      "Finding 1: outdated OpenSSH banner detected on port 22.\n".repeat(40) +
      "Recommendation: validate exploitability with metasploit module exploit/...\n";
    const r = assessToolEvidence("scanner 10.0.0.5", "10.0.0.5", longReport, null);
    expect(r.hasEvidence).toBe(true);
  });

  it("handles null/undefined inputs without throwing", () => {
    const r = assessToolEvidence(undefined, undefined, undefined, undefined);
    expect(r.hasEvidence).toBe(false);
  });
});
