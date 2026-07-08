import { Router } from "express";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { sliverExecutor } from "../../services/sliver-executor";

const router = Router();

router.use(ensureAuthenticated);

// Check Sliver connection status
router.get("/status", async (_req, res) => {
  try {
    const result = await sliverExecutor.checkConnection();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to check Sliver status", details: error?.message || "Internal server error" });
  }
});

// List sessions/beacons
router.get("/sessions", async (_req, res) => {
  try {
    const result = await sliverExecutor.listSessions();
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list sessions", details: error?.message || "Internal server error" });
  }
});

// Sync sessions from Sliver to RTPI database
router.post("/sessions/sync", async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const result = await sliverExecutor.syncSessions(userId);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to sync sessions", details: error?.message || "Internal server error" });
  }
});

// Execute command on a session
router.post("/sessions/:sessionId/execute", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: "Command is required" });
    }

    const result = await sliverExecutor.executeCommand(
      req.params.sessionId,
      command,
      userId
    );

    await logAudit(userId, "sliver_execute_command", "sliver", req.params.sessionId, result.success, req);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.status(201).json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to execute command", details: error?.message || "Internal server error" });
  }
});

// Kill a session
router.delete("/sessions/:sessionId", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const result = await sliverExecutor.killSession(req.params.sessionId, userId);

    await logAudit(userId, "sliver_kill_session", "sliver", req.params.sessionId, result.success, req);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: "Failed to kill session", details: error?.message || "Internal server error" });
  }
});

// List implants
router.get("/implants", async (_req, res) => {
  try {
    const result = await sliverExecutor.listImplants();
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list implants", details: error?.message || "Internal server error" });
  }
});

// Generate an implant
router.post("/implants/generate", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const result = await sliverExecutor.generateImplant(req.body, userId);

    await logAudit(userId, "sliver_generate_implant", "sliver", null, result.success, req);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.status(201).json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate implant", details: error?.message || "Internal server error" });
  }
});

// List active jobs (listeners)
router.get("/jobs", async (_req, res) => {
  try {
    const result = await sliverExecutor.listJobs();
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list jobs", details: error?.message || "Internal server error" });
  }
});

// Start a listener
router.post("/listeners", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const result = await sliverExecutor.startListener(req.body, userId);

    await logAudit(userId, "sliver_start_listener", "sliver", null, result.success, req);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.status(201).json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to start listener", details: error?.message || "Internal server error" });
  }
});

// Stop a listener (kill job)
router.delete("/jobs/:jobId", ensureRole("admin", "operator"), async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const jobId = parseInt(req.params.jobId, 10);

    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    const result = await sliverExecutor.stopListener(jobId, userId);

    await logAudit(userId, "sliver_stop_listener", "sliver", req.params.jobId, result.success, req);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: "Failed to stop listener", details: error?.message || "Internal server error" });
  }
});

export default router;
