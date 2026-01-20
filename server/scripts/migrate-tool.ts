/**
 * Tool Migration Script
 * Migrates a Python tool from offsec-team to RTPI
 */

import { analyzePythonTool } from '../services/tool-analyzer';
import { migrateTool } from '../services/tool-migration-service';
import path from 'path';

const toolName = process.argv[2];
const category = process.argv[3];

if (!toolName || !category) {
  console.error('Usage: npx tsx scripts/migrate-tool.ts <toolName> <category>');
  console.error('Categories: bug_hunter, burpsuite_operator, daedelu5, nexus_kamuy, rt_dev');
  process.exit(1);
}

const toolPath = path.join(
  process.cwd(),
  'tools',
  'offsec-team',
  'tools',
  category,
  `${toolName}.py`
);

console.log(`\n🔍 Analyzing ${toolName}...`);
console.log(`   Path: ${toolPath}\n`);

analyzePythonTool(toolPath)
  .then(async (analysis) => {
    console.log(`✅ Analysis complete!`);
    console.log(`   Tool: ${analysis.className}`);
    console.log(`   Category: ${analysis.category}`);
    console.log(`   Complexity: ${analysis.complexity}`);
    console.log(`   Dependencies: ${analysis.dependencies.length}`);
    console.log(`   Estimated days: ${analysis.estimatedMigrationDays}`);
    console.log(`   Has tests: ${analysis.hasTests}`);
    console.log(`   External services: ${analysis.requiresExternalServices}`);

    if (analysis.externalServiceNotes) {
      console.log(`   Notes: ${analysis.externalServiceNotes}`);
    }

    console.log(`\n🚀 Starting migration...\n`);

    const result = await migrateTool(analysis, {
      installDependencies: false, // Skip for now to avoid errors
      runTests: false,
      registerInDatabase: true,
      generateWrapper: true,
      overwriteExisting: true,
    });

    console.log(`\n📊 Migration Result:`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Duration: ${result.durationMs}ms`);

    if (result.toolId) {
      console.log(`   Tool ID: ${result.toolId}`);
    }

    if (result.wrapperPath) {
      console.log(`   Wrapper: ${result.wrapperPath}`);
    }

    console.log(`\n📝 Steps:`);
    for (const step of result.steps) {
      const icon = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
      console.log(`   ${icon} ${step.step}: ${step.status}`);
      if (step.output) {
        console.log(`      ${step.output}`);
      }
      if (step.error) {
        console.log(`      Error: ${step.error}`);
      }
    }

    if (result.errors && result.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }

    if (result.warnings && result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings:`);
      for (const warning of result.warnings) {
        console.log(`   - ${warning}`);
      }
    }

    console.log('');

    if (result.status === 'completed') {
      console.log(`✅ Migration completed successfully!\n`);
      process.exit(0);
    } else {
      console.log(`❌ Migration failed!\n`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(`\n❌ Migration failed:`, error.message);
    console.error(error.stack);
    process.exit(1);
  });
