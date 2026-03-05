/**
 * Re-validate tools that were previously marked as 'failed'/'tested' but actually work.
 * Targets: searchsploit, masscan, whatweb
 */
import { db } from '../server/db';
import { toolRegistry } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { runAllTests } from '../server/services/tool-tester';

const STALE_TOOLS = ['searchsploit', 'masscan', 'whatweb'];

async function main() {
  for (const toolId of STALE_TOOLS) {
    const [tool] = await db
      .select()
      .from(toolRegistry)
      .where(eq(toolRegistry.toolId, toolId));

    if (!tool) {
      console.log(`${toolId}: not found in registry, skipping`);
      continue;
    }

    console.log(`\n--- Validating ${toolId} (container: ${tool.containerName}) ---`);

    try {
      const results = await runAllTests(tool.id);
      const allPassed = results.every(r => r.passed);
      console.log(`${toolId}: ${allPassed ? 'VALIDATED' : 'TESTED (some failures)'}`);
      for (const r of results) {
        console.log(`  [${r.testType}] ${r.passed ? 'PASS' : 'FAIL'}: ${r.message}`);
        if (r.actualExitCode !== undefined) console.log(`    exit code: ${r.actualExitCode}`);
      }
    } catch (err: any) {
      console.error(`${toolId}: ERROR — ${err.message}`);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
