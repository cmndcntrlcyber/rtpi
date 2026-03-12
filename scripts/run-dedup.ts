import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function runDedup() {
  // Get all operation IDs
  const ops: any[] = await db.execute(sql`SELECT DISTINCT id FROM operations`);
  console.log(`Found ${ops.length} operations`);

  for (const op of ops) {
    const operationId = op.id;
    console.log(`\nDeduplicating operation ${operationId}...`);

    // Analyze
    const assetDups: any[] = await db.execute(sql`
      SELECT COALESCE(SUM(cnt - 1), 0)::int AS duplicates
      FROM (
        SELECT COUNT(*) AS cnt FROM discovered_assets
        WHERE operation_id = ${operationId}
        GROUP BY type, value HAVING COUNT(*) > 1
      ) sub
    `);
    const serviceDups: any[] = await db.execute(sql`
      SELECT COALESCE(SUM(cnt - 1), 0)::int AS duplicates
      FROM (
        SELECT COUNT(*) AS cnt FROM discovered_services ds
        JOIN discovered_assets da ON ds.asset_id = da.id
        WHERE da.operation_id = ${operationId}
        GROUP BY ds.asset_id, ds.port, ds.protocol HAVING COUNT(*) > 1
      ) sub
    `);
    const vulnDups: any[] = await db.execute(sql`
      SELECT COALESCE(SUM(cnt - 1), 0)::int AS duplicates
      FROM (
        SELECT COUNT(*) AS cnt FROM vulnerabilities
        WHERE operation_id = ${operationId}
        GROUP BY title HAVING COUNT(*) > 1
      ) sub
    `);

    const da = assetDups[0]?.duplicates ?? 0;
    const ds = serviceDups[0]?.duplicates ?? 0;
    const dv = vulnDups[0]?.duplicates ?? 0;
    console.log(`  Assets: ${da}, Services: ${ds}, Vulns: ${dv}`);

    if (da + ds + dv === 0) {
      console.log('  No duplicates — skipping');
      continue;
    }

    // Dedup assets
    if (da > 0) {
      await db.execute(sql`
        WITH survivors AS (
          SELECT DISTINCT ON (operation_id, type, value) id AS survivor_id, operation_id, type, value
          FROM discovered_assets WHERE operation_id = ${operationId}
          ORDER BY operation_id, type, value, discovered_at ASC
        ),
        duplicates AS (
          SELECT da.id AS dup_id, s.survivor_id
          FROM discovered_assets da
          JOIN survivors s ON da.operation_id = s.operation_id AND da.type = s.type AND da.value = s.value
          WHERE da.id != s.survivor_id AND da.operation_id = ${operationId}
        )
        UPDATE discovered_services SET asset_id = d.survivor_id
        FROM duplicates d WHERE discovered_services.asset_id = d.dup_id
      `);
      await db.execute(sql`
        UPDATE discovered_assets da SET last_seen_at = agg.max_last_seen
        FROM (
          SELECT operation_id, type, value, MAX(last_seen_at) AS max_last_seen
          FROM discovered_assets WHERE operation_id = ${operationId}
          GROUP BY operation_id, type, value HAVING COUNT(*) > 1
        ) agg
        WHERE da.operation_id = agg.operation_id AND da.type = agg.type AND da.value = agg.value
      `);
      await db.execute(sql`
        WITH survivors AS (
          SELECT DISTINCT ON (operation_id, type, value) id AS survivor_id, operation_id, type, value
          FROM discovered_assets WHERE operation_id = ${operationId}
          ORDER BY operation_id, type, value, discovered_at ASC
        ),
        duplicates AS (
          SELECT da.id AS dup_id, s.survivor_id
          FROM discovered_assets da
          JOIN survivors s ON da.operation_id = s.operation_id AND da.type = s.type AND da.value = s.value
          WHERE da.id != s.survivor_id AND da.operation_id = ${operationId}
        )
        UPDATE targets SET discovered_asset_id = d.survivor_id
        FROM duplicates d WHERE targets.discovered_asset_id = d.dup_id
      `);
      const deleted: any[] = await db.execute(sql`
        DELETE FROM discovered_assets
        WHERE operation_id = ${operationId}
          AND id NOT IN (
            SELECT DISTINCT ON (operation_id, type, value) id
            FROM discovered_assets WHERE operation_id = ${operationId}
            ORDER BY operation_id, type, value, discovered_at ASC
          )
      `);
      console.log(`  Removed ${deleted.count ?? deleted.length} duplicate assets`);
    }

    // Dedup services
    if (ds > 0) {
      const deleted: any[] = await db.execute(sql`
        DELETE FROM discovered_services
        WHERE id NOT IN (
          SELECT DISTINCT ON (ds.asset_id, ds.port, ds.protocol) ds.id
          FROM discovered_services ds
          JOIN discovered_assets da ON ds.asset_id = da.id
          WHERE da.operation_id = ${operationId}
          ORDER BY ds.asset_id, ds.port, ds.protocol, ds.discovered_at ASC
        )
        AND asset_id IN (SELECT id FROM discovered_assets WHERE operation_id = ${operationId})
      `);
      console.log(`  Removed ${deleted.count ?? deleted.length} duplicate services`);
    }

    // Dedup vulns
    if (dv > 0) {
      const deleted: any[] = await db.execute(sql`
        DELETE FROM vulnerabilities
        WHERE operation_id = ${operationId}
          AND id NOT IN (
            SELECT DISTINCT ON (operation_id, title) id
            FROM vulnerabilities WHERE operation_id = ${operationId}
            ORDER BY operation_id, title, discovered_at ASC
          )
      `);
      console.log(`  Removed ${deleted.count ?? deleted.length} duplicate vulnerabilities`);
    }
  }

  console.log('\nDeduplication complete!');
  process.exit(0);
}

runDedup().catch(err => {
  console.error('Dedup failed:', err);
  process.exit(1);
});
