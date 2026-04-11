/**
 * Skill Import API Routes
 *
 * Endpoints for importing external tool repositories from GitHub
 * and registering them in the tool registry for agent use.
 */

import { Router, Request, Response } from "express";
import { skillImportPipeline } from "../../services/skill-import-pipeline";

const router = Router();

/**
 * POST /api/v1/skills/import
 * Import a tool from a GitHub URL
 */
router.post("/import", async (req: Request, res: Response) => {
  try {
    const { githubUrl, options } = req.body;

    if (!githubUrl || typeof githubUrl !== "string") {
      return res.status(400).json({ error: "githubUrl is required" });
    }

    if (!githubUrl.includes("github.com/")) {
      return res.status(400).json({ error: "Invalid GitHub URL" });
    }

    const result = await skillImportPipeline.importFromGitHub(githubUrl, options || {});
    const statusCode = result.status === "failed" ? 500 : result.status === "in_progress" ? 202 : 200;

    return res.status(statusCode).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/v1/skills/import/:id
 * Get import status by ID
 */
router.get("/import/:id", async (req: Request, res: Response) => {
  const importState = skillImportPipeline.getImport(req.params.id);

  if (!importState) {
    return res.status(404).json({ error: "Import not found" });
  }

  return res.json({
    id: importState.id,
    githubUrl: importState.githubUrl,
    status: importState.status,
    result: importState.result,
    startedAt: importState.startedAt,
  });
});

/**
 * GET /api/v1/skills/import
 * List recent imports
 */
router.get("/import", async (_req: Request, res: Response) => {
  const imports = skillImportPipeline.listImports();

  return res.json(
    imports.map((i) => ({
      id: i.id,
      githubUrl: i.githubUrl,
      status: i.status,
      result: i.result,
      startedAt: i.startedAt,
    })),
  );
});

export default router;
