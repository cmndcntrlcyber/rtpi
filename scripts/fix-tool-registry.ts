/**
 * Fix Tool Registry Misalignment
 *
 * One-time migration script to correct container_name and binary_path
 * for tools that were discovered in the wrong container or have stale paths.
 *
 * Usage: npx tsx scripts/fix-tool-registry.ts
 */

import { db } from '../server/db';
import { toolRegistry } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface ToolFix {
  toolId: string;
  containerName?: string;
  containerUser?: string;
  binaryPath?: string;
  installStatus?: string;
  validationStatus?: string;
}

const FIXES: ToolFix[] = [
  // =========================================================================
  // PHASE 1: Re-assign research-agent tools to correct containers
  // These tools were removed from research-agent's Dockerfile but the
  // registry still points there from a stale discovery run.
  // =========================================================================

  // ProjectDiscovery tools → rtpi-fuzzing-agent
  { toolId: 'amass',       containerName: 'rtpi-fuzzing-agent', containerUser: 'rtpi-agent', binaryPath: '/opt/tools/bin/amass' },
  { toolId: 'dnsx',        containerName: 'rtpi-fuzzing-agent', containerUser: 'rtpi-agent', binaryPath: '/opt/tools/bin/dnsx' },
  { toolId: 'feroxbuster',  containerName: 'rtpi-fuzzing-agent', containerUser: 'rtpi-agent', binaryPath: '/opt/tools/bin/feroxbuster' },
  { toolId: 'ffuf',        containerName: 'rtpi-fuzzing-agent', containerUser: 'rtpi-agent', binaryPath: '/opt/tools/bin/ffuf' },
  { toolId: 'gobuster',    containerName: 'rtpi-fuzzing-agent', containerUser: 'rtpi-agent', binaryPath: '/opt/tools/bin/gobuster' },
  { toolId: 'katana',      containerName: 'rtpi-fuzzing-agent', containerUser: 'rtpi-agent', binaryPath: '/opt/tools/bin/katana' },
  { toolId: 'subfinder',   containerName: 'rtpi-fuzzing-agent', containerUser: 'rtpi-agent', binaryPath: '/opt/tools/bin/subfinder' },
  { toolId: 'nuclei',      containerName: 'rtpi-fuzzing-agent', containerUser: 'rtpi-agent', binaryPath: '/opt/tools/bin/nuclei' },

  // msfconsole → rtpi-tools (the main tools container has Metasploit)
  { toolId: 'msfconsole',  containerName: 'rtpi-tools', containerUser: 'rtpi-tools', binaryPath: '/usr/bin/msfconsole' },

  // nikto → rtpi-burp-agent (cloned at /opt/tools/nikto/)
  { toolId: 'nikto',       containerName: 'rtpi-burp-agent', containerUser: 'rtpi-agent', binaryPath: '/opt/tools/nikto/program/nikto.pl' },

  // wpscan → rtpi-framework-agent (installed via gem)
  { toolId: 'wpscan',      containerName: 'rtpi-framework-agent', containerUser: 'rtpi-agent', binaryPath: '/usr/local/bin/wpscan' },

  // testssl.sh → rtpi-framework-agent (cloned at /opt/tools/testssl/)
  { toolId: 'testssl.sh',  containerName: 'rtpi-framework-agent', containerUser: 'rtpi-agent', binaryPath: '/opt/tools/testssl/testssl.sh' },

  // =========================================================================
  // PHASE 2: Fix binary paths for tools in correct containers
  // =========================================================================

  // ps-empire: registered at /usr/bin but actually at /opt/tools/Empire/ps-empire
  { toolId: 'ps-empire',   binaryPath: '/opt/tools/Empire/ps-empire' },

  // joomscan: registered at /usr/bin, actual perl script at /opt/tools/joomscan/joomscan.pl
  { toolId: 'joomscan',    binaryPath: '/opt/tools/joomscan/joomscan.pl' },

  // =========================================================================
  // PHASE 3: Mark genuinely missing tools as not-installed
  // These tools failed to install (pip/go build failures) and have no binary
  // =========================================================================

  { toolId: 'crackmapexec', installStatus: 'failed', validationStatus: 'failed' },
  { toolId: 'nxc',          installStatus: 'failed', validationStatus: 'failed' },
  { toolId: 'dalfox',       installStatus: 'failed', validationStatus: 'failed' },
  { toolId: 'proxychains',  installStatus: 'failed', validationStatus: 'failed' },
];

async function main() {
  console.log('=== Tool Registry Misalignment Fix ===\n');

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const fix of FIXES) {
    try {
      // Find the existing record
      const [existing] = await db
        .select({ id: toolRegistry.id, containerName: toolRegistry.containerName, binaryPath: toolRegistry.binaryPath })
        .from(toolRegistry)
        .where(eq(toolRegistry.toolId, fix.toolId));

      if (!existing) {
        console.log(`  [SKIP] ${fix.toolId} — not in registry`);
        skipped++;
        continue;
      }

      // Build the update payload
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (fix.containerName) updates.containerName = fix.containerName;
      if (fix.containerUser) updates.containerUser = fix.containerUser;
      if (fix.binaryPath) updates.binaryPath = fix.binaryPath;
      if (fix.installStatus) updates.installStatus = fix.installStatus;
      if (fix.validationStatus) updates.validationStatus = fix.validationStatus;

      await db
        .update(toolRegistry)
        .set(updates)
        .where(eq(toolRegistry.id, existing.id));

      const changes: string[] = [];
      if (fix.containerName && fix.containerName !== existing.containerName) {
        changes.push(`container: ${existing.containerName} → ${fix.containerName}`);
      }
      if (fix.binaryPath && fix.binaryPath !== existing.binaryPath) {
        changes.push(`path: ${existing.binaryPath} → ${fix.binaryPath}`);
      }
      if (fix.installStatus) {
        changes.push(`status: → ${fix.installStatus}`);
      }

      console.log(`  [OK] ${fix.toolId} — ${changes.join(', ') || 'updated'}`);
      updated++;
    } catch (err: any) {
      console.error(`  [ERR] ${fix.toolId} — ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== Done: ${updated} updated, ${skipped} skipped, ${errors} errors ===`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
