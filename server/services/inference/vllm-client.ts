/**
 * vLLM Client (v2.9.1 Phase 6)
 *
 * Talks to a vLLM server over its OpenAI-compatible HTTP API. The deployment
 * pattern in this repo is a sidecar container (`docker compose --profile vllm
 * up -d`) running `vllm/vllm-openai:nightly` against a Qwen3.5-9B / Qwen2.5-
 * Coder-14B checkpoint on a Blackwell-class GPU.
 *
 * Configuration is read at call time from process.env so settings persisted
 * through the Settings UI take effect without restart:
 *   - VLLM_BASE_URL  (default: http://rtpi-vllm:8000)
 *   - VLLM_MODEL     (default: Qwen/Qwen3.5-9B)
 *
 * The client only knows transport. Tool-call parsing is delegated to vLLM
 * itself via `--tool-call-parser qwen3_coder` on the server side; the
 * orchestrator dispatches resolved tool calls through mcp-invoker (Phase 5).
 */

export interface VLLMModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export interface VLLMProbeResult {
  ok: boolean;
  baseUrl: string;
  defaultModel?: string;
  availableModels?: string[];
  error?: string;
  durationMs: number;
}

const DEFAULT_BASE_URL = "http://rtpi-vllm:8000";
const DEFAULT_MODEL = "Qwen/Qwen3.5-9B";
const DEFAULT_EMBED_MODEL = "embeddinggemma";

export function getVLLMBaseUrl(): string {
  return (process.env.VLLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

/** Default CHAT model. Don't use for embeddings — Qwen3.5-9B is a chat model. */
export function getVLLMDefaultModel(): string {
  return process.env.VLLM_MODEL || DEFAULT_MODEL;
}

/**
 * Default EMBEDDING model when EMBEDDING_MODEL is unset. Distinct from the
 * chat default so the embed path doesn't accidentally pick a chat model
 * (which would 400 with "no pooler" on vLLM).
 */
export function getVLLMDefaultEmbedModel(): string {
  return process.env.VLLM_EMBED_MODEL || DEFAULT_EMBED_MODEL;
}

/**
 * Liveness/round-trip probe. Hits GET /v1/models which any OpenAI-compatible
 * server must implement; returns timing + the model list.
 */
export async function probeVLLM(timeoutMs = 5_000): Promise<VLLMProbeResult> {
  const baseUrl = getVLLMBaseUrl();
  const startedAt = Date.now();
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const durationMs = Date.now() - startedAt;
    if (!res.ok) {
      return {
        ok: false,
        baseUrl,
        error: `HTTP ${res.status}`,
        durationMs,
      };
    }
    const body = (await res.json().catch(() => null)) as
      | { data?: VLLMModel[] }
      | null;
    const models = (body?.data ?? []).map((m) => m.id);
    return {
      ok: true,
      baseUrl,
      defaultModel: getVLLMDefaultModel(),
      availableModels: models,
      durationMs,
    };
  } catch (err) {
    return {
      ok: false,
      baseUrl,
      error: err instanceof Error ? err.message : "Probe failed",
      durationMs: Date.now() - startedAt,
    };
  }
}

/**
 * Chat completion. Mirrors the OpenAI v1 schema. Used by the InferenceProvider
 * registry to fulfil chat() requests against vLLM.
 */
export async function vllmChat(params: {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  toolChoice?: any;
  stop?: string[];
  timeoutMs?: number;
}): Promise<any> {
  const baseUrl = getVLLMBaseUrl();
  const body: Record<string, any> = {
    model: params.model || getVLLMDefaultModel(),
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    stop: params.stop,
  };
  if (params.tools?.length) {
    body.tools = params.tools;
    if (params.toolChoice !== undefined) body.tool_choice = params.toolChoice;
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(params.timeoutMs ?? 120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`vLLM chat failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return res.json();
}

/**
 * Embedding. vLLM exposes the standard /v1/embeddings endpoint when the
 * model supports it (e.g. embeddinggemma, e5). Returns raw OpenAI-shaped data.
 */
export async function vllmEmbed(params: {
  input: string | string[];
  model?: string;
  timeoutMs?: number;
}): Promise<any> {
  const baseUrl = getVLLMBaseUrl();
  const res = await fetch(`${baseUrl}/v1/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model || getVLLMDefaultModel(),
      input: params.input,
    }),
    signal: AbortSignal.timeout(params.timeoutMs ?? 30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`vLLM embed failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return res.json();
}
