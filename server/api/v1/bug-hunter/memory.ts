/**
 * Bug-Hunter memory router (FF_BUG_HUNTER).
 *
 * Direct memory ops — replaces Claude-BugHunter's JSONL `hunt-memory` +
 * `submissions.txt` files. Memories live in the existing `operation`
 * namespace, tagged with `bh:*` so they coexist cleanly with non-bug-
 * hunter operation memory.
 *
 *   POST /remember                  → log a finding, lead, submission, or note
 *   GET  /memory-gc/:operationId    → inspect: per-tag counts + expiring entries
 *   POST /memory-gc/:operationId    → purge memories matching tag(s)
 *   GET  /submissions/:operationId  → reconstruct submissions ledger from memory
 */

import { Router } from "express";
import { z } from "zod";
import { sql, eq, and, desc } from "drizzle-orm";

import { db } from "../../../db";
import { memoryContexts, memoryEntries } from "@shared/schema";
import { ensureAuthenticated, ensureRole } from "../../../auth/middleware";
import { memoryService } from "../../../services/memory-service";

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
// POST /remember
// ---------------------------------------------------------------------------

const rememberKinds = ["finding", "lead", "killed", "submission", "note", "chain"] as const;

const rememberSchema = z.object({
  operationId: z.string().uuid(),
  kind: z.enum(rememberKinds),
  text: z.string().min(1).max(8_000),
  platformUuid: z.string().min(1).max(120).optional(),
  platform: z.enum(["hackerone", "bugcrowd", "intigriti", "immunefi", "redteam", "internal"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low", "informational"]).optional(),
  tags: z.array(z.string().min(1).max(80)).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.post("/remember", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = rememberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  const data = parsed.data;

  try {
    const ctx = await memoryService.createContext({
      contextType: "operation",
      contextId: data.operationId,
      contextName: `Bug-Hunter Operation ${data.operationId}`,
    });

    const tags = new Set<string>(["bug_hunter", `bh:${data.kind}`]);
    if (data.platform) tags.add(`platform:${data.platform}`);
    if (data.platformUuid) tags.add(`bh:uuid:${data.platformUuid}`);
    if (data.severity) tags.add(`severity:${data.severity}`);
    for (const t of data.tags ?? []) tags.add(t);

    const memory = await memoryService.addMemory({
      contextId: ctx.id,
      memoryText: data.text,
      memoryType: data.kind === "finding" || data.kind === "submission" ? "fact" : "event",
      tags: Array.from(tags),
      metadata: {
        kind: data.kind,
        platform: data.platform,
        platformUuid: data.platformUuid,
        severity: data.severity,
        ...data.metadata,
      },
    });

    res.status(201).json({ id: memory.id, contextId: ctx.id, tags: Array.from(tags) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "remember failed" });
  }
});

// ---------------------------------------------------------------------------
// GET /memory-gc/:operationId — inspect
// ---------------------------------------------------------------------------

router.get("/memory-gc/:operationId", ensureRole("admin", "operator"), async (req, res) => {
  const opId = req.params.operationId;

  const [ctx] = await db
    .select()
    .from(memoryContexts)
    .where(and(eq(memoryContexts.contextType, "operation"), eq(memoryContexts.contextId, opId)))
    .limit(1);
  if (!ctx) return res.json({ contextExists: false, totals: 0, tagCounts: [], expiring: [] });

  const totals = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM memory_entries WHERE context_id = ${ctx.id}::uuid
  `);

  const tagCounts = await db.execute<{ tag: string; n: number }>(sql`
    SELECT unnest(tags) AS tag, COUNT(*)::int AS n
      FROM memory_entries
     WHERE context_id = ${ctx.id}::uuid AND tags IS NOT NULL
     GROUP BY tag
     ORDER BY n DESC
     LIMIT 40
  `);

  const expiring = await db.execute<{ id: string; valid_until: string | null; preview: string }>(sql`
    SELECT id::text AS id, valid_until,
           LEFT(memory_text, 160) AS preview
      FROM memory_entries
     WHERE context_id = ${ctx.id}::uuid
       AND valid_until IS NOT NULL
       AND valid_until < NOW() + INTERVAL '7 days'
     ORDER BY valid_until ASC
     LIMIT 20
  `);

  res.json({
    contextExists: true,
    contextId: ctx.id,
    totals: totals[0]?.n ?? 0,
    tagCounts,
    expiring,
  });
});

// ---------------------------------------------------------------------------
// POST /memory-gc/:operationId — purge
// ---------------------------------------------------------------------------

const gcSchema = z.object({
  tags: z.array(z.string().min(1).max(80)).min(1).max(20),
  olderThanDays: z.number().int().min(0).max(365).optional(),
  dryRun: z.boolean().default(false),
});

router.post("/memory-gc/:operationId", ensureRole("admin", "operator"), async (req, res) => {
  const parsed = gcSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  const opId = req.params.operationId;
  const data = parsed.data;

  const [ctx] = await db
    .select()
    .from(memoryContexts)
    .where(and(eq(memoryContexts.contextType, "operation"), eq(memoryContexts.contextId, opId)))
    .limit(1);
  if (!ctx) return res.status(404).json({ error: "memory context not found" });

  const olderClause = data.olderThanDays !== undefined
    ? sql`AND created_at < NOW() - (${data.olderThanDays} || ' days')::interval`
    : sql``;

  const candidates = await db.execute<{ id: string }>(sql`
    SELECT id::text AS id
      FROM memory_entries
     WHERE context_id = ${ctx.id}::uuid
       AND tags @> ${data.tags}::text[]
       ${olderClause}
  `);

  if (data.dryRun) {
    return res.json({ dryRun: true, candidateCount: candidates.length, tags: data.tags });
  }

  let deleted = 0;
  for (const row of candidates) {
    await db.execute(sql`DELETE FROM memory_entries WHERE id = ${row.id}::uuid`);
    deleted++;
  }
  res.json({ dryRun: false, deleted, tags: data.tags });
});

// ---------------------------------------------------------------------------
// GET /submissions/:operationId — reconstruct submissions ledger
// ---------------------------------------------------------------------------

router.get("/submissions/:operationId", ensureRole("admin", "operator"), async (req, res) => {
  const opId = req.params.operationId;
  const [ctx] = await db
    .select()
    .from(memoryContexts)
    .where(and(eq(memoryContexts.contextType, "operation"), eq(memoryContexts.contextId, opId)))
    .limit(1);
  if (!ctx) return res.json({ count: 0, submissions: [] });

  const rows = await db
    .select()
    .from(memoryEntries)
    .where(
      and(
        eq(memoryEntries.contextId, ctx.id),
        sql`tags @> ARRAY['bh:submission']::text[]`,
      ),
    )
    .orderBy(desc(memoryEntries.createdAt))
    .limit(200);

  res.json({
    count: rows.length,
    submissions: rows.map((r) => {
      const meta = (r.metadata as Record<string, unknown> | null) ?? {};
      return {
        id: r.id,
        text: r.memoryText,
        platform: meta.platform,
        platformUuid: meta.platformUuid,
        severity: meta.severity,
        createdAt: r.createdAt,
      };
    }),
  });
});

export default router;
