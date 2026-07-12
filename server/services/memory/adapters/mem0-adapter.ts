import { MemoryAdapter, MemoryScope, MemoryHit } from "../memory-router";
import { createLogger } from "../../../lib/logger";

const log = createLogger("mem0-memory-adapter");

export class Mem0MemoryAdapter implements MemoryAdapter {
  name = "mem0";

  private healthCheckCache: { healthy: boolean; checkedAt: number } | null =
    null;

  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (
      this.healthCheckCache &&
      now - this.healthCheckCache.checkedAt < 60_000
    ) {
      return this.healthCheckCache.healthy;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch("http://localhost:8050/health", {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const healthy = res.ok;
      this.healthCheckCache = { healthy, checkedAt: now };
      return healthy;
    } catch {
      this.healthCheckCache = { healthy: false, checkedAt: now };
      return false;
    }
  }

  async query(
    text: string,
    scope: MemoryScope,
    limit: number,
  ): Promise<MemoryHit[]> {
    try {
      const res = await fetch(
        "http://localhost:8050/api/v1/memories/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            user_id: scope.agentId || "system",
            limit,
          }),
        },
      );

      if (!res.ok) {
        log.warn({ status: res.status }, "mem0 search returned non-OK status");
        return [];
      }

      const data = await res.json();
      const results = Array.isArray(data) ? data : data.results || [];

      return results.map((r: any) => ({
        id: r.id,
        text: r.memory,
        score: r.score || 0.5,
        source: "mem0" as const,
        metadata: r.metadata || undefined,
      }));
    } catch (err) {
      log.error({ err }, "mem0 memory query failed");
      return [];
    }
  }
}

export const mem0MemoryAdapter = new Mem0MemoryAdapter();
