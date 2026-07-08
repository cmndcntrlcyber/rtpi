import { Router } from "express";
import { db } from "../../db";
import { reports, reportTemplates, pdfJobs } from "@shared/schema";
import { eq, lt } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { generateMarkdownReport, getReportFilePath } from "../../services/report-generator";
import { pdfReportGenerator } from "../../services/pdf-report-generator";
import { executiveSummaryGenerator } from "../../services/executive-summary-generator";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createLogger } from '../../lib/logger';
const log = createLogger("reports");

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// ============================================================================
// PDF render-job worker (v2.9.1 Phase 3, FF_PDF_NATIVE)
//
// The worker runs out-of-band so POST /:id/pdf returns immediately. State is
// persisted to pdf_jobs so the UI can poll status across requests, and so a
// cleanup pass can reclaim disk + DB rows after retention.
// ============================================================================

const PDF_JOB_RETENTION_MS = Number(process.env.PDF_JOB_RETENTION_MS) || 24 * 60 * 60 * 1000;
const REPORTS_DIR = process.env.REPORTS_DIR || "./uploads/reports";

interface RenderJobInput {
  reportId: string | null;
  reportData: any;
  pdfOptions?: any;
}

async function runPdfJob(jobId: string, input: RenderJobInput): Promise<void> {
  const startedAt = new Date();
  await db
    .update(pdfJobs)
    .set({ status: "rendering", startedAt })
    .where(eq(pdfJobs.id, jobId));

  try {
    const result = await pdfReportGenerator.generatePDFReport(
      input.reportData,
      input.pdfOptions || {},
    );
    const completedAt = new Date();
    await db
      .update(pdfJobs)
      .set({
        status: "completed",
        filePath: result.filePath,
        fileSize: result.fileSize,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      })
      .where(eq(pdfJobs.id, jobId));
  } catch (err: any) {
    await db
      .update(pdfJobs)
      .set({
        status: "failed",
        error: err?.message || "Unknown render error",
        completedAt: new Date(),
      })
      .where(eq(pdfJobs.id, jobId));
  }
}

/**
 * Hourly cleanup: delete pdf_jobs older than retention + their files.
 * Best-effort — ignores per-row failures so one bad row doesn't block the rest.
 */
async function cleanupExpiredPdfJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - PDF_JOB_RETENTION_MS);
  const expired = await db
    .select({ id: pdfJobs.id, filePath: pdfJobs.filePath })
    .from(pdfJobs)
    .where(lt(pdfJobs.createdAt, cutoff));

  for (const row of expired) {
    if (row.filePath) {
      try {
        await fs.unlink(path.join(REPORTS_DIR, row.filePath));
      } catch {
        // File might be missing or already cleaned up — ignore.
      }
    }
    try {
      await db.delete(pdfJobs).where(eq(pdfJobs.id, row.id));
    } catch (err) {
      log.warn(`[pdf-jobs] failed to delete row ${row.id}:`, err);
    }
  }
}

// Run cleanup hourly. Skip in test runs (NODE_ENV=test).
if (process.env.NODE_ENV !== "test") {
  setInterval(() => {
    cleanupExpiredPdfJobs().catch((err) => {
      log.warn("[pdf-jobs] cleanup pass failed:", err);
    });
  }, 60 * 60 * 1000).unref();
}

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
    // Generate report file based on format
    let fileData = null;
    const format = req.body.format || "markdown";

    if (format === "markdown") {
      fileData = await generateMarkdownReport(req.body);
    } else if (format === "pdf") {
      // Transform request data to PDF report format
      const pdfData = {
        id: crypto.randomUUID(),
        operationId: req.body.operationId,
        name: req.body.name || "Security Assessment Report",
        type: req.body.type || "penetration_test",
        reportDate: new Date(),
        testDates: {
          start: req.body.testDates?.start ? new Date(req.body.testDates.start) : new Date(),
          end: req.body.testDates?.end ? new Date(req.body.testDates.end) : new Date(),
        },
        client: req.body.client,
        tester: req.body.tester || { name: user.name, email: user.email },
        scope: req.body.scope,
        methodology: req.body.methodology,
        findings: req.body.findings,
        executiveSummary: req.body.executiveSummary,
        conclusion: req.body.conclusion,
        recommendations: req.body.recommendations,
        metadata: req.body.metadata,
      };

      const pdfOptions = {
        format: req.body.pdfOptions?.format || "A4",
        includeTableOfContents: req.body.pdfOptions?.includeTableOfContents !== false,
        includeCoverPage: req.body.pdfOptions?.includeCoverPage !== false,
        includeCharts: req.body.pdfOptions?.includeCharts !== false,
        headerText: req.body.pdfOptions?.headerText,
        footerText: req.body.pdfOptions?.footerText,
        pageNumbers: req.body.pdfOptions?.pageNumbers !== false,
        watermark: req.body.pdfOptions?.watermark,
      };

      const result = await pdfReportGenerator.generatePDFReport(pdfData, pdfOptions);
      fileData = {
        filePath: result.filePath,
        fileSize: result.fileSize,
      };
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

// POST /api/v1/reports/generate-executive-summary - Generate AI-powered executive summary
router.post("/generate-executive-summary", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const {
      name,
      type,
      operationId,
      findings,
      scope,
      methodology,
      testDates,
      client,
      tone = "balanced",
      maxLength = 500,
      includeRiskScore = true,
      includeRecommendations = true,
      includeBusinessImpact = true,
      focusAreas = [],
    } = req.body;

    // Validate required fields
    if (!findings || !Array.isArray(findings)) {
      return res.status(400).json({ error: "Findings array is required" });
    }

    // Prepare report data
    const reportData = {
      name: name || "Security Assessment Report",
      type: type || "penetration_test",
      operationId,
      findings,
      scope,
      methodology,
      testDates: testDates ? {
        start: new Date(testDates.start),
        end: new Date(testDates.end),
      } : undefined,
      client,
    };

    // Generate executive summary
    const summary = await executiveSummaryGenerator.generateSummary(reportData, {
      tone,
      maxLength,
      includeRiskScore,
      includeRecommendations,
      includeBusinessImpact,
      focusAreas,
    });

    await logAudit(user.id, "generate_executive_summary", "/reports/generate-executive-summary", null, true, req);

    res.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "generate_executive_summary", "/reports/generate-executive-summary", null, false, req);
    res.status(500).json({ error: "Failed to generate executive summary", details: error?.message || "Internal server error" });
  }
});

// ============================================================================
// Async PDF render endpoints (v2.9.1 Phase 3)
// ============================================================================

// POST /api/v1/reports/:id/pdf - Queue an async PDF render for a report
router.post("/:id/pdf", ensureRole("admin", "operator"), async (req, res) => {
  const { id: reportId } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const report = result[0];
    const content = (report.content as any) || {};

    // Build the PDF input. Caller may override any field via request body.
    const reportData = {
      id: report.id,
      operationId: report.operationId,
      name: report.name,
      type: report.type as any,
      reportDate: new Date(),
      testDates: req.body?.testDates
        ? {
            start: new Date(req.body.testDates.start),
            end: new Date(req.body.testDates.end),
          }
        : { start: new Date(), end: new Date() },
      client: req.body?.client ?? content.client,
      tester: req.body?.tester ?? content.tester ?? { name: user.name, email: user.email },
      scope: req.body?.scope ?? content.scope,
      methodology: req.body?.methodology ?? content.methodology,
      findings: req.body?.findings ?? content.findings,
      executiveSummary: req.body?.executiveSummary ?? content.executiveSummary,
      conclusion: req.body?.conclusion ?? content.conclusion,
      recommendations: req.body?.recommendations ?? content.recommendations,
      metadata: req.body?.metadata ?? content.metadata,
    };

    const inserted = await db
      .insert(pdfJobs)
      .values({
        reportId,
        requestedBy: user.id,
        status: "queued",
      })
      .returning({ id: pdfJobs.id });

    const jobId = inserted[0].id;

    // Fire and forget — runPdfJob updates the row to rendering/completed/failed.
    runPdfJob(jobId, {
      reportId,
      reportData,
      pdfOptions: req.body?.pdfOptions,
    }).catch((err) => {
      log.error(`[pdf-jobs] worker for ${jobId} threw:`, err);
    });

    await logAudit(user.id, "queue_pdf_render", `/reports/${reportId}/pdf`, jobId, true, req);

    res.status(202).json({ jobId, status: "queued" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to queue PDF render", details: error?.message });
  }
});

// GET /api/v1/reports/jobs/:jobId - Poll PDF render job status
router.get("/jobs/:jobId", async (req, res) => {
  const { jobId } = req.params;

  try {
    const result = await db
      .select()
      .from(pdfJobs)
      .where(eq(pdfJobs.id, jobId))
      .limit(1);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = result[0];
    res.json({
      job: {
        id: job.id,
        reportId: job.reportId,
        status: job.status,
        fileSize: job.fileSize,
        error: job.error,
        durationMs: job.durationMs,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        downloadUrl:
          job.status === "completed" ? `/api/v1/reports/jobs/${job.id}/download` : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load job", details: error?.message });
  }
});

// GET /api/v1/reports/jobs/:jobId/download - Stream the rendered PDF
router.get("/jobs/:jobId/download", async (req, res) => {
  const { jobId } = req.params;

  try {
    const result = await db
      .select()
      .from(pdfJobs)
      .where(eq(pdfJobs.id, jobId))
      .limit(1);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = result[0];

    if (job.status !== "completed" || !job.filePath) {
      return res.status(409).json({
        error: "Job is not ready",
        status: job.status,
        details: job.error,
      });
    }

    const fullPath = path.resolve(REPORTS_DIR, job.filePath);

    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({ error: "Rendered file missing on disk" });
    }

    const isHtmlFallback = job.filePath.toLowerCase().endsWith(".html");
    const contentType = isHtmlFallback ? "text/html" : "application/pdf";
    const downloadName = path.basename(job.filePath);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    if (job.fileSize) res.setHeader("Content-Length", job.fileSize);

    const data = await fs.readFile(fullPath);
    res.send(data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to download", details: error?.message });
  }
});

export default router;
