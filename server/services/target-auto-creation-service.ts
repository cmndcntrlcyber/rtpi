/**
 * Target Auto-Creation Service
 *
 * Bridges the gap between discovered assets and targets.
 * After BBOT scans discover assets, this service converts them into
 * scannable targets with bidirectional linking.
 */

import { db } from '../db';
import { targets, discoveredAssets, operations } from '@shared/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface AutoCreationResult {
  created: number;
  skipped: number;
  linked: number;
  targetIds: string[];
}

interface AssetToTargetTypeMap {
  [key: string]: 'ip' | 'domain' | 'url' | 'network' | 'range';
}

// ============================================================================
// Service
// ============================================================================

const MAX_AUTO_CREATED_TARGETS = 50;

const ASSET_TO_TARGET_TYPE: AssetToTargetTypeMap = {
  'host': 'ip',
  'domain': 'domain',
  'ip': 'ip',
  'network': 'network',
  'url': 'url',
};

class TargetAutoCreationService {

  /**
   * Convert discoveredAssets to targets for a given operation and scan.
   * - Queries discoveredAssets WHERE operationId AND targetId IS NULL AND status = 'active'
   * - Deduplicates: skips if target with same value+operationId already exists
   * - Maps assetTypeEnum -> targetTypeEnum
   * - Sets autoCreated=true, discoveredAssetId, sourceScanId
   * - Updates discoveredAsset.targetId back-reference
   */
  async autoCreateTargetsFromAssets(
    operationId: string,
    scanId: string
  ): Promise<AutoCreationResult> {
    console.log(`[TargetAutoCreation] Starting auto-creation for operation ${operationId}, scan ${scanId}`);

    const result: AutoCreationResult = {
      created: 0,
      skipped: 0,
      linked: 0,
      targetIds: [],
    };

    try {
      // First, link any existing manually-created targets to discovered assets
      result.linked = await this.linkExistingTargetsToAssets(operationId);

      // Query unlinked active discovered assets for this operation
      const unlinkedAssets = await db
        .select()
        .from(discoveredAssets)
        .where(
          and(
            eq(discoveredAssets.operationId, operationId),
            isNull(discoveredAssets.targetId),
            eq(discoveredAssets.status, 'active')
          )
        );

      if (unlinkedAssets.length === 0) {
        console.log('[TargetAutoCreation] No unlinked assets found');
        return result;
      }

      console.log(`[TargetAutoCreation] Found ${unlinkedAssets.length} unlinked assets`);

      // Get existing targets for this operation to check for duplicates
      const existingTargets = await db
        .select({ value: targets.value })
        .from(targets)
        .where(eq(targets.operationId, operationId));

      const existingValues = new Set(existingTargets.map(t => t.value));

      for (const asset of unlinkedAssets) {
        // Enforce cap
        if (result.created >= MAX_AUTO_CREATED_TARGETS) {
          console.log(`[TargetAutoCreation] Reached cap of ${MAX_AUTO_CREATED_TARGETS} auto-created targets`);
          break;
        }

        // Skip assets with unmappable types
        const targetType = this.mapAssetTypeToTargetType(asset.type);
        if (!targetType) {
          result.skipped++;
          continue;
        }

        // Skip duplicates
        if (existingValues.has(asset.value)) {
          result.skipped++;

          // Still link the asset to the existing target
          const [existingTarget] = await db
            .select({ id: targets.id })
            .from(targets)
            .where(
              and(
                eq(targets.operationId, operationId),
                eq(targets.value, asset.value)
              )
            )
            .limit(1);

          if (existingTarget) {
            await db
              .update(discoveredAssets)
              .set({ targetId: existingTarget.id })
              .where(eq(discoveredAssets.id, asset.id));
          }

          continue;
        }

        try {
          // Create target
          const [newTarget] = await db
            .insert(targets)
            .values({
              name: asset.hostname || asset.value,
              type: targetType,
              value: asset.value,
              description: `Auto-created from ${asset.discoveryMethod} scan`,
              priority: 3,
              tags: ['auto-created', asset.discoveryMethod],
              operationId,
              discoveredAssetId: asset.id,
              autoCreated: true,
              sourceScanId: scanId,
              metadata: {
                sourceAssetType: asset.type,
                discoveryMethod: asset.discoveryMethod,
                autoCreatedAt: new Date().toISOString(),
              },
            })
            .returning();

          if (newTarget) {
            // Update back-reference on discovered asset
            await db
              .update(discoveredAssets)
              .set({ targetId: newTarget.id })
              .where(eq(discoveredAssets.id, asset.id));

            result.created++;
            result.targetIds.push(newTarget.id);
            existingValues.add(asset.value); // Prevent further duplicates in this batch
          }
        } catch (err) {
          console.warn(`[TargetAutoCreation] Failed to create target for asset ${asset.value}:`, err);
          result.skipped++;
        }
      }

      console.log(
        `[TargetAutoCreation] Complete: ${result.created} created, ${result.skipped} skipped, ${result.linked} linked`
      );

      return result;
    } catch (error) {
      console.error('[TargetAutoCreation] Auto-creation failed:', error);
      throw error;
    }
  }

  /**
   * Link existing manually-created targets to discoveredAssets by matching value.
   * Useful for operations where targets were created before scanning.
   */
  async linkExistingTargetsToAssets(operationId: string): Promise<number> {
    let linked = 0;

    try {
      // Find targets without a discoveredAssetId
      const unlinkdTargets = await db
        .select()
        .from(targets)
        .where(
          and(
            eq(targets.operationId, operationId),
            isNull(targets.discoveredAssetId)
          )
        );

      for (const target of unlinkdTargets) {
        // Find matching discovered asset by value
        const [matchingAsset] = await db
          .select()
          .from(discoveredAssets)
          .where(
            and(
              eq(discoveredAssets.operationId, operationId),
              eq(discoveredAssets.value, target.value),
              isNull(discoveredAssets.targetId)
            )
          )
          .limit(1);

        if (matchingAsset) {
          // Update both sides of the link
          await db
            .update(targets)
            .set({ discoveredAssetId: matchingAsset.id })
            .where(eq(targets.id, target.id));

          await db
            .update(discoveredAssets)
            .set({ targetId: target.id })
            .where(eq(discoveredAssets.id, matchingAsset.id));

          linked++;
        }
      }
    } catch (error) {
      console.warn('[TargetAutoCreation] Error linking existing targets:', error);
    }

    return linked;
  }

  /**
   * Map asset type enum to target type enum.
   */
  private mapAssetTypeToTargetType(
    assetType: string
  ): 'ip' | 'domain' | 'url' | 'network' | 'range' | null {
    return ASSET_TO_TARGET_TYPE[assetType] || null;
  }
}

export const targetAutoCreationService = new TargetAutoCreationService();
export default targetAutoCreationService;
