import { Router } from "express";
import { db } from "../../db";
import { frameworkMappings, operationFrameworkCoverage } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";

const router = Router();

/**
 * Get mappings for a framework element
 */
router.get("/:framework/:elementId", async (req, res) => {
  try {
    const { framework, elementId } = req.params;

    const mappings = await db.select().from(frameworkMappings).where(
      or(
        and(
          eq(frameworkMappings.sourceFramework, framework.toUpperCase()),
          eq(frameworkMappings.sourceId, elementId)
        ),
        and(
          eq(frameworkMappings.targetFramework, framework.toUpperCase()),
          eq(frameworkMappings.targetId, elementId)
        )
      )
    );

    res.json(mappings);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});

/**
 * Create framework mapping
 */
router.post("/", async (req, res) => {
  try {
    const mapping = await db.insert(frameworkMappings).values(req.body).returning();
    res.json(mapping[0]);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create mapping", message: error.message });
  }
});

/**
 * Get operation framework coverage
 */
router.get("/coverage/:operationId", async (req, res) => {
  try {
    const coverage = await db.select().from(operationFrameworkCoverage).where(eq(operationFrameworkCoverage.operationId, req.params.operationId));
    res.json(coverage);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch coverage" });
  }
});

/**
 * Create operation coverage
 */
router.post("/coverage", async (req, res) => {
  try {
    const coverage = await db.insert(operationFrameworkCoverage).values(req.body).returning();
    res.json(coverage[0]);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create coverage", message: error.message });
  }
});

/**
 * Update existing operation coverage entry
 */
router.put("/coverage/:id", async (req, res) => {
  try {
    const { coverageStatus, notes, testResults } = req.body;
    const updates: Record<string, any> = {};
    if (coverageStatus !== undefined) updates.coverageStatus = coverageStatus;
    if (notes !== undefined) updates.notes = notes;
    if (testResults !== undefined) updates.testResults = testResults;

    const result = await db.update(operationFrameworkCoverage)
      .set(updates)
      .where(eq(operationFrameworkCoverage.id, req.params.id))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: "Coverage entry not found" });
    }
    res.json(result[0]);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update coverage", message: error.message });
  }
});

export default router;
