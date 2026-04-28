/**
 * Feature flag registry shared between server and client.
 *
 * Each flag maps to a process.env variable. Boolean flags resolve to true when
 * the env var equals "true" or "1" (case-insensitive). The server exposes the
 * resolved map via GET /api/v1/settings/features; the client consumes it via
 * the useFeatureFlag hook.
 *
 * Add a new flag here, document it in .env.example, and consumers pick it up.
 */

export const FEATURE_FLAGS = {
  pdfNative: "FF_PDF_NATIVE",
  vllmAgent: "FF_VLLM_AGENT",
  docmost: "FF_DOCMOST",
  frameworkDeploy: "FF_FRAMEWORK_DEPLOY",
  ctiVector: "FF_CTI_VECTOR",
  kasmHardened: "FF_KASM_HARDENED",
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export type FeatureFlagMap = Record<FeatureFlagKey, boolean>;

export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

export function readFeatureFlags(
  env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
): FeatureFlagMap {
  const result = {} as FeatureFlagMap;
  for (const key of FEATURE_FLAG_KEYS) {
    result[key] = parseBool(env[FEATURE_FLAGS[key]]);
  }
  return result;
}
