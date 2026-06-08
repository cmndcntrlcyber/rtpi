import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Static source guards for the exact breakages fixed in harness-dmaic-v3.
 *
 * These are source-text assertions rather than live HTTP tests because the
 * route handlers query Postgres at request time, which is unavailable in the
 * unit (jsdom) test environment. They are intentionally narrow: each asserts
 * the structural property whose absence caused a confirmed defect.
 */
const read = (rel: string) => readFileSync(resolve(__dirname, "../../", rel), "utf8");

describe("agents.ts /:id shadow guard (P1-2)", () => {
  const src = read("server/api/v1/agents.ts");

  it("GET /:id falls through for non-UUID ids so /workflows and /capabilities resolve", () => {
    const handler = src.slice(src.indexOf('router.get("/:id"'));
    // A UUID regex guard followed by next() must appear inside the /:id handler.
    expect(handler).toMatch(/\[0-9a-f\]\{8\}-/i);
    expect(handler.slice(0, 400)).toMatch(/return next\(\)/);
  });

  it("still declares the single-segment routes that /:id would otherwise shadow", () => {
    expect(src).toMatch(/router\.get\("\/workflows"/);
    expect(src).toMatch(/router\.get\("\/capabilities"/);
  });
});

describe("agent-workflows.ts list contract (P0-1)", () => {
  const src = read("server/api/v1/agent-workflows.ts");

  it("GET / responds with a { workflows, count } object", () => {
    expect(src).toMatch(/res\.json\(\{\s*workflows,\s*count:/);
  });

  it("filters the list by operationId", () => {
    expect(src).toMatch(/agentWorkflows\.operationId/);
  });

  it("exposes /tasks-bulk before /:id so it isn't shadowed (P1-3 N+1 fix)", () => {
    const bulkIdx = src.indexOf('router.get("/tasks-bulk"');
    const idIdx = src.indexOf('router.get("/:id"');
    expect(bulkIdx).toBeGreaterThan(-1);
    expect(idIdx).toBeGreaterThan(-1);
    expect(bulkIdx).toBeLessThan(idIdx);
  });
});

describe("EngagementDashboard unwraps the workflows response (P0-1)", () => {
  const src = read("client/src/pages/EngagementDashboard.tsx");

  it("reads res.workflows rather than treating the response as an array", () => {
    expect(src).toMatch(/res\.workflows/);
    // The reverted bug used Array.isArray(res) on the {workflows,count} object.
    expect(src).not.toMatch(/setWorkflows\(Array\.isArray\(res\)/);
  });
});
