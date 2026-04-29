/**
 * CTI Feed Ingestor (v2.9.1 Phase 7, seam S6)
 *
 * Cron-driven and on-demand ingestion of external CTI feeds. Supports
 * TAXII 2.1 and RSS today; the other source kinds (json/atom/github) are
 * routed but not implemented in this slice.
 *
 * Pipeline per source per run:
 *   1. Insert a `cti_ingestion_runs` row (status=running) for audit.
 *   2. Fetch normalized items via the kind-specific fetcher.
 *   3. Dedup by content_hash; upsert into cti_items by (source_id,
 *      external_id).
 *   4. Best-effort batch-embed (skipped when no embedding provider).
 *   5. Mark run completed with counts; update source.last_run_at /
 *      last_run_status so the UI can show staleness.
 *
 * Errors at any step land on `errorMessage` of the run row but never
 * throw out — one bad source doesn't block the rest of the cycle.
 */

import { CronJob } from "cron";
import { XMLParser } from "fast-xml-parser";
import { createHash } from "crypto";
import { db } from "../../db";
import {
  ctiSources,
  ctiIngestionRuns,
  ctiItems,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { fetchTaxiiObjects, type TaxiiObject } from "./taxii-client";
import { embedder, EmbedderError } from "./embedder";

const EMBED_BATCH = 16;
const SUMMARY_MAX = 4_000;

type SourceRow = typeof ctiSources.$inferSelect;

interface NormalizedItem {
  externalId: string;
  title?: string;
  summary?: string;
  link?: string;
  publishedAt?: Date;
  tags?: string[];
  rawJson?: unknown;
}

function hashItem(item: NormalizedItem): string {
  const h = createHash("sha256");
  h.update(item.externalId);
  if (item.title) h.update(item.title);
  if (item.summary) h.update(item.summary);
  if (item.link) h.update(item.link);
  return h.digest("hex");
}

// ---------------------------------------------------------------------------
// Per-kind fetchers
// ---------------------------------------------------------------------------

function trim(value?: string | null, max = SUMMARY_MAX): string | undefined {
  if (!value) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

function asDate(value: unknown): Date | undefined {
  if (!value || typeof value !== "string") return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function fetchTaxii(source: SourceRow): Promise<NormalizedItem[]> {
  if (!source.collection) {
    throw new Error("TAXII source requires a collection");
  }
  const objects = await fetchTaxiiObjects({
    url: source.url,
    collection: source.collection,
    authHeaders: (source.authHeaders as Record<string, string> | null) ?? null,
    addedAfter: source.lastRunAt ? source.lastRunAt.toISOString() : undefined,
  });

  return objects.map((obj: TaxiiObject) => {
    const title = (obj as any).name as string | undefined;
    const description = (obj as any).description as string | undefined;
    const labels = Array.isArray((obj as any).labels) ? ((obj as any).labels as string[]) : [];
    const refs = Array.isArray((obj as any).external_references)
      ? ((obj as any).external_references as Array<{ url?: string }>)
      : [];
    return {
      externalId: obj.id,
      title: trim(title, 500),
      summary: trim(description),
      link: refs.find((r) => r?.url)?.url,
      publishedAt: asDate(obj.modified ?? obj.created),
      tags: [obj.type, ...labels].filter(Boolean),
      rawJson: obj,
    };
  });
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
});

async function fetchRss(source: SourceRow): Promise<NormalizedItem[]> {
  const headers: Record<string, string> = {
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    ...((source.authHeaders as Record<string, string> | null) ?? {}),
  };
  const res = await fetch(source.url, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`RSS fetch failed (${res.status})`);
  }
  const xml = await res.text();
  const parsed: any = xmlParser.parse(xml);
  // Support both RSS 2 (`rss.channel.item`) and Atom (`feed.entry`).
  const items: any[] =
    parsed?.rss?.channel?.item ??
    parsed?.feed?.entry ??
    [];
  const list = Array.isArray(items) ? items : [items];

  return list
    .filter(Boolean)
    .map((it: any) => {
      const id =
        it.guid?.["#text"] ||
        it.guid ||
        it.id ||
        it.link ||
        `${source.url}#${it.title}`;
      const link =
        typeof it.link === "string"
          ? it.link
          : it.link?.["@_href"] || it.link?.["#text"];
      return {
        externalId: String(id),
        title: trim(it.title?.["#text"] ?? it.title, 500),
        summary: trim(it.description?.["#text"] ?? it.description ?? it.summary),
        link: typeof link === "string" ? link : undefined,
        publishedAt: asDate(it.pubDate ?? it.published ?? it.updated),
        tags: Array.isArray(it.category)
          ? (it.category.map((c: any) => (typeof c === "string" ? c : c?.["#text"])) as string[])
          : it.category
            ? [String(it.category)]
            : [],
        rawJson: it,
      };
    });
}

async function fetchUnsupported(source: SourceRow): Promise<NormalizedItem[]> {
  throw new Error(
    `Source kind '${source.kind}' fetcher is not implemented yet. Open a follow-up issue.`,
  );
}

function pickFetcher(kind: string) {
  switch (kind) {
    case "taxii":
      return fetchTaxii;
    case "rss":
    case "atom":
      return fetchRss;
    default:
      return fetchUnsupported;
  }
}

// ---------------------------------------------------------------------------
// Ingestor
// ---------------------------------------------------------------------------

class CtiFeedIngestor {
  private cron: CronJob | null = null;

  /** Hourly cycle that polls every enabled source whose cadence has elapsed. */
  startCronLoop(spec = "0 */15 * * * *"): void {
    if (this.cron || process.env.NODE_ENV === "test") return;
    this.cron = new CronJob(
      spec,
      () => {
        this.runDueSources().catch((err) =>
          console.warn("[cti] cron tick failed:", err),
        );
      },
      null,
      true,
    );
  }

  stopCronLoop(): void {
    this.cron?.stop();
    this.cron = null;
  }

  /** Walk all enabled sources whose cadence has elapsed and ingest them. */
  async runDueSources(): Promise<void> {
    const now = Date.now();
    const all = await db.select().from(ctiSources).where(eq(ctiSources.enabled, true));
    for (const source of all) {
      const last = source.lastRunAt?.getTime() ?? 0;
      if (now - last < source.cadenceSeconds * 1000) continue;
      try {
        await this.runSource(source.id);
      } catch (err) {
        console.warn(`[cti] source ${source.name} run failed:`, err);
      }
    }
  }

  /** Force a single-source run; used by manual refresh + the cron loop. */
  async runSource(sourceId: string): Promise<{
    runId: string;
    seen: number;
    inserted: number;
    updated: number;
    error?: string;
  }> {
    const [source] = await db.select().from(ctiSources).where(eq(ctiSources.id, sourceId));
    if (!source) throw new Error(`Source ${sourceId} not found`);

    const [run] = await db
      .insert(ctiIngestionRuns)
      .values({ sourceId, status: "running" })
      .returning({ id: ctiIngestionRuns.id });

    try {
      const fetcher = pickFetcher(source.kind);
      const items = await fetcher(source);

      const seen = items.length;
      let inserted = 0;
      let updated = 0;

      // 1) Upsert items, capturing the ones that need a fresh embedding.
      const toEmbed: { id: string; text: string }[] = [];

      for (const item of items) {
        const hash = hashItem(item);
        const existing = await db
          .select({ id: ctiItems.id, contentHash: ctiItems.contentHash })
          .from(ctiItems)
          .where(
            sql`${ctiItems.sourceId} = ${sourceId} AND ${ctiItems.externalId} = ${item.externalId}`,
          )
          .limit(1);

        if (existing.length === 0) {
          const inserted_row = await db
            .insert(ctiItems)
            .values({
              sourceId,
              externalId: item.externalId,
              title: item.title,
              summary: item.summary,
              link: item.link,
              publishedAt: item.publishedAt,
              tags: (item.tags ?? []) as any,
              rawJson: item.rawJson as any,
              contentHash: hash,
            })
            .returning({ id: ctiItems.id });
          inserted++;
          const text = `${item.title ?? ""}\n${item.summary ?? ""}`.trim();
          if (text && inserted_row[0]?.id) toEmbed.push({ id: inserted_row[0].id, text });
        } else if (existing[0].contentHash !== hash) {
          await db
            .update(ctiItems)
            .set({
              title: item.title,
              summary: item.summary,
              link: item.link,
              publishedAt: item.publishedAt,
              tags: (item.tags ?? []) as any,
              rawJson: item.rawJson as any,
              contentHash: hash,
              updatedAt: new Date(),
            })
            .where(eq(ctiItems.id, existing[0].id));
          updated++;
          const text = `${item.title ?? ""}\n${item.summary ?? ""}`.trim();
          if (text) toEmbed.push({ id: existing[0].id, text });
        }
      }

      // 2) Best-effort embedding in batches.
      for (let i = 0; i < toEmbed.length; i += EMBED_BATCH) {
        const batch = toEmbed.slice(i, i + EMBED_BATCH);
        try {
          const result = await embedder.embed(batch.map((b) => b.text));
          if (!result) break; // No embedding provider configured; stop trying.
          for (let j = 0; j < batch.length; j++) {
            await db
              .update(ctiItems)
              .set({ embedding: result.vectors[j] as any })
              .where(eq(ctiItems.id, batch[j].id));
          }
        } catch (err) {
          // Surface dimension mismatches once; log transport issues and continue
          // with the next batch (rest of the run shouldn't fail because of
          // one slow embedding response).
          if (err instanceof EmbedderError && err.code === "dimension_mismatch") {
            console.warn(`[cti] embedding skipped: ${err.message}`);
            break;
          }
          console.warn("[cti] embedding batch failed:", err);
        }
      }

      const finishedAt = new Date();
      const status: "ok" | "partial" = inserted + updated < seen ? "partial" : "ok";
      await db
        .update(ctiIngestionRuns)
        .set({
          status,
          finishedAt,
          itemsSeen: seen,
          itemsNew: inserted,
          itemsUpdated: updated,
        })
        .where(eq(ctiIngestionRuns.id, run.id));

      await db
        .update(ctiSources)
        .set({
          lastRunAt: finishedAt,
          lastRunStatus: status,
          updatedAt: finishedAt,
        })
        .where(eq(ctiSources.id, sourceId));

      return { runId: run.id, seen, inserted, updated };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown ingestor error";
      const finishedAt = new Date();
      await db
        .update(ctiIngestionRuns)
        .set({
          status: "failed",
          finishedAt,
          errorMessage: message,
        })
        .where(eq(ctiIngestionRuns.id, run.id));
      await db
        .update(ctiSources)
        .set({
          lastRunAt: finishedAt,
          lastRunStatus: "failed",
          updatedAt: finishedAt,
        })
        .where(eq(ctiSources.id, sourceId));
      return { runId: run.id, seen: 0, inserted: 0, updated: 0, error: message };
    }
  }
}

export const ctiFeedIngestor = new CtiFeedIngestor();

if (process.env.RTPI_CTI_ENABLED === "true" || process.env.RTPI_CTI_ENABLED === "1") {
  ctiFeedIngestor.startCronLoop();
}
