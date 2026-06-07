/**
 * Uniform per-provider execution adapters.
 *
 * The router decides {provider, model}; this module performs the actual
 * SDK / HTTP call and normalizes the response into a single shape every
 * caller can rely on (`{ text, toolCalls?, raw, provider, model }`). Keeps
 * provider-specific SDK quirks (Anthropic content blocks, OpenAI message
 * fields, vLLM/Ollama raw JSON) localized to one file so call sites stay
 * provider-agnostic.
 *
 * `executeChat` is the chat-completion adapter shared by Agent and
 * Reasoning routes. `executeEmbedding` is the embedding adapter for the
 * Embedding route.
 *
 * No fallback logic lives here — that's the router's job. The executor
 * throws on transport / model errors and lets the router catch + try the
 * next target.
 */

import { getAnthropicClient, getOpenAIClient } from "../ai-clients";
import {
  inferenceProviderRegistry,
  type ProviderId,
} from "./inference-provider-registry";
import { vllmChat, vllmEmbed } from "./vllm-client";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Optional name field used by OpenAI tool-call traces and Anthropic tool-result blocks. */
  name?: string;
}

export interface ChatToolDefinition {
  /**
   * OpenAI-style tool definition. The executor translates to Anthropic's
   * `tools` shape automatically. Names must match `^[a-zA-Z0-9_-]{1,64}$`.
   */
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface ExecuteChatRequest {
  provider: ProviderId;
  model: string;
  messages: ChatMessage[];
  /** Convenience — when present, prepended as a system message. */
  system?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ChatToolDefinition[];
  /** Only meaningful for OpenAI today; safe to pass to others (ignored). */
  responseFormat?: { type: "json_object" | "text" };
  /** Default 120s. */
  timeoutMs?: number;
}

export interface ToolCall {
  id?: string;
  name: string;
  arguments: string;
}

export interface ExecuteChatResponse {
  provider: ProviderId;
  model: string;
  text: string;
  toolCalls?: ToolCall[];
  /** The unmodified SDK / HTTP response — callers can dig in if they need finishReason, usage, etc. */
  raw: unknown;
}

export interface ExecuteEmbeddingRequest {
  provider: ProviderId;
  model: string;
  input: string | string[];
}

export interface ExecuteEmbeddingResponse {
  provider: ProviderId;
  model: string;
  vectors: number[][];
  raw: unknown;
}

const DEFAULT_TIMEOUT_MS = 120_000;

// ----------------------------------------------------------------------------
// Chat
// ----------------------------------------------------------------------------

export async function executeChat(req: ExecuteChatRequest): Promise<ExecuteChatResponse> {
  const messages = normalizeMessages(req);
  switch (req.provider) {
    case "anthropic":
      return executeChatAnthropic(req, messages);
    case "openai":
      return executeChatOpenAi(req, messages);
    case "vllm":
      return executeChatVllm(req, messages);
    case "ollama":
      return executeChatOllama(req, messages);
    default:
      throw new Error(`Unknown chat provider: ${req.provider}`);
  }
}

function normalizeMessages(req: ExecuteChatRequest): ChatMessage[] {
  if (!req.system) return req.messages;
  // Don't double-add system if it's already first.
  if (req.messages[0]?.role === "system") return req.messages;
  return [{ role: "system", content: req.system }, ...req.messages];
}

async function executeChatAnthropic(
  req: ExecuteChatRequest,
  messages: ChatMessage[],
): Promise<ExecuteChatResponse> {
  const client = getAnthropicClient();
  if (!client) throw new Error("Anthropic client not configured");

  // Anthropic separates system from messages; pull any leading system out.
  let system: string | undefined;
  const userMessages = messages.filter((m) => {
    if (m.role === "system") {
      system = system ? `${system}\n\n${m.content}` : m.content;
      return false;
    }
    return true;
  });

  const body: Parameters<typeof client.messages.create>[0] = {
    model: req.model,
    max_tokens: req.maxTokens ?? 2000,
    messages: userMessages.map((m) => ({
      role: m.role === "tool" ? "user" : (m.role as "user" | "assistant"),
      content: m.content,
    })),
  };
  if (system) body.system = system;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters as Parameters<typeof client.messages.create>[0]["tools"][number]["input_schema"],
    }));
  }

  const response = await client.messages.create(body);

  const textBlocks = response.content.filter((b: { type: string }) => b.type === "text") as Array<{
    type: "text";
    text: string;
  }>;
  const toolBlocks = response.content.filter((b: { type: string }) => b.type === "tool_use") as Array<{
    type: "tool_use";
    id: string;
    name: string;
    input: unknown;
  }>;

  return {
    provider: "anthropic",
    model: req.model,
    text: textBlocks.map((b) => b.text).join("\n"),
    toolCalls: toolBlocks.length
      ? toolBlocks.map((b) => ({
          id: b.id,
          name: b.name,
          arguments: JSON.stringify(b.input ?? {}),
        }))
      : undefined,
    raw: response,
  };
}

async function executeChatOpenAi(
  req: ExecuteChatRequest,
  messages: ChatMessage[],
): Promise<ExecuteChatResponse> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI client not configured");

  const body: Parameters<typeof client.chat.completions.create>[0] = {
    model: req.model,
    messages: messages.map((m) => ({
      role: m.role === "tool" ? "user" : (m.role as "system" | "user" | "assistant"),
      content: m.content,
    })),
  };
  if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.responseFormat) body.response_format = req.responseFormat;
  if (req.tools?.length) body.tools = req.tools;

  const response = await client.chat.completions.create(body);
  const choice = response.choices[0];
  const text = choice?.message?.content ?? "";
  const tools = choice?.message?.tool_calls ?? [];

  return {
    provider: "openai",
    model: req.model,
    text,
    toolCalls: tools.length
      ? tools.map((t) => ({
          id: t.id,
          name: t.function?.name ?? "",
          arguments: t.function?.arguments ?? "{}",
        }))
      : undefined,
    raw: response,
  };
}

async function executeChatVllm(
  req: ExecuteChatRequest,
  messages: ChatMessage[],
): Promise<ExecuteChatResponse> {
  const response = await vllmChat({
    model: req.model,
    messages: messages.map((m) => ({
      role: m.role === "tool" ? "user" : m.role,
      content: m.content,
    })),
    temperature: req.temperature,
    maxTokens: req.maxTokens,
    tools: req.tools,
    timeoutMs: req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  const choice = response?.choices?.[0];
  const text: string = choice?.message?.content ?? "";
  const toolCalls = (choice?.message?.tool_calls ?? []) as Array<{
    id?: string;
    function: { name: string; arguments: string };
  }>;

  return {
    provider: "vllm",
    model: req.model,
    text,
    toolCalls: toolCalls.length
      ? toolCalls.map((t) => ({
          id: t.id,
          name: t.function?.name ?? "",
          arguments: t.function?.arguments ?? "{}",
        }))
      : undefined,
    raw: response,
  };
}

async function executeChatOllama(
  req: ExecuteChatRequest,
  messages: ChatMessage[],
): Promise<ExecuteChatResponse> {
  const host = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/+$/, "");
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: req.model,
      messages: messages.map((m) => ({
        role: m.role === "tool" ? "user" : m.role,
        content: m.content,
      })),
      stream: false,
      options: req.temperature !== undefined ? { temperature: req.temperature } : undefined,
    }),
    signal: AbortSignal.timeout(req.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Ollama chat failed (${res.status}): ${detail.slice(0, 500)}`);
  }
  const body = (await res.json()) as {
    message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: unknown } }> };
  };
  const text = body.message?.content ?? "";
  const tools = body.message?.tool_calls ?? [];
  return {
    provider: "ollama",
    model: req.model,
    text,
    toolCalls: tools.length
      ? tools.map((t) => ({
          name: t.function?.name ?? "",
          arguments: typeof t.function?.arguments === "string"
            ? (t.function.arguments as string)
            : JSON.stringify(t.function?.arguments ?? {}),
        }))
      : undefined,
    raw: body,
  };
}

// ----------------------------------------------------------------------------
// Embedding
// ----------------------------------------------------------------------------

export async function executeEmbedding(req: ExecuteEmbeddingRequest): Promise<ExecuteEmbeddingResponse> {
  switch (req.provider) {
    case "openai":
      return executeEmbeddingOpenAi(req);
    case "vllm":
      return executeEmbeddingVllm(req);
    case "ollama":
      return executeEmbeddingOllama(req);
    case "anthropic":
      throw new Error("Anthropic does not provide an embeddings endpoint");
    default:
      throw new Error(`Unknown embedding provider: ${req.provider}`);
  }
}

async function executeEmbeddingOpenAi(req: ExecuteEmbeddingRequest): Promise<ExecuteEmbeddingResponse> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI client not configured");
  const response = await client.embeddings.create({ model: req.model, input: req.input });
  const vectors = response.data.map((d: { embedding: number[] }) => d.embedding);
  return { provider: "openai", model: req.model, vectors, raw: response };
}

async function executeEmbeddingVllm(req: ExecuteEmbeddingRequest): Promise<ExecuteEmbeddingResponse> {
  const response = await vllmEmbed({ input: req.input, model: req.model });
  const vectors = ((response?.data ?? []) as Array<{ embedding: number[] }>).map((d) => d.embedding);
  return { provider: "vllm", model: req.model, vectors, raw: response };
}

async function executeEmbeddingOllama(req: ExecuteEmbeddingRequest): Promise<ExecuteEmbeddingResponse> {
  // Reuse the existing OllamaProvider embed implementation so transport
  // quirks (newer /api/embed vs legacy /api/embeddings) live in one place.
  // The router-chosen model is passed as a direct arg — no env mutation.
  const provider = inferenceProviderRegistry.get("ollama");
  if (!provider?.embed) throw new Error("Ollama embed not available");
  const inputs = Array.isArray(req.input) ? req.input : [req.input];
  const vectors = (await provider.embed(inputs, req.model)) ?? [];
  return { provider: "ollama", model: req.model, vectors, raw: { count: vectors.length } };
}
