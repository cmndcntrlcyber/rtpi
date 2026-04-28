import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  FEATURE_FLAG_KEYS,
  type FeatureFlagKey,
  type FeatureFlagMap,
} from "@shared/feature-flags";

export type { FeatureFlagKey, FeatureFlagMap } from "@shared/feature-flags";
export { FEATURE_FLAG_KEYS };

let cached: FeatureFlagMap | null = null;
let pending: Promise<FeatureFlagMap> | null = null;
const subscribers = new Set<(flags: FeatureFlagMap) => void>();

function emptyFlags(): FeatureFlagMap {
  return FEATURE_FLAG_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as FeatureFlagMap);
}

async function fetchFlags(): Promise<FeatureFlagMap> {
  if (cached) return cached;
  if (pending) return pending;
  pending = api
    .get<{ features: FeatureFlagMap }>("/settings/features")
    .then((r) => {
      cached = r.features;
      pending = null;
      subscribers.forEach((fn) => fn(cached!));
      return cached;
    })
    .catch((e) => {
      pending = null;
      throw e;
    });
  return pending;
}

export function useFeatureFlags(): FeatureFlagMap {
  const [flags, setFlags] = useState<FeatureFlagMap>(cached ?? emptyFlags());

  useEffect(() => {
    let active = true;

    fetchFlags()
      .then((next) => {
        if (active) setFlags(next);
      })
      .catch(() => {
        // Network error — keep defaults (all false). Server is the source of truth;
        // a missing /features response means the user can't see flagged UI yet.
      });

    const onUpdate = (next: FeatureFlagMap) => {
      if (active) setFlags(next);
    };
    subscribers.add(onUpdate);
    return () => {
      active = false;
      subscribers.delete(onUpdate);
    };
  }, []);

  return flags;
}

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useFeatureFlags()[key];
}

// Test/debugging helper. Not for production code paths.
export function __resetFeatureFlagsCache(): void {
  cached = null;
  pending = null;
  subscribers.clear();
}
