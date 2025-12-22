#!/usr/bin/env tsx
/**
 * Download MITRE ATT&CK STIX Data
 * Downloads the latest ATT&CK Enterprise bundle from MITRE's GitHub
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ATTACK_DATA_URL =
  "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json";

const OUTPUT_DIR = join(__dirname, "../data/attack");
const OUTPUT_FILE = join(OUTPUT_DIR, "enterprise-attack.json");

async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          if (response.headers.location) {
            downloadFile(response.headers.location, outputPath)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error("Redirect without location header"));
          }
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const totalSize = parseInt(response.headers["content-length"] || "0", 10);
        let downloadedSize = 0;
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
          downloadedSize += chunk.length;

          if (totalSize > 0) {
            const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
            const mb = (downloadedSize / 1024 / 1024).toFixed(1);
            const totalMb = (totalSize / 1024 / 1024).toFixed(1);
            process.stdout.write(
              `\r⬇️  Downloading: ${percent}% (${mb}/${totalMb} MB)`
            );
          }
        });

        response.on("end", () => {
          process.stdout.write("\n");
          const buffer = Buffer.concat(chunks);
          writeFileSync(outputPath, buffer);
          resolve();
        });

        response.on("error", reject);
      })
      .on("error", reject);
  });
}

async function main() {
  console.log("📥 MITRE ATT&CK Data Downloader\n");

  try {
    // Create output directory
    if (!existsSync(OUTPUT_DIR)) {
      console.log(`📁 Creating directory: ${OUTPUT_DIR}`);
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Check if file already exists
    if (existsSync(OUTPUT_FILE)) {
      console.log(`⚠️  File already exists: ${OUTPUT_FILE}`);
      console.log("   Delete it first if you want to re-download\n");
      return;
    }

    console.log(`🌐 Source: ${ATTACK_DATA_URL}`);
    console.log(`💾 Destination: ${OUTPUT_FILE}\n`);

    // Download file
    await downloadFile(ATTACK_DATA_URL, OUTPUT_FILE);

    // Validate JSON
    console.log("✅ Validating JSON...");
    const content = require(OUTPUT_FILE);

    if (content.type !== "bundle") {
      throw new Error("Invalid STIX bundle: missing 'type: bundle'");
    }

    if (!Array.isArray(content.objects)) {
      throw new Error("Invalid STIX bundle: missing 'objects' array");
    }

    console.log(`\n✅ Download complete!`);
    console.log(`📊 Total objects: ${content.objects.length}`);

    // Count object types
    const typeCounts: Record<string, number> = {};
    content.objects.forEach((obj: any) => {
      typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
    });

    console.log("\n📋 Object types:");
    Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
      });

    console.log(`\n🎯 Next steps:`);
    console.log(`   1. Import the data using the StixImportDialog in the UI`);
    console.log(`   2. Or run: npx tsx scripts/import-attack-data.ts`);
  } catch (error: any) {
    console.error("\n❌ Download failed:", error.message);
    process.exit(1);
  }
}

main();
