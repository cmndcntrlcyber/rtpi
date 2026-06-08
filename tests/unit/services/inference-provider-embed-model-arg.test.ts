/**
 * Tests for the §2 defense-in-depth — each provider's `embed()` now accepts
 * an optional `model` arg that wins over `process.env.EMBEDDING_MODEL`,
 * which in turn wins over the provider's hard-coded default.
 *
 * This is what prevents the cross-provider leak: when the router resolves
 * a target like `{ provider: "openai", model: "text-embedding-3-small" }`,
 * the openai provider receives `text-embedding-3-small` regardless of what
 * `EMBEDDING_MODEL` happens to be set to.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Hoist the mocks so vi.mock factories can see them.
const mocks = vi.hoisted(() => ({
  openaiCreateMock: vi.fn(),
  vllmEmbedMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("../../../server/services/ai-clients", () => ({
  getOpenAIClient: () => ({
    embeddings: { create: mocks.openaiCreateMock },
  }),
  getAnthropicClient: () => null,
}));

vi.mock("../../../server/services/inference/vllm-client", async () => {
  const actual = await vi.importActual<any>("../../../server/services/inference/vllm-client");
  return {
    ...actual,
    vllmEmbed: mocks.vllmEmbedMock,
  };
});

vi.mock("../../../server/services/ollama-manager", () => ({
  ollamaManager: { listModelsFromAPI: async () => [] },
}));

const { openaiCreateMock, vllmEmbedMock, fetchMock } = mocks;

import { inferenceProviderRegistry } from "../../../server/services/inference/inference-provider-registry";

beforeEach(() => {
  openaiCreateMock.mockReset().mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] });
  vllmEmbedMock.mockReset().mockResolvedValue({ data: [{ embedding: [0.3, 0.4] }] });
  fetchMock.mockReset();
  delete process.env.EMBEDDING_MODEL;
  delete process.env.VLLM_EMBED_MODEL;
});

afterEach(() => {
  delete process.env.EMBEDDING_MODEL;
  delete process.env.VLLM_EMBED_MODEL;
});

describe("OpenAIProvider.embed — precedence", () => {
  it("uses the explicit model arg over EMBEDDING_MODEL env", async () => {
    process.env.EMBEDDING_MODEL = "env-model";
    const provider = inferenceProviderRegistry.get("openai")!;
    await provider.embed!(["hi"], "explicit-model");
    expect(openaiCreateMock).toHaveBeenCalledWith({ model: "explicit-model", input: ["hi"] });
  });

  it("uses EMBEDDING_MODEL when no arg passed", async () => {
    process.env.EMBEDDING_MODEL = "env-model";
    const provider = inferenceProviderRegistry.get("openai")!;
    await provider.embed!(["hi"]);
    expect(openaiCreateMock).toHaveBeenCalledWith({ model: "env-model", input: ["hi"] });
  });

  it("falls back to text-embedding-3-small when no arg and no env", async () => {
    const provider = inferenceProviderRegistry.get("openai")!;
    await provider.embed!(["hi"]);
    expect(openaiCreateMock).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: ["hi"],
    });
  });
});

describe("VllmProvider.embed — precedence", () => {
  it("uses the explicit model arg over EMBEDDING_MODEL env", async () => {
    process.env.EMBEDDING_MODEL = "env-model";
    const provider = inferenceProviderRegistry.get("vllm")!;
    await provider.embed!(["hi"], "explicit-model");
    expect(vllmEmbedMock).toHaveBeenCalledWith({ input: ["hi"], model: "explicit-model" });
  });

  it("uses EMBEDDING_MODEL when no arg passed", async () => {
    process.env.EMBEDDING_MODEL = "env-model";
    const provider = inferenceProviderRegistry.get("vllm")!;
    await provider.embed!(["hi"]);
    expect(vllmEmbedMock).toHaveBeenCalledWith({ input: ["hi"], model: "env-model" });
  });

  it("falls back to embeddinggemma (the embed default) when no arg and no env — NOT the chat default", async () => {
    const provider = inferenceProviderRegistry.get("vllm")!;
    await provider.embed!(["hi"]);
    expect(vllmEmbedMock).toHaveBeenCalledWith({ input: ["hi"], model: "embeddinggemma" });
    // Regression guard: NEVER Qwen/Qwen3.5-9B (a chat model).
    const callArg = vllmEmbedMock.mock.calls[0][0];
    expect(callArg.model).not.toContain("Qwen");
  });

  it("VLLM_EMBED_MODEL env wins over the hard-coded default", async () => {
    process.env.VLLM_EMBED_MODEL = "custom-vllm-embed";
    const provider = inferenceProviderRegistry.get("vllm")!;
    await provider.embed!(["hi"]);
    expect(vllmEmbedMock).toHaveBeenCalledWith({ input: ["hi"], model: "custom-vllm-embed" });
  });
});

describe("OllamaProvider.embed — precedence", () => {
  beforeEach(() => {
    // Stub global fetch so we can assert what model the provider posted.
    globalThis.fetch = fetchMock as any;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [[0.5, 0.6]] }),
    });
  });

  it("uses the explicit model arg over EMBEDDING_MODEL env", async () => {
    process.env.EMBEDDING_MODEL = "env-model";
    const provider = inferenceProviderRegistry.get("ollama")!;
    await provider.embed!(["hi"], "explicit-model");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("explicit-model");
  });

  it("uses EMBEDDING_MODEL when no arg passed", async () => {
    process.env.EMBEDDING_MODEL = "env-model";
    const provider = inferenceProviderRegistry.get("ollama")!;
    await provider.embed!(["hi"]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("env-model");
  });

  it("falls back to nomic-embed-text:latest when no arg and no env", async () => {
    const provider = inferenceProviderRegistry.get("ollama")!;
    await provider.embed!(["hi"]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("nomic-embed-text:latest");
  });
});
