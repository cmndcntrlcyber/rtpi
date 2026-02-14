/**
 * Agent Tool Builds API
 *
 * Endpoints for creating and monitoring GitHub tool installation/creation pipelines.
 * Supports two modes:
 *   - "install": Install tools into an existing agent container (rebuild)
 *   - "create": Create a new agent container from scratch
 */

import { Router } from "express";
import { db } from "../../db";
import { agentToolBuilds, agents } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { agentToolBuilder } from "../../services/agent-tool-builder";

const router = Router();

router.use(ensureAuthenticated);

// POST /api/v1/agent-tool-builds - Create a new build
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const { name, mode, agentId, githubUrls } = req.body;

    // Validate required fields
    if (!name || !mode || !agentId || !githubUrls) {
      return res.status(400).json({
        error: "Missing required fields: name, mode, agentId, githubUrls",
      });
    }

    // Validate mode
    if (mode !== "install" && mode !== "create") {
      return res.status(400).json({
        error: 'Invalid mode. Must be "install" or "create"',
      });
    }

    // Validate githubUrls is an array
    if (!Array.isArray(githubUrls) || githubUrls.length === 0) {
      return res.status(400).json({
        error: "githubUrls must be a non-empty array",
      });
    }

    // Validate each URL matches GitHub pattern
    const invalidUrls = githubUrls.filter(
      (url: string) => !url.match(/github\.com\/[^/]+\/[^/]+/)
    );
    if (invalidUrls.length > 0) {
      return res.status(400).json({
        error: `Invalid GitHub URLs: ${invalidUrls.join(", ")}`,
      });
    }

    // Validate agent exists
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Create build record
    const [build] = await db
      .insert(agentToolBuilds)
      .values({
        name,
        mode,
        agentId,
        githubUrls,
        status: "pending",
        currentStep: "Queued for processing",
      })
      .returning();

    // Kick off the async pipeline (don't await)
    agentToolBuilder.startBuild(build.id).catch((err) => {
      console.error(`[AgentToolBuilder] Build ${build.id} failed:`, err);
    });

    await logAudit(
      user.id,
      "create_agent_tool_build",
      "/agent-tool-builds",
      `${mode}:${name}`,
      true,
      req
    );

    res.status(201).json({ buildId: build.id });
  } catch (error: any) {
    console.error("[AgentToolBuilds] Failed to create build:", error);
    res.status(500).json({
      error: "Failed to create build",
      details: error?.message,
    });
  }
});

// GET /api/v1/agent-tool-builds/:id - Get build status
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [build] = await db
      .select()
      .from(agentToolBuilds)
      .where(eq(agentToolBuilds.id, id))
      .limit(1);

    if (!build) {
      return res.status(404).json({ error: "Build not found" });
    }

    res.json(build);
  } catch (error: any) {
    console.error("[AgentToolBuilds] Failed to get build:", error);
    res.status(500).json({
      error: "Failed to get build status",
      details: error?.message,
    });
  }
});

// GET /api/v1/agent-tool-builds - List all builds
router.get("/", async (_req, res) => {
  try {
    const builds = await db
      .select()
      .from(agentToolBuilds)
      .orderBy(desc(agentToolBuilds.createdAt))
      .limit(50);

    res.json({ builds });
  } catch (error: any) {
    console.error("[AgentToolBuilds] Failed to list builds:", error);
    res.status(500).json({
      error: "Failed to list builds",
      details: error?.message,
    });
  }
});

export default router;
