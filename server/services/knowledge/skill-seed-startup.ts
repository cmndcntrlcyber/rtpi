/**
 * Bug-Hunter Skill Seed — startup hook (FF_BUG_HUNTER)
 *
 * Auto-ingests the 53-skill bug-hunter corpus into knowledge_base on server
 * start so the corpus is usable out of the box instead of requiring an operator
 * to remember `npm run bug-hunter:import-skills` (B10). Mirrors the
 * MCPServerManager default-catalog sync pattern: feature-flag gated, delayed to
 * let the DB pool connect, and idempotent so reboots are cheap and safe.
 *
 * Idempotency is two-layered:
 *   1. Count gate (here): if knowledge_base already holds any
 *      `category='bug_hunter_skill'` rows, skip entirely — we don't re-walk 53
 *      files and re-hash them on every boot. This is the common steady state.
 *   2. Content-hash gate (in importBugHunterSkills): even when the count gate
 *      passes, each chunk is upserted by hash, so a partial prior import is
 *      completed rather than duplicated.
 *
 * Never throws into the startup path — a seeding failure logs and is swallowed
 * so the API still comes up (RAG simply falls back to whatever is already
 * present, or to full-text once rows land on a later boot).
 */

import { sql } from "drizzle-orm";
import { db } from "../../db";
import { readFeatureFlags } from "@shared/feature-flags";
import { importBugHunterSkills } from "../../../scripts/import-bug-hunter-skills";
import { createLogger } from '../../lib/logger';
const log = createLogger("skill-seed-startup");

/** Delay before seeding so the DB pool is connected. Matches the 5s used by
 *  MCPServerManager.recoverErroredServers — seeding is heavier than the catalog
 *  sync, so we give the rest of startup room first. */
const SEED_DELAY_MS = 5000;

async function countExistingSkillRows(): Promise<number> {
  const rows = await db.execute<{ total: number }>(sql`
    SELECT COUNT(*)::int AS total
      FROM knowledge_base
     WHERE category = 'bug_hunter_skill'
  `);
  const list = (rows as any).rows ?? rows;
  return list[0]?.total ?? 0;
}

/**
 * Schedule the one-shot seed. Returns immediately; the actual import runs
 * detached after SEED_DELAY_MS so it never blocks server boot. Safe to call
 * unconditionally — it self-gates on FF_BUG_HUNTER.
 */
export function scheduleBugHunterSkillSeed(): void {
  if (!readFeatureFlags(process.env).bugHunter) return;

  setTimeout(() => {
    void seedBugHunterSkills();
  }, SEED_DELAY_MS);
}

/**
 * Run the seed now (exposed for tests / manual invocation). Flag-gated and
 * count-gated; logs its decision either way.
 */
export async function seedBugHunterSkills(): Promise<void> {
  if (!readFeatureFlags(process.env).bugHunter) {
    return;
  }

  try {
    const existing = await countExistingSkillRows();
    if (existing > 0) {
      log.info(
        `[skill-seed] knowledge_base already has ${existing} bug_hunter_skill rows — skipping auto-import.`,
      );
      return;
    }

    log.info("[skill-seed] no bug_hunter_skill rows found — importing corpus…");
    const stats = await importBugHunterSkills({
      force: false,
      // Drop the per-skill progress lines; keep the summary the importer logs.
      log: (msg) => {
        if (msg.startsWith("  ") && !msg.includes(":")) return;
        log.info(msg);
      },
    });
    log.info(
      `[skill-seed] import complete: ${stats.rowsInserted} rows inserted, ` +
        `${stats.rowsSkipped} unchanged, ${stats.embedBatchesOk} embed batches ok` +
        (stats.dimMismatch ? " (embeddings skipped — dimension mismatch; FTS fallback active)" : ""),
    );
  } catch (err) {
    log.error("[skill-seed] auto-import failed (non-fatal):", err);
  }
}
