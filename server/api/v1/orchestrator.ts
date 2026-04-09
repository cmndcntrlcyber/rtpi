/**
 * Orchestrator API Routes — v2.5
 *
 * Proxies engagement management and workflow control requests
 * to the LangGraph orchestrator service. Provides the Express
 * backend's interface to the pentest workflow engine.
 */

import { Router, Request, Response } from "express";
import { ensureAuthenticated, logAudit } from "../../auth/middleware";
import { z } from "zod";
import {
  startEngagement,
  getEngagementStatus,
  listEngagements,
  advanceEngagement,
  approveExploitation,
  checkOrchestratorHealth,
  executeTool,
  executeToolsBatch,
  getToolRegistry,
  checkAllContainerHealth,
  checkAgentContainerHealth,
} from "../../services/langgraph-client";

const router = Router();

router.use(ensureAuthenticated);

// ============================================================================
// Validation Schemas
// ============================================================================

const startEngagementSchema = z.object({
  engagement_id: z.string().optional(),
  targets: z.array(z.string()).min(1, "At least one target required"),
  scope_constraints: z.array(z.string()).optional().default([]),
});

const approvalSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/v1/orchestrator/health
 * Check orchestrator service health.
 */
router.get("/health", async (_req: Request, res: Response) => {
  try {
    const health = await checkOrchestratorHealth();
    res.json(health);
  } catch (error) {
    res.status(502).json({ status: "unreachable", error: "Orchestrator service unavailable" });
  }
});

/**
 * GET /api/v1/orchestrator/engagements
 * List all active engagements.
 */
router.get("/engagements", async (_req: Request, res: Response) => {
  try {
    const result = await listEngagements();
    res.json(result);
  } catch (error) {
    console.error("[Orchestrator] List engagements error:", error);
    res.status(502).json({ error: "Orchestrator service unavailable" });
  }
});

/**
 * POST /api/v1/orchestrator/engagements/start
 * Start a new pentest engagement workflow.
 */
router.post("/engagements/start", logAudit("engagement:start"), async (req: Request, res: Response) => {
  try {
    const parsed = startEngagementSchema.parse(req.body);
    const result = await startEngagement(parsed);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: error.errors });
      return;
    }
    console.error("[Orchestrator] Start engagement error:", error);
    res.status(502).json({ error: "Orchestrator service unavailable" });
  }
});

/**
 * GET /api/v1/orchestrator/engagements/:id
 * Get engagement status.
 */
router.get("/engagements/:id", async (req: Request, res: Response) => {
  try {
    const result = await getEngagementStatus(req.params.id);
    res.json(result);
  } catch (error) {
    console.error("[Orchestrator] Get status error:", error);
    res.status(404).json({ error: "Engagement not found" });
  }
});

/**
 * POST /api/v1/orchestrator/engagements/:id/advance
 * Advance engagement to next phase.
 */
router.post("/engagements/:id/advance", logAudit("engagement:advance"), async (req: Request, res: Response) => {
  try {
    const result = await advanceEngagement(req.params.id);
    res.json(result);
  } catch (error) {
    console.error("[Orchestrator] Advance error:", error);
    res.status(502).json({ error: "Failed to advance engagement" });
  }
});

/**
 * POST /api/v1/orchestrator/engagements/:id/approve
 * Approve or deny exploitation for an engagement.
 */
router.post("/engagements/:id/approve", logAudit("engagement:approve"), async (req: Request, res: Response) => {
  try {
    const parsed = approvalSchema.parse(req.body);
    const result = await approveExploitation({
      engagement_id: req.params.id,
      ...parsed,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: error.errors });
      return;
    }
    console.error("[Orchestrator] Approval error:", error);
    res.status(502).json({ error: "Failed to process approval" });
  }
});

// ============================================================================
// Tool Execution
// ============================================================================

const toolExecSchema = z.object({
  agent_role: z.string().min(1, "Agent role is required"),
  tool_name: z.string().min(1, "Tool name is required"),
  params: z.record(z.string()),
  timeout: z.number().int().optional(),
});

const batchToolExecSchema = z.object({
  agent_role: z.string().min(1),
  tools: z.array(z.object({
    tool_name: z.string(),
    params: z.record(z.string()),
  })).min(1),
  max_concurrent: z.number().int().min(1).max(20).optional(),
});

/**
 * POST /api/v1/orchestrator/tools/execute
 * Execute a single tool inside its mapped container.
 */
router.post("/tools/execute", logAudit("tool:execute"), async (req: Request, res: Response) => {
  try {
    const parsed = toolExecSchema.parse(req.body);
    const result = await executeTool(parsed);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: error.errors });
      return;
    }
    console.error("[Orchestrator] Tool exec error:", error);
    res.status(502).json({ error: "Tool execution failed" });
  }
});

/**
 * POST /api/v1/orchestrator/tools/execute-batch
 * Execute multiple tools in parallel.
 */
router.post("/tools/execute-batch", logAudit("tool:execute-batch"), async (req: Request, res: Response) => {
  try {
    const parsed = batchToolExecSchema.parse(req.body);
    const result = await executeToolsBatch(parsed);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: error.errors });
      return;
    }
    console.error("[Orchestrator] Batch exec error:", error);
    res.status(502).json({ error: "Batch execution failed" });
  }
});

/**
 * GET /api/v1/orchestrator/tools/registry
 * List all registered tools grouped by agent role.
 */
router.get("/tools/registry", async (_req: Request, res: Response) => {
  try {
    const registry = await getToolRegistry();
    res.json(registry);
  } catch (error) {
    console.error("[Orchestrator] Registry error:", error);
    res.status(502).json({ error: "Tool registry unavailable" });
  }
});

/**
 * GET /api/v1/orchestrator/tools/containers/health
 * Check health of all tool containers.
 */
router.get("/tools/containers/health", async (_req: Request, res: Response) => {
  try {
    const health = await checkAllContainerHealth();
    res.json(health);
  } catch (error) {
    console.error("[Orchestrator] Container health error:", error);
    res.status(502).json({ error: "Container health check failed" });
  }
});

/**
 * GET /api/v1/orchestrator/tools/containers/:agentRole/health
 * Check health of containers for a specific agent.
 */
router.get("/tools/containers/:agentRole/health", async (req: Request, res: Response) => {
  try {
    const health = await checkAgentContainerHealth(req.params.agentRole as any);
    res.json(health);
  } catch (error) {
    console.error("[Orchestrator] Agent container health error:", error);
    res.status(502).json({ error: "Agent container health check failed" });
  }
});

export default router;
