/**
 * List Migrated Tools Script
 * Shows all tools migrated from offsec-team
 */

import { db } from '../db';
import { securityTools } from '../../shared/schema';
import { sql } from 'drizzle-orm';

console.log('\n🔍 Querying migrated tools from database...\n');

db.select()
  .from(securityTools)
  .then((tools) => {
    const migratedTools = tools.filter(t =>
      (t.metadata as any)?.source === 'offsec-team'
    );

    console.log(`📊 Total Tools in Database: ${tools.length}`);
    console.log(`🚀 Migrated from OffSec Team: ${migratedTools.length}\n`);

    if (migratedTools.length === 0) {
      console.log('⚠️  No migrated tools found in database.\n');
      process.exit(0);
    }

    console.log('Migrated Tools:\n');
    migratedTools.forEach((tool, i) => {
      const metadata = tool.metadata as any || {};
      console.log(`  ${i + 1}. ${tool.name}`);
      console.log(`     ID: ${tool.id}`);
      console.log(`     Category: ${tool.category}`);
      console.log(`     Status: ${tool.status}`);
      console.log(`     Complexity: ${metadata.complexity || 'unknown'}`);
      console.log(`     Wrapper: ${metadata.wrapperPath || 'none'}`);
      console.log(`     Created: ${tool.createdAt?.toISOString().split('T')[0]}`);
      console.log('');
    });

    console.log(`✅ All ${migratedTools.length} tools migrated successfully!\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  });
