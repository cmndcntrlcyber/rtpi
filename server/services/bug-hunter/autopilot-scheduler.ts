/**
 * Bug-Hunter Autopilot Scheduler (FF_BUG_HUNTER).
 *
 * Polls operations that have opted into bug-hunter autopilot
 * (operations.metadata.bugHunterAutopilot = true) and triggers a fresh
 * Hunt → Chain → Validate cycle each interval. The Scope/Recon phases
 * are skipped on recurring runs — those produce the surface inventory
 * that subsequent passes work against.
 *
 * Modeled on ops-manager-scheduler.ts:
 *   - simple setInterval (avoids cron-string ambiguity)
 *   - re-entrancy guard (isRunning)
 *   - per-op timeout via Promise.race
 *
 * Configuration is per-operation:
 *   metadata.bugHunterAutopilot = {
 *     enabled: true,
 *     intervalMs: 3_600_000,        // optional override
 *     phases: ["hunt","chain","validate"],
 *     mode: "wapt"|"redteam",
 *     box: "blackbox"|"greybox",
 *     lastRunAt: 1716230400000
 *   }
 */

import { eq } from "drizzle-orm";
import { db } from "../../db";
import { operations, targets } from "@shared/schema";
import { agentWorkflowOrchestrator } from "../agent-workflow-orchestrator";
import { createLogger } from '../../lib/logger';
const log = createLogger("autopilot-scheduler");

interface AutopilotConfig {
  enabled?: boolean;
  intervalMs?: number;
  phases?: Array<"scope" | "recon" | "hunt" | "chain" | "validate" | "capture" | "report">;
  mode?: "redteam" | "wapt";
  box?: "blackbox" | "greybox";
  lastRunAt?: number;
  targetId?: string;
}

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // poll every 5 minutes
const PER_RUN_TIMEOUT_MS = 60 * 1000; // budget for *starting* the workflow; the workflow itself runs async

class BugHunterAutopilot {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(): void {
    if (!isFlagEnabled()) {
      log.info("[bug-hunter-autopilot] FF_BUG_HUNTER not set — scheduler dormant");
      return;
    }
    if (this.interval) {
      log.info("[bug-hunter-autopilot] already running");
      return;
    }
    log.info("[bug-hunter-autopilot] starting; poll every", CHECK_INTERVAL_MS / 1000, "s");
    // Don't fire immediately on boot — give the rest of the stack ~30s to settle.
    setTimeout(() => this.tick().catch((err) => log.warn("[bug-hunter-autopilot] tick failed:", err)), 30_000);
    this.interval = setInterval(() => {
      this.tick().catch((err) => log.warn("[bug-hunter-autopilot] tick failed:", err));
    }, CHECK_INTERVAL_MS);
  }

  shutdown(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      log.info("[bug-hunter-autopilot] stopped");
    }
  }

  private async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const ops = await db.select().from(operations).where(eq(operations.status, "active"));
      const now = Date.now();
      for (const op of ops) {
        const meta = (op.metadata as Record<string, unknown> | null) ?? {};
        const auto = meta.bugHunterAutopilot as AutopilotConfig | undefined;
        if (!auto?.enabled) continue;
        const interval = auto.intervalMs ?? DEFAULT_INTERVAL_MS;
        const last = auto.lastRunAt ?? 0;
        if (now - last < interval) continue;

        // Resolve a target — caller must have stamped one when enabling.
        const targetId = auto.targetId;
        if (!targetId) {
          log.warn(`[bug-hunter-autopilot] op ${op.id}: no targetId — skipping`);
          continue;
        }
        const [target] = await db.select().from(targets).where(eq(targets.id, targetId)).limit(1);
        if (!target) {
          log.warn(`[bug-hunter-autopilot] op ${op.id}: target ${targetId} not found — skipping`);
          continue;
        }

        const phases = auto.phases ?? ["hunt", "chain", "validate"];
        const mode = auto.mode ?? "wapt";

        log.info(`[bug-hunter-autopilot] starting cycle for op ${op.id} (${op.name})`, { phases, mode });

        try {
          await Promise.race([
            agentWorkflowOrchestrator.startBugHunterWorkflow({
              operationId: op.id,
              targetId: target.id,
              userId: op.ownerId,
              mode,
              box: auto.box ?? "blackbox",
              phases,
              name: `Bug-Hunter Autopilot — ${new Date().toISOString().slice(0, 16)}`,
            }),
            new Promise((_resolve, reject) => setTimeout(() => reject(new Error("autopilot start timeout")), PER_RUN_TIMEOUT_MS)),
          ]);

          // Persist the run timestamp so the next tick honors the interval.
          const newMeta = {
            ...meta,
            bugHunterAutopilot: { ...auto, lastRunAt: now },
          };
          await db.update(operations).set({ metadata: newMeta, updatedAt: new Date() }).where(eq(operations.id, op.id));
        } catch (err) {
          log.warn(`[bug-hunter-autopilot] op ${op.id} cycle failed:`, err);
        }
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger — bypasses the interval check. Returns the started
   * workflow id.
   */
  async triggerNow(opts: {
    operationId: string;
    targetId: string;
    userId: string;
    phases?: AutopilotConfig["phases"];
    mode?: AutopilotConfig["mode"];
    box?: AutopilotConfig["box"];
  }): Promise<string> {
    const result = await agentWorkflowOrchestrator.startBugHunterWorkflow({
      operationId: opts.operationId,
      targetId: opts.targetId,
      userId: opts.userId,
      mode: opts.mode ?? "wapt",
      box: opts.box ?? "blackbox",
      phases: opts.phases ?? ["hunt", "chain", "validate"],
      name: `Bug-Hunter Autopilot (manual) — ${new Date().toISOString().slice(0, 16)}`,
    });
    return result.workflow.id;
  }

  /**
   * Toggle autopilot for an operation. Caller supplies the targetId the
   * pilot should always run against.
   */
  async configure(operationId: string, config: AutopilotConfig): Promise<void> {
    const [op] = await db.select().from(operations).where(eq(operations.id, operationId)).limit(1);
    if (!op) throw new Error(`operation ${operationId} not found`);
    const meta = (op.metadata as Record<string, unknown> | null) ?? {};
    const merged = {
      ...meta,
      bugHunterAutopilot: {
        enabled: config.enabled ?? true,
        intervalMs: config.intervalMs ?? DEFAULT_INTERVAL_MS,
        phases: config.phases ?? ["hunt", "chain", "validate"],
        mode: config.mode ?? "wapt",
        box: config.box ?? "blackbox",
        targetId: config.targetId,
        lastRunAt: (meta.bugHunterAutopilot as AutopilotConfig | undefined)?.lastRunAt ?? 0,
      },
    };
    await db.update(operations).set({ metadata: merged, updatedAt: new Date() }).where(eq(operations.id, operationId));
  }
}

function isFlagEnabled(): boolean {
  const v = (process.env.FF_BUG_HUNTER ?? "").toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

export const bugHunterAutopilot = new BugHunterAutopilot();
