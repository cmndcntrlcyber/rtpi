/**
 * TAXII 2.1 Read Client (v2.9.1 Phase 7)
 *
 * Minimal client implementing only what CTI ingestion needs:
 *   - GET /collections/{id}/objects/    → returns a STIX bundle of objects
 *   - GET /collections/{id}/manifest/   → not used today; reserved
 *
 * Spec: https://docs.oasis-open.org/cti/taxii/v2.1/cs02/taxii-v2.1-cs02.html
 *
 * Auth is handled via the source's auth_headers JSON column — typically
 * { "Authorization": "Bearer ..." }. All requests use the standard TAXII
 * 2.1 media type so servers know which version we expect.
 */

const TAXII_MEDIA_TYPE = "application/taxii+json;version=2.1";

export interface TaxiiObject {
  type: string;
  id: string;
  created?: string;
  modified?: string;
  [key: string]: unknown;
}

export interface TaxiiBundle {
  more?: boolean;
  next?: string;
  objects?: TaxiiObject[];
}

export interface TaxiiFetchOptions {
  url: string;
  collection: string;
  authHeaders?: Record<string, string> | null;
  /** Pull only objects with `modified > addedAfter` (TAXII filter). */
  addedAfter?: string;
  /** Hard cap on objects returned this run — protects against runaway bundles. */
  maxObjects?: number;
  timeoutMs?: number;
}

/**
 * Fetch all objects from a TAXII 2.1 collection, following pagination via
 * the `next` field. Returns a flat array; caller dedupes by external_id.
 */
export async function fetchTaxiiObjects(
  opts: TaxiiFetchOptions,
): Promise<TaxiiObject[]> {
  const baseUrl = opts.url.replace(/\/+$/, "");
  const headers = {
    Accept: TAXII_MEDIA_TYPE,
    ...(opts.authHeaders ?? {}),
  };

  const cap = opts.maxObjects ?? 5000;
  const timeout = opts.timeoutMs ?? 60_000;
  const collected: TaxiiObject[] = [];

  // First page.
  const params = new URLSearchParams();
  if (opts.addedAfter) params.set("added_after", opts.addedAfter);
  let nextUrl: string | null = `${baseUrl}/collections/${encodeURIComponent(
    opts.collection,
  )}/objects/${params.toString() ? `?${params.toString()}` : ""}`;

  while (nextUrl && collected.length < cap) {
    const res: Response = await fetch(nextUrl, {
      headers,
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      throw new Error(`TAXII fetch failed (${res.status}) for ${nextUrl}`);
    }
    const body: TaxiiBundle = await res.json();
    if (Array.isArray(body.objects)) {
      collected.push(...body.objects);
    }
    if (body.more && body.next) {
      const sep = nextUrl.includes("?") ? "&" : "?";
      nextUrl = `${nextUrl}${sep}next=${encodeURIComponent(body.next)}`;
    } else {
      nextUrl = null;
    }
  }

  return collected.slice(0, cap);
}
