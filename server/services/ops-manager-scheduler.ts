import { db } from "../db";
import { operations, agentWorkflows } from "../../shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { opsManagementOrchestrator } from "./ops-management-orchestrator";

/**
 * Operations Manager Scheduler
 *
 * Runs hourly to trigger Operations Management workflows for enabled operations.
 * Each workflow involves:
 * - 20+ page reporter agents running in parallel
 * - Operations Manager synthesizing reports and making autonomous decisions
 */
class OpsManagerScheduler {
  private interval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly INTERVAL_MS = 3600000; // 1 hour
  private readonly CHECK_DELAY_MS = 5000; // 5 seconds between operation checks

  /**
   * Start the scheduler
   * Executes immediately on startup, then every hour
   */
  start(): void {
    if (this.interval) {
      console.log("⚠️  [OpsManagerScheduler] Scheduler already running");
      return;
    }

    console.log("🚀 [OpsManagerScheduler] Starting hourly scheduler");

    // Run immediately on startup
    this.checkAndExecute();

    // Then run every hour
    this.interval = setInterval(() => {
      this.checkAndExecute();
    }, this.INTERVAL_MS);
  }

  /**
   * Stop the scheduler
   */
  shutdown(): void {
    if (this.interval) {
      console.log("🛑 [OpsManagerScheduler] Shutting down scheduler");
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Check for operations needing hourly reports and execute workflows
   */
  private async checkAndExecute(): Promise<void> {
    if (this.isRunning) {
      console.log("⏭️  [OpsManagerScheduler] Previous check still running, skipping");
      return;
    }

    this.isRunning = true;
    console.log("⏰ [OpsManagerScheduler] Running hourly check at", new Date().toISOString());

    try {
      // Find operations with hourly reporting enabled
      const enabledOperations = await db
        .select()
        .from(operations)
        .where(eq(operations.hourlyReportingEnabled, true));

      console.log(`📊 [OpsManagerScheduler] Found ${enabledOperations.length} operations with hourly reporting enabled`);

      if (enabledOperations.length === 0) {
        console.log("✅ [OpsManagerScheduler] No operations to process");
        return;
      }

      // Process each operation
      for (const operation of enabledOperations) {
        try {
          await this.processOperation(operation);

          // Small delay between operations to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, this.CHECK_DELAY_MS));
        } catch (error) {
          console.error(
            `❌ [OpsManagerScheduler] Error processing operation ${operation.id}:`,
            error instanceof Error ? error.message : error
          );
          // Continue with next operation even if one fails
        }
      }

      console.log("✅ [OpsManagerScheduler] Hourly check completed");
    } catch (error) {
      console.error(
        "❌ [OpsManagerScheduler] Fatal error during check:",
        error instanceof Error ? error.message : error
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a single operation
   * Checks for active workflows and starts new one if needed
   */
  private async processOperation(operation: typeof operations.$inferSelect): Promise<void> {
    console.log(`🔍 [OpsManagerScheduler] Processing operation: ${operation.name} (${operation.id})`);

    // Check for existing active workflows
    const activeWorkflow = await this.getActiveWorkflow(operation.id);

    if (activeWorkflow) {
      console.log(
        `⏸️  [OpsManagerScheduler] Skipping operation ${operation.id} - active workflow ${activeWorkflow.id} already running`
      );
      return;
    }

    // Start new workflow
    console.log(`🚀 [OpsManagerScheduler] Starting new ops management workflow for operation ${operation.id}`);

    try {
      const workflow = await opsManagementOrchestrator.startOpsManagementWorkflow(
        operation.id,
        `Hourly Operations Management - ${new Date().toISOString()}`
      );

      console.log(`✅ [OpsManagerScheduler] Started workflow ${workflow.id} for operation ${operation.id}`);
    } catch (error) {
      console.error(
        `❌ [OpsManagerScheduler] Failed to start workflow for operation ${operation.id}:`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Check if an operation already has an active ops management workflow
   */
  private async getActiveWorkflow(operationId: string): Promise<typeof agentWorkflows.$inferSelect | null> {
    const workflows = await db
      .select()
      .from(agentWorkflows)
      .where(
        and(
          eq(agentWorkflows.operationId, operationId),
          eq(agentWorkflows.workflowType, "ops_management_hourly"),
          isNull(agentWorkflows.completedAt)
        )
      )
      .limit(1);

    return workflows.length > 0 ? workflows[0] : null;
  }

  /**
   * Manually trigger a workflow for an operation
   * Used for testing or immediate execution
   */
  async triggerNow(operationId: string): Promise<string> {
    console.log(`🔨 [OpsManagerScheduler] Manual trigger for operation ${operationId}`);

    const operation = await db
      .select()
      .from(operations)
      .where(eq(operations.id, operationId))
      .limit(1);

    if (operation.length === 0) {
      throw new Error(`Operation ${operationId} not found`);
    }

    const workflow = await opsManagementOrchestrator.startOpsManagementWorkflow(
      operationId,
      `Manual Trigger - ${new Date().toISOString()}`
    );

    console.log(`✅ [OpsManagerScheduler] Manually started workflow ${workflow.id}`);
    return workflow.id;
  }

  /**
   * Get scheduler status
   */
  getStatus(): { running: boolean; nextRun: Date | null; isProcessing: boolean } {
    return {
      running: this.interval !== null,
      nextRun: this.interval ? new Date(Date.now() + this.INTERVAL_MS) : null,
      isProcessing: this.isRunning,
    };
  }
}

// Singleton instance
export const opsManagerScheduler = new OpsManagerScheduler();
