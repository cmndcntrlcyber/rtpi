/**
 * Per-provider model availability cache.
 *
 * The router consults this cache to decide whether a Settings-chosen model
 * actually exists on its provider before issuing the call. If the cache has
 * data for the provider and the model isn't present, the router falls
 * through to the next target in its resolution plan; if the cache has no
 * data for the provider (probe never ran or failed), it trusts the name
 * and lets the SDK surface a real 404 — that's the "fail loud" preference
 * over silent fall-through when we genuinely don't know.
 *
 * Populated lazily by `refresh()` (which delegates to
 * `inferenceProviderRegistry.probeAll()`). The Settings UI re-pings this
 * via POST /api/v1/settings/llm/refresh-models when the operator clicks
 * "Refresh models".
 *
 * Note: the constructor is intentionally side-effect-free. Tests can
 * inject a fake state via `__setForTests` without ever touching network.
 */

import {
  inferenceProviderRegistry,
  type ProviderId,
  type ProbeResult,
} from "./inference-provider-registry";

const DEFAULT_TTL_MS = 5 * 60_000; // 5 minutes

type ProviderState = {
  /** Lowercased model ids known to be present on this provider. */
  models: Set<string>;
  /** Timestamp of the last successful probe. 0 if never. */
  lastSuccessAt: number;
  /** True if the last probe attempt succeeded; false if it failed/timed out. */
  lastProbeOk: boolean;
  /** Last probe's raw error, surfaced for diagnostics. */
  lastError?: string;
};

const EMPTY_STATE: ProviderState = {
  models: new Set<string>(),
  lastSuccessAt: 0,
  lastProbeOk: false,
};

class ModelCache {
  private state = new Map<ProviderId, ProviderState>();
  private ttlMs = DEFAULT_TTL_MS;
  private refreshInFlight: Promise<void> | null = null;

  setTtl(ms: number): void {
    this.ttlMs = ms;
  }

  /**
   * True when we have a recent probe AND it succeeded AND the model is
   * present in the cached list. The router treats this as "safe to call".
   */
  isAvailable(provider: ProviderId, model: string): boolean {
    const s = this.state.get(provider);
    if (!s || !s.lastProbeOk) return false;
    if (this.isStale(s)) return false;
    return s.models.has(model.toLowerCase());
  }

  /**
   * True when we have NO authoritative data for this provider (never probed
   * or probe failed or stale). The router uses this to decide whether to
   * "trust the name" (call anyway and let SDK 404) vs. "skip" (cache
   * disagrees, fall through). Returning true means "trust the name".
   */
  isUnknown(provider: ProviderId): boolean {
    const s = this.state.get(provider);
    if (!s) return true;
    if (!s.lastProbeOk) return true;
    if (this.isStale(s)) return true;
    return false;
  }

  /**
   * Cached model list for the provider — read-only, used by the Settings UI.
   * Returns [] when no data is available.
   */
  list(provider: ProviderId): string[] {
    const s = this.state.get(provider);
    if (!s) return [];
    return [...s.models].sort();
  }

  /** Full snapshot, keyed by provider id. */
  snapshot(): Record<ProviderId, { models: string[]; lastProbeOk: boolean; lastError?: string; lastSuccessAt: number }> {
    const out = {} as Record<ProviderId, { models: string[]; lastProbeOk: boolean; lastError?: string; lastSuccessAt: number }>;
    for (const [id, s] of this.state.entries()) {
      out[id] = {
        models: [...s.models].sort(),
        lastProbeOk: s.lastProbeOk,
        lastError: s.lastError,
        lastSuccessAt: s.lastSuccessAt,
      };
    }
    return out;
  }

  /**
   * Probe every provider and update the cache. Coalesces concurrent calls
   * so a flurry of refresh requests doesn't fan out into N probes per
   * provider.
   */
  async refresh(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = (async () => {
      try {
        const results = await inferenceProviderRegistry.probeAll();
        for (const [id, result] of results.entries()) {
          this.ingestProbe(id, result);
        }
      } finally {
        this.refreshInFlight = null;
      }
    })();
    return this.refreshInFlight;
  }

  /** Invalidate the cached state for a single provider (e.g. on Settings save). */
  invalidate(provider: ProviderId): void {
    this.state.delete(provider);
  }

  /** Clear the entire cache. Primarily used by tests. */
  clear(): void {
    this.state.clear();
  }

  /**
   * Convert one provider's probe result into cache state. Exposed for
   * tests / future per-provider refresh flows.
   */
  ingestProbe(provider: ProviderId, result: ProbeResult): void {
    if (result.ok && Array.isArray(result.availableModels)) {
      this.state.set(provider, {
        models: new Set(result.availableModels.map((m) => m.toLowerCase())),
        lastSuccessAt: Date.now(),
        lastProbeOk: true,
        lastError: undefined,
      });
    } else {
      // Preserve the previous successful model list if we have one — the
      // router prefers "stale but real" over "empty unknown" for short
      // outages. The staleness check (isStale) decides which path to take.
      const prev = this.state.get(provider);
      this.state.set(provider, {
        models: prev?.models ?? EMPTY_STATE.models,
        lastSuccessAt: prev?.lastSuccessAt ?? 0,
        lastProbeOk: false,
        lastError: result.error,
      });
    }
  }

  /**
   * Test-only hook. Lets unit tests seed cache state without invoking the
   * registry / network. The double-underscore prefix is the conventional
   * "do not call from app code" marker used elsewhere in this codebase.
   */
  __setForTests(provider: ProviderId, models: string[], opts: { ok?: boolean; lastSuccessAt?: number } = {}): void {
    this.state.set(provider, {
      models: new Set(models.map((m) => m.toLowerCase())),
      lastSuccessAt: opts.lastSuccessAt ?? Date.now(),
      lastProbeOk: opts.ok ?? true,
      lastError: undefined,
    });
  }

  private isStale(s: ProviderState): boolean {
    if (s.lastSuccessAt === 0) return true;
    return Date.now() - s.lastSuccessAt > this.ttlMs;
  }
}

export const modelCache = new ModelCache();
