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

  constructor() {
    // Use Docker network name when running inside compose, fallback to localhost
    this.baseUrl = (
      process.env.SYSREPTOR_URL || "http://rtpi-sysreptor-app:8000"
    ).replace(/\/$/, "");
    this.token = process.env.SYSREPTOR_API_TOKEN || "";
  }

  get configured(): boolean {
    return !!this.token;
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    rawResponse = false,
  ): Promise<T> {
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
      headers: { Authorization: `Bearer ${this.token}` },
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
}

// ============================================================================
// Singleton
// ============================================================================

export const sysReptorClient = new SysReptorClient();
