import { Router } from "express";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";

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
router.get("/llm", async (req, res) => {
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
  } catch (error) {
    console.error("Get LLM settings error:", error);
    res.status(500).json({ error: "Failed to get settings" });
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
  } catch (error) {
    console.error("Save LLM settings error:", error);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
