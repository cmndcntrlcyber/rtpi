/**
 * Tool Migration Script
 * Migrates a Python tool from offsec-team to RTPI
 */

import { analyzePythonTool } from '../../services/tool-analyzer';
import { migrateTool } from '../../services/tool-migration-service';
import path from 'path';
import { createLogger } from '../../lib/logger';
const log = createLogger("migrate-tool");

const toolName = process.argv[2];
const category = process.argv[3];

if (!toolName || !category) {
  log.error('Usage: npx tsx server/scripts/tools/migrate-tool.ts <toolName> <category>');
  log.error('Categories: bug_hunter, burpsuite_operator, daedelu5, nexus_kamuy, rt_dev');
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

log.info(`\n🔍 Analyzing ${toolName}...`);
log.info(`   Path: ${toolPath}\n`);

analyzePythonTool(toolPath)
  .then(async (analysis) => {
    log.info(`✅ Analysis complete!`);
    log.info(`   Tool: ${analysis.className}`);
    log.info(`   Category: ${analysis.category}`);
    log.info(`   Complexity: ${analysis.complexity}`);
    log.info(`   Dependencies: ${analysis.dependencies.length}`);
    log.info(`   Estimated days: ${analysis.estimatedMigrationDays}`);
    log.info(`   Has tests: ${analysis.hasTests}`);
    log.info(`   External services: ${analysis.requiresExternalServices}`);

    if (analysis.externalServiceNotes) {
      log.info(`   Notes: ${analysis.externalServiceNotes}`);
    }

    log.info(`\n🚀 Starting migration...\n`);

    const result = await migrateTool(analysis, {
      installDependencies: false, // Skip for now to avoid errors
      runTests: false,
      registerInDatabase: true,
      generateWrapper: true,
      overwriteExisting: true,
    });

    log.info(`\n📊 Migration Result:`);
    log.info(`   Status: ${result.status}`);
    log.info(`   Duration: ${result.durationMs}ms`);

    if (result.toolId) {
      log.info(`   Tool ID: ${result.toolId}`);
    }

    if (result.wrapperPath) {
      log.info(`   Wrapper: ${result.wrapperPath}`);
    }

    log.info(`\n📝 Steps:`);
    for (const step of result.steps) {
      const icon = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
      log.info(`   ${icon} ${step.step}: ${step.status}`);
      if (step.output) {
        log.info(`      ${step.output}`);
      }
      if (step.error) {
        log.info(`      Error: ${step.error}`);
      }
    }

    if (result.errors && result.errors.length > 0) {
      log.info(`\n❌ Errors:`);
      for (const error of result.errors) {
        log.info(`   - ${error}`);
      }
    }

    if (result.warnings && result.warnings.length > 0) {
      log.info(`\n⚠️  Warnings:`);
      for (const warning of result.warnings) {
        log.info(`   - ${warning}`);
      }
    }

    log.info('');

    if (result.status === 'completed') {
      log.info(`✅ Migration completed successfully!\n`);
      process.exit(0);
    } else {
      log.info(`❌ Migration failed!\n`);
      process.exit(1);
    }
  })
  .catch((error) => {
    log.error(`\n❌ Migration failed:`, error.message);
    log.error(error.stack);
    process.exit(1);
  });
