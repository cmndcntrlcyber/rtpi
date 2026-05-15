import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/**
 * v2.9.3 Phase 4 — frontend hook for the default MCP catalog.
 *
 * Fetches the catalog from `GET /api/v1/mcp-servers/catalog` (each entry
 * carries `installed`, `serverId`, `status`, and `needsConfig`) and exposes
 * mutations for the three managed-lifecycle actions: bulk install/sync,
 * single-row reset, and secret-merge configure.
 */

export interface CatalogEntry {
  seedKey: string;
  name: string;
  command: string;
  args: string[];
  requiredSecrets: string[];
  installed: boolean;
  serverId: string | null;
  status: string | null;
  needsConfig: boolean;
}

interface CatalogResponse {
  entries: CatalogEntry[];
}

interface SyncResult {
  inserted: number;
  alreadyPresent: number;
}

export function useMcpCatalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<CatalogResponse>("/mcp-servers/catalog", {
        signal: abortRef.current.signal,
      });
      setEntries(response.entries ?? []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load MCP catalog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  /** Re-insert any catalog rows that are missing from `mcp_servers`. */
  const sync = useCallback(async (): Promise<SyncResult> => {
    const result = await api.post<SyncResult>("/mcp-servers/catalog/sync");
    await refetch();
    return result;
  }, [refetch]);

  /**
   * Reset a managed row to catalog defaults. Existing secret values are
   * preserved unless `wipeSecrets=true`.
   */
  const reset = useCallback(
    async (serverId: string, opts: { wipeSecrets?: boolean } = {}) => {
      const url = opts.wipeSecrets
        ? `/mcp-servers/${serverId}/reset?wipeSecrets=true`
        : `/mcp-servers/${serverId}/reset`;
      await api.post(url);
      await refetch();
    },
    [refetch],
  );

  /**
   * Merge env values into a managed row. Body keys not included are
   * preserved on the server; required-secret values are returned redacted.
   */
  const configure = useCallback(
    async (serverId: string, env: Record<string, string>) => {
      await api.patch(`/mcp-servers/${serverId}/secrets`, { env });
      await refetch();
    },
    [refetch],
  );

  return { entries, loading, error, refetch, sync, reset, configure };
}
