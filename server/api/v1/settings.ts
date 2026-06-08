import { Router } from "express";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { invalidateAIClients } from "../../services/ai-clients";
import { readFeatureFlags } from "../../../shared/feature-flags";
import { modelCache } from "../../services/inference/model-cache";

const router = Router();

router.use(ensureAuthenticated);

// GET /api/v1/settings/features - Resolved feature flag map (any authenticated user)
// Mounted before the admin role guard so the client can gate UI on flags.
router.get("/features", (_req, res) => {
  res.json({ features: readFeatureFlags() });
});

// Everything below this line is admin-only.
router.use(ensureRole("admin"));

// In-memory storage for LLM settings (synced with process.env and .env file)
const llmSettings = {
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
  defaultModel: process.env.DEFAULT_MODEL || "claude-sonnet-4-5",
  // Per-role default models. defaultModel above stays as the global fallback;
  // these three carry the role-specific overrides surfaced in Settings → Default Models.
  // Empty string means "fall back to defaultModel".
  defaultAgentModel: process.env.DEFAULT_AGENT_MODEL || "",
  defaultReasoningModel: process.env.DEFAULT_REASONING_MODEL || "",
  defaultEmbeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  ollamaHost: process.env.OLLAMA_HOST || "http://localhost:11434",
};

/**
 * Persist API key changes to both process.env and the .env file on disk.
 * This ensures keys survive server restarts and are immediately available
 * to all services via process.env.
 */
function persistEnvKeys(updates: Record<string, string>): void {
  // 1. Update process.env in the running process
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value;
  }

  // 2. Write to .env file on disk
  const envPath = path.resolve(process.cwd(), ".env");
  let envContent = "";
  try {
    envContent = fs.readFileSync(envPath, "utf-8");
  } catch {
    // .env doesn't exist yet — will create it
  }

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, envContent, "utf-8");

  // 3. Invalidate cached AI clients so they pick up the new keys
  invalidateAIClients();
}

/**
 * Apply key updates: save to llmSettings, process.env, and .env file.
 * Only updates keys that are provided and not masked placeholders from the GET response.
 */
function applyKeyUpdates(body: {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  tavilyApiKey?: string;
  defaultModel?: string;
  defaultAgentModel?: string;
  defaultReasoningModel?: string;
  defaultEmbeddingModel?: string;
  ollamaHost?: string;
}): void {
  const envUpdates: Record<string, string> = {};

  if (body.openaiApiKey && !body.openaiApiKey.startsWith("sk-...")) {
    llmSettings.openaiApiKey = body.openaiApiKey;
    envUpdates.OPENAI_API_KEY = body.openaiApiKey;
  }
  if (body.anthropicApiKey && !body.anthropicApiKey.startsWith("sk-ant-...")) {
    llmSettings.anthropicApiKey = body.anthropicApiKey;
    envUpdates.ANTHROPIC_API_KEY = body.anthropicApiKey;
  }
  if (body.tavilyApiKey && !body.tavilyApiKey.startsWith("tvly-...")) {
    llmSettings.tavilyApiKey = body.tavilyApiKey;
    envUpdates.TAVILY_API_KEY = body.tavilyApiKey;
  }
  if (body.defaultModel) {
    llmSettings.defaultModel = body.defaultModel;
    envUpdates.DEFAULT_MODEL = body.defaultModel;
  }
  // Per-role overrides — empty string clears the override (env var stays empty
  // so callers fall back to DEFAULT_MODEL). The embedding override writes
  // EMBEDDING_MODEL to match the v2.9.1 Phase 7 routing-layer name already in
  // .env.example; agent + reasoning use new env-var names.
  if (typeof body.defaultAgentModel === "string") {
    llmSettings.defaultAgentModel = body.defaultAgentModel;
    envUpdates.DEFAULT_AGENT_MODEL = body.defaultAgentModel;
  }
  if (typeof body.defaultReasoningModel === "string") {
    llmSettings.defaultReasoningModel = body.defaultReasoningModel;
    envUpdates.DEFAULT_REASONING_MODEL = body.defaultReasoningModel;
  }
  if (typeof body.defaultEmbeddingModel === "string") {
    llmSettings.defaultEmbeddingModel = body.defaultEmbeddingModel;
    envUpdates.EMBEDDING_MODEL = body.defaultEmbeddingModel;
  }
  if (typeof body.ollamaHost === "string" && body.ollamaHost.trim().length > 0) {
    try {
      const url = new URL(body.ollamaHost.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Protocol must be http or https");
      }
      const normalized = body.ollamaHost.trim().replace(/\/+$/, "");
      llmSettings.ollamaHost = normalized;
      envUpdates.OLLAMA_HOST = normalized;
    } catch (e: any) {
      throw new Error(`Invalid ollamaHost: ${e?.message || "not a valid URL"}`);
    }
  }

  if (Object.keys(envUpdates).length > 0) {
    persistEnvKeys(envUpdates);
    // Invalidate the model-cache entries for any provider whose endpoint or
    // key changed. The next router call will re-probe lazily; the operator
    // can also force an immediate re-probe via POST /llm/refresh-models.
    if (envUpdates.OPENAI_API_KEY) modelCache.invalidate("openai");
    if (envUpdates.ANTHROPIC_API_KEY) modelCache.invalidate("anthropic");
    if (envUpdates.OLLAMA_HOST) modelCache.invalidate("ollama");
  }
}

// GET /api/v1/settings/llm - Get LLM settings + cached available models per
// provider so the Settings UI can render an accurate dropdown without
// needing a separate roundtrip.
router.get("/llm", async (_req, res) => {
  try {
    // Mask API keys for security (show only last 4 characters)
    const maskedSettings = {
      openaiApiKey: llmSettings.openaiApiKey
        ? `sk-...${llmSettings.openaiApiKey.slice(-4)}`
        : "",
      anthropicApiKey: llmSettings.anthropicApiKey
        ? `sk-ant-...${llmSettings.anthropicApiKey.slice(-4)}`
        : "",
      tavilyApiKey: llmSettings.tavilyApiKey
        ? `tvly-...${llmSettings.tavilyApiKey.slice(-4)}`
        : "",
      defaultModel: llmSettings.defaultModel,
      defaultAgentModel: llmSettings.defaultAgentModel,
      defaultReasoningModel: llmSettings.defaultReasoningModel,
      defaultEmbeddingModel: llmSettings.defaultEmbeddingModel,
      ollamaHost: llmSettings.ollamaHost,
    };

    res.json({ settings: maskedSettings, availableModels: modelCache.snapshot() });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get settings", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/settings/llm/refresh-models - Re-probe all four providers and
// return the refreshed cache snapshot. Used by the Settings UI "Refresh
// models" button so the operator's dropdown reflects current Ollama / vLLM
// model lists alongside the cloud catalogs.
router.post("/llm/refresh-models", async (_req, res) => {
  try {
    await modelCache.refresh();
    res.json({ availableModels: modelCache.snapshot() });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to refresh models", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/settings/llm - Save LLM settings
router.post("/llm", async (req, res) => {
  try {
    applyKeyUpdates(req.body);
    res.json({
      success: true,
      message: "LLM settings saved successfully"
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save settings", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/settings/ai-provider - Get AI provider settings (alias for /llm)
router.get("/ai-provider", async (_req, res) => {
  try {
    const maskedSettings = {
      openaiApiKey: llmSettings.openaiApiKey
        ? `sk-...${llmSettings.openaiApiKey.slice(-4)}`
        : "",
      anthropicApiKey: llmSettings.anthropicApiKey
        ? `sk-ant-...${llmSettings.anthropicApiKey.slice(-4)}`
        : "",
      tavilyApiKey: llmSettings.tavilyApiKey
        ? `tvly-...${llmSettings.tavilyApiKey.slice(-4)}`
        : "",
      defaultModel: llmSettings.defaultModel,
      defaultAgentModel: llmSettings.defaultAgentModel,
      defaultReasoningModel: llmSettings.defaultReasoningModel,
      defaultEmbeddingModel: llmSettings.defaultEmbeddingModel,
      ollamaHost: llmSettings.ollamaHost,
    };

    res.json({ settings: maskedSettings });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get AI provider settings", details: error?.message || "Internal server error" });
  }
});

// PUT /api/v1/settings/ai-provider - Update AI provider settings (alias for POST /llm)
router.put("/ai-provider", async (req, res) => {
  try {
    applyKeyUpdates(req.body);
    res.json({
      success: true,
      message: "AI provider settings saved successfully"
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save AI provider settings", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/settings/ai-provider/status/:provider - Check API provider status
router.get("/ai-provider/status/:provider", async (req, res) => {
  const { provider } = req.params;

  try {
    if (provider === "openai") {
      if (!llmSettings.openaiApiKey) {
        return res.json({
          connected: false,
          configured: false,
          message: "OpenAI API key not configured"
        });
      }

      try {
        const openai = new OpenAI({ apiKey: llmSettings.openaiApiKey });
        await openai.models.list();

        res.json({
          connected: true,
          configured: true,
          message: "OpenAI API connection successful"
        });
      } catch (error: any) {
        res.json({
          connected: false,
          configured: true,
          message: `OpenAI API error: ${error?.message || "Connection failed"}`,
          error: error?.message
        });
      }
    } else if (provider === "anthropic") {
      if (!llmSettings.anthropicApiKey) {
        return res.json({
          connected: false,
          configured: false,
          message: "Anthropic API key not configured"
        });
      }

      try {
        const anthropic = new Anthropic({ apiKey: llmSettings.anthropicApiKey });
        if (llmSettings.anthropicApiKey.startsWith("sk-ant-")) {
          res.json({
            connected: true,
            configured: true,
            message: "Anthropic API key configured (format valid)"
          });
        } else {
          res.json({
            connected: false,
            configured: true,
            message: "Anthropic API key format invalid"
          });
        }
      } catch (error: any) {
        res.json({
          connected: false,
          configured: true,
          message: `Anthropic API error: ${error?.message || "Connection failed"}`,
          error: error?.message
        });
      }
    } else {
      res.status(400).json({
        error: "Invalid provider",
        message: "Provider must be 'openai' or 'anthropic'"
      });
    }
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to check provider status",
      details: error?.message || "Internal server error"
    });
  }
});

export default router;
