import { Router } from "express";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { ollamaManager } from "../../services/ollama-manager";

/**
 * Ollama AI API Endpoints
 * Enhancement #08 - Ollama AI Integration (Phase 2)
 *
 * Endpoints:
 * - GET    /api/v1/ollama/models              - List all models
 * - POST   /api/v1/ollama/models/sync         - Sync models from Ollama API to DB
 * - POST   /api/v1/ollama/models/pull         - Download a model
 * - DELETE /api/v1/ollama/models/:name        - Delete a model
 * - GET    /api/v1/ollama/models/:name/status - Get model status
 * - POST   /api/v1/ollama/models/:name/unload - Unload a model from memory
 * - GET    /api/v1/ollama/stats               - Get usage statistics
 * - GET    /api/v1/ollama/health              - Health check
 * - GET    /api/v1/ollama/server-info         - Get Ollama server info
 */

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// ============================================================================
// MODEL LISTING
// ============================================================================

/**
 * GET /api/v1/ollama/models
 * List all models from database
 */
router.get("/models", async (_req, res) => {
  try {
    const models = await ollamaManager.listModelsFromDB();
    res.json({ models });
  } catch (error) {
    console.error("[API] List models error:", error);
    res.status(500).json({ error: "Failed to list models" });
  }
});

/**
 * POST /api/v1/ollama/models/sync
 * Sync models from Ollama API to database
 */
router.post("/models/sync", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const result = await ollamaManager.syncModels();

    await logAudit(user.id, "sync_ollama_models", "/ollama/models/sync", null, true, req);

    res.json({
      success: true,
      ...result,
      message: `Synced ${result.added + result.updated} models (${result.added} added, ${result.updated} updated, ${result.removed} removed)`,
    });
  } catch (error) {
    console.error("[API] Sync models error:", error);
    await logAudit(user.id, "sync_ollama_models", "/ollama/models/sync", null, false, req);
    res.status(500).json({ error: "Failed to sync models" });
  }
});

// ============================================================================
// MODEL DOWNLOAD
// ============================================================================

/**
 * POST /api/v1/ollama/models/pull
 * Download a model from Ollama
 *
 * Body:
 * {
 *   "modelName": "llama3:8b",
 *   "stream": false
 * }
 */
router.post("/models/pull", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;
  const { modelName, stream = false } = req.body;

  if (!modelName) {
    return res.status(400).json({ error: "modelName is required" });
  }

  try {
    const result = await ollamaManager.pullModel(modelName, { stream });

    if (result.success) {
      await logAudit(
        user.id,
        "pull_ollama_model",
        "/ollama/models/pull",
        modelName,
        true,
        req
      );

      res.json({
        success: true,
        modelName,
        message: `Successfully pulled model: ${modelName}`,
      });
    } else {
      await logAudit(
        user.id,
        "pull_ollama_model",
        "/ollama/models/pull",
        modelName,
        false,
        req
      );

      res.status(500).json({
        success: false,
        error: result.error || "Failed to pull model",
      });
    }
  } catch (error) {
    console.error("[API] Pull model error:", error);
    await logAudit(
      user.id,
      "pull_ollama_model",
      "/ollama/models/pull",
      modelName,
      false,
      req
    );
    res.status(500).json({ error: "Failed to pull model" });
  }
});

// ============================================================================
// MODEL DELETION
// ============================================================================

/**
 * DELETE /api/v1/ollama/models/:name
 * Delete a model from Ollama
 *
 * Example: DELETE /api/v1/ollama/models/llama3:8b
 */
router.delete("/models/:name", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  const { name } = req.params;

  try {
    const result = await ollamaManager.deleteModel(name);

    if (result.success) {
      await logAudit(
        user.id,
        "delete_ollama_model",
        "/ollama/models",
        name,
        true,
        req
      );

      res.json({
        success: true,
        modelName: name,
        message: `Successfully deleted model: ${name}`,
      });
    } else {
      await logAudit(
        user.id,
        "delete_ollama_model",
        "/ollama/models",
        name,
        false,
        req
      );

      res.status(500).json({
        success: false,
        error: result.error || "Failed to delete model",
      });
    }
  } catch (error) {
    console.error("[API] Delete model error:", error);
    await logAudit(
      user.id,
      "delete_ollama_model",
      "/ollama/models",
      name,
      false,
      req
    );
    res.status(500).json({ error: "Failed to delete model" });
  }
});

// ============================================================================
// MODEL STATUS & METADATA
// ============================================================================

/**
 * GET /api/v1/ollama/models/:name/status
 * Get model status and metadata
 *
 * Example: GET /api/v1/ollama/models/llama3:8b/status
 */
router.get("/models/:name/status", async (req, res) => {
  const { name } = req.params;
  const [modelName, modelTag = "latest"] = name.split(":");

  try {
    const model = await ollamaManager.getModelStatus(modelName, modelTag);

    if (!model) {
      return res.status(404).json({ error: "Model not found" });
    }

    res.json({ model });
  } catch (error) {
    console.error("[API] Get model status error:", error);
    res.status(500).json({ error: "Failed to get model status" });
  }
});

/**
 * PUT /api/v1/ollama/models/:name/metadata
 * Update model metadata
 *
 * Body:
 * {
 *   "metadata": { ... }
 * }
 */
router.put("/models/:name/metadata", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;
  const { name } = req.params;
  const { metadata } = req.body;
  const [modelName, modelTag = "latest"] = name.split(":");

  if (!metadata) {
    return res.status(400).json({ error: "metadata is required" });
  }

  try {
    await ollamaManager.updateModelMetadata(modelName, modelTag, metadata);

    await logAudit(
      user.id,
      "update_ollama_model_metadata",
      "/ollama/models/metadata",
      name,
      true,
      req
    );

    res.json({
      success: true,
      modelName: name,
      message: "Model metadata updated successfully",
    });
  } catch (error) {
    console.error("[API] Update model metadata error:", error);
    await logAudit(
      user.id,
      "update_ollama_model_metadata",
      "/ollama/models/metadata",
      name,
      false,
      req
    );
    res.status(500).json({ error: "Failed to update model metadata" });
  }
});

// ============================================================================
// MODEL UNLOAD
// ============================================================================

/**
 * POST /api/v1/ollama/models/:name/unload
 * Unload a model from memory (but keep it downloaded)
 *
 * Example: POST /api/v1/ollama/models/llama3:8b/unload
 */
router.post("/models/:name/unload", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;
  const { name } = req.params;

  try {
    const result = await ollamaManager.unloadModel(name);

    if (result.success) {
      await logAudit(
        user.id,
        "unload_ollama_model",
        "/ollama/models/unload",
        name,
        true,
        req
      );

      res.json({
        success: true,
        modelName: name,
        message: `Successfully unloaded model: ${name}`,
      });
    } else {
      await logAudit(
        user.id,
        "unload_ollama_model",
        "/ollama/models/unload",
        name,
        false,
        req
      );

      res.status(500).json({
        success: false,
        error: result.error || "Failed to unload model",
      });
    }
  } catch (error) {
    console.error("[API] Unload model error:", error);
    await logAudit(
      user.id,
      "unload_ollama_model",
      "/ollama/models/unload",
      name,
      false,
      req
    );
    res.status(500).json({ error: "Failed to unload model" });
  }
});

// ============================================================================
// STATISTICS & ANALYTICS
// ============================================================================

/**
 * GET /api/v1/ollama/stats
 * Get model usage statistics
 */
router.get("/stats", async (_req, res) => {
  try {
    const stats = await ollamaManager.getUsageStats();
    res.json({ stats });
  } catch (error) {
    console.error("[API] Get stats error:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

// ============================================================================
// HEALTH & SERVER INFO
// ============================================================================

/**
 * GET /api/v1/ollama/health
 * Health check for Ollama service
 */
router.get("/health", async (_req, res) => {
  try {
    const health = await ollamaManager.healthCheck();

    if (health.healthy) {
      res.json({
        healthy: true,
        status: "ok",
        message: "Ollama service is healthy",
      });
    } else {
      res.status(503).json({
        healthy: false,
        status: "unavailable",
        error: health.error,
      });
    }
  } catch (error) {
    console.error("[API] Health check error:", error);
    res.status(503).json({
      healthy: false,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/v1/ollama/server-info
 * Get Ollama server information
 */
router.get("/server-info", async (_req, res) => {
  try {
    const info = await ollamaManager.getServerInfo();
    res.json({ info });
  } catch (error) {
    console.error("[API] Get server info error:", error);
    res.status(500).json({ error: "Failed to get server info" });
  }
});

// ============================================================================
// MANUAL AUTO-UNLOAD TRIGGER (for testing)
// ============================================================================

/**
 * POST /api/v1/ollama/check-inactive
 * Manually trigger check for inactive models (admin only)
 */
router.post("/check-inactive", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const unloadedCount = await ollamaManager.checkAndUnloadInactiveModels();

    await logAudit(
      user.id,
      "check_inactive_ollama_models",
      "/ollama/check-inactive",
      null,
      true,
      req
    );

    res.json({
      success: true,
      unloadedCount,
      message: `Checked and unloaded ${unloadedCount} inactive models`,
    });
  } catch (error) {
    console.error("[API] Check inactive models error:", error);
    await logAudit(
      user.id,
      "check_inactive_ollama_models",
      "/ollama/check-inactive",
      null,
      false,
      req
    );
    res.status(500).json({ error: "Failed to check inactive models" });
  }
});

export default router;
