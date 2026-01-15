import { Router } from "express";
import { db } from "../../db";
import {
  attackTactics,
  attackTechniques,
  attackGroups,
  attackSoftware,
  attackMitigations,
  attackDataSources,
  attackCampaigns,
  operationAttackMapping,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  importSTIXBundle,
  getImportStatistics,
  type STIXBundle,
} from "../../services/stix-parser";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Get ATT&CK statistics
 */
router.get("/stats", async (_req, res) => {
  try {
    const stats = await getImportStatistics();
    res.json(stats);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get statistics", details: error?.message || "Internal server error" });
  }
});

/**
 * Import STIX bundle
 */
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileContent = req.file.buffer.toString("utf-8");
    const bundle: STIXBundle = JSON.parse(fileContent);

    if (bundle.type !== "bundle") {
      return res.status(400).json({ error: "Invalid STIX bundle" });
    }

    const stats = await importSTIXBundle(bundle);

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      error: "Failed to import STIX bundle",
      message: error.message,
    });
  }
});

/**
 * Import STIX bundle from JSON body
 */
router.post("/import/json", async (req, res) => {
  try {
    const bundle: STIXBundle = req.body;

    if (!bundle || bundle.type !== "bundle") {
      return res.status(400).json({ error: "Invalid STIX bundle" });
    }

    const stats = await importSTIXBundle(bundle);

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      error: "Failed to import STIX bundle",
      message: error.message,
    });
  }
});

/**
 * List all tactics
 */
router.get("/tactics", async (_req, res) => {
  try {
    const tactics = await db.query.attackTactics.findMany({
      orderBy: [desc(attackTactics.createdAt)],
    });

    res.json(tactics);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list tactics", details: error?.message || "Internal server error" });
  }
});

/**
 * Get a specific tactic
 */
router.get("/tactics/:id", async (req, res) => {
  try {
    const tactic = await db.query.attackTactics.findFirst({
      where: eq(attackTactics.id, req.params.id),
    });

    if (!tactic) {
      return res.status(404).json({ error: "Tactic not found" });
    }

    res.json(tactic);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get tactic", details: error?.message || "Internal server error" });
  }
});

/**
 * List all techniques
 */
router.get("/techniques", async (req, res) => {
  try {
    const { subtechniques, hierarchical } = req.query;

    let techniques;
    if (subtechniques === "only") {
      techniques = await db.query.attackTechniques.findMany({
        where: eq(attackTechniques.isSubtechnique, true),
        orderBy: [desc(attackTechniques.createdAt)],
      });
    } else if (subtechniques === "exclude") {
      techniques = await db.query.attackTechniques.findMany({
        where: eq(attackTechniques.isSubtechnique, false),
        orderBy: [desc(attackTechniques.createdAt)],
      });
    } else {
      techniques = await db.query.attackTechniques.findMany({
        orderBy: [desc(attackTechniques.createdAt)],
      });
    }

    // If hierarchical view is requested, group sub-techniques under parent techniques
    if (hierarchical === "true" && subtechniques !== "only") {
      // Get all parent techniques (non-sub-techniques)
      const parentTechniques = techniques.filter((t: any) => !t.isSubtechnique);

      // For each parent technique, find and attach its sub-techniques
      const hierarchicalTechniques = await Promise.all(
        parentTechniques.map(async (parent: any) => {
          const subs = await db.query.attackTechniques.findMany({
            where: eq(attackTechniques.parentTechniqueId, parent.id),
            orderBy: [desc(attackTechniques.attackId)],
          });

          return {
            ...parent,
            subtechniques: subs,
          };
        })
      );

      return res.json(hierarchicalTechniques);
    }

    res.json(techniques);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list techniques", details: error?.message || "Internal server error" });
  }
});

/**
 * Get a specific technique
 */
router.get("/techniques/:id", async (req, res) => {
  try {
    const technique = await db.query.attackTechniques.findFirst({
      where: eq(attackTechniques.id, req.params.id),
    });

    if (!technique) {
      return res.status(404).json({ error: "Technique not found" });
    }

    // Get parent technique if this is a sub-technique
    let parent = null;
    if (technique.parentTechniqueId) {
      parent = await db.query.attackTechniques.findFirst({
        where: eq(attackTechniques.id, technique.parentTechniqueId),
      });
    }

    // Get sub-techniques if this is a parent technique
    const subtechniques = await db.query.attackTechniques.findMany({
      where: eq(attackTechniques.parentTechniqueId, technique.id),
    });

    res.json({
      ...technique,
      parent,
      subtechniques,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get technique", details: error?.message || "Internal server error" });
  }
});

/**
 * List all groups
 */
router.get("/groups", async (_req, res) => {
  try {
    const groups = await db.query.attackGroups.findMany({
      orderBy: [desc(attackGroups.createdAt)],
    });

    res.json(groups);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list groups", details: error?.message || "Internal server error" });
  }
});

/**
 * Get a specific group
 */
router.get("/groups/:id", async (req, res) => {
  try {
    const group = await db.query.attackGroups.findFirst({
      where: eq(attackGroups.id, req.params.id),
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json(group);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get group", details: error?.message || "Internal server error" });
  }
});

/**
 * List all software
 */
router.get("/software", async (_req, res) => {
  try {
    const software = await db.query.attackSoftware.findMany({
      orderBy: [desc(attackSoftware.createdAt)],
    });

    res.json(software);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list software", details: error?.message || "Internal server error" });
  }
});

/**
 * Get specific software
 */
router.get("/software/:id", async (req, res) => {
  try {
    const software = await db.query.attackSoftware.findFirst({
      where: eq(attackSoftware.id, req.params.id),
    });

    if (!software) {
      return res.status(404).json({ error: "Software not found" });
    }

    res.json(software);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get software", details: error?.message || "Internal server error" });
  }
});

/**
 * List all mitigations
 */
router.get("/mitigations", async (_req, res) => {
  try {
    const mitigations = await db.query.attackMitigations.findMany({
      orderBy: [desc(attackMitigations.createdAt)],
    });

    res.json(mitigations);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list mitigations", details: error?.message || "Internal server error" });
  }
});

/**
 * Get a specific mitigation
 */
router.get("/mitigations/:id", async (req, res) => {
  try {
    const mitigation = await db.query.attackMitigations.findFirst({
      where: eq(attackMitigations.id, req.params.id),
    });

    if (!mitigation) {
      return res.status(404).json({ error: "Mitigation not found" });
    }

    res.json(mitigation);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get mitigation", details: error?.message || "Internal server error" });
  }
});

/**
 * List all data sources
 */
router.get("/data-sources", async (_req, res) => {
  try {
    const dataSources = await db.query.attackDataSources.findMany({
      orderBy: [desc(attackDataSources.createdAt)],
    });

    res.json(dataSources);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list data sources", details: error?.message || "Internal server error" });
  }
});

/**
 * List all campaigns
 */
router.get("/campaigns", async (_req, res) => {
  try {
    const campaigns = await db.query.attackCampaigns.findMany({
      orderBy: [desc(attackCampaigns.createdAt)],
    });

    res.json(campaigns);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list campaigns", details: error?.message || "Internal server error" });
  }
});

/**
 * Get operation coverage for a specific operation
 */
router.get("/operations/:operationId/coverage", async (req, res) => {
  try {
    const coverage = await db.query.operationAttackMapping.findMany({
      where: eq(operationAttackMapping.operationId, req.params.operationId),
      with: {
        technique: true,
        tactic: true,
      },
    });

    res.json(coverage);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get operation coverage", details: error?.message || "Internal server error" });
  }
});

/**
 * Map a technique to an operation
 */
router.post("/operations/:operationId/techniques/:techniqueId", async (req, res) => {
  try {
    const { tacticId, status, notes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if mapping already exists
    const existing = await db.query.operationAttackMapping.findFirst({
      where: and(
        eq(operationAttackMapping.operationId, req.params.operationId),
        eq(operationAttackMapping.techniqueId, req.params.techniqueId)
      ),
    });

    if (existing) {
      // Update existing mapping
      const [updated] = await db
        .update(operationAttackMapping)
        .set({
          tacticId: tacticId || existing.tacticId,
          status: status || existing.status,
          notes: notes || existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(operationAttackMapping.id, existing.id))
        .returning();

      return res.json(updated);
    }

    // Create new mapping
    const [mapping] = await db
      .insert(operationAttackMapping)
      .values({
        operationId: req.params.operationId,
        techniqueId: req.params.techniqueId,
        tacticId: tacticId || null,
        status: status || "planned",
        notes: notes || null,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(mapping);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to map technique", details: error?.message || "Internal server error" });
  }
});

/**
 * Remove a technique from an operation
 */
router.delete("/operations/:operationId/techniques/:techniqueId", async (req, res) => {
  try {
    await db
      .delete(operationAttackMapping)
      .where(
        and(
          eq(operationAttackMapping.operationId, req.params.operationId),
          eq(operationAttackMapping.techniqueId, req.params.techniqueId)
        )
      );

    res.status(204).send();
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to remove technique", details: error?.message || "Internal server error" });
  }
});

export default router;
