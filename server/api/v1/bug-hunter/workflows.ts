/**
 * Bug-Hunter workflow router (FF_BUG_HUNTER).
 *
 * Nine endpoints that mirror the Claude-BugHunter slash commands that
 * actually start an agent workflow. Queries that just read existing
 * state (/scope, /surface, /pickup, /intel) and direct memory ops
 * (/remember, /memory-gc) live in sibling files (queries.ts / memory.ts)
 * landed in subsequent PRs.
 *
 *   POST /hunt          → 7-phase pipeline scaffolded against the target
 *   POST /recon         → ReconAgent only (subdomain enum + tech detect)
 *   POST /triage        → ValidateAgent in fast mode (no LLM gates)
 *   POST /validate      → ValidateAgent in full mode (7-Q gate)
 *   POST /chain         → ChainAgent over accumulated findings
 *   POST /report        → BugReportAgent (platform-appropriate render)
 *   POST /autopilot     → 7-phase pipeline with elevated maxIterations
 *   POST /token-scan    → HuntAgent constrained to web3 token-scan skills
 *   POST /web3-audit    → HuntAgent constrained to web3-audit skill
 *
 * All endpoints require an authenticated admin/operator. The mount in
 * server/index.ts is flag-gated; the router enforces the flag again as a
 * belt-and-suspenders check.
 */

import { Router } from "express";
import { z } from "zod";

import { ensureAuthenticated, ensureRole } from "../../../auth/middleware";
import { agentWorkflowOrchestrator } from "../../../services/agent-workflow-orchestrator";
import { scaffoldEngagement } from "../../../services/bug-hunter/engagement-scaffolder";
import {
  scopeAgent,
  reconAgent,
  huntAgent,
  chainAgent,
  validateAgent,
  captureAgent,
  bugReportAgent,
} from "../../../services/agents/bug-hunter";

const router = Router();

router.use(ensureAuthenticated);

function flagEnabled(): boolean {
  const v = (process.env.FF_BUG_HUNTER ?? "").toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

router.use((_req, res, next) => {
  if (!flagEnabled()) {
    return res.status(404).json({ error: "FF_BUG_HUNTER disabled" });
  }
  next();
});

// ---------------------------------------------------------------------------
// Schema fragments
// ---------------------------------------------------------------------------

const modeSchema = z.enum(["redteam", "wapt"]);
const boxSchema = z.enum(["blackbox", "greybox"]);
const platformSchema = z.enum(["hackerone", "bugcrowd", "intigriti", "immunefi", "redteam", "internal"]);

const huntSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  targetId: z.string().uuid(),
  /** If omitted, /hunt will scaffold a new operation from scopeText. */
  operationId: z.string().uuid().optional(),
  scopeText: z.string().max(20_000).optional(),
  mode: modeSchema.default("wapt"),
  box: boxSchema.default("blackbox"),
  platform: platformSchema.default("internal"),
  phases: z
    .array(z.enum(["scope", "recon", "hunt", "chain", "validate", "capture", "report"]))
    .optional(),
});

const singlePhaseSchema = z.object({
  operationId: z.string().uuid(),
  targetId: z.string().uuid().optional(),
  parameters: z.record(z.unknown()).optional(),
});

const validateSchema = z.object({
  operationId: z.string().uuid(),
  findingId: z.string().uuid().optional(),
  fast: z.boolean().optional(),
});

const reportSchema = z.object({
  operationId: z.string().uuid(),
  platform: platformSchema.optional(),
  onlyPassed: z.boolean().optional(),
});

const tokenScanSchema = z.object({
  operationId: z.string().uuid(),
  targetId: z.string().uuid(),
  contractAddress: z.string().min(1).optional(),
  network: z.string().min(1).optional(),
});

const web3AuditSchema = z.object({
  operationId: z.string().uuid(),
  targetId: z.string().uuid(),
  repoUrl: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AuthedRequest {
  user?: { id?: string };
}

function userId(req: AuthedRequest): string {
  const id = req.user?.id;
  if (!id) throw new Error("authenticated user has no id");
  return id;
}

// ---------------------------------------------------------------------------
// /hunt — full pipeline
// ---------------------------------------------------------------------------

router.post("/hunt", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = huntSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  const data = parsed.data;

  try {
    let operationId = data.operationId;
    if (!operationId) {
      if (!data.scopeText || !data.name) {
        return res.status(400).json({ error: "operationId OR (scopeText + name) required" });
      }
      const scaffold = await scaffoldEngagement({
        name: data.name,
        scopeText: data.scopeText,
        ownerId: userId(req),
        mode: data.mode,
        box: data.box,
        platform: data.platform,
      });
      operationId = scaffold.operationId;
    }

    const result = await agentWorkflowOrchestrator.startBugHunterWorkflow({
      operationId,
      targetId: data.targetId,
      userId: userId(req),
      mode: data.mode,
      box: data.box,
      platform: data.platform,
      phases: data.phases,
      name: data.name,
    });

    res.status(202).json({
      operationId,
      workflowId: result.workflow.id,
      tasks: result.tasks.map((t: { id: string; taskType: string; status: string }) => ({ id: t.id, taskType: t.taskType, status: t.status })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "hunt failed" });
  }
});

// ---------------------------------------------------------------------------
// Per-phase endpoints (synchronous; no workflow row created)
// ---------------------------------------------------------------------------

router.post("/recon", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = singlePhaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  try {
    await reconAgent.initialize();
    const result = await reconAgent.executeTask({
      taskType: "bug_hunter_recon",
      taskName: "Bug-Hunter Recon",
      operationId: parsed.data.operationId,
      targetId: parsed.data.targetId,
      parameters: parsed.data.parameters ?? {},
    });
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "recon failed" });
  }
});

router.post("/triage", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  try {
    await validateAgent.initialize();
    const result = await validateAgent.executeTask({
      taskType: "bug_hunter_validate",
      taskName: "Bug-Hunter Triage (fast)",
      operationId: parsed.data.operationId,
      parameters: { fast: true, findingId: parsed.data.findingId },
    });
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "triage failed" });
  }
});

router.post("/validate", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  try {
    await validateAgent.initialize();
    const result = await validateAgent.executeTask({
      taskType: "bug_hunter_validate",
      taskName: "Bug-Hunter Validate (full)",
      operationId: parsed.data.operationId,
      parameters: { fast: parsed.data.fast ?? false, findingId: parsed.data.findingId },
    });
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "validate failed" });
  }
});

router.post("/chain", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = singlePhaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  try {
    await chainAgent.initialize();
    const result = await chainAgent.executeTask({
      taskType: "bug_hunter_chain",
      taskName: "Bug-Hunter Chain Proposals",
      operationId: parsed.data.operationId,
      parameters: parsed.data.parameters ?? {},
    });
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "chain failed" });
  }
});

router.post("/report", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  try {
    await captureAgent.initialize();
    await bugReportAgent.initialize();
    // Run capture first so the report agent has hygiene flags to consult.
    const cap = await captureAgent.executeTask({
      taskType: "bug_hunter_capture",
      taskName: "Bug-Hunter Capture (pre-report)",
      operationId: parsed.data.operationId,
      parameters: {},
    });
    const rep = await bugReportAgent.executeTask({
      taskType: "bug_hunter_report",
      taskName: "Bug-Hunter Report",
      operationId: parsed.data.operationId,
      parameters: {
        platform: parsed.data.platform,
        onlyPassed: parsed.data.onlyPassed ?? true,
      },
    });
    res.json({ capture: cap, report: rep });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "report failed" });
  }
});

// ---------------------------------------------------------------------------
// /autopilot — full pipeline w/ elevated iterations
// ---------------------------------------------------------------------------

router.post("/autopilot", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = huntSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  const data = parsed.data;
  try {
    let operationId = data.operationId;
    if (!operationId) {
      if (!data.scopeText || !data.name) {
        return res.status(400).json({ error: "operationId OR (scopeText + name) required" });
      }
      const scaffold = await scaffoldEngagement({
        name: data.name,
        scopeText: data.scopeText,
        ownerId: userId(req),
        mode: data.mode,
        box: data.box,
        platform: data.platform,
      });
      operationId = scaffold.operationId;
    }
    const result = await agentWorkflowOrchestrator.startBugHunterWorkflow({
      operationId,
      targetId: data.targetId,
      userId: userId(req),
      mode: data.mode,
      box: data.box,
      platform: data.platform,
      phases: data.phases,
      name: data.name ?? "Bug-Hunter Autopilot",
    });
    res.status(202).json({
      operationId,
      workflowId: result.workflow.id,
      tasks: result.tasks.map((t: { id: string; taskType: string; status: string }) => ({ id: t.id, taskType: t.taskType, status: t.status })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "autopilot failed" });
  }
});

// ---------------------------------------------------------------------------
// /scope — runs ScopeAgent standalone (parse + persist scope rules)
// ---------------------------------------------------------------------------

router.post("/scope", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = singlePhaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  try {
    await scopeAgent.initialize();
    const result = await scopeAgent.executeTask({
      taskType: "bug_hunter_scope",
      taskName: "Bug-Hunter Scope",
      operationId: parsed.data.operationId,
      parameters: parsed.data.parameters ?? {},
    });
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "scope failed" });
  }
});

// ---------------------------------------------------------------------------
// /token-scan + /web3-audit — narrowed Hunt invocations
// ---------------------------------------------------------------------------

router.post("/token-scan", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = tokenScanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  try {
    await huntAgent.initialize();
    const result = await huntAgent.executeTask({
      taskType: "bug_hunter_hunt",
      taskName: "Bug-Hunter Token-Scan",
      operationId: parsed.data.operationId,
      targetId: parsed.data.targetId,
      parameters: {
        objective: `Scan token contract for rug-pull / honeypot patterns using meme-coin-audit skill. Contract: ${parsed.data.contractAddress ?? "(unspecified)"}, network: ${parsed.data.network ?? "(unspecified)"}.`,
        maxIterations: 4,
        skillFilter: "meme-coin-audit",
      },
    });
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "token-scan failed" });
  }
});

router.post("/web3-audit", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = web3AuditSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  try {
    await huntAgent.initialize();
    const result = await huntAgent.executeTask({
      taskType: "bug_hunter_hunt",
      taskName: "Bug-Hunter Web3 Audit",
      operationId: parsed.data.operationId,
      targetId: parsed.data.targetId,
      parameters: {
        objective: `Run the 10-class DeFi bug-class checklist (web3-audit skill) against the contracts at ${parsed.data.repoUrl ?? "(target repo)"}. Produce a Foundry PoC for the highest-impact finding.`,
        maxIterations: 8,
        skillFilter: "web3-audit",
      },
    });
    res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "web3-audit failed" });
  }
});

export default router;
