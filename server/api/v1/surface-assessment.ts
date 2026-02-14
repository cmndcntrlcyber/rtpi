import { Router } from 'express';
import { db } from '../../db';
import {
  discoveredAssets,
  discoveredServices,
  vulnerabilities,
  axScanResults
} from '@shared/schema';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { ensureRole, logAudit } from '../../auth/middleware';

const router = Router();

/**
 * GET /api/v1/surface-assessment/:operationId/overview
 * Get overview dashboard data for an operation
 */
router.get('/:operationId/overview', async (req, res) => {
  try {
    const { operationId } = req.params;

    // Get summary statistics
    const [statsResult] = await db
      .select({
        totalAssets: sql<number>`count(distinct ${discoveredAssets.id})`,
        totalServices: sql<number>`count(distinct ${discoveredServices.id})`,
        totalVulnerabilities: sql<number>`count(distinct ${vulnerabilities.id})`,
      })
      .from(discoveredAssets)
      .leftJoin(discoveredServices, eq(discoveredAssets.id, discoveredServices.assetId))
      .leftJoin(vulnerabilities, eq(vulnerabilities.operationId, operationId))
      .where(eq(discoveredAssets.operationId, operationId));

    // Get web vulnerabilities count (vulnerabilities affecting web services)
    const [webVulnsResult] = await db
      .select({
        count: sql<number>`count(distinct ${vulnerabilities.id})`,
      })
      .from(vulnerabilities)
      .where(
        and(
          eq(vulnerabilities.operationId, operationId),
          sql`${vulnerabilities.affectedServices}::text LIKE '%HTTP%' OR ${vulnerabilities.affectedServices}::text LIKE '%HTTPS%'`
        )
      );

    // Get last scan timestamp
    const [lastScanResult] = await db
      .select({
        lastScan: axScanResults.completedAt,
      })
      .from(axScanResults)
      .where(eq(axScanResults.operationId, operationId))
      .orderBy(desc(axScanResults.completedAt))
      .limit(1);

    // Get severity distribution
    const severityDistribution = await db
      .select({
        severity: vulnerabilities.severity,
        count: sql<number>`count(*)`,
      })
      .from(vulnerabilities)
      .where(eq(vulnerabilities.operationId, operationId))
      .groupBy(vulnerabilities.severity);

    // Get status distribution
    const statusDistribution = await db
      .select({
        status: vulnerabilities.status,
        count: sql<number>`count(*)`,
      })
      .from(vulnerabilities)
      .where(eq(vulnerabilities.operationId, operationId))
      .groupBy(vulnerabilities.status);

    // Get top vulnerable assets
    const topAssets = await db
      .select({
        id: discoveredAssets.id,
        value: discoveredAssets.value,
        type: discoveredAssets.type,
        criticalCount: sql<number>`count(case when ${vulnerabilities.severity} = 'critical' then 1 end)`,
        highCount: sql<number>`count(case when ${vulnerabilities.severity} = 'high' then 1 end)`,
        mediumCount: sql<number>`count(case when ${vulnerabilities.severity} = 'medium' then 1 end)`,
        lowCount: sql<number>`count(case when ${vulnerabilities.severity} = 'low' then 1 end)`,
        totalCount: sql<number>`count(${vulnerabilities.id})`,
        lastSeen: discoveredAssets.lastSeenAt,
      })
      .from(discoveredAssets)
      .leftJoin(
        vulnerabilities,
        and(
          eq(vulnerabilities.operationId, operationId),
          sql`${vulnerabilities.targetId} IN (
            SELECT id FROM targets WHERE value = ${discoveredAssets.value}
          )`
        )
      )
      .where(eq(discoveredAssets.operationId, operationId))
      .groupBy(discoveredAssets.id, discoveredAssets.value, discoveredAssets.type, discoveredAssets.lastSeenAt)
      .orderBy(desc(sql`count(${vulnerabilities.id})`))
      .limit(10);

    // Get recent activity (scan results)
    const recentActivity = await db
      .select({
        id: axScanResults.id,
        toolName: axScanResults.toolName,
        status: axScanResults.status,
        assetsFound: axScanResults.assetsFound,
        servicesFound: axScanResults.servicesFound,
        vulnerabilitiesFound: axScanResults.vulnerabilitiesFound,
        startedAt: axScanResults.startedAt,
        completedAt: axScanResults.completedAt,
        errorMessage: axScanResults.errorMessage,
      })
      .from(axScanResults)
      .where(eq(axScanResults.operationId, operationId))
      .orderBy(desc(axScanResults.createdAt))
      .limit(10);

    // Format severity distribution
    const severityData = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    };
    severityDistribution.forEach((row) => {
      if (row.severity in severityData) {
        severityData[row.severity as keyof typeof severityData] = Number(row.count);
      }
    });

    // Format status distribution
    const statusData = {
      open: 0,
      in_progress: 0,
      fixed: 0,
      false_positive: 0,
      accepted_risk: 0,
    };
    statusDistribution.forEach((row) => {
      const status = row.status?.replace('-', '_') || 'open';
      if (status in statusData) {
        statusData[status as keyof typeof statusData] = Number(row.count);
      }
    });

    // Format top assets
    const formattedAssets = topAssets.map((asset) => ({
      id: asset.id,
      value: asset.value,
      type: asset.type,
      vulnerabilities: {
        critical: Number(asset.criticalCount),
        high: Number(asset.highCount),
        medium: Number(asset.mediumCount),
        low: Number(asset.lowCount),
        total: Number(asset.totalCount),
      },
      lastSeen: asset.lastSeen?.toISOString() || new Date().toISOString(),
    }));

    // Format activity events
    const formattedActivity = recentActivity.map((scan) => {
      let type: 'scan_started' | 'scan_completed' | 'scan_failed' = 'scan_completed';
      let title = '';
      let description = '';

      if (scan.status === 'running') {
        type = 'scan_started';
        title = `${scan.toolName} scan started`;
        description = 'Scan in progress...';
      } else if (scan.status === 'completed') {
        type = 'scan_completed';
        title = `${scan.toolName} scan completed`;
        description = `${scan.assetsFound || 0} assets, ${scan.servicesFound || 0} services, ${scan.vulnerabilitiesFound || 0} vulnerabilities found`;
      } else if (scan.status === 'failed') {
        type = 'scan_failed';
        title = `${scan.toolName} scan failed`;
        description = scan.errorMessage || 'Scan failed with unknown error';
      }

      return {
        id: scan.id,
        type,
        title,
        description,
        timestamp: (scan.completedAt || scan.startedAt || new Date()).toISOString(),
      };
    });

    // Build response
    const response = {
      stats: {
        totalHosts: Number(statsResult?.totalAssets || 0),
        totalServices: Number(statsResult?.totalServices || 0),
        totalVulnerabilities: Number(statsResult?.totalVulnerabilities || 0),
        webVulnerabilities: Number(webVulnsResult?.count || 0),
        lastScanTimestamp: lastScanResult?.lastScan?.toISOString() || null,
      },
      severityData,
      statusData,
      topAssets: formattedAssets,
      recentActivity: formattedActivity,
    };

    res.json(response);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ 
      error: 'Failed to fetch overview data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/surface-assessment/:operationId/assets
 * Get discovered assets with service enumeration
 */
router.get('/:operationId/assets', async (req, res) => {
  try {
    const { operationId } = req.params;
    const { search, page = '1', limit = '50' } = req.query;

    const query = db
      .select({
        id: discoveredAssets.id,
        value: discoveredAssets.value,
        type: discoveredAssets.type,
        hostname: discoveredAssets.hostname,
        ipAddress: discoveredAssets.ipAddress,
        status: discoveredAssets.status,
        discoveryMethod: discoveredAssets.discoveryMethod,
        operatingSystem: discoveredAssets.operatingSystem,
        tags: discoveredAssets.tags,
        lastSeenAt: discoveredAssets.lastSeenAt,
      })
      .from(discoveredAssets)
      .where(eq(discoveredAssets.operationId, operationId));

    // Execute query
    const assets = await query;

    // Get services for each asset
    const assetsWithServices = await Promise.all(
      assets.map(async (asset) => {
        const services = await db
          .select({
            id: discoveredServices.id,
            name: discoveredServices.name,
            port: discoveredServices.port,
            protocol: discoveredServices.protocol,
            version: discoveredServices.version,
            state: discoveredServices.state,
          })
          .from(discoveredServices)
          .where(eq(discoveredServices.assetId, asset.id));

        // Get vulnerability count for this asset
        const [vulnCount] = await db
          .select({
            count: sql<number>`count(*)`,
          })
          .from(vulnerabilities)
          .where(
            and(
              eq(vulnerabilities.operationId, operationId),
              sql`${vulnerabilities.targetId} IN (SELECT id FROM targets WHERE value = ${asset.value})`
            )
          );

        return {
          ...asset,
          services,
          vulnerabilityCount: Number(vulnCount?.count || 0),
        };
      })
    );

    // Apply search filter if provided
    let filteredAssets = assetsWithServices;
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      filteredAssets = assetsWithServices.filter(
        (a) =>
          a.value.toLowerCase().includes(searchLower) ||
          a.hostname?.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedAssets = filteredAssets.slice(startIndex, startIndex + limitNum);

    res.json({
      assets: paginatedAssets,
      total: filteredAssets.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(filteredAssets.length / limitNum),
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      error: 'Failed to fetch assets',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/surface-assessment/:operationId/services
 * Get discovered services grouped by service type
 */
router.get('/:operationId/services', async (req, res) => {
  try {
    const { operationId } = req.params;

    // Get all services for the operation
    const services = await db
      .select({
        id: discoveredServices.id,
        name: discoveredServices.name,
        port: discoveredServices.port,
        protocol: discoveredServices.protocol,
        version: discoveredServices.version,
        state: discoveredServices.state,
        assetId: discoveredServices.assetId,
        assetValue: discoveredAssets.value,
      })
      .from(discoveredServices)
      .innerJoin(discoveredAssets, eq(discoveredServices.assetId, discoveredAssets.id))
      .where(eq(discoveredAssets.operationId, operationId));

    // Group services by name and port
    const serviceGroups = new Map<string, any>();

    services.forEach((service) => {
      const key = `${service.name}-${service.port}`;
      
      if (!serviceGroups.has(key)) {
        serviceGroups.set(key, {
          name: service.name,
          port: service.port,
          protocol: service.protocol,
          hostCount: 0,
          versions: new Set<string>(),
          hosts: [],
        });
      }

      const group = serviceGroups.get(key);
      group.hostCount++;
      if (service.version) {
        group.versions.add(service.version);
      }
      group.hosts.push({
        assetId: service.assetId,
        assetValue: service.assetValue,
        version: service.version,
        state: service.state,
      });
    });

    // Convert to array and format
    const formattedServices = Array.from(serviceGroups.values()).map((group) => ({
      ...group,
      versions: Array.from(group.versions),
    }));

    // Sort by host count (most common services first)
    formattedServices.sort((a, b) => b.hostCount - a.hostCount);

    res.json({
      services: formattedServices,
      total: formattedServices.length,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      error: 'Failed to fetch services',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/surface-assessment/:operationId/activity
 * Get activity timeline for an operation
 */
router.get('/:operationId/activity', async (req, res) => {
  try {
    const { operationId } = req.params;
    const { limit = '50' } = req.query;

    const scans = await db
      .select({
        id: axScanResults.id,
        toolName: axScanResults.toolName,
        status: axScanResults.status,
        targets: axScanResults.targets,
        assetsFound: axScanResults.assetsFound,
        servicesFound: axScanResults.servicesFound,
        vulnerabilitiesFound: axScanResults.vulnerabilitiesFound,
        startedAt: axScanResults.startedAt,
        completedAt: axScanResults.completedAt,
        duration: axScanResults.duration,
        errorMessage: axScanResults.errorMessage,
        createdAt: axScanResults.createdAt,
      })
      .from(axScanResults)
      .where(eq(axScanResults.operationId, operationId))
      .orderBy(desc(axScanResults.createdAt))
      .limit(parseInt(limit as string, 10));

    // Format as activity events
    const events = scans.map((scan) => {
      let type: 'scan_started' | 'scan_completed' | 'scan_failed' = 'scan_completed';
      let title = '';
      let description = '';

      if (scan.status === 'running' || scan.status === 'pending') {
        type = 'scan_started';
        title = `${scan.toolName.toUpperCase()} scan started`;
        description = `Scanning ${Array.isArray(scan.targets) ? scan.targets.length : 0} targets`;
      } else if (scan.status === 'completed') {
        type = 'scan_completed';
        title = `${scan.toolName.toUpperCase()} scan completed`;
        const parts = [];
        if (scan.assetsFound) parts.push(`${scan.assetsFound} assets`);
        if (scan.servicesFound) parts.push(`${scan.servicesFound} services`);
        if (scan.vulnerabilitiesFound) parts.push(`${scan.vulnerabilitiesFound} vulnerabilities`);
        description = parts.length > 0 ? parts.join(', ') + ' found' : 'Scan completed';
      } else if (scan.status === 'failed') {
        type = 'scan_failed';
        title = `${scan.toolName.toUpperCase()} scan failed`;
        description = scan.errorMessage || 'Scan failed with unknown error';
      }

      return {
        id: scan.id,
        type,
        title,
        description,
        timestamp: (scan.completedAt || scan.startedAt || scan.createdAt).toISOString(),
      };
    });

    res.json({
      events,
      total: events.length,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      error: 'Failed to fetch activity',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/surface-assessment/:operationId/scans
 * Get scan history for an operation (raw scan records, not transformed to events)
 */
router.get('/:operationId/scans', async (req, res) => {
  try {
    const { operationId } = req.params;
    const { limit = '50' } = req.query;

    const scans = await db
      .select({
        id: axScanResults.id,
        toolName: axScanResults.toolName,
        status: axScanResults.status,
        targets: axScanResults.targets,
        assetsFound: axScanResults.assetsFound,
        servicesFound: axScanResults.servicesFound,
        vulnerabilitiesFound: axScanResults.vulnerabilitiesFound,
        startedAt: axScanResults.startedAt,
        completedAt: axScanResults.completedAt,
        duration: axScanResults.duration,
        errorMessage: axScanResults.errorMessage,
        createdAt: axScanResults.createdAt,
      })
      .from(axScanResults)
      .where(eq(axScanResults.operationId, operationId))
      .orderBy(desc(axScanResults.createdAt))
      .limit(parseInt(limit as string, 10));

    res.json({
      scans,
      total: scans.length,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch scans',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/surface-assessment/:operationId/scan/bbot
 * Execute a BBOT scan
 */
router.post('/:operationId/scan/bbot', async (req, res) => {
  try {
    const { operationId } = req.params;
    const { targets, config } = req.body;

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'targets must be a non-empty array'
      });
    }

    if (!req.user || !(req.user as any).id) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User must be authenticated'
      });
    }

    // Import BBOT executor
    const { bbotExecutor } = await import('../../services/bbot-executor');

    // Parse config
    const bbotOptions = {
      preset: config?.preset || 'subdomain-enum',
      modules: config?.modules ? config.modules.split(',').map((m: string) => m.trim()).filter(Boolean) : [],
      flags: config?.flags ? config.flags.split(',').map((f: string) => f.trim()).filter(Boolean) : [],
      args: config?.args ? config.args.split(',').map((a: string) => a.trim()).filter(Boolean) : [],
      noDeps: true,
    };

    const userId = (req.user as any).id;

    // Start scan and get scanId immediately (scan runs asynchronously)
    const { scanId } = await bbotExecutor.startScan(targets, bbotOptions, operationId, userId);

    // Return immediately with scan ID
    res.json({
      message: 'BBOT scan started successfully',
      status: 'running',
      scanId,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      error: 'Failed to start BBOT scan',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/surface-assessment/:operationId/scan/:scanId/output
 * Get raw output from a scan
 */
router.get('/:operationId/scan/:scanId/output', async (req, res) => {
  try {
    const { scanId } = req.params;

    const [scan] = await db
      .select({
        id: axScanResults.id,
        toolName: axScanResults.toolName,
        status: axScanResults.status,
        rawOutput: axScanResults.rawOutput,
        errorMessage: axScanResults.errorMessage,
        startedAt: axScanResults.startedAt,
        completedAt: axScanResults.completedAt,
      })
      .from(axScanResults)
      .where(eq(axScanResults.id, scanId))
      .limit(1);

    if (!scan) {
      return res.status(404).json({
        error: 'Scan not found',
        message: `No scan found with ID ${scanId}`
      });
    }

    res.json({
      id: scan.id,
      toolName: scan.toolName,
      status: scan.status,
      rawOutput: scan.rawOutput || 'No output available',
      errorMessage: scan.errorMessage,
      startedAt: scan.startedAt?.toISOString(),
      completedAt: scan.completedAt?.toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch scan output',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/surface-assessment/:operationId/scan/nuclei
 * Execute a Nuclei vulnerability scan
 */
router.post('/:operationId/scan/nuclei', async (req, res) => {
  try {
    const { operationId } = req.params;
    const { targets, config } = req.body;

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'targets must be a non-empty array'
      });
    }

    if (!req.user || !(req.user as any).id) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User must be authenticated'
      });
    }

    // Import Nuclei executor
    const { nucleiExecutor } = await import('../../services/nuclei-executor');

    // Parse config
    const nucleiOptions = {
      severity: config?.severity || 'critical,high,medium',
      rateLimit: config?.rateLimit ? parseInt(config.rateLimit, 10) : 150,
      templates: config?.templates ? config.templates.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      tags: config?.tags ? config.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      excludeTags: config?.excludeTags ? config.excludeTags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
    };

    const userId = (req.user as any).id;

    // Start scan and get scanId immediately (scan runs asynchronously)
    const { scanId } = await nucleiExecutor.startScan(targets, nucleiOptions, operationId, userId);

    // Return immediately with scan ID
    res.json({
      message: 'Nuclei scan started successfully',
      status: 'running',
      scanId,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      error: 'Failed to start Nuclei scan',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/surface-assessment/:operationId/scans
 * List all completed scans for comparison
 */
router.get('/:operationId/scans', async (req, res) => {
  try {
    const { operationId } = req.params;

    // Get completed scan results
    const scans = await db
      .select({
        id: axScanResults.id,
        name: sql<string>`CONCAT(${axScanResults.tool}, ' - ', ${axScanResults.target})`,
        completedAt: axScanResults.completedAt,
        tool: axScanResults.tool,
        target: axScanResults.target,
      })
      .from(axScanResults)
      .where(
        and(
          eq(axScanResults.operationId, operationId),
          sql`${axScanResults.status} = 'completed'`,
          sql`${axScanResults.completedAt} IS NOT NULL`
        )
      )
      .orderBy(desc(axScanResults.completedAt));

    // Get counts for each scan
    const scansWithCounts = await Promise.all(
      scans.map(async (scan) => {
        const [counts] = await db
          .select({
            assetsCount: sql<number>`count(distinct ${discoveredAssets.id})`,
            servicesCount: sql<number>`count(distinct ${discoveredServices.id})`,
            vulnerabilitiesCount: sql<number>`count(distinct ${vulnerabilities.id})`,
          })
          .from(discoveredAssets)
          .leftJoin(discoveredServices, eq(discoveredAssets.id, discoveredServices.assetId))
          .leftJoin(vulnerabilities, eq(vulnerabilities.operationId, operationId))
          .where(
            and(
              eq(discoveredAssets.operationId, operationId),
              sql`${discoveredAssets.discoveredAt} <= ${scan.completedAt}`
            )
          );

        return {
          ...scan,
          assetsCount: counts?.assetsCount || 0,
          servicesCount: counts?.servicesCount || 0,
          vulnerabilitiesCount: counts?.vulnerabilitiesCount || 0,
        };
      })
    );

    res.json({ scans: scansWithCounts });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve scans',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/surface-assessment/:operationId/compare
 * Compare two scans
 */
router.post('/:operationId/compare', async (req, res) => {
  try {
    const { operationId } = req.params;
    const { scan1Id, scan2Id } = req.body;

    if (!scan1Id || !scan2Id) {
      return res.status(400).json({ error: 'Both scan1Id and scan2Id are required' });
    }

    // Get scan timestamps
    const [scan1] = await db.select().from(axScanResults).where(eq(axScanResults.id, scan1Id));
    const [scan2] = await db.select().from(axScanResults).where(eq(axScanResults.id, scan2Id));

    if (!scan1 || !scan2) {
      return res.status(404).json({ error: 'One or both scans not found' });
    }

    // Get assets for each scan
    const assets1 = await db
      .select()
      .from(discoveredAssets)
      .where(
        and(
          eq(discoveredAssets.operationId, operationId),
          sql`${discoveredAssets.discoveredAt} <= ${scan1.completedAt}`
        )
      );

    const assets2 = await db
      .select()
      .from(discoveredAssets)
      .where(
        and(
          eq(discoveredAssets.operationId, operationId),
          sql`${discoveredAssets.discoveredAt} <= ${scan2.completedAt}`
        )
      );

    // Compare assets
    const assets1Values = new Set(assets1.map(a => a.value));
    const assets2Values = new Set(assets2.map(a => a.value));

    const assetsAdded = assets2.filter(a => !assets1Values.has(a.value));
    const assetsRemoved = assets1.filter(a => !assets2Values.has(a.value));
    const assetsUnchanged = assets2.filter(a => assets1Values.has(a.value));

    // Get services for each scan
    const services1 = await db
      .select()
      .from(discoveredServices)
      .leftJoin(discoveredAssets, eq(discoveredServices.assetId, discoveredAssets.id))
      .where(
        and(
          eq(discoveredAssets.operationId, operationId),
          sql`${discoveredServices.discoveredAt} <= ${scan1.completedAt}`
        )
      );

    const services2 = await db
      .select()
      .from(discoveredServices)
      .leftJoin(discoveredAssets, eq(discoveredServices.assetId, discoveredAssets.id))
      .where(
        and(
          eq(discoveredAssets.operationId, operationId),
          sql`${discoveredServices.discoveredAt} <= ${scan2.completedAt}`
        )
      );

    // Compare services (simplified - using port+protocol as key)
    const services1Keys = new Set(services1.map(s => `${s.discovered_services.port}-${s.discovered_services.protocol}`));
    const services2Keys = new Set(services2.map(s => `${s.discovered_services.port}-${s.discovered_services.protocol}`));

    const servicesAdded = services2.filter(s => !services1Keys.has(`${s.discovered_services.port}-${s.discovered_services.protocol}`));
    const servicesRemoved = services1.filter(s => !services2Keys.has(`${s.discovered_services.port}-${s.discovered_services.protocol}`));
    const servicesUnchanged = services2.filter(s => services1Keys.has(`${s.discovered_services.port}-${s.discovered_services.protocol}`));

    // Get vulnerabilities for each scan
    const vulns1 = await db
      .select()
      .from(vulnerabilities)
      .where(
        and(
          eq(vulnerabilities.operationId, operationId),
          sql`${vulnerabilities.discoveredAt} <= ${scan1.completedAt}`
        )
      );

    const vulns2 = await db
      .select()
      .from(vulnerabilities)
      .where(
        and(
          eq(vulnerabilities.operationId, operationId),
          sql`${vulnerabilities.discoveredAt} <= ${scan2.completedAt}`
        )
      );

    // Compare vulnerabilities (using title as key for simplicity)
    const vulns1Map = new Map(vulns1.map(v => [v.title, v]));
    const vulns2Map = new Map(vulns2.map(v => [v.title, v]));

    const vulnsAdded = vulns2.filter(v => !vulns1Map.has(v.title));
    const vulnsRemoved = vulns1.filter(v => !vulns2Map.has(v.title));
    const vulnsChanged = vulns2.filter(v => {
      const v1 = vulns1Map.get(v.title);
      return v1 && (v1.severity !== v.severity || v1.status !== v.status);
    });
    const vulnsUnchanged = vulns2.filter(v => {
      const v1 = vulns1Map.get(v.title);
      return v1 && v1.severity === v.severity && v1.status === v.status;
    });

    const comparison = {
      assets: {
        added: assetsAdded,
        removed: assetsRemoved,
        unchanged: assetsUnchanged,
      },
      services: {
        added: servicesAdded.map(s => s.discovered_services),
        removed: servicesRemoved.map(s => s.discovered_services),
        unchanged: servicesUnchanged.map(s => s.discovered_services),
      },
      vulnerabilities: {
        added: vulnsAdded,
        removed: vulnsRemoved,
        changed: vulnsChanged,
        unchanged: vulnsUnchanged,
      },
    };

    res.json({ comparison });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to compare scans',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/v1/surface-assessment/:operationId/assets/bulk
 * Bulk delete discovered assets (services will cascade delete)
 */
router.delete('/:operationId/assets/bulk', ensureRole("admin", "operator"), async (req, res) => {
  const { operationId } = req.params;
  const { ids } = req.body;
  const user = req.user as any;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array is required" });
  }

  try {
    // Services will be cascade deleted due to FK constraint
    await db.delete(discoveredAssets).where(
      and(
        inArray(discoveredAssets.id, ids),
        eq(discoveredAssets.operationId, operationId)
      )
    );

    await logAudit(user.id, "bulk_delete_assets", "/surface-assessment", ids.join(","), true, req);
    res.json({ message: `${ids.length} assets deleted successfully`, count: ids.length });
  } catch (error: any) {
    await logAudit(user.id, "bulk_delete_assets", "/surface-assessment", ids.join(","), false, req);
    res.status(500).json({ error: "Failed to delete assets", details: error?.message });
  }
});

/**
 * DELETE /api/v1/surface-assessment/:operationId/assets/:assetId
 * Delete a discovered asset (services will cascade delete)
 */
router.delete('/:operationId/assets/:assetId', ensureRole("admin", "operator"), async (req, res) => {
  const { operationId, assetId } = req.params;
  const user = req.user as any;

  try {
    // Services will be cascade deleted due to FK constraint
    await db.delete(discoveredAssets).where(
      and(
        eq(discoveredAssets.id, assetId),
        eq(discoveredAssets.operationId, operationId)
      )
    );

    await logAudit(user.id, "delete_asset", "/surface-assessment", assetId, true, req);
    res.json({ message: "Asset deleted successfully" });
  } catch (error: any) {
    await logAudit(user.id, "delete_asset", "/surface-assessment", assetId, false, req);
    res.status(500).json({ error: "Failed to delete asset", details: error?.message });
  }
});

/**
 * DELETE /api/v1/surface-assessment/:operationId/services/:serviceId
 * Delete a discovered service
 */
router.delete('/:operationId/services/:serviceId', ensureRole("admin", "operator"), async (req, res) => {
  const { operationId, serviceId } = req.params;
  const user = req.user as any;

  try {
    await db.delete(discoveredServices).where(eq(discoveredServices.id, serviceId));

    await logAudit(user.id, "delete_service", "/surface-assessment", serviceId, true, req);
    res.json({ message: "Service deleted successfully" });
  } catch (error: any) {
    await logAudit(user.id, "delete_service", "/surface-assessment", serviceId, false, req);
    res.status(500).json({ error: "Failed to delete service", details: error?.message });
  }
});

/**
 * DELETE /api/v1/surface-assessment/:operationId/scans/:scanId
 * Delete a scan result record
 */
router.delete('/:operationId/scans/:scanId', ensureRole("admin", "operator"), async (req, res) => {
  const { operationId, scanId } = req.params;
  const user = req.user as any;

  try {
    await db.delete(axScanResults).where(
      and(
        eq(axScanResults.id, scanId),
        eq(axScanResults.operationId, operationId)
      )
    );

    await logAudit(user.id, "delete_scan", "/surface-assessment", scanId, true, req);
    res.json({ message: "Scan result deleted successfully" });
  } catch (error: any) {
    await logAudit(user.id, "delete_scan", "/surface-assessment", scanId, false, req);
    res.status(500).json({ error: "Failed to delete scan result", details: error?.message });
  }
});

/**
 * POST /api/v1/surface-assessment/:operationId/scans/:scanId/cancel
 * Cancel a running or pending scan
 */
router.post('/:operationId/scans/:scanId/cancel', async (req, res) => {
  const { operationId, scanId } = req.params;

  try {
    // Look up the scan record
    const [scan] = await db
      .select({
        id: axScanResults.id,
        status: axScanResults.status,
        toolName: axScanResults.toolName,
      })
      .from(axScanResults)
      .where(
        and(
          eq(axScanResults.id, scanId),
          eq(axScanResults.operationId, operationId)
        )
      )
      .limit(1);

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    if (scan.status !== 'running' && scan.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot cancel scan',
        message: `Scan is already ${scan.status}`,
      });
    }

    // Kill the process inside the rtpi-tools container
    if (scan.status === 'running') {
      const { dockerExecutor } = await import('../../services/docker-executor');
      try {
        await dockerExecutor.exec(
          'rtpi-tools',
          ['pkill', '-f', scan.toolName],
          { user: 'root' }
        );
      } catch {
        // pkill returns exit code 1 if no matching process found — that's OK
      }
    }

    // Update DB status to cancelled
    await db
      .update(axScanResults)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(eq(axScanResults.id, scanId));

    res.json({ message: `${scan.toolName} scan cancelled`, scanId });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to cancel scan',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
