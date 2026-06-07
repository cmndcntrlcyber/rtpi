/**
 * One-shot backfill — generate SKILL.md for every currently-registered tool.
 *
 * Iterates every row in mcpServers, toolRegistry, and securityTools, and
 * runs the generator with a small concurrency limit to respect Tavily and
 * LLM rate limits.
 *
 * Usage:
 *   FF_TOOL_SKILL_GENERATION=true TAVILY_API_KEY=... ANTHROPIC_API_KEY=... \
 *     npm run skills:generate
 *
 * Re-running is safe: rows whose source hash matches the existing skill are
 * skipped automatically. Pass --force to regenerate everything.
 */

import "dotenv/config";
import { listAllRegisteredTools, generateSkillForRegistry } from "../server/services/skill-generator";
import { client } from "../server/db";

const CONCURRENCY = 3;
const force = process.argv.includes("--force");

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  console.log(`[backfill] FF_TOOL_SKILL_GENERATION=${process.env.FF_TOOL_SKILL_GENERATION ?? "(unset)"}`);
  console.log(`[backfill] TAVILY_API_KEY=${process.env.TAVILY_API_KEY ? "set" : "(missing)"}`);
  console.log(`[backfill] ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY ? "set" : "(missing)"}`);
  console.log(`[backfill] OPENAI_API_KEY=${process.env.OPENAI_API_KEY ? "set" : "(missing)"}`);
  console.log(`[backfill] force=${force}`);

  const tools = await listAllRegisteredTools();
  console.log(`[backfill] discovered ${tools.length} tools across all registries`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let missing = 0;

  await runWithConcurrency(tools, CONCURRENCY, async (tool, idx) => {
    const label = `${idx + 1}/${tools.length} ${tool.registry}/${tool.displayName}`;
    try {
      const result = await generateSkillForRegistry(tool.registry, tool.rowId, { force });
      if (result.status === "generated") {
        generated += 1;
        console.log(`[backfill] ${label} → ${result.skillPath} (${result.generatedBy}, ${result.durationMs}ms)`);
      } else if (result.status === "skipped_unchanged") {
        skipped += 1;
        console.log(`[backfill] ${label} → unchanged, skipped`);
      } else if (result.status === "skipped_missing_row") {
        missing += 1;
        console.warn(`[backfill] ${label} → row vanished mid-run`);
      } else {
        failed += 1;
        console.error(`[backfill] ${label} → FAILED: ${result.error}`);
      }
    } catch (err: any) {
      failed += 1;
      console.error(`[backfill] ${label} → THREW: ${err?.message ?? err}`);
    }
  });

  console.log("");
  console.log(`[backfill] summary: ${generated} generated, ${skipped} unchanged, ${missing} missing, ${failed} failed`);
}

main()
  .then(async () => {
    await client.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[backfill] fatal:", err);
    await client.end().catch(() => undefined);
    process.exit(1);
  });
