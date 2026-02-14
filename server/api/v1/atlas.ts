import { Router } from "express";
import { db } from "../../db";
import {
  atlasTactics,
  atlasTechniques,
  atlasCaseStudies,
  atlasMitigations,
  atlasRelationships,
  operationAtlasMapping,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  importATLASSTIXBundle,
  getATLASStats,
} from "../../services/atlas-stix-parser";
import { importATLASMatrix } from "../../services/atlas-parser";
import type { STIXBundle } from "../../services/stix-parser";
import multer from "multer";
import path from "path";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Get ATLAS statistics
 */
router.get("/stats", async (_req, res) => {
  try {
    const stats = await getATLASStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get ATLAS statistics", details: error?.message });
  }
});

/**
 * Import ATLAS STIX bundle (multipart file upload)
 */
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    // If a file is uploaded, parse it as STIX
    if (req.file) {
      const fileContent = req.file.buffer.toString("utf-8");
      const bundle: STIXBundle = JSON.parse(fileContent);

      if (bundle.type !== "bundle") {
        return res.status(400).json({ error: "Invalid STIX bundle" });
      }

      const stats = await importATLASSTIXBundle(bundle);
      return res.json({ success: true, stats });
    }

    // Fallback: import from local Atlas_Matrix.json (Navigator layer format)
    const filePath = path.join(process.cwd(), "docs/enhancements/2.3/framework/Atlas_Matrix.json");
    const stats = await importATLASMatrix(filePath);
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to import ATLAS data",
      message: error.message,
    });
  }
});

/**
 * Import ATLAS STIX bundle from JSON body
 */
router.post("/import/json", async (req, res) => {
  try {
    const bundle: STIXBundle = req.body;

    if (!bundle || bundle.type !== "bundle") {
      return res.status(400).json({ error: "Invalid STIX bundle" });
    }

    const stats = await importATLASSTIXBundle(bundle);
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to import ATLAS STIX bundle",
      message: error.message,
    });
  }
});

/**
 * List all ATLAS tactics
 */
router.get("/tactics", async (_req, res) => {
  try {
    const tactics = await db.select().from(atlasTactics).orderBy(atlasTactics.sortOrder);
    res.json(tactics);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch ATLAS tactics", details: error?.message });
  }
});

/**
 * Get a specific ATLAS tactic
 */
router.get("/tactics/:id", async (req, res) => {
  try {
    const result = await db.select().from(atlasTactics).where(eq(atlasTactics.id, req.params.id)).limit(1);
    const tactic = result[0];

    if (!tactic) {
      return res.status(404).json({ error: "Tactic not found" });
    }

    res.json(tactic);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get ATLAS tactic", details: error?.message });
  }
});

/**
 * List all ATLAS techniques
 */
router.get("/techniques", async (req, res) => {
  try {
    const { subtechniques, hierarchical, tacticId } = req.query;

    let techniques;

    if (tacticId) {
      techniques = await db.select().from(atlasTechniques).where(eq(atlasTechniques.tacticId, tacticId as string));
    } else if (subtechniques === "only") {
      techniques = await db
        .select()
        .from(atlasTechniques)
        .where(eq(atlasTechniques.isSubtechnique, true))
        .orderBy(atlasTechniques.atlasId);
    } else if (subtechniques === "exclude") {
      techniques = await db
        .select()
        .from(atlasTechniques)
        .where(eq(atlasTechniques.isSubtechnique, false))
        .orderBy(atlasTechniques.atlasId);
    } else {
      techniques = await db.select().from(atlasTechniques).orderBy(atlasTechniques.atlasId);
    }

    // If hierarchical view is requested, group sub-techniques under parent techniques
    if (hierarchical === "true" && subtechniques !== "only") {
      const parentTechniques = techniques.filter((t) => !t.isSubtechnique);

      const hierarchicalTechniques = await Promise.all(
        parentTechniques.map(async (parent) => {
          const subs = await db
            .select()
            .from(atlasTechniques)
            .where(eq(atlasTechniques.parentTechniqueId, parent.id))
            .orderBy(atlasTechniques.atlasId);

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
    res.status(500).json({ error: "Failed to fetch ATLAS techniques", details: error?.message });
  }
});

/**
 * Get a specific ATLAS technique with details
 */
router.get("/techniques/:id", async (req, res) => {
  try {
    const result = await db.select().from(atlasTechniques).where(eq(atlasTechniques.id, req.params.id)).limit(1);
    const technique = result[0];

    if (!technique) {
      return res.status(404).json({ error: "Technique not found" });
    }

    // Get parent technique if this is a sub-technique
    let parent = null;
    if (technique.parentTechniqueId) {
      const parentResult = await db
        .select()
        .from(atlasTechniques)
        .where(eq(atlasTechniques.id, technique.parentTechniqueId))
        .limit(1);
      parent = parentResult[0] || null;
    }

    // Get sub-techniques
    const subtechniques = await db
      .select()
      .from(atlasTechniques)
      .where(eq(atlasTechniques.parentTechniqueId, technique.id))
      .orderBy(atlasTechniques.atlasId);

    // Get case studies
    const caseStudies = await db
      .select()
      .from(atlasCaseStudies)
      .where(eq(atlasCaseStudies.techniqueId, req.params.id));

    res.json({ ...technique, parent, subtechniques, caseStudies });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get ATLAS technique", details: error?.message });
  }
});

/**
 * List all ATLAS mitigations
 */
router.get("/mitigations", async (_req, res) => {
  try {
    const mitigations = await db.select().from(atlasMitigations).orderBy(atlasMitigations.atlasId);
    res.json(mitigations);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch ATLAS mitigations", details: error?.message });
  }
});

/**
 * Get a specific ATLAS mitigation
 */
router.get("/mitigations/:id", async (req, res) => {
  try {
    const result = await db.select().from(atlasMitigations).where(eq(atlasMitigations.id, req.params.id)).limit(1);
    const mitigation = result[0];

    if (!mitigation) {
      return res.status(404).json({ error: "Mitigation not found" });
    }

    res.json(mitigation);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get ATLAS mitigation", details: error?.message });
  }
});

/**
 * List all ATLAS case studies
 */
router.get("/case-studies", async (_req, res) => {
  try {
    const caseStudies = await db.select().from(atlasCaseStudies).orderBy(desc(atlasCaseStudies.createdAt));
    res.json(caseStudies);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch ATLAS case studies", details: error?.message });
  }
});

/**
 * Get a specific ATLAS case study
 */
router.get("/case-studies/:id", async (req, res) => {
  try {
    const result = await db.select().from(atlasCaseStudies).where(eq(atlasCaseStudies.id, req.params.id)).limit(1);
    const caseStudy = result[0];

    if (!caseStudy) {
      return res.status(404).json({ error: "Case study not found" });
    }

    // Get linked technique
    let technique = null;
    if (caseStudy.techniqueId) {
      const techResult = await db
        .select()
        .from(atlasTechniques)
        .where(eq(atlasTechniques.id, caseStudy.techniqueId))
        .limit(1);
      technique = techResult[0] || null;
    }

    res.json({ ...caseStudy, technique });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get ATLAS case study", details: error?.message });
  }
});

/**
 * List ATLAS relationships
 */
router.get("/relationships", async (_req, res) => {
  try {
    const relationships = await db.select().from(atlasRelationships).orderBy(desc(atlasRelationships.createdAt));
    res.json(relationships);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch ATLAS relationships", details: error?.message });
  }
});

/**
 * Get operation ATLAS coverage
 */
router.get("/operations/:operationId/coverage", async (req, res) => {
  try {
    const mappings = await db
      .select()
      .from(operationAtlasMapping)
      .where(eq(operationAtlasMapping.operationId, req.params.operationId));

    // Enrich with technique and tactic data
    const enriched = await Promise.all(
      mappings.map(async (mapping) => {
        const techResult = await db
          .select()
          .from(atlasTechniques)
          .where(eq(atlasTechniques.id, mapping.techniqueId))
          .limit(1);

        let tactic = null;
        if (mapping.tacticId) {
          const tacticResult = await db
            .select()
            .from(atlasTactics)
            .where(eq(atlasTactics.id, mapping.tacticId))
            .limit(1);
          tactic = tacticResult[0] || null;
        }

        return {
          ...mapping,
          technique: techResult[0] || null,
          tactic,
        };
      })
    );

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get ATLAS operation coverage", details: error?.message });
  }
});

/**
 * Map an ATLAS technique to an operation
 */
router.post("/operations/:operationId/techniques/:techniqueId", async (req, res) => {
  try {
    const { tacticId, status, notes } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const existingResult = await db
      .select()
      .from(operationAtlasMapping)
      .where(
        and(
          eq(operationAtlasMapping.operationId, req.params.operationId),
          eq(operationAtlasMapping.techniqueId, req.params.techniqueId)
        )
      )
      .limit(1);

    if (existingResult.length > 0) {
      const [updated] = await db
        .update(operationAtlasMapping)
        .set({
          tacticId: tacticId || existingResult[0].tacticId,
          status: status || existingResult[0].status,
          notes: notes || existingResult[0].notes,
          updatedAt: new Date(),
        })
        .where(eq(operationAtlasMapping.id, existingResult[0].id))
        .returning();

      return res.json(updated);
    }

    const [mapping] = await db
      .insert(operationAtlasMapping)
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
    res.status(500).json({ error: "Failed to map ATLAS technique", details: error?.message });
  }
});

/**
 * Remove an ATLAS technique from an operation
 */
router.delete("/operations/:operationId/techniques/:techniqueId", async (req, res) => {
  try {
    await db
      .delete(operationAtlasMapping)
      .where(
        and(
          eq(operationAtlasMapping.operationId, req.params.operationId),
          eq(operationAtlasMapping.techniqueId, req.params.techniqueId)
        )
      );

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: "Failed to remove ATLAS technique", details: error?.message });
  }
});

export default router;
