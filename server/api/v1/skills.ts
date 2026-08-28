/**
 * Skills API Routes — v3.10.3a
 *
 * Provides skill discovery via the ferry-based skill catalog.
 * Legacy LangGraph orchestrator has been removed (v3.10.3b Phase 1).
 */

import { Router, Request, Response } from "express";
import { ensureAuthenticated } from "../../auth/middleware";
import { z } from "zod";
import { searchFerrySkills, listFerrySkills } from "../../services/ferry-skill-catalog";
import { clearSkillCache, loadSkill } from "../../services/skill-discovery-service";
import { createLogger } from '../../lib/logger';
const log = createLogger("skills");

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
 * Search the unified skills library via the ferry skill catalog.
 */
router.post("/search", async (req: Request, res: Response) => {
  try {
    const parsed = skillSearchSchema.parse(req.body);
    const ferryResults = searchFerrySkills(parsed.query);
    const skills = ferryResults.map((s) => ({
      ...s,
      source: "harness" as const,
    }));
    res.json({ skills });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: error.errors });
      return;
    }
    log.error("[Skills] Search error:", error);
    res.status(502).json({ error: "Skill discovery service unavailable" });
  }
});

/**
 * GET /api/v1/skills/:skillName
 * Get full content of a specific skill via the ferry gateway.
 */
router.get("/:skillName", async (req: Request, res: Response) => {
  try {
    const content = await loadSkill(req.params.skillName);
    if (!content) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json({ name: req.params.skillName, content });
  } catch (error) {
    log.error("[Skills] Get skill error:", error);
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
