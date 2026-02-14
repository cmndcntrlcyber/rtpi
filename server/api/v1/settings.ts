import { Router } from "express";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { invalidateAIClients } from "../../services/ai-clients";

const router = Router();

// Apply authentication - only admins can manage LLM settings
router.use(ensureAuthenticated);
router.use(ensureRole("admin"));

// In-memory storage for LLM settings (synced with process.env and .env file)
const llmSettings = {
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
  defaultModel: process.env.DEFAULT_MODEL || "claude-sonnet-4-5",
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

  if (Object.keys(envUpdates).length > 0) {
    persistEnvKeys(envUpdates);
  }
}

// GET /api/v1/settings/llm - Get LLM settings
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
    };

    res.json({ settings: maskedSettings });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get settings", details: error?.message || "Internal server error" });
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
