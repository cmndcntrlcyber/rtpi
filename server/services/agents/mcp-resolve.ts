/**
 * Shared resolution of an agent's attached MCP server IDs.
 *
 * Prefers the multi-select array `config.mcpServerIds` (v2.9.3); falls back to
 * the legacy single `config.mcpServerId`. Returns [] when neither is set so the
 * caller decides whether that's an error or an empty list.
 *
 * Extracted so the agent-tool connector and the `/agents/:id/mcp-call` route
 * resolve attachments identically (single source of truth).
 */
export function resolveAgentMcpServerIds(config: unknown): string[] {
  const cfg = (config ?? {}) as { mcpServerIds?: unknown; mcpServerId?: unknown };
  if (Array.isArray(cfg.mcpServerIds)) {
    const ids = cfg.mcpServerIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    if (ids.length > 0) return ids;
  }
  if (typeof cfg.mcpServerId === "string" && cfg.mcpServerId.length > 0) {
    return [cfg.mcpServerId];
  }
  return [];
}
