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
import { spawn, exec } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execAsync = promisify(exec);

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// Agent type definitions
const AGENT_TYPES = [
  {
    id: "burp-suite",
    name: "Burp Suite Agent",
    dockerfile: "Dockerfile.burp-tools",
    image: "rtpi/burp-tools:latest",
    tactics: ["reconnaissance", "initial-access"],
  },
  {
    id: "empire-c2",
    name: "Empire C2 Agent",
    dockerfile: "Dockerfile.empire-tools",
    image: "rtpi/empire-tools:latest",
    tactics: ["command-and-control", "lateral-movement", "persistence"],
  },
  {
    id: "fuzzing",
    name: "Advanced Fuzzing Agent",
    dockerfile: "Dockerfile.fuzzing-tools",
    image: "rtpi/fuzzing-tools:latest",
    tactics: ["discovery", "reconnaissance"],
  },
  {
    id: "framework-security",
    name: "Framework Security Agent",
    dockerfile: "Dockerfile.framework-tools",
    image: "rtpi/framework-tools:latest",
    tactics: ["reconnaissance", "initial-access"],
  },
  {
    id: "maldev",
    name: "Maldev Agent",
    dockerfile: "Dockerfile.maldev-tools",
    image: "rtpi/maldev-tools:latest",
    tactics: ["defense-evasion", "execution", "persistence"],
  },
  {
    id: "azure-ad",
    name: "Azure-AD Agent",
    dockerfile: "Dockerfile.azure-ad-tools",
    image: "rtpi/azure-ad-tools:latest",
    tactics: ["credential-access", "persistence", "lateral-movement"],
  },
  {
    id: "research",
    name: "Research Agent",
    dockerfile: "Dockerfile.research-tools",
    image: "rtpi/research-tools:latest",
    tactics: ["*"],
  },
];

// GET /api/v1/offsec-agents/types - List available agent types
router.get("/types", async (_req, res) => {
  try {
    res.json({ agentTypes: AGENT_TYPES });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list agent types" });
  }
});

// GET /api/v1/offsec-agents - List all OffSec agent containers
router.get("/", async (_req, res) => {
  try {
    const agentContainers = await db
      .select()
      .from(containers)
      .where(like(containers.name, "%offsec%"));

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

    const containerName = `rtpi-${agentType}-agent`;
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

    const containerName = `rtpi-${agentType}-agent`;

    // Check if already running
    const status = await getContainerStatus(containerName);
    if (status === "running") {
      return res.json({ success: true, message: "Container already running" });
    }

    // Start container
    await startContainer(containerName, agentConfig.image, agentType);

    // Register in database
    await db
      .insert(containers)
      .values({
        name: containerName,
        host: "localhost",
        port: 9000,
        status: "running",
        imageTag: agentConfig.image,
        capabilities: agentConfig.tactics,
      })
      .onConflictDoUpdate({
        target: containers.name,
        set: {
          status: "running",
          lastChecked: new Date(),
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
    const containerName = `rtpi-${agentType}-agent`;

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
    const containerName = `rtpi-${agentType}-agent`;
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
    const containerName = `rtpi-${agentType}-agent`;
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
  // Execute MCP list_tools via container
  const { stdout } = await execAsync(
    `docker exec ${containerName} node /mcp/dist/index.js --list-tools 2>/dev/null || echo "[]"`
  );

  try {
    return JSON.parse(stdout);
  } catch {
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

export default router;
