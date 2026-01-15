import { Router } from "express";
import { db } from "../../db";
import { vulnerabilities, targets, operations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import { vulnerabilityAIEnrichment } from "../../services/vulnerability-ai-enrichment";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/vulnerabilities - List all vulnerabilities
router.get("/", async (_req, res) => {
  try {
    const allVulns = await db.select().from(vulnerabilities);
    res.json({ vulnerabilities: allVulns });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list vulnerabilities", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/vulnerabilities/:id - Get vulnerability details
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Vulnerability not found" });
    }

    res.json({ vulnerability: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get vulnerability", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/vulnerabilities - Create new vulnerability
router.post("/", ensureRole("admin", "operator"), async (req, res) => {
  const user = req.user as any;

  try {
    const vuln = await db
      .insert(vulnerabilities)
      .values(req.body)
      .returning();

    await logAudit(user.id, "create_vulnerability", "/vulnerabilities", vuln[0].id, true, req);

    res.status(201).json({ vulnerability: vuln[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "create_vulnerability", "/vulnerabilities", null, false, req);
    res.status(500).json({ error: "Failed to create vulnerability", details: error?.message || "Internal server error" });
  }
});

// PUT /api/v1/vulnerabilities/:id - Update vulnerability
router.put("/:id", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(vulnerabilities)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(vulnerabilities.id, id))
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Vulnerability not found" });
    }

    await logAudit(user.id, "update_vulnerability", "/vulnerabilities", id, true, req);

    res.json({ vulnerability: result[0] });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "update_vulnerability", "/vulnerabilities", id, false, req);
    res.status(500).json({ error: "Failed to update vulnerability", details: error?.message || "Internal server error" });
  }
});

// DELETE /api/v1/vulnerabilities/:id - Delete vulnerability
router.delete("/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db.delete(vulnerabilities).where(eq(vulnerabilities.id, id));

    await logAudit(user.id, "delete_vulnerability", "/vulnerabilities", id, true, req);

    res.json({ message: "Vulnerability deleted successfully" });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "delete_vulnerability", "/vulnerabilities", id, false, req);
    res.status(500).json({ error: "Failed to delete vulnerability", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/vulnerabilities/:id/ai-generate-field - Generate a single field using AI
router.post("/:id/ai-generate-field", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const { fieldName, context } = req.body;
  const user = req.user as any;

  try {
    // Get vulnerability
    const vuln = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.id, id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!vuln) {
      return res.status(404).json({ error: "Vulnerability not found" });
    }

    // Get additional context if needed
    const enrichedContext = {
      ...context,
      cveId: vuln.cveId || context.cveId,
      cweId: vuln.cweId || context.cweId,
      title: vuln.title,
    };

    // Add target info if available
    if (vuln.targetId) {
      const target = await db
        .select()
        .from(targets)
        .where(eq(targets.id, vuln.targetId))
        .limit(1)
        .then((rows) => rows[0]);
      
      if (target) {
        enrichedContext.targetInfo = target;
      }
    }

    // Add operation scope if available
    if (vuln.operationId) {
      const operation = await db
        .select()
        .from(operations)
        .where(eq(operations.id, vuln.operationId))
        .limit(1)
        .then((rows) => rows[0]);
      
      if (operation) {
        enrichedContext.operationScope = operation.scope;
      }
    }

    let result = null;

    // Generate based on field name
    switch (fieldName) {
      case "proofOfConcept":
        result = await vulnerabilityAIEnrichment.generatePOC(enrichedContext);
        break;
      case "remediation":
        result = await vulnerabilityAIEnrichment.suggestRemediation(enrichedContext);
        break;
      case "description":
        result = await vulnerabilityAIEnrichment.generateDescription(enrichedContext);
        break;
      default:
        return res.status(400).json({ error: `Field '${fieldName}' is not supported for AI generation` });
    }

    if (!result) {
      return res.status(500).json({ error: "Failed to generate content", details: error?.message || "Internal server error" });
    }

    await logAudit(user.id, "ai_generate_field", "/vulnerabilities", id, true, req);

    res.json({
      success: true,
      field: result.field,
      content: result.content,
      confidence: result.confidence,
      sources: result.sources,
    });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "ai_generate_field", "/vulnerabilities", id, false, req);
    res.status(500).json({ error: "Failed to generate field content", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/vulnerabilities/:id/ai-enrich-all - Auto-generate all empty fields
router.post("/:id/ai-enrich-all", ensureRole("admin", "operator"), async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await vulnerabilityAIEnrichment.enrichAllFields(id, user.id);

    // Update the vulnerability with enriched data
    if (Object.keys(result.enriched).length > 0) {
      await db
        .update(vulnerabilities)
        .set({
          ...result.enriched,
          aiGenerated: result.aiGenerated,
          updatedAt: new Date(),
        })
        .where(eq(vulnerabilities.id, id));
    }

    await logAudit(user.id, "ai_enrich_all", "/vulnerabilities", id, true, req);

    res.json({
      success: true,
      enrichedFields: Object.keys(result.enriched),
      aiGenerated: result.aiGenerated,
      message: `Successfully enriched ${Object.keys(result.enriched).length} fields`,
    });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "ai_enrich_all", "/vulnerabilities", id, false, req);
    res.status(500).json({ error: "Failed to enrich vulnerability", details: error?.message || "Internal server error" });
  }
});

// POST /api/v1/vulnerabilities/ai-enrich-from-cve - Create vulnerability from CVE
router.post("/ai-enrich-from-cve", ensureRole("admin", "operator"), async (req, res) => {
  const { cveId, targetId, operationId } = req.body;
  const user = req.user as any;

  try {
    if (!cveId) {
      return res.status(400).json({ error: "CVE ID is required" });
    }

    // Fetch CVE data
    const cveData = await vulnerabilityAIEnrichment.enrichFromCVE(cveId);

    if (!cveData.description) {
      return res.status(404).json({ error: "Could not fetch CVE data" });
    }

    // Create vulnerability with enriched data
    const newVuln = await db
      .insert(vulnerabilities)
      .values({
        title: `Vulnerability: ${cveId}`,
        description: cveData.description,
        severity: cveData.severity as any || "medium",
        cvssScore: cveData.cvssScore,
        cvssVector: cveData.cvssVector,
        cveId,
        cweId: cveData.cweId,
        references: cveData.references || [],
        targetId,
        operationId,
        aiGenerated: {
          description: true,
          cvssScore: true,
          cvssVector: true,
          references: true,
        },
      })
      .returning();

    await logAudit(user.id, "create_from_cve", "/vulnerabilities", newVuln[0].id, true, req);

    res.status(201).json({
      success: true,
      vulnerability: newVuln[0],
      message: "Vulnerability created from CVE data",
    });
  } catch (error: any) {
    // Error logged for debugging
    await logAudit(user.id, "create_from_cve", "/vulnerabilities", null, false, req);
    res.status(500).json({ error: "Failed to create vulnerability from CVE", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/vulnerabilities/:id/related - Find related vulnerabilities
router.get("/:id/related", async (req, res) => {
  const { id } = req.params;

  try {
    const related = await vulnerabilityAIEnrichment.findRelatedFindings(id);
    res.json({ related });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to find related vulnerabilities", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/vulnerabilities/:id/operation-context - Get operation context for vulnerability
router.get("/:id/operation-context", async (req, res) => {
  const { id } = req.params;

  try {
    const vuln = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.id, id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!vuln) {
      return res.status(404).json({ error: "Vulnerability not found" });
    }

    const context: any = { vulnerability: vuln };

    // Get target info
    if (vuln.targetId) {
      const target = await db
        .select()
        .from(targets)
        .where(eq(targets.id, vuln.targetId))
        .limit(1)
        .then((rows) => rows[0]);
      
      context.target = target;
    }

    // Get operation info
    if (vuln.operationId) {
      const operation = await db
        .select()
        .from(operations)
        .where(eq(operations.id, vuln.operationId))
        .limit(1)
        .then((rows) => rows[0]);
      
      context.operation = operation;

      // Get all targets in operation
      if (operation) {
        const operationTargets = await db
          .select()
          .from(targets)
          .where(eq(targets.operationId, operation.id));
        
        context.availableTargets = operationTargets;
      }
    }

    res.json({ context });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get operation context", details: error?.message || "Internal server error" });
  }
});

export default router;
