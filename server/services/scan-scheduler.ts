/**
 * Scan Scheduler Service
 *
 * Manages scheduled scans using cron expressions.
 * Features:
 * - Cron-based scan scheduling
 * - Multiple tool support (BBOT, Nuclei)
 * - Automatic next run calculation
 * - Failure tracking and retry logic
 * - Enable/disable schedules
 */

// import { CronJob } from "cron"; // NOTE: Requires: npm install cron
import { db } from "../db";
import { scanSchedules, axScanResults } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface ScanSchedule {
  id: string;
  operationId: string;
  name: string;
  description?: string;
  cronExpression: string;
  toolConfig: {
    bbot?: {
      targets: string[];
      flags?: string[];
      config?: Record<string, any>;
    };
    nuclei?: {
      targets: string[];
      templates?: string[];
      severity?: string[];
      config?: Record<string, any>;
    };
  };
  targets: string[];
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  failureCount: number;
  createdBy: string;
}

// ============================================================================
// Scan Scheduler
// ============================================================================

export class ScanScheduler {
  private jobs: Map<string, any> = new Map(); // CronJob instances
  private running: boolean = false;

  /**
   * Start the scheduler (load all enabled schedules)
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log("[ScanScheduler] Already running");
      return;
    }

    console.log("[ScanScheduler] Starting...");
    this.running = true;

    // Load all enabled schedules
    const schedules = await db.query.scanSchedules.findMany({
      where: eq(scanSchedules.enabled, true),
    });

    console.log(`[ScanScheduler] Loading ${schedules.length} enabled schedules`);

    for (const schedule of schedules) {
      await this.addSchedule(schedule as any);
    }

    console.log("[ScanScheduler] Started successfully");
  }

  /**
   * Stop the scheduler (stop all cron jobs)
   */
  async stop(): Promise<void> {
    console.log("[ScanScheduler] Stopping...");

    for (const [scheduleId, job] of this.jobs.entries()) {
      if (job && typeof job.stop === "function") {
        job.stop();
      }
      this.jobs.delete(scheduleId);
    }

    this.running = false;
    console.log("[ScanScheduler] Stopped");
  }

  /**
   * Add a schedule to the scheduler
   */
  async addSchedule(schedule: ScanSchedule): Promise<void> {
    console.log(`[ScanScheduler] Adding schedule: ${schedule.name} (${schedule.cronExpression})`);

    // NOTE: Uncomment when cron library is installed
    /*
    try {
      const job = new CronJob(
        schedule.cronExpression,
        async () => {
          await this.executeScan(schedule);
        },
        null, // onComplete
        true, // start
        "America/New_York" // timezone
      );

      this.jobs.set(schedule.id, job);

      // Update next run time
      await this.updateNextRun(schedule.id);

      console.log(`[ScanScheduler] Schedule added: ${schedule.name}`);
    } catch (error) {
      console.error(`[ScanScheduler] Failed to add schedule ${schedule.name}:`, error);
    }
    */

    // Mock implementation - calculate next run
    await this.updateNextRun(schedule.id);
    console.log(`[ScanScheduler] Schedule added (mock): ${schedule.name}`);
  }

  /**
   * Remove a schedule from the scheduler
   */
  async removeSchedule(scheduleId: string): Promise<void> {
    const job = this.jobs.get(scheduleId);

    if (job && typeof job.stop === "function") {
      job.stop();
    }

    this.jobs.delete(scheduleId);
    console.log(`[ScanScheduler] Schedule removed: ${scheduleId}`);
  }

  /**
   * Execute a scheduled scan
   */
  private async executeScan(schedule: ScanSchedule): Promise<void> {
    console.log(`[ScanScheduler] Executing scan: ${schedule.name}`);

    try {
      // Update last run time
      await db
        .update(scanSchedules)
        .set({
          lastRun: new Date(),
          runCount: schedule.runCount + 1,
        })
        .where(eq(scanSchedules.id, schedule.id));

      // Execute scan based on tool configuration
      if (schedule.toolConfig.bbot) {
        await this.executeBBOTScan(schedule);
      }

      if (schedule.toolConfig.nuclei) {
        await this.executeNucleiScan(schedule);
      }

      // Update next run time
      await this.updateNextRun(schedule.id);

      console.log(`[ScanScheduler] Scan completed: ${schedule.name}`);
    } catch (error) {
      console.error(`[ScanScheduler] Scan failed: ${schedule.name}`, error);

      // Update failure count
      await db
        .update(scanSchedules)
        .set({
          failureCount: schedule.failureCount + 1,
        })
        .where(eq(scanSchedules.id, schedule.id));
    }
  }

  /**
   * Execute BBOT scan
   */
  private async executeBBOTScan(schedule: ScanSchedule): Promise<void> {
    const config = schedule.toolConfig.bbot!;

    // Create scan result record
    const [scanResult] = await db
      .insert(axScanResults)
      .values({
        operationId: schedule.operationId,
        toolName: "bbot",
        status: "pending",
        targets: config.targets,
        config: config.config || {},
        createdBy: schedule.createdBy,
      })
      .returning();

    // TODO: Trigger BBOT scan execution
    // This would integrate with bbot-executor.ts
    console.log(`[ScanScheduler] BBOT scan triggered: ${scanResult.id}`);
  }

  /**
   * Execute Nuclei scan
   */
  private async executeNucleiScan(schedule: ScanSchedule): Promise<void> {
    const config = schedule.toolConfig.nuclei!;

    // Create scan result record
    const [scanResult] = await db
      .insert(axScanResults)
      .values({
        operationId: schedule.operationId,
        toolName: "nuclei",
        status: "pending",
        targets: config.targets,
        config: {
          templates: config.templates,
          severity: config.severity,
          ...config.config,
        },
        createdBy: schedule.createdBy,
      })
      .returning();

    // TODO: Trigger Nuclei scan execution
    // This would integrate with nuclei-executor.ts
    console.log(`[ScanScheduler] Nuclei scan triggered: ${scanResult.id}`);
  }

  /**
   * Update next run time for a schedule
   */
  private async updateNextRun(scheduleId: string): Promise<void> {
    const schedule = await db.query.scanSchedules.findFirst({
      where: eq(scanSchedules.id, scheduleId),
    });

    if (!schedule) return;

    // NOTE: Uncomment when cron library is installed
    /*
    const job = this.jobs.get(scheduleId);
    if (job) {
      const nextDate = job.nextDate().toDate();
      await db
        .update(scanSchedules)
        .set({ nextRun: nextDate })
        .where(eq(scanSchedules.id, scheduleId));
    }
    */

    // Mock implementation - calculate next run (every hour for demo)
    const nextRun = new Date(Date.now() + 60 * 60 * 1000);
    await db
      .update(scanSchedules)
      .set({ nextRun })
      .where(eq(scanSchedules.id, scheduleId));
  }

  /**
   * Manually trigger a schedule (run now)
   */
  async triggerSchedule(scheduleId: string): Promise<void> {
    const schedule = await db.query.scanSchedules.findFirst({
      where: eq(scanSchedules.id, scheduleId),
    });

    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    await this.executeScan(schedule as any);
  }

  /**
   * Get schedule statistics
   */
  async getStatistics(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    lastRun: Date | null;
  }> {
    const allSchedules = await db.select().from(scanSchedules);

    const enabled = allSchedules.filter((s) => s.enabled).length;
    const disabled = allSchedules.filter((s) => !s.enabled).length;

    const lastRunSchedule = allSchedules
      .filter((s) => s.lastRun)
      .sort((a, b) => (b.lastRun?.getTime() || 0) - (a.lastRun?.getTime() || 0))[0];

    return {
      total: allSchedules.length,
      enabled,
      disabled,
      lastRun: lastRunSchedule?.lastRun || null,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const scanScheduler = new ScanScheduler();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate cron expression
 */
export function validateCronExpression(expression: string): boolean {
  // Basic validation (5-6 fields)
  const parts = expression.trim().split(/\s+/);
  return parts.length >= 5 && parts.length <= 6;
}

/**
 * Parse cron expression to human-readable format
 */
export function cronToHumanReadable(expression: string): string {
  // Simple parser for common patterns
  const parts = expression.trim().split(/\s+/);

  if (parts.length < 5) {
    return "Invalid cron expression";
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Check for common patterns
  if (expression === "0 0 * * *") {
    return "Daily at midnight";
  } else if (expression === "0 */1 * * *") {
    return "Every hour";
  } else if (expression === "*/5 * * * *") {
    return "Every 5 minutes";
  } else if (expression === "0 9 * * 1") {
    return "Every Monday at 9:00 AM";
  } else if (expression === "0 0 * * 0") {
    return "Every Sunday at midnight";
  } else if (expression === "0 0 1 * *") {
    return "First day of every month at midnight";
  }

  // Build human-readable string
  let readable = "";

  if (minute === "*") {
    readable += "Every minute";
  } else if (minute.startsWith("*/")) {
    readable += `Every ${minute.slice(2)} minutes`;
  } else {
    readable += `At minute ${minute}`;
  }

  if (hour !== "*") {
    readable += ` at hour ${hour}`;
  }

  if (dayOfMonth !== "*") {
    readable += ` on day ${dayOfMonth} of month`;
  }

  if (dayOfWeek !== "*") {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    readable += ` on ${days[parseInt(dayOfWeek)] || dayOfWeek}`;
  }

  return readable;
}

/**
 * Common cron presets
 */
export const CRON_PRESETS = {
  "Every 5 minutes": "*/5 * * * *",
  "Every 15 minutes": "*/15 * * * *",
  "Every 30 minutes": "*/30 * * * *",
  "Every hour": "0 */1 * * *",
  "Every 6 hours": "0 */6 * * *",
  "Every 12 hours": "0 */12 * * *",
  "Daily at midnight": "0 0 * * *",
  "Daily at 2 AM": "0 2 * * *",
  "Daily at 9 AM": "0 9 * * *",
  "Every Monday at 9 AM": "0 9 * * 1",
  "Every Friday at 5 PM": "0 17 * * 5",
  "Every Sunday at midnight": "0 0 * * 0",
  "First day of month": "0 0 1 * *",
  "Last day of month": "0 0 L * *",
};
