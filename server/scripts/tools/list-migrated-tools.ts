/**
 * List Migrated Tools Script
 * Shows all tools migrated from offsec-team
 */

import { db } from '../../db';
import { securityTools } from '../../../shared/schema';
import { sql } from 'drizzle-orm';
import { createLogger } from '../../lib/logger';
const log = createLogger("list-migrated-tools");

log.info('\n🔍 Querying migrated tools from database...\n');

db.select()
  .from(securityTools)
  .then((tools) => {
    const migratedTools = tools.filter(t =>
      (t.metadata as any)?.source === 'offsec-team'
    );

    log.info(`📊 Total Tools in Database: ${tools.length}`);
    log.info(`🚀 Migrated from OffSec Team: ${migratedTools.length}\n`);

    if (migratedTools.length === 0) {
      log.info('⚠️  No migrated tools found in database.\n');
      process.exit(0);
    }

    log.info('Migrated Tools:\n');
    migratedTools.forEach((tool, i) => {
      const metadata = tool.metadata as any || {};
      log.info(`  ${i + 1}. ${tool.name}`);
      log.info(`     ID: ${tool.id}`);
      log.info(`     Category: ${tool.category}`);
      log.info(`     Status: ${tool.status}`);
      log.info(`     Complexity: ${metadata.complexity || 'unknown'}`);
      log.info(`     Wrapper: ${metadata.wrapperPath || 'none'}`);
      log.info(`     Created: ${tool.createdAt?.toISOString().split('T')[0]}`);
      log.info('');
    });

    log.info(`✅ All ${migratedTools.length} tools migrated successfully!\n`);
    process.exit(0);
  })
  .catch((error) => {
    log.error('❌ Query failed:', error.message);
    process.exit(1);
  });
