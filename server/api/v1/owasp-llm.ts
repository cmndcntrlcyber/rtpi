import { Router } from "express";
import { db } from "../../db";
import { owaspLlmVulnerabilities, owaspLlmAttackVectors, owaspLlmMitigations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { importOWASPLLMTop10, getOWASPLLMStats } from "../../services/owasp-llm-parser";

const router = Router();

/**
 * Get OWASP LLM statistics
 */
router.get("/stats", async (_req, res) => {
  try {
    const stats = await getOWASPLLMStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get OWASP LLM statistics", details: error?.message });
  }
});

/**
 * Import OWASP LLM Top 10
 */
router.post("/import", async (_req, res) => {
  try {
    const count = await importOWASPLLMTop10();

    res.json({
      success: true,
      count,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to import OWASP LLM Top 10",
      message: error.message,
    });
  }
});

/**
 * List all OWASP LLM vulnerabilities
 */
router.get("/vulnerabilities", async (_req, res) => {
  try {
    const vulnerabilities = await db.select().from(owaspLlmVulnerabilities);
    res.json(vulnerabilities);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch vulnerabilities" });
  }
});

/**
 * Get single vulnerability with details
 */
router.get("/vulnerabilities/:id", async (req, res) => {
  try {
    const vulnerabilityResult = await db.select().from(owaspLlmVulnerabilities).where(eq(owaspLlmVulnerabilities.id, req.params.id));
    const vulnerability = vulnerabilityResult[0];

    if (!vulnerability) {
      return res.status(404).json({ error: "Vulnerability not found" });
    }

    const attackVectors = await db.select().from(owaspLlmAttackVectors).where(eq(owaspLlmAttackVectors.vulnerabilityId, req.params.id));
    const mitigations = await db.select().from(owaspLlmMitigations).where(eq(owaspLlmMitigations.vulnerabilityId, req.params.id));

    res.json({ ...vulnerability, attackVectors, mitigations });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch vulnerability" });
  }
});

export default router;
