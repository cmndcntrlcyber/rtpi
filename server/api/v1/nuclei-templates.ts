/**
 * Nuclei Template Management API
 *
 * Provides endpoints for managing nuclei vulnerability templates:
 * - CRUD operations for custom templates
 * - Template validation
 * - Usage statistics
 * - AI-generated template tracking
 */

import { Router } from "express";
import { db } from "../../db";
import { nucleiTemplates, vulnerabilities, users } from "@shared/schema";
import { eq, and, ilike, inArray, desc, sql } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import * as yaml from "yaml";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// ============================================================================
// Template CRUD Operations
// ============================================================================

/**
 * GET /api/v1/nuclei-templates - List templates with filtering
 *
 * Query params:
 * - category: Filter by category (sqli, xss, ssrf, etc.)
 * - severity: Filter by severity (critical, high, medium, low, info)
 * - isCustom: Filter by custom templates (true/false)
 * - generatedByAi: Filter by AI-generated templates (true/false)
 * - search: Search by name or templateId
 * - limit: Number of results (default: 50, max: 200)
 * - offset: Pagination offset
 */
router.get("/", async (req, res) => {
  try {
    const {
      category,
      severity,
      isCustom,
      generatedByAi,
      search,
      limit = "50",
      offset = "0",
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 200);
    const offsetNum = parseInt(offset as string, 10) || 0;

    // Build query with filters
    let query = db.select().from(nucleiTemplates);

    const conditions = [];

    if (category) {
      conditions.push(eq(nucleiTemplates.category, category as string));
    }

    if (severity) {
      conditions.push(eq(nucleiTemplates.severity, severity as any));
    }

    if (isCustom !== undefined) {
      conditions.push(eq(nucleiTemplates.isCustom, isCustom === "true"));
    }

    if (generatedByAi !== undefined) {
      conditions.push(eq(nucleiTemplates.generatedByAi, generatedByAi === "true"));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        sql`(${nucleiTemplates.name} ILIKE ${searchPattern} OR ${nucleiTemplates.templateId} ILIKE ${searchPattern})`
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const templates = await query
      .orderBy(desc(nucleiTemplates.updatedAt))
      .limit(limitNum)
      .offset(offsetNum);

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nucleiTemplates)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      templates,
      pagination: {
        total: Number(count),
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + templates.length < Number(count),
      },
    });
  } catch (error: any) {
    console.error("Failed to list nuclei templates:", error);
    res.status(500).json({
      error: "Failed to list templates",
      details: error?.message || "Internal server error",
    });
  }
});

/**
 * GET /api/v1/nuclei-templates/stats - Template usage statistics
 */
router.get("/stats", async (_req, res) => {
  try {
    // Count by category
    const categoryStats = await db
      .select({
        category: nucleiTemplates.category,
        count: sql<number>`count(*)::int`,
        totalUsage: sql<number>`sum(${nucleiTemplates.usageCount})::int`,
        successRate: sql<number>`
          CASE
            WHEN sum(${nucleiTemplates.usageCount}) > 0
            THEN (sum(${nucleiTemplates.successCount})::float / sum(${nucleiTemplates.usageCount})::float * 100)::int
            ELSE 0
          END
        `,
      })
      .from(nucleiTemplates)
      .groupBy(nucleiTemplates.category);

    // Count by severity
    const severityStats = await db
      .select({
        severity: nucleiTemplates.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(nucleiTemplates)
      .groupBy(nucleiTemplates.severity);

    // Overall stats
    const [overallStats] = await db
      .select({
        totalTemplates: sql<number>`count(*)::int`,
        customTemplates: sql<number>`sum(case when ${nucleiTemplates.isCustom} then 1 else 0 end)::int`,
        aiGeneratedTemplates: sql<number>`sum(case when ${nucleiTemplates.generatedByAi} then 1 else 0 end)::int`,
        validatedTemplates: sql<number>`sum(case when ${nucleiTemplates.isValidated} then 1 else 0 end)::int`,
        totalUsage: sql<number>`sum(${nucleiTemplates.usageCount})::int`,
        totalSuccesses: sql<number>`sum(${nucleiTemplates.successCount})::int`,
      })
      .from(nucleiTemplates);

    // Most used templates
    const topTemplates = await db
      .select({
        id: nucleiTemplates.id,
        templateId: nucleiTemplates.templateId,
        name: nucleiTemplates.name,
        category: nucleiTemplates.category,
        severity: nucleiTemplates.severity,
        usageCount: nucleiTemplates.usageCount,
        successCount: nucleiTemplates.successCount,
      })
      .from(nucleiTemplates)
      .orderBy(desc(nucleiTemplates.usageCount))
      .limit(10);

    res.json({
      overall: {
        ...overallStats,
        overallSuccessRate:
          overallStats.totalUsage > 0
            ? Math.round((overallStats.totalSuccesses / overallStats.totalUsage) * 100)
            : 0,
      },
      byCategory: categoryStats,
      bySeverity: severityStats,
      topTemplates,
    });
  } catch (error: any) {
    console.error("Failed to get template stats:", error);
    res.status(500).json({
      error: "Failed to get statistics",
      details: error?.message || "Internal server error",
    });
  }
});

/**
 * GET /api/v1/nuclei-templates/:id - Get template details
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [template] = await db
      .select()
      .from(nucleiTemplates)
      .where(eq(nucleiTemplates.id, id))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Get associated vulnerability if exists
    let linkedVulnerability = null;
    if (template.targetVulnerabilityId) {
      const [vuln] = await db
        .select()
        .from(vulnerabilities)
        .where(eq(vulnerabilities.id, template.targetVulnerabilityId))
        .limit(1);
      linkedVulnerability = vuln || null;
    }

    // Get creator info if available
    let creator = null;
    if (template.createdBy) {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        })
        .from(users)
        .where(eq(users.id, template.createdBy))
        .limit(1);
      creator = user || null;
    }

    res.json({
      template,
      linkedVulnerability,
      creator,
    });
  } catch (error: any) {
    console.error("Failed to get template:", error);
    res.status(500).json({
      error: "Failed to get template",
      details: error?.message || "Internal server error",
    });
  }
});

/**
 * POST /api/v1/nuclei-templates - Create custom template
 */
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const {
      templateId,
      name,
      severity,
      category,
      content,
      filePath,
      targetVulnerabilityId,
      tags,
      metadata,
    } = req.body;

    // Validate required fields
    if (!templateId || !name || !severity || !content) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["templateId", "name", "severity", "content"],
      });
    }

    // Check for duplicate templateId
    const [existing] = await db
      .select({ id: nucleiTemplates.id })
      .from(nucleiTemplates)
      .where(eq(nucleiTemplates.templateId, templateId))
      .limit(1);

    if (existing) {
      return res.status(409).json({
        error: "Template ID already exists",
        existingId: existing.id,
      });
    }

    // Validate YAML syntax
    try {
      yaml.parse(content);
    } catch (yamlError: any) {
      return res.status(400).json({
        error: "Invalid YAML syntax",
        details: yamlError?.message,
      });
    }

    const [template] = await db
      .insert(nucleiTemplates)
      .values({
        templateId,
        name,
        severity,
        category,
        content,
        filePath,
        targetVulnerabilityId,
        tags: tags || [],
        metadata: metadata || {},
        isCustom: true,
        generatedByAi: false,
        createdBy: user.id,
      })
      .returning();

    await logAudit(user.id, "create_nuclei_template", "/nuclei-templates", template.id, true, req);

    res.status(201).json({ template });
  } catch (error: any) {
    console.error("Failed to create template:", error);
    const user = req.user as any;
    await logAudit(user.id, "create_nuclei_template", "/nuclei-templates", null, false, req);
    res.status(500).json({
      error: "Failed to create template",
      details: error?.message || "Internal server error",
    });
  }
});

/**
 * PUT /api/v1/nuclei-templates/:id - Update template
 */
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const [existing] = await db
      .select()
      .from(nucleiTemplates)
      .where(eq(nucleiTemplates.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }

    const { name, severity, category, content, filePath, tags, metadata, isValidated } = req.body;

    // Validate YAML if content is being updated
    if (content) {
      try {
        yaml.parse(content);
      } catch (yamlError: any) {
        return res.status(400).json({
          error: "Invalid YAML syntax",
          details: yamlError?.message,
        });
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (severity !== undefined) updateData.severity = severity;
    if (category !== undefined) updateData.category = category;
    if (content !== undefined) {
      updateData.content = content;
      // Reset validation if content changes
      updateData.isValidated = false;
      updateData.validationResults = {};
    }
    if (filePath !== undefined) updateData.filePath = filePath;
    if (tags !== undefined) updateData.tags = tags;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (isValidated !== undefined) updateData.isValidated = isValidated;

    const [updated] = await db
      .update(nucleiTemplates)
      .set(updateData)
      .where(eq(nucleiTemplates.id, id))
      .returning();

    await logAudit(user.id, "update_nuclei_template", "/nuclei-templates", id, true, req);

    res.json({ template: updated });
  } catch (error: any) {
    console.error("Failed to update template:", error);
    const user = req.user as any;
    await logAudit(user.id, "update_nuclei_template", "/nuclei-templates", id, false, req);
    res.status(500).json({
      error: "Failed to update template",
      details: error?.message || "Internal server error",
    });
  }
});

/**
 * DELETE /api/v1/nuclei-templates/:id - Delete template
 */
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const [existing] = await db
      .select()
      .from(nucleiTemplates)
      .where(eq(nucleiTemplates.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }

    await db.delete(nucleiTemplates).where(eq(nucleiTemplates.id, id));

    await logAudit(user.id, "delete_nuclei_template", "/nuclei-templates", id, true, req);

    res.json({ success: true, deleted: existing.templateId });
  } catch (error: any) {
    console.error("Failed to delete template:", error);
    const user = req.user as any;
    await logAudit(user.id, "delete_nuclei_template", "/nuclei-templates", id, false, req);
    res.status(500).json({
      error: "Failed to delete template",
      details: error?.message || "Internal server error",
    });
  }
});

// ============================================================================
// Template Validation
// ============================================================================

/**
 * POST /api/v1/nuclei-templates/validate - Validate YAML syntax
 */
router.post("/validate", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    try {
      const parsed = yaml.parse(content);

      // Basic nuclei template structure validation
      const issues: string[] = [];

      if (!parsed.id) issues.push("Missing 'id' field");
      if (!parsed.info) issues.push("Missing 'info' section");
      if (!parsed.info?.name) issues.push("Missing 'info.name' field");
      if (!parsed.info?.severity) issues.push("Missing 'info.severity' field");
      if (!parsed.http && !parsed.dns && !parsed.file && !parsed.network && !parsed.headless) {
        issues.push("Missing protocol section (http, dns, file, network, or headless)");
      }

      if (issues.length > 0) {
        return res.json({
          valid: false,
          syntaxValid: true,
          issues,
          parsed: {
            id: parsed.id,
            info: parsed.info,
          },
        });
      }

      res.json({
        valid: true,
        syntaxValid: true,
        issues: [],
        parsed: {
          id: parsed.id,
          info: parsed.info,
          protocols: Object.keys(parsed).filter((k) =>
            ["http", "dns", "file", "network", "headless"].includes(k)
          ),
        },
      });
    } catch (yamlError: any) {
      res.json({
        valid: false,
        syntaxValid: false,
        issues: [`YAML syntax error: ${yamlError?.message}`],
      });
    }
  } catch (error: any) {
    console.error("Failed to validate template:", error);
    res.status(500).json({
      error: "Failed to validate template",
      details: error?.message || "Internal server error",
    });
  }
});

/**
 * POST /api/v1/nuclei-templates/:id/validate - Validate and update template status
 */
router.post("/:id/validate", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const [template] = await db
      .select()
      .from(nucleiTemplates)
      .where(eq(nucleiTemplates.id, id))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Parse and validate
    let validationResults: any = {
      timestamp: new Date().toISOString(),
      validatedBy: user.id,
    };

    try {
      const parsed = yaml.parse(template.content);

      const issues: string[] = [];
      if (!parsed.id) issues.push("Missing 'id' field");
      if (!parsed.info) issues.push("Missing 'info' section");
      if (!parsed.info?.name) issues.push("Missing 'info.name' field");
      if (!parsed.info?.severity) issues.push("Missing 'info.severity' field");
      if (!parsed.http && !parsed.dns && !parsed.file && !parsed.network && !parsed.headless) {
        issues.push("Missing protocol section");
      }

      validationResults.syntaxValid = true;
      validationResults.structureValid = issues.length === 0;
      validationResults.issues = issues;
      validationResults.parsed = {
        id: parsed.id,
        info: parsed.info,
      };
    } catch (yamlError: any) {
      validationResults.syntaxValid = false;
      validationResults.structureValid = false;
      validationResults.issues = [`YAML syntax error: ${yamlError?.message}`];
    }

    const isValid = validationResults.syntaxValid && validationResults.structureValid;

    const [updated] = await db
      .update(nucleiTemplates)
      .set({
        isValidated: isValid,
        validationResults,
        updatedAt: new Date(),
      })
      .where(eq(nucleiTemplates.id, id))
      .returning();

    await logAudit(user.id, "validate_nuclei_template", "/nuclei-templates", id, isValid, req);

    res.json({
      template: updated,
      validation: validationResults,
    });
  } catch (error: any) {
    console.error("Failed to validate template:", error);
    res.status(500).json({
      error: "Failed to validate template",
      details: error?.message || "Internal server error",
    });
  }
});

// ============================================================================
// Template Usage Tracking
// ============================================================================

/**
 * POST /api/v1/nuclei-templates/:id/record-usage - Record template usage
 * Internal endpoint for agents to track template effectiveness
 */
router.post("/:id/record-usage", ensureRole("admin", "operator", "agent"), async (req, res) => {
  const { id } = req.params;

  try {
    const { success } = req.body;

    const [template] = await db
      .select()
      .from(nucleiTemplates)
      .where(eq(nucleiTemplates.id, id))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    const updateData: any = {
      usageCount: template.usageCount + 1,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    };

    if (success === true) {
      updateData.successCount = template.successCount + 1;
    }

    const [updated] = await db
      .update(nucleiTemplates)
      .set(updateData)
      .where(eq(nucleiTemplates.id, id))
      .returning();

    res.json({
      template: {
        id: updated.id,
        templateId: updated.templateId,
        usageCount: updated.usageCount,
        successCount: updated.successCount,
        successRate:
          updated.usageCount > 0
            ? Math.round((updated.successCount / updated.usageCount) * 100)
            : 0,
      },
    });
  } catch (error: any) {
    console.error("Failed to record template usage:", error);
    res.status(500).json({
      error: "Failed to record usage",
      details: error?.message || "Internal server error",
    });
  }
});

/**
 * GET /api/v1/nuclei-templates/categories - Get available categories
 */
router.get("/meta/categories", async (_req, res) => {
  try {
    const categories = await db
      .selectDistinct({ category: nucleiTemplates.category })
      .from(nucleiTemplates)
      .where(sql`${nucleiTemplates.category} IS NOT NULL`);

    res.json({
      categories: categories.map((c) => c.category).filter(Boolean),
    });
  } catch (error: any) {
    console.error("Failed to get categories:", error);
    res.status(500).json({
      error: "Failed to get categories",
      details: error?.message || "Internal server error",
    });
  }
});

export default router;
