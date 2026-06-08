/**
 * Engagement Scaffolder (FF_BUG_HUNTER)
 *
 * Replaces Claude-BugHunter's `hunt.sh` filesystem scaffold with a DB-first
 * pattern that fits rtpi:
 *   - creates an `operations` row carrying scope, mode, and platform metadata
 *   - creates a `memory_context` of type `operation` linked back to the op
 *   - returns the IDs needed to drive the workflow
 *
 * Filesystem layout (`~/Targets/<name>/CLAUDE.md`, `findings/`, etc.) is
 * intentionally NOT created — rtpi already persists everything in Postgres
 * and Docmost. A future PR may add an optional Docmost page for the
 * engagement notes.
 */

import { eq } from "drizzle-orm";
import { db } from "../../db";
import { operations } from "@shared/schema";
import { memoryService } from "../memory-service";

export type EngagementMode = "redteam" | "wapt";
export type EngagementBox = "blackbox" | "greybox";
export type EngagementPlatform = "hackerone" | "bugcrowd" | "intigriti" | "immunefi" | "redteam" | "internal";

export interface ScaffoldOptions {
  name: string;
  scopeText: string;
  ownerId: string;
  mode: EngagementMode;
  box?: EngagementBox;
  platform?: EngagementPlatform;
  /** Optional already-parsed scope rules. ScopeAgent normally fills these. */
  scopeRules?: Record<string, unknown>;
  /** Free-text accepted-impacts list, captured from the program page. */
  acceptedImpacts?: string[];
  /** Optional caller-supplied metadata; merged into operations.metadata. */
  extra?: Record<string, unknown>;
}

export interface ScaffoldResult {
  operationId: string;
  memoryContextId: string;
  alreadyExisted: boolean;
}

/**
 * Scaffold a new bug-hunter engagement. Idempotent on operation name +
 * ownerId — repeated calls return the existing operation rather than
 * creating duplicates.
 */
export async function scaffoldEngagement(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  // Look for an existing op of the same name owned by the same user.
  const existing = await db
    .select()
    .from(operations)
    .where(eq(operations.name, opts.name))
    .limit(5);

  const match = existing.find((row) => row.ownerId === opts.ownerId);

  const metadata: Record<string, unknown> = {
    bugHunter: true,
    mode: opts.mode,
    box: opts.box ?? "blackbox",
    platform: opts.platform ?? "internal",
    scopeRules: opts.scopeRules ?? null,
    acceptedImpacts: opts.acceptedImpacts ?? [],
    ...(opts.extra ?? {}),
  };

  let operationId: string;
  let alreadyExisted = false;

  if (match) {
    operationId = match.id;
    alreadyExisted = true;
    // Merge metadata in case mode / scopeRules were filled in by a later run.
    const merged = { ...((match.metadata as Record<string, unknown>) ?? {}), ...metadata };
    await db
      .update(operations)
      .set({ metadata: merged, scope: opts.scopeText, updatedAt: new Date() })
      .where(eq(operations.id, operationId));
  } else {
    const [created] = await db
      .insert(operations)
      .values({
        name: opts.name,
        description: `Bug-hunter engagement (${opts.mode}, ${opts.platform ?? "internal"})`,
        status: "active",
        scope: opts.scopeText,
        ownerId: opts.ownerId,
        metadata,
      })
      .returning({ id: operations.id });
    operationId = created.id;
  }

  // Wire up a memory context for the operation. memoryService.createContext
  // is itself idempotent on (type, contextId).
  const context = await memoryService.createContext({
    contextType: "operation",
    contextId: operationId,
    contextName: `Bug-Hunter: ${opts.name}`,
    metadata: { bugHunter: true, mode: opts.mode, platform: opts.platform ?? "internal" },
  });

  // Backfill operations.memoryContextId if missing.
  if (!alreadyExisted || !match?.memoryContextId) {
    await db
      .update(operations)
      .set({ memoryContextId: context.id })
      .where(eq(operations.id, operationId));
  }

  return {
    operationId,
    memoryContextId: context.id,
    alreadyExisted,
  };
}

/**
 * Helper for downstream agents — pulls the bug-hunter metadata block off
 * an operation row, with defaults so callers don't have to null-check.
 */
export async function loadEngagementMeta(operationId: string): Promise<{
  mode: EngagementMode;
  box: EngagementBox;
  platform: EngagementPlatform;
  scopeRules: Record<string, unknown> | null;
  acceptedImpacts: string[];
} | null> {
  const [op] = await db
    .select()
    .from(operations)
    .where(eq(operations.id, operationId))
    .limit(1);
  if (!op) return null;
  const meta = (op.metadata as Record<string, unknown>) ?? {};
  if (!meta.bugHunter) return null;
  return {
    mode: ((meta.mode as EngagementMode) ?? "wapt"),
    box: ((meta.box as EngagementBox) ?? "blackbox"),
    platform: ((meta.platform as EngagementPlatform) ?? "internal"),
    scopeRules: (meta.scopeRules as Record<string, unknown>) ?? null,
    acceptedImpacts: ((meta.acceptedImpacts as string[]) ?? []),
  };
}
