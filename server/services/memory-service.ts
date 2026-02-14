import { db } from "../db";
import {
  memoryContexts,
  memoryEntries,
  memoryRelationships,
  memoryAccessLogs,
} from "@shared/schema";
import { eq, and, or, desc, ilike, sql, lt } from "drizzle-orm";
import { mem0Config } from "../config/mem0-config";
import { getOpenAIClient } from "./ai-clients";

// ============================================================================
// Types
// ============================================================================

export interface CreateContextParams {
  contextType: string;
  contextId: string;
  contextName: string;
  metadata?: Record<string, unknown>;
}

export interface AddMemoryParams {
  contextId: string;
  memoryText: string;
  memoryType: string;
  sourceAgentId?: string;
  sourceReportId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  validUntil?: Date;
}

export interface UpdateMemoryParams {
  memoryText?: string;
  memoryType?: string;
  relevanceScore?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  validUntil?: Date | null;
}

export interface SearchMemoriesParams {
  query: string;
  contextId?: string;
  memoryType?: string;
  limit?: number;
  minSimilarity?: number;
}

export interface SearchResult {
  id: string;
  memoryText: string;
  memoryType: string;
  score: number;
  contextId: string;
  metadata: unknown;
  tags: unknown;
  createdAt: Date;
}

export interface AddRelationshipParams {
  sourceMemoryId: string;
  targetMemoryId: string;
  relationshipType: string;
  strength?: number;
  metadata?: Record<string, unknown>;
}

export interface ListMemoriesParams {
  contextId?: string;
  memoryType?: string;
  limit?: number;
  offset?: number;
}

export interface AccessLogParams {
  memoryId?: string;
  agentId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Memory Service
// ============================================================================

export class MemoryService {
  constructor() {
    // AI client is now obtained via getOpenAIClient() on each call
  }

  // --------------------------------------------------------------------------
  // Context Management
  // --------------------------------------------------------------------------

  async createContext(params: CreateContextParams) {
    // Check for existing context with same type+id
    const existing = await db
      .select()
      .from(memoryContexts)
      .where(
        and(
          eq(memoryContexts.contextType, params.contextType as any),
          eq(memoryContexts.contextId, params.contextId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const result = await db
      .insert(memoryContexts)
      .values({
        contextType: params.contextType as any,
        contextId: params.contextId,
        contextName: params.contextName,
        metadata: params.metadata || {},
      })
      .returning();

    return result[0];
  }

  async getContext(id: string) {
    const result = await db
      .select()
      .from(memoryContexts)
      .where(eq(memoryContexts.id, id))
      .limit(1);

    return result[0] || null;
  }

  async getContextByTypeAndId(contextType: string, contextId: string) {
    const result = await db
      .select()
      .from(memoryContexts)
      .where(
        and(
          eq(memoryContexts.contextType, contextType as any),
          eq(memoryContexts.contextId, contextId),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  async listContexts(filters?: { contextType?: string }) {
    let query = db.select().from(memoryContexts);

    if (filters?.contextType) {
      query = query.where(
        eq(memoryContexts.contextType, filters.contextType as any),
      ) as any;
    }

    return await (query as any).orderBy(desc(memoryContexts.createdAt));
  }

  // --------------------------------------------------------------------------
  // Memory Entry Management
  // --------------------------------------------------------------------------

  async addMemory(params: AddMemoryParams) {
    const embedding = await this.generateEmbedding(params.memoryText);

    const result = await db
      .insert(memoryEntries)
      .values({
        contextId: params.contextId,
        memoryText: params.memoryText,
        memoryType: params.memoryType as any,
        embedding: embedding,
        sourceAgentId: params.sourceAgentId || null,
        sourceReportId: params.sourceReportId || null,
        tags: params.tags || [],
        metadata: params.metadata || {},
        validUntil: params.validUntil || null,
      })
      .returning();

    const memory = result[0];

    await this.logAccess({
      memoryId: memory.id,
      accessType: "write",
    });

    return memory;
  }

  async getMemory(id: string) {
    const result = await db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.id, id))
      .limit(1);

    if (!result[0]) return null;

    // Increment access count
    await db
      .update(memoryEntries)
      .set({
        accessCount: sql`${memoryEntries.accessCount} + 1`,
        lastAccessedAt: new Date(),
      })
      .where(eq(memoryEntries.id, id));

    await this.logAccess({
      memoryId: id,
      accessType: "read",
    });

    return result[0];
  }

  async updateMemory(id: string, updates: UpdateMemoryParams) {
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.memoryText !== undefined) {
      updateValues.memoryText = updates.memoryText;
      // Regenerate embedding when text changes
      updateValues.embedding = await this.generateEmbedding(
        updates.memoryText,
      );
    }
    if (updates.memoryType !== undefined)
      updateValues.memoryType = updates.memoryType;
    if (updates.relevanceScore !== undefined)
      updateValues.relevanceScore = updates.relevanceScore;
    if (updates.tags !== undefined) updateValues.tags = updates.tags;
    if (updates.metadata !== undefined)
      updateValues.metadata = updates.metadata;
    if (updates.validUntil !== undefined)
      updateValues.validUntil = updates.validUntil;

    const result = await db
      .update(memoryEntries)
      .set(updateValues as any)
      .where(eq(memoryEntries.id, id))
      .returning();

    if (result[0]) {
      await this.logAccess({
        memoryId: id,
        accessType: "update",
      });
    }

    return result[0] || null;
  }

  async deleteMemory(id: string) {
    await this.logAccess({
      memoryId: id,
      accessType: "delete",
    });

    await db.delete(memoryEntries).where(eq(memoryEntries.id, id));
  }

  async listMemories(params: ListMemoriesParams = {}) {
    const limit = Math.min(
      params.limit || mem0Config.search.defaultLimit,
      mem0Config.search.maxLimit,
    );
    const offset = params.offset || 0;

    const conditions = [];

    if (params.contextId) {
      conditions.push(eq(memoryEntries.contextId, params.contextId));
    }
    if (params.memoryType) {
      conditions.push(
        eq(memoryEntries.memoryType, params.memoryType as any),
      );
    }
    // Exclude expired memories
    conditions.push(
      or(
        sql`${memoryEntries.validUntil} IS NULL`,
        sql`${memoryEntries.validUntil} > NOW()`,
      )!,
    );

    const where =
      conditions.length > 1 ? and(...conditions) : conditions[0] || undefined;

    const results = await db
      .select()
      .from(memoryEntries)
      .where(where)
      .orderBy(desc(memoryEntries.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  }

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  async searchMemories(params: SearchMemoriesParams): Promise<SearchResult[]> {
    const limit = Math.min(
      params.limit || mem0Config.search.defaultLimit,
      mem0Config.search.maxLimit,
    );
    const minSimilarity =
      params.minSimilarity || mem0Config.search.minSimilarityThreshold;

    // Build filter conditions
    const conditions = [];
    if (params.contextId) {
      conditions.push(eq(memoryEntries.contextId, params.contextId));
    }
    if (params.memoryType) {
      conditions.push(
        eq(memoryEntries.memoryType, params.memoryType as any),
      );
    }
    // Exclude expired
    conditions.push(
      or(
        sql`${memoryEntries.validUntil} IS NULL`,
        sql`${memoryEntries.validUntil} > NOW()`,
      )!,
    );

    const where =
      conditions.length > 1 ? and(...conditions) : conditions[0] || undefined;

    // Text search via ILIKE
    const textResults = await db
      .select()
      .from(memoryEntries)
      .where(
        where
          ? and(where, ilike(memoryEntries.memoryText, `%${params.query}%`))
          : ilike(memoryEntries.memoryText, `%${params.query}%`),
      )
      .orderBy(desc(memoryEntries.relevanceScore))
      .limit(limit * 2); // Fetch extra for merging with vector results

    // Vector search if embeddings are enabled
    const queryEmbedding = await this.generateEmbedding(params.query);
    let vectorResults: typeof textResults = [];

    if (queryEmbedding) {
      // Fetch candidates with embeddings for similarity comparison
      const candidates = await db
        .select()
        .from(memoryEntries)
        .where(
          where
            ? and(where, sql`${memoryEntries.embedding} IS NOT NULL`)
            : sql`${memoryEntries.embedding} IS NOT NULL`,
        )
        .limit(limit * 10); // Broader pool for vector search

      vectorResults = candidates
        .map((entry) => ({
          ...entry,
          _similarity: this.cosineSimilarity(
            queryEmbedding,
            entry.embedding as number[],
          ),
        }))
        .filter((entry) => entry._similarity >= minSimilarity)
        .sort((a, b) => b._similarity - a._similarity)
        .slice(0, limit);
    }

    // Merge and deduplicate results
    const seenIds = new Set<string>();
    const merged: SearchResult[] = [];

    // Vector results first (higher quality)
    for (const entry of vectorResults) {
      if (!seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        merged.push({
          id: entry.id,
          memoryText: entry.memoryText,
          memoryType: entry.memoryType,
          score: (entry as any)._similarity || 0,
          contextId: entry.contextId,
          metadata: entry.metadata,
          tags: entry.tags,
          createdAt: entry.createdAt,
        });
      }
    }

    // Then text results
    for (const entry of textResults) {
      if (!seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        merged.push({
          id: entry.id,
          memoryText: entry.memoryText,
          memoryType: entry.memoryType,
          score: entry.relevanceScore * 0.5, // Lower score for text-only matches
          contextId: entry.contextId,
          metadata: entry.metadata,
          tags: entry.tags,
          createdAt: entry.createdAt,
        });
      }
    }

    // Sort by score and limit
    merged.sort((a, b) => b.score - a.score);

    await this.logAccess({
      memoryId: merged[0]?.id,
      accessType: "search",
      queryText: params.query,
      resultCount: merged.length,
    });

    return merged.slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // Relationship Management
  // --------------------------------------------------------------------------

  async addRelationship(params: AddRelationshipParams) {
    const result = await db
      .insert(memoryRelationships)
      .values({
        sourceMemoryId: params.sourceMemoryId,
        targetMemoryId: params.targetMemoryId,
        relationshipType: params.relationshipType as any,
        strength:
          params.strength ?? mem0Config.graph.defaultRelationshipStrength,
        metadata: params.metadata || {},
      })
      .returning();

    return result[0];
  }

  async getRelationships(
    memoryId: string,
    direction: "outgoing" | "incoming" | "both" = "both",
  ) {
    if (direction === "outgoing") {
      return await db
        .select()
        .from(memoryRelationships)
        .where(eq(memoryRelationships.sourceMemoryId, memoryId));
    }

    if (direction === "incoming") {
      return await db
        .select()
        .from(memoryRelationships)
        .where(eq(memoryRelationships.targetMemoryId, memoryId));
    }

    // Both directions
    return await db
      .select()
      .from(memoryRelationships)
      .where(
        or(
          eq(memoryRelationships.sourceMemoryId, memoryId),
          eq(memoryRelationships.targetMemoryId, memoryId),
        ),
      );
  }

  async removeRelationship(id: string) {
    await db
      .delete(memoryRelationships)
      .where(eq(memoryRelationships.id, id));
  }

  async getRelatedMemories(
    memoryId: string,
    maxDepth?: number,
  ): Promise<
    Array<{
      memory: typeof memoryEntries.$inferSelect;
      depth: number;
      path: string[];
    }>
  > {
    const depth = maxDepth ?? mem0Config.graph.maxDepth;
    const visited = new Set<string>([memoryId]);
    const results: Array<{
      memory: typeof memoryEntries.$inferSelect;
      depth: number;
      path: string[];
    }> = [];
    let currentLevel = [memoryId];

    for (let d = 1; d <= depth; d++) {
      if (currentLevel.length === 0) break;

      const nextLevel: string[] = [];

      for (const nodeId of currentLevel) {
        const relationships = await this.getRelationships(nodeId, "both");

        for (const rel of relationships) {
          const neighborId =
            rel.sourceMemoryId === nodeId
              ? rel.targetMemoryId
              : rel.sourceMemoryId;

          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            nextLevel.push(neighborId);

            const memory = await db
              .select()
              .from(memoryEntries)
              .where(eq(memoryEntries.id, neighborId))
              .limit(1);

            if (memory[0]) {
              results.push({
                memory: memory[0],
                depth: d,
                path: [...(results.find((r) => r.memory.id === nodeId)?.path || [memoryId]), neighborId],
              });
            }
          }
        }
      }

      currentLevel = nextLevel;
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Access Logging
  // --------------------------------------------------------------------------

  private async logAccess(params: {
    memoryId?: string;
    accessedByAgentId?: string;
    accessedByUserId?: string;
    accessType: string;
    queryText?: string;
    resultCount?: number;
  }) {
    if (!params.memoryId) return;

    try {
      await db.insert(memoryAccessLogs).values({
        memoryId: params.memoryId,
        accessedByAgentId: params.accessedByAgentId || null,
        accessedByUserId: params.accessedByUserId || null,
        accessType: params.accessType as any,
        queryText: params.queryText || null,
        resultCount: params.resultCount ?? null,
      });
    } catch (error) {
      console.error("Memory service - failed to log access:", error);
    }
  }

  async getAccessLogs(params: AccessLogParams = {}) {
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const conditions = [];
    if (params.memoryId) {
      conditions.push(eq(memoryAccessLogs.memoryId, params.memoryId));
    }
    if (params.agentId) {
      conditions.push(
        eq(memoryAccessLogs.accessedByAgentId, params.agentId),
      );
    }
    if (params.userId) {
      conditions.push(
        eq(memoryAccessLogs.accessedByUserId, params.userId),
      );
    }

    const where =
      conditions.length > 1 ? and(...conditions) : conditions[0] || undefined;

    return await db
      .select()
      .from(memoryAccessLogs)
      .where(where)
      .orderBy(desc(memoryAccessLogs.accessedAt))
      .limit(limit)
      .offset(offset);
  }

  // --------------------------------------------------------------------------
  // Maintenance
  // --------------------------------------------------------------------------

  async cleanupExpiredMemories(): Promise<number> {
    const expired = await db
      .delete(memoryEntries)
      .where(lt(memoryEntries.validUntil, new Date()))
      .returning();

    return expired.length;
  }

  async getMemoryStats(contextId?: string) {
    const conditions = [];
    if (contextId) {
      conditions.push(eq(memoryEntries.contextId, contextId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const entries = await db
      .select()
      .from(memoryEntries)
      .where(where);

    const relationships = await db.select().from(memoryRelationships);

    // Count by type
    const byType: Record<string, number> = {};
    let totalRelevance = 0;

    for (const entry of entries) {
      byType[entry.memoryType] = (byType[entry.memoryType] || 0) + 1;
      totalRelevance += entry.relevanceScore;
    }

    return {
      totalMemories: entries.length,
      totalRelationships: relationships.length,
      byType,
      averageRelevanceScore:
        entries.length > 0 ? totalRelevance / entries.length : 0,
      oldestMemory: entries.length > 0 ? entries[entries.length - 1]?.createdAt : null,
      newestMemory: entries.length > 0 ? entries[0]?.createdAt : null,
      memoriesWithEmbeddings: entries.filter((e) => e.embedding !== null)
        .length,
    };
  }

  // --------------------------------------------------------------------------
  // Embedding Helpers (private)
  // --------------------------------------------------------------------------

  private async generateEmbedding(text: string): Promise<number[] | null> {
    const openai = getOpenAIClient();
    if (mem0Config.embedding.provider === "none" || !openai) {
      return null;
    }

    try {
      const response = await openai.embeddings.create({
        model: mem0Config.embedding.model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Memory service - embedding generation failed:", error);
      return null;
    }
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export const memoryService = new MemoryService();
