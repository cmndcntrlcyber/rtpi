import { Router } from "express";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { rdToolPromotion } from "../../services/rd-tool-promotion";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// POST /api/v1/offsec-rd/artifacts/:artifactId/promote - Promote artifact to Tool Registry
//
// NOTE: This router is mounted at /api/v1/offsec-rd/artifacts (see server/index.ts).
// It was extracted from offsec-rd-experiments.ts, where the same route was defined
// under the /api/v1/offsec-rd/experiments mount and was therefore unreachable at the
// path the frontend calls (/offsec-rd/artifacts/:id/promote -> 404).
router.post("/:artifactId/promote", ensureRole("admin", "operator"), async (req, res) => {
  const { artifactId } = req.params;
  const { toolName, category } = req.body;
  const user = req.user as any;

  try {
    const result = await rdToolPromotion.promoteToToolRegistry(artifactId, toolName, category);

    await logAudit(
      user.id,
      "offsec_rd_artifact_promote",
      `/offsec-rd/artifacts/${artifactId}/promote`,
      artifactId,
      result.success,
      req
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error, metadata: result.metadata });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to promote artifact",
      details: error.message,
    });
  }
});

// POST /api/v1/offsec-rd/artifacts/:artifactId/deploy-nuclei - Promote a
// nuclei_template artifact into the active nuclei_templates registry (S6).
router.post("/:artifactId/deploy-nuclei", ensureRole("admin", "operator"), async (req, res) => {
  const { artifactId } = req.params;
  const { name } = req.body;
  const user = req.user as any;

  try {
    const result = await rdToolPromotion.promoteToNucleiTemplates(artifactId, name);

    await logAudit(
      user.id,
      "offsec_rd_nuclei_deploy",
      `/offsec-rd/artifacts/${artifactId}/deploy-nuclei`,
      artifactId,
      result.success,
      req
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to deploy nuclei template",
      details: error.message,
    });
  }
});

export default router;
