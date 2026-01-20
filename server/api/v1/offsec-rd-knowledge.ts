import { Router } from "express";
import { db } from "../../db";
import { researchProjects, users } from "@shared/schema";
import { eq, desc, and, or, like, sql } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { z } from "zod";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// Validation schema for knowledge base article
const knowledgeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  summary: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  author: z.string().optional(),
  publishedDate: z.string().optional(),
  contentType: z.enum(["article", "tutorial", "paper", "poc", "tool_doc", "technique"]).optional(),
  attackTactics: z.array(z.string()).optional(),
  attackTechniques: z.array(z.string()).optional(),
  relatedProjectId: z.string().uuid().optional(),
  relatedArticles: z.array(z.string().uuid()).optional(),
});

// GET /api/v1/offsec-rd/knowledge - Search knowledge base
router.get("/", async (req, res) => {
  const { search, category, tags, contentType, attackTechnique } = req.query;

  try {
    // Note: Full-text search and vector similarity would require pgvector
    // For now, implementing basic search with LIKE queries

    // Since knowledge_base table failed to create due to pgvector,
    // we'll return empty array for now until pgvector is installed
    // TODO: Once pgvector is installed, implement full search functionality

    res.json({
      articles: [],
      message: "Knowledge base requires pgvector extension. Please install pgvector to enable this feature."
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to search knowledge base",
      details: error.message
    });
  }
});

// GET /api/v1/offsec-rd/knowledge/:id - Get article
router.get("/:id", async (_req, res) => {
  res.status(501).json({
    error: "Knowledge base not available",
    message: "Knowledge base requires pgvector extension. Please install pgvector to enable this feature."
  });
});

// POST /api/v1/offsec-rd/knowledge - Create article
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const validatedData = knowledgeSchema.parse(req.body);

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_knowledge_create_attempted",
      "/offsec-rd/knowledge",
      null,
      false,
      req
    );

    res.status(501).json({
      error: "Knowledge base not available",
      message: "Knowledge base requires pgvector extension. Please install pgvector to enable this feature."
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors
      });
    }
    res.status(500).json({
      error: "Failed to create article",
      details: error.message
    });
  }
});

// PUT /api/v1/offsec-rd/knowledge/:id - Update article
router.put("/:id", ensureRole("admin", "operator"), async (_req, res) => {
  res.status(501).json({
    error: "Knowledge base not available",
    message: "Knowledge base requires pgvector extension. Please install pgvector to enable this feature."
  });
});

// DELETE /api/v1/offsec-rd/knowledge/:id - Delete article
router.delete("/:id", ensureRole("admin"), async (_req, res) => {
  res.status(501).json({
    error: "Knowledge base not available",
    message: "Knowledge base requires pgvector extension. Please install pgvector to enable this feature."
  });
});

// POST /api/v1/offsec-rd/knowledge/search - Advanced search (when pgvector is available)
router.post("/search", async (_req, res) => {
  res.status(501).json({
    error: "Knowledge base not available",
    message: "Knowledge base requires pgvector extension. Please install pgvector to enable this feature."
  });
});

export default router;
