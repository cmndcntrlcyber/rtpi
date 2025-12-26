import { Router } from 'express';
import { db } from '../../db';
import {
  discoveredAssets,
  discoveredServices,
  vulnerabilities,
  axScanResults
} from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

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
  } catch (error) {
    console.error('Error fetching surface assessment overview:', error);
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
  } catch (error) {
    console.error('Error fetching assets:', error);
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
  } catch (error) {
    console.error('Error fetching services:', error);
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
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({
      error: 'Failed to fetch activity',
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

    // Execute scan asynchronously
    bbotExecutor.executeScan(targets, bbotOptions, operationId, userId)
      .then((result) => {
        console.log(`✅ BBOT scan ${result.scanId} completed successfully`);
      })
      .catch((error) => {
        console.error('BBOT scan failed:', error);
      });

    // Return immediately with scan ID
    res.json({
      message: 'BBOT scan started successfully',
      status: 'running',
    });
  } catch (error) {
    console.error('Error starting BBOT scan:', error);
    res.status(500).json({
      error: 'Failed to start BBOT scan',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
