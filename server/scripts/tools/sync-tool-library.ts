#!/usr/bin/env tsx
/**
 * Tool Library Sync Script
 * 
 * Automatically populates the tool_library table from tool_registry
 * for OffSec R&D Team functionality.
 * 
 * Usage: npx tsx server/scripts/tools/sync-tool-library.ts
 */

import { db } from '../../db';
import { toolRegistry, toolLibrary, securityTools } from '../../../shared/schema';
import { eq, notInArray } from 'drizzle-orm';
import { createLogger } from '../../lib/logger';
const log = createLogger("sync-tool-library");

// Map tool categories to research value
function getCategoryResearchValue(category: string): 'low' | 'medium' | 'high' | 'critical' {
  const criticalCategories = ['exploitation', 'vulnerability', 'c2'];
  const highCategories = ['reconnaissance', 'scanning', 'fuzzing', 'network', 'web', 'web-application'];
  const mediumCategories = ['reporting', 'other'];

  if (criticalCategories.includes(category)) return 'critical';
  if (highCategories.includes(category)) return 'high';
  if (mediumCategories.includes(category)) return 'medium';
  return 'medium'; // Default
}

async function syncToolLibrary() {
  log.info('🔧 Tool Library Sync Script');
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Step 1: Get all tools from tool_registry
    log.info('📊 Step 1: Querying tool_registry...');
    const registryTools = await db
      .select({
        id: toolRegistry.id,
        toolId: toolRegistry.toolId,
        name: toolRegistry.name,
        category: toolRegistry.category,
        description: toolRegistry.description,
        containerName: toolRegistry.containerName,
      })
      .from(toolRegistry)
      .where(eq(toolRegistry.installStatus, 'installed'));

    log.info(`   ✓ Found ${registryTools.length} installed tools in registry\n`);

    if (registryTools.length === 0) {
      log.info('⚠️  No installed tools found in tool_registry');
      log.info('   Run the Tool Connector Agent first to discover tools\n');
      return;
    }

    // Step 2: Check which tools are already in tool_library
    log.info('📊 Step 2: Checking existing tool_library entries...');
    const existingLibraryTools = await db
      .select({
        securityToolId: toolLibrary.securityToolId,
      })
      .from(toolLibrary);

    const existingToolIds = new Set(
      existingLibraryTools.map((t) => t.securityToolId).filter(Boolean)
    );

    log.info(`   ✓ Found ${existingLibraryTools.length} tools already in library\n`);

    // Step 3: First, ensure all tools exist in security_tools
    log.info('📊 Step 3: Syncing to security_tools table...');
    let securityToolsCreated = 0;

    for (const tool of registryTools) {
      // Check if tool exists in security_tools
      const [existingSecTool] = await db
        .select({ id: securityTools.id })
        .from(securityTools)
        .where(eq(securityTools.name, tool.name))
        .limit(1);

      if (!existingSecTool) {
        // Create security_tools entry
        await db.insert(securityTools).values({
          name: tool.name,
          category: tool.category || 'other',
          description: tool.description || `${tool.name} - discovered by Tool Connector Agent`,
          status: 'available',
          command: tool.toolId,
          dockerImage: tool.containerName || 'rtpi-tools',
          metadata: {
            toolId: tool.toolId,
            registryId: tool.id,
            source: 'tool-discovery-service',
          },
        });
        securityToolsCreated++;
      }
    }

    log.info(`   ✓ Created ${securityToolsCreated} new security_tools entries\n`);

    // Step 4: Get security_tools with their IDs
    log.info('📊 Step 4: Mapping tool_registry to security_tools...');
    const toolMap = new Map<string, string>(); // name -> security_tools.id

    for (const tool of registryTools) {
      const [secTool] = await db
        .select({ id: securityTools.id })
        .from(securityTools)
        .where(eq(securityTools.name, tool.name))
        .limit(1);

      if (secTool) {
        toolMap.set(tool.name, secTool.id);
      }
    }

    log.info(`   ✓ Mapped ${toolMap.size} tools to security_tools\n`);

    // Step 5: Insert new tools into tool_library
    log.info('📊 Step 5: Populating tool_library...');
    let toolsAdded = 0;
    let toolsSkipped = 0;

    for (const tool of registryTools) {
      const securityToolId = toolMap.get(tool.name);

      if (!securityToolId) {
        log.info(`   ⚠️  Skipping ${tool.name} - no security_tools mapping`);
        toolsSkipped++;
        continue;
      }

      // Skip if already in library
      if (existingToolIds.has(securityToolId)) {
        toolsSkipped++;
        continue;
      }

      // Insert into tool_library
      const researchValue = getCategoryResearchValue(tool.category || 'other');

      await db.insert(toolLibrary).values({
        securityToolId,
        researchValue,
        testingStatus: 'untested',
        compatibleAgents: [],
        requiredCapabilities: [],
        testResults: {},
        knownIssues: [],
        usageExamples: [],
        researchNotes: `Auto-synced from tool_registry. Container: ${tool.containerName || 'rtpi-tools'}`,
      });

      toolsAdded++;

      if (toolsAdded % 20 === 0) {
        log.info(`   ⏳ Progress: ${toolsAdded} tools added...`);
      }
    }

    log.info(`   ✓ Added ${toolsAdded} new tools to tool_library`);
    log.info(`   ℹ️  Skipped ${toolsSkipped} existing tools\n`);

    // Step 6: Final verification
    log.info('📊 Step 6: Final verification...');
    const finalCount = await db
      .select({ count: toolLibrary.id })
      .from(toolLibrary);

    log.info(`   ✓ Total tools in library: ${finalCount.length}\n`);

    // Summary
    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.info('✅ Sync Complete!\n');
    log.info(`📈 Summary:`);
    log.info(`   • Tools in registry: ${registryTools.length}`);
    log.info(`   • Security tools created: ${securityToolsCreated}`);
    log.info(`   • Library entries added: ${toolsAdded}`);
    log.info(`   • Library entries skipped: ${toolsSkipped}`);
    log.info(`   • Total in library: ${finalCount.length}\n`);

    log.info('🎯 Next Steps:');
    log.info('   1. Refresh the OffSec R&D Team page');
    log.info('   2. Verify tools are now visible');
    log.info('   3. Review and update research metadata as needed\n');

  } catch (error: any) {
    log.error('❌ Error syncing tool library:', error);
    log.error('Details:', error.message);
    process.exit(1);
  }
}

// Run the sync
syncToolLibrary()
  .then(() => {
    log.info('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error('❌ Script failed:', error);
    process.exit(1);
  });
