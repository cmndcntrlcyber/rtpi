/**
 * Operation Tag Helper
 *
 * Shared utility for generating operation-scoped tags for targets.
 * Used by target-auto-creation-service, operation-lifecycle-automation,
 * and the targets API to ensure consistent op:<name> tagging.
 */

import { db } from '../db';
import { operations } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Sanitize an operation name for use as a tag value.
 * Lowercases, replaces non-alphanumeric chars with hyphens, dedupes hyphens.
 */
export function sanitizeOperationName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build an operation tag string from a name.
 * Returns `op:<sanitized-name>` (e.g. `op:vantagepay`).
 */
export function buildOperationTag(name: string): string {
  return `op:${sanitizeOperationName(name)}`;
}

/**
 * Fetch the operation name from DB and return the formatted tag.
 * Returns null if the operation is not found.
 */
export async function getOperationTag(operationId: string): Promise<string | null> {
  const [operation] = await db
    .select({ name: operations.name })
    .from(operations)
    .where(eq(operations.id, operationId))
    .limit(1);

  if (!operation) return null;

  return buildOperationTag(operation.name);
}

/**
 * Merge an operation tag into an existing tags array.
 * Removes any previous op:* tags and adds the new one.
 * Returns a deduplicated array.
 */
export function mergeOperationTag(existingTags: string[], opTag: string): string[] {
  const filtered = existingTags.filter(t => !t.startsWith('op:'));
  return [...new Set([...filtered, opTag])];
}
