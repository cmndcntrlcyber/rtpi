/**
 * Embedder — thin wrapper over `routeEmbedding`.
 *
 * Predates the inference router and used to reimplement provider selection
 * with a hard-coded chain that didn't consider the model name. That caused
 * cross-provider leaks (e.g. `EMBEDDING_MODEL=embeddinggemma:latest` being
 * sent to OpenAI's API and 404ing). The router already pairs models with
 * the correct provider via `inferProviderFromModel` + `PROVIDER_EMBED_DEFAULTS`
 * and walks the fallback chain on failure; this module just delegates and
 * enforces the pgvector-column dim invariant for callers that persist
 * vectors directly.
 */

import {
  routeEmbedding,
  NoInferenceProviderAvailable,
} from "../inference/inference-router";
import type { ProviderId } from "../inference/inference-provider-registry";

export const EMBEDDING_DIM = 2560;

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
  /** Returns null when no provider can embed (caller skips the row). */
  async embed(inputs: string[]): Promise<EmbedResult | null> {
    if (inputs.length === 0) {
      return { vectors: [], provider: "openai", model: undefined, dim: 0 };
    }

    let result;
    try {
      result = await routeEmbedding({ input: inputs });
    } catch (err) {
      // Mirrors the prior "no provider" semantics — callers persist the row
      // without an embedding so search just won't surface it.
      if (err instanceof NoInferenceProviderAvailable) return null;
      throw new EmbedderError(
        "transport_failed",
        err instanceof Error ? err.message : "Embed transport failed",
        { attempts: (err as any)?.attempts },
      );
    }

    const vectors = result.response.vectors;
    const dim = vectors[0]?.length ?? 0;
    if (dim !== EMBEDDING_DIM) {
      throw new EmbedderError(
        "dimension_mismatch",
        `Provider ${result.provider} returned ${dim}-dim embeddings; schema expects ${EMBEDDING_DIM}.`,
        { provider: result.provider, expected: EMBEDDING_DIM, actual: dim },
      );
    }

    return { vectors, provider: result.provider, model: result.model, dim };
  }
}

export const embedder = new Embedder();
