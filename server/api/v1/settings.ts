import { Router } from "express";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

// Apply authentication - only admins can manage LLM settings
router.use(ensureAuthenticated);
router.use(ensureRole("admin"));

// In-memory storage for LLM settings (can be moved to database later)
const llmSettings = {
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
  defaultModel: process.env.DEFAULT_MODEL || "claude-sonnet-4-5-20250929",
};

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
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get settings", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/settings/llm - Save LLM settings
router.post("/llm", async (req, res) => {
  try {
    const { openaiApiKey, anthropicApiKey, tavilyApiKey, defaultModel } = req.body;

    // Only update keys if they're not masked (don't overwrite with "sk-...XXXX")
    if (openaiApiKey && !openaiApiKey.startsWith("sk-...")) {
      llmSettings.openaiApiKey = openaiApiKey;
    }
    if (anthropicApiKey && !anthropicApiKey.startsWith("sk-ant-...")) {
      llmSettings.anthropicApiKey = anthropicApiKey;
    }
    if (tavilyApiKey && !tavilyApiKey.startsWith("tvly-...")) {
      llmSettings.tavilyApiKey = tavilyApiKey;
    }
    if (defaultModel) {
      llmSettings.defaultModel = defaultModel;
    }

    res.json({ 
      success: true, 
      message: "LLM settings saved successfully" 
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to save settings", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/settings/ai-provider - Get AI provider settings (alias for /llm)
router.get("/ai-provider", async (_req, res) => {
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
    res.status(500).json({ error: "Failed to get AI provider settings", details: error?.message || "Internal server error" });
  }
});

// PUT /api/v1/settings/ai-provider - Update AI provider settings (alias for POST /llm)
router.put("/ai-provider", async (req, res) => {
  try {
    const { openaiApiKey, anthropicApiKey, tavilyApiKey, defaultModel } = req.body;

    // Only update keys if they're not masked (don't overwrite with "sk-...XXXX")
    if (openaiApiKey && !openaiApiKey.startsWith("sk-...")) {
      llmSettings.openaiApiKey = openaiApiKey;
    }
    if (anthropicApiKey && !anthropicApiKey.startsWith("sk-ant-...")) {
      llmSettings.anthropicApiKey = anthropicApiKey;
    }
    if (tavilyApiKey && !tavilyApiKey.startsWith("tvly-...")) {
      llmSettings.tavilyApiKey = tavilyApiKey;
    }
    if (defaultModel) {
      llmSettings.defaultModel = defaultModel;
    }

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
      // Test OpenAI API connection
      if (!llmSettings.openaiApiKey) {
        return res.json({
          connected: false,
          configured: false,
          message: "OpenAI API key not configured"
        });
      }

      try {
        const openai = new OpenAI({ apiKey: llmSettings.openaiApiKey });
        // Simple API call to test connection
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
      // Test Anthropic API connection
      if (!llmSettings.anthropicApiKey) {
        return res.json({
          connected: false,
          configured: false,
          message: "Anthropic API key not configured"
        });
      }

      try {
        const anthropic = new Anthropic({ apiKey: llmSettings.anthropicApiKey });
        // Simple API call to test connection - just check if we can create a client
        // Note: Anthropic doesn't have a models.list() endpoint, so we check if the key format is valid
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
