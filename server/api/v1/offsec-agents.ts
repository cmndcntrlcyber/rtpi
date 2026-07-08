/**
 * OffSec Agent Container Management API
 *
 * Provides endpoints for managing specialized OffSec agent Docker containers,
 * including building, starting, stopping, and tool discovery via MCP.
 */

import { Router } from "express";
import { db } from "../../db";
import { containers } from "@shared/schema";
import { eq, and, like } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { dockerExecutor } from "../../services/docker-executor";
import { githubRepoDiscovery } from "../../services/github-repo-discovery";
import { syncOffsecContainerMcpServers } from "../../services/mcp/offsec-mcp-sync";
import { readFeatureFlags } from "@shared/feature-flags";
import { spawn, exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import multer from "multer";
import * as fs from "fs";
import { createLogger } from '../../lib/logger';
const log = createLogger("offsec-agents");

const execAsync = promisify(exec);

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// Agent type definitions.
//
// One entry per offsec-agents-profile service in docker-compose.yml (14 total).
// `id` is the canonical agent type — it matches the container's AGENT_TYPE env
// var and is the `:agentType` route param. `containerName` is the EXPLICIT
// compose `container_name`, because it does NOT follow `rtpi-${id}-agent`:
// e.g. id "burp-suite" runs as `rtpi-burp-agent`, "empire-c2" as
// `rtpi-empire-agent`. The old `rtpi-${id}-agent` derivation silently targeted
// non-existent containers for every multi-word id (B9). Resolve names through
// `resolveContainerName()` below — never rebuild them inline.
interface AgentTypeDef {
  id: string;
  name: string;
  dockerfile: string;
  image: string;
  containerName: string;
  tactics: string[];
}

const AGENT_TYPES: AgentTypeDef[] = [
  {
    id: "burp-suite",
    name: "Burp Suite Agent",
    dockerfile: "Dockerfile.burp-tools",
    image: "rtpi/burp-tools:latest",
    containerName: "rtpi-burp-agent",
    tactics: ["reconnaissance", "initial-access"],
  },
  {
    id: "empire-c2",
    name: "Empire C2 Agent",
    dockerfile: "Dockerfile.empire-tools",
    image: "rtpi/empire-tools:latest",
    containerName: "rtpi-empire-agent",
    tactics: ["command-and-control", "lateral-movement", "persistence"],
  },
  {
    id: "c3-c2",
    name: "C3 C2 Agent",
    dockerfile: "Dockerfile.c3-tools",
    image: "rtpi/c3-tools:latest",
    containerName: "rtpi-c3-agent",
    tactics: ["command-and-control"],
  },
  {
    id: "sliver-c2",
    name: "Sliver C2 Agent",
    dockerfile: "Dockerfile.sliver-tools",
    image: "rtpi/sliver-tools:latest",
    containerName: "rtpi-sliver-agent",
    tactics: ["command-and-control"],
  },
  {
    id: "loki-c2",
    name: "Loki C2 Agent",
    dockerfile: "Dockerfile.loki-tools",
    image: "rtpi/loki-tools:latest",
    containerName: "rtpi-loki-agent",
    tactics: ["command-and-control"],
  },
  {
    id: "adaptix-c2",
    name: "AdaptixC2 Agent",
    dockerfile: "Dockerfile.adaptix-tools",
    image: "rtpi/adaptix-tools:latest",
    containerName: "rtpi-adaptix-agent",
    tactics: ["command-and-control"],
  },
  {
    id: "fuzzing",
    name: "Advanced Fuzzing Agent",
    dockerfile: "Dockerfile.fuzzing-tools",
    image: "rtpi/fuzzing-tools:latest",
    containerName: "rtpi-fuzzing-agent",
    tactics: ["discovery", "reconnaissance"],
  },
  {
    id: "framework-security",
    name: "Framework Security Agent",
    dockerfile: "Dockerfile.framework-tools",
    image: "rtpi/framework-tools:latest",
    containerName: "rtpi-framework-agent",
    tactics: ["reconnaissance", "initial-access"],
  },
  {
    id: "maldev",
    name: "Maldev Agent",
    dockerfile: "Dockerfile.maldev-tools",
    image: "rtpi/maldev-tools:latest",
    containerName: "rtpi-maldev-agent",
    tactics: ["defense-evasion", "execution", "persistence"],
  },
  {
    id: "azure-ad",
    name: "Azure-AD Agent",
    dockerfile: "Dockerfile.azure-ad-tools",
    image: "rtpi/azure-ad-tools:latest",
    containerName: "rtpi-azure-ad-agent",
    tactics: ["credential-access", "persistence", "lateral-movement"],
  },
  {
    id: "cloud-security",
    name: "Cloud Security Agent",
    dockerfile: "Dockerfile.cloud-tools",
    image: "rtpi/cloud-tools:latest",
    containerName: "rtpi-cloud-agent",
    tactics: ["discovery", "credential-access", "lateral-movement"],
  },
  {
    id: "llm-security",
    name: "LLM Security Agent",
    dockerfile: "Dockerfile.agent-tools-llm-sec-tools",
    image: "rtpi/llm-sec-tools:latest",
    containerName: "rtpi-llm-sec-agent",
    tactics: ["*"],
  },
  {
    id: "web-injection",
    name: "Web Injection Agent",
    dockerfile: "Dockerfile.agent-tools-web-injection",
    image: "rtpi/web-injection-tools:latest",
    containerName: "rtpi-web-injection-agent",
    tactics: ["initial-access", "execution"],
  },
  {
    id: "research",
    name: "Research Agent",
    dockerfile: "Dockerfile.research-tools",
    image: "rtpi/research-tools:latest",
    containerName: "rtpi-research-agent",
    tactics: ["*"],
  },
];

// Resolve the Docker container name for an agent type. Prefers the explicit
// registry mapping; falls back to the legacy `rtpi-${id}-agent` convention so
// any not-yet-registered type still degrades to its best-guess name rather
// than throwing.
function resolveContainerName(agentType: string): string {
  const cfg = AGENT_TYPES.find((a) => a.id === agentType);
  return cfg?.containerName ?? `rtpi-${agentType}-agent`;
}

// GET /api/v1/offsec-agents/types - List available agent types
router.get("/types", async (_req, res) => {
  try {
    res.json({ agentTypes: AGENT_TYPES });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list agent types" });
  }
});

// POST /api/v1/offsec-agents/sync - Reconcile running OffSec containers into DB
// Picks up containers started by docker-compose (or any other path) and writes
// them into the `containers` table so the UI sees them.
router.post("/sync", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;
  const synced: Array<{ name: string; status: string; action: string }> = [];
  const errors: Array<{ name: string; error: string }> = [];

  try {
    // Get every container Docker knows about.
    const dockerContainers = await dockerExecutor.listContainers();

    // Match the actual on-disk naming pattern (rtpi-<anything>-agent). The
    // AGENT_TYPES list is incomplete — it only describes the agents the UI
    // can build/start, not every container that compose may spin up.
    const offsecPattern = /^rtpi-.+-agent$/;

    for (const dc of dockerContainers) {
      if (!offsecPattern.test(dc.name)) continue;

      try {
        // Derive the agentType id from the container name (rtpi-<id>-agent).
        // Falls back to the raw segment when there's no AGENT_TYPES entry.
        const derivedId = dc.name.replace(/^rtpi-/, "").replace(/-agent$/, "");
        const agentConfig = AGENT_TYPES.find(
          (t) => t.containerName === dc.name || t.id === derivedId
        );
        const status = dc.running ? "running" : "stopped";
        const now = new Date();

        const result = await db
          .insert(containers)
          .values({
            containerId: dc.id,
            name: dc.name,
            image: dc.image,
            status: status as any,
            environment: agentConfig
              ? { agentType: agentConfig.id, tactics: agentConfig.tactics }
              : { agentType: dc.name.replace(/^rtpi-/, "").replace(/-agent$/, "") },
            created: dc.created,
            started: dc.running ? dc.created : null,
          })
          .onConflictDoUpdate({
            target: containers.containerId,
            set: {
              status: status as any,
              image: dc.image,
              lastChecked: now,
            },
          })
          .returning();

        synced.push({
          name: dc.name,
          status,
          action: result.length > 0 ? "upserted" : "noop",
        });
      } catch (err: any) {
        errors.push({ name: dc.name, error: err?.message || String(err) });
      }
    }

    await logAudit(
      user.id,
      "sync_offsec_agents",
      "/offsec-agents/sync",
      `${synced.length} synced`,
      errors.length === 0,
      req
    );

    res.json({ synced, errors });
  } catch (error: any) {
    log.error("[offsec-agents] /sync failed:", error);
    res.status(500).json({ error: "Failed to sync OffSec agents", details: error?.message });
  }
});

// POST /api/v1/offsec-agents/register-mcp — register running offsec containers
// as managed MCP servers (FF_OFFSEC_MANAGED_MCP). This is the opt-in path to
// the target architecture: each container's embedded stdio MCP server becomes a
// first-class managed server (lifecycle, liveness, JSON-RPC tooling) instead of
// being reached only via the per-call CLI bridge. Additive and idempotent —
// the CLI bridge (getMCPTools/executeMCPTool) remains the default until a
// live-container validation pass flips it. See services/mcp/offsec-mcp-sync.ts.
router.post("/register-mcp", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  if (!readFeatureFlags(process.env).offsecManagedMcp) {
    return res.status(404).json({
      error: "FF_OFFSEC_MANAGED_MCP disabled",
      message:
        "Set FF_OFFSEC_MANAGED_MCP=true to register offsec containers as managed MCP servers.",
    });
  }

  try {
    const result = await syncOffsecContainerMcpServers();
    await logAudit(
      user.id,
      "offsec_register_mcp",
      "/offsec-agents/register-mcp",
      `${result.inserted} inserted`,
      true,
      req,
    );
    res.json(result);
  } catch (error: any) {
    await logAudit(user.id, "offsec_register_mcp", "/offsec-agents/register-mcp", null, false, req);
    res.status(500).json({ error: "Failed to register offsec MCP servers", details: error?.message });
  }
});

// GET /api/v1/offsec-agents - List all OffSec agent containers
router.get("/", async (_req, res) => {
  try {
    // OffSec container names follow the pattern rtpi-<type>-agent. The legacy
    // filter was %offsec% which never matched any real row.
    const agentContainers = await db
      .select()
      .from(containers)
      .where(like(containers.name, "rtpi-%-agent"));

    // Enrich with status from Docker
    const enrichedContainers = await Promise.all(
      agentContainers.map(async (container) => {
        try {
          const status = await getContainerStatus(container.name);
          return { ...container, dockerStatus: status };
        } catch {
          return { ...container, dockerStatus: "unknown" };
        }
      })
    );

    res.json({ containers: enrichedContainers });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list OffSec agents" });
  }
});

// GET /api/v1/offsec-agents/:agentType/status - Get agent container status
router.get("/:agentType/status", async (req, res) => {
  const { agentType } = req.params;

  try {
    const agentConfig = AGENT_TYPES.find((a) => a.id === agentType);
    if (!agentConfig) {
      return res.status(404).json({ error: "Agent type not found" });
    }

    const containerName = resolveContainerName(agentType);
    const status = await getContainerStatus(containerName);

    // Get MCP tools if running
    let tools: any[] = [];
    if (status === "running") {
      try {
        tools = await getMCPTools(containerName);
      } catch {
        // MCP may not be ready yet
      }
    }

    res.json({
      agentType,
      name: agentConfig.name,
      containerName,
      image: agentConfig.image,
      status,
      tactics: agentConfig.tactics,
      tools,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get agent status" });
  }
});

// POST /api/v1/offsec-agents/:agentType/build - Build agent container image
router.post("/:agentType/build", ensureRole("admin"), async (req, res) => {
  const { agentType } = req.params;
  const user = req.user as any;

  try {
    const agentConfig = AGENT_TYPES.find((a) => a.id === agentType);
    if (!agentConfig) {
      return res.status(404).json({ error: "Agent type not found" });
    }

    // Build base image first if needed
    const baseImageExists = await checkImageExists("rtpi/offsec-base:latest");
    if (!baseImageExists) {
      await buildDockerImage(
        "docker/offsec-agents",
        "Dockerfile.base",
        "rtpi/offsec-base:latest"
      );
    }

    // Build agent-specific image
    const buildResult = await buildDockerImage(
      "docker/offsec-agents",
      agentConfig.dockerfile,
      agentConfig.image
    );

    await logAudit(user.id, "build_offsec_agent", "/offsec-agents", agentType, true, req);

    res.json({
      success: true,
      image: agentConfig.image,
      buildOutput: buildResult,
    });
  } catch (error: any) {
    await logAudit(user.id, "build_offsec_agent", "/offsec-agents", agentType, false, req);
    res.status(500).json({ error: "Failed to build agent", details: error?.message });
  }
});

// POST /api/v1/offsec-agents/:agentType/start - Start agent container
router.post("/:agentType/start", ensureRole("admin", "operator"), async (req, res) => {
  const { agentType } = req.params;
  const user = req.user as any;

  try {
    const agentConfig = AGENT_TYPES.find((a) => a.id === agentType);
    if (!agentConfig) {
      return res.status(404).json({ error: "Agent type not found" });
    }

    const containerName = resolveContainerName(agentType);

    // Check if already running
    const status = await getContainerStatus(containerName);
    if (status === "running") {
      return res.json({ success: true, message: "Container already running" });
    }

    // Start container
    await startContainer(containerName, agentConfig.image, agentType);

    // Look up the new container's Docker ID so we satisfy NOT NULL container_id
    const dockerContainerId = await getDockerContainerId(containerName);
    const now = new Date();

    await db
      .insert(containers)
      .values({
        containerId: dockerContainerId,
        name: containerName,
        image: agentConfig.image,
        status: "running",
        environment: { agentType, tactics: agentConfig.tactics },
        created: now,
        started: now,
      })
      .onConflictDoUpdate({
        target: containers.containerId,
        set: {
          status: "running",
          started: now,
          lastChecked: now,
        },
      });

    await logAudit(user.id, "start_offsec_agent", "/offsec-agents", agentType, true, req);

    res.json({
      success: true,
      containerName,
      image: agentConfig.image,
    });
  } catch (error: any) {
    await logAudit(user.id, "start_offsec_agent", "/offsec-agents", agentType, false, req);
    res.status(500).json({ error: "Failed to start agent", details: error?.message });
  }
});

// POST /api/v1/offsec-agents/:agentType/stop - Stop agent container
router.post("/:agentType/stop", ensureRole("admin", "operator"), async (req, res) => {
  const { agentType } = req.params;
  const user = req.user as any;

  try {
    const containerName = resolveContainerName(agentType);

    await stopContainer(containerName);

    // Update database
    await db
      .update(containers)
      .set({
        status: "stopped",
        lastChecked: new Date(),
      })
      .where(eq(containers.name, containerName));

    await logAudit(user.id, "stop_offsec_agent", "/offsec-agents", agentType, true, req);

    res.json({ success: true, containerName });
  } catch (error: any) {
    await logAudit(user.id, "stop_offsec_agent", "/offsec-agents", agentType, false, req);
    res.status(500).json({ error: "Failed to stop agent", details: error?.message });
  }
});

// GET /api/v1/offsec-agents/:agentType/tools - List tools available in agent
router.get("/:agentType/tools", async (req, res) => {
  const { agentType } = req.params;

  try {
    const containerName = resolveContainerName(agentType);
    const status = await getContainerStatus(containerName);

    if (status !== "running") {
      return res.status(400).json({ error: "Agent container is not running" });
    }

    const tools = await getMCPTools(containerName);
    res.json({ tools });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get tools", details: error?.message });
  }
});

// POST /api/v1/offsec-agents/:agentType/tools/:toolName/execute - Execute a tool
router.post("/:agentType/tools/:toolName/execute", ensureRole("admin", "operator"), async (req, res) => {
  const { agentType, toolName } = req.params;
  const { args } = req.body;
  const user = req.user as any;

  try {
    const containerName = resolveContainerName(agentType);
    const status = await getContainerStatus(containerName);

    if (status !== "running") {
      return res.status(400).json({ error: "Agent container is not running" });
    }

    const result = await executeMCPTool(containerName, toolName, args || {});

    await logAudit(user.id, "execute_offsec_tool", "/offsec-agents", `${agentType}/${toolName}`, true, req);

    res.json(result);
  } catch (error: any) {
    await logAudit(user.id, "execute_offsec_tool", "/offsec-agents", `${agentType}/${toolName}`, false, req);
    res.status(500).json({ error: "Failed to execute tool", details: error?.message });
  }
});

// GET /api/v1/offsec-agents/:agentType/discover-repos - Discover GitHub repos for agent
router.get("/:agentType/discover-repos", async (req, res) => {
  const { agentType } = req.params;

  try {
    const result = await githubRepoDiscovery.discoverReposForAgent(agentType);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to discover repos", details: error?.message });
  }
});

// GET /api/v1/offsec-agents/:agentType/dockerfile - Generate Dockerfile section
router.get("/:agentType/dockerfile", async (req, res) => {
  const { agentType } = req.params;

  try {
    const dockerfile = await githubRepoDiscovery.generateDockerfileSection(agentType);
    res.type("text/plain").send(dockerfile);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate Dockerfile", details: error?.message });
  }
});

// GET /api/v1/offsec-agents/:agentType/documentation - Generate tool documentation
router.get("/:agentType/documentation", async (req, res) => {
  const { agentType } = req.params;

  try {
    const docs = await githubRepoDiscovery.generateToolDocumentation(agentType);
    res.type("text/markdown").send(docs);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate documentation", details: error?.message });
  }
});

// Helper functions

async function getContainerStatus(containerName: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `docker inspect -f '{{.State.Status}}' ${containerName} 2>/dev/null`
    );
    return stdout.trim();
  } catch {
    return "not_found";
  }
}

async function getDockerContainerId(containerName: string): Promise<string> {
  const { stdout } = await execAsync(
    `docker inspect -f '{{.Id}}' ${containerName}`
  );
  return stdout.trim();
}

async function getContainerImage(containerName: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `docker inspect -f '{{.Config.Image}}' ${containerName} 2>/dev/null`
    );
    return stdout.trim();
  } catch {
    return "";
  }
}

async function getContainerCreated(containerName: string): Promise<Date> {
  try {
    const { stdout } = await execAsync(
      `docker inspect -f '{{.Created}}' ${containerName} 2>/dev/null`
    );
    return new Date(stdout.trim());
  } catch {
    return new Date();
  }
}

async function checkImageExists(imageName: string): Promise<boolean> {
  try {
    await execAsync(`docker image inspect ${imageName} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

async function buildDockerImage(
  contextPath: string,
  dockerfile: string,
  tag: string
): Promise<string> {
  const fullPath = path.resolve(process.cwd(), contextPath);
  const { stdout, stderr } = await execAsync(
    `docker build -f ${fullPath}/${dockerfile} -t ${tag} ${fullPath}`,
    { maxBuffer: 50 * 1024 * 1024 } // 50MB buffer for build output
  );
  return stdout + stderr;
}

async function startContainer(
  containerName: string,
  imageName: string,
  agentType: string
): Promise<void> {
  // Remove existing container if exists
  try {
    await execAsync(`docker rm -f ${containerName} 2>/dev/null`);
  } catch {
    // Container doesn't exist, that's fine
  }

  // Start new container
  const cmd = [
    "docker run -d",
    `--name ${containerName}`,
    "-e AGENT_TYPE=" + agentType,
    "-v /var/run/docker.sock:/var/run/docker.sock:ro",
    "--network rtpi-network",
    "--restart unless-stopped",
    imageName,
  ].join(" ");

  await execAsync(cmd);
}

async function stopContainer(containerName: string): Promise<void> {
  await execAsync(`docker stop ${containerName}`);
}

async function getMCPTools(containerName: string): Promise<any[]> {
  // Execute MCP list_tools via the container's one-shot CLI mode.
  // stderr is the MCP server's diagnostic channel; stdout is clean JSON.
  let stdout = "";
  let stderr = "";
  try {
    ({ stdout, stderr } = await execAsync(
      `docker exec ${containerName} node /mcp/dist/index.js --list-tools`
    ));
  } catch (error: any) {
    // Non-zero exit / docker exec failure: surface it rather than masking as [].
    log.warn(
      `[offsec-agents] MCP tool discovery failed for ${containerName}: ${error.message}`
    );
    return [];
  }

  try {
    const tools = JSON.parse(stdout);
    if (Array.isArray(tools) && tools.length === 0) {
      log.warn(
        `[offsec-agents] MCP bridge returned zero tools for running container ${containerName}. ` +
          `This usually means tool discovery found nothing under TOOLS_PATH, not a bridge failure.`
      );
    }
    return Array.isArray(tools) ? tools : [];
  } catch {
    // stdout was not parseable JSON — the bridge itself is misbehaving.
    log.warn(
      `[offsec-agents] MCP bridge for ${containerName} returned non-JSON output. ` +
        `stdout="${stdout.slice(0, 200)}" stderr="${stderr.slice(0, 200)}"`
    );
    return [];
  }
}

async function executeMCPTool(
  containerName: string,
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  const argsJson = JSON.stringify(args);
  const { stdout, stderr } = await execAsync(
    `docker exec ${containerName} node /mcp/dist/index.js --execute-tool '${toolName}' --args '${argsJson}'`
  );

  try {
    return JSON.parse(stdout);
  } catch {
    return { stdout, stderr };
  }
}

// ============================================================================
// POST /api/v1/offsec-agents/maldev/upload-binary
// Upload a binary file for maldev agent analysis (radare2, ROPgadget, etc.)
// ============================================================================

const binaryStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join("/tmp", "maldev-binaries");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const binaryUpload = multer({
  storage: binaryStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

router.post(
  "/maldev/upload-binary",
  ensureRole("admin", "operator"),
  binaryUpload.single("binary"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No binary file uploaded" });
    }

    try {
      const localPath = req.file.path;
      const containerPath = `/tmp/analysis/${req.file.filename}`;

      // Create directory in container and copy file via docker cp
      await execAsync(`docker exec rtpi-maldev-agent mkdir -p /tmp/analysis`);
      await execAsync(`docker cp "${localPath}" rtpi-maldev-agent:${containerPath}`);
      await execAsync(`docker exec rtpi-maldev-agent chown rtpi-agent:rtpi-agent "${containerPath}"`);

      // Clean up local temp file
      fs.unlinkSync(localPath);

      res.json({
        success: true,
        containerPath,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        message: `Binary uploaded to maldev container at ${containerPath}`,
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        error: "Failed to upload binary to maldev container",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// ============================================================================
// POST /api/v1/offsec-agents/maldev/analyze
// Run binary analysis on a file already in the maldev container
// ============================================================================

router.post(
  "/maldev/analyze",
  ensureRole("admin", "operator"),
  async (req, res) => {
    const { containerPath } = req.body;

    if (!containerPath) {
      return res.status(400).json({ error: "containerPath is required" });
    }

    try {
      const { maldevToolExecutor } = await import("../../services/agents/maldev-tool-executor");

      const analysis = await maldevToolExecutor.analyzeWithRadare2(containerPath);

      res.json({
        success: true,
        analysis,
        message: `Analysis complete for ${containerPath}`,
      });
    } catch (error) {
      res.status(500).json({
        error: "Binary analysis failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
