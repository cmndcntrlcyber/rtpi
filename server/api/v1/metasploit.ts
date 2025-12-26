import { Router } from "express";
import { db } from "../../db";
import { securityTools, targets } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { metasploitExecutor, MetasploitModule } from "../../services/metasploit-executor";
import fs from "fs";
import path from "path";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

/**
 * Load Metasploit modules from JSON file
 */
function loadModules(): any {
  try {
    const modulesPath = path.join(process.cwd(), "server", "data", "metasploit-modules.json");
    
    if (!fs.existsSync(modulesPath)) {
      console.warn("Metasploit modules file not found. Run enumerate-metasploit-modules.py first.");
      return {
        metadata: { generated_at: null, total_modules: 0, by_type: {} },
        modules: {},
      };
    }

    const data = fs.readFileSync(modulesPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading Metasploit modules:", error);
    return {
      metadata: { generated_at: null, total_modules: 0, by_type: {} },
      modules: {},
    };
  }
}

// GET /api/v1/metasploit/modules - Get all module categories and metadata
router.get("/modules", async (_req, res) => {
  try {
    const modulesData = loadModules();
    res.json({
      metadata: modulesData.metadata,
      categories: Object.keys(modulesData.modules),
    });
  } catch (error) {
    console.error("Get modules error:", error);
    res.status(500).json({ error: "Failed to get modules" });
  }
});

// GET /api/v1/metasploit/modules/:type - Get all modules of a specific type
router.get("/modules/:type", async (req, res) => {
  const { type } = req.params;

  try {
    const modulesData = loadModules();
    const typeModules = modulesData.modules[type];

    if (!typeModules) {
      return res.status(404).json({ error: `Module type '${type}' not found` });
    }

    res.json({
      type,
      categories: typeModules,
      count: Object.values(typeModules).flat().length,
    });
  } catch (error) {
    console.error("Get modules by type error:", error);
    res.status(500).json({ error: "Failed to get modules" });
  }
});

// GET /api/v1/metasploit/modules/:type/:path - Get specific module info
router.get("/modules/:type/*", async (req, res) => {
  const { type } = req.params;
  const modulePath = (req.params as any)[0]; // Capture the rest of the path

  try {
    // Get module info from msfconsole
    const moduleInfo = await metasploitExecutor.getModuleInfo(type, modulePath);

    if (!moduleInfo) {
      return res.status(404).json({ error: "Module not found or info unavailable" });
    }

    res.json({
      type,
      path: modulePath,
      info: moduleInfo,
    });
  } catch (error) {
    console.error("Get module info error:", error);
    res.status(500).json({ error: "Failed to get module info" });
  }
});

// POST /api/v1/metasploit/execute - Execute a Metasploit module
router.post("/execute", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;
  const { toolId, targetId, module } = req.body;

  // Validate required fields
  if (!toolId || !targetId || !module) {
    return res.status(400).json({ 
      error: "Missing required fields: toolId, targetId, module" 
    });
  }

  if (!module.type || !module.path) {
    return res.status(400).json({ 
      error: "Module must have 'type' and 'path' properties" 
    });
  }

  try {
    // Get tool
    const tool = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.id, toolId))
      .limit(1);

    if (!tool || tool.length === 0) {
      return res.status(404).json({ error: "Tool not found" });
    }

    // Check if tool is locked
    if (metasploitExecutor.isLocked(toolId)) {
      return res.status(409).json({ 
        error: "Another execution is in progress. Please wait." 
      });
    }

    // Get target
    const target = await db
      .select()
      .from(targets)
      .where(eq(targets.id, targetId))
      .limit(1);

    if (!target || target.length === 0) {
      return res.status(404).json({ error: "Target not found" });
    }

    const targetValue = target[0].value;

    // Execute module
    const moduleConfig: MetasploitModule = {
      type: module.type,
      path: module.path,
      parameters: module.parameters || {},
    };

    console.log(`[Metasploit API] Executing ${module.type}/${module.path} on ${targetValue}`);

    const result = await metasploitExecutor.execute(toolId, moduleConfig, targetValue);

    // Log audit
    await logAudit(
      user.id,
      "metasploit_execute",
      "/metasploit",
      toolId,
      result.success,
      req
    );

    res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    console.error("Metasploit execute error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    await logAudit(user.id, "metasploit_execute", "/metasploit", toolId, false, req);
    
    res.status(500).json({ 
      error: "Failed to execute module",
      details: errorMsg,
    });
  }
});

// GET /api/v1/metasploit/execution/:toolId/status - Get execution status
router.get("/execution/:toolId/status", async (req, res) => {
  const { toolId } = req.params;

  try {
    const tool = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.id, toolId))
      .limit(1);

    if (!tool || tool.length === 0) {
      return res.status(404).json({ error: "Tool not found" });
    }

    const isLocked = metasploitExecutor.isLocked(toolId);
    const toolData = tool[0];
    const metadata = (toolData.metadata as any) || {};
    const lastExecution = metadata.metasploit?.lastExecution;

    res.json({
      toolId,
      toolName: toolData.name,
      status: toolData.status,
      isExecuting: isLocked,
      lastExecution: lastExecution || null,
    });
  } catch (error) {
    console.error("Get execution status error:", error);
    res.status(500).json({ error: "Failed to get execution status" });
  }
});

// POST /api/v1/metasploit/auto-select - Auto-select module based on target
router.post("/auto-select", async (req, res) => {
  const { targetId } = req.body;

  if (!targetId) {
    return res.status(400).json({ error: "targetId is required" });
  }

  try {
    // Get target
    const target = await db
      .select()
      .from(targets)
      .where(eq(targets.id, targetId))
      .limit(1);

    if (!target || target.length === 0) {
      return res.status(404).json({ error: "Target not found" });
    }

    // Load available modules
    const modulesData = loadModules();

    // Auto-select module
    const selectedModule = metasploitExecutor.selectModuleForTarget(
      target[0],
      modulesData.modules
    );

    if (!selectedModule) {
      return res.status(404).json({ 
        error: "No suitable module found for this target" 
      });
    }

    res.json({
      target: {
        id: target[0].id,
        name: target[0].name,
        value: target[0].value,
      },
      selectedModule,
      reasoning: "Auto-selected based on target reconnaissance data",
    });
  } catch (error) {
    console.error("Auto-select module error:", error);
    res.status(500).json({ error: "Failed to auto-select module" });
  }
});

// POST /api/v1/metasploit/tools/:toolId/module - Update tool's selected module
router.post("/tools/:toolId/module", ensureRole("admin", "operator"), async (req, res) => {
  const { toolId } = req.params;
  const { moduleType, modulePath } = req.body;

  if (!moduleType || !modulePath) {
    return res.status(400).json({ 
      error: "moduleType and modulePath are required" 
    });
  }

  try {
    // Get current tool
    const tool = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.id, toolId))
      .limit(1);

    if (!tool || tool.length === 0) {
      return res.status(404).json({ error: "Tool not found" });
    }

    // Update metadata with selected module
    const currentMetadata = (tool[0].metadata as any) || {};
    const updatedMetadata = {
      ...currentMetadata,
      metasploit: {
        ...currentMetadata.metasploit,
        selectedModule: {
          type: moduleType,
          path: modulePath,
          selectedAt: new Date().toISOString(),
        },
      },
    };

    await db
      .update(securityTools)
      .set({
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(securityTools.id, toolId));

    res.json({
      success: true,
      module: {
        type: moduleType,
        path: modulePath,
      },
    });
  } catch (error) {
    console.error("Update module selection error:", error);
    res.status(500).json({ error: "Failed to update module selection" });
  }
});

export default router;
