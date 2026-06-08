/**
 * Pure-function resolution layer for the inference router.
 *
 * Given a request kind (agent / reasoning / embedding) and optional inputs
 * (agentId override, explicit model), produce an ordered list of
 * {provider, model, source} targets the router should try, in order, until
 * one succeeds.
 *
 * No I/O lives here on purpose: the router does the awaiting, and tests
 * cover every branch with plain values (no mocks of SDK clients required).
 *
 * Resolution order — confirmed by user:
 *   Agent      : agent override → settings (DEFAULT_AGENT_MODEL) → DEFAULT_MODEL
 *                → provider defaults → full fallback chain.
 *   Reasoning  : settings (DEFAULT_REASONING_MODEL) → DEFAULT_MODEL
 *                → provider defaults → full fallback chain.
 *   Embedding  : settings (EMBEDDING_MODEL) → embedding-capable provider chain
 *                (openai → vllm → ollama).
 *
 * The model-cache layer decides whether a chosen model is actually present
 * on its provider; this resolver only proposes targets.
 */

import type { ProviderId } from "./inference-provider-registry";

export type InferenceKind = "agent" | "reasoning" | "embedding";

export type TargetSource =
  | "agent_override"
  | "settings_kind"
  | "settings_global"
  | "provider_default"
  | "fallback";

export interface ResolutionTarget {
  provider: ProviderId;
  model: string;
  source: TargetSource;
}

export interface AgentOverride {
  /** From agents.inferenceProviderId — when set, pins the provider. */
  providerId?: ProviderId | null;
  /** From agents.config.model — when set, pins the model name. */
  model?: string | null;
}

/**
 * Default fallback chains. Embedding excludes Anthropic since it has no
 * embeddings endpoint. Ordering preference: local first (free, always
 * reachable when configured), cloud middle, vLLM last (requires a running
 * container and tends to fail with `fetch failed` when not deployed).
 */
const CHAT_FALLBACK_CHAIN: ProviderId[] = ["ollama", "anthropic", "openai", "vllm"];
const EMBED_FALLBACK_CHAIN: ProviderId[] = ["ollama", "openai", "vllm"];

/**
 * Per-provider default models used when neither agent override nor Settings
 * supplies one. Mirrors the defaults already baked into each provider class
 * in [inference-provider-registry.ts] so behavior doesn't drift if env
 * vars are unset.
 */
const PROVIDER_CHAT_DEFAULTS: Record<ProviderId, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o-mini",
  vllm: "Qwen/Qwen3.5-9B",
  ollama: "llama3:8b",
};

const PROVIDER_EMBED_DEFAULTS: Record<ProviderId, string> = {
  openai: "text-embedding-3-small",
  vllm: "embeddinggemma",
  ollama: "nomic-embed-text:latest",
  // Anthropic absent on purpose — no embeddings endpoint.
  anthropic: "",
};

/**
 * Heuristic: infer the provider that owns a given model name. Used when an
 * operator types "claude-sonnet-4-5" into the Settings dropdown and we
 * need to know which provider to call. Returns null when the name is
 * ambiguous; the router then walks the chain instead of assuming.
 */
export function inferProviderFromModel(model: string): ProviderId | null {
  const lower = model.trim().toLowerCase();
  if (lower === "") return null;
  if (lower.startsWith("claude") || lower.startsWith("anthropic/")) return "anthropic";
  if (lower.startsWith("gpt") || lower.startsWith("o1") || lower.startsWith("openai/")) return "openai";
  if (lower.startsWith("text-embedding") || lower.startsWith("text-search")) return "openai";
  // vLLM hosts HuggingFace-style ids: vendor/model (e.g. Qwen/Qwen3.5-9B).
  if (lower.includes("/") && !lower.startsWith("anthropic/") && !lower.startsWith("openai/")) {
    return "vllm";
  }
  // Ollama tags use ":" (e.g. llama3:8b, nomic-embed-text:latest).
  if (lower.includes(":")) return "ollama";
  // Bare names like "llama3" or "qwen2.5-coder" — treat as Ollama since
  // that's the only provider that accepts unprefixed local tags.
  return "ollama";
}

export interface ResolveInput {
  /** Agent record overrides — only honored when kind === "agent". */
  agentOverride?: AgentOverride;
  /**
   * Explicit model the caller wants. When set, becomes the first target
   * (paired with its inferred provider) before any settings consultation.
   * Use sparingly — meant for one-off "must use this exact model" sites.
   */
  explicitModel?: string;
}

/**
 * Settings snapshot the resolver consumes. Lives behind a single arg so
 * tests don't need to manipulate process.env, and so a future
 * settings-from-DB change doesn't require touching this file's signature.
 */
export interface SettingsSnapshot {
  defaultModel: string;
  defaultAgentModel: string;
  defaultReasoningModel: string;
  defaultEmbeddingModel: string;
}

export function readSettingsSnapshot(): SettingsSnapshot {
  return {
    defaultModel: (process.env.DEFAULT_MODEL || "").trim(),
    defaultAgentModel: (process.env.DEFAULT_AGENT_MODEL || "").trim(),
    defaultReasoningModel: (process.env.DEFAULT_REASONING_MODEL || "").trim(),
    defaultEmbeddingModel: (process.env.EMBEDDING_MODEL || "").trim(),
  };
}

/** Deduplicate by (provider, model) preserving order. */
function dedupe(targets: ResolutionTarget[]): ResolutionTarget[] {
  const seen = new Set<string>();
  const out: ResolutionTarget[] = [];
  for (const t of targets) {
    const key = `${t.provider}:${t.model.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function pushTargetFromModel(
  out: ResolutionTarget[],
  model: string | undefined | null,
  source: TargetSource,
  preferredProvider?: ProviderId | null,
): void {
  const trimmed = (model ?? "").trim();
  if (trimmed === "") return;
  const provider = preferredProvider ?? inferProviderFromModel(trimmed);
  if (!provider) return;
  out.push({ provider, model: trimmed, source });
}

function appendFallback(out: ResolutionTarget[], chain: ProviderId[], defaults: Record<ProviderId, string>): void {
  for (const p of chain) {
    const m = defaults[p];
    if (!m) continue;
    out.push({ provider: p, model: m, source: "fallback" });
  }
}

export function resolveAgentTargets(
  input: ResolveInput,
  settings: SettingsSnapshot = readSettingsSnapshot(),
): ResolutionTarget[] {
  const out: ResolutionTarget[] = [];

  // 1) Explicit per-call override (rarely used).
  pushTargetFromModel(out, input.explicitModel, "agent_override");

  // 2) Agent row override (inferenceProviderId pins the provider; config.model
  //    optionally pins the model; if model is empty, fall back to that provider's
  //    default chat model).
  const ao = input.agentOverride;
  if (ao?.providerId) {
    const model = (ao.model || "").trim() || PROVIDER_CHAT_DEFAULTS[ao.providerId];
    if (model) out.push({ provider: ao.providerId, model, source: "agent_override" });
  } else if (ao?.model) {
    pushTargetFromModel(out, ao.model, "agent_override");
  }

  // 3) Settings kind-specific default.
  pushTargetFromModel(out, settings.defaultAgentModel, "settings_kind");

  // 4) Settings global default.
  pushTargetFromModel(out, settings.defaultModel, "settings_global");

  // 5) Each provider's documented default.
  for (const p of CHAT_FALLBACK_CHAIN) {
    out.push({ provider: p, model: PROVIDER_CHAT_DEFAULTS[p], source: "provider_default" });
  }

  // 6) Full chain (some entries may already be present — dedupe collapses them).
  appendFallback(out, CHAT_FALLBACK_CHAIN, PROVIDER_CHAT_DEFAULTS);

  return dedupe(out);
}

export function resolveReasoningTargets(
  input: ResolveInput = {},
  settings: SettingsSnapshot = readSettingsSnapshot(),
): ResolutionTarget[] {
  const out: ResolutionTarget[] = [];
  pushTargetFromModel(out, input.explicitModel, "agent_override");
  pushTargetFromModel(out, settings.defaultReasoningModel, "settings_kind");
  pushTargetFromModel(out, settings.defaultModel, "settings_global");
  for (const p of CHAT_FALLBACK_CHAIN) {
    out.push({ provider: p, model: PROVIDER_CHAT_DEFAULTS[p], source: "provider_default" });
  }
  appendFallback(out, CHAT_FALLBACK_CHAIN, PROVIDER_CHAT_DEFAULTS);
  return dedupe(out);
}

export function resolveEmbeddingTargets(
  input: ResolveInput = {},
  settings: SettingsSnapshot = readSettingsSnapshot(),
): ResolutionTarget[] {
  const out: ResolutionTarget[] = [];
  pushTargetFromModel(out, input.explicitModel, "agent_override");
  pushTargetFromModel(out, settings.defaultEmbeddingModel, "settings_kind");
  // No global default for embeddings — the global DEFAULT_MODEL is a chat
  // model and would always 404 on /embeddings. Skip straight to providers.
  for (const p of EMBED_FALLBACK_CHAIN) {
    out.push({ provider: p, model: PROVIDER_EMBED_DEFAULTS[p], source: "provider_default" });
  }
  appendFallback(out, EMBED_FALLBACK_CHAIN, PROVIDER_EMBED_DEFAULTS);
  return dedupe(out);
}

export function resolveTargets(
  kind: InferenceKind,
  input: ResolveInput = {},
  settings: SettingsSnapshot = readSettingsSnapshot(),
): ResolutionTarget[] {
  if (kind === "agent") return resolveAgentTargets(input, settings);
  if (kind === "reasoning") return resolveReasoningTargets(input, settings);
  return resolveEmbeddingTargets(input, settings);
}
