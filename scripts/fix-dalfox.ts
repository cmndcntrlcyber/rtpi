import { db } from '../server/db';
import { toolRegistry } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const [tool] = await db.select().from(toolRegistry).where(eq(toolRegistry.toolId, 'dalfox'));
  if (!tool) { console.log('dalfox not found'); process.exit(0); }
  console.log(`dalfox current binaryPath: ${tool.binaryPath}`);

  // /opt/tools/dalfox is Go source code, not compiled binary
  // Reset to /usr/bin/dalfox until go build creates the executable
  await db.update(toolRegistry).set({
    binaryPath: '/usr/bin/dalfox',
    validationStatus: 'tested',
    updatedAt: new Date(),
  }).where(eq(toolRegistry.id, tool.id));

  console.log('dalfox: reset binaryPath to /usr/bin/dalfox (needs go build in container)');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
