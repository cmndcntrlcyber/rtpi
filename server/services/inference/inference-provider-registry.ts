/**
 * Inference Provider Registry (v2.9.1 Phase 6, seam S1)
 *
 * Single typed surface for the four inference back-ends supported in v2.9.1:
 *   - vllm     (OpenAI-compatible vLLM nightly running Qwen3.5-9B / Coder-14B)
 *   - ollama   (existing local-or-remote Ollama with auto fallback)
 *   - openai   (cloud)
 *   - anthropic (cloud)
 *
 * Higher-level services (agent loops, executive-summary generator, etc.)
 * should prefer this registry over reaching into provider-specific clients.
 * Probe results are persisted in-memory so the UI can render last-status
 * without round-tripping every provider on every page load.
 *
 * The registry is read-mostly: provider list is fixed at boot. Default
 * provider is selectable at runtime via `RTPI_INFERENCE_PROVIDER`
 * (`auto` | `vllm` | `ollama` | `openai` | `anthropic`); `auto` falls
 * through `[vllm → ollama → openai → anthropic]` and uses the first that
 * is configured + reachable.
 */

import { ollamaManager } from "../ollama-manager";
import { getOpenAIClient, getAnthropicClient } from "../ai-clients";
import {
  probeVLLM,
  getVLLMBaseUrl,
  getVLLMDefaultModel,
  vllmEmbed,
  type VLLMProbeResult,
} from "./vllm-client";

export type ProviderId = "vllm" | "ollama" | "openai" | "anthropic";

export interface ProviderCapabilities {
  chat: boolean;
  embed: boolean;
  toolCalls: boolean;
  vision: boolean;
  streaming: boolean;
}

export interface ProbeResult {
  ok: boolean;
  durationMs: number;
  defaultModel?: string;
  availableModels?: string[];
  error?: string;
  /** Free-form details surfaced to the UI for diagnostics. */
  details?: Record<string, unknown>;
}

export interface ProviderInfo {
  id: ProviderId;
  displayName: string;
  description: string;
  capabilities: ProviderCapabilities;
  configured: boolean;
  endpoint?: string;
  defaultModel?: string;
  /** Most recent probe result (populated lazily on first probe). */
  lastProbe?: ProbeResult;
  lastProbeAt?: Date;
}

export interface InferenceProvider {
  id: ProviderId;
  displayName: string;
  description: string;
  capabilities: ProviderCapabilities;
  isConfigured(): boolean;
  endpoint(): string | undefined;
  defaultModel(): string | undefined;
  probe(): Promise<ProbeResult>;
  /**
   * Embed one or more inputs. Implementations should respect EMBEDDING_MODEL
   * env when present and fall back to a sensible default. Throws on transport
   * failure; returns null when this provider can't embed (e.g. Anthropic).
   * v2.9.1 Phase 7.
   */
  embed?(inputs: string[]): Promise<number[][] | null>;
}

// ----------------------------------------------------------------------------
// Concrete providers — each wraps an existing client; no duplicated transport
// ----------------------------------------------------------------------------

class VLLMProvider implements InferenceProvider {
  id: ProviderId = "vllm";
  displayName = "vLLM (Qwen3.5-9B)";
  description =
    "Local OpenAI-compatible vLLM nightly serving Qwen3.5-9B / Qwen2.5-Coder-14B on a Blackwell GPU. Recommended for agentic + tool-call workloads.";
  capabilities: ProviderCapabilities = {
    chat: true,
    embed: true,
    toolCalls: true,
    vision: true,
    streaming: true,
  };
  isConfigured(): boolean {
    // Treat as configured whenever VLLM_BASE_URL is reachable shape-wise; the
    // probe result is the source of truth for "is up". This keeps the
    // settings UI from hiding the card when the user has just configured it
    // but the sidecar hasn't started yet.
    return !!process.env.VLLM_BASE_URL || true;
  }
  endpoint(): string | undefined {
    return getVLLMBaseUrl();
  }
  defaultModel(): string | undefined {
    return getVLLMDefaultModel();
  }
  async probe(): Promise<ProbeResult> {
    const r: VLLMProbeResult = await probeVLLM();
    return {
      ok: r.ok,
      durationMs: r.durationMs,
      defaultModel: r.defaultModel,
      availableModels: r.availableModels,
      error: r.error,
      details: { baseUrl: r.baseUrl },
    };
  }
  async embed(inputs: string[]): Promise<number[][]> {
    const model = process.env.EMBEDDING_MODEL || getVLLMDefaultModel();
    const result = await vllmEmbed({ input: inputs, model });
    return (result?.data ?? []).map((d: any) => d.embedding as number[]);
  }
}

class OllamaProvider implements InferenceProvider {
  id: ProviderId = "ollama";
  displayName = "Ollama";
  description =
    "Local-or-remote Ollama instance. Existing primary path with auto cloud fallback. Tool-call support varies by model.";
  capabilities: ProviderCapabilities = {
    chat: true,
    embed: true,
    toolCalls: true, // model-dependent; per-call validation
    vision: true, // model-dependent (e.g., llava, qwen-vl)
    streaming: true,
  };
  isConfigured(): boolean {
    // Ollama has a sensible default (localhost:11434) so always considered
    // configured — probe result tells the actual story.
    return true;
  }
  endpoint(): string | undefined {
    return process.env.OLLAMA_HOST || "http://localhost:11434";
  }
  defaultModel(): string | undefined {
    return process.env.RKLLM_DEFAULT_MODEL || process.env.DEFAULT_MODEL || undefined;
  }
  async probe(): Promise<ProbeResult> {
    const startedAt = Date.now();
    try {
      const models = await ollamaManager.listModelsFromAPI();
      return {
        ok: true,
        durationMs: Date.now() - startedAt,
        availableModels: models.map((m) => m.name),
        defaultModel: this.defaultModel(),
        details: { endpoint: this.endpoint() },
      };
    } catch (err) {
      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : "Probe failed",
        details: { endpoint: this.endpoint() },
      };
    }
  }
  /**
   * Ollama embed via /api/embed (newer) with /api/embeddings legacy fallback.
   * Default model is EMBEDDING_MODEL or 'nomic-embed-text:latest'.
   */
  async embed(inputs: string[]): Promise<number[][]> {
    const host = (this.endpoint() || "http://localhost:11434").replace(/\/+$/, "");
    const model = process.env.EMBEDDING_MODEL || "nomic-embed-text:latest";
    // Try /api/embed first (supports batch); fall back to /api/embeddings (single).
    try {
      const res = await fetch(`${host}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: inputs }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const body = (await res.json()) as { embeddings?: number[][] };
        if (Array.isArray(body.embeddings)) return body.embeddings;
      }
    } catch {
      // Fall through to legacy endpoint.
    }
    const out: number[][] = [];
    for (const input of inputs) {
      const res = await fetch(`${host}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: input }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        throw new Error(`Ollama embed failed (${res.status})`);
      }
      const body = (await res.json()) as { embedding?: number[] };
      if (!Array.isArray(body.embedding)) {
        throw new Error("Ollama embed returned no embedding");
      }
      out.push(body.embedding);
    }
    return out;
  }
}

class OpenAIProvider implements InferenceProvider {
  id: ProviderId = "openai";
  displayName = "OpenAI";
  description = "Cloud — falls back when local providers are unreachable. Uses OPENAI_API_KEY.";
  capabilities: ProviderCapabilities = {
    chat: true,
    embed: true,
    toolCalls: true,
    vision: true,
    streaming: true,
  };
  isConfigured(): boolean {
    return getOpenAIClient() !== null;
  }
  endpoint(): string | undefined {
    return "https://api.openai.com/v1";
  }
  defaultModel(): string | undefined {
    return process.env.DEFAULT_MODEL || "gpt-4o-mini";
  }
  async probe(): Promise<ProbeResult> {
    const startedAt = Date.now();
    const client = getOpenAIClient();
    if (!client) {
      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        error: "OPENAI_API_KEY not configured",
      };
    }
    try {
      // models.list() is a cheap auth-validating round-trip.
      const result = await client.models.list();
      const ids: string[] = [];
      for await (const m of result) {
        ids.push(m.id);
        if (ids.length >= 25) break;
      }
      return {
        ok: true,
        durationMs: Date.now() - startedAt,
        availableModels: ids,
        defaultModel: this.defaultModel(),
      };
    } catch (err) {
      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : "Probe failed",
      };
    }
  }
  async embed(inputs: string[]): Promise<number[][] | null> {
    const client = getOpenAIClient();
    if (!client) return null;
    const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
    const res = await client.embeddings.create({ model, input: inputs });
    return res.data.map((d: any) => d.embedding as number[]);
  }
}

class AnthropicProvider implements InferenceProvider {
  id: ProviderId = "anthropic";
  displayName = "Anthropic";
  description = "Cloud — falls back when local providers are unreachable. Uses ANTHROPIC_API_KEY.";
  capabilities: ProviderCapabilities = {
    chat: true,
    embed: false, // Anthropic does not currently offer embeddings
    toolCalls: true,
    vision: true,
    streaming: true,
  };
  isConfigured(): boolean {
    return getAnthropicClient() !== null;
  }
  endpoint(): string | undefined {
    return "https://api.anthropic.com";
  }
  defaultModel(): string | undefined {
    return process.env.DEFAULT_MODEL || "claude-sonnet-4-5";
  }
  async probe(): Promise<ProbeResult> {
    const startedAt = Date.now();
    const client = getAnthropicClient();
    if (!client) {
      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        error: "ANTHROPIC_API_KEY not configured",
      };
    }
    // Anthropic SDK doesn't have a cheap models.list, so we settle for "key
    // present + SDK constructed" and treat that as configured. A real call
    // is exercised on first chat().
    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      defaultModel: this.defaultModel(),
      details: {
        note: "SDK initialized — actual roundtrip exercised on first chat call",
      },
    };
  }
  async embed(_inputs: string[]): Promise<number[][] | null> {
    // Anthropic does not currently expose an embeddings endpoint.
    return null;
  }
}

// ----------------------------------------------------------------------------
// Registry
// ----------------------------------------------------------------------------

const FALLBACK_ORDER: ProviderId[] = ["vllm", "ollama", "openai", "anthropic"];

class InferenceProviderRegistry {
  private providers: Map<ProviderId, InferenceProvider>;
  private lastProbes = new Map<ProviderId, { result: ProbeResult; at: Date }>();

  constructor() {
    this.providers = new Map<ProviderId, InferenceProvider>([
      ["vllm", new VLLMProvider()],
      ["ollama", new OllamaProvider()],
      ["openai", new OpenAIProvider()],
      ["anthropic", new AnthropicProvider()],
    ]);
  }

  list(): ProviderInfo[] {
    return [...this.providers.values()].map((p) => this.toInfo(p));
  }

  get(id: ProviderId): InferenceProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Resolve the active provider per RTPI_INFERENCE_PROVIDER. `auto` walks the
   * fallback order and returns the first configured provider; if none is
   * configured this returns `vllm` (so the UI can prompt the user to set it
   * up). The actual reachability is the caller's job to verify via probe().
   */
  resolveDefault(): InferenceProvider {
    const requested = (process.env.RTPI_INFERENCE_PROVIDER || "auto").toLowerCase();
    if (requested !== "auto" && this.providers.has(requested as ProviderId)) {
      return this.providers.get(requested as ProviderId)!;
    }
    for (const id of FALLBACK_ORDER) {
      const p = this.providers.get(id);
      if (p && p.isConfigured()) return p;
    }
    return this.providers.get("vllm")!;
  }

  async probe(id: ProviderId): Promise<ProbeResult> {
    const provider = this.providers.get(id);
    if (!provider) {
      return { ok: false, durationMs: 0, error: `Unknown provider: ${id}` };
    }
    const result = await provider.probe();
    this.lastProbes.set(id, { result, at: new Date() });
    return result;
  }

  /** Probe every provider (used by the providers-list endpoint). */
  async probeAll(timeoutMs = 5_000): Promise<Map<ProviderId, ProbeResult>> {
    const out = new Map<ProviderId, ProbeResult>();
    const promises = [...this.providers.values()].map(async (p) => {
      try {
        const result = await Promise.race([
          p.probe(),
          new Promise<ProbeResult>((resolve) =>
            setTimeout(
              () => resolve({ ok: false, durationMs: timeoutMs, error: "Probe timed out" }),
              timeoutMs,
            ),
          ),
        ]);
        out.set(p.id, result);
        this.lastProbes.set(p.id, { result, at: new Date() });
      } catch (err) {
        out.set(p.id, {
          ok: false,
          durationMs: 0,
          error: err instanceof Error ? err.message : "Unknown probe error",
        });
      }
    });
    await Promise.all(promises);
    return out;
  }

  private toInfo(p: InferenceProvider): ProviderInfo {
    const last = this.lastProbes.get(p.id);
    return {
      id: p.id,
      displayName: p.displayName,
      description: p.description,
      capabilities: p.capabilities,
      configured: p.isConfigured(),
      endpoint: p.endpoint(),
      defaultModel: p.defaultModel(),
      lastProbe: last?.result,
      lastProbeAt: last?.at,
    };
  }
}

export const inferenceProviderRegistry = new InferenceProviderRegistry();
