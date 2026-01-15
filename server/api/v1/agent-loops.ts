import { Router } from "express";
import { ensureAuthenticated, logAudit } from "../../auth/middleware";
import { agentLoopService } from "../../services/agent-tool-connector";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/agent-loops - List active loops
router.get("/", async (_req, res) => {
  try {
    const loops = agentLoopService.getActiveLoops();
    res.json({ loops });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list agent loops", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/agent-loops/:id - Get loop details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const loop = agentLoopService.getLoop(id);
    
    if (!loop) {
      return res.status(404).json({ error: "Loop not found" });
    }

    res.json({ loop });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get loop details", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/agent-loops/start - Start new loop
router.post("/start", async (req, res) => {
  const user = req.user as any;
  const { agentId, targetId, initialInput } = req.body;

  // Validate required fields
  if (!agentId || !targetId || !initialInput) {
    return res.status(400).json({ 
      error: "Missing required fields: agentId, targetId, initialInput" 
    });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(agentId)) {
    return res.status(400).json({ 
      error: "Invalid agentId format. Must be a valid UUID." 
    });
  }

  if (!uuidRegex.test(targetId)) {
    return res.status(400).json({ 
      error: "Invalid targetId format. Must be a valid UUID." 
    });
  }

  try {
    const loop = await agentLoopService.startLoop(
      agentId,
      targetId,
      initialInput
    );

    await logAudit(user.id, "start_agent_loop", "/agent-loops", loop?.id || null, true, req);

    res.status(201).json({ loop });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "start_agent_loop", "/agent-loops", null, false, req);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to start loop" 
    });
  }
});

// POST /api/v1/agent-loops/:id/stop - Stop running loop
router.post("/:id/stop", async (req, res) => {
  const user = req.user as any;
  const { id } = req.params;

  try {
    const stopped = agentLoopService.stopLoop(id);
    
    if (!stopped) {
      return res.status(404).json({ error: "Loop not found or already stopped" });
    }

    await logAudit(user.id, "stop_agent_loop", "/agent-loops", id, true, req);

    res.json({ success: true, message: "Loop stopped successfully" });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "stop_agent_loop", "/agent-loops", id, false, req);
    res.status(500).json({ error: "Failed to stop loop", details: error?.message || "Internal server error" });
  }
});

export default router;
