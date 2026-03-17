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

  async checkHealth(): Promise<{ connected: boolean; version?: string; error?: string }> {
    if (!this.token) {
      return { connected: false, error: "SYSREPTOR_API_TOKEN not configured" };
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/pentestprojects/`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return { connected: true };
      }
      return { connected: false, error: `HTTP ${res.status}` };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : "Connection failed",
      };
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
