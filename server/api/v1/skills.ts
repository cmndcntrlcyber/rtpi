/**
 * Skills API Routes — v2.5
 *
 * Proxies skill discovery requests to the LangGraph orchestrator service.
 * Provides the Express backend's interface to the unified skills library.
 */

import { Router, Request, Response } from "express";
import { ensureAuthenticated } from "../../auth/middleware";
import { z } from "zod";
import { searchSkills, getSkillContent } from "../../services/langgraph-client";
import { clearSkillCache } from "../../services/skill-discovery-service";

const router = Router();

router.use(ensureAuthenticated);

// ============================================================================
// Validation Schemas
// ============================================================================

const skillSearchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  domain: z.string().optional(),
  mitre_technique: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/v1/skills/search
 * Search the unified skills library.
 */
router.post("/search", async (req: Request, res: Response) => {
  try {
    const parsed = skillSearchSchema.parse(req.body);
    const results = await searchSkills(parsed);
    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: error.errors });
      return;
    }
    console.error("[Skills] Search error:", error);
    res.status(502).json({ error: "Skill discovery service unavailable" });
  }
});

/**
 * GET /api/v1/skills/:skillName
 * Get full content of a specific skill.
 */
router.get("/:skillName", async (req: Request, res: Response) => {
  try {
    const result = await getSkillContent(req.params.skillName);
    res.json(result);
  } catch (error) {
    console.error("[Skills] Get skill error:", error);
    res.status(404).json({ error: "Skill not found" });
  }
});

/**
 * POST /api/v1/skills/cache/clear
 * Clear the skill search cache (admin only).
 */
router.post("/cache/clear", async (_req: Request, res: Response) => {
  clearSkillCache();
  res.json({ success: true, message: "Skill cache cleared" });
});

export default router;
