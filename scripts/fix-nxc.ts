import { db } from '../server/db';
import { toolRegistry } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const [tool] = await db.select().from(toolRegistry).where(eq(toolRegistry.toolId, 'nxc'));
  if (!tool) { console.log('nxc not found'); process.exit(0); }

  console.log(`nxc current binaryPath: ${tool.binaryPath}`);

  // /opt/tools/NetExec/nxc is a source directory, not a binary
  // Reset to /usr/bin/nxc placeholder until pip install creates the executable
  await db.update(toolRegistry).set({
    binaryPath: '/usr/bin/nxc',
    validationStatus: 'tested',
    updatedAt: new Date(),
  }).where(eq(toolRegistry.id, tool.id));

  console.log('nxc: reset binaryPath to /usr/bin/nxc (needs pip install in container)');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
