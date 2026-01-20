#!/usr/bin/env tsx
/**
 * Test STIX Import with Sample Bundle
 * Tests the STIX parser with the sample fixture data
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { importSTIXBundle, getImportStatistics } from "../services/stix-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("🧪 Testing STIX Import\n");

  try {
    // Load sample STIX bundle
    const bundlePath = join(__dirname, "../tests/fixtures/sample-stix-bundle.json");
    console.log(`📦 Loading bundle: ${bundlePath}`);

    const bundleContent = readFileSync(bundlePath, "utf-8");
    const bundle = JSON.parse(bundleContent);

    console.log(`✅ Bundle loaded: ${bundle.id}`);
    console.log(`📊 Total objects: ${bundle.objects.length}\n`);

    // Print object types
    const typeCounts: Record<string, number> = {};
    bundle.objects.forEach((obj: any) => {
      typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
    });

    console.log("Object types in bundle:");
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });
    console.log();

    // Get current statistics
    console.log("📈 Current database statistics:");
    const beforeStats = await getImportStatistics();
    console.log(`  Tactics: ${beforeStats.tactics}`);
    console.log(`  Techniques: ${beforeStats.techniques}`);
    console.log(`  Sub-techniques: ${beforeStats.subtechniques}`);
    console.log(`  Groups: ${beforeStats.groups}`);
    console.log(`  Software: ${beforeStats.software}`);
    console.log(`  Mitigations: ${beforeStats.mitigations}`);
    console.log(`  Data Sources: ${beforeStats.dataSources}`);
    console.log(`  Campaigns: ${beforeStats.campaigns}`);
    console.log();

    // Import bundle
    console.log("🚀 Starting import...");
    const importStats = await importSTIXBundle(bundle);

    console.log("\n✅ Import complete!");
    console.log(`  Imported ${importStats.tactics} tactics`);
    console.log(`  Imported ${importStats.techniques} techniques`);
    console.log(`  Imported ${importStats.subtechniques} sub-techniques`);
    console.log(`  Imported ${importStats.groups} groups`);
    console.log(`  Imported ${importStats.software} software`);
    console.log(`  Imported ${importStats.mitigations} mitigations`);
    console.log(`  Imported ${importStats.dataSources} data sources`);
    console.log(`  Imported ${importStats.campaigns} campaigns`);
    console.log(`  Imported ${importStats.relationships} relationships`);

    if (importStats.errors.length > 0) {
      console.log(`\n⚠️  Errors (${importStats.errors.length}):`);
      importStats.errors.forEach((error) => {
        console.log(`  - ${error}`);
      });
    }

    // Get updated statistics
    console.log("\n📈 Updated database statistics:");
    const afterStats = await getImportStatistics();
    console.log(`  Tactics: ${afterStats.tactics} (+${afterStats.tactics - beforeStats.tactics})`);
    console.log(`  Techniques: ${afterStats.techniques} (+${afterStats.techniques - beforeStats.techniques})`);
    console.log(`  Sub-techniques: ${afterStats.subtechniques} (+${afterStats.subtechniques - beforeStats.subtechniques})`);
    console.log(`  Groups: ${afterStats.groups} (+${afterStats.groups - beforeStats.groups})`);
    console.log(`  Software: ${afterStats.software} (+${afterStats.software - beforeStats.software})`);
    console.log(`  Mitigations: ${afterStats.mitigations} (+${afterStats.mitigations - beforeStats.mitigations})`);
    console.log(`  Data Sources: ${afterStats.dataSources} (+${afterStats.dataSources - beforeStats.dataSources})`);
    console.log(`  Campaigns: ${afterStats.campaigns} (+${afterStats.campaigns - beforeStats.campaigns})`);

    console.log("\n🎉 Test completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
