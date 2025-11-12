import { Router } from "express";
import { db } from "../../db";
import { securityTools, toolUploads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "tools");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for JAR files
  },
  fileFilter: (req, file, cb) => {
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
router.get("/", async (req, res) => {
  try {
    const tools = await db.select().from(securityTools);
    res.json({ tools });
  } catch (error) {
    console.error("List tools error:", error);
    res.status(500).json({ error: "Failed to list tools" });
  }
});

// GET /api/v1/tools/:id - Get tool details
router.get("/:id", async (req, res) => {
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

    res.json({ tool: result[0] });
  } catch (error) {
    console.error("Get tool error:", error);
    res.status(500).json({ error: "Failed to get tool" });
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
  } catch (error) {
    console.error("Add tool error:", error);
    await logAudit(user.id, "add_tool", "/tools", null, false, req);
    res.status(500).json({ error: "Failed to add tool" });
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
  } catch (error) {
    console.error("Update tool error:", error);
    await logAudit(user.id, "update_tool", "/tools", id, false, req);
    res.status(500).json({ error: "Failed to update tool" });
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

    await logAudit(user.id, "upload_tool_file", "/tools", id, true, req, {
      filename: req.file.originalname,
      size: req.file.size,
    });

    res.status(201).json({
      message: "File uploaded successfully",
      upload: uploadRecord[0],
    });
  } catch (error) {
    console.error("Upload tool file error:", error);
    // Clean up file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    await logAudit(user.id, "upload_tool_file", "/tools", id, false, req);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// POST /api/v1/tools/:id/execute - Execute tool
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

    await logAudit(user.id, "execute_tool", "/tools", id, true, req, {
      toolName: tool.name,
      params: req.body,
    });

    res.json({
      message: `Tool ${tool.name} execution initiated`,
      tool: tool,
      executionId: `exec-${Date.now()}`, // Placeholder for actual execution tracking
    });
  } catch (error) {
    console.error("Execute tool error:", error);
    await logAudit(user.id, "execute_tool", "/tools", id, false, req);
    res.status(500).json({ error: "Failed to execute tool" });
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

    await logAudit(user.id, "launch_tool", "/tools", id, true, req, {
      toolName: tool.name,
    });

    res.json({
      message: `Tool ${tool.name} launched`,
      url: tool.endpoint,
      tool: tool,
    });
  } catch (error) {
    console.error("Launch tool error:", error);
    await logAudit(user.id, "launch_tool", "/tools", id, false, req);
    res.status(500).json({ error: "Failed to launch tool" });
  }
});

export default router;
