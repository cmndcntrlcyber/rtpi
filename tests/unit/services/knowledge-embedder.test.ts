/**
 * Tests for the knowledge embedder — verifies the §1 fix that replaces
 * `Embedder.resolveEmbeddingProvider` with a `routeEmbedding` delegation.
 *
 * Pins:
 *   - Empty input → zero-vector result without touching the router
 *   - Happy path returns vectors/provider/model from the router's success
 *   - `NoInferenceProviderAvailable` → returns `null` (mirrors prior
 *     "no provider" semantics; callers persist row without embedding)
 *   - Dimension mismatch raises `EmbedderError("dimension_mismatch", ...)`
 *   - Generic transport error wraps original message in
 *     `EmbedderError("transport_failed", ...)`
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoist mocks so vi.mock factories see them.
const mocks = vi.hoisted(() => {
  const routeEmbeddingMock = vi.fn();
  class NoInferenceProviderAvailableMock extends Error {
    attempts: any[] = [];
    kind = "embedding" as const;
  }
  return { routeEmbeddingMock, NoInferenceProviderAvailableMock };
});

vi.mock("../../../server/services/inference/inference-router", () => ({
  routeEmbedding: mocks.routeEmbeddingMock,
  NoInferenceProviderAvailable: mocks.NoInferenceProviderAvailableMock,
}));

import {
  embedder,
  EmbedderError,
  EMBEDDING_DIM,
} from "../../../server/services/knowledge/embedder";

const { routeEmbeddingMock, NoInferenceProviderAvailableMock } = mocks;

function vectors(dim: number, count = 1): number[][] {
  return Array.from({ length: count }, () => new Array(dim).fill(0.1));
}

beforeEach(() => {
  routeEmbeddingMock.mockReset();
});

describe("empty input", () => {
  it("returns a zero-vector result without calling the router", async () => {
    const result = await embedder.embed([]);
    expect(result).toEqual({ vectors: [], provider: "openai", model: undefined, dim: 0 });
    expect(routeEmbeddingMock).not.toHaveBeenCalled();
  });
});

describe("happy path", () => {
  it("returns router-resolved provider/model and the vectors", async () => {
    routeEmbeddingMock.mockResolvedValueOnce({
      ok: true,
      provider: "vllm",
      model: "embeddinggemma",
      source: "settings_kind",
      response: { provider: "vllm", model: "embeddinggemma", vectors: vectors(EMBEDDING_DIM), raw: {} },
      attempts: [],
    });
    const result = await embedder.embed(["hello"]);
    expect(result).not.toBeNull();
    expect(result!.provider).toBe("vllm");
    expect(result!.model).toBe("embeddinggemma");
    expect(result!.dim).toBe(EMBEDDING_DIM);
    expect(result!.vectors).toHaveLength(1);
    expect(routeEmbeddingMock).toHaveBeenCalledWith({ input: ["hello"] });
  });
});

describe("no-provider semantics", () => {
  it("returns null (not throw) when NoInferenceProviderAvailable is thrown", async () => {
    routeEmbeddingMock.mockRejectedValueOnce(new NoInferenceProviderAvailableMock("exhausted"));
    const result = await embedder.embed(["hello"]);
    expect(result).toBeNull();
  });
});

describe("dimension mismatch", () => {
  it("throws EmbedderError('dimension_mismatch') when vector dim != EMBEDDING_DIM", async () => {
    routeEmbeddingMock.mockResolvedValueOnce({
      ok: true,
      provider: "openai",
      model: "text-embedding-3-small",
      source: "provider_default",
      response: { provider: "openai", model: "text-embedding-3-small", vectors: vectors(1536), raw: {} },
      attempts: [],
    });
    let caught: any;
    try {
      await embedder.embed(["hello"]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EmbedderError);
    expect(caught.code).toBe("dimension_mismatch");
    expect(caught.details).toMatchObject({ provider: "openai", expected: EMBEDDING_DIM, actual: 1536 });
  });
});

describe("transport error wrapping", () => {
  it("wraps non-NoProvider errors as EmbedderError('transport_failed')", async () => {
    routeEmbeddingMock.mockRejectedValueOnce(new Error("network down"));
    let caught: any;
    try {
      await embedder.embed(["hello"]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EmbedderError);
    expect(caught.code).toBe("transport_failed");
    expect(caught.message).toContain("network down");
  });
});
