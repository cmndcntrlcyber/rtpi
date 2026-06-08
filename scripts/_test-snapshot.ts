import "dotenv/config";
import { snapshotAgent, listSnapshots, listAgentNames, readSnapshot } from "./server/services/agent-backup-service";
import { db } from "./server/db";
import { agents } from "./shared/schema";

async function main() {
  const [first] = await db.select().from(agents).limit(1);
  if (!first) { console.error("no agents"); process.exit(2); }
  console.log("snapshotting:", first.name, first.id);
  await snapshotAgent(first.id, "manual");
  const names = await listAgentNames();
  console.log("names:", JSON.stringify(names));
  const slug = names[0]?.slug;
  if (slug) {
    const snaps = await listSnapshots(slug);
    console.log("snapshots:", JSON.stringify(snaps));
    const latest = await readSnapshot(slug);
    console.log("latest tactics:", latest?.tactics.length, "mcp:", latest?.mcpAttachments.length);
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
