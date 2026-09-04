import { createLogger } from "../../lib/logger";

const log = createLogger("memory-router");

export type MemoryTier = "fast" | "deep" | "all";

export interface MemoryScope {
  operationId?: string;
  engagementId?: string;
  agentId?: string;
  category?: string;
}

export interface MemoryHit {
  id: string;
  text: string;
  score: number;
  source: "native" | "mem0" | "kb";
  metadata?: Record<string, unknown>;
}

export interface MemoryAdapter {
  name: string;
  isAvailable(): Promise<boolean>;
  query(text: string, scope: MemoryScope, limit: number): Promise<MemoryHit[]>;
}

const TIER_ADAPTERS: Record<MemoryTier, string[] | null> = {
  fast: ["native"],
  deep: ["native", "mem0"],
  all: null,
};

export class MemoryRouter {
  private adapters: Map<string, MemoryAdapter> = new Map();
  private availabilityCache: Map<
    string,
    { available: boolean; checkedAt: number }
  > = new Map();
  private AVAILABILITY_CACHE_TTL = 60_000;

  registerAdapter(adapter: MemoryAdapter): void {
    this.adapters.set(adapter.name, adapter);
    log.debug({ adapter: adapter.name }, "registered memory adapter");
  }

  async query(
    text: string,
    scope: MemoryScope,
    tier: MemoryTier = "all",
    limit: number = 10,
  ): Promise<MemoryHit[]> {
    const allowedNames = TIER_ADAPTERS[tier];
    const selected: MemoryAdapter[] = [];

    for (const [name, adapter] of Array.from(this.adapters.entries())) {
      if (allowedNames !== null && !allowedNames.includes(name)) continue;
      const available = await this.checkAvailability(adapter);
      if (available) selected.push(adapter);
    }

    if (selected.length === 0) {
      log.warn({ tier }, "no available adapters for tier");
      return [];
    }

    const settled = await Promise.allSettled(
      selected.map((a) => a.query(text, scope, limit)),
    );

    const perAdapterResults: MemoryHit[][] = [];
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled") {
        perAdapterResults.push(result.value);
      } else {
        log.warn(
          { adapter: selected[i].name, err: result.reason },
          "adapter query failed",
        );
      }
    }

    return this.mergeByRRF(perAdapterResults, limit);
  }

  getRegisteredAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  private async checkAvailability(adapter: MemoryAdapter): Promise<boolean> {
    const cached = this.availabilityCache.get(adapter.name);
    const now = Date.now();
    if (cached && now - cached.checkedAt < this.AVAILABILITY_CACHE_TTL) {
      return cached.available;
    }

    try {
      const available = await adapter.isAvailable();
      this.availabilityCache.set(adapter.name, { available, checkedAt: now });
      return available;
    } catch {
      this.availabilityCache.set(adapter.name, {
        available: false,
        checkedAt: now,
      });
      return false;
    }
  }

  private mergeByRRF(
    adapterResults: MemoryHit[][],
    limit: number,
  ): MemoryHit[] {
    const K = 60;
    const scores = new Map<string, number>();
    const hitMap = new Map<string, MemoryHit>();

    for (const results of adapterResults) {
      for (let rank = 0; rank < results.length; rank++) {
        const hit = results[rank];
        const rrf = 1 / (K + rank + 1);
        scores.set(hit.id, (scores.get(hit.id) || 0) + rrf);
        if (!hitMap.has(hit.id)) {
          hitMap.set(hit.id, hit);
        }
      }
    }

    const merged = Array.from(hitMap.values()).map((hit) => ({
      ...hit,
      score: scores.get(hit.id) || 0,
    }));

    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, limit);
  }
}

export const memoryRouter = new MemoryRouter();
