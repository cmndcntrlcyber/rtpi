/**
 * SysReptor REST API Client
 *
 * Full-featured client for the SysReptor penetration testing report platform.
 * Handles projects, findings, sections, designs, templates, evidence, and PDF export.
 *
 * Docs: https://docs.sysreptor.com/setup/api/
 */

// ============================================================================
// Types
// ============================================================================

export interface SysReptorProject {
  id: string;
  name: string;
  language: string;
  design: string;
  tags: string[];
  members?: any[];
  findings?: SysReptorFinding[];
  sections?: SysReptorSection[];
  readonly?: boolean;
  created: string;
  updated: string;
}

export interface SysReptorFinding {
  id: string;
  project: string;
  title: string;
  data: Record<string, any>;
  order: number;
  template?: string;
  created: string;
  updated: string;
}

export interface SysReptorSection {
  id: string;
  project: string;
  label: string;
  data: Record<string, any>;
  created: string;
  updated: string;
}

export interface SysReptorDesign {
  id: string;
  name: string;
  language: string;
  finding_fields: Record<string, any>;
  report_fields: Record<string, any>;
  created: string;
  updated: string;
}

export interface SysReptorFindingTemplate {
  id: string;
  title: string;
  data: Record<string, any>;
  tags: string[];
  created: string;
  updated: string;
}

export interface SysReptorImage {
  id: string;
  name: string;
  file: string;
}

export interface RtpiToSysReptorFinding {
  title: string;
  severity: string;
  description: string;
  cvssScore?: number | null;
  cvssVector?: string | null;
  cveId?: string | null;
  cweId?: string | null;
  proofOfConcept?: string | null;
  remediation?: string | null;
  impact?: string | null;
  exploitability?: string | null;
  affectedServices?: any;
  references?: any;
  status?: string;
}

// ============================================================================
// Health result + error classifier
// ============================================================================

export type HealthReason =
  | "not_configured"
  | "profile_not_enabled"
  | "service_unreachable"
  | "timeout"
  | "auth_error"
  | "service_error";

export interface AutoConnectResult {
  /** True if a fresh token was minted and persisted (or already present and valid). */
  ok: boolean;
  /** Human-readable status — surfaced to the UI banner. */
  message: string;
  /** Set when ok=true: short reason describing what happened. */
  action?: "minted" | "already_configured" | "skipped";
  /** Set on failure: machine-readable category. */
  reason?:
    | "container_not_running"
    | "no_superuser"
    | "exec_failed"
    | "token_parse_failed"
    | "persist_failed";
  /** True if the token was written to .env (so it survives restart). */
  persistedToEnv?: boolean;
}

export interface HealthResult {
  up: boolean;
  /** True when Sysreptor responded; false when DNS failed (likely profile not active); undefined when token missing. */
  profileEnabled: boolean | undefined;
  url: string;
  tokenConfigured: boolean;
  version?: string;
  reason?: HealthReason;
  error?: string;
  suggestion?: string;
}

/** Walk the Error.cause chain to find a Node errno code (ECONNREFUSED, ENOTFOUND, …). */
function extractErrnoCode(err: unknown): string | undefined {
  let current: any = err;
  for (let i = 0; i < 5 && current; i++) {
    if (typeof current.code === "string") return current.code;
    if (Array.isArray(current.errors)) {
      for (const sub of current.errors) {
        const c = extractErrnoCode(sub);
        if (c) return c;
      }
    }
    current = current.cause;
  }
  return undefined;
}

function classifyFetchError(err: unknown, url: string, usesDockerHostname: boolean): HealthResult {
  const e = err as { name?: string; message?: string };
  const code = extractErrnoCode(err);
  const name = e?.name;
  const message = e instanceof Error ? e.message : "Connection failed";

  // Abort due to AbortSignal.timeout()
  if (name === "AbortError" || name === "TimeoutError") {
    return {
      up: false,
      profileEnabled: true,
      url,
      tokenConfigured: true,
      reason: "timeout",
      error: message,
      suggestion: "Sysreptor accepted the connection but did not respond in 5s. Check container CPU/IO and logs.",
    };
  }

  // DNS resolution failed — on the docker network, this almost always means
  // the `--profile sysreptor` services are not running.
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return {
      up: false,
      profileEnabled: false,
      url,
      tokenConfigured: true,
      reason: usesDockerHostname ? "profile_not_enabled" : "service_unreachable",
      error: message,
      suggestion: usesDockerHostname
        ? "Start Sysreptor: `docker compose --profile sysreptor up -d`."
        : `DNS for ${url} did not resolve. Verify SYSREPTOR_URL.`,
    };
  }

  // Connection refused / reset — service is reachable on the network but
  // nothing is listening (or it crashed).
  if (code === "ECONNREFUSED" || code === "ECONNRESET") {
    return {
      up: false,
      profileEnabled: false,
      url,
      tokenConfigured: true,
      reason: "service_unreachable",
      error: message,
      suggestion: "Sysreptor host resolved but is not accepting connections. Check `docker compose ps rtpi-sysreptor-app`.",
    };
  }

  return {
    up: false,
    profileEnabled: undefined,
    url,
    tokenConfigured: true,
    reason: "service_unreachable",
    error: message,
  };
}

// ============================================================================
// Client
// ============================================================================

class SysReptorClient {
  private baseUrl: string;
  private token: string;
  private autoConnectInflight: Promise<AutoConnectResult> | null = null;
  // Lazily probed in checkHealth when the configured URL fails to resolve.
  // For host-run backends that can't see the docker hostname, falls back to
  // the published localhost port.
  private urlResolved = false;

  constructor() {
    // Default to the docker-network hostname (works when backend is in compose).
    // Host-run backends fall back to localhost:9005 (the published port) on
    // first ENOTFOUND — see resolveBaseUrl().
    this.baseUrl = (
      process.env.SYSREPTOR_URL || "http://rtpi-sysreptor-app:8000"
    ).replace(/\/$/, "");
    this.token = (process.env.SYSREPTOR_API_TOKEN || "").trim();

    // Fire-and-forget: if the container is up but our token is empty, mint one
    // automatically so the Reports page works without manual setup. Failures
    // are logged but do not block construction.
    if (!this.token) {
      void this.maybeAutoConnect("startup");
    }
  }

  get configured(): boolean {
    return !!this.token;
  }

  /**
   * Probe the configured baseUrl. If it points at the docker hostname
   * (`rtpi-sysreptor-app`) and DNS resolution fails — typical when the
   * backend runs on the host but `.env` has the in-network URL — fall back
   * to http://localhost:9005, the published port from docker-compose.yml.
   *
   * Operator can opt out by setting `SYSREPTOR_URL` to a non-docker-hostname
   * URL (e.g. their own caddy or external endpoint). Override the fallback
   * destination via `SYSREPTOR_HOST_URL`.
   *
   * Idempotent — runs once per process.
   */
  private async resolveBaseUrl(): Promise<void> {
    if (this.urlResolved) return;
    this.urlResolved = true;

    const dockerHostnameRe = /^https?:\/\/rtpi-sysreptor-app(:|\/|$)/;
    if (!dockerHostnameRe.test(this.baseUrl)) return;

    try {
      const dns = await import("dns/promises");
      await dns.lookup("rtpi-sysreptor-app");
      // Resolved — leave baseUrl alone (we're inside the docker network).
    } catch {
      const fallback =
        process.env.SYSREPTOR_HOST_URL || "http://localhost:9005";
      console.log(
        `[SysReptor] DNS for 'rtpi-sysreptor-app' failed; falling back to ${fallback} ` +
          "(set SYSREPTOR_URL to a different value to bypass)",
      );
      this.baseUrl = fallback.replace(/\/$/, "");
    }
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      // Sysreptor sets SECURE_SSL_REDIRECT=on by default. When we hit it over
      // plain HTTP (host port 9005, or in-network on :8000) it 301s every
      // request to https://. The container expects an upstream TLS terminator
      // (Caddy) to inject this header — when we talk to it directly, we have
      // to set it ourselves.
      "X-Forwarded-Proto": "https",
      ...extra,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    rawResponse = false,
  ): Promise<T> {
    await this.resolveBaseUrl();
    const url = `${this.baseUrl}${path}`;
    const opts: RequestInit = {
      method,
      headers: this.headers(),
      signal: AbortSignal.timeout(30000),
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `SysReptor API ${method} ${path} failed (${res.status}): ${text.slice(0, 500)}`,
      );
    }

    if (rawResponse) return res as unknown as T;
    return res.json() as Promise<T>;
  }

  private async upload(
    path: string,
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<SysReptorImage> {
    const form = new FormData();
    const blob = new Blob([fileBuffer]);
    form.append("file", blob, fileName);

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "X-Forwarded-Proto": "https",
      },
      body: form,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`SysReptor upload failed (${res.status}): ${text.slice(0, 300)}`);
    }
    return res.json() as Promise<SysReptorImage>;
  }

  // --------------------------------------------------------------------------
  // Health
  // --------------------------------------------------------------------------

  /**
   * Detailed health probe used by `GET /api/v1/sysreptor/health`.
   *
   * Distinguishes the common failure modes so the UI can surface actionable
   * remediation copy instead of a generic "unreachable":
   *
   *   - `not_configured`     — SYSREPTOR_API_TOKEN missing
   *   - `profile_not_enabled` — DNS for the docker hostname fails (very
   *                             likely the `--profile sysreptor` services
   *                             were never started)
   *   - `service_unreachable` — TCP refused / network error after DNS resolved
   *   - `timeout`            — TCP open but no response within budget
   *   - `auth_error`         — HTTP 401/403 (token invalid or expired)
   *   - `service_error`      — HTTP 5xx (service is up but degraded)
   *   - `up`                 — HTTP 200 from the auth-protected projects API
   */
  async checkHealth(): Promise<HealthResult> {
    await this.resolveBaseUrl();
    const url = this.baseUrl;

    if (!this.token) {
      return {
        up: false,
        profileEnabled: undefined,
        url,
        tokenConfigured: false,
        reason: "not_configured",
        suggestion: "Set SYSREPTOR_API_TOKEN in your environment or via the settings UI.",
      };
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/v1/pentestprojects/`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      return classifyFetchError(err, url, this.usesDockerHostname());
    }

    if (res.status === 401 || res.status === 403) {
      return {
        up: false,
        profileEnabled: true,
        url,
        tokenConfigured: true,
        reason: "auth_error",
        error: `HTTP ${res.status}`,
        suggestion: "SYSREPTOR_API_TOKEN is invalid or expired. Regenerate it in Sysreptor admin and update the env var.",
      };
    }

    if (res.status >= 500) {
      return {
        up: false,
        profileEnabled: true,
        url,
        tokenConfigured: true,
        reason: "service_error",
        error: `HTTP ${res.status}`,
        suggestion: "Sysreptor returned a server error. Check container logs: `docker compose logs rtpi-sysreptor-app`.",
      };
    }

    if (!res.ok) {
      return {
        up: false,
        profileEnabled: true,
        url,
        tokenConfigured: true,
        reason: "service_error",
        error: `HTTP ${res.status}`,
      };
    }

    // Service is responding successfully. Best-effort version probe; never
    // downgrade the up=true result if the version endpoint is missing.
    const version = await this.tryGetVersion();
    return {
      up: true,
      profileEnabled: true,
      url,
      tokenConfigured: true,
      version,
    };
  }

  private usesDockerHostname(): boolean {
    // Docker DNS only resolves these when the compose service is up.
    return /:\/\/rtpi-sysreptor-app(:|\/|$)/.test(this.baseUrl);
  }

  /**
   * Try to read the deployed Sysreptor version. Returns undefined on any
   * failure — version is informational, not load-bearing.
   */
  private async tryGetVersion(): Promise<string | undefined> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/utils/settings/`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return undefined;
      const data = (await res.json().catch(() => null)) as { version?: string } | null;
      return data?.version;
    } catch {
      return undefined;
    }
  }

  // --------------------------------------------------------------------------
  // Projects
  // --------------------------------------------------------------------------

  async listProjects(): Promise<SysReptorProject[]> {
    const data = await this.request<any>("GET", "/api/v1/pentestprojects/");
    return data.results ?? data;
  }

  async createProject(
    name: string,
    designId?: string,
    tags?: string[],
  ): Promise<SysReptorProject> {
    const body: Record<string, any> = { name, language: "en-US" };
    if (designId) body.project_type = designId;
    if (tags?.length) body.tags = tags;
    return this.request<SysReptorProject>("POST", "/api/v1/pentestprojects/", body);
  }

  async getProject(projectId: string): Promise<SysReptorProject> {
    return this.request<SysReptorProject>("GET", `/api/v1/pentestprojects/${projectId}/`);
  }

  async updateProject(
    projectId: string,
    data: Partial<SysReptorProject>,
  ): Promise<SysReptorProject> {
    return this.request<SysReptorProject>(
      "PATCH",
      `/api/v1/pentestprojects/${projectId}/`,
      data,
    );
  }

  // --------------------------------------------------------------------------
  // Findings
  // --------------------------------------------------------------------------

  async listFindings(projectId: string): Promise<SysReptorFinding[]> {
    const data = await this.request<any>(
      "GET",
      `/api/v1/pentestprojects/${projectId}/findings/`,
    );
    return data.results ?? data;
  }

  async addFinding(
    projectId: string,
    finding: RtpiToSysReptorFinding,
  ): Promise<SysReptorFinding> {
    const data = this.mapFindingData(finding);
    return this.request<SysReptorFinding>(
      "POST",
      `/api/v1/pentestprojects/${projectId}/findings/`,
      { data },
    );
  }

  async addFindingFromTemplate(
    projectId: string,
    templateId: string,
  ): Promise<SysReptorFinding> {
    return this.request<SysReptorFinding>(
      "POST",
      `/api/v1/pentestprojects/${projectId}/findings/fromtemplate/`,
      { template: templateId },
    );
  }

  async updateFinding(
    projectId: string,
    findingId: string,
    data: Record<string, any>,
  ): Promise<SysReptorFinding> {
    return this.request<SysReptorFinding>(
      "PATCH",
      `/api/v1/pentestprojects/${projectId}/findings/${findingId}/`,
      { data },
    );
  }

  // --------------------------------------------------------------------------
  // Sections (report body — executive summary, scope, methodology, etc.)
  // --------------------------------------------------------------------------

  async getSections(projectId: string): Promise<SysReptorSection[]> {
    const data = await this.request<any>(
      "GET",
      `/api/v1/pentestprojects/${projectId}/sections/`,
    );
    return data.results ?? data;
  }

  async updateSection(
    projectId: string,
    sectionId: string,
    data: Record<string, any>,
  ): Promise<SysReptorSection> {
    return this.request<SysReptorSection>(
      "PATCH",
      `/api/v1/pentestprojects/${projectId}/sections/${sectionId}/`,
      { data },
    );
  }

  // --------------------------------------------------------------------------
  // Designs & Finding Templates
  // --------------------------------------------------------------------------

  async listDesigns(): Promise<SysReptorDesign[]> {
    const data = await this.request<any>("GET", "/api/v1/projecttypes/");
    return data.results ?? data;
  }

  async getDesign(designId: string): Promise<SysReptorDesign> {
    return this.request<SysReptorDesign>("GET", `/api/v1/projecttypes/${designId}/`);
  }

  async listFindingTemplates(search?: string): Promise<SysReptorFindingTemplate[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    const data = await this.request<any>("GET", `/api/v1/findingtemplates/${qs}`);
    return data.results ?? data;
  }

  // --------------------------------------------------------------------------
  // Evidence / Images
  // --------------------------------------------------------------------------

  async uploadImage(
    projectId: string,
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<SysReptorImage> {
    return this.upload(
      `/api/v1/pentestprojects/${projectId}/images/`,
      fileBuffer,
      fileName,
    );
  }

  // --------------------------------------------------------------------------
  // Export / Render
  // --------------------------------------------------------------------------

  async renderPDF(projectId: string): Promise<Buffer> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/pentestprojects/${projectId}/generate/`,
      {
        method: "POST",
        headers: this.headers(),
        signal: AbortSignal.timeout(120000), // PDF generation can be slow
      },
    );
    if (!res.ok) {
      throw new Error(`PDF render failed (${res.status})`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  async exportProject(projectId: string): Promise<Buffer> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/pentestprojects/${projectId}/export/`,
      {
        method: "POST",
        headers: this.headers(),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!res.ok) {
      throw new Error(`Export failed (${res.status})`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  // --------------------------------------------------------------------------
  // RTPI → SysReptor field mapping
  // --------------------------------------------------------------------------

  mapFindingData(vuln: RtpiToSysReptorFinding): Record<string, any> {
    const refs: string[] = [];
    if (vuln.cveId) refs.push(`https://nvd.nist.gov/vuln/detail/${vuln.cveId}`);
    if (vuln.cweId) refs.push(`https://cwe.mitre.org/data/definitions/${vuln.cweId.replace("CWE-", "")}.html`);
    if (Array.isArray(vuln.references)) {
      refs.push(...vuln.references.filter((r: any) => typeof r === "string"));
    }

    const data: Record<string, any> = {
      title: vuln.title,
      severity: this.mapSeverity(vuln.severity),
      description: vuln.description || "",
    };

    if (vuln.cvssScore != null) data.cvss = String(vuln.cvssScore / 10);
    if (vuln.cvssVector) data.cvss_vector = vuln.cvssVector;
    if (vuln.proofOfConcept) data.proof_text = vuln.proofOfConcept;
    if (vuln.remediation) data.recommendation = vuln.remediation;
    if (vuln.impact) data.impact = vuln.impact;
    if (refs.length) data.references = refs.join("\n");

    // Affected components
    if (vuln.affectedServices) {
      const services = Array.isArray(vuln.affectedServices)
        ? vuln.affectedServices
        : [];
      if (services.length) {
        data.affected_components = services
          .map((s: any) =>
            typeof s === "string" ? s : `${s.name || ""}:${s.port || ""}`,
          )
          .join(", ");
      }
    }

    return data;
  }

  private mapSeverity(severity: string): string {
    const map: Record<string, string> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
      info: "info",
      informational: "info",
    };
    return map[severity?.toLowerCase()] || "info";
  }

  // --------------------------------------------------------------------------
  // Auto-connect: mint an API token via docker exec → Django shell so the
  // Reports page works without manual SYSREPTOR_API_TOKEN setup.
  //
  // Skipped silently if the container is not running, the orchestrator can't
  // reach the docker socket, or no superuser exists yet. Idempotent — reuses
  // the result of the in-flight call if multiple call sites hit it together.
  // --------------------------------------------------------------------------

  /**
   * Internal entry point used by the constructor at startup. Wraps autoConnect
   * with a single-flight guard and downgrades errors to log lines so a
   * failed auto-connect never breaks the running server.
   */
  private async maybeAutoConnect(trigger: "startup" | "manual"): Promise<AutoConnectResult> {
    if (this.autoConnectInflight) return this.autoConnectInflight;
    this.autoConnectInflight = (async () => {
      try {
        const result = await this.autoConnect();
        if (result.ok) {
          if (result.action === "minted") {
            console.log(
              `[SysReptor] Auto-connect (${trigger}): minted new API token, ` +
                `persistedToEnv=${result.persistedToEnv === true}`,
            );
          }
        } else if (result.reason !== "container_not_running") {
          // Don't spam logs at startup if sysreptor profile isn't enabled.
          console.warn(`[SysReptor] Auto-connect (${trigger}) skipped: ${result.message}`);
        }
        return result;
      } finally {
        this.autoConnectInflight = null;
      }
    })();
    return this.autoConnectInflight;
  }

  /**
   * Public entry point used by `POST /api/v1/sysreptor/auto-connect`. Calls
   * the same logic but always returns a result object (never throws).
   */
  async autoConnectFromUI(): Promise<AutoConnectResult> {
    return this.maybeAutoConnect("manual");
  }

  /**
   * Mint a fresh API token by running a Django shell command inside the
   * sysreptor container, then persist it to .env and update the in-memory
   * client. Returns a structured result; never throws.
   */
  private async autoConnect(): Promise<AutoConnectResult> {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    const containerName = process.env.SYSREPTOR_CONTAINER || "rtpi-sysreptor-app";

    // 1. Container alive?
    try {
      const { stdout } = await execFileAsync(
        "docker",
        ["inspect", "-f", "{{.State.Running}}", containerName],
      );
      if (stdout.trim() !== "true") {
        return {
          ok: false,
          reason: "container_not_running",
          message: `Container '${containerName}' is not running. Start it with: docker compose --profile sysreptor up -d`,
        };
      }
    } catch {
      return {
        ok: false,
        reason: "container_not_running",
        message: `Container '${containerName}' was not found. Start it with: docker compose --profile sysreptor up -d`,
      };
    }

    // 2. If we already have a working token, no work to do.
    if (this.token) {
      return { ok: true, action: "already_configured", message: "Already configured." };
    }

    // 3. Run a Django shell snippet to mint a token. The snippet:
    //    - finds the first active superuser
    //    - deletes any existing token named "rtpi-auto" (idempotency: rotate)
    //    - creates a new APIToken; the model's save() generates the plaintext
    //    - prints exactly one line: "TOKEN=<formatted>"
    //
    // Output sentinels (TOKEN=, USER=, ERR=) make parsing robust against
    // extra log lines from settings/django startup banners.
    //
    // Using execFile with an args array — never shell-interpolation — so the
    // Python source's newlines and quotes pass through verbatim.
    const pyScript = [
      "from sysreptor.users.models import PentestUser, APIToken",
      "u = PentestUser.objects.filter(is_superuser=True, is_active=True).order_by('id').first()",
      "if not u:",
      "    print('ERR=no_superuser')",
      "else:",
      "    APIToken.objects.filter(user=u, name='rtpi-auto').delete()",
      "    t = APIToken(user=u, name='rtpi-auto')",
      "    t.save()",
      "    print(f'USER={u.username}')",
      "    print(f'TOKEN={t.token_formatted}')",
    ].join("\n");

    let stdout = "";
    try {
      const result = await execFileAsync(
        "docker",
        [
          "exec",
          containerName,
          "python3",
          "/app/api/src/manage.py",
          "shell",
          "-c",
          pyScript,
        ],
        { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
      );
      stdout = result.stdout;
    } catch (err: any) {
      const stderr = (err?.stderr || "").toString().slice(0, 500);
      return {
        ok: false,
        reason: "exec_failed",
        message: `Failed to run Django shell in ${containerName}: ${stderr || err?.message || "unknown error"}`,
      };
    }

    if (stdout.includes("ERR=no_superuser")) {
      return {
        ok: false,
        reason: "no_superuser",
        message:
          "Sysreptor has no superuser. Create one with: docker compose exec sysreptor-app python3 /app/api/src/manage.py createsuperuser",
      };
    }

    const tokenMatch = stdout.match(/^TOKEN=(\S+)$/m);
    if (!tokenMatch) {
      return {
        ok: false,
        reason: "token_parse_failed",
        message: `Could not parse token from shell output. Got: ${stdout.slice(0, 300)}`,
      };
    }
    const newToken = tokenMatch[1];

    // 4. Update in-memory client + process.env so the running server picks it
    //    up immediately. Persist to .env so it survives restarts.
    this.token = newToken;
    process.env.SYSREPTOR_API_TOKEN = newToken;

    let persistedToEnv = false;
    try {
      await this.persistTokenToEnv(newToken);
      persistedToEnv = true;
    } catch (err: any) {
      // Persistence is best-effort. The in-memory token still works for this
      // process; the operator just needs to set SYSREPTOR_API_TOKEN before
      // restart, or call auto-connect again.
      console.warn(
        `[SysReptor] Auto-connect: minted token but failed to write .env: ${err?.message || err}. ` +
          "Run auto-connect again after restart, or set SYSREPTOR_API_TOKEN manually.",
      );
    }

    return {
      ok: true,
      action: "minted",
      persistedToEnv,
      message: persistedToEnv
        ? "Connected. New API token minted and persisted to .env."
        : "Connected for this session. Token was not persisted to .env (see server logs).",
    };
  }

  /**
   * Replace (or append) the SYSREPTOR_API_TOKEN line in .env atomically.
   * Resolves .env relative to the process CWD — same convention dotenv uses.
   */
  private async persistTokenToEnv(token: string): Promise<void> {
    const { readFile, writeFile, rename } = await import("fs/promises");
    const path = await import("path");
    const envPath = path.resolve(process.cwd(), ".env");

    let body = "";
    try {
      body = await readFile(envPath, "utf8");
    } catch (err: any) {
      if (err?.code !== "ENOENT") throw err;
      // .env doesn't exist — create with just this line.
      body = "";
    }

    const line = `SYSREPTOR_API_TOKEN=${token}`;
    const re = /^SYSREPTOR_API_TOKEN=.*$/m;
    const updated = re.test(body)
      ? body.replace(re, line)
      : body + (body && !body.endsWith("\n") ? "\n" : "") + line + "\n";

    // Atomic write: stage to .env.tmp then rename. Mode 600 to match
    // bootstrap-secrets.sh.
    const tmpPath = `${envPath}.tmp-${process.pid}`;
    await writeFile(tmpPath, updated, { mode: 0o600 });
    await rename(tmpPath, envPath);
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const sysReptorClient = new SysReptorClient();
