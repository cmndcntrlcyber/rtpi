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

    // Group by framework type
    const grouped = coverage.reduce((acc, item) => {
      if (!acc[item.frameworkType]) {
        acc[item.frameworkType] = [];
      }
      acc[item.frameworkType].push(item);
      return acc;
    }, {} as Record<string, typeof coverage>);

    res.json(grouped);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch coverage" });
  }
});

/**
 * Update operation coverage
 */
router.post("/coverage", async (req, res) => {
  try {
    const coverage = await db.insert(operationFrameworkCoverage).values(req.body).returning();
    res.json(coverage[0]);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update coverage", message: error.message });
  }
});

export default router;
