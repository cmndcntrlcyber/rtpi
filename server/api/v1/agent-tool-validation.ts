import { Router } from "express";
import {
  validateAgentToolAssignment,
  suggestAlternativeTools,
  batchValidateAssignments,
} from "../../services/agent-tool-validator";
import { z } from "zod";

const router = Router();

/**
 * Validate a single agent-tool assignment
 */
router.post("/validate", async (req, res) => {
  try {
    const schema = z.object({
      agentId: z.string().uuid(),
      toolId: z.string().uuid(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
    }

    const { agentId, toolId } = parsed.data;

    const result = await validateAgentToolAssignment(agentId, toolId);

    res.json(result);
  } catch (error: any) {
    console.error("Failed to validate agent-tool assignment:", error);
    res.status(500).json({
      error: "Failed to validate assignment",
      details: error?.message || "Internal server error",
    });
  }
});

/**
 * Batch validate multiple agent-tool assignments
 */
router.post("/validate/batch", async (req, res) => {
  try {
    const schema = z.object({
      assignments: z.array(
        z.object({
          agentId: z.string().uuid(),
          toolId: z.string().uuid(),
        })
      ),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
    }

    const { assignments } = parsed.data;

    const results = await batchValidateAssignments(assignments);

    res.json({ results });
  } catch (error: any) {
    console.error("Failed to batch validate assignments:", error);
    res.status(500).json({
      error: "Failed to batch validate",
      details: error?.message || "Internal server error",
    });
  }
});

/**
 * Get alternative tool suggestions for an agent
 */
router.get("/alternatives/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const { category } = req.query;

    const alternatives = await suggestAlternativeTools(
      agentId,
      category as string
    );

    res.json({ alternatives });
  } catch (error: any) {
    console.error("Failed to get alternative tools:", error);
    res.status(500).json({
      error: "Failed to get alternatives",
      details: error?.message || "Internal server error",
    });
  }
});

export default router;
