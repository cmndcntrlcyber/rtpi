/**
 * Embedder (v2.9.1 Phase 7)
 *
 * Routes embedding requests to the configured InferenceProvider, with
 * graceful degradation when no provider can embed (Anthropic-only setups,
 * Ollama without an embedding model installed, etc.).
 *
 * Behavior:
 *   - Reads RTPI_EMBEDDING_PROVIDER (vllm | ollama | openai | "auto") at
 *     call time. `auto` walks [openai → vllm → ollama] — OpenAI first
 *     because text-embedding-3-small returns 1536 dims which matches the
 *     existing schema column; vLLM/Ollama require a 1536-dim model
 *     (e.g. Qwen-Embedding-1.5B / nomic-embed-text@1536).
 *   - Returns null when no provider can embed; callers persist the row
 *     without an embedding so search just won't surface it (semantic search
 *     skips NULL embeddings).
 *
 * The 1536-dim column is a hard constraint of the existing schema; if the
 * active provider returns a different size, the embedder rejects with a
 * structured error so callers can warn the user to switch models.
 */

import {
  inferenceProviderRegistry,
  type ProviderId,
} from "../inference/inference-provider-registry";

const EMBED_FALLBACK_ORDER: ProviderId[] = ["openai", "vllm", "ollama"];
export const EMBEDDING_DIM = 1536;

export interface EmbedResult {
  vectors: number[][];
  provider: ProviderId;
  model: string | undefined;
  /** Per-input dimension; should be EMBEDDING_DIM on success. */
  dim: number;
}

export class EmbedderError extends Error {
  constructor(
    public code: "no_provider" | "dimension_mismatch" | "transport_failed",
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = "EmbedderError";
  }
}

class Embedder {
  /** Resolve the provider that should serve the next embed call. */
  private resolveEmbeddingProvider() {
    const requested = (process.env.RTPI_EMBEDDING_PROVIDER || "auto").toLowerCase();
    if (requested !== "auto") {
      const p = inferenceProviderRegistry.get(requested as ProviderId);
      if (p?.embed && p.isConfigured()) return p;
    }
    for (const id of EMBED_FALLBACK_ORDER) {
      const p = inferenceProviderRegistry.get(id);
      if (p?.embed && p.isConfigured()) return p;
    }
    return null;
  }

  /** Returns null when no provider can embed (caller skips the row). */
  async embed(inputs: string[]): Promise<EmbedResult | null> {
    if (inputs.length === 0) return { vectors: [], provider: "openai", model: undefined, dim: 0 };
    const provider = this.resolveEmbeddingProvider();
    if (!provider || !provider.embed) return null;

    let vectors: number[][] | null;
    try {
      vectors = await provider.embed(inputs);
    } catch (err) {
      throw new EmbedderError(
        "transport_failed",
        err instanceof Error ? err.message : "Embed transport failed",
        { provider: provider.id },
      );
    }
    if (!vectors) return null;

    const dim = vectors[0]?.length ?? 0;
    if (dim !== EMBEDDING_DIM) {
      throw new EmbedderError(
        "dimension_mismatch",
        `Provider ${provider.id} returned ${dim}-dim embeddings; schema expects ${EMBEDDING_DIM}.`,
        { provider: provider.id, expected: EMBEDDING_DIM, actual: dim },
      );
    }

    return {
      vectors,
      provider: provider.id,
      model: process.env.EMBEDDING_MODEL || provider.defaultModel(),
      dim,
    };
  }
}

export const embedder = new Embedder();
