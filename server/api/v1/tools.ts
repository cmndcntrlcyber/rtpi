import { Router } from "express";
import { db } from "../../db";
import { securityTools, toolUploads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { dockerExecutor } from "../../services/docker-executor";
import { agentToolConnector } from "../../services/agent-tool-connector";
import multer from "multer";
import path from "path";
import fs from "fs";

// Import new tool framework services
import {
  registerTool,
  getToolById as getNewToolById,
  listTools as listNewTools,
  getToolStatistics,
  searchTools,
  getInstalledTools,
  getValidatedTools,
} from "../../services/tool-registry-manager";
import {
  discoverTools,
  getDiscoverySummary,
  type DiscoveredTool,
} from "../../services/tool-discovery-service";
import {
  executeTool as executeNewTool,
  getExecutionResult,
} from "../../services/tool-executor";
import {
  runAllTests,
  quickHealthCheck,
  validateToolConfiguration as validateConfig,
  getTestCoverage,
} from "../../services/tool-tester";
import {
  analyzeGitHubRepository,
  installToolFromGitHub,
} from "../../services/github-tool-installer";
import type { ToolConfiguration } from "../../../shared/types/tool-config";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "tools");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for JAR files
  },
  fileFilter: (_req, file, cb) => {
    // Allow JAR files for Burp Suite and other file types
    const allowedExts = [".jar", ".zip", ".tar", ".gz", ".exe", ".sh"];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExts.includes(ext) || file.mimetype === "application/java-archive") {
      cb(null, true);
    } else {
      cb(new Error("Only .jar, .zip, .tar, .gz, .exe, .sh files are allowed"));
    }
  },
});

// GET /api/v1/tools - List all security tools
router.get("/", async (_req, res) => {
  try {
    const allTools = await db.select().from(securityTools);

    // Filter out test/invalid tools
    const tools = allTools.filter(tool => {
      const hasInvalidName = tool.name.toLowerCase().includes('invalid');
      const hasInvalidPath =
        tool.configPath?.includes('/invalid/') ||
        tool.command?.includes('/invalid/') ||
        (tool.metadata && JSON.stringify(tool.metadata).includes('/invalid/'));
      return !hasInvalidName && !hasInvalidPath;
    });

    res.json({ tools });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list tools", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/tools/:id - Get tool details
// NOTE: Must come AFTER specific routes like /registry, /categories, /executions, etc.
// to avoid matching those as :id parameters
router.get("/:id", async (req, res, next) => {
  const { id } = req.params;

  // Skip if this looks like a special route (not a UUID) - let next handler deal with it
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return next();
  }

  try {
    const result = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Tool not found" });
    }

    res.json({ tool: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get tool", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/tools - Add new tool
router.post("/", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const tool = await db
      .insert(securityTools)
      .values(req.body)
      .returning();

    await logAudit(user.id, "add_tool", "/tools", tool[0].id, true, req);

    res.status(201).json({ tool: tool[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "add_tool", "/tools", null, false, req);
    res.status(500).json({ error: "Failed to add tool", details: error?.message || "Internal server error" });
  }
});

// PUT /api/v1/tools/:id - Update tool
router.put("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(securityTools)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(securityTools.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Tool not found" });
    }

    await logAudit(user.id, "update_tool", "/tools", id, true, req);

    res.json({ tool: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "update_tool", "/tools", id, false, req);
    res.status(500).json({ error: "Failed to update tool", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/tools/:id/upload - Upload tool file (e.g., Burp Suite JAR)
router.post("/:id/upload", upload.single("file"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Record the upload
    const uploadRecord = await db
      .insert(toolUploads)
      .values({
        toolId: id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        uploadedBy: user.id,
        metadata: {
          destination: req.file.destination,
        },
      })
      .returning();

    // Update tool with file path
    await db
      .update(securityTools)
      .set({
        configPath: req.file.path,
        updatedAt: new Date(),
      })
      .where(eq(securityTools.id, id));

    await logAudit(user.id, "upload_tool_file", "/tools", id, true, req);

    res.status(201).json({
      message: "File uploaded successfully",
      upload: uploadRecord[0],
    });
  } catch (error: any) {
    // Error logged for debugging
    // Clean up file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    await logAudit(user.id, "upload_tool_file", "/tools", id, false, req);
    res.status(500).json({ error: "Failed to upload file", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/tools/:id/execute - Execute tool (legacy)
router.post("/:id/execute", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    // Get tool details
    const result = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Tool not found" });
    }

    const tool = result[0];

    // Update usage stats
    await db
      .update(securityTools)
      .set({
        lastUsed: new Date(),
        usageCount: tool.usageCount + 1,
        status: "running",
      })
      .where(eq(securityTools.id, id));

    await logAudit(user.id, "execute_tool", "/tools", id, true, req);

    res.json({
      message: `Tool ${tool.name} execution initiated`,
      tool: tool,
      executionId: `exec-${Date.now()}`,
    });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "execute_tool", "/tools", id, false, req);
    res.status(500).json({ error: "Failed to execute tool", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/tools/:id/execute-docker - Execute tool in Docker container
router.post("/:id/execute-docker", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const { command, params, agentId, targetId } = req.body;
  const user = req.user as any;

  try {
    // Get tool details
    const result = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Tool not found" });
    }

    const tool = result[0];

    // Check if tool is Docker-based
    if (tool.dockerImage !== "rtpi-tools") {
      return res.status(400).json({ 
        error: "Tool is not configured for Docker execution" 
      });
    }

    // Update tool status
    await db
      .update(securityTools)
      .set({
        status: "running",
        lastUsed: new Date(),
      })
      .where(eq(securityTools.id, id));

    // Execute via agent-tool connector if agentId and targetId provided
    let executionResult;
    if (agentId && targetId) {
      const inputParams = JSON.stringify(params || {});
      executionResult = await agentToolConnector.execute(
        agentId,
        id,
        targetId,
        inputParams
      );
    } else {
      // Direct execution with provided command
      const cmd = command || [tool.command];
      executionResult = await dockerExecutor.exec("rtpi-tools", cmd, {
        timeout: 300000, // 5 minutes
      });
    }

    // Update tool status back to available
    await db
      .update(securityTools)
      .set({
        status: "available",
        usageCount: tool.usageCount + 1,
      })
      .where(eq(securityTools.id, id));

    await logAudit(user.id, "execute_tool_docker", "/tools", id, true, req);

    res.json({
      success: true,
      tool: tool.name,
      result: executionResult,
    });
  } catch (error: any) {
    // Error logged for debugging
    
    // Reset tool status on error
    await db
      .update(securityTools)
      .set({ status: "available" })
      .where(eq(securityTools.id, id));
    
    await logAudit(user.id, "execute_tool_docker", "/tools", id, false, req);
    res.status(500).json({ 
      error: "Failed to execute tool",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/v1/tools/categories - Get tools by category
router.get("/categories", async (_req, res) => {
  try {
    const tools = await db.select().from(securityTools);
    
    // Group by category
    const byCategory: Record<string, any[]> = {};
    for (const tool of tools) {
      if (!byCategory[tool.category]) {
        byCategory[tool.category] = [];
      }
      byCategory[tool.category].push(tool);
    }

    res.json({ categories: byCategory });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get tool categories", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/tools/:id/status - Get tool execution status
router.get("/:id/status", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Tool not found" });
    }

    const tool = result[0];

    // If tool is Docker-based, check container status
    let containerStatus = null;
    if (tool.dockerImage === "rtpi-tools") {
      try {
        containerStatus = await dockerExecutor.getContainerStatus("rtpi-tools");
      } catch (error: any) {
        // Error logged for debugging
      }
    }

    res.json({
      tool: {
        id: tool.id,
        name: tool.name,
        status: tool.status,
        lastUsed: tool.lastUsed,
        usageCount: tool.usageCount,
      },
      container: containerStatus,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get tool status", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/tools/:id/launch - Launch tool (for web-based tools)
router.post("/:id/launch", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Tool not found" });
    }

    const tool = result[0];

    // Update usage stats
    await db
      .update(securityTools)
      .set({
        lastUsed: new Date(),
        usageCount: tool.usageCount + 1,
      })
      .where(eq(securityTools.id, id));

    await logAudit(user.id, "launch_tool", "/tools", id, true, req);

    res.json({
      message: `Tool ${tool.name} launched`,
      url: tool.endpoint,
      tool: tool,
    });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "launch_tool", "/tools", id, false, req);
    res.status(500).json({ error: "Failed to launch tool", details: error?.message || "Internal server error" });
  }
});

// DELETE /api/v1/tools/:id - Delete tool
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .delete(securityTools)
      .where(eq(securityTools.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Tool not found" });
    }

    await logAudit(user.id, "delete_tool", "/tools", id, true, req);

    res.json({
      message: "Tool deleted successfully",
      tool: result[0],
    });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "delete_tool", "/tools", id, false, req);
    res.status(500).json({ error: "Failed to delete tool", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// NEW TOOL FRAMEWORK ENDPOINTS (Tool Registry)
// ============================================================================

/**
 * GET /api/v1/tools/registry - List all tools from new framework
 */
router.get("/registry", async (req, res) => {
  try {
    const {
      category,
      installStatus,
      validationStatus,
      search,
      tags,
      installed,
      validated,
    } = req.query;

    let tools;

    if (installed === 'true') {
      tools = await getInstalledTools();
    } else if (validated === 'true') {
      tools = await getValidatedTools();
    } else if (search) {
      tools = await searchTools(search as string);
    } else {
      tools = await listNewTools({
        category: category as string,
        installStatus: installStatus as string,
        validationStatus: validationStatus as string,
        search: search as string,
        tags: tags ? (tags as string).split(',') : undefined,
      });
    }

    res.json({
      tools,
      count: tools.length,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/tools/registry/:id - Get tool from new framework
 */
router.get("/registry/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const tool = await getNewToolById(id);

    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    const statistics = await getToolStatistics(id);
    const testCoverage = await getTestCoverage(id);

    res.json({
      tool,
      statistics,
      testCoverage,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/tools/registry - Register new tool
 */
router.post("/registry", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const config: ToolConfiguration = req.body;

    const validation = await validateConfig(config);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid tool configuration',
        errors: validation.errors,
      });
    }

    const toolId = await registerTool(config, user.id);
    const tool = await getNewToolById(toolId);

    await logAudit(user.id, "register_tool", "/tools/registry", toolId, true, req);

    res.status(201).json({
      message: 'Tool registered successfully',
      tool,
    });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "register_tool", "/tools/registry", null, false, req);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/tools/registry/:id/execute - Execute tool from new framework
 */
router.post("/registry/:id/execute", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const { id } = req.params;
    const { parameters, targetId, operationId, agentId, timeout } = req.body;

    const tool = await getNewToolById(id);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    const result = await executeNewTool({
      toolId: tool.toolId,
      parameters,
      userId: user.id,
      targetId,
      operationId,
      agentId,
      timeout,
    });

    await logAudit(user.id, "execute_tool", "/tools/registry", id, true, req);

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "execute_tool", "/tools/registry", req.params.id, false, req);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/tools/registry/:id/test - Run tests for a tool
 */
router.post("/registry/:id/test", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const { id } = req.params;
    const results = await runAllTests(id, user.id);

    const allPassed = results.every(r => r.passed);

    res.json({
      success: allPassed,
      results,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/tools/registry/:id/health - Health check for a tool
 */
router.get("/registry/:id/health", async (req, res) => {
  try {
    const { id } = req.params;
    const healthy = await quickHealthCheck(id);

    res.json({
      healthy,
      status: healthy ? 'operational' : 'unavailable',
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/tools/install-from-github - Install tool from GitHub
 */
router.post("/install-from-github", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const { githubUrl, toolConfig } = req.body;

    if (!githubUrl) {
      return res.status(400).json({ error: 'GitHub URL is required' });
    }

    const installationId = await installToolFromGitHub(githubUrl, toolConfig?.toolId);

    await logAudit(user.id, "install_github_tool", "/tools", null, true, req);

    res.json({
      message: 'Tool installation started',
      installationId,
      status: 'pending',
    });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "install_github_tool", "/tools", null, false, req);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/tools/analyze-github - Analyze GitHub repository
 */
router.post("/analyze-github", ensureRole("admin"), async (req, res) => {
  try {
    const { githubUrl } = req.body;

    if (!githubUrl) {
      return res.status(400).json({ error: 'GitHub URL is required' });
    }

    const analysis = await analyzeGitHubRepository(githubUrl);

    res.json({
      message: 'Repository analyzed successfully',
      analysis,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/tools/executions/:executionId - Get execution result
 */
router.get("/executions/:executionId", async (req, res) => {
  try {
    const { executionId } = req.params;
    const execution = await getExecutionResult(executionId);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json({ execution });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/tools/refresh - Refresh tools registry from Dockerfile.tools and /opt/tools/
 * Discovers tools in the rtpi-tools container and syncs them to the database
 */
router.post("/refresh", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    console.log("Starting tools registry refresh...");

    // Discover tools from container
    const discoveredTools = await discoverTools();
    const summary = getDiscoverySummary(discoveredTools);

    let added = 0;
    let updated = 0;

    // Sync discovered tools to database
    for (const tool of discoveredTools) {
      // Check if tool already exists in database
      const existing = await db
        .select()
        .from(securityTools)
        .where(eq(securityTools.name, tool.name))
        .limit(1);

      if (existing.length === 0) {
        // Insert new tool
        await db.insert(securityTools).values({
          name: tool.name,
          category: tool.category,
          description: tool.description,
          command: tool.command,
          dockerImage: tool.dockerImage,
          status: tool.isInstalled ? "available" : "unavailable",
          version: tool.version || undefined,
          configPath: tool.installPath,
          metadata: {
            ...tool.metadata,
            installMethod: tool.installMethod,
            githubUrl: tool.githubUrl,
            installPath: tool.installPath,
            discoveredAt: new Date().toISOString(),
          },
        });
        added++;
        console.log(`  Added: ${tool.name}`);
      } else {
        // Update existing tool
        await db
          .update(securityTools)
          .set({
            status: tool.isInstalled ? "available" : "unavailable",
            version: tool.version || existing[0].version,
            configPath: tool.installPath || existing[0].configPath,
            metadata: {
              ...(existing[0].metadata as Record<string, any> || {}),
              ...tool.metadata,
              installMethod: tool.installMethod,
              githubUrl: tool.githubUrl,
              installPath: tool.installPath,
              lastRefreshed: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(securityTools.id, existing[0].id));
        updated++;
        console.log(`  Updated: ${tool.name}`);
      }
    }

    await logAudit(user.id, "refresh_tools_registry", "/tools/refresh", null, true, req);

    res.json({
      success: true,
      message: `Tools registry refreshed successfully`,
      added,
      updated,
      total: discoveredTools.length,
      summary,
      tools: discoveredTools,
    });
  } catch (error: any) {
    console.error("Tools refresh failed:", error);
    await logAudit(user.id, "refresh_tools_registry", "/tools/refresh", null, false, req);
    res.status(500).json({
      error: "Failed to refresh tools registry",
      details: error.message,
    });
  }
});

export default router;
