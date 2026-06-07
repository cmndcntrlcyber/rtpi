/**
 * Tests for the inference model-cache — TTL, manual invalidation, and
 * the "isUnknown vs isAvailable" contract the router relies on.
 *
 * Uses __setForTests / clear so we never touch the real probe path.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { modelCache } from "../../../server/services/inference/model-cache";

beforeEach(() => {
  modelCache.clear();
  modelCache.setTtl(5 * 60_000);
});

afterEach(() => {
  modelCache.clear();
});

describe("modelCache.isAvailable / isUnknown", () => {
  it("returns isUnknown=true when no probe has run", () => {
    expect(modelCache.isUnknown("anthropic")).toBe(true);
    expect(modelCache.isAvailable("anthropic", "claude-sonnet-4-5")).toBe(false);
  });

  it("returns isAvailable=true when probe succeeded and model is present", () => {
    modelCache.__setForTests("anthropic", ["claude-sonnet-4-5", "claude-opus-4"]);
    expect(modelCache.isAvailable("anthropic", "claude-sonnet-4-5")).toBe(true);
    expect(modelCache.isUnknown("anthropic")).toBe(false);
  });

  it("returns isAvailable=false when model is not in the cached list", () => {
    modelCache.__setForTests("anthropic", ["claude-sonnet-4-5"]);
    expect(modelCache.isAvailable("anthropic", "claude-opus-99")).toBe(false);
    expect(modelCache.isUnknown("anthropic")).toBe(false);
  });

  it("treats stale cache as unknown (router will trust the name)", () => {
    modelCache.setTtl(10); // 10 ms
    modelCache.__setForTests("ollama", ["llama3:8b"], { lastSuccessAt: Date.now() - 60_000 });
    expect(modelCache.isUnknown("ollama")).toBe(true);
    expect(modelCache.isAvailable("ollama", "llama3:8b")).toBe(false);
  });

  it("treats failed-probe cache as unknown", () => {
    modelCache.ingestProbe("openai", { ok: false, durationMs: 1, error: "key invalid" });
    expect(modelCache.isUnknown("openai")).toBe(true);
  });
});

describe("modelCache.snapshot and list", () => {
  it("returns sorted lowercased model names", () => {
    modelCache.__setForTests("ollama", ["LLaMA3:8b", "qwen2.5-coder:7b"]);
    expect(modelCache.list("ollama")).toEqual(["llama3:8b", "qwen2.5-coder:7b"]);
  });

  it("snapshot includes lastProbeOk + lastError", () => {
    modelCache.__setForTests("openai", ["gpt-4o-mini"]);
    modelCache.ingestProbe("anthropic", { ok: false, durationMs: 5, error: "no key" });
    const snap = modelCache.snapshot();
    expect(snap.openai.lastProbeOk).toBe(true);
    expect(snap.openai.models).toEqual(["gpt-4o-mini"]);
    expect(snap.anthropic.lastProbeOk).toBe(false);
    expect(snap.anthropic.lastError).toBe("no key");
  });
});

describe("modelCache.invalidate", () => {
  it("clears only the named provider", () => {
    modelCache.__setForTests("anthropic", ["claude-sonnet-4-5"]);
    modelCache.__setForTests("openai", ["gpt-4o-mini"]);
    modelCache.invalidate("anthropic");
    expect(modelCache.isUnknown("anthropic")).toBe(true);
    expect(modelCache.isAvailable("openai", "gpt-4o-mini")).toBe(true);
  });
});

describe("modelCache.ingestProbe preserves prior list on failure", () => {
  it("keeps the last successful model list when a later probe fails", () => {
    modelCache.__setForTests("ollama", ["llama3:8b"]);
    modelCache.ingestProbe("ollama", { ok: false, durationMs: 1, error: "timeout" });
    // We mark unknown (so router trusts the name) but list is preserved for UI display.
    expect(modelCache.isUnknown("ollama")).toBe(true);
    expect(modelCache.snapshot().ollama.models).toEqual(["llama3:8b"]);
  });
});
