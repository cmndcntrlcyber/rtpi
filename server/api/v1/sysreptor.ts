/**
 * SysReptor Integration API
 *
 * Endpoints for connecting RTPI operations/vulnerabilities to SysReptor
 * for professional penetration test report generation.
 */

import { Router } from "express";
import { db } from "../../db";
import { vulnerabilities, operations, targets } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sysReptorClient } from "../../services/sysreptor-client";
import { ensureAuthenticated } from "../../auth/middleware";

const router = Router();
router.use(ensureAuthenticated);

// ============================================================================
// GET /api/v1/sysreptor/status
// Check SysReptor connectivity and token validity
// ============================================================================

router.get("/status", async (_req, res) => {
  try {
    const health = await sysReptorClient.checkHealth();
    res.json({
      ...health,
      url: process.env.SYSREPTOR_URL || "http://rtpi-sysreptor-app:8000",
      tokenConfigured: sysReptorClient.configured,
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error instanceof Error ? error.message : "Health check failed",
    });
  }
});

// ============================================================================
// GET /api/v1/sysreptor/designs
// List available report design templates
// ============================================================================

router.get("/designs", async (_req, res) => {
  try {
    const designs = await sysReptorClient.listDesigns();
    res.json({ designs });
  } catch (error) {
    res.status(500).json({
      error: "Failed to list designs",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// GET /api/v1/sysreptor/templates
// List available finding templates
// ============================================================================

router.get("/templates", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const templates = await sysReptorClient.listFindingTemplates(search);
    res.json({ templates });
  } catch (error) {
    res.status(500).json({
      error: "Failed to list finding templates",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// GET /api/v1/sysreptor/projects
// List SysReptor projects
// ============================================================================

router.get("/projects", async (_req, res) => {
  try {
    const projects = await sysReptorClient.listProjects();
    res.json({ projects });
  } catch (error) {
    res.status(500).json({
      error: "Failed to list projects",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// POST /api/v1/sysreptor/export
// Export an RTPI operation to a SysReptor project with all findings
// ============================================================================

router.post("/export", async (req, res) => {
  try {
    const {
      operationId,
      designId,
      name,
      includeFindings = true,
      tags,
    } = req.body;

    if (!operationId) {
      return res.status(400).json({ error: "operationId is required" });
    }

    // Fetch operation
    const [operation] = await db
      .select()
      .from(operations)
      .where(eq(operations.id, operationId))
      .limit(1);

    if (!operation) {
      return res.status(404).json({ error: "Operation not found" });
    }

    // Create SysReptor project
    const projectName =
      name || `${operation.name} - Pentest Report`;
    const projectTags = tags || ["rtpi", "automated"];

    console.log(`[SysReptor] Creating project: ${projectName}`);
    const project = await sysReptorClient.createProject(
      projectName,
      designId,
      projectTags,
    );

    let findingsExported = 0;

    if (includeFindings) {
      // Fetch all vulnerabilities for this operation (exclude false positives)
      const vulns = await db
        .select()
        .from(vulnerabilities)
        .where(eq(vulnerabilities.operationId, operationId));

      const validFindings = vulns.filter(
        (v) => v.status !== "false_positive",
      );

      // Add each finding to SysReptor
      for (const vuln of validFindings) {
        try {
          await sysReptorClient.addFinding(project.id, {
            title: vuln.title,
            severity: vuln.severity,
            description: vuln.description,
            cvssScore: vuln.cvssScore,
            cvssVector: vuln.cvssVector,
            cveId: vuln.cveId,
            cweId: vuln.cweId,
            proofOfConcept: vuln.proofOfConcept,
            remediation: vuln.remediation,
            impact: vuln.impact,
            exploitability: vuln.exploitability,
            affectedServices: vuln.affectedServices,
            references: vuln.references,
            status: vuln.status,
          });
          findingsExported++;
        } catch (err) {
          console.error(
            `[SysReptor] Failed to add finding "${vuln.title}":`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      console.log(
        `[SysReptor] Exported ${findingsExported}/${validFindings.length} findings`,
      );
    }

    // Populate report sections with operation metadata
    try {
      const sections = await sysReptorClient.getSections(project.id);
      for (const section of sections) {
        const label = section.label?.toLowerCase() || "";
        let sectionData: Record<string, any> | null = null;

        if (label.includes("executive") || label.includes("summary")) {
          sectionData = {
            executive_summary: `This penetration test was conducted for ${operation.name}. ${operation.description || ""}\n\nScope: ${operation.scope || "See operation details"}\n\nObjectives: ${operation.objectives || "Identify and validate security vulnerabilities"}`,
          };
        } else if (label.includes("scope")) {
          sectionData = {
            scope: operation.scope || "Refer to the engagement agreement for full scope details.",
          };
        }

        if (sectionData) {
          await sysReptorClient.updateSection(project.id, section.id, sectionData);
        }
      }
    } catch (err) {
      console.warn("[SysReptor] Could not populate sections:", err instanceof Error ? err.message : err);
    }

    const projectUrl = `${process.env.SYSREPTOR_URL || "http://rtpi-sysreptor-app:8000"}/projects/${project.id}`;

    res.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        url: projectUrl,
      },
      findingsExported,
      message: `Exported operation "${operation.name}" with ${findingsExported} findings`,
    });
  } catch (error) {
    console.error("[SysReptor] Export failed:", error);
    res.status(500).json({
      error: "Export failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// POST /api/v1/sysreptor/projects/:id/sync
// Re-sync findings from RTPI operation to existing SysReptor project
// ============================================================================

router.post("/projects/:id/sync", async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { operationId } = req.body;

    if (!operationId) {
      return res.status(400).json({ error: "operationId is required" });
    }

    // Get existing findings in SysReptor project
    const existingFindings = await sysReptorClient.listFindings(projectId);
    const existingTitles = new Set(
      existingFindings.map((f) => f.data?.title || f.title),
    );

    // Fetch RTPI vulnerabilities
    const vulns = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.operationId, operationId));

    const validFindings = vulns.filter((v) => v.status !== "false_positive");

    let added = 0;
    let skipped = 0;

    for (const vuln of validFindings) {
      if (existingTitles.has(vuln.title)) {
        skipped++;
        continue;
      }

      try {
        await sysReptorClient.addFinding(projectId, {
          title: vuln.title,
          severity: vuln.severity,
          description: vuln.description,
          cvssScore: vuln.cvssScore,
          cvssVector: vuln.cvssVector,
          cveId: vuln.cveId,
          cweId: vuln.cweId,
          proofOfConcept: vuln.proofOfConcept,
          remediation: vuln.remediation,
          impact: vuln.impact,
          exploitability: vuln.exploitability,
          affectedServices: vuln.affectedServices,
          references: vuln.references,
          status: vuln.status,
        });
        added++;
      } catch (err) {
        console.error(
          `[SysReptor] Sync failed for "${vuln.title}":`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    res.json({
      success: true,
      added,
      skipped,
      total: validFindings.length,
      message: `Synced ${added} new findings, skipped ${skipped} existing`,
    });
  } catch (error) {
    res.status(500).json({
      error: "Sync failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// GET /api/v1/sysreptor/projects/:id/pdf
// Render and download PDF from SysReptor project
// ============================================================================

router.get("/projects/:id/pdf", async (req, res) => {
  try {
    const { id: projectId } = req.params;

    const pdfBuffer = await sysReptorClient.renderPDF(projectId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report-${projectId}.pdf"`,
    );
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({
      error: "PDF generation failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
