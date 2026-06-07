/**
 * Tool Skills API — read and regenerate per-tool SKILL.md files.
 *
 * Endpoints:
 *   GET  /api/v1/tool-skills                          — list every tool with a generated skill
 *   GET  /api/v1/tool-skills/:registry/:id            — return parsed frontmatter + body
 *   GET  /api/v1/tool-skills/:registry/:id/raw        — return raw markdown
 *   POST /api/v1/tool-skills/:registry/:id/regenerate — force regen (admin-only)
 *
 * Mounted from server/index.ts as /api/v1/tool-skills.
 */

import { Router } from "express";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { loadSkillBody, loadSkillSummary } from "../../services/skills/skill-loader";
import { generateSkillForRegistry, listAllRegisteredTools } from "../../services/skill-generator";
import { SKILL_REGISTRIES, type SkillRegistry } from "../../services/skills/skill-paths";

const router = Router();
router.use(ensureAuthenticated);

function isValidRegistry(value: string): value is SkillRegistry {
  return (SKILL_REGISTRIES as readonly string[]).includes(value);
}

router.get("/", async (_req, res) => {
  try {
    const rows = await listAllRegisteredTools();
    const summaries = await Promise.all(
      rows.map(async (r) => {
        const summary = await loadSkillSummary(r.registry, r.rowId);
        return {
          registry: r.registry,
          rowId: r.rowId,
          displayName: r.displayName,
          hasSkill: summary !== null,
          skillPath: summary?.skillPath,
          summary: summary?.summary,
        };
      }),
    );
    res.json({ tools: summaries });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list tool skills", details: error?.message });
  }
});

router.get("/:registry/:id", async (req, res) => {
  const { registry, id } = req.params;
  if (!isValidRegistry(registry)) {
    return res.status(400).json({ error: "Invalid registry", validRegistries: SKILL_REGISTRIES });
  }
  const summary = await loadSkillSummary(registry, id);
  if (!summary) return res.status(404).json({ error: "Skill not found", registry, id });
  res.json(summary);
});

router.get("/:registry/:id/raw", async (req, res) => {
  const { registry, id } = req.params;
  if (!isValidRegistry(registry)) {
    return res.status(400).json({ error: "Invalid registry", validRegistries: SKILL_REGISTRIES });
  }
  const body = await loadSkillBody(registry, id);
  if (!body) return res.status(404).json({ error: "Skill not found", registry, id });
  res.type("text/markdown").send(body);
});

router.post("/:registry/:id/regenerate", ensureRole("admin"), async (req, res) => {
  const { registry, id } = req.params;
  const user = req.user as any;
  if (!isValidRegistry(registry)) {
    return res.status(400).json({ error: "Invalid registry", validRegistries: SKILL_REGISTRIES });
  }
  try {
    const result = await generateSkillForRegistry(registry, id, { force: true });
    await logAudit(user.id, "regenerate_tool_skill", `/tool-skills/${registry}`, id, result.status !== "failed", req);
    if (result.status === "failed") {
      return res.status(500).json({ error: "Generation failed", details: result.error });
    }
    res.json(result);
  } catch (error: any) {
    await logAudit(user.id, "regenerate_tool_skill", `/tool-skills/${registry}`, id, false, req);
    res.status(500).json({ error: "Failed to regenerate skill", details: error?.message });
  }
});

export default router;
