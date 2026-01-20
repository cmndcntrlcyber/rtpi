import { db } from "../db";
import { ollamaModels } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Ollama Model Management Service
 * Enhancement #08 - Ollama AI Integration (Phase 2)
 *
 * Handles:
 * - Model downloads and registration
 * - Model deletion and cleanup
 * - Model listing and status
 * - Auto-unload logic (30 min timeout)
 * - Database tracking and metadata
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface OllamaModel {
  id: string;
  modelName: string;
  modelTag: string;
  modelSize: number | null;
  parameterSize: string | null;
  quantization: string | null;
  downloadedAt: Date | null;
  lastUsed: Date | null;
  usageCount: number;
  status: "available" | "downloading" | "loading" | "loaded" | "unloaded" | "error";
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OllamaAPIModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaAPIResponse {
  models: OllamaAPIModel[];
}

export interface ModelDownloadProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export interface ModelPullOptions {
  stream?: boolean;
  insecure?: boolean;
}

export interface ModelUsageStats {
  totalModels: number;
  loadedModels: number;
  totalUsage: number;
  totalSize: number;
  avgUsagePerModel: number;
  mostUsedModel: string | null;
  leastUsedModel: string | null;
}

// ============================================================================
// OLLAMA MANAGER CLASS
// ============================================================================

export class OllamaManager {
  private readonly OLLAMA_HOST: string;
  private readonly AUTO_UNLOAD_TIMEOUT: number = 30 * 60 * 1000; // 30 minutes
  private readonly CHECK_INTERVAL: number = 5 * 60 * 1000; // 5 minutes
  private unloadTimer: NodeJS.Timeout | null = null;

  constructor(host: string = process.env.OLLAMA_HOST || "http://localhost:11434") {
    this.OLLAMA_HOST = host.replace(/\/$/, ""); // Remove trailing slash
  }

  // ==========================================================================
  // MODEL LISTING (#OL-14)
  // ==========================================================================

  /**
   * List all models from Ollama API
   */
  async listModelsFromAPI(): Promise<OllamaAPIModel[]> {
    try {
      const response = await fetch(`${this.OLLAMA_HOST}/api/tags`);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data: OllamaAPIResponse = await response.json();
      return data.models || [];
    } catch (error) {
      console.error("[OllamaManager] Error listing models from API:", error);
      throw error;
    }
  }

  /**
   * List all models from database
   */
  async listModelsFromDB(): Promise<OllamaModel[]> {
    try {
      const models = await db.select().from(ollamaModels);
      return models as OllamaModel[];
    } catch (error) {
      console.error("[OllamaManager] Error listing models from DB:", error);
      throw error;
    }
  }

  /**
   * Sync models from Ollama API to database
   */
  async syncModels(): Promise<{ added: number; updated: number; removed: number }> {
    try {
      console.log("[OllamaManager] Syncing models from Ollama API to database...");

      const apiModels = await this.listModelsFromAPI();
      const dbModels = await this.listModelsFromDB();

      let added = 0;
      let updated = 0;
      let removed = 0;

      // Track which models exist in API
      const apiModelNames = new Set(apiModels.map(m => m.name));

      // Add or update models from API
      for (const apiModel of apiModels) {
        const [modelName, modelTag = "latest"] = apiModel.name.split(":");

        const existingModel = dbModels.find(
          m => m.modelName === modelName && m.modelTag === modelTag
        );

        const modelData = {
          modelName,
          modelTag,
          modelSize: apiModel.size,
          parameterSize: apiModel.details?.parameter_size || null,
          quantization: apiModel.details?.quantization_level || null,
          status: "available" as const,
          metadata: {
            digest: apiModel.digest,
            modifiedAt: apiModel.modified_at,
            format: apiModel.details?.format,
            family: apiModel.details?.family,
          },
        };

        if (existingModel) {
          // Update existing model
          await db
            .update(ollamaModels)
            .set({
              ...modelData,
              downloadedAt: existingModel.downloadedAt || new Date(),
              updatedAt: new Date(),
            })
            .where(eq(ollamaModels.id, existingModel.id));
          updated++;
        } else {
          // Add new model
          await db.insert(ollamaModels).values({
            ...modelData,
            downloadedAt: new Date(),
          });
          added++;
        }
      }

      // Mark models as unavailable if they don't exist in API
      for (const dbModel of dbModels) {
        const fullName = `${dbModel.modelName}:${dbModel.modelTag}`;
        if (!apiModelNames.has(fullName) && dbModel.status !== "error") {
          await db
            .update(ollamaModels)
            .set({ status: "error", updatedAt: new Date() })
            .where(eq(ollamaModels.id, dbModel.id));
          removed++;
        }
      }

      console.log(`[OllamaManager] Sync complete: ${added} added, ${updated} updated, ${removed} removed`);
      return { added, updated, removed };
    } catch (error) {
      console.error("[OllamaManager] Error syncing models:", error);
      throw error;
    }
  }

  // ==========================================================================
  // MODEL DOWNLOAD (#OL-10)
  // ==========================================================================

  /**
   * Pull/download a model from Ollama
   */
  async pullModel(
    modelName: string,
    options: ModelPullOptions = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[OllamaManager] Pulling model: ${modelName}`);

      // Update status to downloading
      const [name, tag = "latest"] = modelName.split(":");
      await this.updateModelStatus(name, tag, "downloading");

      const response = await fetch(`${this.OLLAMA_HOST}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: modelName,
          stream: options.stream || false,
          insecure: options.insecure || false,
        }),
      });

      if (!response.ok) {
        const error = `Failed to pull model: ${response.status} ${response.statusText}`;
        await this.updateModelStatus(name, tag, "error");
        return { success: false, error };
      }

      // If streaming, read the stream
      if (options.stream) {
        const reader = response.body?.getReader();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            const lines = text.split("\n").filter(line => line.trim());

            for (const line of lines) {
              try {
                const progress: ModelDownloadProgress = JSON.parse(line);
                console.log(`[OllamaManager] Download progress: ${progress.status}`);
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      } else {
        await response.json();
      }

      // Update status to available
      await this.updateModelStatus(name, tag, "available");

      // Sync to update database with latest info
      await this.syncModels();

      console.log(`[OllamaManager] Successfully pulled model: ${modelName}`);
      return { success: true };
    } catch (error) {
      console.error("[OllamaManager] Error pulling model:", error);
      const [name, tag = "latest"] = modelName.split(":");
      await this.updateModelStatus(name, tag, "error");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==========================================================================
  // MODEL DELETION (#OL-11)
  // ==========================================================================

  /**
   * Delete a model from Ollama
   */
  async deleteModel(modelName: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[OllamaManager] Deleting model: ${modelName}`);

      const response = await fetch(`${this.OLLAMA_HOST}/api/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        const error = `Failed to delete model: ${response.status} ${response.statusText}`;
        return { success: false, error };
      }

      // Remove from database
      const [name, tag = "latest"] = modelName.split(":");
      await db
        .delete(ollamaModels)
        .where(
          sql`${ollamaModels.modelName} = ${name} AND ${ollamaModels.modelTag} = ${tag}`
        );

      console.log(`[OllamaManager] Successfully deleted model: ${modelName}`);
      return { success: true };
    } catch (error) {
      console.error("[OllamaManager] Error deleting model:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==========================================================================
  // MODEL STATUS & METADATA (#OL-15)
  // ==========================================================================

  /**
   * Get model status
   */
  async getModelStatus(
    modelName: string,
    modelTag: string = "latest"
  ): Promise<OllamaModel | null> {
    try {
      const results = await db
        .select()
        .from(ollamaModels)
        .where(
          sql`${ollamaModels.modelName} = ${modelName} AND ${ollamaModels.modelTag} = ${modelTag}`
        );

      return results.length > 0 ? (results[0] as OllamaModel) : null;
    } catch (error) {
      console.error("[OllamaManager] Error getting model status:", error);
      return null;
    }
  }

  /**
   * Update model status
   */
  async updateModelStatus(
    modelName: string,
    modelTag: string,
    status: OllamaModel["status"]
  ): Promise<void> {
    try {
      // First try to update existing model
      const result = await db
        .update(ollamaModels)
        .set({ status, updatedAt: new Date() })
        .where(
          sql`${ollamaModels.modelName} = ${modelName} AND ${ollamaModels.modelTag} = ${modelTag}`
        );

      // If no rows updated, create new entry
      if (result.rowCount === 0) {
        await db.insert(ollamaModels).values({
          modelName,
          modelTag,
          status,
        });
      }
    } catch (error) {
      console.error("[OllamaManager] Error updating model status:", error);
      throw error;
    }
  }

  /**
   * Update model metadata
   */
  async updateModelMetadata(
    modelName: string,
    modelTag: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await db
        .update(ollamaModels)
        .set({ metadata, updatedAt: new Date() })
        .where(
          sql`${ollamaModels.modelName} = ${modelName} AND ${ollamaModels.modelTag} = ${modelTag}`
        );
    } catch (error) {
      console.error("[OllamaManager] Error updating model metadata:", error);
      throw error;
    }
  }

  /**
   * Track model usage
   */
  async trackModelUsage(modelName: string, modelTag: string = "latest"): Promise<void> {
    try {
      await db
        .update(ollamaModels)
        .set({
          lastUsed: new Date(),
          usageCount: sql`${ollamaModels.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(
          sql`${ollamaModels.modelName} = ${modelName} AND ${ollamaModels.modelTag} = ${modelTag}`
        );
    } catch (error) {
      console.error("[OllamaManager] Error tracking model usage:", error);
    }
  }

  // ==========================================================================
  // AUTO-UNLOAD LOGIC (#OL-13)
  // ==========================================================================

  /**
   * Start auto-unload background job
   */
  startAutoUnloadJob(): void {
    if (this.unloadTimer) {
      console.log("[OllamaManager] Auto-unload job already running");
      return;
    }

    console.log(
      `[OllamaManager] Starting auto-unload job (check every ${this.CHECK_INTERVAL / 1000}s, unload after ${this.AUTO_UNLOAD_TIMEOUT / 1000}s inactivity)`
    );

    this.unloadTimer = setInterval(async () => {
      await this.checkAndUnloadInactiveModels();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop auto-unload background job
   */
  stopAutoUnloadJob(): void {
    if (this.unloadTimer) {
      clearInterval(this.unloadTimer);
      this.unloadTimer = null;
      console.log("[OllamaManager] Auto-unload job stopped");
    }
  }

  /**
   * Check for inactive models and unload them
   */
  async checkAndUnloadInactiveModels(): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - this.AUTO_UNLOAD_TIMEOUT);

      // Find loaded models that haven't been used recently
      const inactiveModels = await db
        .select()
        .from(ollamaModels)
        .where(
          sql`${ollamaModels.status} = 'loaded' AND (${ollamaModels.lastUsed} IS NULL OR ${ollamaModels.lastUsed} < ${cutoffTime.toISOString()})`
        );

      if (inactiveModels.length === 0) {
        return 0;
      }

      console.log(`[OllamaManager] Found ${inactiveModels.length} inactive models to unload`);

      let unloadedCount = 0;

      for (const model of inactiveModels) {
        const fullName = `${model.modelName}:${model.modelTag}`;
        const result = await this.unloadModel(fullName);
        if (result.success) {
          unloadedCount++;
        }
      }

      console.log(`[OllamaManager] Unloaded ${unloadedCount} inactive models`);
      return unloadedCount;
    } catch (error) {
      console.error("[OllamaManager] Error checking inactive models:", error);
      return 0;
    }
  }

  /**
   * Unload a model from memory (but keep it downloaded)
   */
  async unloadModel(modelName: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[OllamaManager] Unloading model: ${modelName}`);

      // Ollama doesn't have a direct unload API, but we can mark it as unloaded
      // The model will be unloaded automatically based on OLLAMA_KEEP_ALIVE setting
      const [name, tag = "latest"] = modelName.split(":");
      await this.updateModelStatus(name, tag, "unloaded");

      console.log(`[OllamaManager] Marked model as unloaded: ${modelName}`);
      return { success: true };
    } catch (error) {
      console.error("[OllamaManager] Error unloading model:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==========================================================================
  // STATISTICS & ANALYTICS
  // ==========================================================================

  /**
   * Get model usage statistics
   */
  async getUsageStats(): Promise<ModelUsageStats> {
    try {
      const models = await this.listModelsFromDB();

      const stats: ModelUsageStats = {
        totalModels: models.length,
        loadedModels: models.filter(m => m.status === "loaded").length,
        totalUsage: models.reduce((sum, m) => sum + m.usageCount, 0),
        totalSize: models.reduce((sum, m) => sum + (m.modelSize || 0), 0),
        avgUsagePerModel: 0,
        mostUsedModel: null,
        leastUsedModel: null,
      };

      if (stats.totalModels > 0) {
        stats.avgUsagePerModel = stats.totalUsage / stats.totalModels;

        const sortedByUsage = [...models].sort((a, b) => b.usageCount - a.usageCount);
        if (sortedByUsage.length > 0) {
          stats.mostUsedModel = `${sortedByUsage[0].modelName}:${sortedByUsage[0].modelTag}`;
          stats.leastUsedModel = `${sortedByUsage[sortedByUsage.length - 1].modelName}:${sortedByUsage[sortedByUsage.length - 1].modelTag}`;
        }
      }

      return stats;
    } catch (error) {
      console.error("[OllamaManager] Error getting usage stats:", error);
      throw error;
    }
  }

  /**
   * Get Ollama server info
   */
  async getServerInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.OLLAMA_HOST}/api/version`);
      if (!response.ok) {
        throw new Error(`Failed to get server info: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("[OllamaManager] Error getting server info:", error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.OLLAMA_HOST}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { healthy: false, error: `HTTP ${response.status}` };
      }

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const ollamaManager = new OllamaManager();

// Start auto-unload job on service initialization
ollamaManager.startAutoUnloadJob();

console.log("[OllamaManager] Service initialized");
