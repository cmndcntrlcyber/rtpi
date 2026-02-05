import { dockerExecutor } from './docker-executor';
import { db } from '../db';
import { discoveredAssets, vulnerabilities, axScanResults } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface NucleiOptions {
  severity?: string;       // critical,high,medium,low,info
  rateLimit?: number;      // requests per second
  templates?: string[];    // template paths/tags
  tags?: string[];         // template tags to include
  excludeTags?: string[];  // template tags to exclude
}

interface NucleiVuln {
  template: string;
  'template-url'?: string;
  'template-id': string;
  'template-path'?: string;
  info: {
    name: string;
    author?: string[];
    tags?: string[];
    description?: string;
    reference?: string[];
    severity: string;
    classification?: {
      'cve-id'?: string[];
      'cwe-id'?: string[];
      'cvss-metrics'?: string;
      'cvss-score'?: number;
    };
  };
  type: string;
  host: string;
  matched?: string;
  'matched-at'?: string;
  'extracted-results'?: string[];
  ip?: string;
  timestamp: string;
  'curl-command'?: string;
  'matcher-name'?: string;
  'matcher-status'?: boolean;
}

interface NucleiResult {
  vulnerabilities: NucleiVuln[];
  stats: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export class NucleiExecutor {
  /**
   * Start a Nuclei scan and return the scanId immediately.
   * The scan runs asynchronously in the background.
   */
  async startScan(
    targets: string[],
    options: NucleiOptions,
    operationId: string,
    userId: string
  ): Promise<{ scanId: string }> {
    // Create scan record
    const [scanRecord] = await db
      .insert(axScanResults)
      .values({
        operationId,
        toolName: 'nuclei',
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
        console.log(`✅ Nuclei scan ${scanId} completed: ${result.vulnerabilitiesCount} vulnerabilities found`);
      })
      .catch((error) => {
        console.error(`❌ Nuclei scan ${scanId} failed:`, error);
      });

    return { scanId };
  }

  /**
   * Run the actual Nuclei scan (internal method, called asynchronously)
   */
  private async runScan(
    scanId: string,
    targets: string[],
    options: NucleiOptions,
    operationId: string,
    startedAt: Date
  ): Promise<{ vulnerabilitiesCount: number; results: NucleiResult }> {
    // Start database keepalive for long-running scan
    const { keepDatabaseAlive } = await import('./docker-executor');
    const stopKeepalive = await keepDatabaseAlive(7200000); // 2 hours

    try {
      // Build Nuclei command arguments
      const args = this.buildArgs(targets, options);

      console.log(`🔍 Starting Nuclei scan ${scanId} for targets:`, targets);
      console.log(`📋 Nuclei args:`, args);

      // Warn about large template sets
      if (options.templates) {
        const hasCVEs = options.templates.some(t => t.includes('cves'));
        const hasVulns = options.templates.some(t => t.includes('vulnerabilities'));
        if (hasCVEs || hasVulns) {
          console.log(`⚠️  Large template set detected (CVEs: ${hasCVEs ? '3600+' : '0'}, Vulns: ${hasVulns ? '900+' : '0'} templates)`);
          console.log(`⏱️  Scan may take 30-60+ minutes depending on targets and network conditions`);
        }
      }

      // Execute Nuclei via Docker (rtpi-tools container) with automatic retry
      const result = await dockerExecutor.execWithRetry(
        'rtpi-tools',
        ['nuclei', ...args],
        {}
      );

      // Parse Nuclei output
      const parsedResults = this.parseOutput(result.stdout);

      // Store results in database
      const vulnerabilitiesCount = await this.storeResults(
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
          vulnerabilitiesFound: vulnerabilitiesCount,
          completedAt: new Date(),
          duration: Math.floor((Date.now() - startedAt.getTime()) / 1000),
        })
        .where(eq(axScanResults.id, scanId));

      // Stop keepalive on success
      stopKeepalive();

      return {
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
   * Execute a Nuclei vulnerability scan against targets (legacy method, waits for completion)
   */
  async executeScan(
    targets: string[],
    options: NucleiOptions,
    operationId: string,
    userId: string
  ): Promise<{ scanId: string; results: NucleiResult }> {
    // Create scan record
    const [scanRecord] = await db
      .insert(axScanResults)
      .values({
        operationId,
        toolName: 'nuclei',
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
    const stopKeepalive = await keepDatabaseAlive(7200000); // 2 hours

    try {
      // Build Nuclei command arguments
      const args = this.buildArgs(targets, options);

      console.log(`🔍 Starting Nuclei scan ${scanId} for targets:`, targets);
      console.log(`📋 Nuclei args:`, args);

      // Warn about large template sets
      if (options.templates) {
        const hasCVEs = options.templates.some(t => t.includes('cves'));
        const hasVulns = options.templates.some(t => t.includes('vulnerabilities'));
        if (hasCVEs || hasVulns) {
          console.log(`⚠️  Large template set detected (CVEs: ${hasCVEs ? '3600+' : '0'}, Vulns: ${hasVulns ? '900+' : '0'} templates)`);
          console.log(`⏱️  Scan may take 30-60+ minutes depending on targets and network conditions`);
        }
      }

      // Execute Nuclei via Docker (rtpi-tools container) with automatic retry
      const result = await dockerExecutor.execWithRetry(
        'rtpi-tools',
        ['nuclei', ...args],
        {}
      );

      // Parse Nuclei output
      const parsedResults = this.parseOutput(result.stdout);

      // Store results in database
      const vulnerabilitiesCount = await this.storeResults(
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
          vulnerabilitiesFound: vulnerabilitiesCount,
          completedAt: new Date(),
          duration: Math.floor((Date.now() - scanRecord.startedAt!.getTime()) / 1000),
        })
        .where(eq(axScanResults.id, scanId));

      console.log(`✅ Nuclei scan ${scanId} completed: ${vulnerabilitiesCount} vulnerabilities found`);

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

      console.error(`❌ Nuclei scan ${scanId} failed:`, error);
      throw error;
    }
  }

  /**
   * Build Nuclei command arguments
   */
  private buildArgs(targets: string[], options: NucleiOptions): string[] {
    const args: string[] = [];

    // Add targets
    targets.forEach(target => {
      args.push('-u', target);
    });

    // Add severity filter
    if (options.severity && options.severity.trim()) {
      args.push('-severity', options.severity.trim());
    }

    // Add rate limiting
    if (options.rateLimit && options.rateLimit > 0) {
      args.push('-rate-limit', options.rateLimit.toString());
    }

    // Add template tags
    if (options.tags && options.tags.length > 0) {
      const tagList = options.tags.filter(t => t && t.trim());
      if (tagList.length > 0) {
        args.push('-tags', tagList.join(','));
      }
    }

    // Add exclude tags
    if (options.excludeTags && options.excludeTags.length > 0) {
      const excludeList = options.excludeTags.filter(t => t && t.trim());
      if (excludeList.length > 0) {
        args.push('-exclude-tags', excludeList.join(','));
      }
    }

    // Add specific templates
    if (options.templates && options.templates.length > 0) {
      options.templates.forEach(template => {
        if (template && template.trim()) {
          // Prepend nuclei-templates path and http/ prefix if needed
          let templatePath = template.trim();
          if (!templatePath.startsWith('/') && !templatePath.startsWith('nuclei-templates/')) {
            // If it's a relative path like "cves/" or "vulnerabilities/", add the proper prefix
            if (templatePath === 'cves/' || templatePath === 'vulnerabilities/' ||
                templatePath.startsWith('cves/') || templatePath.startsWith('vulnerabilities/')) {
              templatePath = `nuclei-templates/http/${templatePath}`;
            } else {
              templatePath = `nuclei-templates/${templatePath}`;
            }
          }
          args.push('-t', templatePath);
        }
      });
    }

    // Performance optimizations - balanced settings to avoid overwhelming targets
    // Template concurrency (default is 25)
    args.push('-c', '25');

    // Bulk size for HTTP request batching (default is 25)
    args.push('-bulk-size', '25');

    // Payload concurrency per template (default is 25)
    args.push('-pc', '25');

    // Set max-host-error to prevent early termination (default is 30)
    args.push('-max-host-error', '50');

    // JSONL output for parsing (Nuclei 3.x uses -jsonl)
    args.push('-jsonl');

    // Note: -silent flag removed to capture scan progress/info in output
    // This provides visibility when scans complete with 0 findings

    // Disable automatic updates during scan
    args.push('-disable-update-check');

    return args;
  }

  /**
   * Parse Nuclei JSON output
   */
  private parseOutput(stdout: string): NucleiResult {
    const result: NucleiResult = {
      vulnerabilities: [],
      stats: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
    };

    const lines = stdout.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const vuln: NucleiVuln = JSON.parse(line);
        result.vulnerabilities.push(vuln);
        result.stats.total++;

        // Count by severity
        const severity = vuln.info?.severity?.toLowerCase() || 'info';
        switch (severity) {
          case 'critical':
            result.stats.critical++;
            break;
          case 'high':
            result.stats.high++;
            break;
          case 'medium':
            result.stats.medium++;
            break;
          case 'low':
            result.stats.low++;
            break;
          default:
            result.stats.info++;
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
   * Store Nuclei results in database
   */
  private async storeResults(
    results: NucleiResult,
    operationId: string,
    _scanId: string
  ): Promise<number> {
    let vulnerabilitiesCount = 0;

    for (const vuln of results.vulnerabilities) {
      try {
        // Map Nuclei severity to our schema
        const severity = this.mapSeverity(vuln.info?.severity);

        // Extract CVE/CWE if available
        const cveId = vuln.info?.classification?.['cve-id']?.[0] || null;
        const cweId = vuln.info?.classification?.['cwe-id']?.[0] || null;
        const cvssScore = vuln.info?.classification?.['cvss-score'] || null;
        const cvssVector = vuln.info?.classification?.['cvss-metrics'] || null;

        // Build proof of concept from matched data
        const proofOfConcept = this.buildProofOfConcept(vuln);

        // Build references array
        const references = vuln.info?.reference || [];
        if (vuln['template-url']) {
          references.push(vuln['template-url']);
        }

        // Find the target/asset for this vulnerability
        // First try to find by host
        const host = this.extractHostFromUrl(vuln.host);

        const [vulnerability] = await db
          .insert(vulnerabilities)
          .values({
            operationId,
            title: vuln.info?.name || vuln['template-id'],
            description: vuln.info?.description || `Vulnerability detected by Nuclei template: ${vuln['template-id']}`,
            severity,
            cvssScore: cvssScore ? Math.round(cvssScore * 10) : null, // Store as integer (multiply by 10)
            cvssVector,
            cveId,
            cweId,
            proofOfConcept,
            references: references as any,
            affectedServices: [{
              host: vuln.host,
              matched: vuln.matched || vuln['matched-at'],
              ip: vuln.ip,
            }] as any,
            status: 'open',
            discoveredAt: new Date(vuln.timestamp),
          })
          .onConflictDoNothing()
          .returning();

        if (vulnerability) vulnerabilitiesCount++;
      } catch (err) {
        console.warn(`Failed to store vulnerability ${vuln.info?.name}:`, err);
      }
    }

    return vulnerabilitiesCount;
  }

  /**
   * Map Nuclei severity to our schema severity
   */
  private mapSeverity(nucleiSeverity?: string): 'critical' | 'high' | 'medium' | 'low' | 'informational' {
    const severity = nucleiSeverity?.toLowerCase() || 'info';
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'informational';
    }
  }

  /**
   * Build proof of concept from Nuclei vulnerability data
   */
  private buildProofOfConcept(vuln: NucleiVuln): string {
    const parts: string[] = [];

    parts.push(`## Nuclei Detection`);
    parts.push(`**Template:** ${vuln['template-id']}`);
    parts.push(`**Type:** ${vuln.type}`);
    parts.push(`**Host:** ${vuln.host}`);

    if (vuln['matched-at']) {
      parts.push(`**Matched At:** ${vuln['matched-at']}`);
    }

    if (vuln.matched) {
      parts.push(`\n### Matched Content`);
      parts.push('```');
      parts.push(vuln.matched);
      parts.push('```');
    }

    if (vuln['extracted-results'] && vuln['extracted-results'].length > 0) {
      parts.push(`\n### Extracted Results`);
      vuln['extracted-results'].forEach(result => {
        parts.push(`- ${result}`);
      });
    }

    if (vuln['curl-command']) {
      parts.push(`\n### Reproduction`);
      parts.push('```bash');
      parts.push(vuln['curl-command']);
      parts.push('```');
    }

    return parts.join('\n');
  }

  /**
   * Extract hostname from URL
   */
  private extractHostFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      // If not a valid URL, return as-is (might be just a hostname)
      return url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    }
  }
}

export const nucleiExecutor = new NucleiExecutor();
