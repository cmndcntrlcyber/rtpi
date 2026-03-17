/**
 * C2 Warroom API (v2.6)
 *
 * Multi-framework C2 orchestration with dormant activation pattern.
 * Manages C3, Sliver, Loki, and AdaptixC2 alongside existing Empire.
 */

import { Router } from "express";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { dockerExecutor } from "../../services/docker-executor";
import { z } from "zod";

const router = Router();
router.use(ensureAuthenticated);

// ============================================================================
// Framework Definitions
// ============================================================================

interface C2Framework {
  id: string;
  name: string;
  description: string;
  container: string;
  mcpPort: number;
  source: string;
  activationDir: string;
}

const C2_FRAMEWORKS: C2Framework[] = [
  {
    id: "empire",
    name: "Empire",
    description: "PowerShell and Python post-exploitation agent",
    container: "rtpi-empire",
    mcpPort: 1337,
    source: "https://github.com/BC-SECURITY/Empire",
    activationDir: "/opt/Empire",
  },
  {
    id: "c3",
    name: "C3",
    description: "Custom Command and Control framework by ReversecLabs",
    container: "rtpi-c3-agent",
    mcpPort: 9000,
    source: "https://github.com/ReversecLabs/C3",
    activationDir: "/opt/c2-setup",
  },
  {
    id: "sliver",
    name: "Sliver",
    description: "Adversary emulation framework by BishopFox",
    container: "rtpi-sliver-agent",
    mcpPort: 9000,
    source: "https://github.com/BishopFox/sliver",
    activationDir: "/opt/c2-setup",
  },
  {
    id: "loki",
    name: "Loki",
    description: "Simple C2 framework focused on stealth",
    container: "rtpi-loki-agent",
    mcpPort: 9000,
    source: "https://github.com/boku7/Loki",
    activationDir: "/opt/c2-setup",
  },
  {
    id: "adaptix",
    name: "AdaptixC2",
    description: "Adaptable C2 framework with modular architecture",
    container: "rtpi-adaptix-agent",
    mcpPort: 9000,
    source: "https://github.com/Adaptix-Framework/AdaptixC2",
    activationDir: "/opt/c2-setup",
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

async function getFrameworkStatus(fw: C2Framework): Promise<{
  id: string;
  name: string;
  description: string;
  source: string;
  containerStatus: "running" | "stopped" | "not_found";
  activated: boolean;
  healthy: boolean;
}> {
  let containerStatus: "running" | "stopped" | "not_found" = "not_found";
  let activated = false;
  let healthy = false;

  try {
    // Check if container is running
    const checkResult = await dockerExecutor.exec(fw.container, [
      "echo", "alive",
    ], { timeout: 5000 });

    containerStatus = checkResult.exitCode === 0 ? "running" : "stopped";

    if (containerStatus === "running") {
      // Check if activation flag exists
      const flagCheck = await dockerExecutor.exec(fw.container, [
        "test", "-f", `${fw.activationDir}/.activate`,
      ], { timeout: 3000 });
      activated = flagCheck.exitCode === 0;

      // Check MCP health (simple port check)
      if (activated) {
        const healthCheck = await dockerExecutor.exec(fw.container, [
          "bash", "-c", `curl -sf http://localhost:${fw.mcpPort}/health 2>/dev/null || echo "unhealthy"`,
        ], { timeout: 5000 });
        healthy = healthCheck.exitCode === 0 && !healthCheck.stdout.includes("unhealthy");
      }
    }
  } catch {
    containerStatus = "not_found";
  }

  return {
    id: fw.id,
    name: fw.name,
    description: fw.description,
    source: fw.source,
    containerStatus,
    activated,
    healthy,
  };
}

// ============================================================================
// Routes
// ============================================================================

// GET /api/v1/c2-warroom/frameworks - List all C2 frameworks with status
router.get("/frameworks", async (_req, res) => {
  try {
    const statuses = await Promise.all(
      C2_FRAMEWORKS.map((fw) => getFrameworkStatus(fw))
    );
    res.json({ frameworks: statuses });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get framework statuses", details: error.message });
  }
});

// GET /api/v1/c2-warroom/:framework/status - Get single framework status
router.get("/:framework/status", async (req, res) => {
  const fw = C2_FRAMEWORKS.find((f) => f.id === req.params.framework);
  if (!fw) {
    return res.status(404).json({ error: `Unknown framework: ${req.params.framework}` });
  }

  try {
    const status = await getFrameworkStatus(fw);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get status", details: error.message });
  }
});

// POST /api/v1/c2-warroom/:framework/activate - Activate a C2 framework
router.post("/:framework/activate", ensureRole("admin", "operator"), async (req, res) => {
  const fw = C2_FRAMEWORKS.find((f) => f.id === req.params.framework);
  if (!fw) {
    return res.status(404).json({ error: `Unknown framework: ${req.params.framework}` });
  }

  const user = req.user as any;

  try {
    // Create activation flag
    await dockerExecutor.exec(fw.container, [
      "bash", "-c", `mkdir -p ${fw.activationDir} && touch ${fw.activationDir}/.activate`,
    ], { timeout: 10000, user: "root" });

    await logAudit(user.id, "c2_framework_activate", `/c2-warroom/${fw.id}/activate`, fw.id, true, req);

    res.json({
      message: `${fw.name} activation triggered`,
      framework: fw.id,
      status: "activating",
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to activate ${fw.name}`, details: error.message });
  }
});

// POST /api/v1/c2-warroom/:framework/deactivate - Deactivate a C2 framework
router.post("/:framework/deactivate", ensureRole("admin", "operator"), async (req, res) => {
  const fw = C2_FRAMEWORKS.find((f) => f.id === req.params.framework);
  if (!fw) {
    return res.status(404).json({ error: `Unknown framework: ${req.params.framework}` });
  }

  const user = req.user as any;

  try {
    // Remove activation flag
    await dockerExecutor.exec(fw.container, [
      "rm", "-f", `${fw.activationDir}/.activate`,
    ], { timeout: 10000, user: "root" });

    await logAudit(user.id, "c2_framework_deactivate", `/c2-warroom/${fw.id}/deactivate`, fw.id, true, req);

    res.json({
      message: `${fw.name} deactivation triggered`,
      framework: fw.id,
      status: "deactivating",
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to deactivate ${fw.name}`, details: error.message });
  }
});

// POST /api/v1/c2-warroom/research - Tavily-powered C2 research
router.post("/research", ensureRole("admin", "operator"), async (req, res) => {
  const schema = z.object({
    query: z.string().min(1),
    framework: z.string().optional(),
  });

  try {
    const { query, framework } = schema.parse(req.body);

    // Build search query with C2 context
    const searchQuery = framework
      ? `${query} ${framework} C2 framework`
      : `${query} command and control C2`;

    // Use Tavily via the research agent's search approach
    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (!tavilyApiKey) {
      return res.status(503).json({ error: "Tavily API key not configured" });
    }

    const tavilyResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: searchQuery,
        search_depth: "advanced",
        max_results: 8,
        include_answer: true,
      }),
    });

    if (!tavilyResponse.ok) {
      throw new Error(`Tavily API error: ${tavilyResponse.status}`);
    }

    const data = await tavilyResponse.json();

    res.json({
      query: searchQuery,
      answer: data.answer || null,
      results: (data.results || []).map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content?.substring(0, 500),
        score: r.score,
      })),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    res.status(500).json({ error: "Research failed", details: error.message });
  }
});

export default router;
