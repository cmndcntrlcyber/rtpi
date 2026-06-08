/**
 * ReconAgent (FF_BUG_HUNTER) — phase 2.
 *
 * Drives the BBOT-backed surface assessment with bug-hunter framing.
 * Delegates to surface-assessment-agent for actual scanning so we don't
 * duplicate BBOT plumbing, then post-processes results to emit a bug-
 * hunter-shaped surface inventory and tag the resulting memories with
 * `bh:recon` for downstream agents.
 *
 * Inference: any reasoning happens via routeReasoning (Settings →
 * qwen3:14b by default).
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { discoveredAssets, discoveredServices, targets } from "@shared/schema";
import { BaseTaskAgent, type TaskDefinition, type TaskResult } from "../base-task-agent";

export class ReconAgent extends BaseTaskAgent {
  constructor() {
    super("Bug Hunter — Recon", "bug_hunter_recon", [
      "subdomain_enum",
      "tech_detect",
      "url_crawl",
      "surface_inventory",
    ]);
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    if (task.taskType !== "bug_hunter_recon") {
      return { success: false, error: `Unsupported task type: ${task.taskType}` };
    }
    if (!task.operationId || !task.targetId) {
      return { success: false, error: "operationId and targetId required" };
    }
    await this.updateStatus("running");

    try {
      // Confirm target exists and read its value for reporting.
      const [target] = await db
        .select()
        .from(targets)
        .where(eq(targets.id, task.targetId))
        .limit(1);
      if (!target) return { success: false, error: `target ${task.targetId} not found` };

      // Trigger surface-assessment-agent if available. Lazy import to keep
      // the bug-hunter module loadable even when the assessment agent is
      // disabled or its dependencies aren't initialized.
      let assessmentSummary: unknown = null;
      try {
        const mod = await import("../surface-assessment-agent");
        const agent = (mod as Record<string, unknown>)["surfaceAssessmentAgent"];
        if (agent && typeof (agent as { runScan?: unknown }).runScan === "function") {
          const presetFromTask = (task.parameters?.preset as string | undefined) ?? "kitchen-sink";
          assessmentSummary = await (agent as { runScan: (operationId: string, preset?: string) => Promise<unknown> })
            .runScan(task.operationId, presetFromTask);
        }
      } catch (err) {
        console.warn("[ReconAgent] surface-assessment delegation failed (continuing):", err);
      }

      // Read whatever the assessment produced (or the data already present
      // from a prior recon) and assemble a bug-hunter surface summary.
      const assets = await db
        .select()
        .from(discoveredAssets)
        .where(eq(discoveredAssets.operationId, task.operationId));
      const assetIdSet = new Set(assets.map((a) => a.id));
      const allServices = assetIdSet.size > 0
        ? await db.select().from(discoveredServices)
        : [];
      const services = allServices.filter((s) => assetIdSet.has(s.assetId));

      const surface = {
        assetsByType: countBy(assets, (a) => a.type),
        servicesByPort: countBy(services, (s) => `${s.port}/${s.protocol ?? "tcp"}`),
        hosts: assets.filter((a) => a.type === "host").length,
        domains: assets.filter((a) => a.type === "domain").length,
        urls: assets.filter((a) => a.type === "url").length,
        technologies: assets.filter((a) => a.type === "technology").length,
      };

      const result: TaskResult = {
        success: true,
        data: {
          targetId: target.id,
          targetValue: target.value,
          assessmentSummary,
          surface,
          assetIds: assets.slice(0, 200).map((a) => a.id),
        },
      };
      await this.storeTaskMemory({ task, result, memoryType: "fact" });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    } finally {
      await this.updateStatus("idle");
    }
  }
}

function countBy<T>(rows: T[], key: (r: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r) ?? "unknown";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export const reconAgent = new ReconAgent();
