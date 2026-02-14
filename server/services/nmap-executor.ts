/**
 * Nmap Async Executor
 *
 * Brings Nmap into the surface assessment pipeline alongside BBOT and Nuclei.
 * Follows the same async fire-and-forget pattern: startScan() returns immediately
 * with a scanId, the actual scan runs in the background.
 *
 * Results are stored in discoveredAssets and discoveredServices tables
 * (not in target metadata like the legacy sync scanner).
 */

import { dockerExecutor } from './docker-executor';
import { db } from '../db';
import { discoveredAssets, discoveredServices, axScanResults } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { XMLParser } from 'fast-xml-parser';

// ============================================================================
// Types
// ============================================================================

export interface NmapOptions {
  ports?: string;              // e.g., '1-65535' or '1-1024' (default: '1-1024')
  timing?: string;             // T0-T5 (default: 'T4')
  serviceDetection?: boolean;  // -sV (default: true)
  osDetection?: boolean;       // -O (default: false)
  scripts?: string[];          // --script (e.g., ['http-headers', 'ssl-enum-ciphers'])
  extraArgs?: string[];        // Additional arguments
}

export interface NmapHost {
  ip: string;
  hostname?: string;
  status: string;
  ports: NmapPort[];
  os?: string;
}

export interface NmapPort {
  port: number;
  protocol: string;   // tcp, udp
  state: string;      // open, filtered, closed
  service: string;    // http, ssh, etc.
  version?: string;
  banner?: string;
}

export interface NmapResult {
  hosts: NmapHost[];
  raw: string;
}

// ============================================================================
// Executor
// ============================================================================

class NmapExecutor {
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
    });
  }

  /**
   * Start async nmap scan. Returns immediately with scanId.
   * Follows bbotExecutor.startScan() pattern exactly.
   */
  async startScan(
    targets: string[],
    options: NmapOptions,
    operationId: string,
    userId: string
  ): Promise<{ scanId: string }> {
    // Create scan record
    const [scanRecord] = await db
      .insert(axScanResults)
      .values({
        operationId,
        toolName: 'nmap',
        status: 'running',
        targets: targets as any,
        config: { ...options, userId } as any,
        createdBy: userId,
        startedAt: new Date(),
      })
      .returning();

    const scanId = scanRecord.id;

    // Run the scan asynchronously (fire-and-forget with proper error handling)
    this.runScan(scanId, targets, options, operationId, scanRecord.startedAt!, userId)
      .then((result) => {
        console.log(`Nmap scan ${scanId} completed: ${result.assetsCount} hosts, ${result.servicesCount} services`);
      })
      .catch((error) => {
        console.error(`Nmap scan ${scanId} failed:`, error);
      });

    return { scanId };
  }

  /**
   * Internal: runs the actual scan asynchronously.
   */
  private async runScan(
    scanId: string,
    targets: string[],
    options: NmapOptions,
    operationId: string,
    startedAt: Date,
    userId: string
  ): Promise<{ assetsCount: number; servicesCount: number }> {
    // Start database keepalive for long-running scan
    const { keepDatabaseAlive } = await import('./docker-executor');
    const stopKeepalive = await keepDatabaseAlive(1800000); // 30 minutes

    try {
      // Build nmap command arguments
      const args = this.buildArgs(targets, options);

      console.log(`Starting Nmap scan ${scanId} for targets:`, targets);
      console.log(`Nmap args:`, args.join(' '));

      // Execute nmap via Docker (rtpi-tools container) with automatic retry
      const result = await dockerExecutor.execWithRetry(
        'rtpi-tools',
        ['sudo', 'nmap', ...args],
        {
          timeout: 1800000 // 30 minutes
        }
      );

      // Parse nmap XML output
      const parsedResults = this.parseXmlOutput(result.stdout);

      // Store results in database
      const counts = await this.storeResults(parsedResults, operationId, scanId);

      // Prepare raw output
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
          results: { hosts: parsedResults.hosts } as any,
          rawOutput,
          assetsFound: counts.assetsCount,
          servicesFound: counts.servicesCount,
          completedAt: new Date(),
          duration: Math.floor((Date.now() - startedAt.getTime()) / 1000),
        })
        .where(eq(axScanResults.id, scanId));

      stopKeepalive();

      // Emit scan completed event for pipeline cascade
      try {
        const { workflowEventHandlers } = await import('./workflow-event-handlers');
        await workflowEventHandlers.handleScanCompleted(scanId, 'nmap', operationId, userId);
      } catch (eventError) {
        console.error(`Nmap scan ${scanId}: Failed to emit scan_completed event:`, eventError);
      }

      return counts;
    } catch (error) {
      stopKeepalive();

      // Check if scan was externally cancelled (don't overwrite 'cancelled' status)
      const [currentScan] = await db.select({ status: axScanResults.status })
        .from(axScanResults).where(eq(axScanResults.id, scanId)).limit(1);
      if (currentScan?.status === 'cancelled') {
        console.log(`⛔ Nmap scan ${scanId} was cancelled, skipping error status update`);
        return { assetsCount: 0, servicesCount: 0 };
      }

      // Prepare error raw output
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
   * Build nmap command arguments from options.
   */
  private buildArgs(targets: string[], options: NmapOptions): string[] {
    const args: string[] = [];

    // Skip host discovery (consistent with existing nmap usage)
    args.push('-Pn');

    // Service detection (default: enabled)
    if (options.serviceDetection !== false) {
      args.push('-sV');
    }

    // OS detection
    if (options.osDetection) {
      args.push('-O');
    }

    // Timing template (default: T4)
    args.push(`-${options.timing || 'T4'}`);

    // Port range (default: 1-1024 for pipeline speed)
    args.push('-p', options.ports || '1-1024');

    // NSE scripts
    if (options.scripts && options.scripts.length > 0) {
      args.push('--script', options.scripts.join(','));
    }

    // XML output to stdout for reliable parsing
    args.push('-oX', '-');

    // Extra arguments
    if (options.extraArgs && options.extraArgs.length > 0) {
      args.push(...options.extraArgs);
    }

    // Targets (must come last)
    args.push(...targets);

    return args;
  }

  /**
   * Parse nmap XML output (-oX -) into structured data.
   */
  parseXmlOutput(stdout: string): NmapResult {
    try {
      // Extract XML portion (nmap may output non-XML text before/after)
      const xmlStart = stdout.indexOf('<?xml');
      const xmlEndTag = '</nmaprun>';
      const xmlEnd = stdout.lastIndexOf(xmlEndTag);

      if (xmlStart === -1 || xmlEnd === -1) {
        console.warn('Nmap: No XML output found, falling back to empty result');
        return { hosts: [], raw: stdout };
      }

      const xmlContent = stdout.substring(xmlStart, xmlEnd + xmlEndTag.length);
      const parsed = this.xmlParser.parse(xmlContent);

      const hosts: NmapHost[] = [];
      const nmapHosts = parsed.nmaprun?.host;

      if (!nmapHosts) {
        return { hosts: [], raw: stdout };
      }

      // Normalize to array (single host = object, multiple = array)
      const hostArray = Array.isArray(nmapHosts) ? nmapHosts : [nmapHosts];

      for (const host of hostArray) {
        try {
          // Extract IP address
          const addresses = host.address
            ? (Array.isArray(host.address) ? host.address : [host.address])
            : [];

          const ipAddr = addresses.find(
            (a: any) => a['@_addrtype'] === 'ipv4' || a['@_addrtype'] === 'ipv6'
          );

          if (!ipAddr) continue;

          // Extract hostname
          const hostnames = host.hostnames?.hostname;
          let hostname: string | undefined;
          if (hostnames) {
            const hostnameEntry = Array.isArray(hostnames) ? hostnames[0] : hostnames;
            hostname = hostnameEntry['@_name'];
          }

          // Extract ports
          const ports: NmapPort[] = [];
          const portList = host.ports?.port;
          if (portList) {
            const portArray = Array.isArray(portList) ? portList : [portList];

            for (const p of portArray) {
              const state = p.state?.['@_state'] || 'unknown';

              ports.push({
                port: parseInt(p['@_portid'], 10),
                protocol: p['@_protocol'] || 'tcp',
                state,
                service: p.service?.['@_name'] || 'unknown',
                version: p.service?.['@_version'] || undefined,
                banner: p.service?.['@_product']
                  ? `${p.service['@_product']}${p.service['@_version'] ? ' ' + p.service['@_version'] : ''}`.trim()
                  : undefined,
              });
            }
          }

          // Extract OS match
          let os: string | undefined;
          if (host.os?.osmatch) {
            const osMatch = Array.isArray(host.os.osmatch) ? host.os.osmatch[0] : host.os.osmatch;
            os = osMatch['@_name'];
          }

          hosts.push({
            ip: ipAddr['@_addr'],
            hostname,
            status: host.status?.['@_state'] || 'unknown',
            ports,
            os,
          });
        } catch (hostError) {
          console.warn('Nmap: Failed to parse host entry:', hostError);
        }
      }

      return { hosts, raw: stdout };
    } catch (error) {
      console.error('Nmap: XML parsing failed:', error);
      return { hosts: [], raw: stdout };
    }
  }

  /**
   * Store results in discoveredAssets and discoveredServices tables.
   * Uses discoveryMethod: 'nmap'.
   */
  async storeResults(
    results: NmapResult,
    operationId: string,
    scanId: string
  ): Promise<{ assetsCount: number; servicesCount: number }> {
    let assetsCount = 0;
    let servicesCount = 0;

    for (const host of results.hosts) {
      // Skip hosts with no open ports
      const openPorts = host.ports.filter(p => p.state === 'open');
      if (openPorts.length === 0 && host.status !== 'up') continue;

      try {
        // Check if asset already exists for this operation (from BBOT or previous nmap)
        let [existingAsset] = await db
          .select()
          .from(discoveredAssets)
          .where(
            and(
              eq(discoveredAssets.operationId, operationId),
              eq(discoveredAssets.value, host.ip)
            )
          )
          .limit(1);

        let assetId: string;

        if (existingAsset) {
          // Update existing asset with nmap data
          assetId = existingAsset.id;
          await db
            .update(discoveredAssets)
            .set({
              lastSeenAt: new Date(),
              operatingSystem: host.os || existingAsset.operatingSystem,
              metadata: {
                ...(existingAsset.metadata as Record<string, any> || {}),
                nmapScanId: scanId,
                nmapHostStatus: host.status,
              },
            })
            .where(eq(discoveredAssets.id, assetId));
        } else {
          // Create new discovered asset
          const [newAsset] = await db
            .insert(discoveredAssets)
            .values({
              operationId,
              type: 'ip',
              value: host.ip,
              hostname: host.hostname,
              ipAddress: host.ip,
              status: host.status === 'up' ? 'active' : 'down',
              discoveryMethod: 'nmap',
              operatingSystem: host.os,
              metadata: {
                nmapScanId: scanId,
                nmapHostStatus: host.status,
              },
            })
            .onConflictDoNothing()
            .returning();

          if (newAsset) {
            assetId = newAsset.id;
            assetsCount++;
          } else {
            // Conflict occurred, try to find existing
            const [fallback] = await db
              .select()
              .from(discoveredAssets)
              .where(
                and(
                  eq(discoveredAssets.operationId, operationId),
                  eq(discoveredAssets.value, host.ip)
                )
              )
              .limit(1);
            if (fallback) {
              assetId = fallback.id;
            } else {
              continue;
            }
          }
        }

        // Store open ports as discovered services
        for (const port of openPorts) {
          try {
            const [service] = await db
              .insert(discoveredServices)
              .values({
                assetId,
                name: port.service.toUpperCase(),
                port: port.port,
                protocol: port.protocol,
                version: port.version,
                banner: port.banner,
                state: port.state,
                discoveryMethod: 'nmap',
                metadata: {
                  nmapScanId: scanId,
                },
              })
              .onConflictDoNothing()
              .returning();

            if (service) servicesCount++;
          } catch (err) {
            console.warn(`Nmap: Failed to store service ${host.ip}:${port.port}:`, err);
          }
        }
      } catch (err) {
        console.warn(`Nmap: Failed to store host ${host.ip}:`, err);
      }
    }

    return { assetsCount, servicesCount };
  }
}

export const nmapExecutor = new NmapExecutor();
export default nmapExecutor;
