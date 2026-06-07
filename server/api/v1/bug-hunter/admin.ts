/**
 * Bug-Hunter admin / introspection endpoints (FF_BUG_HUNTER).
 *
 * - POST /admin/skills/reimport — re-runs the skill importer in the
 *   background (idempotent; safe to invoke repeatedly).
 * - POST /admin/retrieve — RAG sanity check; given a query + optional
 *   tag filters, returns the top-K matching skill chunks.
 * - GET  /admin/skills/stats — quick counts (rows, embedded rows, phases).
 *
 * All endpoints require an authenticated admin/operator. The route is only
 * mounted in server/index.ts when FF_BUG_HUNTER is enabled, so the guard
 * here is a belt-and-suspenders cheap check on a misconfigured flag.
 */

import { Router } from "express";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../../db";
import { ensureAuthenticated, ensureRole } from "../../../auth/middleware";
import {
  retrieveBugHunterSkills,
  type BugHunterPhase,
} from "../../../services/knowledge/bug-hunter-skill-retriever";

const router = Router();

router.use(ensureAuthenticated);

function flagEnabled(): boolean {
  const v = (process.env.FF_BUG_HUNTER ?? "").toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

router.use((req, res, next) => {
  if (!flagEnabled()) {
    return res.status(404).json({ error: "FF_BUG_HUNTER disabled" });
  }
  next();
});

// ---------------------------------------------------------------------------
// POST /admin/skills/reimport — fire-and-forget background ingest.
// ---------------------------------------------------------------------------

let lastReimport: {
  startedAt: string;
  pid?: number;
  status: "running" | "completed" | "failed";
  finishedAt?: string;
  exitCode?: number | null;
  error?: string;
} | null = null;

router.post("/skills/reimport", ensureRole("admin", "operator"), async (req, res) => {
  if (lastReimport?.status === "running") {
    return res.status(409).json({
      error: "reimport already running",
      since: lastReimport.startedAt,
      pid: lastReimport.pid,
    });
  }

  const force = req.body?.force === true;
  const scriptPath = join(process.cwd(), "scripts", "import-bug-hunter-skills.ts");
  const args = ["tsx", scriptPath];
  if (force) args.push("--force");

  const child = spawn("npx", args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  lastReimport = {
    startedAt: new Date().toISOString(),
    pid: child.pid,
    status: "running",
  };

  let stderr = "";
  child.stderr?.on("data", (d) => {
    stderr += d.toString();
  });

  child.on("error", (err) => {
    if (!lastReimport) return;
    lastReimport.status = "failed";
    lastReimport.finishedAt = new Date().toISOString();
    lastReimport.error = err.message;
  });

  child.on("exit", (code) => {
    if (!lastReimport) return;
    lastReimport.status = code === 0 ? "completed" : "failed";
    lastReimport.finishedAt = new Date().toISOString();
    lastReimport.exitCode = code;
    if (code !== 0 && stderr) lastReimport.error = stderr.slice(-2000);
  });

  res.status(202).json({ accepted: true, pid: child.pid, startedAt: lastReimport.startedAt, force });
});

router.get("/skills/reimport", ensureRole("admin", "operator"), (_req, res) => {
  res.json({ lastReimport });
});

// ---------------------------------------------------------------------------
// POST /admin/retrieve — RAG sanity check.
// ---------------------------------------------------------------------------

const retrieveSchema = z.object({
  query: z.string().min(1).max(4000),
  phase: z
    .enum(["scope", "recon", "hunt", "chain", "validate", "capture", "report"])
    .optional(),
  mode: z.enum(["redteam", "wapt"]).optional(),
  vuln: z.string().optional(),
  platform: z.string().optional(),
  discipline: z.string().optional(),
  extraTags: z.array(z.string()).optional(),
  includeMeta: z.boolean().optional(),
  topK: z.number().int().min(1).max(50).optional(),
});

router.post("/retrieve", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = retrieveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  }
  try {
    const skills = await retrieveBugHunterSkills({
      ...parsed.data,
      phase: parsed.data.phase as BugHunterPhase | undefined,
    });
    res.json({
      count: skills.length,
      source: skills[0]?.source ?? "none",
      skills: skills.map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        tags: s.tags,
        similarity: s.similarity,
        source: s.source,
        // Trim content for the RAG-sanity response — the agents read full
        // content directly from the helper, not via this route.
        preview: s.content.slice(0, 800),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "retrieve failed" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/skills/stats
// ---------------------------------------------------------------------------

router.get("/skills/stats", ensureRole("admin", "operator"), async (_req, res) => {
  try {
    const totals = await db.execute<{ total: number; embedded: number }>(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(embedding)::int AS embedded
        FROM knowledge_base
       WHERE category = 'bug_hunter_skill'
    `);

    const phases = await db.execute<{ phase: string; n: number }>(sql`
      SELECT unnest(tags) AS phase,
             COUNT(*)::int AS n
        FROM knowledge_base
       WHERE category = 'bug_hunter_skill'
         AND tags IS NOT NULL
       GROUP BY phase
       HAVING unnest(tags) LIKE 'phase:%'
       ORDER BY n DESC
    `);

    res.json({
      total: totals[0]?.total ?? 0,
      embedded: totals[0]?.embedded ?? 0,
      phaseCounts: phases.map((p) => ({ tag: p.phase, count: p.n })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "stats failed" });
  }
});

export default router;
