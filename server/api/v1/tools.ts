import { Router } from "express";
import { db } from "../../db";
import { securityTools, toolUploads, toolRegistry, targets, operations, empireCredentials } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
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
  getToolTactics,
  setToolTactics,
  getToolTechniques,
  setToolTechniques,
  getTechniquesByTactic,
  getAllToolTacticMappings,
  getAllToolTechniqueMappings,
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
import { multiContainerExecutor } from "../../services/agents/multi-container-executor";
import { OllamaAIClient } from "../../services/ollama-ai-client";
import { TOOL_HELP_CONFIG, DEFAULT_HELP_CONFIG } from "../../services/tool-tester";
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

// GET /api/v1/tools - List all tools (reads from toolRegistry for consistency with /tool-registry page)
router.get("/", async (_req, res) => {
  try {
    const allRegistryTools = await db.select().from(toolRegistry);

    // Filter out invalid tools, map to legacy Tool shape
    const tools = allRegistryTools
      .filter(tool => !tool.name.toLowerCase().includes('invalid'))
      .map(rt => ({
        id: rt.id,
        name: rt.name,
        category: rt.category,
        description: rt.description,
        status: rt.installStatus === 'installed' ? 'available' : 'stopped',
        command: rt.toolId,
        dockerImage: rt.containerName || 'rtpi-tools',
        endpoint: null,
        configPath: rt.binaryPath,
        version: rt.version,
        lastUsed: rt.lastUsed || null,
        usageCount: rt.usageCount || 0,
        metadata: {
          installStatus: rt.installStatus,
          validationStatus: rt.validationStatus,
          containerName: rt.containerName,
          binaryPath: rt.binaryPath,
        },
        createdAt: rt.createdAt,
        updatedAt: rt.updatedAt,
      }));

    res.json({ tools });
  } catch (error: any) {
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
    // Try toolRegistry first (primary source)
    const regResult = await db.select().from(toolRegistry).where(eq(toolRegistry.id, id)).limit(1);
    if (regResult.length > 0) {
      const rt = regResult[0];
      return res.json({
        tool: {
          id: rt.id,
          name: rt.name,
          category: rt.category,
          description: rt.description,
          status: rt.installStatus === 'installed' ? 'available' : 'stopped',
          command: rt.toolId,
          dockerImage: rt.containerName || 'rtpi-tools',
          endpoint: null,
          configPath: rt.binaryPath,
          version: rt.version,
          lastUsed: rt.lastUsed || null,
          usageCount: rt.usageCount || 0,
          metadata: {
            installStatus: rt.installStatus,
            validationStatus: rt.validationStatus,
            containerName: rt.containerName,
            binaryPath: rt.binaryPath,
          },
          createdAt: rt.createdAt,
          updatedAt: rt.updatedAt,
        },
      });
    }

    // Fallback to securityTools (backward compatibility)
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
      // Fallback: check toolRegistry table (Tool Registry page uses registry IDs)
      const registryResult = await db
        .select()
        .from(toolRegistry)
        .where(eq(toolRegistry.id, id))
        .limit(1);

      if (!registryResult || registryResult.length === 0) {
        return res.status(404).json({ error: "Tool not found" });
      }

      const regTool = registryResult[0];
      const config = regTool.config as any;
      const containerName = regTool.containerName || "rtpi-tools";

      let cmdArgs: string[];
      if (command) {
        cmdArgs = Array.isArray(command) ? command : [command];
      } else {
        // Prefer binaryPath (full absolute path) over baseCommand (short name)
        // since tool binaries may not be in the container's PATH
        const baseCmd = regTool.binaryPath || config?.baseCommand || regTool.toolId;
        // Split on spaces to handle interpreter prefixes (e.g., 'perl /path/to/nikto.pl')
        if (baseCmd.includes(' ')) {
          cmdArgs = baseCmd.split(/\s+/);
        } else if (baseCmd.endsWith('.pl')) {
          // Perl scripts need the interpreter prefix
          cmdArgs = ['perl', baseCmd];
        } else {
          cmdArgs = [baseCmd];
        }

        // Append user-provided params as flags
        if (params && typeof params === "object") {
          for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== "") {
              cmdArgs.push(`--${key}`, String(value));
            }
          }
        }

        // Resolve target and append with correct flag for this tool
        if (targetId) {
          const [targetRow] = await db.select().from(targets).where(eq(targets.id, targetId)).limit(1);
          if (targetRow) {
            const toolLower = (regTool.toolId || '').toLowerCase();
            if (toolLower === 'nikto') {
              cmdArgs.push('-h', targetRow.value);
            } else if (['ffuf', 'feroxbuster', 'gobuster', 'dirsearch', 'wpscan', 'nuclei', 'httpx', 'katana', 'x8'].includes(toolLower)) {
              cmdArgs.push('-u', targetRow.value);
            } else if (['subfinder', 'amass', 'dnsx', 'bbot'].includes(toolLower)) {
              cmdArgs.push('-d', targetRow.value);
            } else {
              cmdArgs.push(targetRow.value);
            }
          }
        }
      }

      let executionResult;
      if (agentId && targetId) {
        executionResult = await agentToolConnector.execute(
          agentId, regTool.id, targetId, JSON.stringify(params || {})
        );
      } else {
        executionResult = await dockerExecutor.exec(containerName, cmdArgs, {
          timeout: 300000,
          user: regTool.containerUser || "root",
        });
      }

      // Detect command-not-found or OCI runtime failures
      const isExecFailure = executionResult.exitCode === 127 ||
        executionResult.exitCode === 126 ||
        /OCI runtime|exec failed|not found in .PATH/i.test(executionResult.stdout || '') ||
        /OCI runtime|exec failed|not found in .PATH/i.test(executionResult.stderr || '');

      if (isExecFailure) {
        await logAudit(user.id, "execute_tool_docker", "/tools", id, false, req);
        return res.status(400).json({
          error: `Tool '${regTool.name}' binary not found in container '${containerName}'`,
          result: executionResult,
        });
      }

      await logAudit(user.id, "execute_tool_docker", "/tools", id, true, req);

      // Update toolRegistry usage stats
      try {
        await db.update(toolRegistry)
          .set({
            usageCount: sql`${toolRegistry.usageCount} + 1`,
            lastUsed: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(toolRegistry.id, regTool.id));
      } catch (e) { console.warn('[tools] Failed to update tool stats:', e); }

      return res.json({
        success: true,
        tool: regTool.name,
        result: executionResult,
      });
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
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: errorMsg || "Failed to execute tool",
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
 * POST /api/v1/tools/registry/cleanup - Clean error strings and fix known bad paths
 */
router.post("/registry/cleanup", ensureRole("admin"), async (req, res) => {
  try {
    const isErrorString = (s?: string | null) =>
      !!s && /OCI runtime|exec failed|not found|No such file|Permission denied|unable to start|executable file/i.test(s);

    // Known correct binary paths for tools with wrong DB entries
    const KNOWN_PATHS: Record<string, string> = {
      'freeze':              '/opt/tools/Freeze/freeze',
      'scarecrow':           '/opt/tools/ScareCrow/scarecrow',
      'nikto':               '/opt/tools/nikto/program/nikto.pl',
      'testssl.sh':          '/opt/tools/bin/testssl.sh',
      'joomscan':            '/opt/tools/bin/joomscan',
      'wafw00f':             '/usr/local/bin/wafw00f',
      'nxc':                 '/usr/local/bin/nxc',
      'impacket-psexec':     '/usr/local/bin/impacket-psexec',
      'impacket-secretsdump':'/usr/local/bin/impacket-secretsdump',
      'impacket-smbexec':    '/usr/local/bin/impacket-smbexec',
      'impacket-wmiexec':    '/usr/local/bin/impacket-wmiexec',
      'subfinder':           '/opt/tools/bin/subfinder',
      'amass':               '/opt/tools/bin/amass',
      'dnsx':                '/opt/tools/bin/dnsx',
      'katana':              '/opt/tools/bin/katana',
      'httpx':               '/opt/tools/bin/httpx',
      'dalfox':              '/opt/tools/bin/dalfox',
    };

    // Tools that need an interpreter prefix (baseCommand override)
    const BASE_COMMAND_OVERRIDES: Record<string, string> = {
      'nikto':    'perl /opt/tools/nikto/program/nikto.pl',
      'joomscan': 'perl /opt/tools/joomscan/joomscan.pl',
    };

    const allTools = await db.select().from(toolRegistry);
    let cleaned = 0;
    const details: string[] = [];

    for (const rt of allTools) {
      const updates: Record<string, any> = {};
      const toolId = (rt as any).toolId || '';

      // Clean error strings from description/version
      if (isErrorString(rt.description)) {
        updates.description = null;
        details.push(`${toolId}: cleared error description`);
      }
      if (isErrorString(rt.version)) {
        updates.version = null;
        details.push(`${toolId}: cleared error version`);
      }

      // Fix OCI error strings stored as binaryPath
      if (isErrorString(rt.binaryPath)) {
        // Check if we know the correct path for this tool
        const knownPath = KNOWN_PATHS[toolId];
        if (knownPath) {
          updates.binaryPath = knownPath;
          details.push(`${toolId}: fixed binaryPath → ${knownPath}`);
        } else {
          // Reset to default path — tool needs re-discovery
          updates.binaryPath = `/usr/bin/${toolId}`;
          updates.validationStatus = 'discovered';
          details.push(`${toolId}: reset OCI error binaryPath → /usr/bin/${toolId}`);
        }
      }

      // Fix known wrong paths (binary exists at different location)
      if (KNOWN_PATHS[toolId] && rt.binaryPath !== KNOWN_PATHS[toolId] && !isErrorString(rt.binaryPath)) {
        updates.binaryPath = KNOWN_PATHS[toolId];
        details.push(`${toolId}: corrected binaryPath → ${KNOWN_PATHS[toolId]}`);
      }

      // Set baseCommand override for tools that need an interpreter prefix
      if (BASE_COMMAND_OVERRIDES[toolId]) {
        const existingConfig = (rt.config as any) || {};
        if (existingConfig.baseCommand !== BASE_COMMAND_OVERRIDES[toolId]) {
          updates.config = { ...existingConfig, baseCommand: BASE_COMMAND_OVERRIDES[toolId] };
          details.push(`${toolId}: set baseCommand → ${BASE_COMMAND_OVERRIDES[toolId]}`);
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await db.update(toolRegistry).set(updates).where(eq(toolRegistry.id, rt.id));
        cleaned++;
      }
    }

    res.json({
      success: true,
      message: `Cleaned ${cleaned} of ${allTools.length} registry entries`,
      cleaned,
      total: allTools.length,
      details,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
        includeValidated: true,
      });
    }

    // Sanitize error strings from description/version before returning
    const isErrStr = (s?: string | null) =>
      !!s && /OCI runtime|exec failed|not found|No such file|Permission denied|unable to start|executable file/i.test(s);

    const sanitizedTools = tools.map((t: any) => ({
      ...t,
      description: isErrStr(t.description) ? null : t.description,
      version: isErrStr(t.version) ? null : t.version,
    }));

    // Batch-fetch all tactic + technique mappings and enrich each tool
    const allTacticMappings = await getAllToolTacticMappings();
    const tacticsByToolId = new Map<string, any[]>();
    for (const mapping of allTacticMappings) {
      if (!tacticsByToolId.has(mapping.toolId)) {
        tacticsByToolId.set(mapping.toolId, []);
      }
      tacticsByToolId.get(mapping.toolId)!.push({
        tacticId: mapping.tacticId,
        attackId: mapping.attackId,
        name: mapping.name,
        shortName: mapping.shortName,
      });
    }

    const allTechniqueMappings = await getAllToolTechniqueMappings();
    const techniquesByToolId = new Map<string, any[]>();
    for (const mapping of allTechniqueMappings) {
      if (!techniquesByToolId.has(mapping.toolId)) {
        techniquesByToolId.set(mapping.toolId, []);
      }
      techniquesByToolId.get(mapping.toolId)!.push({
        techniqueId: mapping.techniqueId,
        attackId: mapping.attackId,
        name: mapping.name,
        isSubtechnique: mapping.isSubtechnique,
      });
    }

    const enrichedTools = sanitizedTools.map((t: any) => ({
      ...t,
      tactics: tacticsByToolId.get(t.id) || [],
      techniques: techniquesByToolId.get(t.id) || [],
    }));

    res.json({
      tools: enrichedTools,
      count: enrichedTools.length,
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
 * GET /api/v1/tools/registry/:id/tactics - Get tactic + techniques for a tool
 */
router.get("/registry/:id/tactics", async (req, res) => {
  try {
    const tactics = await getToolTactics(req.params.id);
    const techniques = await getToolTechniques(req.params.id);
    res.json({ tactics, techniques });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/tools/registry/:id/tactics - Set single tactic + techniques (1-3) for a tool
 * Body: { tacticId: string, techniqueIds: string[] }
 * Legacy support: { tacticIds: string[] } still accepted (takes first)
 */
router.put("/registry/:id/tactics", ensureAuthenticated, async (req, res) => {
  try {
    const { tacticId, tacticIds, techniqueIds } = req.body;

    // Resolve single tactic — new format or legacy array
    const resolvedTacticId = tacticId || (Array.isArray(tacticIds) ? tacticIds[0] : undefined);
    if (!resolvedTacticId) {
      return res.status(400).json({ error: "tacticId is required" });
    }
    await setToolTactics(req.params.id, [resolvedTacticId]);

    // Set techniques if provided (1-3)
    if (Array.isArray(techniqueIds)) {
      if (techniqueIds.length > 3) {
        return res.status(400).json({ error: "Maximum 3 techniques per tool" });
      }
      await setToolTechniques(req.params.id, techniqueIds);
    }

    const tactics = await getToolTactics(req.params.id);
    const techniques = await getToolTechniques(req.params.id);
    res.json({ tactics, techniques });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/tools/techniques-by-tactic/:tacticId - Get techniques for a tactic
 */
router.get("/techniques-by-tactic/:tacticId", async (req, res) => {
  try {
    const techniques = await getTechniquesByTactic(req.params.tacticId);
    res.json({ techniques });
  } catch (error: any) {
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
 * POST /api/v1/tools/registry/:id/generate-command - AI-assisted command generation
 */
router.post("/registry/:id/generate-command", ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { targetId, additionalContext } = req.body;

    if (!targetId) {
      return res.status(400).json({ error: "targetId is required" });
    }

    // Get tool from registry
    const tool = await getNewToolById(id);
    if (!tool) {
      return res.status(404).json({ error: "Tool not found" });
    }

    // Get target
    const [target] = await db.select().from(targets).where(eq(targets.id, targetId)).limit(1);
    if (!target) {
      return res.status(404).json({ error: "Target not found" });
    }

    // Build tool reference from TOOL_HELP_CONFIG + config
    const config = (tool as any).config as any;
    const toolShortId = (tool as any).toolId || '';
    const helpConfig = TOOL_HELP_CONFIG[toolShortId] || DEFAULT_HELP_CONFIG;
    const requiredParams = config?.parameters?.filter((p: any) => p.required)?.map((p: any) => `--${p.name}`).join(', ') || 'target';

    const toolReference = `Binary: ${tool.binaryPath}
Help: ${tool.binaryPath} ${helpConfig.helpFlag}
Required params: ${requiredParams}
Base command: ${config?.baseCommand || tool.binaryPath}
Category: ${(tool as any).category || 'unknown'}`;

    // Fetch operation credentials if target has an associated operation
    let credentialsContext = '';
    let testCredentials: Array<{ account: string; password: string }> = [];
    let harvestedCredentials: Array<{ username: string; password?: string; ntlmHash?: string; domain?: string; credType: string; host?: string }> = [];

    if (target.operationId) {
      const [operation] = await db.select().from(operations).where(eq(operations.id, target.operationId)).limit(1);

      // 1. Extract test credentials from operation metadata
      if (operation?.metadata) {
        const appOverview = (operation.metadata as any)?.applicationOverview;
        const rawCreds = appOverview?.testCredentials;

        if (rawCreds) {
          try {
            testCredentials = typeof rawCreds === 'string' ? JSON.parse(rawCreds) : rawCreds;
          } catch {
            testCredentials = [];
          }
        }
      }

      // 2. Fetch harvested credentials from Empire C2 tied to this operation
      try {
        const harvested = await db.select().from(empireCredentials)
          .where(eq(empireCredentials.operationId, target.operationId))
          .limit(20);
        harvestedCredentials = harvested.map((c) => ({
          username: c.username,
          password: c.password || undefined,
          ntlmHash: c.ntlmHash || undefined,
          domain: c.domain || undefined,
          credType: c.credType,
          host: c.host || undefined,
        }));
      } catch {
        // Empire credentials table may not exist yet
      }

      const allCredsCount = testCredentials.length + harvestedCredentials.length;
      if (allCredsCount > 0) {
        // Check if tool needs credentials based on assigned tactics
        const toolTacticMappings = await getToolTactics(id);
        const credentialRelevantTactics = [
          'initial-access', 'credential-access', 'lateral-movement',
          'privilege-escalation', 'collection', 'execution',
          'persistence', 'defense-evasion',
        ];
        const tacticMatch = toolTacticMappings.some(
          (t: any) => credentialRelevantTactics.includes(t.shortName?.toLowerCase())
        );

        // Fallback: check tool category
        const toolCategory = ((tool as any).category || '').toLowerCase();
        const credentialRelevantCategories = [
          'active-directory', 'enumeration', 'exploitation',
          'post-exploitation', 'c2', 'web-application', 'web',
          'cms', 'password-cracking', 'vulnerability', 'scanning',
          'authentication', 'brute-force',
        ];
        const categoryMatch = credentialRelevantCategories.includes(toolCategory);

        // Also check tool name for credential-related tools
        const toolLower = (toolShortId || tool.name || '').toLowerCase();
        const credToolPatterns = [
          'hydra', 'nxc', 'netexec', 'crackmapexec', 'medusa', 'patator',
          'wpscan', 'evil-winrm', 'psexec', 'smbclient', 'rpcclient',
          'bloodhound', 'impacket', 'kerbrute', 'nikto', 'sqlmap',
          'gobuster', 'ffuf', 'dirsearch', 'feroxbuster', 'nuclei',
        ];
        const toolNameMatch = credToolPatterns.some((p) => toolLower.includes(p));

        if (tacticMatch || categoryMatch || toolNameMatch) {
          const sections: string[] = [];

          if (testCredentials.length > 0) {
            const credLines = testCredentials.map(
              (c, i) => `  ${i + 1}. ${c.account} / ${c.password}`
            );
            sections.push(`Test Credentials (provided for this engagement):\n${credLines.join('\n')}`);
          }

          if (harvestedCredentials.length > 0) {
            const harvLines = harvestedCredentials.map((c, i) => {
              const parts = [`  ${i + 1}. ${c.domain ? c.domain + '\\\\' : ''}${c.username}`];
              if (c.password) parts.push(`password: ${c.password}`);
              if (c.ntlmHash) parts.push(`NTLM: ${c.ntlmHash}`);
              if (c.host) parts.push(`from: ${c.host}`);
              parts.push(`(${c.credType})`);
              return parts.join(' | ');
            });
            sections.push(`Harvested Credentials (discovered during operation):\n${harvLines.join('\n')}`);
          }

          credentialsContext = sections.join('\n\n') +
            '\n\nCredential usage rules:' +
            '\n- Use the first test credential pair for the tool\'s native auth flags (e.g., -u/-p, -l/-P, --username/--password).' +
            '\n- If the tool supports pass-the-hash (e.g., nxc, evil-winrm, impacket), prefer NTLM hashes from harvested credentials when available.' +
            '\n- If a domain is present, include it using the tool\'s domain flag (e.g., -d for nxc/bloodhound).' +
            '\n- Only include credentials if the tool actually supports authentication parameters.' +
            '\n- If the tool supports multiple credential pairs (e.g., hydra -L/-P), use the first pair inline.';
        }
      }
    }

    // Call AI to generate command (two-step: applyTemplate → complete)
    const aiClient = new OllamaAIClient();
    const fullAdditionalContext = [additionalContext || '', credentialsContext].filter(Boolean).join('\n');

    try {
      const messages = aiClient.applyTemplate('generate_tool_command', {
        toolName: tool.name,
        binaryPath: tool.binaryPath,
        targetValue: target.value,
        targetType: target.type,
        toolReference,
        additionalContext: fullAdditionalContext,
      });

      const response = await aiClient.complete(messages, {
        temperature: 0.3,
        maxTokens: 512,
        useCache: true,
      });

      if (!response.success) {
        throw new Error(response.error || 'AI generation failed');
      }

      // Clean up the command - strip markdown backticks if present
      let command = response.content.trim();
      command = command.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

      return res.json({
        command,
        provider: response.provider,
        model: response.model,
        credentialsUsed: credentialsContext.length > 0,
        credentialSources: {
          test: testCredentials.length,
          harvested: harvestedCredentials.length,
        },
      });
    } catch (aiError: any) {
      // Fallback: build a reasonable command from tool config + target
      console.error('[generate-command] AI failed, using template fallback:', aiError.message);

      const baseCmd = config?.baseCommand || tool.binaryPath;
      let command = baseCmd;

      // Append target based on common tool patterns
      const toolLower = toolShortId.toLowerCase();
      if (['nmap', 'masscan', 'nbtscan', 'enum4linux', 'testssl.sh'].includes(toolLower)) {
        command += ` ${target.value}`;
      } else if (['ffuf', 'feroxbuster', 'gobuster', 'dirsearch', 'nikto', 'wpscan', 'nuclei', 'httpx', 'katana', 'x8'].includes(toolLower)) {
        command += ` -u ${target.value}`;
      } else if (['subfinder', 'amass', 'dnsx', 'bbot'].includes(toolLower)) {
        command += ` -d ${target.value}`;
      } else {
        command += ` ${target.value}`;
      }

      // Append credentials for known tools in fallback mode
      if (credentialsContext) {
        // Prefer test creds; fall back to harvested creds
        const user = testCredentials[0]?.account || harvestedCredentials[0]?.username;
        const pass = testCredentials[0]?.password || harvestedCredentials[0]?.password;
        const ntlm = harvestedCredentials[0]?.ntlmHash;
        const domain = harvestedCredentials[0]?.domain;

        if (user && (pass || ntlm)) {
          if (['hydra', 'medusa'].includes(toolLower)) {
            command += ` -l ${user} -p ${pass || ntlm}`;
          } else if (['nxc', 'netexec', 'crackmapexec'].includes(toolLower)) {
            if (ntlm && !pass) {
              command += ` -u ${user} -H ${ntlm}`;
            } else {
              command += ` -u ${user} -p ${pass}`;
            }
            if (domain) command += ` -d ${domain}`;
          } else if (['evil-winrm'].includes(toolLower)) {
            if (ntlm && !pass) {
              command += ` -u ${user} -H ${ntlm}`;
            } else {
              command += ` -u ${user} -p ${pass}`;
            }
          } else if (['wpscan'].includes(toolLower)) {
            command += ` --username ${user} --password ${pass}`;
          } else if (['bloodhound-python', 'bloodhound'].includes(toolLower)) {
            command += ` -u ${user} -p ${pass || ntlm}`;
            if (domain) command += ` -d ${domain}`;
          } else if (['nikto'].includes(toolLower)) {
            command += ` -id ${user}:${pass}`;
          } else if (['sqlmap'].includes(toolLower)) {
            command += pass ? ` --auth-cred="${user}:${pass}"` : '';
          } else if (['rpcclient', 'smbclient'].includes(toolLower)) {
            command += ` -U ${user}%${pass || ''}`;
          } else if (['gobuster'].includes(toolLower)) {
            command += pass ? ` -U ${user} -P ${pass}` : '';
          } else if (['ffuf'].includes(toolLower)) {
            command += pass ? ` -H "Authorization: Basic $(echo -n '${user}:${pass}' | base64)"` : '';
          } else if (toolLower.includes('impacket') || ['psexec', 'wmiexec', 'smbexec', 'secretsdump', 'atexec'].includes(toolLower)) {
            // Impacket-style: domain/user:pass@target or domain/user@target -hashes :ntlm
            const prefix = domain ? `${domain}/` : '';
            if (ntlm && !pass) {
              command = command.replace(target.value, `${prefix}${user}@${target.value} -hashes :${ntlm}`);
            } else {
              command = command.replace(target.value, `${prefix}${user}:${pass}@${target.value}`);
            }
          }
        }
      }

      return res.json({
        command,
        provider: 'template-fallback',
        model: 'none',
        credentialsUsed: credentialsContext.length > 0,
        credentialSources: {
          test: testCredentials.length,
          harvested: harvestedCredentials.length,
        },
      });
    }
  } catch (error: any) {
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

    // Helper to reject error strings from version/description fields
    const isErrorString = (s?: string) =>
      !!s && /OCI runtime|exec failed|not found|No such file|Permission denied|unable to start/i.test(s);

    // Sync discovered tools to database
    for (const tool of discoveredTools) {
      const cleanVersion = isErrorString(tool.version) ? undefined : tool.version;
      const cleanDescription = isErrorString(tool.description) ? undefined : tool.description;

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
          description: cleanDescription || tool.description,
          command: tool.command,
          dockerImage: tool.dockerImage,
          status: tool.isInstalled ? "available" : "stopped",
          version: cleanVersion || undefined,
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
        // Update existing tool — preserve good description, sanitize version
        await db
          .update(securityTools)
          .set({
            status: tool.isInstalled ? "available" : "stopped",
            version: cleanVersion || existing[0].version || undefined,
            description: cleanDescription || existing[0].description || tool.description,
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

    // Sync discovered tools to toolRegistry (keeps Tools page and Tool Registry page in sync)
    const INSTALL_METHOD_MAP: Record<string, string> = {
      binary: 'manual',
      github: 'github-source',
      installer: 'manual',
      apt: 'apt',
      pip: 'pip',
    };
    for (const tool of discoveredTools) {
      const cleanVer = isErrorString(tool.version) ? undefined : tool.version;
      const cleanDesc = isErrorString(tool.description) ? undefined : tool.description;

      const existingReg = await db
        .select()
        .from(toolRegistry)
        .where(eq(toolRegistry.toolId, tool.toolId))
        .limit(1);

      if (existingReg.length === 0) {
        await db.insert(toolRegistry).values({
          toolId: tool.toolId,
          name: tool.name,
          category: tool.category as any,
          description: cleanDesc || tool.description,
          installMethod: (INSTALL_METHOD_MAP[tool.installMethod] || 'manual') as any,
          binaryPath: tool.installPath || `/usr/bin/${tool.command}`,
          dockerImage: tool.dockerImage,
          containerName: tool.dockerImage || 'rtpi-tools',
          installStatus: tool.isInstalled ? 'installed' : 'pending',
          validationStatus: 'discovered',
          version: cleanVer,
        });
      } else {
        await db
          .update(toolRegistry)
          .set({
            version: cleanVer || existingReg[0].version,
            description: cleanDesc || existingReg[0].description,
            installStatus: tool.isInstalled ? 'installed' : existingReg[0].installStatus,
            updatedAt: new Date(),
          })
          .where(eq(toolRegistry.id, existingReg[0].id));
      }
    }

    // Also clean up toolRegistry entries with error strings in description/version
    const allRegistryTools = await db.select().from(toolRegistry);
    let cleaned = 0;
    for (const rt of allRegistryTools) {
      const updates: Record<string, any> = {};
      if (isErrorString(rt.description)) updates.description = null;
      if (isErrorString(rt.version as string)) updates.version = null;
      if (Object.keys(updates).length > 0) {
        await db.update(toolRegistry).set(updates).where(eq(toolRegistry.id, rt.id));
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`  Cleaned ${cleaned} toolRegistry entries with error strings`);
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

// ============================================================================
// MULTI-CONTAINER TOOL EXECUTION ENDPOINTS
// ============================================================================

/**
 * POST /api/v1/tools/execute - Execute any registered tool by name
 * Automatically routes to the correct container based on tool registry
 */
router.post("/execute", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;
  const { tool, args = [], timeout, containerOverride } = req.body;

  if (!tool) {
    return res.status(400).json({ error: "Tool name is required" });
  }

  try {
    const result = await multiContainerExecutor.executeTool(tool, args, {
      timeout,
      containerOverride,
    });

    await logAudit(user.id, "execute_tool_multi", "/tools/execute", tool, true, req);

    res.json({
      success: result.exitCode === 0,
      tool,
      result: {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        duration: result.duration,
      },
    });
  } catch (error: any) {
    await logAudit(user.id, "execute_tool_multi", "/tools/execute", tool, false, req);
    res.status(500).json({
      error: "Failed to execute tool",
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/tools/containers/status - Get status of all tool containers
 */
router.get("/containers/status", async (_req, res) => {
  try {
    const statuses = await multiContainerExecutor.getContainerStatuses();

    const containerList = Array.from(statuses.entries()).map(([name, running]) => ({
      name,
      running,
      status: running ? "running" : "stopped",
    }));

    res.json({
      containers: containerList,
      totalRunning: containerList.filter(c => c.running).length,
      totalContainers: containerList.length,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to get container statuses",
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/tools/by-container - Get tools grouped by container
 */
router.get("/by-container", async (_req, res) => {
  try {
    const toolsByContainer = await multiContainerExecutor.listToolsByContainer();

    const result: Record<string, any[]> = {};
    const entries = Array.from(toolsByContainer.entries());
    for (const [container, tools] of entries) {
      result[container] = tools.map(t => ({
        toolId: t.toolId,
        name: t.name,
        category: t.category,
        version: t.version,
        binaryPath: t.binaryPath,
      }));
    }

    res.json({
      containers: result,
      totalTools: entries.reduce((sum, [_, tools]) => sum + tools.length, 0),
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to get tools by container",
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/tools/lookup/:toolName - Lookup tool info and container location
 */
router.get("/lookup/:toolName", async (req, res) => {
  const { toolName } = req.params;

  try {
    const toolInfo = await multiContainerExecutor.getToolInfo(toolName);

    if (!toolInfo) {
      return res.status(404).json({
        error: `Tool '${toolName}' not found in registry`,
        suggestion: "Run tool discovery to populate the registry",
      });
    }

    const containerAvailable = await multiContainerExecutor.isContainerAvailable(
      toolInfo.containerName
    );

    res.json({
      tool: toolInfo,
      containerAvailable,
      ready: containerAvailable,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to lookup tool",
      details: error.message,
    });
  }
});

export default router;
