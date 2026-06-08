/**
 * Tests for the inference resolver — pure functions that compute the
 * provider/model fallback order for Agent / Reasoning / Embedding kinds.
 *
 * No SDK mocks needed: we pass a SettingsSnapshot directly so behavior
 * is deterministic across environments.
 */

import { describe, expect, it } from "vitest";
import {
  inferProviderFromModel,
  resolveAgentTargets,
  resolveEmbeddingTargets,
  resolveReasoningTargets,
  resolveTargets,
  type SettingsSnapshot,
} from "../../../server/services/inference/resolver";

const EMPTY_SETTINGS: SettingsSnapshot = {
  defaultModel: "",
  defaultAgentModel: "",
  defaultReasoningModel: "",
  defaultEmbeddingModel: "",
};

describe("inferProviderFromModel", () => {
  it("maps claude-* to anthropic", () => {
    expect(inferProviderFromModel("claude-sonnet-4-5")).toBe("anthropic");
    expect(inferProviderFromModel("claude-opus-4")).toBe("anthropic");
  });

  it("maps gpt-* and openai/* to openai", () => {
    expect(inferProviderFromModel("gpt-4o-mini")).toBe("openai");
    expect(inferProviderFromModel("openai/gpt-5")).toBe("openai");
    expect(inferProviderFromModel("o1-mini")).toBe("openai");
  });

  it("maps text-embedding-* to openai", () => {
    expect(inferProviderFromModel("text-embedding-3-small")).toBe("openai");
  });

  it("maps HuggingFace vendor/model to vllm", () => {
    expect(inferProviderFromModel("Qwen/Qwen3.5-9B")).toBe("vllm");
    expect(inferProviderFromModel("meta-llama/Llama-3-70B")).toBe("vllm");
  });

  it("maps hf.co/* GGUF pull ids to ollama (not vllm)", () => {
    // Ollama pulls HuggingFace GGUFs via hf.co/<user>/<repo>:<quant>. These
    // contain "/" but must route to Ollama, not vLLM (regression: workflow
    // agents were falling back to Anthropic when these were classed as vllm).
    expect(inferProviderFromModel("hf.co/cmndcntrlcyber/qwen14b-code-trainer-v6-gguf:Q4_K_M")).toBe("ollama");
    expect(inferProviderFromModel("hf.co/unsloth/gemma-4-26B-A4B-it-qat-GGUF:UD-Q4_K_XL")).toBe("ollama");
    expect(inferProviderFromModel("huggingface.co/TheBloke/Mistral-7B-GGUF:Q4_K_M")).toBe("ollama");
  });

  it("maps tagged names (name:tag) to ollama", () => {
    expect(inferProviderFromModel("llama3:8b")).toBe("ollama");
    expect(inferProviderFromModel("nomic-embed-text:latest")).toBe("ollama");
  });

  it("returns null for empty input", () => {
    expect(inferProviderFromModel("")).toBeNull();
    expect(inferProviderFromModel("   ")).toBeNull();
  });
});

describe("resolveAgentTargets", () => {
  it("honors per-agent providerId + model override above everything", () => {
    const targets = resolveAgentTargets(
      { agentOverride: { providerId: "ollama", model: "llama3:8b" } },
      { ...EMPTY_SETTINGS, defaultAgentModel: "claude-sonnet-4-5" },
    );
    expect(targets[0]).toEqual({ provider: "ollama", model: "llama3:8b", source: "agent_override" });
  });

  it("uses provider's default model when override has providerId only", () => {
    const targets = resolveAgentTargets(
      { agentOverride: { providerId: "anthropic" } },
      EMPTY_SETTINGS,
    );
    expect(targets[0]).toEqual({ provider: "anthropic", model: "claude-sonnet-4-5", source: "agent_override" });
  });

  it("infers provider from override model when providerId is absent", () => {
    const targets = resolveAgentTargets(
      { agentOverride: { model: "gpt-4o-mini" } },
      EMPTY_SETTINGS,
    );
    expect(targets[0]).toEqual({ provider: "openai", model: "gpt-4o-mini", source: "agent_override" });
  });

  it("settings_kind beats settings_global when both are set", () => {
    const targets = resolveAgentTargets({}, {
      ...EMPTY_SETTINGS,
      defaultAgentModel: "claude-sonnet-4-5",
      defaultModel: "gpt-4o-mini",
    });
    expect(targets[0]).toEqual({ provider: "anthropic", model: "claude-sonnet-4-5", source: "settings_kind" });
    expect(targets[1]).toEqual({ provider: "openai", model: "gpt-4o-mini", source: "settings_global" });
  });

  it("falls through every provider's default at the end of the chain", () => {
    const targets = resolveAgentTargets({}, EMPTY_SETTINGS);
    const providers = targets.map((t) => t.provider);
    expect(providers).toContain("anthropic");
    expect(providers).toContain("openai");
    expect(providers).toContain("vllm");
    expect(providers).toContain("ollama");
  });

  it("dedupes when Settings echoes a provider's default", () => {
    const targets = resolveAgentTargets({}, {
      ...EMPTY_SETTINGS,
      defaultAgentModel: "claude-sonnet-4-5",
    });
    const anthropicHits = targets.filter((t) => t.provider === "anthropic" && t.model === "claude-sonnet-4-5");
    expect(anthropicHits).toHaveLength(1);
    expect(anthropicHits[0].source).toBe("settings_kind");
  });
});

describe("resolveReasoningTargets", () => {
  it("ignores agent overrides — reasoning has no per-agent concept", () => {
    const targets = resolveReasoningTargets({ explicitModel: "" }, {
      ...EMPTY_SETTINGS,
      defaultReasoningModel: "claude-sonnet-4-5",
    });
    expect(targets[0].source).toBe("settings_kind");
    expect(targets[0].model).toBe("claude-sonnet-4-5");
  });

  it("explicit per-call model wins over Settings", () => {
    const targets = resolveReasoningTargets({ explicitModel: "gpt-4o-mini" }, {
      ...EMPTY_SETTINGS,
      defaultReasoningModel: "claude-sonnet-4-5",
    });
    expect(targets[0]).toEqual({ provider: "openai", model: "gpt-4o-mini", source: "agent_override" });
  });
});

describe("resolveEmbeddingTargets", () => {
  it("never includes anthropic — no embeddings endpoint", () => {
    const targets = resolveEmbeddingTargets({}, EMPTY_SETTINGS);
    expect(targets.find((t) => t.provider === "anthropic")).toBeUndefined();
  });

  it("starts with Settings embedding model when set", () => {
    const targets = resolveEmbeddingTargets({}, {
      ...EMPTY_SETTINGS,
      defaultEmbeddingModel: "text-embedding-3-small",
    });
    expect(targets[0]).toEqual({ provider: "openai", model: "text-embedding-3-small", source: "settings_kind" });
  });

  it("does not consult global DEFAULT_MODEL (chat model would 404 on /embeddings)", () => {
    const targets = resolveEmbeddingTargets({}, {
      ...EMPTY_SETTINGS,
      defaultModel: "claude-sonnet-4-5",
    });
    // Should not contain claude-sonnet-4-5 — embed path never tries it.
    expect(targets.find((t) => t.model === "claude-sonnet-4-5")).toBeUndefined();
  });

  it("orders fallback as ollama → openai → vllm (ollama first, vllm last)", () => {
    const targets = resolveEmbeddingTargets({}, EMPTY_SETTINGS);
    const providers = targets.map((t) => t.provider);
    expect(providers.indexOf("ollama")).toBeLessThan(providers.indexOf("openai"));
    expect(providers.indexOf("openai")).toBeLessThan(providers.indexOf("vllm"));
  });
});

describe("resolveTargets dispatcher", () => {
  it("routes to the right kind-specific resolver — ollama leads every chain", () => {
    // Chain order: ollama first (local, free), cloud middle, vllm last.
    expect(resolveTargets("agent", {}, EMPTY_SETTINGS)[0].provider).toBe("ollama");
    expect(resolveTargets("reasoning", {}, EMPTY_SETTINGS)[0].provider).toBe("ollama");
    expect(resolveTargets("embedding", {}, EMPTY_SETTINGS)[0].provider).toBe("ollama");
  });
});
