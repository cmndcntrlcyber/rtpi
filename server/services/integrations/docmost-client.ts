/**
 * Docmost Client (v2.9.1 Phase 8)
 *
 * Talks to a Docmost instance over its REST API. Uses an API token for
 * authentication; configured via:
 *   - DOCMOST_BASE_URL    (default http://rtpi-docmost:3000 inside compose)
 *   - DOCMOST_API_TOKEN   (created via Docmost admin UI)
 *   - DOCMOST_DEFAULT_WORKSPACE_ID (workspace to publish into; optional —
 *     when unset, the first workspace returned by /api/workspaces is used)
 *
 * Mirrors the Sysreptor client's six-state health classification so the UI
 * can render the same banner pattern with consistent remediation copy.
 */

export type DocmostHealthReason =
  | "not_configured"
  | "service_unreachable"
  | "timeout"
  | "auth_error"
  | "service_error";

export interface DocmostHealth {
  up: boolean;
  url: string;
  tokenConfigured: boolean;
  workspace?: { id: string; name: string };
  version?: string;
  reason?: DocmostHealthReason;
  error?: string;
  suggestion?: string;
}

export interface DocmostPage {
  id: string;
  title: string;
  workspaceId: string;
  /** UI URL for opening the page in a browser. */
  url: string;
}

const DEFAULT_BASE_URL = "http://rtpi-docmost:3000";
const REQUEST_TIMEOUT_MS = 15_000;

function getBaseUrl(): string {
  return (process.env.DOCMOST_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getToken(): string | undefined {
  const t = process.env.DOCMOST_API_TOKEN;
  return t && t.trim().length > 0 && !t.startsWith("change-") ? t : undefined;
}

function getDefaultWorkspaceId(): string | undefined {
  return process.env.DOCMOST_DEFAULT_WORKSPACE_ID || undefined;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) throw new Error("DOCMOST_API_TOKEN not configured");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

class DocmostClient {
  get configured(): boolean {
    return !!getToken();
  }

  /**
   * Health probe with structured reason classification. Returns 200-shape
   * even when Docmost is unreachable so the UI can render diagnostics
   * without hitting an error path.
   */
  async checkHealth(): Promise<DocmostHealth> {
    const url = getBaseUrl();
    if (!this.configured) {
      return {
        up: false,
        url,
        tokenConfigured: false,
        reason: "not_configured",
        suggestion: "Create a Docmost API token in the Docmost admin UI and set DOCMOST_API_TOKEN.",
      };
    }

    let res: Response;
    try {
      res = await fetch(`${url}/api/auth/me`, {
        method: "GET",
        headers: authHeaders(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const e = err as { code?: string; name?: string; message?: string };
      if (e.name === "AbortError" || e.name === "TimeoutError") {
        return {
          up: false,
          url,
          tokenConfigured: true,
          reason: "timeout",
          error: e.message,
          suggestion: "Docmost did not respond in 15s. Check container logs.",
        };
      }
      return {
        up: false,
        url,
        tokenConfigured: true,
        reason: "service_unreachable",
        error: e.message,
        suggestion: "Start Docmost: `docker compose --profile docmost up -d`.",
      };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        up: false,
        url,
        tokenConfigured: true,
        reason: "auth_error",
        error: `HTTP ${res.status}`,
        suggestion: "DOCMOST_API_TOKEN is invalid. Regenerate it in Docmost admin and update the env var.",
      };
    }

    if (res.status >= 500 || !res.ok) {
      return {
        up: false,
        url,
        tokenConfigured: true,
        reason: "service_error",
        error: `HTTP ${res.status}`,
      };
    }

    // Resolve a default workspace for the UI banner.
    let workspace: DocmostHealth["workspace"];
    try {
      const ws = await this.listWorkspaces();
      if (ws.length > 0) workspace = { id: ws[0].id, name: ws[0].name };
    } catch {
      // Optional info — don't downgrade up:true on a workspace probe failure.
    }

    return { up: true, url, tokenConfigured: true, workspace };
  }

  async listWorkspaces(): Promise<{ id: string; name: string; slug?: string }[]> {
    const res = await fetch(`${getBaseUrl()}/api/workspaces`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`List workspaces failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const body = (await res.json()) as any;
    // Docmost API may return either a bare array or { data: [...] }.
    const list = Array.isArray(body) ? body : body?.data ?? [];
    return list.map((w: any) => ({ id: w.id, name: w.name, slug: w.slug }));
  }

  /**
   * Create a page in the configured (or first available) workspace.
   * Markdown-formatted content; Docmost stores it as ProseMirror JSON
   * server-side via its own conversion.
   */
  async createPage(input: {
    title: string;
    content: string;
    workspaceId?: string;
  }): Promise<DocmostPage> {
    const url = getBaseUrl();
    let workspaceId = input.workspaceId || getDefaultWorkspaceId();
    if (!workspaceId) {
      const ws = await this.listWorkspaces();
      if (ws.length === 0) throw new Error("No Docmost workspaces available");
      workspaceId = ws[0].id;
    }

    const res = await fetch(`${url}/api/pages`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        title: input.title,
        content: input.content,
        workspaceId,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Create page failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const body = (await res.json()) as any;
    const id = body.id ?? body.page?.id;
    const slug = body.slug ?? body.page?.slug;
    if (!id) throw new Error("Docmost create-page response missing id");

    // Docmost page URLs follow /p/:slug or /p/:id depending on version.
    const pageUrl = `${url}/p/${slug ?? id}`;
    return { id, title: input.title, workspaceId, url: pageUrl };
  }
}

export const docmostClient = new DocmostClient();
