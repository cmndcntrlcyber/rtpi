import { Router } from "express";
import { db } from "../../db";
import { nistAiFunctions, nistAiCategories, nistAiSubcategories } from "@shared/schema";
import { eq } from "drizzle-orm";
import { importNISTAIRMF, getNISTAIStats } from "../../services/nist-ai-rmf-parser";

const router = Router();

/**
 * Get NIST AI RMF statistics
 */
router.get("/stats", async (_req, res) => {
  try {
    const stats = await getNISTAIStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get NIST AI statistics", details: error?.message });
  }
});

/**
 * Import NIST AI RMF
 */
router.post("/import", async (_req, res) => {
  try {
    const stats = await importNISTAIRMF();

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to import NIST AI RMF",
      message: error.message,
    });
  }
});

/**
 * List all NIST AI functions
 */
router.get("/functions", async (_req, res) => {
  try {
    const functions = await db.select().from(nistAiFunctions).orderBy(nistAiFunctions.sortOrder);
    res.json(functions);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch functions" });
  }
});

/**
 * Get function with categories and subcategories
 */
router.get("/functions/:id", async (req, res) => {
  try {
    const funcResult = await db.select().from(nistAiFunctions).where(eq(nistAiFunctions.id, req.params.id));
    const func = funcResult[0];

    if (!func) {
      return res.status(404).json({ error: "Function not found" });
    }

    const categories = await db.select().from(nistAiCategories).where(eq(nistAiCategories.functionId, req.params.id));

    const categoriesWithSubcategories = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await db.select().from(nistAiSubcategories).where(eq(nistAiSubcategories.categoryId, category.id));
        return { ...category, subcategories };
      })
    );

    res.json({ ...func, categories: categoriesWithSubcategories });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch function" });
  }
});

export default router;
