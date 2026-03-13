/**
 * HTTP/HTTPS Service Detection Automation
 * 
 * Automatically detects HTTP/HTTPS services from discovered services
 * and triggers framework agent and web hacker agent for investigation.
 * 
 * Trigger Points:
 * - When nmap scan completes and discovers port 80, 443, 8080, 8443, etc.
 * - When services are manually added to discoveredServices table
 * - When assets with HTTP/HTTPS services are discovered by BBOT
 * 
 * Actions:
 * - Framework Agent: Performs reconnaissance, fingerprinting, and CMS detection
 * - Web Hacker Agent: Executes vulnerability scanning and exploitation attempts
 */

import { db } from '../db';
import {
  discoveredServices,
  discoveredAssets,
  operations,
  targets,
  agents,
  operationsManagerTasks,
} from '../../shared/schema';
import { eq, and, inArray, isNull, or } from 'drizzle-orm';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface HttpServiceDetection {
  serviceId: string;
  assetId: string;
  assetValue: string;
  assetHostname?: string;
  port: number;
  protocol: 'http' | 'https';
  serviceName: string;
  operationId: string;
  url: string;
}

export interface InvestigationResult {
  serviceId: string;
  url: string;
  frameworkAgentTaskId?: string;
  webHackerAgentTaskId?: string;
  targetCreated: boolean;
  targetId?: string;
  status: 'triggered' | 'skipped' | 'error';
  reason?: string;
}

export interface AutomationConfig {
  enabled: boolean;
  triggerFrameworkAgent: boolean;
  triggerWebHackerAgent: boolean;
  createTargets: boolean;
  minDelayBetweenTriggers: number; // milliseconds
  httpPorts: number[];
  httpsPorts: number[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: AutomationConfig = {
  enabled: true,
  triggerFrameworkAgent: true,
  triggerWebHackerAgent: true,
  createTargets: true,
  minDelayBetweenTriggers: 2000, // 2 seconds between triggers
  httpPorts: [80, 8000, 8008, 8080, 8888, 3000, 5000, 9000],
  httpsPorts: [443, 8443, 3443, 9443],
};

// ============================================================================
// HTTP Service Detection Automation
// ============================================================================

export class HttpServiceDetectionAutomation extends EventEmitter {
  private config: AutomationConfig;
  private processingQueue: Set<string> = new Set();
  private lastTriggerTime: number = 0;

  constructor(config: Partial<AutomationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main entry point: Detect and process HTTP/HTTPS services for an operation
   */
  async processOperation(operationId: string): Promise<InvestigationResult[]> {
    if (!this.config.enabled) {
      console.log('[HttpServiceDetection] Automation disabled');
      return [];
    }

    console.log(`[HttpServiceDetection] Processing operation ${operationId}`);

    try {
      // Step 1: Detect HTTP/HTTPS services
      const httpServices = await this.detectHttpServices(operationId);

      if (httpServices.length === 0) {
        console.log('[HttpServiceDetection] No HTTP/HTTPS services found');
        return [];
      }

      console.log(`[HttpServiceDetection] Found ${httpServices.length} HTTP/HTTPS services`);
      this.emit('services_detected', { operationId, count: httpServices.length, services: httpServices });

      // Step 2: Process each service
      const results: InvestigationResult[] = [];

      for (const service of httpServices) {
        // Skip if already processing
        if (this.processingQueue.has(service.serviceId)) {
          console.log(`[HttpServiceDetection] Service ${service.url} already being processed`);
          continue;
        }

        try {
          // Rate limiting
          await this.rateLimitDelay();

          this.processingQueue.add(service.serviceId);

          const result = await this.processHttpService(service);
          results.push(result);

          this.processingQueue.delete(service.serviceId);

          this.emit('service_processed', { operationId, serviceId: service.serviceId, result });
        } catch (error) {
          console.error(`[HttpServiceDetection] Failed to process service ${service.url}:`, error);
          this.processingQueue.delete(service.serviceId);

          results.push({
            serviceId: service.serviceId,
            url: service.url,
            targetCreated: false,
            status: 'error',
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      this.emit('operation_processed', { operationId, results });

      return results;
    } catch (error) {
      console.error(`[HttpServiceDetection] Failed to process operation ${operationId}:`, error);
      throw error;
    }
  }

  /**
   * Step 1: Detect all HTTP/HTTPS services for an operation
   */
  async detectHttpServices(operationId: string): Promise<HttpServiceDetection[]> {
    const allWebPorts = [...this.config.httpPorts, ...this.config.httpsPorts];

    // Query discovered services with web ports
    const services = await db
      .select({
        serviceId: discoveredServices.id,
        assetId: discoveredServices.assetId,
        port: discoveredServices.port,
        serviceName: discoveredServices.serviceName,
        assetValue: discoveredAssets.value,
        assetHostname: discoveredAssets.hostname,
        operationId: discoveredAssets.operationId,
      })
      .from(discoveredServices)
      .innerJoin(discoveredAssets, eq(discoveredServices.assetId, discoveredAssets.id))
      .where(
        and(
          eq(discoveredAssets.operationId, operationId),
          inArray(discoveredServices.port, allWebPorts),
          eq(discoveredServices.state, 'open')
        )
      );

    // Map to HttpServiceDetection objects
    return services.map((svc) => {
      const isHttps = this.config.httpsPorts.includes(svc.port);
      const protocol = isHttps ? 'https' : 'http';
      const host = svc.assetHostname || svc.assetValue;

      // Build URL (omit standard ports)
      let url: string;
      if ((protocol === 'http' && svc.port === 80) || (protocol === 'https' && svc.port === 443)) {
        url = `${protocol}://${host}`;
      } else {
        url = `${protocol}://${host}:${svc.port}`;
      }

      return {
        serviceId: svc.serviceId,
        assetId: svc.assetId,
        assetValue: svc.assetValue,
        assetHostname: svc.assetHostname || undefined,
        port: svc.port,
        protocol,
        serviceName: svc.serviceName || 'http',
        operationId: svc.operationId || '',
        url,
      };
    });
  }

  /**
   * Step 2: Process a single HTTP/HTTPS service
   */
  async processHttpService(service: HttpServiceDetection): Promise<InvestigationResult> {
    console.log(`[HttpServiceDetection] Processing ${service.url}`);

    const result: InvestigationResult = {
      serviceId: service.serviceId,
      url: service.url,
      targetCreated: false,
      status: 'triggered',
    };

    try {
      // Step 2a: Create target for this service (if enabled)
      if (this.config.createTargets) {
        const targetId = await this.createTargetForService(service);
        if (targetId) {
          result.targetCreated = true;
          result.targetId = targetId;
          console.log(`[HttpServiceDetection] Created target ${targetId} for ${service.url}`);
        }
      }

      // Step 2b: Trigger framework agent (if enabled)
      if (this.config.triggerFrameworkAgent) {
        const frameworkTaskId = await this.triggerFrameworkAgent(service);
        if (frameworkTaskId) {
          result.frameworkAgentTaskId = frameworkTaskId;
          console.log(`[HttpServiceDetection] Triggered framework agent task ${frameworkTaskId}`);
        }
      }

      // Step 2c: Trigger web hacker agent (if enabled)
      if (this.config.triggerWebHackerAgent) {
        const webHackerTaskId = await this.triggerWebHackerAgent(service);
        if (webHackerTaskId) {
          result.webHackerAgentTaskId = webHackerTaskId;
          console.log(`[HttpServiceDetection] Triggered web hacker agent task ${webHackerTaskId}`);
        }
      }

      // Mark service as investigated
      await this.markServiceInvestigated(service.serviceId);

      return result;
    } catch (error) {
      console.error(`[HttpServiceDetection] Error processing service ${service.url}:`, error);
      return {
        ...result,
        status: 'error',
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a target for the HTTP/HTTPS service
   */
  async createTargetForService(service: HttpServiceDetection): Promise<string | null> {
    try {
      // Check if target already exists
      const existing = await db
        .select({ id: targets.id })
        .from(targets)
        .where(
          and(
            eq(targets.operationId, service.operationId),
            eq(targets.value, service.url)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`[HttpServiceDetection] Target already exists for ${service.url}`);
        return existing[0].id;
      }

      // Get operation tag for consistency
      const { getOperationTag } = await import('./operation-tag-helper');
      const opTag = await getOperationTag(service.operationId);

      // Create new target
      const [newTarget] = await db
        .insert(targets)
        .values({
          name: `${service.protocol.toUpperCase()} Service - ${service.assetHostname || service.assetValue}:${service.port}`,
          type: 'url',
          value: service.url,
          description: `Auto-detected ${service.protocol.toUpperCase()} service on port ${service.port}\n\nService: ${service.serviceName}\nDiscovered Asset: ${service.assetValue}`,
          priority: 5, // Medium priority
          tags: [
            'http-service',
            service.protocol,
            `port-${service.port}`,
            'auto-created',
            'pending-investigation',
            ...(opTag ? [opTag] : []),
          ],
          operationId: service.operationId,
          discoveredAssetId: service.assetId,
          autoCreated: true,
          metadata: {
            serviceId: service.serviceId,
            port: service.port,
            protocol: service.protocol,
            serviceName: service.serviceName,
            autoCreatedAt: new Date().toISOString(),
            autoCreatedBy: 'http-service-detection-automation',
          },
        })
        .returning();

      // Update discovered service with target reference
      await db
        .update(discoveredServices)
        .set({
          metadata: {
            targetId: newTarget.id,
            targetCreatedAt: new Date().toISOString(),
          },
        })
        .where(eq(discoveredServices.id, service.serviceId));

      return newTarget.id;
    } catch (error) {
      console.error(`[HttpServiceDetection] Failed to create target for ${service.url}:`, error);
      return null;
    }
  }

  /**
   * Trigger framework agent for reconnaissance and fingerprinting
   */
  async triggerFrameworkAgent(service: HttpServiceDetection): Promise<string | null> {
    try {
      // Get or create framework agent
      const [frameworkAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.name, 'Framework Agent'))
        .limit(1);

      if (!frameworkAgent) {
        console.warn('[HttpServiceDetection] Framework Agent not found in database');
        return null;
      }

      // Check if operations manager agent exists to delegate task
      try {
        const { operationsManagerAgent } = await import('./operations-manager-agent');

        const taskId = await operationsManagerAgent.delegateTask({
          taskType: 'reconnaissance',
          taskName: `Framework Reconnaissance - ${service.url}`,
          description: `Perform reconnaissance, fingerprinting, and CMS detection on ${service.url}`,
          targetAgentRole: 'framework',
          operationId: service.operationId,
          parameters: {
            targetUrl: service.url,
            port: service.port,
            protocol: service.protocol,
            serviceName: service.serviceName,
            assetId: service.assetId,
            serviceId: service.serviceId,
            tasks: [
              'httpx_fingerprint',
              'whatweb_scan',
              'wappalyzer_detect',
              'dirsearch_enum',
              'nmap_service_scan',
            ],
          },
          priority: 7,
        });

        return taskId;
      } catch (error) {
        console.warn('[HttpServiceDetection] Operations Manager not available, framework agent task skipped');
        return null;
      }
    } catch (error) {
      console.error('[HttpServiceDetection] Failed to trigger framework agent:', error);
      return null;
    }
  }

  /**
   * Trigger web hacker agent for vulnerability scanning
   */
  async triggerWebHackerAgent(service: HttpServiceDetection): Promise<string | null> {
    try {
      // Import web hacker agent
      const { webHackerAgent } = await import('./agents/web-hacker-agent');

      // Check if operations manager agent exists to delegate task
      try {
        const { operationsManagerAgent } = await import('./operations-manager-agent');

        const taskId = await operationsManagerAgent.delegateTask({
          taskType: 'vulnerability_scan',
          taskName: `Web Vulnerability Scan - ${service.url}`,
          description: `Perform vulnerability scanning and exploitation attempts on ${service.url}`,
          targetAgentRole: 'web_hacker',
          operationId: service.operationId,
          parameters: {
            targetUrl: service.url,
            port: service.port,
            protocol: service.protocol,
            serviceName: service.serviceName,
            assetId: service.assetId,
            serviceId: service.serviceId,
            scanTypes: [
              'nuclei_web_scan',
              'xss_detection',
              'sqli_detection',
              'ssrf_detection',
            ],
          },
          priority: 8,
        });

        return taskId;
      } catch (error) {
        console.warn('[HttpServiceDetection] Operations Manager not available, triggering web hacker directly');

        // Fallback: Trigger web hacker agent directly
        // Note: This creates a vulnerability target that the web hacker can process
        const [vulnTarget] = await db
          .insert(targets)
          .values({
            name: `Vulnerability Assessment - ${service.url}`,
            type: 'url',
            value: service.url,
            description: `Automated vulnerability assessment target for ${service.url}`,
            priority: 5,
            tags: ['vulnerability', 'pending-exploitation', 'http-service', 'auto-generated'],
            operationId: service.operationId,
            discoveredAssetId: service.assetId,
            autoCreated: true,
            metadata: {
              serviceId: service.serviceId,
              triggeredBy: 'http-service-detection-automation',
            },
          })
          .returning();

        // Web hacker agent will pick this up via its vulnerability target detection
        console.log(`[HttpServiceDetection] Created vulnerability target ${vulnTarget.id} for web hacker agent`);

        return vulnTarget.id;
      }
    } catch (error) {
      console.error('[HttpServiceDetection] Failed to trigger web hacker agent:', error);
      return null;
    }
  }

  /**
   * Mark service as investigated to avoid duplicate processing
   */
  async markServiceInvestigated(serviceId: string): Promise<void> {
    try {
      const [service] = await db
        .select()
        .from(discoveredServices)
        .where(eq(discoveredServices.id, serviceId));

      if (!service) return;

      const metadata = (service.metadata as Record<string, any>) || {};
      metadata.investigated = true;
      metadata.investigatedAt = new Date().toISOString();
      metadata.investigatedBy = 'http-service-detection-automation';

      await db
        .update(discoveredServices)
        .set({ metadata })
        .where(eq(discoveredServices.id, serviceId));
    } catch (error) {
      console.warn('[HttpServiceDetection] Failed to mark service as investigated:', error);
    }
  }

  /**
   * Rate limiting between triggers
   */
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastTrigger = now - this.lastTriggerTime;

    if (timeSinceLastTrigger < this.config.minDelayBetweenTriggers) {
      const delay = this.config.minDelayBetweenTriggers - timeSinceLastTrigger;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastTriggerTime = Date.now();
  }

  /**
   * Get current configuration
   */
  getConfig(): AutomationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutomationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config_updated', this.config);
  }

  /**
   * Check if a service is already being processed
   */
  isProcessing(serviceId: string): boolean {
    return this.processingQueue.has(serviceId);
  }

  /**
   * Get processing queue size
   */
  getQueueSize(): number {
    return this.processingQueue.size;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const httpServiceDetectionAutomation = new HttpServiceDetectionAutomation();

// ============================================================================
// Integration with Workflow Event Handlers
// ============================================================================

/**
 * Initialize and integrate with workflow event handlers
 * This should be called during server initialization
 */
export async function initializeHttpServiceDetectionAutomation(): Promise<void> {
  try {
    const { workflowEventHandlers } = await import('./workflow-event-handlers');

    // Listen for nmap scan completion
    workflowEventHandlers.on('scan_completed', async (data: {
      scanId: string;
      scanType: string;
      operationId: string;
      userId: string;
    }) => {
      // Only process nmap scans
      if (data.scanType !== 'nmap') {
        return;
      }

      console.log(`[HttpServiceDetection] Nmap scan ${data.scanId} completed, checking for HTTP/HTTPS services...`);

      try {
        const results = await httpServiceDetectionAutomation.processOperation(data.operationId);

        if (results.length > 0) {
          const triggered = results.filter(r => r.status === 'triggered').length;
          const skipped = results.filter(r => r.status === 'skipped').length;
          const errors = results.filter(r => r.status === 'error').length;

          console.log(
            `[HttpServiceDetection] Processed ${results.length} HTTP/HTTPS services: ` +
            `${triggered} triggered, ${skipped} skipped, ${errors} errors`
          );
        }
      } catch (error) {
        console.error('[HttpServiceDetection] Failed to process HTTP/HTTPS services:', error);
      }
    });

    // Also listen for targets auto-created event (when new services might be discovered)
    workflowEventHandlers.on('targets_auto_created', async (data: {
      operationId: string;
      scanId: string;
      targetCount: number;
      targetIds: string[];
    }) => {
      console.log(`[HttpServiceDetection] Targets auto-created, checking for HTTP/HTTPS services...`);

      try {
        await httpServiceDetectionAutomation.processOperation(data.operationId);
      } catch (error) {
        console.error('[HttpServiceDetection] Failed to process HTTP/HTTPS services after target creation:', error);
      }
    });

    console.log('✅ HTTP/HTTPS Service Detection Automation initialized');
  } catch (error) {
    console.error('❌ Failed to initialize HTTP/HTTPS Service Detection Automation:', error);
  }
}
