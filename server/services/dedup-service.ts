/**
 * Deduplication Service
 *
 * Analyzes and removes duplicate records in discoveredAssets,
 * discoveredServices, and vulnerabilities tables for a given operation.
 * Keeps the oldest record per duplicate group, updates lastSeenAt,
 * reassigns child references, and deletes the rest.
 */

import { db } from '../db';
import { discoveredAssets, discoveredServices, vulnerabilities } from '@shared/schema';
import { sql } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface DedupAnalysis {
  duplicateAssets: number;
  duplicateServices: number;
  duplicateVulnerabilities: number;
  totalDuplicateRows: number;
}

export interface DedupResult extends DedupAnalysis {
  assetsRemoved: number;
  servicesRemoved: number;
  vulnerabilitiesRemoved: number;
  servicesReassigned: number;
}

// ============================================================================
// Service
// ============================================================================

class DedupService {
  /**
   * Count duplicate records without modifying anything
   */
  async analyze(operationId: string): Promise<DedupAnalysis> {
    // Count asset duplicates: rows where (operationId, type, value) appears more than once
    const assetDups = await db.execute(sql`
      SELECT COALESCE(SUM(cnt - 1), 0)::int AS duplicates
      FROM (
        SELECT COUNT(*) AS cnt
        FROM discovered_assets
        WHERE operation_id = ${operationId}
        GROUP BY type, value
        HAVING COUNT(*) > 1
      ) sub
    `);

    // Count service duplicates: rows where (assetId, port, protocol) appears more than once
    const serviceDups = await db.execute(sql`
      SELECT COALESCE(SUM(cnt - 1), 0)::int AS duplicates
      FROM (
        SELECT COUNT(*) AS cnt
        FROM discovered_services ds
        JOIN discovered_assets da ON ds.asset_id = da.id
        WHERE da.operation_id = ${operationId}
        GROUP BY ds.asset_id, ds.port, ds.protocol
        HAVING COUNT(*) > 1
      ) sub
    `);

    // Count vulnerability duplicates: rows where (operationId, title) appears more than once
    const vulnDups = await db.execute(sql`
      SELECT COALESCE(SUM(cnt - 1), 0)::int AS duplicates
      FROM (
        SELECT COUNT(*) AS cnt
        FROM vulnerabilities
        WHERE operation_id = ${operationId}
        GROUP BY title
        HAVING COUNT(*) > 1
      ) sub
    `);

    const duplicateAssets = (assetDups as any[])[0]?.duplicates ?? 0;
    const duplicateServices = (serviceDups as any[])[0]?.duplicates ?? 0;
    const duplicateVulnerabilities = (vulnDups as any[])[0]?.duplicates ?? 0;

    return {
      duplicateAssets,
      duplicateServices,
      duplicateVulnerabilities,
      totalDuplicateRows: duplicateAssets + duplicateServices + duplicateVulnerabilities,
    };
  }

  /**
   * Remove duplicates for an operation, keeping the oldest record per group
   */
  async deduplicate(operationId: string): Promise<DedupResult> {
    const analysis = await this.analyze(operationId);

    if (analysis.totalDuplicateRows === 0) {
      return {
        ...analysis,
        assetsRemoved: 0,
        servicesRemoved: 0,
        vulnerabilitiesRemoved: 0,
        servicesReassigned: 0,
      };
    }

    let assetsRemoved = 0;
    let servicesRemoved = 0;
    let vulnerabilitiesRemoved = 0;
    let servicesReassigned = 0;

    // Run all dedup in a transaction
    await db.transaction(async (tx) => {
      // Step 1: Deduplicate assets
      // Find survivor IDs (oldest per group) and reassign services from duplicates
      if (analysis.duplicateAssets > 0) {
        // Reassign services from duplicate assets to survivors
        const reassigned = await tx.execute(sql`
          WITH survivors AS (
            SELECT DISTINCT ON (operation_id, type, value) id AS survivor_id, operation_id, type, value
            FROM discovered_assets
            WHERE operation_id = ${operationId}
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
        servicesReassigned = (reassigned as any).count ?? 0;

        // Update last_seen_at on survivors to the max across the group
        await tx.execute(sql`
          UPDATE discovered_assets da SET last_seen_at = agg.max_last_seen
          FROM (
            SELECT operation_id, type, value, MAX(last_seen_at) AS max_last_seen
            FROM discovered_assets
            WHERE operation_id = ${operationId}
            GROUP BY operation_id, type, value
            HAVING COUNT(*) > 1
          ) agg
          WHERE da.operation_id = agg.operation_id AND da.type = agg.type AND da.value = agg.value
        `);

        // Reassign target back-references
        await tx.execute(sql`
          WITH survivors AS (
            SELECT DISTINCT ON (operation_id, type, value) id AS survivor_id, operation_id, type, value
            FROM discovered_assets
            WHERE operation_id = ${operationId}
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

        // Delete duplicate assets
        const deleted = await tx.execute(sql`
          DELETE FROM discovered_assets
          WHERE operation_id = ${operationId}
            AND id NOT IN (
              SELECT DISTINCT ON (operation_id, type, value) id
              FROM discovered_assets
              WHERE operation_id = ${operationId}
              ORDER BY operation_id, type, value, discovered_at ASC
            )
        `);
        assetsRemoved = (deleted as any).count ?? 0;
      }

      // Step 2: Deduplicate services (after asset dedup, since asset_ids may have changed)
      if (analysis.duplicateServices > 0) {
        const deleted = await tx.execute(sql`
          DELETE FROM discovered_services
          WHERE id NOT IN (
            SELECT DISTINCT ON (ds.asset_id, ds.port, ds.protocol) ds.id
            FROM discovered_services ds
            JOIN discovered_assets da ON ds.asset_id = da.id
            WHERE da.operation_id = ${operationId}
            ORDER BY ds.asset_id, ds.port, ds.protocol, ds.discovered_at ASC
          )
          AND asset_id IN (
            SELECT id FROM discovered_assets WHERE operation_id = ${operationId}
          )
        `);
        servicesRemoved = (deleted as any).count ?? 0;
      }

      // Step 3: Deduplicate vulnerabilities
      if (analysis.duplicateVulnerabilities > 0) {
        const deleted = await tx.execute(sql`
          DELETE FROM vulnerabilities
          WHERE operation_id = ${operationId}
            AND id NOT IN (
              SELECT DISTINCT ON (operation_id, title) id
              FROM vulnerabilities
              WHERE operation_id = ${operationId}
              ORDER BY operation_id, title, discovered_at ASC
            )
        `);
        vulnerabilitiesRemoved = (deleted as any).count ?? 0;
      }
    });

    return {
      ...analysis,
      assetsRemoved,
      servicesRemoved,
      vulnerabilitiesRemoved,
      servicesReassigned,
    };
  }
}

export const dedupService = new DedupService();
