import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../server/db", () => ({
  db: { execute: vi.fn().mockResolvedValue({ rows: [] }) },
}));

vi.mock("../../../server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { Revalidator } from "../../../server/services/agents/revalidator";

let revalidator: Revalidator;

beforeEach(() => {
  vi.clearAllMocks();
  revalidator = new Revalidator();
});

describe("Revalidator", () => {
  it("returns true_positive for findings with strong evidence", async () => {
    const result = await revalidator.revalidate(
      {
        kind: "vulnerability",
        value: "CVE-2024-1234",
        evidence: "Confirmed via nuclei scan with PoC",
      },
      { operationId: "op1" }
    );
    expect(result.verdict).toBe("true_positive");
  });

  it("returns uncertain for findings without evidence", async () => {
    const result = await revalidator.revalidate(
      { kind: "host", value: "10.0.0.1" },
      { operationId: "op1" }
    );
    expect(result.verdict).toBe("uncertain");
  });

  it("deduplicateFindings removes duplicates", () => {
    const results = [
      {
        finding: { kind: "host", value: "server at 10.0.0.1 running nginx" },
        verdict: "true_positive" as const,
        confidence: 0.8,
        reason: "confirmed",
      },
      {
        finding: { kind: "host", value: "server at 10.0.0.1 running nginx webserver" },
        verdict: "true_positive" as const,
        confidence: 0.8,
        reason: "confirmed",
      },
    ];
    const deduped = revalidator.deduplicateFindings(results);
    expect(deduped.length).toBeLessThan(results.length);
  });

  it("revalidateBatch processes all findings", async () => {
    const findings = [
      { kind: "host", value: "10.0.0.1" },
      { kind: "vulnerability", value: "CVE-2024-5678", evidence: "Exploit confirmed in nuclei output" },
      { kind: "url", value: "http://target.local/admin" },
    ];
    const results = await revalidator.revalidateBatch(findings, { operationId: "op1" });
    expect(results.length).toBe(3);
  });
});
