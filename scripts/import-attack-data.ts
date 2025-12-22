#!/usr/bin/env tsx
/**
 * Import MITRE ATT&CK Data
 * Imports the downloaded ATT&CK Enterprise bundle into the database
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { importSTIXBundle, getImportStatistics } from "../server/services/stix-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_FILE = join(__dirname, "../data/attack/enterprise-attack.json");

async function main() {
  console.log("📥 MITRE ATT&CK Data Importer\n");

  try {
    // Check if file exists
    if (!existsSync(DATA_FILE)) {
      console.error(`❌ Data file not found: ${DATA_FILE}`);
      console.error(`\n💡 Run the download script first:`);
      console.error(`   npx tsx scripts/download-attack-data.ts\n`);
      process.exit(1);
    }

    console.log(`📦 Loading bundle: ${DATA_FILE}`);

    const bundleContent = readFileSync(DATA_FILE, "utf-8");
    const bundle = JSON.parse(bundleContent);

    console.log(`✅ Bundle loaded: ${bundle.id}`);
    console.log(`📊 Total objects: ${bundle.objects.length}`);

    // Count object types
    const typeCounts: Record<string, number> = {};
    bundle.objects.forEach((obj: any) => {
      typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
    });

    console.log("\nObject types in bundle:");
    Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
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
    console.log("🚀 Starting import... (this may take a few minutes)");
    console.log("⏳ Please wait...\n");

    const startTime = Date.now();
    const importStats = await importSTIXBundle(bundle);
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(1);

    console.log(`\n✅ Import complete in ${durationSeconds}s!`);
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
      importStats.errors.slice(0, 10).forEach((error) => {
        console.log(`  - ${error}`);
      });
      if (importStats.errors.length > 10) {
        console.log(`  ... and ${importStats.errors.length - 10} more`);
      }
    }

    // Get updated statistics
    console.log("\n📈 Updated database statistics:");
    const afterStats = await getImportStatistics();
    console.log(
      `  Tactics: ${afterStats.tactics} (+${afterStats.tactics - beforeStats.tactics})`
    );
    console.log(
      `  Techniques: ${afterStats.techniques} (+${afterStats.techniques - beforeStats.techniques})`
    );
    console.log(
      `  Sub-techniques: ${afterStats.subtechniques} (+${afterStats.subtechniques - beforeStats.subtechniques})`
    );
    console.log(
      `  Groups: ${afterStats.groups} (+${afterStats.groups - beforeStats.groups})`
    );
    console.log(
      `  Software: ${afterStats.software} (+${afterStats.software - beforeStats.software})`
    );
    console.log(
      `  Mitigations: ${afterStats.mitigations} (+${afterStats.mitigations - beforeStats.mitigations})`
    );
    console.log(
      `  Data Sources: ${afterStats.dataSources} (+${afterStats.dataSources - beforeStats.dataSources})`
    );
    console.log(
      `  Campaigns: ${afterStats.campaigns} (+${afterStats.campaigns - beforeStats.campaigns})`
    );

    console.log("\n🎉 Import completed successfully!");
    console.log("   You can now view the data in the ATT&CK Framework page");
  } catch (error: any) {
    console.error("\n❌ Import failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
