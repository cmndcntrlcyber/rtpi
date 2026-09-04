import type { ProbeResult } from './deterministic-probe';

interface CacheEntry {
  result: ProbeResult;
  storedAt: number;
}

export class ProbeCache {
  private cache = new Map<string, CacheEntry>();
  private ttlMs: number;

  constructor(ttlMs?: number) {
    this.ttlMs = ttlMs ?? (Number(process.env.PROBE_CACHE_TTL_MS) || 900_000);
  }

  get(targetUrl: string): ProbeResult | null {
    const key = this.normalizeUrl(targetUrl);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.storedAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }

  set(targetUrl: string, result: ProbeResult): void {
    const key = this.normalizeUrl(targetUrl);
    this.cache.set(key, { result, storedAt: Date.now() });
  }

  invalidate(targetUrl: string): void {
    const key = this.normalizeUrl(targetUrl);
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url.includes('://') ? url : `https://${url}`);
      parsed.hostname = parsed.hostname.toLowerCase();
      parsed.hash = '';
      let path = parsed.pathname;
      if (path.endsWith('/') && path.length > 1) {
        path = path.slice(0, -1);
      }
      parsed.pathname = path;
      return parsed.toString();
    } catch {
      return url.toLowerCase().replace(/\/$/, '').replace(/#.*$/, '');
    }
  }
}

export const probeCache = new ProbeCache();
