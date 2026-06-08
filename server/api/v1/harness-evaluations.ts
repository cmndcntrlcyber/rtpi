import { Router } from "express";
import path from "path";
import { promises as fs } from "fs";
import { db } from "../../db";
import { harnessEvaluations, agentWorkflows } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { harnessOptimizationEvaluator } from "../../services/harness-optimization-evaluator";

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

router.use(ensureAuthenticated);

/**
 * GET /api/v1/harness-evaluations
 * List evaluations, optionally filtered by workflowId / operationId / status.
 */
router.get("/", async (req, res) => {
  try {
    const { workflowId, operationId, status, limit } = req.query as Record<string, string>;
    const conditions = [];
    if (workflowId) conditions.push(eq(harnessEvaluations.workflowId, workflowId));
    if (operationId) conditions.push(eq(harnessEvaluations.operationId, operationId));
    if (status) conditions.push(eq(harnessEvaluations.status, status as any));

    const rows = await db
      .select()
      .from(harnessEvaluations)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(harnessEvaluations.createdAt))
      .limit(Math.min(Number(limit) || 50, 200));

    res.json({ evaluations: rows });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list harness evaluations", details: error?.message });
  }
});

/**
 * GET /api/v1/harness-evaluations/workflow/:workflowId
 * All evaluations for a single workflow (newest first).
 */
router.get("/workflow/:workflowId", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(harnessEvaluations)
      .where(eq(harnessEvaluations.workflowId, req.params.workflowId))
      .orderBy(desc(harnessEvaluations.createdAt));
    res.json({ evaluations: rows });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch evaluations", details: error?.message });
  }
});

/**
 * GET /api/v1/harness-evaluations/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(harnessEvaluations)
      .where(eq(harnessEvaluations.id, req.params.id))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Evaluation not found" });
    res.json({ evaluation: row });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch evaluation", details: error?.message });
  }
});

/**
 * GET /api/v1/harness-evaluations/:id/markdown
 * Download the rendered markdown report.
 */
router.get("/:id/markdown", async (req, res) => {
  try {
    const [row] = await db
      .select({ filePath: harnessEvaluations.filePath })
      .from(harnessEvaluations)
      .where(eq(harnessEvaluations.id, req.params.id))
      .limit(1);
    if (!row?.filePath) return res.status(404).json({ error: "No markdown export for this evaluation" });

    const abs = path.resolve(UPLOAD_DIR, row.filePath);
    // Guard against path traversal — the resolved path must stay under UPLOAD_DIR.
    if (!abs.startsWith(path.resolve(UPLOAD_DIR))) {
      return res.status(400).json({ error: "Invalid file path" });
    }
    const content = await fs.readFile(abs, "utf-8");
    res.type("text/markdown").send(content);
  } catch (error: any) {
    if (error?.code === "ENOENT") return res.status(404).json({ error: "Markdown file missing" });
    res.status(500).json({ error: "Failed to read markdown", details: error?.message });
  }
});

/**
 * POST /api/v1/harness-evaluations/workflow/:workflowId/evaluate
 * Manually (re)trigger an evaluation for a workflow.
 */
router.post("/workflow/:workflowId/evaluate", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;
  const { workflowId } = req.params;
  try {
    const [wf] = await db
      .select({ id: agentWorkflows.id })
      .from(agentWorkflows)
      .where(eq(agentWorkflows.id, workflowId))
      .limit(1);
    if (!wf) return res.status(404).json({ error: "Workflow not found" });

    const evaluationId = await harnessOptimizationEvaluator.enqueue(workflowId);
    await logAudit(user?.id, "harness_evaluation.enqueue", "harness_evaluation", evaluationId, !!evaluationId, req);
    if (!evaluationId) return res.status(500).json({ error: "Failed to enqueue evaluation" });
    res.status(202).json({ evaluationId, status: "queued" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to enqueue evaluation", details: error?.message });
  }
});

export default router;
