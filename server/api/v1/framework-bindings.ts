/**
 * Framework Bindings API (v2.9.1 Phase 4)
 *
 * Endpoints to attach tools/agents/workflows to framework elements
 * (OWASP LLM controls, NIST AI subcategories, CIS safeguards, …) and
 * query bindings either forward (by element) or reverse (by tool/agent).
 *
 * Mounted at /api/v1/frameworks.
 */

import { Router } from "express";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import {
  frameworkBindingService,
  type FrameworkType,
  type BindingKind,
  type BindingStrength,
} from "../../services/frameworks/framework-binding-service";

const router = Router();
router.use(ensureAuthenticated);

const FRAMEWORK_TYPES = new Set<FrameworkType>([
  "owasp_llm",
  "nist_ai",
  "cis_v8",
  "atlas",
  "attck",
]);

const BINDING_KINDS = new Set<BindingKind>(["tool", "agent", "workflow"]);
const BINDING_STRENGTHS = new Set<BindingStrength>([
  "primary",
  "supports",
  "validates",
]);

function isFrameworkType(v: unknown): v is FrameworkType {
  return typeof v === "string" && FRAMEWORK_TYPES.has(v as FrameworkType);
}

function isBindingKind(v: unknown): v is BindingKind {
  return typeof v === "string" && BINDING_KINDS.has(v as BindingKind);
}

function isBindingStrength(v: unknown): v is BindingStrength {
  return typeof v === "string" && BINDING_STRENGTHS.has(v as BindingStrength);
}

// ----------------------------------------------------------------------------
// GET /api/v1/frameworks/:type/:externalId/bindings
// List all bindings for a framework element.
// ----------------------------------------------------------------------------
router.get("/:type/:externalId/bindings", async (req, res) => {
  const { type, externalId } = req.params;
  if (!isFrameworkType(type)) {
    return res.status(400).json({
      error: "Invalid framework type",
      allowed: [...FRAMEWORK_TYPES],
    });
  }
  try {
    const bindings = await frameworkBindingService.listForElement(type, externalId);
    res.json({ bindings });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list bindings", details: error?.message });
  }
});

// ----------------------------------------------------------------------------
// POST /api/v1/frameworks/bindings — create a binding [admin]
// ----------------------------------------------------------------------------
router.post("/bindings", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  const {
    frameworkType,
    frameworkElementExternalId,
    bindingKind,
    targetId,
    strength,
    confidence,
    rationale,
  } = req.body ?? {};

  if (!isFrameworkType(frameworkType)) {
    return res.status(400).json({ error: "Invalid frameworkType" });
  }
  if (!isBindingKind(bindingKind)) {
    return res.status(400).json({ error: "Invalid bindingKind" });
  }
  if (typeof frameworkElementExternalId !== "string" || !frameworkElementExternalId) {
    return res.status(400).json({ error: "frameworkElementExternalId is required" });
  }
  if (typeof targetId !== "string" || !targetId) {
    return res.status(400).json({ error: "targetId is required" });
  }
  if (strength != null && !isBindingStrength(strength)) {
    return res.status(400).json({ error: "Invalid strength" });
  }

  try {
    const binding = await frameworkBindingService.create({
      frameworkType,
      frameworkElementExternalId,
      bindingKind,
      targetId,
      strength,
      confidence: typeof confidence === "number" ? confidence : undefined,
      rationale: typeof rationale === "string" ? rationale : undefined,
      createdBy: user.id,
    });
    await logAudit(
      user.id,
      "create_framework_binding",
      `/frameworks/${frameworkType}/${frameworkElementExternalId}/bindings`,
      binding.id,
      true,
      req,
    );
    res.status(201).json({ binding });
  } catch (error: any) {
    // Unique-violation surfaces as a generic 500 from drizzle/postgres; map to 409.
    const code = error?.code ?? error?.cause?.code;
    if (code === "23505") {
      return res.status(409).json({ error: "Binding already exists" });
    }
    res.status(500).json({ error: "Failed to create binding", details: error?.message });
  }
});

// ----------------------------------------------------------------------------
// DELETE /api/v1/frameworks/bindings/:id — remove a binding [admin]
// ----------------------------------------------------------------------------
router.delete("/bindings/:id", ensureRole("admin"), async (req, res) => {
  const user = req.user as any;
  const { id } = req.params;
  try {
    const removed = await frameworkBindingService.deleteById(id);
    if (!removed) {
      return res.status(404).json({ error: "Binding not found" });
    }
    await logAudit(user.id, "delete_framework_binding", "/frameworks/bindings", id, true, req);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete binding", details: error?.message });
  }
});

export default router;
