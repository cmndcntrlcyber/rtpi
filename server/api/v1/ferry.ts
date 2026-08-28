/**
 * Ferry Proxy API — v3.10.3a Sprint 2.4
 *
 * Exposes ferry gateway data to the RTPI frontend via authenticated
 * Express endpoints. Proxies to ferryClient methods that call
 * rust-nexus port 9100.
 */

import { Router } from "express";
import { ensureAuthenticated } from "../../auth/middleware";
import { ferryClient } from "../../services/ferry-client";
import { readFeatureFlags } from "@shared/feature-flags";
import { db } from "../../db";
import { ferryApprovalAudit } from "@shared/schema";
import { desc } from "drizzle-orm";

const router = Router();
router.use(ensureAuthenticated);

router.get("/health", async (_req, res) => {
  if (!readFeatureFlags(process.env).ferryBridge) {
    return res.json({ status: "disabled", message: "FF_FERRY_BRIDGE is false" });
  }
  try {
    res.json(await ferryClient.checkHealth());
  } catch (e) {
    res.status(502).json({ status: "unreachable", error: (e as Error).message });
  }
});

router.get("/agents", async (_req, res) => {
  if (!readFeatureFlags(process.env).ferryBridge) {
    return res.json({ agents: [] });
  }
  try {
    res.json(await ferryClient.listAgents());
  } catch (e) {
    res.status(502).json({ error: "Ferry unreachable", agents: [] });
  }
});

router.get("/anomaly", async (_req, res) => {
  if (!readFeatureFlags(process.env).ferryBridge) {
    return res.json({ barometer: 0, agent_attributions: {}, throttling_active: false });
  }
  try {
    res.json(await ferryClient.queryAnomaly());
  } catch (e) {
    res.status(502).json({ error: "Ferry unreachable" });
  }
});

router.post("/rate-adjust", async (req, res) => {
  if (!readFeatureFlags(process.env).ferryBridge) {
    return res.status(400).json({ error: "FF_FERRY_BRIDGE is false" });
  }
  try {
    res.json(await ferryClient.adjustRate(req.body.agent_id));
  } catch (e) {
    res.status(502).json({ error: "Ferry unreachable" });
  }
});

router.get("/approvals", async (_req, res) => {
  try {
    const approvals = await db
      .select()
      .from(ferryApprovalAudit)
      .orderBy(desc(ferryApprovalAudit.requestedAt))
      .limit(100);
    res.json({ approvals });
  } catch (e) {
    res.status(500).json({ error: "Failed to query approval audit trail" });
  }
});

export default router;
