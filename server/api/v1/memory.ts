import { Router } from "express";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { memoryService } from "../../services/memory-service";
import { z } from "zod";

const router = Router();

router.use(ensureAuthenticated);

// ============================================================================
// Validation Schemas
// ============================================================================

const createContextSchema = z.object({
  contextType: z.enum([
    "operation",
    "target",
    "agent",
    "user",
    "workflow",
    "global",
  ]),
  contextId: z.string().min(1, "Context ID is required"),
  contextName: z.string().min(1, "Context name is required"),
  metadata: z.any().optional(),
});

const createMemorySchema = z.object({
  contextId: z.string().uuid("Must be a valid UUID"),
  memoryText: z.string().min(1, "Memory text is required"),
  memoryType: z.enum([
    "fact",
    "event",
    "insight",
    "pattern",
    "procedure",
    "preference",
  ]),
  sourceAgentId: z.string().uuid().optional(),
  sourceReportId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.any().optional(),
  validUntil: z.string().datetime().optional(),
});

const updateMemorySchema = z.object({
  memoryText: z.string().min(1).optional(),
  memoryType: z
    .enum(["fact", "event", "insight", "pattern", "procedure", "preference"])
    .optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.any().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

const searchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  contextId: z.string().uuid().optional(),
  memoryType: z
    .enum(["fact", "event", "insight", "pattern", "procedure", "preference"])
    .optional(),
  limit: z.number().int().min(1).max(100).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
});

const createRelationshipSchema = z.object({
  sourceMemoryId: z.string().uuid("Must be a valid UUID"),
  targetMemoryId: z.string().uuid("Must be a valid UUID"),
  relationshipType: z.enum([
    "related_to",
    "caused_by",
    "depends_on",
    "conflicts_with",
    "supersedes",
    "derived_from",
  ]),
  strength: z.number().min(0).max(1).optional(),
  metadata: z.any().optional(),
});

// ============================================================================
// Context Routes
// ============================================================================

// GET /contexts - List all memory contexts
router.get("/contexts", async (req, res) => {
  try {
    const contextType = req.query.contextType as string | undefined;
    const contexts = await memoryService.listContexts(
      contextType ? { contextType } : undefined,
    );
    res.json({ contexts });
  } catch (error: any) {
    res
      .status(500)
      .json({
        error: "Failed to list contexts",
        details: error?.message || "Internal server error",
      });
  }
});

// GET /contexts/:id - Get a single context
router.get("/contexts/:id", async (req, res) => {
  try {
    const context = await memoryService.getContext(req.params.id);
    if (!context) {
      return res.status(404).json({ error: "Context not found" });
    }
    res.json({ context });
  } catch (error: any) {
    res
      .status(500)
      .json({
        error: "Failed to get context",
        details: error?.message || "Internal server error",
      });
  }
});

// POST /contexts - Create a new context
router.post(
  "/contexts",
  ensureRole("admin", "operator"),
  async (req, res) => {
    try {
      const validated = createContextSchema.parse(req.body);
      const user = req.user as any;

      const context = await memoryService.createContext(validated);

      await logAudit(
        user.id,
        "create_memory_context",
        "/memory/contexts",
        context.id,
        true,
        req,
      );
      res.status(201).json({ context });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res
        .status(500)
        .json({
          error: "Failed to create context",
          details: error?.message || "Internal server error",
        });
    }
  },
);

// ============================================================================
// Memory Entry Routes
// ============================================================================

// GET /entries - List memory entries
router.get("/entries", async (req, res) => {
  try {
    const memories = await memoryService.listMemories({
      contextId: req.query.contextId as string | undefined,
      memoryType: req.query.memoryType as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset
        ? parseInt(req.query.offset as string, 10)
        : undefined,
    });
    res.json({ memories });
  } catch (error: any) {
    res
      .status(500)
      .json({
        error: "Failed to list memories",
        details: error?.message || "Internal server error",
      });
  }
});

// GET /entries/:id - Get a single memory
router.get("/entries/:id", async (req, res) => {
  try {
    const memory = await memoryService.getMemory(req.params.id);
    if (!memory) {
      return res.status(404).json({ error: "Memory not found" });
    }
    res.json({ memory });
  } catch (error: any) {
    res
      .status(500)
      .json({
        error: "Failed to get memory",
        details: error?.message || "Internal server error",
      });
  }
});

// POST /entries - Create a new memory
router.post(
  "/entries",
  ensureRole("admin", "operator"),
  async (req, res) => {
    try {
      const validated = createMemorySchema.parse(req.body);
      const user = req.user as any;

      const memory = await memoryService.addMemory({
        ...validated,
        validUntil: validated.validUntil
          ? new Date(validated.validUntil)
          : undefined,
      });

      await logAudit(
        user.id,
        "create_memory",
        "/memory/entries",
        memory.id,
        true,
        req,
      );
      res.status(201).json({ memory });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res
        .status(500)
        .json({
          error: "Failed to create memory",
          details: error?.message || "Internal server error",
        });
    }
  },
);

// PUT /entries/:id - Update a memory
router.put(
  "/entries/:id",
  ensureRole("admin", "operator"),
  async (req, res) => {
    try {
      const validated = updateMemorySchema.parse(req.body);
      const user = req.user as any;

      const memory = await memoryService.updateMemory(req.params.id, {
        ...validated,
        validUntil:
          validated.validUntil === null
            ? null
            : validated.validUntil
              ? new Date(validated.validUntil)
              : undefined,
      });

      if (!memory) {
        return res.status(404).json({ error: "Memory not found" });
      }

      await logAudit(
        user.id,
        "update_memory",
        "/memory/entries",
        memory.id,
        true,
        req,
      );
      res.json({ memory });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res
        .status(500)
        .json({
          error: "Failed to update memory",
          details: error?.message || "Internal server error",
        });
    }
  },
);

// DELETE /entries/:id - Delete a memory
router.delete(
  "/entries/:id",
  ensureRole("admin"),
  async (req, res) => {
    try {
      const user = req.user as any;

      await memoryService.deleteMemory(req.params.id);

      await logAudit(
        user.id,
        "delete_memory",
        "/memory/entries",
        req.params.id,
        true,
        req,
      );
      res.json({ message: "Memory deleted successfully" });
    } catch (error: any) {
      res
        .status(500)
        .json({
          error: "Failed to delete memory",
          details: error?.message || "Internal server error",
        });
    }
  },
);

// ============================================================================
// Search Routes
// ============================================================================

// POST /search - Search memories
router.post("/search", async (req, res) => {
  try {
    const validated = searchSchema.parse(req.body);
    const memories = await memoryService.searchMemories(validated);
    res.json({
      memories,
      totalResults: memories.length,
      query: validated.query,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: error.errors });
    }
    res
      .status(500)
      .json({
        error: "Failed to search memories",
        details: error?.message || "Internal server error",
      });
  }
});

// ============================================================================
// Relationship Routes
// ============================================================================

// GET /relationships/:memoryId - Get relationships for a memory
router.get("/relationships/:memoryId", async (req, res) => {
  try {
    const direction = (req.query.direction as string) || "both";
    const relationships = await memoryService.getRelationships(
      req.params.memoryId,
      direction as "outgoing" | "incoming" | "both",
    );
    res.json({ relationships });
  } catch (error: any) {
    res
      .status(500)
      .json({
        error: "Failed to get relationships",
        details: error?.message || "Internal server error",
      });
  }
});

// POST /relationships - Create a relationship
router.post(
  "/relationships",
  ensureRole("admin", "operator"),
  async (req, res) => {
    try {
      const validated = createRelationshipSchema.parse(req.body);
      const user = req.user as any;

      const relationship = await memoryService.addRelationship(validated);

      await logAudit(
        user.id,
        "create_memory_relationship",
        "/memory/relationships",
        relationship.id,
        true,
        req,
      );
      res.status(201).json({ relationship });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res
        .status(500)
        .json({
          error: "Failed to create relationship",
          details: error?.message || "Internal server error",
        });
    }
  },
);

// DELETE /relationships/:id - Delete a relationship
router.delete(
  "/relationships/:id",
  ensureRole("admin", "operator"),
  async (req, res) => {
    try {
      const user = req.user as any;

      await memoryService.removeRelationship(req.params.id);

      await logAudit(
        user.id,
        "delete_memory_relationship",
        "/memory/relationships",
        req.params.id,
        true,
        req,
      );
      res.json({ message: "Relationship deleted successfully" });
    } catch (error: any) {
      res
        .status(500)
        .json({
          error: "Failed to delete relationship",
          details: error?.message || "Internal server error",
        });
    }
  },
);

// GET /graph/:memoryId - Graph traversal
router.get("/graph/:memoryId", async (req, res) => {
  try {
    const maxDepth = req.query.maxDepth
      ? parseInt(req.query.maxDepth as string, 10)
      : undefined;
    const relatedMemories = await memoryService.getRelatedMemories(
      req.params.memoryId,
      maxDepth,
    );
    res.json({ relatedMemories });
  } catch (error: any) {
    res
      .status(500)
      .json({
        error: "Failed to get related memories",
        details: error?.message || "Internal server error",
      });
  }
});

// ============================================================================
// Access Log Routes
// ============================================================================

// GET /access-logs - Query access logs
router.get("/access-logs", ensureRole("admin"), async (req, res) => {
  try {
    const accessLogs = await memoryService.getAccessLogs({
      memoryId: req.query.memoryId as string | undefined,
      agentId: req.query.agentId as string | undefined,
      userId: req.query.userId as string | undefined,
      limit: req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : undefined,
      offset: req.query.offset
        ? parseInt(req.query.offset as string, 10)
        : undefined,
    });
    res.json({ accessLogs });
  } catch (error: any) {
    res
      .status(500)
      .json({
        error: "Failed to get access logs",
        details: error?.message || "Internal server error",
      });
  }
});

// ============================================================================
// Stats and Maintenance Routes
// ============================================================================

// GET /stats - Get memory statistics
router.get("/stats", async (req, res) => {
  try {
    const contextId = req.query.contextId as string | undefined;
    const stats = await memoryService.getMemoryStats(contextId);
    res.json({ stats });
  } catch (error: any) {
    res
      .status(500)
      .json({
        error: "Failed to get memory stats",
        details: error?.message || "Internal server error",
      });
  }
});

// POST /cleanup - Cleanup expired memories
router.post("/cleanup", ensureRole("admin"), async (req, res) => {
  try {
    const user = req.user as any;
    const deletedCount = await memoryService.cleanupExpiredMemories();

    await logAudit(
      user.id,
      "cleanup_expired_memories",
      "/memory/cleanup",
      null,
      true,
      req,
    );
    res.json({ message: "Cleanup completed", deletedCount });
  } catch (error: any) {
    res
      .status(500)
      .json({
        error: "Failed to cleanup memories",
        details: error?.message || "Internal server error",
      });
  }
});

export default router;
