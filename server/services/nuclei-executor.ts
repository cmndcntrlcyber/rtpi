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
  private readonly containerName: string;
  private readonly templateDir: string;
  private readonly homeDir: string;

  // Category paths in the nuclei-templates repo (relative to repo root)
  private static readonly CATEGORY_MAP: Record<string, string[]> = {
    'cves':              ['http/cves'],
    'vulnerabilities':   ['http/vulnerabilities'],
    'default-logins':    ['http/default-logins'],
    'exposed-panels':    ['http/exposed-panels'],
    'exposures':         ['http/exposures'],
    'misconfiguration':  ['http/misconfiguration'],
    'technologies':      ['http/technologies'],
    'takeovers':         ['http/takeovers'],
    'cloud':             ['cloud'],
    'network':           ['network'],
    'dns':               ['dns'],
    'ssl':               ['ssl'],
    'iot':               ['http/iot'],
    'fuzzing':           ['http/fuzzing', 'dast'],
    'workflows':         ['workflows'],
    'helpers':           ['helpers'],
  };

  constructor(containerName: string = 'rtpi-tools') {
    this.containerName = containerName;
    this.homeDir = containerName === 'rtpi-fuzzing-agent'
      ? '/home/rtpi-agent'
      : '/home/rtpi-tools';
    this.templateDir = `${this.homeDir}/nuclei-templates`;
  }

  /**
   * Ensure Nuclei templates are present in the container.
   * Downloads them on-demand if missing, so the Docker image stays lean.
   */
  private async ensureTemplates(): Promise<void> {
    // Quick check: does the template dir exist and contain the http/ folder?
    const check = await dockerExecutor.exec(this.containerName,
      ['test', '-d', `${this.templateDir}/http`],
      {}
    ).catch(() => null);

    if (check && check.exitCode === 0) {
      return; // templates already present
    }

    console.log('Nuclei templates not found — downloading on-demand...');
    const dl = await dockerExecutor.exec(this.containerName,
      ['nuclei', '-update-templates', '-silent'],
      { timeout: 300000 } // 5 min for download
    );

    if (dl.exitCode !== 0) {
      console.warn('Template download exited with code', dl.exitCode, dl.stderr);
    } else {
      console.log('Nuclei templates downloaded successfully');
    }
  }

  /**
   * Ensure only specific template categories are present using git sparse-checkout.
   * Downloads ~2-20MB per category instead of ~82MB for the full repo.
   * Falls back to full download if sparse-checkout fails.
   */
  private async ensureTemplateCategories(categories: string[]): Promise<void> {
    // Resolve category names to directory paths
    const dirs = this.resolveCategoriesToDirs(categories);
    if (dirs.length === 0) {
      // No recognized categories — fall back to full download
      return this.ensureTemplates();
    }

    // Check if all requested dirs already exist
    const missingDirs: string[] = [];
    for (const dir of dirs) {
      const check = await dockerExecutor.exec(this.containerName,
        ['test', '-d', `${this.templateDir}/${dir}`],
        {}
      ).catch(() => null);
      if (!check || check.exitCode !== 0) {
        missingDirs.push(dir);
      }
    }

    if (missingDirs.length === 0) {
      return; // all categories already present
    }

    // Always include helpers/ (required by many templates)
    const allDirs = [...new Set([...dirs, 'helpers'])];

    console.log(`Downloading nuclei template categories: ${allDirs.join(', ')}`);

    // Try sparse-checkout first (much smaller download)
    const sparseCmd = [
      'bash', '-c',
      `rm -rf ${this.templateDir} && ` +
      `git clone --filter=blob:none --sparse --depth=1 ` +
      `https://github.com/projectdiscovery/nuclei-templates.git ${this.templateDir} && ` +
      `cd ${this.templateDir} && ` +
      `git sparse-checkout set ${allDirs.join(' ')}`
    ];

    const result = await dockerExecutor.exec(this.containerName, sparseCmd, {
      timeout: 180000 // 3 min
    }).catch(() => null);

    if (result && result.exitCode === 0) {
      console.log(`Template categories downloaded via sparse-checkout: ${allDirs.join(', ')}`);
      return;
    }

    console.warn('Sparse-checkout failed, falling back to full template download');
    await this.ensureTemplates();
  }

  /**
   * Map category names/template paths to nuclei-templates directory paths.
   */
  private resolveCategoriesToDirs(categories: string[]): string[] {
    const dirs = new Set<string>();

    for (const cat of categories) {
      const normalized = cat.toLowerCase().replace(/^\/+|\/+$/g, '');

      // Direct match in category map
      if (NucleiExecutor.CATEGORY_MAP[normalized]) {
        for (const d of NucleiExecutor.CATEGORY_MAP[normalized]) {
          dirs.add(d);
        }
        continue;
      }

      // Check if it's already a valid path like "http/cves" or "cloud/aws"
      const firstSegment = normalized.split('/')[0];
      const knownTopLevel = ['cloud', 'code', 'dast', 'dns', 'file', 'headless',
        'helpers', 'http', 'javascript', 'network', 'profiles', 'ssl', 'workflows'];
      if (knownTopLevel.includes(firstSegment)) {
        dirs.add(normalized);
        continue;
      }

      // Assume it's an http/ subdirectory (e.g. "cves" → "http/cves")
      dirs.add(`http/${normalized}`);
    }

    return [...dirs];
  }

  /**
   * Resolve scan options to required template categories for sparse download.
   */
  private resolveRequiredCategories(options: NucleiOptions): string[] | null {
    const categories: string[] = [];

    // If specific templates are provided, extract categories from paths
    if (options.templates && options.templates.length > 0) {
      for (const t of options.templates) {
        const p = t.trim().replace(/^\/.*nuclei-templates\//, '').replace(/^nuclei-templates\//, '');
        // Extract the category directory (first 1-2 path segments)
        const parts = p.split('/');
        if (parts[0] === 'http' && parts.length >= 2) {
          categories.push(`http/${parts[1]}`);
        } else if (parts.length >= 1) {
          categories.push(parts[0]);
        }
      }
    }

    // If tags are provided, map common tags to categories
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        const t = tag.toLowerCase();
        if (t === 'cve' || t === 'cves') categories.push('cves');
        else if (t === 'tech' || t === 'technologies') categories.push('technologies');
        else if (t === 'panel' || t === 'panels') categories.push('exposed-panels');
        else if (t === 'exposure' || t === 'exposures') categories.push('exposures');
        else if (t === 'misconfig' || t === 'misconfiguration') categories.push('misconfiguration');
        else if (t === 'takeover' || t === 'takeovers') categories.push('takeovers');
        else if (t === 'default-login') categories.push('default-logins');
        else if (t === 'cloud' || t === 'aws' || t === 'azure' || t === 'gcp') categories.push('cloud');
        else if (t === 'network') categories.push('network');
        else if (t === 'dns') categories.push('dns');
        else if (t === 'ssl' || t === 'tls') categories.push('ssl');
        else if (t === 'iot') categories.push('iot');
        else if (t === 'fuzz' || t === 'fuzzing' || t === 'dast') categories.push('fuzzing');
      }
    }

    // If we couldn't determine specific categories, return null (full download needed)
    if (categories.length === 0) return null;

    return [...new Set(categories)];
  }

  /**
   * Remove Nuclei templates from the container to reclaim disk space.
   * Called after a scan completes (success or failure).
   */
  private async cleanupTemplates(): Promise<void> {
    try {
      await dockerExecutor.exec(this.containerName,
        ['rm', '-rf', this.templateDir],
        {}
      );
      console.log('Nuclei templates cleaned up to save space');
    } catch (err) {
      console.warn('Failed to clean up Nuclei templates:', err);
    }
  }

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
      // Ensure templates are present (prefer category-level sparse download)
      const requiredCategories = this.resolveRequiredCategories(options);
      if (requiredCategories) {
        await this.ensureTemplateCategories(requiredCategories);
      } else {
        await this.ensureTemplates();
      }

      // Build Nuclei command arguments
      const args = this.buildArgs(targets, options);

      console.log(`Starting Nuclei scan ${scanId} for targets:`, targets);
      console.log(`Nuclei args:`, args);

      // Warn about large template sets
      if (options.templates) {
        const hasCVEs = options.templates.some(t => t.includes('cves'));
        const hasVulns = options.templates.some(t => t.includes('vulnerabilities'));
        if (hasCVEs || hasVulns) {
          console.log(`Large template set detected (CVEs: ${hasCVEs ? '3600+' : '0'}, Vulns: ${hasVulns ? '900+' : '0'} templates)`);
          console.log(`Scan may take 30-60+ minutes depending on targets and network conditions`);
        }
      }

      // Execute Nuclei via Docker with automatic retry
      const result = await dockerExecutor.execWithRetry(
        this.containerName,
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

      // Clean up templates to save disk space
      await this.cleanupTemplates();

      return {
        vulnerabilitiesCount,
        results: parsedResults,
      };
    } catch (error) {
      // Stop keepalive on error
      stopKeepalive();

      // Clean up templates even on failure
      await this.cleanupTemplates();

      // Check if scan was externally cancelled (don't overwrite 'cancelled' status)
      const [currentScan] = await db.select({ status: axScanResults.status })
        .from(axScanResults).where(eq(axScanResults.id, scanId)).limit(1);
      if (currentScan?.status === 'cancelled') {
        console.log(`Nuclei scan ${scanId} was cancelled, skipping error status update`);
        return { vulnerabilitiesCount: 0, results: { vulnerabilities: [], stats: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } } };
      }

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
      // Ensure templates are present (prefer category-level sparse download)
      const requiredCategories = this.resolveRequiredCategories(options);
      if (requiredCategories) {
        await this.ensureTemplateCategories(requiredCategories);
      } else {
        await this.ensureTemplates();
      }

      // Build Nuclei command arguments
      const args = this.buildArgs(targets, options);

      console.log(`Starting Nuclei scan ${scanId} for targets:`, targets);
      console.log(`Nuclei args:`, args);

      // Warn about large template sets
      if (options.templates) {
        const hasCVEs = options.templates.some(t => t.includes('cves'));
        const hasVulns = options.templates.some(t => t.includes('vulnerabilities'));
        if (hasCVEs || hasVulns) {
          console.log(`Large template set detected (CVEs: ${hasCVEs ? '3600+' : '0'}, Vulns: ${hasVulns ? '900+' : '0'} templates)`);
          console.log(`Scan may take 30-60+ minutes depending on targets and network conditions`);
        }
      }

      // Execute Nuclei via Docker with automatic retry
      const result = await dockerExecutor.execWithRetry(
        this.containerName,
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

      console.log(`Nuclei scan ${scanId} completed: ${vulnerabilitiesCount} vulnerabilities found`);

      // Stop keepalive on success
      stopKeepalive();

      // Clean up templates to save disk space
      await this.cleanupTemplates();

      return {
        scanId,
        results: parsedResults,
      };
    } catch (error) {
      // Stop keepalive on error
      stopKeepalive();

      // Clean up templates even on failure
      await this.cleanupTemplates();

      // Check if scan was externally cancelled (don't overwrite 'cancelled' status)
      const [currentScan2] = await db.select({ status: axScanResults.status })
        .from(axScanResults).where(eq(axScanResults.id, scanId)).limit(1);
      if (currentScan2?.status === 'cancelled') {
        console.log(`Nuclei scan ${scanId} was cancelled, skipping error status update`);
        throw new Error('Scan was cancelled');
      }

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

      console.error(`Nuclei scan ${scanId} failed:`, error);
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
    // Templates live at /home/rtpi-tools/nuclei-templates/ inside the container.
    // We must use absolute paths because the docker executor CWD is /tmp.
    //
    // Directory layout (nuclei-templates v10.x):
    //   Top-level: cloud, code, dast, dns, file, headless, helpers, http,
    //              javascript, network, profiles, ssl, workflows
    //   Under http/: cnvd, credential-stuffing, cves, default-logins,
    //                 exposed-panels, exposures, fuzzing, global-matchers,
    //                 honeypot, iot, miscellaneous, misconfiguration, osint,
    //                 takeovers, technologies, token-spray, vulnerabilities
    //
    // Resolution rules:
    //   1. Absolute paths (/...) → pass through
    //   2. Starts with a known top-level dir (e.g. "cloud/aws/") → TEMPLATE_ROOT/<path>
    //   3. Starts with "http/<subdir>" explicitly → TEMPLATE_ROOT/<path>
    //   4. Otherwise assume it's an http/ subdirectory → TEMPLATE_ROOT/http/<path>
    if (options.templates && options.templates.length > 0) {
      const ROOT = this.templateDir;

      // All 14 top-level directories in nuclei-templates
      const TOP_LEVEL_DIRS = new Set([
        'cloud', 'code', 'dast', 'dns', 'file', 'headless', 'helpers',
        'http', 'javascript', 'network', 'profiles', 'ssl', 'workflows',
      ]);

      options.templates.forEach(template => {
        if (template && template.trim()) {
          let p = template.trim();

          // Already absolute — use as-is
          if (p.startsWith('/')) {
            args.push('-t', p);
            return;
          }

          // Strip legacy "nuclei-templates/" prefix if present
          p = p.replace(/^nuclei-templates\//, '');

          const firstSegment = p.split('/')[0].replace(/\/$/, '');

          if (TOP_LEVEL_DIRS.has(firstSegment)) {
            // Explicit top-level path (e.g. "network/cves/", "dast/vulnerabilities/", "http/cves/")
            args.push('-t', `${ROOT}/${p}`);
          } else {
            // Short name → lives under http/ (e.g. "cves/", "vulnerabilities/", "technologies/")
            args.push('-t', `${ROOT}/http/${p}`);
          }
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
