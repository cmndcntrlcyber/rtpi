/**
 * One-time script to fix tool registry entries:
 * 1. Fix wrong binaryPaths for freeze, scarecrow, nikto
 * 2. Clean OCI error binaryPaths
 * 3. Set baseCommand for nikto (perl prefix)
 */
import { db } from '../server/db';
import { toolRegistry } from '../shared/schema';
import { eq } from 'drizzle-orm';

const KNOWN_PATHS: Record<string, string> = {
  'freeze':              '/opt/tools/Freeze/freeze',
  'scarecrow':           '/opt/tools/ScareCrow/scarecrow',
  'nikto':               '/opt/tools/nikto/program/nikto.pl',
  'testssl.sh':          '/opt/tools/bin/testssl.sh',
  'joomscan':            '/opt/tools/bin/joomscan',
  'wafw00f':             '/usr/local/bin/wafw00f',
  'nxc':                 '/usr/local/bin/nxc',
  'impacket-psexec':     '/usr/local/bin/impacket-psexec',
  'impacket-secretsdump':'/usr/local/bin/impacket-secretsdump',
  'impacket-smbexec':    '/usr/local/bin/impacket-smbexec',
  'impacket-wmiexec':    '/usr/local/bin/impacket-wmiexec',
  'subfinder':           '/opt/tools/bin/subfinder',
  'amass':               '/opt/tools/bin/amass',
  'dnsx':                '/opt/tools/bin/dnsx',
  'katana':              '/opt/tools/bin/katana',
  'httpx':               '/opt/tools/bin/httpx',
  'dalfox':              '/opt/tools/bin/dalfox',
};

const BASE_COMMAND_OVERRIDES: Record<string, string> = {
  'nikto':    'perl /opt/tools/nikto/program/nikto.pl',
  'joomscan': 'perl /opt/tools/joomscan/joomscan.pl',
};

const isErrorString = (s?: string | null) =>
  !!s && /OCI runtime|exec failed|not found|No such file|Permission denied|unable to start|executable file/i.test(s);

async function main() {
  const allTools = await db.select().from(toolRegistry);
  console.log(`Total tools in registry: ${allTools.length}`);

  let fixed = 0;
  for (const rt of allTools) {
    const toolId = (rt as any).toolId || '';
    const updates: Record<string, any> = {};

    // Fix OCI error binaryPaths
    if (isErrorString(rt.binaryPath)) {
      const knownPath = KNOWN_PATHS[toolId];
      if (knownPath) {
        updates.binaryPath = knownPath;
        console.log(`  ${toolId}: fixed OCI error binaryPath → ${knownPath}`);
      } else {
        // binaryPath is NOT NULL, so set to the toolId as a placeholder for re-discovery
        updates.binaryPath = `/usr/bin/${toolId}`;
        updates.validationStatus = 'discovered';
        console.log(`  ${toolId}: reset OCI error binaryPath → /usr/bin/${toolId} (needs re-discovery)`);
      }
    }

    // Fix known wrong paths
    if (KNOWN_PATHS[toolId] && rt.binaryPath !== KNOWN_PATHS[toolId] && !isErrorString(rt.binaryPath)) {
      updates.binaryPath = KNOWN_PATHS[toolId];
      console.log(`  ${toolId}: corrected binaryPath → ${KNOWN_PATHS[toolId]}`);
    }

    // Set baseCommand overrides
    if (BASE_COMMAND_OVERRIDES[toolId]) {
      const existingConfig = (rt.config as any) || {};
      if (existingConfig.baseCommand !== BASE_COMMAND_OVERRIDES[toolId]) {
        updates.config = { ...existingConfig, baseCommand: BASE_COMMAND_OVERRIDES[toolId] };
        console.log(`  ${toolId}: set baseCommand → ${BASE_COMMAND_OVERRIDES[toolId]}`);
      }
    }

    // Clean error strings from description/version (nullable fields)
    if (isErrorString(rt.description as string | null)) {
      updates.description = null;
      console.log(`  ${toolId}: cleared error description`);
    }
    if (isErrorString(rt.version as string | null)) {
      updates.version = null;
      console.log(`  ${toolId}: cleared error version`);
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db.update(toolRegistry).set(updates).where(eq(toolRegistry.id, rt.id));
      fixed++;
    }
  }

  console.log(`\nFixed ${fixed} of ${allTools.length} tools`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
