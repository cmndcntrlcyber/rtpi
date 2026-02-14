#!/usr/bin/env tsx
/**
 * Tool Library Sync Script
 * 
 * Automatically populates the tool_library table from tool_registry
 * for OffSec R&D Team functionality.
 * 
 * Usage: npx tsx server/scripts/sync-tool-library.ts
 */

import { db } from '../db';
import { toolRegistry, toolLibrary, securityTools } from '../../shared/schema';
import { eq, notInArray } from 'drizzle-orm';

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
  console.log('🔧 Tool Library Sync Script');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Step 1: Get all tools from tool_registry
    console.log('📊 Step 1: Querying tool_registry...');
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

    console.log(`   ✓ Found ${registryTools.length} installed tools in registry\n`);

    if (registryTools.length === 0) {
      console.log('⚠️  No installed tools found in tool_registry');
      console.log('   Run the Tool Connector Agent first to discover tools\n');
      return;
    }

    // Step 2: Check which tools are already in tool_library
    console.log('📊 Step 2: Checking existing tool_library entries...');
    const existingLibraryTools = await db
      .select({
        securityToolId: toolLibrary.securityToolId,
      })
      .from(toolLibrary);

    const existingToolIds = new Set(
      existingLibraryTools.map((t) => t.securityToolId).filter(Boolean)
    );

    console.log(`   ✓ Found ${existingLibraryTools.length} tools already in library\n`);

    // Step 3: First, ensure all tools exist in security_tools
    console.log('📊 Step 3: Syncing to security_tools table...');
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
            source: 'tool-connector-agent',
          },
        });
        securityToolsCreated++;
      }
    }

    console.log(`   ✓ Created ${securityToolsCreated} new security_tools entries\n`);

    // Step 4: Get security_tools with their IDs
    console.log('📊 Step 4: Mapping tool_registry to security_tools...');
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

    console.log(`   ✓ Mapped ${toolMap.size} tools to security_tools\n`);

    // Step 5: Insert new tools into tool_library
    console.log('📊 Step 5: Populating tool_library...');
    let toolsAdded = 0;
    let toolsSkipped = 0;

    for (const tool of registryTools) {
      const securityToolId = toolMap.get(tool.name);

      if (!securityToolId) {
        console.log(`   ⚠️  Skipping ${tool.name} - no security_tools mapping`);
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
        console.log(`   ⏳ Progress: ${toolsAdded} tools added...`);
      }
    }

    console.log(`   ✓ Added ${toolsAdded} new tools to tool_library`);
    console.log(`   ℹ️  Skipped ${toolsSkipped} existing tools\n`);

    // Step 6: Final verification
    console.log('📊 Step 6: Final verification...');
    const finalCount = await db
      .select({ count: toolLibrary.id })
      .from(toolLibrary);

    console.log(`   ✓ Total tools in library: ${finalCount.length}\n`);

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Sync Complete!\n');
    console.log(`📈 Summary:`);
    console.log(`   • Tools in registry: ${registryTools.length}`);
    console.log(`   • Security tools created: ${securityToolsCreated}`);
    console.log(`   • Library entries added: ${toolsAdded}`);
    console.log(`   • Library entries skipped: ${toolsSkipped}`);
    console.log(`   • Total in library: ${finalCount.length}\n`);

    console.log('🎯 Next Steps:');
    console.log('   1. Refresh the OffSec R&D Team page');
    console.log('   2. Verify tools are now visible');
    console.log('   3. Review and update research metadata as needed\n');

  } catch (error: any) {
    console.error('❌ Error syncing tool library:', error);
    console.error('Details:', error.message);
    process.exit(1);
  }
}

// Run the sync
syncToolLibrary()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
