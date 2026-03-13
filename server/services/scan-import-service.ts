/**
 * Scan Import Service
 *
 * Handles importing JSON output from security tools (BBOT, Nuclei, Nmap, Burp Suite)
 * into the RTPI database. Auto-detects tool format, parses results into
 * assets/services/vulnerabilities, and triggers the workflow pipeline.
 */

import { db } from '../db';
import { discoveredAssets, discoveredServices, vulnerabilities, axScanResults } from '@shared/schema';
import { resolveTargetId } from './target-resolver';
import { eq, and, sql } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

type DetectedTool = 'bbot' | 'nuclei' | 'nmap' | 'burp';
type ScanType = 'bbot' | 'nuclei' | 'nmap' | 'other';

interface ParsedAsset {
  type: 'host' | 'domain' | 'ip' | 'network' | 'url' | 'technology' | 'asn' | 'email' | 'storage_bucket';
  value: string;
  hostname?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

interface ParsedService {
  assetValue: string; // used to link to the parent asset
  name: string;
  port: number;
  protocol: string;
  version?: string;
  state: string;
  metadata?: Record<string, any>;
}

interface ParsedVulnerability {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  cvssScore?: number | null;
  cvssVector?: string | null;
  cveId?: string | null;
  cweId?: string | null;
  proofOfConcept?: string;
  references?: string[];
  affectedServices?: any[];
  discoveredAt?: Date;
}

interface ParsedScanData {
  assets: ParsedAsset[];
  services: ParsedService[];
  vulnerabilities: ParsedVulnerability[];
}

export interface ImportResult {
  success: boolean;
  scanId: string;
  detectedTool: DetectedTool;
  stats: {
    assetsFound: number;
    servicesFound: number;
    vulnerabilitiesFound: number;
  };
  pipelineTriggered: boolean;
}

// ============================================================================
// Port-to-Service Mapping
// ============================================================================

const COMMON_PORTS: Record<number, string> = {
  20: 'FTP-DATA', 21: 'FTP', 22: 'SSH', 23: 'TELNET', 25: 'SMTP',
  53: 'DNS', 80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS',
  445: 'SMB', 3306: 'MYSQL', 3389: 'RDP', 5432: 'POSTGRESQL',
  6379: 'REDIS', 8080: 'HTTP-PROXY', 8443: 'HTTPS-ALT', 27017: 'MONGODB',
};

// ============================================================================
// Scan Import Service
// ============================================================================

class ScanImportService {

  /**
   * Import a JSON file/string into the database and trigger workflows.
   */
  async importFile(
    fileContent: string,
    operationId: string,
    userId: string,
    toolHint?: string
  ): Promise<ImportResult> {
    // Parse the JSON content (supports JSONL and standard JSON)
    const data = this.parseJsonContent(fileContent);

    // Detect tool format
    const detectedTool = toolHint
      ? this.validateToolHint(toolHint)
      : this.detectToolFormat(data);

    if (!detectedTool) {
      throw new Error(
        'Unable to detect tool format. Supported formats: BBOT (JSONL events), Nuclei (JSONL findings), Nmap (XML-to-JSON), Burp Suite (issues array). Use toolHint to specify the format.'
      );
    }

    // Parse per tool
    const parsed = this.parseToolData(detectedTool, data, fileContent);

    // Create axScanResults record
    const now = new Date();
    const [scanRecord] = await db
      .insert(axScanResults)
      .values({
        operationId,
        toolName: `${detectedTool}-import`,
        status: 'completed',
        targets: [] as any,
        config: { importedBy: userId, toolHint, detectedTool } as any,
        results: data as any,
        rawOutput: fileContent.substring(0, 100000), // cap at 100k chars
        createdBy: userId,
        startedAt: now,
        completedAt: now,
        duration: 0,
      })
      .returning();

    const scanId = scanRecord.id;

    // Store parsed results
    const stats = await this.storeResults(parsed, operationId, scanId, detectedTool);

    // Update scan record with counts
    await db
      .update(axScanResults)
      .set({
        assetsFound: stats.assetsFound,
        servicesFound: stats.servicesFound,
        vulnerabilitiesFound: stats.vulnerabilitiesFound,
      })
      .where(eq(axScanResults.id, scanId));

    // Trigger workflow pipeline
    let pipelineTriggered = false;
    try {
      await this.triggerPipeline(scanId, detectedTool, operationId, userId);
      pipelineTriggered = true;
    } catch (err) {
      console.error('Scan import: pipeline trigger failed:', err);
    }

    return {
      success: true,
      scanId,
      detectedTool,
      stats,
      pipelineTriggered,
    };
  }

  // ==========================================================================
  // JSON Parsing
  // ==========================================================================

  private parseJsonContent(content: string): any {
    const trimmed = content.trim();

    // Try standard JSON first
    try {
      return JSON.parse(trimmed);
    } catch {
      // Try JSONL (newline-delimited JSON)
      const lines = trimmed.split('\n').filter(l => l.trim());
      const parsed: any[] = [];
      for (const line of lines) {
        try {
          parsed.push(JSON.parse(line.trim()));
        } catch {
          // skip non-JSON lines
        }
      }
      if (parsed.length > 0) {
        return parsed;
      }
      throw new Error('Invalid JSON: content is neither valid JSON nor JSONL');
    }
  }

  // ==========================================================================
  // Format Detection
  // ==========================================================================

  private validateToolHint(hint: string): DetectedTool | null {
    const map: Record<string, DetectedTool> = {
      bbot: 'bbot', nuclei: 'nuclei', nmap: 'nmap', burp: 'burp',
    };
    return map[hint.toLowerCase()] || null;
  }

  private detectToolFormat(data: any): DetectedTool | null {
    // Array of objects — check first few items
    const items = Array.isArray(data) ? data : [data];
    if (items.length === 0) return null;

    const sample = items[0];
    if (!sample || typeof sample !== 'object') return null;

    // BBOT: objects with `type` matching BBOT event types
    const bbotTypes = new Set([
      'DNS_NAME', 'DNS_NAME_UNRESOLVED', 'IP_ADDRESS', 'URL', 'URL_UNVERIFIED',
      'OPEN_TCP_PORT', 'OPEN_UDP_PORT', 'TECHNOLOGY', 'WAF', 'ASN',
      'EMAIL_ADDRESS', 'STORAGE_BUCKET', 'VULNERABILITY', 'FINDING',
    ]);
    if (sample.type && bbotTypes.has(sample.type) && 'data' in sample) {
      return 'bbot';
    }

    // Nuclei: objects with template-id and info.severity
    if (sample['template-id'] && sample.info?.severity) {
      return 'nuclei';
    }

    // Nmap: nmaprun root or hosts with ports array
    if (data.nmaprun || (sample.address && sample.ports)) {
      return 'nmap';
    }
    // Also handle nmap-formatter style: { hosts: [...] }
    if (data.hosts && Array.isArray(data.hosts)) {
      const h = data.hosts[0];
      if (h && (h.address || h.ip || h.ports)) return 'nmap';
    }

    // Burp Suite: issues array
    if (data.issues && Array.isArray(data.issues)) {
      return 'burp';
    }
    // Or array of items that look like Burp issues
    if (sample.confidence && sample.severity && (sample.host || sample.path)) {
      return 'burp';
    }

    return null;
  }

  // ==========================================================================
  // Per-Tool Parsers
  // ==========================================================================

  private parseToolData(tool: DetectedTool, data: any, rawContent: string): ParsedScanData {
    switch (tool) {
      case 'bbot': return this.parseBBOTData(data, rawContent);
      case 'nuclei': return this.parseNucleiData(data);
      case 'nmap': return this.parseNmapData(data);
      case 'burp': return this.parseBurpData(data);
    }
  }

  /**
   * Parse BBOT JSONL events into assets, services, and vulnerabilities.
   */
  private parseBBOTData(data: any, rawContent: string): ParsedScanData {
    const assets: ParsedAsset[] = [];
    const services: ParsedService[] = [];
    const vulns: ParsedVulnerability[] = [];

    // Ensure we have an array of events
    let events: any[];
    if (Array.isArray(data)) {
      events = data;
    } else {
      // Single event object
      events = [data];
    }

    for (const event of events) {
      if (!event || !event.type) continue;

      switch (event.type) {
        case 'DNS_NAME':
        case 'DNS_NAME_UNRESOLVED':
          assets.push({ type: 'domain', value: event.data, hostname: event.data, metadata: { bbotEvent: event } });
          break;
        case 'IP_ADDRESS':
          assets.push({ type: 'ip', value: event.data, ipAddress: event.data, metadata: { bbotEvent: event } });
          break;
        case 'URL':
        case 'URL_UNVERIFIED':
          assets.push({ type: 'url', value: event.data, metadata: { bbotEvent: event } });
          break;
        case 'OPEN_TCP_PORT':
        case 'OPEN_UDP_PORT': {
          const [host, portStr] = (event.data || '').split(':');
          const port = parseInt(portStr, 10);
          if (host && port) {
            services.push({
              assetValue: host,
              name: COMMON_PORTS[port] || `PORT-${port}`,
              port,
              protocol: event.type === 'OPEN_UDP_PORT' ? 'udp' : 'tcp',
              state: 'open',
              metadata: { bbotEvent: event },
            });
          }
          break;
        }
        case 'TECHNOLOGY':
        case 'WAF': {
          const val = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
          assets.push({ type: 'technology', value: val, hostname: event.host, metadata: { bbotEvent: event } });
          break;
        }
        case 'ASN': {
          const val = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
          assets.push({ type: 'asn', value: val, metadata: { bbotEvent: event } });
          break;
        }
        case 'EMAIL_ADDRESS':
          assets.push({ type: 'email', value: event.data, metadata: { bbotEvent: event } });
          break;
        case 'STORAGE_BUCKET':
          assets.push({ type: 'storage_bucket', value: event.data, metadata: { bbotEvent: event } });
          break;
        case 'VULNERABILITY':
        case 'FINDING': {
          const evData = event.data as Record<string, any>;
          const severity = this.mapSeverity(
            typeof evData === 'object' ? evData.severity : event.tags?.find((t: string) =>
              ['critical', 'high', 'medium', 'low', 'info'].includes(t.toLowerCase())
            ) || 'info'
          );

          const description = typeof evData === 'object' && evData.description
            ? evData.description
            : event.discovery_context || `${event.type} detected by BBOT`;

          const title = typeof evData === 'object' && evData.description
            ? evData.description.split('.')[0].substring(0, 100)
            : `${event.module || 'BBOT'}: ${event.type} on ${event.host || 'unknown'}`;

          vulns.push({
            title,
            description,
            severity,
            affectedServices: [{ host: event.host || 'unknown', module: event.module, tags: event.tags || [] }],
            discoveredAt: event.timestamp ? new Date(event.timestamp) : undefined,
          });
          break;
        }
      }
    }

    return { assets, services, vulnerabilities: vulns };
  }

  /**
   * Parse Nuclei JSONL findings into vulnerabilities (and extract host assets).
   */
  private parseNucleiData(data: any): ParsedScanData {
    const assets: ParsedAsset[] = [];
    const services: ParsedService[] = [];
    const vulns: ParsedVulnerability[] = [];
    const seenHosts = new Set<string>();

    const items = Array.isArray(data) ? data : [data];

    for (const vuln of items) {
      if (!vuln || !vuln['template-id']) continue;

      // Extract host as an asset
      const host = this.extractHost(vuln.host);
      if (host && !seenHosts.has(host)) {
        seenHosts.add(host);
        const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
        assets.push({
          type: isIp ? 'ip' : 'domain',
          value: host,
          ...(isIp ? { ipAddress: host } : { hostname: host }),
          metadata: { importedFrom: 'nuclei' },
        });
      }

      // Build vulnerability
      const severity = this.mapSeverity(vuln.info?.severity);
      const cveId = vuln.info?.classification?.['cve-id']?.[0] || null;
      const cweId = vuln.info?.classification?.['cwe-id']?.[0] || null;
      const cvssScore = vuln.info?.classification?.['cvss-score'] || null;
      const cvssVector = vuln.info?.classification?.['cvss-metrics'] || null;

      const pocParts: string[] = [
        `## Nuclei Detection`,
        `**Template:** ${vuln['template-id']}`,
        `**Type:** ${vuln.type || 'unknown'}`,
        `**Host:** ${vuln.host}`,
      ];
      if (vuln['matched-at']) pocParts.push(`**Matched At:** ${vuln['matched-at']}`);
      if (vuln['curl-command']) pocParts.push(`\n**Curl Command:**\n\`\`\`\n${vuln['curl-command']}\n\`\`\``);
      if (vuln['extracted-results']?.length) {
        pocParts.push(`\n**Extracted Results:**`);
        vuln['extracted-results'].forEach((r: string) => pocParts.push(`- ${r}`));
      }

      const references = [...(vuln.info?.reference || [])];
      if (vuln['template-url']) references.push(vuln['template-url']);

      vulns.push({
        title: vuln.info?.name || vuln['template-id'],
        description: vuln.info?.description || `Vulnerability detected by Nuclei template: ${vuln['template-id']}`,
        severity,
        cvssScore: cvssScore ? Math.round(cvssScore * 10) : null,
        cvssVector,
        cveId,
        cweId,
        proofOfConcept: pocParts.join('\n'),
        references,
        affectedServices: [{ host: vuln.host, matched: vuln.matched || vuln['matched-at'], ip: vuln.ip }],
        discoveredAt: vuln.timestamp ? new Date(vuln.timestamp) : undefined,
      });
    }

    return { assets, services, vulnerabilities: vulns };
  }

  /**
   * Parse Nmap XML-to-JSON output into assets and services.
   */
  private parseNmapData(data: any): ParsedScanData {
    const assets: ParsedAsset[] = [];
    const services: ParsedService[] = [];
    const vulns: ParsedVulnerability[] = [];

    // Extract hosts from different Nmap JSON formats
    let hosts: any[] = [];

    if (data.nmaprun?.host) {
      // Standard nmap XML-to-JSON (e.g., xml2json)
      hosts = Array.isArray(data.nmaprun.host) ? data.nmaprun.host : [data.nmaprun.host];
    } else if (data.hosts && Array.isArray(data.hosts)) {
      // nmap-formatter style
      hosts = data.hosts;
    } else if (Array.isArray(data)) {
      // Array of host objects
      hosts = data;
    } else if (data.address || data.ports) {
      // Single host object
      hosts = [data];
    }

    for (const host of hosts) {
      // Extract IP address
      let ip: string | undefined;
      let hostname: string | undefined;

      if (typeof host.address === 'string') {
        ip = host.address;
      } else if (host.address?.addr) {
        ip = host.address.addr;
      } else if (Array.isArray(host.address)) {
        const ipv4 = host.address.find((a: any) => a.addrtype === 'ipv4');
        ip = ipv4?.addr || host.address[0]?.addr;
      } else if (host.ip) {
        ip = host.ip;
      }

      // Extract hostname
      if (host.hostnames) {
        const hns = Array.isArray(host.hostnames) ? host.hostnames : [host.hostnames];
        for (const hn of hns) {
          if (hn.hostname) {
            const names = Array.isArray(hn.hostname) ? hn.hostname : [hn.hostname];
            hostname = names[0]?.name || (typeof names[0] === 'string' ? names[0] : undefined);
          }
        }
      } else if (host.hostname) {
        hostname = typeof host.hostname === 'string' ? host.hostname : host.hostname?.name;
      }

      if (!ip && !hostname) continue;

      // Create asset for the host
      const assetValue = ip || hostname!;
      const isIp = ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);

      assets.push({
        type: isIp ? 'ip' : 'domain',
        value: assetValue,
        ipAddress: ip,
        hostname: hostname,
        metadata: { importedFrom: 'nmap' },
      });

      // If hostname differs from IP, add as a separate domain asset
      if (hostname && hostname !== ip) {
        assets.push({
          type: 'domain',
          value: hostname,
          hostname,
          ipAddress: ip,
          metadata: { importedFrom: 'nmap' },
        });
      }

      // Extract ports/services
      let ports: any[] = [];
      if (host.ports?.port) {
        ports = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
      } else if (Array.isArray(host.ports)) {
        ports = host.ports;
      }

      for (const p of ports) {
        const portNum = parseInt(p.portid || p.port, 10);
        if (!portNum) continue;

        const state = p.state?.state || p.state || 'open';
        if (typeof state === 'string' && state !== 'open' && state !== 'filtered') continue;

        const serviceName = p.service?.name || p.service || COMMON_PORTS[portNum] || `PORT-${portNum}`;
        const version = [p.service?.product, p.service?.version].filter(Boolean).join(' ') || undefined;

        services.push({
          assetValue,
          name: typeof serviceName === 'string' ? serviceName.toUpperCase() : `PORT-${portNum}`,
          port: portNum,
          protocol: p.protocol || 'tcp',
          version,
          state: typeof state === 'string' ? state : 'open',
          metadata: { importedFrom: 'nmap' },
        });
      }
    }

    return { assets, services, vulnerabilities: vulns };
  }

  /**
   * Parse Burp Suite JSON export (issues array) into vulnerabilities and assets.
   */
  private parseBurpData(data: any): ParsedScanData {
    const assets: ParsedAsset[] = [];
    const services: ParsedService[] = [];
    const vulns: ParsedVulnerability[] = [];
    const seenHosts = new Set<string>();

    const issues = data.issues || (Array.isArray(data) ? data : []);

    for (const issue of issues) {
      if (!issue || !issue.name) continue;

      // Extract host as asset
      const host = issue.host?.ip || issue.host || issue.origin;
      if (host && typeof host === 'string' && !seenHosts.has(host)) {
        seenHosts.add(host);
        const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
        assets.push({
          type: isIp ? 'ip' : 'url',
          value: host,
          ...(isIp ? { ipAddress: host } : {}),
          metadata: { importedFrom: 'burp' },
        });
      }

      // Map Burp severity
      const severity = this.mapBurpSeverity(issue.severity);

      // Build proof of concept
      const pocParts: string[] = [`## Burp Suite Finding`];
      if (issue.host) pocParts.push(`**Host:** ${typeof issue.host === 'object' ? issue.host.ip : issue.host}`);
      if (issue.path) pocParts.push(`**Path:** ${issue.path}`);
      if (issue.confidence) pocParts.push(`**Confidence:** ${issue.confidence}`);
      if (issue.issueBackground) pocParts.push(`\n## Background\n${issue.issueBackground}`);
      if (issue.remediationBackground) pocParts.push(`\n## Remediation\n${issue.remediationBackground}`);

      vulns.push({
        title: issue.name,
        description: issue.issueDetail || issue.issueBackground || issue.name,
        severity,
        proofOfConcept: pocParts.join('\n'),
        references: issue.references ? [issue.references] : [],
        affectedServices: [{
          host: typeof issue.host === 'object' ? issue.host.ip : issue.host,
          path: issue.path,
          confidence: issue.confidence,
        }],
      });
    }

    return { assets, services, vulnerabilities: vulns };
  }

  // ==========================================================================
  // Database Storage
  // ==========================================================================

  private async storeResults(
    parsed: ParsedScanData,
    operationId: string,
    scanId: string,
    tool: DetectedTool
  ): Promise<{ assetsFound: number; servicesFound: number; vulnerabilitiesFound: number }> {
    let assetsFound = 0;
    let servicesFound = 0;
    let vulnerabilitiesFound = 0;

    // Determine discovery method
    const discoveryMethod = (['bbot', 'nuclei', 'nmap'] as const).includes(tool as any)
      ? (tool as 'bbot' | 'nuclei' | 'nmap')
      : 'import' as const;

    // Store assets
    const assetMap = new Map<string, string>(); // value → id
    for (const asset of parsed.assets) {
      try {
        const [upserted] = await db
          .insert(discoveredAssets)
          .values({
            operationId,
            type: asset.type,
            value: asset.value,
            hostname: asset.hostname,
            ipAddress: asset.ipAddress,
            status: 'active',
            discoveryMethod,
            metadata: { ...asset.metadata, importedAt: new Date().toISOString(), scanId },
          })
          .onConflictDoUpdate({
            target: [discoveredAssets.operationId, discoveredAssets.type, discoveredAssets.value],
            set: { lastSeenAt: new Date() },
          })
          .returning();

        if (upserted) {
          assetsFound++;
          assetMap.set(asset.value, upserted.id);
        }
      } catch (err) {
        console.warn(`Scan import: failed to store asset ${asset.value}:`, err);
      }
    }

    // Store services (linked to assets)
    for (const svc of parsed.services) {
      try {
        const assetId = assetMap.get(svc.assetValue);
        if (!assetId) continue;

        const [upserted] = await db
          .insert(discoveredServices)
          .values({
            assetId,
            name: svc.name,
            port: svc.port,
            protocol: svc.protocol,
            version: svc.version,
            state: svc.state,
            discoveryMethod,
            metadata: { ...svc.metadata, scanId },
          })
          .onConflictDoUpdate({
            target: [discoveredServices.assetId, discoveredServices.port, discoveredServices.protocol],
            set: {
              version: sql`COALESCE(EXCLUDED.version, ${discoveredServices.version})`,
              state: sql`EXCLUDED.state`,
              metadata: sql`EXCLUDED.metadata`,
            },
          })
          .returning();

        if (upserted) servicesFound++;
      } catch (err) {
        console.warn(`Scan import: failed to store service ${svc.name}:${svc.port}:`, err);
      }
    }

    // Store vulnerabilities
    for (const vuln of parsed.vulnerabilities) {
      try {
        const hostVal = vuln.affectedServices?.[0]?.host;
        const targetId = hostVal ? await resolveTargetId(operationId, hostVal) : null;

        const [upserted] = await db
          .insert(vulnerabilities)
          .values({
            operationId,
            targetId,
            title: vuln.title,
            description: vuln.description,
            severity: vuln.severity,
            cvssScore: vuln.cvssScore,
            cvssVector: vuln.cvssVector,
            cveId: vuln.cveId,
            cweId: vuln.cweId,
            proofOfConcept: vuln.proofOfConcept,
            references: (vuln.references || []) as any,
            affectedServices: (vuln.affectedServices || []) as any,
            status: 'open',
            discoveredAt: vuln.discoveredAt || new Date(),
          })
          .onConflictDoUpdate({
            target: [vulnerabilities.operationId, vulnerabilities.title],
            set: { updatedAt: new Date() },
          })
          .returning();

        if (upserted) vulnerabilitiesFound++;
      } catch (err) {
        console.warn(`Scan import: failed to store vulnerability ${vuln.title}:`, err);
      }
    }

    return { assetsFound, servicesFound, vulnerabilitiesFound };
  }

  // ==========================================================================
  // Workflow Pipeline Trigger
  // ==========================================================================

  private async triggerPipeline(
    scanId: string,
    tool: DetectedTool,
    operationId: string,
    userId: string
  ): Promise<void> {
    const scanTypeMap: Record<DetectedTool, ScanType> = {
      bbot: 'bbot',
      nuclei: 'nuclei',
      nmap: 'nmap',
      burp: 'other',
    };

    const scanType = scanTypeMap[tool];

    const { workflowEventHandlers } = await import('./workflow-event-handlers');
    await workflowEventHandlers.handleScanCompleted(scanId, scanType, operationId, userId);
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private mapSeverity(value?: string): 'critical' | 'high' | 'medium' | 'low' | 'informational' {
    const s = (value || 'info').toLowerCase();
    switch (s) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'informational';
    }
  }

  private mapBurpSeverity(value?: string): 'critical' | 'high' | 'medium' | 'low' | 'informational' {
    const s = (value || 'Information').toLowerCase();
    switch (s) {
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      case 'information': case 'informational': return 'informational';
      default: return 'informational';
    }
  }

  private extractHost(url?: string): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      // Not a URL — might already be a hostname
      return url.split(':')[0] || null;
    }
  }
}

export const scanImportService = new ScanImportService();
