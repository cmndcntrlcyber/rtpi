import { CronJob } from "cron";
import { db } from "../db";
import { auditLogs } from "@shared/schema";
import { sql, lt } from "drizzle-orm";
import { createLogger } from "../lib/logger";

const log = createLogger("audit-log-cleanup");

const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || "90", 10);

let cleanupJob: CronJob | null = null;

async function runCleanup() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await db
      .delete(auditLogs)
      .where(lt(auditLogs.timestamp, cutoff));

    const count = (result as any)?.rowCount ?? (result as any)?.count ?? 0;
    if (count > 0) {
      log.info({ deleted: count, retentionDays }, "Audit log cleanup completed");
    }
  } catch (error) {
    log.error({ err: error }, "Audit log cleanup failed");
  }
}

export function startAuditLogCleanup() {
  cleanupJob = new CronJob("0 3 * * *", runCleanup, null, true, "UTC");
  log.info({ retentionDays, schedule: "daily at 03:00 UTC" }, "Audit log cleanup scheduled");
}

export function stopAuditLogCleanup() {
  cleanupJob?.stop();
}
