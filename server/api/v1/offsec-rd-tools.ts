import { Router } from "express";
import { db } from "../../db";
import { toolLibrary, securityTools } from "@shared/schema";
import { eq, desc, and, like } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { z } from "zod";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// Validation schema for tool library entry
const toolLibrarySchema = z.object({
  securityToolId: z.string().uuid("Security tool ID is required"),
  researchValue: z.enum(["low", "medium", "high", "critical"]).optional(),
  testingStatus: z.enum(["untested", "testing", "validated", "deprecated"]).optional(),
  compatibleAgents: z.array(z.string().uuid()).optional(),
  requiredCapabilities: z.array(z.string()).optional(),
  testResults: z.any().optional(),
  knownIssues: z.array(z.string()).optional(),
  usageExamples: z.array(z.any()).optional(),
  researchNotes: z.string().optional(),
});

// GET /api/v1/offsec-rd/tools - List R&D tools
router.get("/", async (req, res) => {
  const { researchValue, testingStatus, category } = req.query;

  try {
    let query = db
      .select({
        id: toolLibrary.id,
        securityToolId: toolLibrary.securityToolId,
        toolName: securityTools.name,
        toolCategory: securityTools.category,
        toolDescription: securityTools.description,
        dockerImage: securityTools.dockerImage,
        researchValue: toolLibrary.researchValue,
        testingStatus: toolLibrary.testingStatus,
        compatibleAgents: toolLibrary.compatibleAgents,
        requiredCapabilities: toolLibrary.requiredCapabilities,
        lastTestedAt: toolLibrary.lastTestedAt,
        testResults: toolLibrary.testResults,
        knownIssues: toolLibrary.knownIssues,
        executionCount: toolLibrary.executionCount,
        successRate: toolLibrary.successRate,
        avgExecutionTimeSeconds: toolLibrary.avgExecutionTimeSeconds,
        usageExamples: toolLibrary.usageExamples,
        researchNotes: toolLibrary.researchNotes,
        createdAt: toolLibrary.createdAt,
        updatedAt: toolLibrary.updatedAt,
      })
      .from(toolLibrary)
      .leftJoin(securityTools, eq(toolLibrary.securityToolId, securityTools.id));

    // Apply filters
    const conditions: any[] = [];
    if (researchValue && typeof researchValue === "string") {
      conditions.push(eq(toolLibrary.researchValue, researchValue));
    }
    if (testingStatus && typeof testingStatus === "string") {
      conditions.push(eq(toolLibrary.testingStatus, testingStatus));
    }
    if (category && typeof category === "string") {
      conditions.push(eq(securityTools.category, category));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const tools = await query.orderBy(desc(toolLibrary.updatedAt));

    res.json({ tools });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve R&D tools",
      details: error.message
    });
  }
});

// GET /api/v1/offsec-rd/tools/:id - Get tool details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select({
        id: toolLibrary.id,
        securityToolId: toolLibrary.securityToolId,
        toolName: securityTools.name,
        toolCategory: securityTools.category,
        toolDescription: securityTools.description,
        toolCommand: securityTools.command,
        dockerImage: securityTools.dockerImage,
        toolStatus: securityTools.status,
        researchValue: toolLibrary.researchValue,
        testingStatus: toolLibrary.testingStatus,
        compatibleAgents: toolLibrary.compatibleAgents,
        requiredCapabilities: toolLibrary.requiredCapabilities,
        lastTestedAt: toolLibrary.lastTestedAt,
        testResults: toolLibrary.testResults,
        knownIssues: toolLibrary.knownIssues,
        executionCount: toolLibrary.executionCount,
        successRate: toolLibrary.successRate,
        avgExecutionTimeSeconds: toolLibrary.avgExecutionTimeSeconds,
        usageExamples: toolLibrary.usageExamples,
        researchNotes: toolLibrary.researchNotes,
        createdAt: toolLibrary.createdAt,
        updatedAt: toolLibrary.updatedAt,
      })
      .from(toolLibrary)
      .leftJoin(securityTools, eq(toolLibrary.securityToolId, securityTools.id))
      .where(eq(toolLibrary.id, id))
      .limit(1);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Tool not found in R&D library" });
    }

    res.json({ tool: result[0] });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve tool",
      details: error.message
    });
  }
});

// POST /api/v1/offsec-rd/tools - Register tool in R&D library
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const validatedData = toolLibrarySchema.parse(req.body);

    // Verify security tool exists
    const tool = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.id, validatedData.securityToolId))
      .limit(1);

    if (!tool || tool.length === 0) {
      return res.status(404).json({ error: "Security tool not found" });
    }

    // Check if already registered
    const existing = await db
      .select()
      .from(toolLibrary)
      .where(eq(toolLibrary.securityToolId, validatedData.securityToolId))
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "Tool already registered in R&D library" });
    }

    const [newToolEntry] = await db
      .insert(toolLibrary)
      .values({
        securityToolId: validatedData.securityToolId,
        researchValue: validatedData.researchValue || "medium",
        testingStatus: validatedData.testingStatus || "untested",
        compatibleAgents: validatedData.compatibleAgents || [],
        requiredCapabilities: validatedData.requiredCapabilities || [],
        testResults: validatedData.testResults || {},
        knownIssues: validatedData.knownIssues || [],
        usageExamples: validatedData.usageExamples || [],
        researchNotes: validatedData.researchNotes,
      })
      .returning();

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_tool_register",
      "/offsec-rd/tools",
      newToolEntry.id,
      true,
      req
    );

    res.status(201).json({ tool: newToolEntry });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors
      });
    }
    res.status(500).json({
      error: "Failed to register tool",
      details: error.message
    });
  }
});

// PUT /api/v1/offsec-rd/tools/:id - Update tool metadata
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const validatedData = toolLibrarySchema.partial().parse(req.body);

    const existing = await db
      .select()
      .from(toolLibrary)
      .where(eq(toolLibrary.id, id))
      .limit(1);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: "Tool not found in R&D library" });
    }

    const [updatedTool] = await db
      .update(toolLibrary)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(toolLibrary.id, id))
      .returning();

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_tool_update",
      `/offsec-rd/tools/${id}`,
      id,
      true,
      req
    );

    res.json({ tool: updatedTool });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors
      });
    }
    res.status(500).json({
      error: "Failed to update tool",
      details: error.message
    });
  }
});

// POST /api/v1/offsec-rd/tools/:id/test - Execute tool test
router.post("/:id/test", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const tool = await db
      .select({
        id: toolLibrary.id,
        securityToolId: toolLibrary.securityToolId,
        toolName: securityTools.name,
        toolCommand: securityTools.command,
        dockerImage: securityTools.dockerImage,
      })
      .from(toolLibrary)
      .leftJoin(securityTools, eq(toolLibrary.securityToolId, securityTools.id))
      .where(eq(toolLibrary.id, id))
      .limit(1);

    if (!tool || tool.length === 0) {
      return res.status(404).json({ error: "Tool not found in R&D library" });
    }

    // TODO: Implement actual tool testing via docker-executor or tool-executor
    // For now, just update testing status and timestamp

    const testResult = {
      testDate: new Date().toISOString(),
      status: "success",
      message: "Tool test execution not yet implemented",
    };

    const [updatedTool] = await db
      .update(toolLibrary)
      .set({
        testingStatus: "testing",
        lastTestedAt: new Date(),
        testResults: testResult,
        updatedAt: new Date(),
      })
      .where(eq(toolLibrary.id, id))
      .returning();

    // Audit log
    await logAudit(
      user.id,
      "offsec_rd_tool_test",
      `/offsec-rd/tools/${id}/test`,
      id,
      true,
      req
    );

    res.json({
      tool: updatedTool,
      testResult,
      message: "Tool test initiated (full testing integration pending)"
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to test tool",
      details: error.message
    });
  }
});

export default router;
