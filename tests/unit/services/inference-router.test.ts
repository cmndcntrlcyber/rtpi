/**
 * Tests for the inference router — fallback semantics with mocked executor.
 *
 * We mock the `executor` module so the router's behavior is exercised
 * without any SDK or HTTP calls. Each test sets up cache state, a sequence
 * of mocked outcomes per (provider, model), and asserts which target the
 * router lands on plus the attempts trail.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../server/services/inference/executor", () => {
  return {
    executeChat: vi.fn(),
    executeEmbedding: vi.fn(),
  };
});

vi.mock("../../../server/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
  },
}));

import { modelCache } from "../../../server/services/inference/model-cache";
import {
  NoInferenceProviderAvailable,
  routeAgent,
  routeEmbedding,
  routeReasoning,
} from "../../../server/services/inference/inference-router";
import { executeChat, executeEmbedding } from "../../../server/services/inference/executor";

const mockedChat = executeChat as unknown as ReturnType<typeof vi.fn>;
const mockedEmbed = executeEmbedding as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  modelCache.clear();
  mockedChat.mockReset();
  mockedEmbed.mockReset();
  // Settings defaults blank → resolver walks provider defaults.
  delete process.env.DEFAULT_MODEL;
  delete process.env.DEFAULT_AGENT_MODEL;
  delete process.env.DEFAULT_REASONING_MODEL;
  delete process.env.EMBEDDING_MODEL;
});

afterEach(() => {
  modelCache.clear();
});

describe("routeAgent — happy path", () => {
  it("calls the first resolvable target and returns its response", async () => {
    process.env.DEFAULT_AGENT_MODEL = "claude-sonnet-4-5";
    modelCache.__setForTests("anthropic", ["claude-sonnet-4-5"]);
    mockedChat.mockResolvedValueOnce({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      text: "hi",
      raw: {},
    });

    const result = await routeAgent({ messages: [{ role: "user", content: "hello" }] });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-sonnet-4-5");
    expect(result.source).toBe("settings_kind");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].outcome).toBe("success");
    expect(mockedChat).toHaveBeenCalledTimes(1);
  });
});

describe("routeAgent — model-cache fallthrough", () => {
  it("skips a target when the model is missing from the provider cache", async () => {
    process.env.DEFAULT_AGENT_MODEL = "gpt-9000-fictional";
    modelCache.__setForTests("openai", ["gpt-4o-mini"]); // knows openai, but not gpt-9000
    // Ollama cache left unset → "unknown" → checkCache returns "use" so the
    // next reachable target is the ollama provider_default (chain is now
    // ollama-first; vllm-last).
    mockedChat.mockResolvedValueOnce({
      provider: "ollama",
      model: "llama3:8b",
      text: "fallback",
      raw: {},
    });

    const result = await routeAgent({ messages: [{ role: "user", content: "x" }] });

    // First target was openai/gpt-9000-fictional — skipped (not in cache).
    expect(result.attempts[0].outcome).toBe("skipped_not_in_cache");
    expect(result.attempts[0].provider).toBe("openai");
    expect(result.ok).toBe(true);
    // Next reachable target lands on ollama (first in the provider_default chain).
    expect(result.provider).toBe("ollama");
  });
});

describe("routeAgent — error fallthrough", () => {
  it("walks past targets that throw and surfaces the first that succeeds", async () => {
    // Cache is empty for every provider → all "unknown" → router trusts the
    // name and calls executeChat. New chain is ollama-first, so target[0] is
    // ollama (rejects), target[1] is anthropic (resolves).
    mockedChat
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce({
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        text: "ok",
        raw: {},
      });

    const result = await routeAgent({ messages: [{ role: "user", content: "x" }] });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("anthropic");
    expect(result.attempts.length).toBeGreaterThanOrEqual(2);
    expect(result.attempts[0].provider).toBe("ollama");
    expect(result.attempts[0].outcome).toBe("error");
    expect(result.attempts[0].error).toContain("rate limited");
  });
});

describe("routeAgent — exhaustion", () => {
  it("throws NoInferenceProviderAvailable when every target fails", async () => {
    mockedChat.mockRejectedValue(new Error("nope"));

    await expect(routeAgent({ messages: [{ role: "user", content: "x" }] })).rejects.toBeInstanceOf(
      NoInferenceProviderAvailable,
    );
  });
});

describe("routeReasoning", () => {
  it("uses DEFAULT_REASONING_MODEL first", async () => {
    process.env.DEFAULT_REASONING_MODEL = "claude-sonnet-4-5";
    modelCache.__setForTests("anthropic", ["claude-sonnet-4-5"]);
    mockedChat.mockResolvedValueOnce({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      text: "reason",
      raw: {},
    });

    const result = await routeReasoning({ messages: [{ role: "user", content: "think" }] });

    expect(result.source).toBe("settings_kind");
    expect(result.model).toBe("claude-sonnet-4-5");
  });
});

describe("routeEmbedding", () => {
  it("respects EMBEDDING_MODEL setting and skips Anthropic", async () => {
    process.env.EMBEDDING_MODEL = "text-embedding-3-small";
    modelCache.__setForTests("openai", ["text-embedding-3-small"]);
    mockedEmbed.mockResolvedValueOnce({
      provider: "openai",
      model: "text-embedding-3-small",
      vectors: [[0.1, 0.2]],
      raw: {},
    });

    const result = await routeEmbedding({ input: "hello" });

    expect(result.provider).toBe("openai");
    expect(result.attempts.find((a) => a.provider === "anthropic")).toBeUndefined();
  });
});
