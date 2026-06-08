/**
 * Tests for enqueueSkillGeneration — the fire-and-forget wrapper called by
 * tool-registry-manager, mcp-server-manager, catalog-sync, and POST /tools.
 *
 * Pins: install hooks must return immediately (never block on Tavily / LLM)
 * and must be a no-op when FF_TOOL_SKILL_GENERATION is off so a misconfigured
 * deploy can't silently rack up API spend.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueSkillGeneration } from "../../../server/services/skill-generator";

let originalFlag: string | undefined;

beforeEach(() => {
  originalFlag = process.env.FF_TOOL_SKILL_GENERATION;
  vi.useFakeTimers();
});

afterEach(() => {
  if (originalFlag === undefined) delete process.env.FF_TOOL_SKILL_GENERATION;
  else process.env.FF_TOOL_SKILL_GENERATION = originalFlag;
  vi.useRealTimers();
});

describe("enqueueSkillGeneration", () => {
  it("returns synchronously without scheduling anything when the flag is off", () => {
    delete process.env.FF_TOOL_SKILL_GENERATION;
    const before = vi.getTimerCount();
    enqueueSkillGeneration("mcp", "some-id");
    expect(vi.getTimerCount()).toBe(before);
  });

  it("schedules a deferred generator when the flag is on", () => {
    process.env.FF_TOOL_SKILL_GENERATION = "true";
    enqueueSkillGeneration("mcp", "some-id");
    // setTimeout(..., 1000) — matches the existing fire-and-forget pattern
    // at mcp-server-manager.ts:45. We don't assert exact timing, only that
    // a timer was queued; install paths must never await the work.
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });
});
