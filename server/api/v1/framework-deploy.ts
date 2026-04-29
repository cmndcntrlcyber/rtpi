/**
 * Framework Deployments API (v2.9.1 Phase 9)
 *
 * Mounted at /api/v1/deployments. Read endpoints are open to any
 * authenticated user; write endpoints (up/down/bundle) require admin.
 *
 * Up/down/bundle operations are run synchronously here — typical
 * compose-up of a single C2 container completes in <30s. The real-time UI
 * stays in sync via the existing /api/v1/ws/agents WebSocket using the
 * `{kind:"deployment_event", ...}` envelope (separate slice, not yet
 * wired in this Phase 9 commit — events are persisted to deployment_events
 * regardless and the UI polls via GET /events).
 */

import { Router } from "express";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { frameworkDeploymentOrchestrator } from "../../services/deployments/framework-deployment-orchestrator";

const router = Router();
router.use(ensureAuthenticated);

// GET /api/v1/deployments — list with current state
router.get("/", async (_req, res) => {
  try {
    const list = await frameworkDeploymentOrchestrator.list();
    res.json({ deployments: list });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list deployments", details: error?.message });
  }
});

// GET /api/v1/deployments/:name/health — proxies ContainerRuntime checks
router.get("/:name/health", async (req, res) => {
  try {
    const result = await frameworkDeploymentOrchestrator.health(req.params.name);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Health probe failed", details: error?.message });
  }
});

// GET /api/v1/deployments/:name/events
router.get("/:name/events", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  try {
    const events = await frameworkDeploymentOrchestrator.listEvents(req.params.name, limit);
    res.json({ events });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list events", details: error?.message });
  }
});

// POST /api/v1/deployments/:name/up [admin]
router.post("/:name/up", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  try {
    const result = await frameworkDeploymentOrchestrator.up(req.params.name, user.id);
    await logAudit(user.id, "deployment_up", `/deployments/${req.params.name}/up`, req.params.name, result.ok, req);
    if (!result.ok) {
      return res.status(502).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Deployment up failed", details: error?.message });
  }
});

// POST /api/v1/deployments/:name/down [admin]
router.post("/:name/down", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  try {
    const result = await frameworkDeploymentOrchestrator.down(req.params.name, user.id);
    await logAudit(user.id, "deployment_down", `/deployments/${req.params.name}/down`, req.params.name, result.ok, req);
    if (!result.ok) {
      return res.status(502).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Deployment down failed", details: error?.message });
  }
});

// POST /api/v1/deployments/bundles/:name/up — collective deploy
// Bundles are deployments of kind "bundle"; up cascades to children.
router.post("/bundles/:name/up", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  try {
    const result = await frameworkDeploymentOrchestrator.up(req.params.name, user.id);
    await logAudit(user.id, "deployment_bundle_up", `/deployments/bundles/${req.params.name}/up`, req.params.name, result.ok, req);
    if (!result.ok) {
      return res.status(502).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Bundle deploy failed", details: error?.message });
  }
});

router.post("/bundles/:name/down", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  try {
    const result = await frameworkDeploymentOrchestrator.down(req.params.name, user.id);
    await logAudit(user.id, "deployment_bundle_down", `/deployments/bundles/${req.params.name}/down`, req.params.name, result.ok, req);
    if (!result.ok) {
      return res.status(502).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Bundle teardown failed", details: error?.message });
  }
});

export default router;
