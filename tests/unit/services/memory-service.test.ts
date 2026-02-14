/**
 * Memory Service Unit Tests
 *
 * Tests for the memory system foundation (v2.3.1) covering:
 * - Context CRUD operations
 * - Memory entry CRUD with embedding generation
 * - Search (text + vector similarity)
 * - Relationship management and graph traversal
 * - Cosine similarity calculations
 * - Access logging
 * - Maintenance operations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock data
const mockContext = {
  id: "ctx-uuid-1",
  contextType: "operation",
  contextId: "op-123",
  contextName: "Test Operation",
  metadata: {},
  createdAt: new Date("2026-02-01"),
  updatedAt: new Date("2026-02-01"),
};

const mockMemory = {
  id: "mem-uuid-1",
  contextId: "ctx-uuid-1",
  memoryText: "Target 192.168.1.1 has open port 443",
  memoryType: "fact",
  embedding: [0.1, 0.2, 0.3],
  sourceAgentId: null,
  sourceReportId: null,
  relevanceScore: 1.0,
  accessCount: 0,
  lastAccessedAt: null,
  validFrom: new Date("2026-02-01"),
  validUntil: null,
  tags: ["network", "port-scan"],
  metadata: {},
  createdAt: new Date("2026-02-01"),
  updatedAt: new Date("2026-02-01"),
};

const mockRelationship = {
  id: "rel-uuid-1",
  sourceMemoryId: "mem-uuid-1",
  targetMemoryId: "mem-uuid-2",
  relationshipType: "related_to",
  strength: 0.8,
  metadata: {},
  createdAt: new Date("2026-02-01"),
};

// Mock database chains
const mockReturning = vi.fn();
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });

const mockSelectChain = {
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue([]),
        }),
      }),
      limit: mockLimit,
    }),
    orderBy: mockOrderBy,
  }),
};

vi.mock("../../../server/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: mockValues })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    })),
    select: vi.fn(() => mockSelectChain),
  },
}));

// Mock OpenAI
const mockEmbeddingsCreate = vi.fn().mockResolvedValue({
  data: [{ embedding: Array(1536).fill(0.01) }],
});

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: mockEmbeddingsCreate,
    },
  })),
}));

// Mock config
vi.mock("../../../server/config/mem0-config", () => ({
  mem0Config: {
    embedding: {
      provider: "openai",
      model: "text-embedding-ada-002",
      dimensions: 1536,
      apiKey: "test-api-key",
    },
    graph: {
      enabled: true,
      maxDepth: 3,
      defaultRelationshipStrength: 0.5,
    },
    search: {
      defaultLimit: 10,
      maxLimit: 100,
      minSimilarityThreshold: 0.7,
      textSearchFallback: true,
    },
    retention: {
      defaultTtlDays: null,
      maxMemoriesPerContext: 1000,
      cleanupIntervalHours: 24,
    },
  },
}));

// Mock schema
vi.mock("@shared/schema", () => ({
  memoryContexts: {
    id: "id",
    contextType: "context_type",
    contextId: "context_id",
    contextName: "context_name",
    metadata: "metadata",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  memoryEntries: {
    id: "id",
    contextId: "context_id",
    memoryText: "memory_text",
    memoryType: "memory_type",
    embedding: "embedding",
    sourceAgentId: "source_agent_id",
    sourceReportId: "source_report_id",
    relevanceScore: "relevance_score",
    accessCount: "access_count",
    lastAccessedAt: "last_accessed_at",
    validFrom: "valid_from",
    validUntil: "valid_until",
    tags: "tags",
    metadata: "metadata",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  memoryRelationships: {
    id: "id",
    sourceMemoryId: "source_memory_id",
    targetMemoryId: "target_memory_id",
    relationshipType: "relationship_type",
    strength: "strength",
    metadata: "metadata",
    createdAt: "created_at",
  },
  memoryAccessLogs: {
    id: "id",
    memoryId: "memory_id",
    accessedByAgentId: "accessed_by_agent_id",
    accessedByUserId: "accessed_by_user_id",
    accessType: "access_type",
    queryText: "query_text",
    resultCount: "result_count",
    accessedAt: "accessed_at",
  },
  agents: { id: "id" },
  users: { id: "id" },
}));

// Import after mocks
import { MemoryService } from "../../../server/services/memory-service";
import { db } from "../../../server/db";

describe("MemoryService", () => {
  let service: MemoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MemoryService();
  });

  // ==========================================================================
  // Context Management
  // ==========================================================================

  describe("Context Management", () => {
    it("should create a new context when none exists", async () => {
      // Mock: no existing context found
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockFrom });

      // Mock: insert returns new context
      mockReturning.mockResolvedValueOnce([mockContext]);

      // Mock: access log insert
      mockReturning.mockResolvedValueOnce([{}]);

      const result = await service.createContext({
        contextType: "operation",
        contextId: "op-123",
        contextName: "Test Operation",
      });

      expect(result).toEqual(mockContext);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should return existing context if duplicate", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockContext]),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockFrom });

      const result = await service.createContext({
        contextType: "operation",
        contextId: "op-123",
        contextName: "Test Operation",
      });

      expect(result).toEqual(mockContext);
      // Should NOT call insert since context exists
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("should get a context by id", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockContext]),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockFrom });

      const result = await service.getContext("ctx-uuid-1");

      expect(result).toEqual(mockContext);
    });

    it("should return null for non-existent context", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockFrom });

      const result = await service.getContext("nonexistent-id");

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Memory Entry CRUD
  // ==========================================================================

  describe("Memory Entry CRUD", () => {
    it("should add a memory with embedding generation", async () => {
      mockReturning.mockResolvedValueOnce([mockMemory]); // insert
      mockReturning.mockResolvedValueOnce([{}]); // access log

      const result = await service.addMemory({
        contextId: "ctx-uuid-1",
        memoryText: "Target 192.168.1.1 has open port 443",
        memoryType: "fact",
        tags: ["network", "port-scan"],
      });

      expect(result).toEqual(mockMemory);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: "text-embedding-ada-002",
        input: "Target 192.168.1.1 has open port 443",
      });
      expect(db.insert).toHaveBeenCalled();
    });

    it("should get a memory and increment access count", async () => {
      // Mock select
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockMemory]),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockFrom });

      // Mock update (access count increment)
      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      (db.update as any).mockReturnValueOnce({ set: mockSet });

      // Mock access log insert
      mockReturning.mockResolvedValueOnce([{}]);

      const result = await service.getMemory("mem-uuid-1");

      expect(result).toEqual(mockMemory);
      expect(db.update).toHaveBeenCalled();
    });

    it("should return null for non-existent memory", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockFrom });

      const result = await service.getMemory("nonexistent");

      expect(result).toBeNull();
    });

    it("should update a memory and regenerate embedding when text changes", async () => {
      const updatedMemory = {
        ...mockMemory,
        memoryText: "Updated text",
        embedding: Array(1536).fill(0.02),
      };

      const mockUpdateReturning = vi.fn().mockResolvedValue([updatedMemory]);
      const mockUpdateWhere = vi
        .fn()
        .mockReturnValue({ returning: mockUpdateReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      (db.update as any).mockReturnValueOnce({ set: mockSet });

      // Mock access log
      mockReturning.mockResolvedValueOnce([{}]);

      const result = await service.updateMemory("mem-uuid-1", {
        memoryText: "Updated text",
      });

      expect(result).toEqual(updatedMemory);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: "text-embedding-ada-002",
        input: "Updated text",
      });
    });

    it("should delete a memory", async () => {
      // Mock access log insert
      mockReturning.mockResolvedValueOnce([{}]);

      await service.deleteMemory("mem-uuid-1");

      expect(db.delete).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Search
  // ==========================================================================

  describe("Search", () => {
    it("should perform text search with ilike", async () => {
      // Text search results
      const mockTextFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMemory]),
          }),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockTextFrom });

      // Vector search candidates (empty - no embeddings)
      const mockVectorFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockVectorFrom });

      // Access log
      mockReturning.mockResolvedValueOnce([{}]);

      const results = await service.searchMemories({
        query: "port 443",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].memoryText).toBe(mockMemory.memoryText);
    });

    it("should perform vector search and rank by similarity", async () => {
      const memoryWithEmbedding = {
        ...mockMemory,
        embedding: Array(1536).fill(0.01), // Same as the mock query embedding
      };

      // Text search
      const mockTextFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockTextFrom });

      // Vector search candidates
      const mockVectorFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([memoryWithEmbedding]),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockVectorFrom });

      // Access log
      mockReturning.mockResolvedValueOnce([{}]);

      const results = await service.searchMemories({
        query: "open ports",
      });

      // Should find the memory via vector similarity (identical embeddings = similarity 1.0)
      expect(results.length).toBe(1);
      expect(results[0].score).toBeCloseTo(1.0);
    });

    it("should fall back to text search when embedding fails", async () => {
      mockEmbeddingsCreate.mockRejectedValueOnce(new Error("API error"));

      // Text search results
      const mockTextFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockMemory]),
          }),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockTextFrom });

      // No vector search since embedding failed
      const mockVectorFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockVectorFrom });

      // Access log
      mockReturning.mockResolvedValueOnce([{}]);

      const results = await service.searchMemories({
        query: "port scan",
      });

      // Should still return text-matched results
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Relationships
  // ==========================================================================

  describe("Relationships", () => {
    it("should create a relationship between memories", async () => {
      mockReturning.mockResolvedValueOnce([mockRelationship]);

      const result = await service.addRelationship({
        sourceMemoryId: "mem-uuid-1",
        targetMemoryId: "mem-uuid-2",
        relationshipType: "related_to",
        strength: 0.8,
      });

      expect(result).toEqual(mockRelationship);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should get relationships for a memory (both directions)", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockRelationship]),
      });
      (db.select as any).mockReturnValueOnce({ from: mockFrom });

      const results = await service.getRelationships("mem-uuid-1", "both");

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(mockRelationship);
    });

    it("should remove a relationship", async () => {
      await service.removeRelationship("rel-uuid-1");

      expect(db.delete).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Cosine Similarity
  // ==========================================================================

  describe("Cosine Similarity", () => {
    it("should return 1.0 for identical vectors", () => {
      const vec = [1, 2, 3, 4, 5];
      expect(service.cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
    });

    it("should return 0.0 for orthogonal vectors", () => {
      const a = [1, 0];
      const b = [0, 1];
      expect(service.cosineSimilarity(a, b)).toBeCloseTo(0.0);
    });

    it("should return 0 for empty vectors", () => {
      expect(service.cosineSimilarity([], [])).toBe(0);
    });

    it("should handle zero-magnitude vectors gracefully", () => {
      const zero = [0, 0, 0];
      const normal = [1, 2, 3];
      expect(service.cosineSimilarity(zero, normal)).toBe(0);
    });

    it("should return -1.0 for opposite vectors", () => {
      const a = [1, 0];
      const b = [-1, 0];
      expect(service.cosineSimilarity(a, b)).toBeCloseTo(-1.0);
    });
  });

  // ==========================================================================
  // Access Logging
  // ==========================================================================

  describe("Access Logging", () => {
    it("should query access logs with filters", async () => {
      const mockLog = {
        id: "log-uuid-1",
        memoryId: "mem-uuid-1",
        accessType: "read",
        accessedAt: new Date(),
      };

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([mockLog]),
            }),
          }),
        }),
      });
      (db.select as any).mockReturnValueOnce({ from: mockFrom });

      const results = await service.getAccessLogs({
        memoryId: "mem-uuid-1",
        limit: 10,
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(mockLog);
    });
  });

  // ==========================================================================
  // Maintenance
  // ==========================================================================

  describe("Maintenance", () => {
    it("should clean up expired memories", async () => {
      const mockDeleteWhere = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockMemory]),
      });
      (db.delete as any).mockReturnValueOnce({ where: mockDeleteWhere });

      const count = await service.cleanupExpiredMemories();

      expect(count).toBe(1);
      expect(db.delete).toHaveBeenCalled();
    });

    it("should return memory statistics", async () => {
      // Mock entries query
      const mockEntriesFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockMemory]),
      });
      (db.select as any).mockReturnValueOnce({ from: mockEntriesFrom });

      // Mock relationships query
      const mockRelsFrom = vi.fn().mockResolvedValue([mockRelationship]);
      (db.select as any).mockReturnValueOnce({ from: mockRelsFrom });

      const stats = await service.getMemoryStats();

      expect(stats.totalMemories).toBe(1);
      expect(stats.totalRelationships).toBe(1);
      expect(stats.byType).toHaveProperty("fact", 1);
      expect(stats.averageRelevanceScore).toBe(1.0);
      expect(stats.memoriesWithEmbeddings).toBe(1);
    });
  });
});
