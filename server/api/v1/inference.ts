/**
 * Inference Provider API (v2.9.1 Phase 6)
 *
 * Mounted at /api/v1/inference. Backs the AIProviderSettings UI and the
 * /agents settings panel. Read endpoints are open to any authenticated
 * user; write endpoints require admin.
 */

import { Router } from "express";
import { ensureAuthenticated, ensureRole, logAudit } from "../../auth/middleware";
import {
  inferenceProviderRegistry,
  type ProviderId,
} from "../../services/inference/inference-provider-registry";
import { createLogger } from '../../lib/logger';
const log = createLogger("inference");

const router = Router();
router.use(ensureAuthenticated);

const VALID_IDS: ProviderId[] = ["vllm", "ollama", "openai", "anthropic"];
function isProviderId(v: unknown): v is ProviderId {
  return typeof v === "string" && (VALID_IDS as string[]).includes(v);
}

// GET /api/v1/inference/providers
// List registered providers + capabilities + most recent probe (if any).
// Query ?probe=true forces a fresh probe of every provider before returning.
router.get("/providers", async (req, res) => {
  try {
    if (req.query.probe === "true") {
      await inferenceProviderRegistry.probeAll();
    }
    const providers = inferenceProviderRegistry.list();
    const defaultProvider = inferenceProviderRegistry.resolveDefault().id;
    res.json({ providers, default: defaultProvider });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list providers", details: error?.message });
  }
});

// POST /api/v1/inference/providers/:id/probe
// Force a fresh round-trip probe and return the result.
router.post("/providers/:id/probe", async (req, res) => {
  const { id } = req.params;
  if (!isProviderId(id)) {
    return res.status(400).json({ error: "Unknown provider", allowed: VALID_IDS });
  }
  try {
    const result = await inferenceProviderRegistry.probe(id);
    res.json({ id, probe: result });
  } catch (error: any) {
    res.status(500).json({ error: "Probe failed", details: error?.message });
  }
});

// PATCH /api/v1/inference/providers/:id  [admin]
// Update endpoint / default model for a provider. Persists to .env via the
// settings router's helpers, so the value survives restart.
router.patch("/providers/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  if (!isProviderId(id)) {
    return res.status(400).json({ error: "Unknown provider", allowed: VALID_IDS });
  }
  const user = req.user as any;
  const { endpoint, defaultModel } = req.body ?? {};

  // Only the local providers (vllm, ollama) accept endpoint/model overrides
  // through this endpoint. OpenAI/Anthropic configuration goes through the
  // dedicated key-management surface in /api/v1/settings/llm.
  const updates: Record<string, string> = {};
  if (id === "vllm") {
    if (typeof endpoint === "string") updates.VLLM_BASE_URL = endpoint.replace(/\/+$/, "");
    if (typeof defaultModel === "string") updates.VLLM_MODEL = defaultModel;
  } else if (id === "ollama") {
    if (typeof endpoint === "string") updates.OLLAMA_HOST = endpoint.replace(/\/+$/, "");
  } else {
    return res.status(400).json({
      error: "This provider does not accept endpoint/model overrides via /inference. Use /settings/llm.",
    });
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No supported fields supplied" });
  }

  // Apply to live process.env so a probe right after PATCH sees the change.
  for (const [k, v] of Object.entries(updates)) {
    process.env[k] = v;
  }

  // Persist to .env using fs (same pattern the settings router uses).
  try {
    const fs = await import("fs");
    const path = await import("path");
    const envPath = path.resolve(process.cwd(), ".env");
    let content = "";
    try {
      content = fs.readFileSync(envPath, "utf-8");
    } catch {
      // missing .env — will create
    }
    for (const [k, v] of Object.entries(updates)) {
      const re = new RegExp(`^${k}=.*$`, "m");
      if (re.test(content)) content = content.replace(re, `${k}=${v}`);
      else content += `\n${k}=${v}`;
    }
    fs.writeFileSync(envPath, content, "utf-8");
  } catch (err: any) {
    log.warn("[inference] Failed to persist .env updates:", err?.message);
  }

  await logAudit(user.id, "patch_inference_provider", `/inference/providers/${id}`, id, true, req);

  // Return a fresh probe so the UI sees the new state immediately.
  const probe = await inferenceProviderRegistry.probe(id);
  res.json({ id, updates, probe });
});

export default router;
