/**
 * Inference router — single entry point for every LLM / embedding call in
 * the codebase.
 *
 * Migration target for ~23 hand-rolled "try Anthropic then OpenAI" fallback
 * chains scattered across server/services/. Each kind (agent / reasoning /
 * embedding) reads the operator's Settings default first, then walks the
 * full provider fallback chain. Per-agent overrides (agents.inferenceProviderId
 * + agents.config.model) take precedence for the Agent route only.
 *
 * The model-cache (model-cache.ts) decides whether a chosen model is
 * actually available on its provider before each call — if not, the router
 * logs a structured warning and skips to the next target instead of
 * burning a real round-trip.
 *
 * Callers see one of:
 *   - `{ ok: true, ... }` on success, including which target succeeded so
 *     callers can log `inference: ${provider}/${model} (source=${source})`
 *   - throws `NoInferenceProviderAvailable` when every target fails;
 *     attached `attempts` lists each (provider, model, error, skipReason).
 *
 * Remaining provider-pinned paths (audited; intentionally left alone):
 *   - `ollama-ai-client.ts` — ~12 enrichment callers still bypass the
 *     router via a switch over `provider`. Migration is incremental and
 *     not on the critical path for the active embedding bug.
 *   - `agent-config.ts` — `OPS_MANAGER_AI_PROVIDER` / `PAGE_REPORTER_AI_PROVIDER`
 *     / `TASK_AGENT_AI_PROVIDER` env vars are dormant overrides for
 *     callers that thread `model` through `explicitModel`; deleting them
 *     would break operators who pin via env.
 *   - `ai-clients.ts` — `new OpenAI(...)` / `new Anthropic(...)` factories
 *     live below the router and are correct as-is.
 *   - `api/v1/settings.ts` — direct SDK calls validate operator-typed API
 *     keys; provider-specific endpoint required.
 */

import { eq } from "drizzle-orm";
import { db } from "../../db";
import { agents } from "@shared/schema";
import {
  executeChat,
  executeEmbedding,
  type ChatMessage,
  type ChatToolDefinition,
  type ExecuteChatResponse,
  type ExecuteEmbeddingResponse,
} from "./executor";
import { modelCache } from "./model-cache";
import {
  resolveAgentTargets,
  resolveEmbeddingTargets,
  resolveReasoningTargets,
  type AgentOverride,
  type ResolutionTarget,
  type TargetSource,
} from "./resolver";
import type { ProviderId } from "./inference-provider-registry";
import { createLogger } from '../../lib/logger';
const log = createLogger("inference-router");

export interface AttemptRecord {
  provider: ProviderId;
  model: string;
  source: TargetSource;
  outcome: "success" | "skipped_not_in_cache" | "error";
  error?: string;
  durationMs?: number;
}

export interface RouteSuccess<T> {
  ok: true;
  provider: ProviderId;
  model: string;
  source: TargetSource;
  response: T;
  attempts: AttemptRecord[];
}

export class NoInferenceProviderAvailable extends Error {
  readonly attempts: AttemptRecord[];
  readonly kind: "agent" | "reasoning" | "embedding";
  constructor(kind: "agent" | "reasoning" | "embedding", attempts: AttemptRecord[]) {
    super(
      `No inference provider available for kind="${kind}". Tried ${attempts.length} target(s): ` +
        attempts.map((a) => `${a.provider}/${a.model}=${a.outcome}${a.error ? `(${a.error})` : ""}`).join(", "),
    );
    this.name = "NoInferenceProviderAvailable";
    this.kind = kind;
    this.attempts = attempts;
  }
}

export interface RouteAgentRequest {
  /** When supplied, the router loads agents.inferenceProviderId + config.model as a hard override. */
  agentId?: string;
  /** Pre-loaded override (skips the DB read when the caller already has the agent record). */
  agentOverride?: AgentOverride;
  /** Per-call escape hatch — usually empty. */
  explicitModel?: string;
  messages: ChatMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ChatToolDefinition[];
  responseFormat?: { type: "json_object" | "text" };
  timeoutMs?: number;
}

export interface RouteReasoningRequest {
  explicitModel?: string;
  messages: ChatMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ChatToolDefinition[];
  responseFormat?: { type: "json_object" | "text" };
  timeoutMs?: number;
}

export interface RouteEmbeddingRequest {
  explicitModel?: string;
  input: string | string[];
}

// ----------------------------------------------------------------------------
// Public entry points
// ----------------------------------------------------------------------------

export async function routeAgent(req: RouteAgentRequest): Promise<RouteSuccess<ExecuteChatResponse>> {
  const override = req.agentOverride ?? (await loadAgentOverride(req.agentId));
  const targets = resolveAgentTargets({
    agentOverride: override,
    explicitModel: req.explicitModel,
  });
  return runChat("agent", targets, req);
}

export async function routeReasoning(req: RouteReasoningRequest): Promise<RouteSuccess<ExecuteChatResponse>> {
  const targets = resolveReasoningTargets({ explicitModel: req.explicitModel });
  return runChat("reasoning", targets, req);
}

export async function routeEmbedding(
  req: RouteEmbeddingRequest,
): Promise<RouteSuccess<ExecuteEmbeddingResponse>> {
  const targets = resolveEmbeddingTargets({ explicitModel: req.explicitModel });
  const attempts: AttemptRecord[] = [];

  for (const target of targets) {
    const cacheVerdict = checkCache(target);
    if (cacheVerdict === "skip") {
      attempts.push({
        provider: target.provider,
        model: target.model,
        source: target.source,
        outcome: "skipped_not_in_cache",
      });
      continue;
    }
    const startedAt = Date.now();
    try {
      const response = await executeEmbedding({
        provider: target.provider,
        model: target.model,
        input: req.input,
      });
      attempts.push({
        provider: target.provider,
        model: target.model,
        source: target.source,
        outcome: "success",
        durationMs: Date.now() - startedAt,
      });
      logSuccess("embedding", target, attempts.length);
      return {
        ok: true,
        provider: target.provider,
        model: target.model,
        source: target.source,
        response,
        attempts,
      };
    } catch (err: unknown) {
      attempts.push({
        provider: target.provider,
        model: target.model,
        source: target.source,
        outcome: "error",
        durationMs: Date.now() - startedAt,
        error: errorMessage(err),
      });
      // continue to next target
    }
  }

  throw new NoInferenceProviderAvailable("embedding", attempts);
}

// ----------------------------------------------------------------------------
// Internals
// ----------------------------------------------------------------------------

type ChatLikeRequest = RouteAgentRequest | RouteReasoningRequest;

async function runChat(
  kind: "agent" | "reasoning",
  targets: ResolutionTarget[],
  req: ChatLikeRequest,
): Promise<RouteSuccess<ExecuteChatResponse>> {
  const attempts: AttemptRecord[] = [];

  for (const target of targets) {
    const cacheVerdict = checkCache(target);
    if (cacheVerdict === "skip") {
      attempts.push({
        provider: target.provider,
        model: target.model,
        source: target.source,
        outcome: "skipped_not_in_cache",
      });
      log.warn(
        `[inference-router] ${kind}: skipping ${target.provider}/${target.model} (not in model cache)`,
      );
      continue;
    }
    const startedAt = Date.now();
    try {
      const response = await executeChat({
        provider: target.provider,
        model: target.model,
        messages: req.messages,
        system: req.system,
        maxTokens: req.maxTokens,
        temperature: req.temperature,
        tools: req.tools,
        responseFormat: req.responseFormat,
        timeoutMs: req.timeoutMs,
      });
      attempts.push({
        provider: target.provider,
        model: target.model,
        source: target.source,
        outcome: "success",
        durationMs: Date.now() - startedAt,
      });
      logSuccess(kind, target, attempts.length);
      return {
        ok: true,
        provider: target.provider,
        model: target.model,
        source: target.source,
        response,
        attempts,
      };
    } catch (err: unknown) {
      const msg = errorMessage(err);
      attempts.push({
        provider: target.provider,
        model: target.model,
        source: target.source,
        outcome: "error",
        durationMs: Date.now() - startedAt,
        error: msg,
      });
      log.warn(
        `[inference-router] ${kind}: ${target.provider}/${target.model} failed (${msg}), trying next target`,
      );
    }
  }

  throw new NoInferenceProviderAvailable(kind, attempts);
}

function checkCache(target: ResolutionTarget): "use" | "skip" {
  // No cache data at all for this provider → trust the name and call;
  // the SDK / HTTP will surface the real error if the model is wrong.
  if (modelCache.isUnknown(target.provider)) return "use";
  // Cache has data but the model isn't present → skip.
  if (!modelCache.isAvailable(target.provider, target.model)) return "skip";
  return "use";
}

async function loadAgentOverride(agentId: string | undefined): Promise<AgentOverride | undefined> {
  if (!agentId) return undefined;
  try {
    const [row] = await db
      .select({ inferenceProviderId: agents.inferenceProviderId, config: agents.config })
      .from(agents)
      .where(eq(agents.id, agentId));
    if (!row) return undefined;
    const providerId = (row.inferenceProviderId ?? null) as AgentOverride["providerId"];
    const config = (row.config ?? {}) as { model?: string | null };
    return { providerId, model: config.model ?? null };
  } catch (err) {
    log.warn(`[inference-router] failed to load agent override for ${agentId}:`, err);
    return undefined;
  }
}

function logSuccess(
  kind: "agent" | "reasoning" | "embedding",
  target: ResolutionTarget,
  attemptCount: number,
): void {
  const suffix = attemptCount > 1 ? ` (after ${attemptCount - 1} fallback${attemptCount > 2 ? "s" : ""})` : "";
  log.info(
    `[inference-router] ${kind}: ${target.provider}/${target.model} source=${target.source}${suffix}`,
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown error";
  }
}
