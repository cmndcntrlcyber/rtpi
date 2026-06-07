/**
 * Bug-Hunter read-only query endpoints (FF_BUG_HUNTER).
 *
 * These collapse the slash commands that don't need an agent run — they
 * just read DB state or hit Tavily for fresh intel. Kept in a separate
 * router from workflows.ts so a misbehaving agent path can't take down
 * cheap reads.
 *
 *   GET  /scope/:operationId      → parsed scope_rules from operations.metadata
 *   GET  /surface/:operationId    → ranked attack surface (assets + services)
 *   POST /intel                   → CVE / disclosure lookup via Tavily
 *   GET  /pickup/:operationId     → resume summary: phase progress, findings,
 *                                    most recent workflows, memory tags
 */

import { Router } from "express";
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";

import { db } from "../../../db";
import {
  operations,
  vulnerabilities,
  discoveredAssets,
  discoveredServices,
  agentWorkflows,
  workflowTasks,
} from "@shared/schema";
import { ensureAuthenticated, ensureRole } from "../../../auth/middleware";
import { memoryService } from "../../../services/memory-service";
import { loadEngagementMeta } from "../../../services/bug-hunter/engagement-scaffolder";

const router = Router();

router.use(ensureAuthenticated);

function flagEnabled(): boolean {
  const v = (process.env.FF_BUG_HUNTER ?? "").toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}
router.use((_req, res, next) => {
  if (!flagEnabled()) return res.status(404).json({ error: "FF_BUG_HUNTER disabled" });
  next();
});

// ---------------------------------------------------------------------------
// GET /scope/:operationId
// ---------------------------------------------------------------------------

router.get("/scope/:operationId", ensureRole("admin", "operator"), async (req, res) => {
  const opId = req.params.operationId;
  const [op] = await db.select().from(operations).where(eq(operations.id, opId)).limit(1);
  if (!op) return res.status(404).json({ error: "operation not found" });
  const meta = await loadEngagementMeta(opId);
  if (!meta) {
    return res.status(409).json({ error: "operation is not a bug-hunter engagement (run /scope to populate)" });
  }
  res.json({
    operationId: opId,
    name: op.name,
    rawScope: op.scope,
    mode: meta.mode,
    box: meta.box,
    platform: meta.platform,
    scopeRules: meta.scopeRules,
    acceptedImpacts: meta.acceptedImpacts,
  });
});

// ---------------------------------------------------------------------------
// GET /surface/:operationId — ranked attack surface
// ---------------------------------------------------------------------------

interface RankedAsset {
  id: string;
  type: string;
  value: string;
  score: number;
  reasons: string[];
}

router.get("/surface/:operationId", ensureRole("admin", "operator"), async (req, res) => {
  const opId = req.params.operationId;
  const assets = await db
    .select()
    .from(discoveredAssets)
    .where(eq(discoveredAssets.operationId, opId));
  const assetIdSet = new Set(assets.map((a) => a.id));
  const allServices = assetIdSet.size > 0 ? await db.select().from(discoveredServices) : [];
  const services = allServices.filter((s) => assetIdSet.has(s.assetId));

  // Build a tech/service map by host so the ranker can credit interesting
  // surface (auth endpoints, admin paths, API gateways, etc.). Technology
  // assets don't carry an explicit parent host link in the schema, so we
  // fall back to `hostname` when present and otherwise pin them to the
  // asset's own value.
  const techByHost = new Map<string, string[]>();
  for (const a of assets) {
    if (a.type !== "technology") continue;
    const host = a.hostname ?? a.value;
    if (!host) continue;
    if (!techByHost.has(host)) techByHost.set(host, []);
    techByHost.get(host)!.push(a.value);
  }

  const ranked: RankedAsset[] = [];
  for (const a of assets) {
    if (a.type !== "host" && a.type !== "domain" && a.type !== "url") continue;
    let score = 0;
    const reasons: string[] = [];
    const v = a.value.toLowerCase();
    if (/api|graphql|grpc/.test(v)) { score += 30; reasons.push("api surface"); }
    if (/admin|internal|staging|dev/.test(v)) { score += 35; reasons.push("admin/internal naming"); }
    if (/auth|login|sso|oauth|saml/.test(v)) { score += 35; reasons.push("auth surface"); }
    if (/upload|file|image/.test(v)) { score += 20; reasons.push("file-handling surface"); }
    if (/redirect|forward|proxy/.test(v)) { score += 15; reasons.push("redirect/proxy"); }
    if (a.type === "url") { score += 10; reasons.push("crawled url"); }
    const tech = techByHost.get(a.value) ?? [];
    if (tech.length > 0) { score += tech.length * 5; reasons.push(`${tech.length} tech(s) detected`); }
    if (score === 0) score = 1; // keep everything but at the bottom
    ranked.push({ id: a.id, type: a.type, value: a.value, score, reasons });
  }
  ranked.sort((a, b) => b.score - a.score);

  res.json({
    operationId: opId,
    counts: {
      assets: assets.length,
      services: services.length,
    },
    top: ranked.slice(0, 50),
    bottom: ranked.slice(-10).reverse(),
    techByHostSample: Array.from(techByHost.entries()).slice(0, 20).map(([host, techs]) => ({ host, techs })),
  });
});

// ---------------------------------------------------------------------------
// POST /intel — fresh CVE / disclosure intel via Tavily
// ---------------------------------------------------------------------------

const intelSchema = z.object({
  query: z.string().min(2).max(500),
  topic: z.enum(["cve", "disclosure", "vendor", "general"]).default("general"),
  maxResults: z.number().int().min(1).max(10).optional(),
});

interface TavilyHit {
  title: string;
  url: string;
  content: string;
  score?: number;
}

router.post("/intel", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = intelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });

  const apiKey = (process.env.TAVILY_API_KEY ?? "").trim();
  if (!apiKey || apiKey.toLowerCase().startsWith("your-")) {
    return res.status(503).json({ error: "TAVILY_API_KEY not configured" });
  }

  const qPrefix = parsed.data.topic === "cve"
    ? "CVE OR vulnerability disclosed "
    : parsed.data.topic === "disclosure"
      ? "hackerone OR bugcrowd public report "
      : parsed.data.topic === "vendor"
        ? "security advisory vendor "
        : "";

  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${qPrefix}${parsed.data.query}`,
        search_depth: "advanced",
        max_results: parsed.data.maxResults ?? 6,
        include_answer: false,
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return res.status(502).json({ error: `tavily ${r.status}`, body });
    }
    const json = (await r.json()) as { results?: TavilyHit[]; answer?: string };
    res.json({
      query: parsed.data.query,
      topic: parsed.data.topic,
      count: json.results?.length ?? 0,
      results: (json.results ?? []).map((h) => ({
        title: h.title,
        url: h.url,
        snippet: (h.content ?? "").slice(0, 600),
        score: h.score,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "intel failed" });
  }
});

// ---------------------------------------------------------------------------
// GET /pickup/:operationId — resume engagement
// ---------------------------------------------------------------------------

router.get("/pickup/:operationId", ensureRole("admin", "operator"), async (req, res) => {
  const opId = req.params.operationId;

  const [op] = await db.select().from(operations).where(eq(operations.id, opId)).limit(1);
  if (!op) return res.status(404).json({ error: "operation not found" });
  const meta = await loadEngagementMeta(opId);

  // Latest 5 bug-hunter workflows for this operation.
  const workflows = await db
    .select()
    .from(agentWorkflows)
    .where(eq(agentWorkflows.operationId, opId))
    .orderBy(desc(agentWorkflows.createdAt))
    .limit(5);

  // Per-workflow task progress.
  const tasksByWorkflow: Record<string, Array<{ taskType: string; status: string; sequenceOrder: number }>> = {};
  for (const wf of workflows) {
    const tasks = await db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.workflowId, wf.id));
    tasksByWorkflow[wf.id] = tasks
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      .map((t) => ({ taskType: t.taskType, status: t.status, sequenceOrder: t.sequenceOrder }));
  }

  // Finding rollup with gate verdicts.
  const vulns = await db.select().from(vulnerabilities).where(eq(vulnerabilities.operationId, opId));
  type GateVerdict = "PASS" | "DOWNGRADE" | "CHAIN_REQUIRED" | "KILL";
  const findingsByVerdict: Record<GateVerdict | "ungated", number> = {
    PASS: 0,
    DOWNGRADE: 0,
    CHAIN_REQUIRED: 0,
    KILL: 0,
    ungated: 0,
  };
  for (const v of vulns) {
    const m = (v.metadata as Record<string, unknown> | undefined) ?? {};
    const gate = m.bugHunterGate as { verdict?: string } | undefined;
    if (!gate?.verdict) findingsByVerdict.ungated++;
    else findingsByVerdict[gate.verdict as GateVerdict] = (findingsByVerdict[gate.verdict as GateVerdict] ?? 0) + 1;
  }

  // Memory tag rollup — gives a sense of what the operator has logged.
  const memRows = await db.execute<{ tag: string; n: number }>(sql`
    SELECT unnest(m.tags) AS tag, COUNT(*)::int AS n
      FROM memory_entries m
      JOIN memory_contexts c ON c.id = m.context_id
     WHERE c.context_type = 'operation' AND c.context_id = ${opId}
       AND m.tags IS NOT NULL
     GROUP BY tag
     ORDER BY n DESC
     LIMIT 25
  `);

  // Suggested next step: smallest phase index without a completed task across
  // the latest 5 workflows.
  const phaseOrder = ["scope", "recon", "hunt", "chain", "validate", "capture", "report"];
  const completedPhases = new Set<string>();
  for (const tasks of Object.values(tasksByWorkflow)) {
    for (const t of tasks) {
      if (t.status === "completed" && t.taskType.startsWith("bug_hunter_")) {
        completedPhases.add(t.taskType.slice("bug_hunter_".length));
      }
    }
  }
  const nextPhase = phaseOrder.find((p) => !completedPhases.has(p)) ?? "report";

  res.json({
    operationId: opId,
    name: op.name,
    status: op.status,
    bugHunter: meta !== null,
    meta,
    workflows: workflows.map((w) => ({
      id: w.id,
      name: w.name,
      status: w.status,
      createdAt: w.createdAt,
      tasks: tasksByWorkflow[w.id] ?? [],
    })),
    findingCounts: {
      total: vulns.length,
      ...findingsByVerdict,
    },
    memoryTagRollup: memRows,
    suggestedNextPhase: nextPhase,
  });
});

// Lightweight ping for "is bug-hunter alive" checks.
router.get("/ping", async (_req, res) => {
  let memoryService_alive = true;
  try {
    await memoryService.getContext("ping-noop"); // tolerant call
  } catch {
    memoryService_alive = false;
  }
  res.json({ ok: true, ff: true, memoryService: memoryService_alive });
});

export default router;
