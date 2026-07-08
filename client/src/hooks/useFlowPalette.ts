import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export interface PaletteAgent {
  id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, any>;
}
export interface PaletteMcpServer {
  id: string;
  name: string;
  status: string;
  command: string | null;
}
export interface PaletteTool {
  id: string;
  source: "registry" | "security";
  name: string;
  category: string | null;
  description: string | null;
  command: string | null;
}
export interface PaletteSkill {
  id: string;
  kind: "tool" | "bug_hunter";
  name: string;
  summary: string;
  source: string;
}
export interface FlowPalette {
  agents: PaletteAgent[];
  mcpServers: PaletteMcpServer[];
  securityTools: PaletteTool[];
  skills: PaletteSkill[];
  capabilities: string[];
}

const EMPTY: FlowPalette = { agents: [], mcpServers: [], securityTools: [], skills: [], capabilities: [] };

export interface UseFlowPaletteOptions {
  /**
   * Background refresh interval in ms so the palette tracks server-side changes
   * (the tool-connector discovery poll, agent status changes, new MCP servers).
   * Default 15s; set to 0 to disable polling.
   */
  pollIntervalMs?: number;
  /** Refetch when the tab/window regains focus or becomes visible (default true). */
  refetchOnFocus?: boolean;
}

const DEFAULT_POLL_MS = 15000;

/**
 * Single aggregated catalog for the agent-flow canvas palette
 * (agents, MCP servers, security tools, skills, capabilities) — backed by
 * GET /api/v1/agent-flows/palette plus GET /api/v1/skills/available (grouped).
 * Skills come from the existing catalog endpoint so we avoid duplicating the
 * tool-skill + bug-hunter enumeration in the palette route.
 *
 * Keeps the open builder in sync with the backend as closely as possible:
 * background polling + refetch on focus/visibility, plus an exposed `refetch`
 * the canvas calls when live agent/workflow WebSocket events arrive.
 */
export function useFlowPalette(options: UseFlowPaletteOptions = {}) {
  const { pollIntervalMs = DEFAULT_POLL_MS, refetchOnFocus = true } = options;

  const [palette, setPalette] = useState<FlowPalette>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guards so background refreshes neither flash the loading state nor stack up
  // (e.g. a focus event landing while a poll is already in flight), and so we
  // never setState after unmount.
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (!opts.silent) setLoading(true);
    try {
      const [response, skillsRes] = await Promise.all([
        api.get<Omit<FlowPalette, "skills">>("/agent-flows/palette"),
        api
          .get<{
            skills: Array<{
              id: string;
              kind: "tool" | "bug_hunter";
              displayName: string;
              summary: string;
              source: string;
            }>;
          }>("/skills/available?grouped=true")
          .catch(() => ({ skills: [] })),
      ]);
      if (!mountedRef.current) return;
      setPalette({
        agents: response.agents || [],
        mcpServers: response.mcpServers || [],
        securityTools: response.securityTools || [],
        skills: (skillsRes.skills || []).map((s) => ({
          id: s.id,
          kind: s.kind,
          name: s.displayName,
          summary: s.summary,
          source: s.source,
        })),
        capabilities: response.capabilities || [],
      });
      setError(null);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current && !opts.silent) setLoading(false);
    }
  }, []);

  // Stable, always-silent refresher for intervals/listeners/consumers — avoids
  // re-subscribing effects when `load` identity is otherwise depended upon.
  const refresh = useCallback(() => load({ silent: true }), [load]);

  // Initial load (shows the loading state) + background polling.
  useEffect(() => {
    mountedRef.current = true;
    load();
    if (!pollIntervalMs) return () => { mountedRef.current = false; };
    const id = setInterval(refresh, pollIntervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [load, refresh, pollIntervalMs]);

  // Refetch the instant the operator returns to the tab/window.
  useEffect(() => {
    if (!refetchOnFocus) return;
    const onFocus = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetchOnFocus, refresh]);

  return { palette, loading, error, refetch: refresh };
}
