import { dockerExecutor } from './docker-executor';
import { db } from '../db';
import { discoveredAssets, discoveredServices, axScanResults, vulnerabilities } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface BBOTOptions {
  preset?: string;
  modules?: string[];
  flags?: string[];
  args?: string[];  // Additional -- arguments like --allow-deadly
  noDeps?: boolean;
}

interface BBOTEvent {
  type: string;
  data: string;
  timestamp: string;
  module?: string;
  scope_distance?: number;
  [key: string]: any;
}

interface BBOTResult {
  domains: BBOTEvent[];
  ips: BBOTEvent[];
  urls: BBOTEvent[];
  ports: BBOTEvent[];
  technologies: BBOTEvent[];
  vulnerabilities: BBOTEvent[];
  findings: BBOTEvent[];
  raw: BBOTEvent[];
}

interface BBOTVulnerability {
  type: 'VULNERABILITY' | 'FINDING';
  host: string;
  severity: string;
  description: string;
  module: string;
  tags: string[];
  timestamp: string;
  discoveryContext: string;
  discoveryPath: string[];
  data: Record<string, any>;
}

export class BBOTExecutor {
  /**
   * Start a BBOT scan and return the scanId immediately.
   * The scan runs asynchronously in the background.
   */
  async startScan(
    targets: string[],
    options: BBOTOptions,
    operationId: string,
    userId: string
  ): Promise<{ scanId: string }> {
    // Create scan record
    const [scanRecord] = await db
      .insert(axScanResults)
      .values({
        operationId,
        toolName: 'bbot',
        status: 'running',
        targets: targets as any,
        config: options as any,
        createdBy: userId,
        startedAt: new Date(),
      })
      .returning();

    const scanId = scanRecord.id;

    // Run the scan asynchronously (fire-and-forget with proper error handling)
    this.runScan(scanId, targets, options, operationId, scanRecord.startedAt!)
      .then((result) => {
        console.log(`✅ BBOT scan ${scanId} completed: ${result.assetsCount} assets, ${result.servicesCount} services, ${result.vulnerabilitiesCount} vulnerabilities`);
      })
      .catch((error) => {
        console.error(`❌ BBOT scan ${scanId} failed:`, error);
      });

    return { scanId };
  }

  /**
   * Run the actual BBOT scan (internal method, called asynchronously)
   */
  private async runScan(
    scanId: string,
    targets: string[],
    options: BBOTOptions,
    operationId: string,
    startedAt: Date
  ): Promise<{ assetsCount: number; servicesCount: number; vulnerabilitiesCount: number; results: BBOTResult }> {
    // Start database keepalive for long-running scan
    const { keepDatabaseAlive } = await import('./docker-executor');
    const stopKeepalive = await keepDatabaseAlive(1800000); // 30 minutes

    try {
      // Build BBOT command arguments
      const args = this.buildArgs(targets, options);

      console.log(`🔍 Starting BBOT scan ${scanId} for targets:`, targets);
      console.log(`📋 BBOT args:`, args);

      // Execute BBOT via Docker (rtpi-tools container) with automatic retry
      const result = await dockerExecutor.execWithRetry(
        'rtpi-tools',
        ['bbot', ...args],
        {
          timeout: 1800000 // 30 minutes
        }
      );

      // Parse BBOT output
      const parsedResults = this.parseOutput(result.stdout);

      // Store results in database (including vulnerabilities)
      const { assetsCount, servicesCount, vulnerabilitiesCount } = await this.storeResults(
        parsedResults,
        operationId,
        scanId
      );

      // Prepare raw output (stdout + stderr)
      const rawOutput = [
        '=== STDOUT ===',
        result.stdout,
        '',
        '=== STDERR ===',
        result.stderr || '(no stderr output)',
      ].join('\n');

      // Update scan record with results
      await db
        .update(axScanResults)
        .set({
          status: 'completed',
          results: parsedResults as any,
          rawOutput,
          assetsFound: assetsCount,
          servicesFound: servicesCount,
          vulnerabilitiesFound: vulnerabilitiesCount,
          completedAt: new Date(),
          duration: Math.floor((Date.now() - startedAt.getTime()) / 1000),
        })
        .where(eq(axScanResults.id, scanId));

      // Stop keepalive on success
      stopKeepalive();

      return {
        assetsCount,
        servicesCount,
        vulnerabilitiesCount,
        results: parsedResults,
      };
    } catch (error) {
      // Stop keepalive on error
      stopKeepalive();
      // Prepare error raw output if available
      const errorOutput = error && typeof error === 'object' && 'stdout' in error && 'stderr' in error
        ? [
            '=== ERROR ===',
            error instanceof Error ? error.message : 'Unknown error',
            '',
            '=== STDOUT ===',
            (error as any).stdout || '(no stdout output)',
            '',
            '=== STDERR ===',
            (error as any).stderr || '(no stderr output)',
          ].join('\n')
        : error instanceof Error ? error.message : 'Unknown error';

      // Update scan record with error
      await db
        .update(axScanResults)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          rawOutput: errorOutput,
          completedAt: new Date(),
        })
        .where(eq(axScanResults.id, scanId));

      throw error;
    }
  }

  /**
   * Execute a BBOT scan against targets (legacy method, waits for completion)
   */
  async executeScan(
    targets: string[],
    options: BBOTOptions,
    operationId: string,
    userId: string
  ): Promise<{ scanId: string; results: BBOTResult }> {
    // Create scan record
    const [scanRecord] = await db
      .insert(axScanResults)
      .values({
        operationId,
        toolName: 'bbot',
        status: 'running',
        targets: targets as any,
        config: options as any,
        createdBy: userId,
        startedAt: new Date(),
      })
      .returning();

    const scanId = scanRecord.id;

    // Start database keepalive for long-running scan
    const { keepDatabaseAlive } = await import('./docker-executor');
    const stopKeepalive = await keepDatabaseAlive(1800000); // 30 minutes

    try {
      // Build BBOT command arguments
      const args = this.buildArgs(targets, options);

      console.log(`🔍 Starting BBOT scan ${scanId} for targets:`, targets);
      console.log(`📋 BBOT args:`, args);

      // Execute BBOT via Docker (rtpi-tools container) with automatic retry
      const result = await dockerExecutor.execWithRetry(
        'rtpi-tools',
        ['bbot', ...args],
        {
          timeout: 1800000 // 30 minutes
        }
      );

      // Parse BBOT output
      const parsedResults = this.parseOutput(result.stdout);

      // Store results in database (including vulnerabilities)
      const { assetsCount, servicesCount, vulnerabilitiesCount } = await this.storeResults(
        parsedResults,
        operationId,
        scanId
      );

      // Prepare raw output (stdout + stderr)
      const rawOutput = [
        '=== STDOUT ===',
        result.stdout,
        '',
        '=== STDERR ===',
        result.stderr || '(no stderr output)',
      ].join('\n');

      // Update scan record with results
      await db
        .update(axScanResults)
        .set({
          status: 'completed',
          results: parsedResults as any,
          rawOutput,
          assetsFound: assetsCount,
          servicesFound: servicesCount,
          vulnerabilitiesFound: vulnerabilitiesCount,
          completedAt: new Date(),
          duration: Math.floor((Date.now() - scanRecord.startedAt!.getTime()) / 1000),
        })
        .where(eq(axScanResults.id, scanId));

      console.log(`✅ BBOT scan ${scanId} completed: ${assetsCount} assets, ${servicesCount} services, ${vulnerabilitiesCount} vulnerabilities`);

      // Stop keepalive on success
      stopKeepalive();

      return {
        scanId,
        results: parsedResults,
      };
    } catch (error) {
      // Stop keepalive on error
      stopKeepalive();
      // Prepare error raw output if available
      const errorOutput = error && typeof error === 'object' && 'stdout' in error && 'stderr' in error
        ? [
            '=== ERROR ===',
            error instanceof Error ? error.message : 'Unknown error',
            '',
            '=== STDOUT ===',
            (error as any).stdout || '(no stdout output)',
            '',
            '=== STDERR ===',
            (error as any).stderr || '(no stderr output)',
          ].join('\n')
        : error instanceof Error ? error.message : 'Unknown error';

      // Update scan record with error
      await db
        .update(axScanResults)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          rawOutput: errorOutput,
          completedAt: new Date(),
        })
        .where(eq(axScanResults.id, scanId));

      console.error(`❌ BBOT scan ${scanId} failed:`, error);
      throw error;
    }
  }

  /**
   * Build BBOT command arguments
   */
  private buildArgs(targets: string[], options: BBOTOptions): string[] {
    const args: string[] = [];

    // Add targets
    targets.forEach(target => {
      args.push('-t', target);
    });

    // Add preset
    if (options.preset && options.preset.trim()) {
      args.push('-p', options.preset.trim());
    }

    // Add modules (only if not empty)
    if (options.modules && options.modules.length > 0) {
      const moduleList = options.modules.filter(m => m && m.trim());
      if (moduleList.length > 0) {
        args.push('-m', moduleList.join(','));
      }
    }

    // Add flags (only if not empty/placeholder)
    if (options.flags && options.flags.length > 0) {
      const flagList = options.flags.filter(f => f && f.trim());
      if (flagList.length > 0) {
        args.push('-f', flagList.join(','));
      }
    }

    // Add additional -- arguments (like --allow-deadly)
    if (options.args && options.args.length > 0) {
      options.args.forEach(arg => {
        if (arg && arg.trim()) {
          // Ensure arg starts with --
          const normalizedArg = arg.startsWith('--') ? arg : `--${arg}`;
          args.push(normalizedArg);
        }
      });
    }

    // CRITICAL: Auto-confirm flag (skip "Press enter" prompt)
    args.push('-y');

    // Verbose output for debugging
    args.push('-v');

    // No dependencies flag (prevent sudo prompts)
    if (options.noDeps !== false) {
      args.push('--no-deps');
    }

    // JSON output
    args.push('--json');

    return args;
  }

  /**
   * Parse BBOT JSON output
   */
  private parseOutput(stdout: string): BBOTResult {
    const result: BBOTResult = {
      domains: [],
      ips: [],
      urls: [],
      ports: [],
      technologies: [],
      vulnerabilities: [],
      findings: [],
      raw: [],
    };

    const lines = stdout.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const event: BBOTEvent = JSON.parse(line);
        result.raw.push(event);

        // Categorize by event type
        switch (event.type) {
          case 'DNS_NAME':
          case 'DNS_NAME_UNRESOLVED':
            result.domains.push(event);
            break;
          case 'IP_ADDRESS':
            result.ips.push(event);
            break;
          case 'URL':
          case 'URL_UNVERIFIED':
            result.urls.push(event);
            break;
          case 'OPEN_TCP_PORT':
          case 'OPEN_UDP_PORT':
            result.ports.push(event);
            break;
          case 'TECHNOLOGY':
          case 'WAF':
            result.technologies.push(event);
            break;
          case 'VULNERABILITY':
            result.vulnerabilities.push(event);
            break;
          case 'FINDING':
            result.findings.push(event);
            break;
        }
      } catch (err) {
        // Skip non-JSON lines (progress indicators, etc.)
        continue;
      }
    }

    return result;
  }

  /**
   * Store BBOT results in database
   */
  private async storeResults(
    results: BBOTResult,
    operationId: string,
    scanId: string
  ): Promise<{ assetsCount: number; servicesCount: number; vulnerabilitiesCount: number }> {
    let assetsCount = 0;
    let servicesCount = 0;

    // Store discovered domains
    for (const event of results.domains) {
      try {
        const [asset] = await db
          .insert(discoveredAssets)
          .values({
            operationId,
            type: 'domain',
            value: event.data,
            hostname: event.data,
            status: 'active',
            discoveryMethod: 'bbot',
            metadata: { bbotEvent: event },
          })
          .onConflictDoNothing()
          .returning();

        if (asset) assetsCount++;
      } catch (err) {
        console.warn(`Failed to store domain ${event.data}:`, err);
      }
    }

    // Store discovered IPs
    for (const event of results.ips) {
      try {
        const [asset] = await db
          .insert(discoveredAssets)
          .values({
            operationId,
            type: 'ip',
            value: event.data,
            ipAddress: event.data,
            status: 'active',
            discoveryMethod: 'bbot',
            metadata: { bbotEvent: event },
          })
          .onConflictDoNothing()
          .returning();

        if (asset) assetsCount++;
      } catch (err) {
        console.warn(`Failed to store IP ${event.data}:`, err);
      }
    }

    // Store discovered URLs
    for (const event of results.urls) {
      try {
        const [asset] = await db
          .insert(discoveredAssets)
          .values({
            operationId,
            type: 'url',
            value: event.data,
            status: 'active',
            discoveryMethod: 'bbot',
            metadata: { bbotEvent: event },
          })
          .onConflictDoNothing()
          .returning();

        if (asset) assetsCount++;
      } catch (err) {
        console.warn(`Failed to store URL ${event.data}:`, err);
      }
    }

    // Store discovered ports/services
    for (const event of results.ports) {
      try {
        // Extract host and port from event data (format: "host:port")
        const [host, portStr] = event.data.split(':');
        const port = parseInt(portStr, 10);

        if (!host || !port) continue;

        // Find or create asset for this host
        const [asset] = await db
          .select()
          .from(discoveredAssets)
          .where(and(
            eq(discoveredAssets.operationId, operationId),
            eq(discoveredAssets.value, host)
          ))
          .limit(1);

        if (!asset) continue;

        // Determine service name from port (basic mapping)
        const serviceName = this.getServiceNameFromPort(port);
        const protocol = event.type === 'OPEN_UDP_PORT' ? 'udp' : 'tcp';

        const [service] = await db
          .insert(discoveredServices)
          .values({
            assetId: asset.id,
            name: serviceName,
            port,
            protocol,
            state: 'open',
            discoveryMethod: 'bbot',
            metadata: { bbotEvent: event },
          })
          .onConflictDoNothing()
          .returning();

        if (service) servicesCount++;
      } catch (err) {
        console.warn(`Failed to store port ${event.data}:`, err);
      }
    }

    // Store vulnerabilities and findings
    const vulnerabilitiesCount = await this.storeVulnerabilities(results, operationId, scanId);

    return { assetsCount, servicesCount, vulnerabilitiesCount };
  }

  /**
   * Map BBOT severity to schema severity enum
   */
  private mapBBOTSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'informational' {
    const s = severity?.toUpperCase() || 'INFO';
    switch (s) {
      case 'CRITICAL':
        return 'critical';
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
        return 'low';
      default:
        return 'informational';
    }
  }

  /**
   * Build vulnerability title from BBOT event
   */
  private buildVulnTitle(event: BBOTEvent): string {
    const data = event.data as Record<string, any>;

    // Try to extract a meaningful title
    if (typeof data === 'object' && data.description) {
      // Extract first sentence or up to 100 chars
      const desc = data.description;
      const firstSentence = desc.split('.')[0];
      if (firstSentence.length <= 100) {
        return firstSentence;
      }
      return desc.substring(0, 100) + '...';
    }

    // Fallback to module name + type
    return `${event.module || 'BBOT'}: ${event.type} on ${event.host || 'unknown host'}`;
  }

  /**
   * Build proof of concept from BBOT vulnerability event
   */
  private buildVulnProofOfConcept(event: BBOTEvent): string {
    const data = event.data as Record<string, any>;
    const sections: string[] = [];

    sections.push('## Detection Details');
    sections.push(`- **Module:** ${event.module || 'unknown'}`);
    sections.push(`- **Host:** ${event.host || 'unknown'}`);
    if (event.tags && event.tags.length > 0) {
      sections.push(`- **Tags:** ${event.tags.join(', ')}`);
    }
    sections.push('');

    if (event.discovery_context) {
      sections.push('## Discovery Context');
      sections.push(event.discovery_context);
      sections.push('');
    }

    if (event.discovery_path && event.discovery_path.length > 0) {
      sections.push('## Discovery Path');
      event.discovery_path.forEach((p: string) => {
        sections.push(`- ${p}`);
      });
      sections.push('');
    }

    if (typeof data === 'object') {
      sections.push('## Raw Data');
      sections.push('```json');
      sections.push(JSON.stringify(data, null, 2));
      sections.push('```');
    }

    return sections.join('\n');
  }

  /**
   * Store BBOT vulnerabilities in the vulnerabilities table
   */
  private async storeVulnerabilities(
    results: BBOTResult,
    operationId: string,
    scanId: string
  ): Promise<number> {
    let vulnerabilitiesCount = 0;

    // Process VULNERABILITY events
    for (const event of results.vulnerabilities) {
      try {
        const data = event.data as Record<string, any>;
        const severity = this.mapBBOTSeverity(
          typeof data === 'object' ? data.severity : event.tags?.find((t: string) =>
            ['critical', 'high', 'medium', 'low', 'info'].includes(t.toLowerCase())
          ) || 'info'
        );

        const description = typeof data === 'object' && data.description
          ? data.description
          : event.discovery_context || 'Vulnerability detected by BBOT';

        const [vuln] = await db
          .insert(vulnerabilities)
          .values({
            operationId,
            title: this.buildVulnTitle(event),
            description,
            severity,
            proofOfConcept: this.buildVulnProofOfConcept(event),
            references: [],
            affectedServices: [{
              host: event.host || 'unknown',
              module: event.module,
              tags: event.tags || [],
              scanId,
            }],
            status: 'open',
            discoveredAt: new Date(event.timestamp),
          })
          .onConflictDoNothing()
          .returning();

        if (vuln) vulnerabilitiesCount++;
      } catch (err) {
        console.warn(`Failed to store BBOT vulnerability:`, err);
      }
    }

    // Process FINDING events (often lower severity informational findings)
    for (const event of results.findings) {
      try {
        const data = event.data as Record<string, any>;
        const severity = this.mapBBOTSeverity(
          typeof data === 'object' ? data.severity : 'info'
        );

        const description = typeof data === 'object' && data.description
          ? data.description
          : event.discovery_context || 'Finding detected by BBOT';

        const [vuln] = await db
          .insert(vulnerabilities)
          .values({
            operationId,
            title: this.buildVulnTitle(event),
            description,
            severity,
            proofOfConcept: this.buildVulnProofOfConcept(event),
            references: [],
            affectedServices: [{
              host: event.host || 'unknown',
              module: event.module,
              tags: event.tags || [],
              scanId,
            }],
            status: 'open',
            discoveredAt: new Date(event.timestamp),
          })
          .onConflictDoNothing()
          .returning();

        if (vuln) vulnerabilitiesCount++;
      } catch (err) {
        console.warn(`Failed to store BBOT finding:`, err);
      }
    }

    return vulnerabilitiesCount;
  }

  /**
   * Map common ports to service names
   */
  private getServiceNameFromPort(port: number): string {
    const commonPorts: Record<number, string> = {
      20: 'FTP-DATA',
      21: 'FTP',
      22: 'SSH',
      23: 'TELNET',
      25: 'SMTP',
      53: 'DNS',
      80: 'HTTP',
      110: 'POP3',
      143: 'IMAP',
      443: 'HTTPS',
      445: 'SMB',
      3306: 'MYSQL',
      3389: 'RDP',
      5432: 'POSTGRESQL',
      6379: 'REDIS',
      8080: 'HTTP-PROXY',
      8443: 'HTTPS-ALT',
      27017: 'MONGODB',
    };

    return commonPorts[port] || `PORT-${port}`;
  }
}

export const bbotExecutor = new BBOTExecutor();
