import { db } from '../server/db';
import { toolRegistry } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { runAllTests } from '../server/services/tool-tester';

const toolId = process.argv[2];
if (!toolId) { console.error('Usage: npx tsx scripts/validate-single.ts <toolId>'); process.exit(1); }

async function main() {
  const [tool] = await db.select().from(toolRegistry).where(eq(toolRegistry.toolId, toolId));
  if (!tool) { console.error(`Tool '${toolId}' not found`); process.exit(1); }

  console.log(`Validating ${toolId} (container: ${tool.containerName}, path: ${tool.binaryPath})`);
  const results = await runAllTests(tool.id);
  const allPassed = results.every(r => r.passed);
  console.log(`\nResult: ${allPassed ? 'VALIDATED' : 'TESTED (failures)'}`);
  for (const r of results) {
    console.log(`  [${r.testType}] ${r.passed ? 'PASS' : 'FAIL'}: ${r.message}`);
    if (r.actualOutput) console.log(`    output: ${r.actualOutput.substring(0, 200)}`);
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
