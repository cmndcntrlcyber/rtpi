import { db } from '../server/db';
import { toolRegistry } from '../shared/schema';

async function main() {
  const tools = await db.select({ toolId: toolRegistry.toolId, validationStatus: toolRegistry.validationStatus }).from(toolRegistry);
  const counts: Record<string, number> = {};
  for (const t of tools) {
    const status = t.validationStatus || 'null';
    counts[status] = (counts[status] || 0) + 1;
  }
  console.log('Validation status counts:', counts);
  console.log('Total:', tools.length);

  const validated = tools.filter(t => t.validationStatus === 'validated').map(t => t.toolId).sort();
  console.log(`\nValidated (${validated.length}):`, validated.join(', '));

  const tested = tools.filter(t => t.validationStatus === 'tested').map(t => t.toolId).sort();
  console.log(`Tested (${tested.length}):`, tested.join(', '));

  const discovered = tools.filter(t => t.validationStatus === 'discovered').map(t => t.toolId).sort();
  console.log(`Discovered (${discovered.length}):`, discovered.join(', '));

  const untested = tools.filter(t => t.validationStatus === 'untested').map(t => t.toolId).sort();
  console.log(`Untested (${untested.length}):`, untested.join(', '));

  const other = tools.filter(t => !['validated','tested','discovered','untested'].includes(t.validationStatus || ''));
  if (other.length) console.log(`Other (${other.length}):`, other.map(t => `${t.toolId}=${t.validationStatus}`).join(', '));

  process.exit(0);
}
main();
