import { db } from '../db';
import { targets } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Extract hostname from a URL or host string.
 * Strips protocol, port, and path.
 */
function extractHostname(hostOrUrl: string): string {
  try {
    const parsed = new URL(hostOrUrl);
    return parsed.hostname;
  } catch {
    return hostOrUrl.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  }
}

/**
 * Resolve a targetId by matching a host/URL against targets in the same operation.
 *
 * Matching priority:
 * 1. Exact match on target.value
 * 2. Subdomain match (host ends with .{target.value}) for domain-type targets
 *
 * Returns the matched target's id, or null if no match found.
 */
export async function resolveTargetId(
  operationId: string,
  hostOrUrl: string
): Promise<string | null> {
  if (!operationId || !hostOrUrl) return null;

  const hostname = extractHostname(hostOrUrl);
  if (!hostname || hostname === 'unknown') return null;

  const operationTargets = await db
    .select({ id: targets.id, value: targets.value, type: targets.type })
    .from(targets)
    .where(eq(targets.operationId, operationId));

  if (operationTargets.length === 0) return null;

  // Priority 1: Exact match
  const exact = operationTargets.find(
    (t) => t.value.toLowerCase() === hostname.toLowerCase()
  );
  if (exact) return exact.id;

  // Priority 2: Subdomain match (hostname is a subdomain of a domain-type target)
  const subdomain = operationTargets.find(
    (t) =>
      (t.type === 'domain' || t.type === 'url') &&
      hostname.toLowerCase().endsWith(`.${t.value.toLowerCase()}`)
  );
  if (subdomain) return subdomain.id;

  return null;
}
