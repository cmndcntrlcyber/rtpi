import { Router } from "express";
import { db } from "../../db";
import { reports, reportTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { generateMarkdownReport, getReportFilePath } from "../../services/report-generator";
import fs from "fs/promises";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/reports - List all reports
router.get("/", async (_req, res) => {
  try {
    const allReports = await db.select().from(reports);
    res.json({ reports: allReports });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list reports", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/reports/:id - Get report details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ report: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get report", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/reports - Generate new report
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    // Only generate files for markdown format (MVP)
    let fileData = null;
    if (req.body.format === "markdown") {
      fileData = await generateMarkdownReport(req.body);
    }

    const report = await db
      .insert(reports)
      .values({
        ...req.body,
        generatedBy: user.id,
        status: req.body.status || "draft",
        filePath: fileData?.filePath,
        fileSize: fileData?.fileSize,
      })
      .returning();

    await logAudit(user.id, "generate_report", "/reports", report[0].id, true, req);

    res.status(201).json({ report: report[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "generate_report", "/reports", null, false, req);
    res.status(500).json({ error: "Failed to generate report", details: error?.message || "Internal server error" });
  }
});

// PUT /api/v1/reports/:id - Update report
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(reports)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    await logAudit(user.id, "update_report", "/reports", id, true, req);

    res.json({ report: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "update_report", "/reports", id, false, req);
    res.status(500).json({ error: "Failed to update report", details: error?.message || "Internal server error" });
  }
});

// DELETE /api/v1/reports/:id - Delete report
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db.delete(reports).where(eq(reports.id, id));

    await logAudit(user.id, "delete_report", "/reports", id, true, req);

    res.json({ message: "Report deleted successfully" });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "delete_report", "/reports", id, false, req);
    res.status(500).json({ error: "Failed to delete report", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/reports/templates - List templates
router.get("/templates/list", async (_req, res) => {
  try {
    const templates = await db
      .select()
      .from(reportTemplates)
      .where(eq(reportTemplates.isActive, true));
    
    res.json({ templates });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list templates", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/reports/templates - Create template
router.post("/templates", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;

  try {
    const template = await db
      .insert(reportTemplates)
      .values({
        ...req.body,
        createdBy: user.id,
      })
      .returning();

    await logAudit(user.id, "create_template", "/reports/templates", template[0].id, true, req);

    res.status(201).json({ template: template[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "create_template", "/reports/templates", null, false, req);
    res.status(500).json({ error: "Failed to create template", details: error?.message || "Internal server error" });
  }
});

// DELETE /api/v1/reports/templates/:id - Delete template
router.delete("/templates/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db
      .update(reportTemplates)
      .set({ isActive: false })
      .where(eq(reportTemplates.id, id));

    await logAudit(user.id, "delete_template", "/reports/templates", id, true, req);

    res.json({ message: "Template deleted successfully" });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "delete_template", "/reports/templates", id, false, req);
    res.status(500).json({ error: "Failed to delete template", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/reports/workflow/:workflowId - Get report by workflow ID
router.get("/workflow/:workflowId", async (req, res) => {
  const { workflowId } = req.params;

  try {
    // Get all reports and filter by workflowId in content
    const allReports = await db.select().from(reports);
    
    // Filter reports that have this workflowId in their content
    const matchingReports = allReports.filter(
      (report) => report.content && 
      typeof report.content === 'object' && 
      'workflowId' in report.content &&
      (report.content as any).workflowId === workflowId
    );

    if (!matchingReports || matchingReports.length === 0) {
      return res.status(404).json({ error: "No report found for this workflow" });
    }

    // Return the most recent report if multiple exist
    const report = matchingReports.sort((a, b) => 
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    )[0];

    res.json({ report });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get report for workflow", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/reports/:id/download - Download report file
router.get("/:id/download", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const report = result[0];

    if (!report.filePath) {
      return res.status(404).json({ error: "Report file not yet generated" });
    }

    const fullPath = await getReportFilePath(report.filePath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({ error: "Report file not found on disk" });
    }

    // Determine content type based on format
    const contentTypes: any = {
      markdown: "text/markdown",
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      html: "text/html",
    };

    const contentType = contentTypes[report.format] || "application/octet-stream";
    const downloadName = `${report.name.replace(/[^a-z0-9]/gi, "_")}.${report.format === "markdown" ? "md" : report.format}`;

    // Set headers and stream file
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.setHeader("Content-Length", report.fileSize || 0);

    const fileContent = await fs.readFile(fullPath);
    res.send(fileContent);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to download report", details: error?.message || "Internal server error" });
  }
});

export default router;
