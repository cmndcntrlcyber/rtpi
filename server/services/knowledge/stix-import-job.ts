/**
 * STIX Import Job (v2.9.1 Phase 7, seam S7)
 *
 * Wraps the existing `stix-parser` (ATT&CK) and `atlas-stix-parser` services
 * with scheduling + audit. Two scheduled cycles:
 *   - ATLAS:  daily   (small bundle, fast)
 *   - ATT&CK: weekly  (large bundle, slow + heavier on the DB)
 *
 * On-demand entry points:
 *   - importBundle(source, bundle, taxiiCollection?) — used by upload endpoint
 *   - refreshAtlas() / refreshAttck() — used by manual-refresh endpoints
 *
 * Every run writes an `stix_import_runs` row capturing object counts and any
 * errors for observability.
 */

import { CronJob } from "cron";
import { db } from "../../db";
import { stixImportRuns } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  importSTIXBundle,
  type STIXBundle,
  type ImportStats,
} from "../stix-parser";
import {
  importATLASSTIXBundle,
  type ATLASImportStats,
} from "../atlas-stix-parser";

const ATLAS_BUNDLE_URL =
  process.env.ATLAS_BUNDLE_URL ||
  "https://raw.githubusercontent.com/mitre-atlas/ai-risk-database/main/dist/stix-bundles/atlas-bundle.json";
const ATTCK_BUNDLE_URL =
  process.env.ATTCK_BUNDLE_URL ||
  "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json";

type ImportSource = "atlas" | "attck" | "custom";

function totalImported(stats: ImportStats | ATLASImportStats): {
  total: number;
  imported: number;
  skipped: number;
  errors: any[];
} {
  // Both stat shapes share their numeric fields; the union of counters is
  // the conservative aggregate.
  const numeric: Record<string, number> = {};
  for (const [k, v] of Object.entries(stats)) {
    if (typeof v === "number") numeric[k] = v;
  }
  const imported = Object.values(numeric).reduce((sum, n) => sum + n, 0);
  return {
    total: imported, // STIX import doesn't track input total directly
    imported,
    skipped: 0,
    errors: (stats as any).errors ?? [],
  };
}

async function fetchBundle(url: string): Promise<STIXBundle> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Bundle fetch failed (${res.status}): ${url}`);
  return (await res.json()) as STIXBundle;
}

class StixImportJob {
  private atlasCron: CronJob | null = null;
  private attckCron: CronJob | null = null;

  startCron(): void {
    if (process.env.NODE_ENV === "test") return;
    if (process.env.RTPI_CTI_ENABLED !== "true" && process.env.RTPI_CTI_ENABLED !== "1") {
      return;
    }
    if (!this.atlasCron) {
      this.atlasCron = new CronJob(
        "0 30 3 * * *", // 03:30 daily
        () => {
          this.refreshAtlas().catch((err) =>
            console.warn("[stix] ATLAS daily refresh failed:", err),
          );
        },
        null,
        true,
      );
    }
    if (!this.attckCron) {
      this.attckCron = new CronJob(
        "0 45 4 * * 0", // 04:45 Sunday
        () => {
          this.refreshAttck().catch((err) =>
            console.warn("[stix] ATT&CK weekly refresh failed:", err),
          );
        },
        null,
        true,
      );
    }
  }

  stopCron(): void {
    this.atlasCron?.stop();
    this.atlasCron = null;
    this.attckCron?.stop();
    this.attckCron = null;
  }

  async refreshAtlas(): Promise<{ runId: string; imported: number; errors: number }> {
    return this.runImport("atlas", async () => {
      const bundle = await fetchBundle(ATLAS_BUNDLE_URL);
      const stats = await importATLASSTIXBundle(bundle);
      return { stats, bundleId: bundle.id, taxiiCollection: null };
    });
  }

  async refreshAttck(): Promise<{ runId: string; imported: number; errors: number }> {
    return this.runImport("attck", async () => {
      const bundle = await fetchBundle(ATTCK_BUNDLE_URL);
      const stats = await importSTIXBundle(bundle);
      return { stats, bundleId: bundle.id, taxiiCollection: null };
    });
  }

  /**
   * Direct entry point for the upload endpoint. The orchestrator chooses
   * which parser to invoke based on the bundle's contents (presence of
   * x-mitre-atlas-* objects implies ATLAS).
   */
  async importBundle(
    source: ImportSource,
    bundle: STIXBundle,
    taxiiCollection: string | null = null,
  ): Promise<{ runId: string; imported: number; errors: number }> {
    return this.runImport(source, async () => {
      const isAtlas =
        bundle.objects.some((o) => o.type?.startsWith("x-mitre-atlas")) ||
        source === "atlas";
      const stats = isAtlas
        ? await importATLASSTIXBundle(bundle)
        : await importSTIXBundle(bundle);
      return { stats, bundleId: bundle.id, taxiiCollection };
    });
  }

  private async runImport(
    source: ImportSource,
    work: () => Promise<{
      stats: ImportStats | ATLASImportStats;
      bundleId: string;
      taxiiCollection: string | null;
    }>,
  ): Promise<{ runId: string; imported: number; errors: number }> {
    const [run] = await db
      .insert(stixImportRuns)
      .values({ source, startedAt: new Date() })
      .returning({ id: stixImportRuns.id });

    try {
      const { stats, bundleId, taxiiCollection } = await work();
      const t = totalImported(stats);
      await db
        .update(stixImportRuns)
        .set({
          bundleId,
          taxiiCollection,
          objectsTotal: t.total,
          objectsImported: t.imported,
          objectsSkipped: t.skipped,
          errors: (t.errors as any).length ? (t.errors as any) : null,
          finishedAt: new Date(),
        })
        .where(eq(stixImportRuns.id, run.id));
      return { runId: run.id, imported: t.imported, errors: t.errors.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .update(stixImportRuns)
        .set({
          finishedAt: new Date(),
          errors: [{ message: msg }] as any,
        })
        .where(eq(stixImportRuns.id, run.id));
      return { runId: run.id, imported: 0, errors: 1 };
    }
  }
}

export const stixImportJob = new StixImportJob();

// Lazy-start cron when CTI is enabled.
stixImportJob.startCron();
