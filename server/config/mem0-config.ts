/**
 * Memory System Configuration
 * Centralized configuration for the RTPI memory system (v2.3).
 * Implements Mem0-like capabilities natively in TypeScript.
 */

export interface MemoryEmbeddingConfig {
  provider: "openai" | "ollama" | "none";
  model: string;
  dimensions: number;
}

export interface MemoryGraphConfig {
  enabled: boolean;
  maxDepth: number;
  defaultRelationshipStrength: number;
}

export interface MemorySearchConfig {
  defaultLimit: number;
  maxLimit: number;
  minSimilarityThreshold: number;
  textSearchFallback: boolean;
}

export interface MemoryRetentionConfig {
  defaultTtlDays: number | null;
  maxMemoriesPerContext: number;
  cleanupIntervalHours: number;
}

export interface Mem0Config {
  embedding: MemoryEmbeddingConfig;
  graph: MemoryGraphConfig;
  search: MemorySearchConfig;
  retention: MemoryRetentionConfig;
}

export const mem0Config: Mem0Config = {
  embedding: {
    provider:
      (process.env.MEMORY_EMBEDDING_PROVIDER as
        | "openai"
        | "ollama"
        | "none") || "openai",
    model: process.env.MEMORY_EMBEDDING_MODEL || "text-embedding-ada-002",
    dimensions: parseInt(
      process.env.MEMORY_EMBEDDING_DIMENSIONS || "1536",
      10,
    ),
  },
  graph: {
    enabled: process.env.MEMORY_GRAPH_ENABLED !== "false",
    maxDepth: parseInt(process.env.MEMORY_GRAPH_MAX_DEPTH || "3", 10),
    defaultRelationshipStrength: parseFloat(
      process.env.MEMORY_GRAPH_DEFAULT_STRENGTH || "0.5",
    ),
  },
  search: {
    defaultLimit: parseInt(
      process.env.MEMORY_SEARCH_DEFAULT_LIMIT || "10",
      10,
    ),
    maxLimit: parseInt(process.env.MEMORY_SEARCH_MAX_LIMIT || "100", 10),
    minSimilarityThreshold: parseFloat(
      process.env.MEMORY_SEARCH_MIN_SIMILARITY || "0.7",
    ),
    textSearchFallback: process.env.MEMORY_SEARCH_TEXT_FALLBACK !== "false",
  },
  retention: {
    defaultTtlDays: process.env.MEMORY_DEFAULT_TTL_DAYS
      ? parseInt(process.env.MEMORY_DEFAULT_TTL_DAYS, 10)
      : null,
    maxMemoriesPerContext: parseInt(
      process.env.MEMORY_MAX_PER_CONTEXT || "1000",
      10,
    ),
    cleanupIntervalHours: parseInt(
      process.env.MEMORY_CLEANUP_INTERVAL_HOURS || "24",
      10,
    ),
  },
};
