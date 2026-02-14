/**
 * Operation Lifecycle Automation
 *
 * Connects operation status transitions to automated pipeline actions.
 * When an operation is activated, it triggers the scan pipeline.
 * When paused/completed, it cancels running scans.
 */

import { db } from '../db';
import { operations, axScanResults, targets } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface PipelineStatus {
  currentPhase: 'idle' | 'bbot' | 'target_creation' | 'nmap' | 'nuclei' | 'reporting' | 'paused' | 'completed';
  automationEnabled: boolean;
  phases: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    scanId?: string;
    startedAt?: string;
    completedAt?: string;
    resultSummary?: Record<string, number>;
  }>;
  lastUpdated: string;
}

// ============================================================================
// Service
// ============================================================================

class OperationLifecycleAutomation {

  /**
   * Called when operation status changes to "active".
   * - Checks operation.automationEnabled
   * - Extracts scope targets from operation.scope AND operation.metadata fields
   * - Creates targets directly from scope data
   * - Triggers BBOT surface scan via bbotExecutor
   * - Sets pipelineStatus to track the pipeline
   */
  async handleOperationActivated(operationId: string, userId: string): Promise<void> {
    console.log(`[Lifecycle] Operation ${operationId} activated`);

    try {
      // Fetch operation
      const [operation] = await db
        .select()
        .from(operations)
        .where(eq(operations.id, operationId));

      if (!operation) {
        console.log(`[Lifecycle] Operation ${operationId} not found`);
        return;
      }

      // Check if automation is enabled
      if (!operation.automationEnabled) {
        console.log(`[Lifecycle] Automation disabled for operation ${operationId}`);
        return;
      }

      // Extract scope targets from all available sources
      const scopeTargets = this.extractScopeTargets(operation);

      if (scopeTargets.length === 0) {
        console.log(`[Lifecycle] No scope targets found for operation ${operationId}, skipping automation`);
        return;
      }

      console.log(`[Lifecycle] Found ${scopeTargets.length} scope targets: ${scopeTargets.join(', ')}`);

      // Create targets directly from scope data
      const createdCount = await this.createTargetsFromScope(operationId, scopeTargets);
      console.log(`[Lifecycle] Created ${createdCount} targets from scope data`);

      // Initialize pipeline status
      const pipelineStatus: PipelineStatus = {
        currentPhase: 'bbot',
        automationEnabled: true,
        phases: [
          {
            name: 'target_creation',
            status: 'completed',
            completedAt: new Date().toISOString(),
            resultSummary: { created: createdCount },
          },
          {
            name: 'bbot',
            status: 'running',
            startedAt: new Date().toISOString(),
          },
        ],
        lastUpdated: new Date().toISOString(),
      };

      // Start BBOT scan
      const { bbotExecutor } = await import('./bbot-executor');
      const { scanId } = await bbotExecutor.startScan(
        scopeTargets,
        { flags: ['subdomain-enum'] },
        operationId,
        userId
      );

      // Update pipeline status with scanId
      pipelineStatus.phases[1].scanId = scanId;

      await db
        .update(operations)
        .set({
          pipelineStatus: pipelineStatus as any,
          updatedAt: new Date(),
        })
        .where(eq(operations.id, operationId));

      console.log(`[Lifecycle] BBOT scan ${scanId} started for operation ${operationId}`);
    } catch (error) {
      console.error(`[Lifecycle] Failed to activate pipeline for operation ${operationId}:`, error);
    }
  }

  /**
   * Extract scope targets from all available sources on the operation:
   * - operation.scope (text field from Scope & Goals tab)
   * - operation.metadata.applicationOverview.inScopeDomains
   * - operation.metadata.scopeData.assetUrlInScope
   */
  private extractScopeTargets(operation: any): string[] {
    const allTargets = new Set<string>();

    // Source 1: operation.scope text field
    if (operation.scope) {
      const fromScope = operation.scope
        .split(/[\n,]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      fromScope.forEach((t: string) => allTargets.add(t));
    }

    // Source 2: metadata.applicationOverview.inScopeDomains
    const metadata = operation.metadata as Record<string, any> | null;
    if (metadata?.applicationOverview?.inScopeDomains) {
      const fromDomains = String(metadata.applicationOverview.inScopeDomains)
        .split(/[\n,;]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      fromDomains.forEach((t: string) => allTargets.add(t));
    }

    // Source 3: metadata.scopeData.assetUrlInScope
    if (metadata?.scopeData?.assetUrlInScope) {
      const fromUrls = String(metadata.scopeData.assetUrlInScope)
        .split(/[\n,;]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      fromUrls.forEach((t: string) => allTargets.add(t));
    }

    return Array.from(allTargets);
  }

  /**
   * Create targets directly from scope data (without waiting for BBOT).
   * Uses upsert logic to avoid duplicates.
   */
  private async createTargetsFromScope(operationId: string, scopeTargets: string[]): Promise<number> {
    let created = 0;

    // Get existing targets to avoid duplicates
    const existingTargets = await db
      .select({ value: targets.value })
      .from(targets)
      .where(eq(targets.operationId, operationId));
    const existingValues = new Set(existingTargets.map(t => t.value));

    for (const target of scopeTargets) {
      if (existingValues.has(target)) continue;

      try {
        const targetType = this.inferTargetType(target);
        await db.insert(targets).values({
          name: target,
          type: targetType,
          value: target,
          description: 'Auto-created from operation scope',
          priority: 3,
          tags: ['auto-created', 'scope'],
          operationId,
          autoCreated: true,
          metadata: {
            source: 'operation_activation',
            autoCreatedAt: new Date().toISOString(),
          },
        });
        existingValues.add(target);
        created++;
      } catch (err) {
        console.warn(`[Lifecycle] Failed to create target for ${target}:`, err);
      }
    }

    return created;
  }

  /**
   * Infer target type from the value string.
   */
  private inferTargetType(value: string): 'ip' | 'domain' | 'url' | 'network' | 'range' {
    // CIDR notation
    if (value.includes('/') && !value.includes('://')) return 'network';
    // IP range (e.g., 192.168.1.1-254)
    if (/^\d+\.\d+\.\d+\.\d+-\d+$/.test(value)) return 'range';
    // URL
    if (value.startsWith('http://') || value.startsWith('https://')) return 'url';
    // IP address
    if (/^\d+\.\d+\.\d+\.\d+$/.test(value)) return 'ip';
    // Default to domain
    return 'domain';
  }

  /**
   * Called when operation status changes to "paused".
   * - Finds running axScanResults for this operation
   * - Sets their status to 'cancelled'
   * - Sets pipelineStatus.currentPhase = 'paused'
   */
  async handleOperationPaused(operationId: string): Promise<void> {
    console.log(`[Lifecycle] Operation ${operationId} paused`);

    try {
      // Cancel running and pending scans
      await db
        .update(axScanResults)
        .set({
          status: 'cancelled',
          completedAt: new Date(),
        })
        .where(
          and(
            eq(axScanResults.operationId, operationId),
            inArray(axScanResults.status, ['pending', 'running'])
          )
        );

      // Update pipeline status
      const [op] = await db.select().from(operations).where(eq(operations.id, operationId));
      if (op) {
        const existing = (op.pipelineStatus as PipelineStatus) || { phases: [] };
        await db
          .update(operations)
          .set({
            pipelineStatus: {
              ...existing,
              currentPhase: 'paused',
              lastUpdated: new Date().toISOString(),
            } as any,
            updatedAt: new Date(),
          })
          .where(eq(operations.id, operationId));
      }

      console.log(`[Lifecycle] Pipeline paused for operation ${operationId}`);
    } catch (error) {
      console.error(`[Lifecycle] Failed to pause pipeline for operation ${operationId}:`, error);
    }
  }

  /**
   * Called when operation status changes to "completed" or "cancelled".
   * - Cancels any running scans
   * - Sets pipelineStatus.currentPhase = 'completed'
   */
  async handleOperationCompleted(operationId: string, userId: string): Promise<void> {
    console.log(`[Lifecycle] Operation ${operationId} completed/cancelled`);

    try {
      // Cancel any running scans
      await db
        .update(axScanResults)
        .set({
          status: 'cancelled',
          completedAt: new Date(),
        })
        .where(
          and(
            eq(axScanResults.operationId, operationId),
            inArray(axScanResults.status, ['pending', 'running'])
          )
        );

      // Update pipeline status
      const [op] = await db.select().from(operations).where(eq(operations.id, operationId));
      if (op) {
        const existing = (op.pipelineStatus as PipelineStatus) || { phases: [] };
        await db
          .update(operations)
          .set({
            pipelineStatus: {
              ...existing,
              currentPhase: 'completed',
              lastUpdated: new Date().toISOString(),
            } as any,
            updatedAt: new Date(),
          })
          .where(eq(operations.id, operationId));
      }

      console.log(`[Lifecycle] Pipeline completed for operation ${operationId}`);
    } catch (error) {
      console.error(`[Lifecycle] Failed to complete pipeline for operation ${operationId}:`, error);
    }
  }
}

export const operationLifecycleAutomation = new OperationLifecycleAutomation();
export default operationLifecycleAutomation;
