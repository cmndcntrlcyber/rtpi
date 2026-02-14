/**
 * Workflow Event Handlers
 *
 * Event-driven workflow triggers that automatically start agent workflows
 * based on system events like operation creation, scan completion, etc.
 */

import { db } from '../db';
import { operations, agents, workflowTemplates, targets, discoveredAssets, discoveredServices } from '../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { EventEmitter } from 'events';

// ============================================================================
// Workflow Template Seed Data
// ============================================================================

const DEFAULT_WORKFLOW_TEMPLATES = [
  {
    name: "Surface Assessment Workflow",
    description: "Automated surface assessment workflow triggered on operation creation. Retrieves scope, executes BBOT reconnaissance, and documents findings.",
    triggerEvent: "operation_created",
    requiredCapabilities: ["scope_retrieval", "surface_scanning", "finding_documentation"],
    optionalCapabilities: ["tool_discovery"],
    configuration: {
      maxParallelAgents: 1,
      timeoutPerPhase: 7200000,
      retryPolicy: { maxRetries: 2, backoffMultiplier: 2 },
      fallbackBehavior: "skip",
    },
    isActive: true,
  },
  {
    name: "Web Hacker Workflow",
    description: "Automated vulnerability validation and exploitation workflow. Triggered after surface assessment completes.",
    triggerEvent: "surface_assessment_completed",
    requiredCapabilities: ["vulnerability_analysis", "nuclei_scanning"],
    optionalCapabilities: ["template_generation", "tool_selection"],
    configuration: {
      maxParallelAgents: 3,
      timeoutPerPhase: 3600000,
      retryPolicy: { maxRetries: 1, backoffMultiplier: 1 },
      fallbackBehavior: "skip",
    },
    isActive: true,
  },
  {
    name: "Full Assessment Pipeline",
    description: "Complete assessment pipeline from scope retrieval to exploitation.",
    triggerEvent: "manual",
    requiredCapabilities: [
      "tool_discovery", "scope_retrieval", "surface_scanning",
      "finding_documentation", "vulnerability_analysis", "nuclei_scanning", "template_generation",
    ],
    optionalCapabilities: [],
    configuration: {
      maxParallelAgents: 2,
      timeoutPerPhase: 14400000,
      retryPolicy: { maxRetries: 2, backoffMultiplier: 2 },
      fallbackBehavior: "skip",
    },
    isActive: true,
  },
  {
    name: "Tool Discovery Workflow",
    description: "Standalone workflow for tool discovery. Polls the rtpi-tools container to update the tool registry.",
    triggerEvent: "manual",
    requiredCapabilities: ["tool_discovery", "tool_registry_sync"],
    optionalCapabilities: [],
    configuration: {
      maxParallelAgents: 1,
      timeoutPerPhase: 300000,
      retryPolicy: { maxRetries: 3, backoffMultiplier: 1.5 },
      fallbackBehavior: "fail",
    },
    isActive: true,
  },
  {
    name: "Quick Scan Workflow",
    description: "Lightweight reconnaissance workflow for rapid assessment.",
    triggerEvent: "manual",
    requiredCapabilities: ["scope_retrieval", "surface_scanning"],
    optionalCapabilities: [],
    configuration: {
      maxParallelAgents: 1,
      timeoutPerPhase: 1800000,
      retryPolicy: { maxRetries: 1, backoffMultiplier: 1 },
      fallbackBehavior: "fail",
      scanPreset: "subdomain-enum",
    },
    isActive: true,
  },
  // Phase 3: Operations Management Automation templates
  {
    name: "Target Auto-Creation Workflow",
    description: "Automatically creates targets from discovered assets after BBOT scan completion.",
    triggerEvent: "bbot_scan_completed",
    requiredCapabilities: ["target_creation"],
    optionalCapabilities: [],
    configuration: {
      maxParallelAgents: 1,
      timeoutPerPhase: 300000,
      retryPolicy: { maxRetries: 2, backoffMultiplier: 2 },
      fallbackBehavior: "skip",
    },
    isActive: true,
  },
  {
    name: "Nmap Port Scan Workflow",
    description: "Runs Nmap port scans against auto-created targets to discover services.",
    triggerEvent: "targets_auto_created",
    requiredCapabilities: ["port_scanning"],
    optionalCapabilities: [],
    configuration: {
      maxParallelAgents: 3,
      timeoutPerPhase: 1800000,
      retryPolicy: { maxRetries: 2, backoffMultiplier: 2 },
      fallbackBehavior: "skip",
    },
    isActive: true,
  },
  {
    name: "Nuclei Post-Nmap Workflow",
    description: "Runs Nuclei vulnerability scans against web services discovered by Nmap.",
    triggerEvent: "nmap_scan_completed",
    requiredCapabilities: ["vulnerability_scanning"],
    optionalCapabilities: [],
    configuration: {
      maxParallelAgents: 3,
      timeoutPerPhase: 7200000,
      retryPolicy: { maxRetries: 1, backoffMultiplier: 1 },
      fallbackBehavior: "skip",
    },
    isActive: true,
  },
  {
    name: "Vulnerability Reporting Workflow",
    description: "Reports new vulnerabilities to Operations Manager after Nuclei scan completion.",
    triggerEvent: "nuclei_scan_completed",
    requiredCapabilities: ["vulnerability_reporting"],
    optionalCapabilities: [],
    configuration: {
      maxParallelAgents: 1,
      timeoutPerPhase: 300000,
      retryPolicy: { maxRetries: 1, backoffMultiplier: 1 },
      fallbackBehavior: "skip",
    },
    isActive: true,
  },
];

// ============================================================================
// Types
// ============================================================================

export interface WorkflowEventHandlerConfig {
  enableAutoTrigger: boolean;
  enableSurfaceAssessmentOnOperationCreate: boolean;
  enableWebHackerOnSurfaceAssessmentComplete: boolean;
  requireScopeForSurfaceAssessment: boolean;

  // Phase 3: Pipeline automation flags
  enableTargetAutoCreation: boolean;
  enableNmapOnTargetCreation: boolean;
  enableNucleiOnNmapCompletion: boolean;
  enableVulnReporterOnNucleiComplete: boolean;
}

const DEFAULT_CONFIG: WorkflowEventHandlerConfig = {
  enableAutoTrigger: true,
  enableSurfaceAssessmentOnOperationCreate: true,
  enableWebHackerOnSurfaceAssessmentComplete: true,
  requireScopeForSurfaceAssessment: true,

  // Phase 3 defaults
  enableTargetAutoCreation: true,
  enableNmapOnTargetCreation: true,
  enableNucleiOnNmapCompletion: true,
  enableVulnReporterOnNucleiComplete: true,
};

// ============================================================================
// Workflow Event Handlers Class
// ============================================================================

class WorkflowEventHandlers extends EventEmitter {
  private config: WorkflowEventHandlerConfig;
  private initialized: boolean = false;

  constructor(config: Partial<WorkflowEventHandlerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handle operation created event - trigger Surface Assessment workflow
   */
  async handleOperationCreated(operationId: string, userId: string): Promise<void> {
    console.log(`Workflow Event: Operation ${operationId} created`);

    if (!this.config.enableAutoTrigger || !this.config.enableSurfaceAssessmentOnOperationCreate) {
      console.log('Auto-trigger disabled, skipping Surface Assessment');
      return;
    }

    // Check if operation has scope defined
    const [operation] = await db
      .select()
      .from(operations)
      .where(eq(operations.id, operationId));

    if (!operation) {
      console.log(`Operation ${operationId} not found`);
      return;
    }

    if (this.config.requireScopeForSurfaceAssessment && !operation.scope) {
      console.log('Operation has no scope, skipping Surface Assessment');
      return;
    }

    try {
      // Try dynamic workflow orchestrator first
      const { dynamicWorkflowOrchestrator } = await import('./dynamic-workflow-orchestrator');

      // Find Surface Assessment workflow template
      const [template] = await db
        .select()
        .from(workflowTemplates)
        .where(
          and(
            eq(workflowTemplates.triggerEvent, 'operation_created'),
            eq(workflowTemplates.isActive, true)
          )
        );

      if (template) {
        // Create and execute workflow via orchestrator
        const workflowId = await dynamicWorkflowOrchestrator.buildWorkflow(
          template.id,
          operationId,
          { operationId, userId }
        );

        // Execute async
        dynamicWorkflowOrchestrator.executeWorkflow(workflowId).catch((err) => {
          console.error('Workflow execution failed:', err);
        });

        console.log(`Started workflow ${workflowId} for operation ${operationId}`);
        this.emit('workflow_started', { workflowId, operationId, triggerEvent: 'operation_created' });
      } else {
        // Fallback to direct agent execution
        console.log('No workflow template found, triggering Surface Assessment Agent directly');
        await this.triggerSurfaceAssessmentDirect(operationId, userId);
      }
    } catch (error) {
      console.error('Failed to trigger Surface Assessment workflow:', error);
      // Fallback to direct agent execution
      await this.triggerSurfaceAssessmentDirect(operationId, userId);
    }
  }

  /**
   * Direct trigger of Surface Assessment Agent (fallback)
   */
  private async triggerSurfaceAssessmentDirect(operationId: string, userId: string): Promise<void> {
    try {
      const { surfaceAssessmentAgent } = await import('./agents/surface-assessment-agent');

      // Initialize if needed
      if (!surfaceAssessmentAgent.getStatus().agentId) {
        await surfaceAssessmentAgent.initialize();
      }

      // Execute async
      surfaceAssessmentAgent.processOperation(operationId, userId).catch((err) => {
        console.error('Surface Assessment Agent failed:', err);
      });

      console.log(`Triggered Surface Assessment Agent directly for operation ${operationId}`);
    } catch (error) {
      console.error('Failed to trigger Surface Assessment Agent:', error);
    }
  }

  /**
   * Handle Surface Assessment completed - trigger Web Hacker workflow
   */
  async handleSurfaceAssessmentCompleted(operationId: string, userId: string): Promise<void> {
    console.log(`Workflow Event: Surface Assessment completed for ${operationId}`);

    if (!this.config.enableAutoTrigger || !this.config.enableWebHackerOnSurfaceAssessmentComplete) {
      console.log('Auto-trigger disabled, skipping Web Hacker');
      return;
    }

    try {
      // Try dynamic workflow orchestrator first
      const { dynamicWorkflowOrchestrator } = await import('./dynamic-workflow-orchestrator');

      // Find Web Hacker workflow template
      const [template] = await db
        .select()
        .from(workflowTemplates)
        .where(
          and(
            eq(workflowTemplates.triggerEvent, 'surface_assessment_completed'),
            eq(workflowTemplates.isActive, true)
          )
        );

      if (template) {
        // Create and execute workflow via orchestrator
        const workflowId = await dynamicWorkflowOrchestrator.buildWorkflow(
          template.id,
          operationId,
          { operationId, userId }
        );

        // Execute async
        dynamicWorkflowOrchestrator.executeWorkflow(workflowId).catch((err) => {
          console.error('Workflow execution failed:', err);
        });

        console.log(`Started Web Hacker workflow ${workflowId} for operation ${operationId}`);
        this.emit('workflow_started', {
          workflowId,
          operationId,
          triggerEvent: 'surface_assessment_completed',
        });
      } else {
        // Fallback to direct agent execution
        console.log('No workflow template found, triggering Web Hacker Agent directly');
        await this.triggerWebHackerDirect(operationId, userId);
      }
    } catch (error) {
      console.error('Failed to trigger Web Hacker workflow:', error);
      // Fallback to direct agent execution
      await this.triggerWebHackerDirect(operationId, userId);
    }
  }

  /**
   * Direct trigger of Web Hacker Agent (fallback)
   */
  private async triggerWebHackerDirect(operationId: string, userId: string): Promise<void> {
    try {
      const { webHackerAgent } = await import('./agents/web-hacker-agent');

      // Initialize if needed
      if (!webHackerAgent.getStatus().agentId) {
        await webHackerAgent.initialize();
      }

      // Execute async
      webHackerAgent.processOperation(operationId, userId).catch((err) => {
        console.error('Web Hacker Agent failed:', err);
      });

      console.log(`Triggered Web Hacker Agent directly for operation ${operationId}`);
    } catch (error) {
      console.error('Failed to trigger Web Hacker Agent:', error);
    }
  }

  /**
   * Handle scan completed event
   */
  async handleScanCompleted(
    scanId: string,
    scanType: 'bbot' | 'nuclei' | 'nmap' | 'other',
    operationId: string,
    userId: string
  ): Promise<void> {
    console.log(`Workflow Event: ${scanType} scan ${scanId} completed for operation ${operationId}`);

    // Emit event for listeners
    this.emit('scan_completed', { scanId, scanType, operationId, userId });

    if (scanType === 'bbot') {
      // Phase 3: Auto-create targets from discovered assets before triggering web hacker
      if (this.config.enableTargetAutoCreation) {
        await this.handleBBOTScanCompleted(operationId, scanId, userId);
      }
      // Existing: BBOT scan completion triggers Surface Assessment -> Web Hacker
      await this.handleSurfaceAssessmentCompleted(operationId, userId);
    } else if (scanType === 'nmap') {
      if (this.config.enableNucleiOnNmapCompletion) {
        await this.handleNmapScanCompleted(operationId, scanId, userId);
      }
    } else if (scanType === 'nuclei') {
      if (this.config.enableVulnReporterOnNucleiComplete) {
        await this.handleNucleiScanCompleted(operationId, scanId, userId);
      }
    }
  }

  // ============================================================================
  // Phase 3: Pipeline Cascade Handlers
  // ============================================================================

  /**
   * Handle BBOT scan completed: auto-create targets from discovered assets
   */
  private async handleBBOTScanCompleted(
    operationId: string,
    scanId: string,
    userId: string
  ): Promise<void> {
    console.log(`Pipeline: BBOT scan completed, auto-creating targets for operation ${operationId}`);

    try {
      const { targetAutoCreationService } = await import('./target-auto-creation-service');
      const result = await targetAutoCreationService.autoCreateTargetsFromAssets(operationId, scanId);

      console.log(`Pipeline: Auto-created ${result.created} targets, skipped ${result.skipped}, linked ${result.linked}`);

      // Update pipeline status
      await this.updatePipelineStatus(operationId, 'target_creation', 'completed', {
        scanId,
        resultSummary: { created: result.created, skipped: result.skipped, linked: result.linked },
      });

      this.emit('targets_auto_created', {
        operationId,
        scanId,
        targetCount: result.created,
        targetIds: result.targetIds,
      });

      // Cascade: trigger nmap on newly created targets
      if (this.config.enableNmapOnTargetCreation && result.created > 0) {
        await this.handleTargetsAutoCreated(operationId, scanId, userId, result.targetIds);
      }
    } catch (error) {
      console.error('Pipeline: Target auto-creation failed:', error);
      await this.updatePipelineStatus(operationId, 'target_creation', 'failed');
    }
  }

  /**
   * Handle targets auto-created: trigger nmap port scans
   */
  private async handleTargetsAutoCreated(
    operationId: string,
    scanId: string,
    userId: string,
    targetIds: string[]
  ): Promise<void> {
    console.log(`Pipeline: Triggering Nmap scans for ${targetIds.length} auto-created targets`);

    try {
      // Query auto-created targets (IP and domain types are scannable by nmap)
      const autoTargets = await db
        .select()
        .from(targets)
        .where(
          and(
            eq(targets.operationId, operationId),
            eq(targets.autoCreated, true),
            inArray(targets.type, ['ip', 'domain'])
          )
        );

      if (autoTargets.length === 0) {
        console.log('Pipeline: No scannable targets found for Nmap');
        return;
      }

      // Batch targets (max 10 per nmap scan for performance)
      const BATCH_SIZE = 10;
      const batches: string[][] = [];
      for (let i = 0; i < autoTargets.length; i += BATCH_SIZE) {
        batches.push(autoTargets.slice(i, i + BATCH_SIZE).map(t => t.value));
      }

      // Get userId from operation owner if not provided
      let effectiveUserId = userId;
      if (!effectiveUserId || effectiveUserId === 'system') {
        const [op] = await db.select().from(operations).where(eq(operations.id, operationId));
        if (op) effectiveUserId = op.ownerId;
      }

      const { nmapExecutor } = await import('./nmap-executor');

      for (const batch of batches) {
        try {
          await nmapExecutor.startScan(
            batch,
            { ports: '1-1024', timing: 'T4', serviceDetection: true },
            operationId,
            effectiveUserId
          );
        } catch (nmapError) {
          console.error('Pipeline: Nmap batch scan failed:', nmapError);
        }
      }

      await this.updatePipelineStatus(operationId, 'nmap', 'running', {
        batchCount: batches.length,
        totalTargets: autoTargets.length,
      });
    } catch (error) {
      console.error('Pipeline: Failed to trigger Nmap scans:', error);
      await this.updatePipelineStatus(operationId, 'nmap', 'failed');
    }
  }

  /**
   * Handle nmap scan completed: trigger nuclei vulnerability scans on web services
   */
  private async handleNmapScanCompleted(
    operationId: string,
    scanId: string,
    userId: string
  ): Promise<void> {
    console.log(`Pipeline: Nmap scan completed, checking for web services in operation ${operationId}`);

    try {
      // Query discovered services for web ports
      const WEB_PORTS = [80, 443, 8080, 8443, 8888, 3000, 3443, 8000];
      const TLS_PORTS = [443, 8443, 3443];

      const webServices = await db
        .select({
          port: discoveredServices.port,
          assetValue: discoveredAssets.value,
          assetHostname: discoveredAssets.hostname,
        })
        .from(discoveredServices)
        .innerJoin(discoveredAssets, eq(discoveredServices.assetId, discoveredAssets.id))
        .where(
          and(
            eq(discoveredAssets.operationId, operationId),
            inArray(discoveredServices.port, WEB_PORTS),
            eq(discoveredServices.state, 'open')
          )
        );

      if (webServices.length === 0) {
        console.log('Pipeline: No web services found for Nuclei scanning');
        await this.updatePipelineStatus(operationId, 'nuclei', 'skipped');
        return;
      }

      // Build target URLs from host:port pairs
      const targetUrls = new Set<string>();
      for (const svc of webServices) {
        const host = svc.assetHostname || svc.assetValue;
        const scheme = TLS_PORTS.includes(svc.port) ? 'https' : 'http';
        // Avoid redundant port for standard ports
        if ((scheme === 'http' && svc.port === 80) || (scheme === 'https' && svc.port === 443)) {
          targetUrls.add(`${scheme}://${host}`);
        } else {
          targetUrls.add(`${scheme}://${host}:${svc.port}`);
        }
      }

      console.log(`Pipeline: Found ${targetUrls.size} web targets for Nuclei`);

      // Get userId from operation owner if needed
      let effectiveUserId = userId;
      if (!effectiveUserId || effectiveUserId === 'system') {
        const [op] = await db.select().from(operations).where(eq(operations.id, operationId));
        if (op) effectiveUserId = op.ownerId;
      }

      const { nucleiExecutor } = await import('./nuclei-executor');
      await nucleiExecutor.startScan(
        Array.from(targetUrls),
        {},
        operationId,
        effectiveUserId
      );

      await this.updatePipelineStatus(operationId, 'nuclei', 'running', {
        targetCount: targetUrls.size,
      });
    } catch (error) {
      console.error('Pipeline: Failed to trigger Nuclei scan:', error);
      await this.updatePipelineStatus(operationId, 'nuclei', 'failed');
    }
  }

  /**
   * Handle nuclei scan completed: trigger vulnerability reporting
   */
  private async handleNucleiScanCompleted(
    operationId: string,
    scanId: string,
    userId: string
  ): Promise<void> {
    console.log(`Pipeline: Nuclei scan completed for operation ${operationId}`);

    this.emit('nuclei_scan_completed', { operationId, scanId, userId });

    try {
      // Trigger immediate vulnerability reporter poll
      const { vulnerabilityReporterAgent } = await import('./vulnerability-reporter-agent');
      if (vulnerabilityReporterAgent.isPolling()) {
        await vulnerabilityReporterAgent.pollNow();
      }
    } catch (error) {
      console.error('Pipeline: Failed to trigger vulnerability reporter:', error);
    }

    await this.updatePipelineStatus(operationId, 'completed', 'completed');
  }

  /**
   * Update pipeline status on operations table
   */
  private async updatePipelineStatus(
    operationId: string,
    currentPhase: string,
    phaseStatus: string,
    resultSummary?: Record<string, any>
  ): Promise<void> {
    try {
      const [op] = await db.select().from(operations).where(eq(operations.id, operationId));
      if (!op) return;

      const existing = (op.pipelineStatus as any) || { phases: [] };
      const phases = existing.phases || [];

      // Update or add phase entry
      const phaseIndex = phases.findIndex((p: any) => p.name === currentPhase);
      const phaseEntry = {
        name: currentPhase,
        status: phaseStatus,
        startedAt: phaseStatus === 'running' ? new Date().toISOString() : (phaseIndex >= 0 ? phases[phaseIndex].startedAt : new Date().toISOString()),
        completedAt: ['completed', 'failed', 'skipped'].includes(phaseStatus) ? new Date().toISOString() : undefined,
        resultSummary,
      };

      if (phaseIndex >= 0) {
        phases[phaseIndex] = { ...phases[phaseIndex], ...phaseEntry };
      } else {
        phases.push(phaseEntry);
      }

      await db
        .update(operations)
        .set({
          pipelineStatus: {
            currentPhase,
            automationEnabled: op.automationEnabled,
            phases,
            lastUpdated: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(operations.id, operationId));
    } catch (error) {
      console.error('Failed to update pipeline status:', error);
    }
  }

  /**
   * Seed default workflow templates if they don't exist
   */
  private async seedWorkflowTemplates(): Promise<void> {
    console.log('Checking workflow templates...');

    try {
      const existingTemplates = await db.select().from(workflowTemplates);
      const existingNames = new Set(existingTemplates.map(t => t.name));

      let seeded = 0;
      for (const template of DEFAULT_WORKFLOW_TEMPLATES) {
        if (!existingNames.has(template.name)) {
          await db.insert(workflowTemplates).values(template);
          seeded++;
          console.log(`  + Seeded: ${template.name}`);
        }
      }

      if (seeded > 0) {
        console.log(`Seeded ${seeded} new workflow templates`);
      } else {
        console.log(`All ${DEFAULT_WORKFLOW_TEMPLATES.length} workflow templates already exist`);
      }
    } catch (error) {
      console.error('Failed to seed workflow templates:', error);
    }
  }

  /**
   * Initialize all agents and start background services
   */
  async initializeAgentSystem(): Promise<void> {
    if (this.initialized) {
      console.log('Agent system already initialized');
      return;
    }

    console.log('Initializing Agent System...');

    // Seed workflow templates first
    await this.seedWorkflowTemplates();

    try {
      // Initialize Tool Connector Agent (background polling)
      const { toolConnectorAgent } = await import('./agents/tool-connector-agent');
      await toolConnectorAgent.initialize();
      await toolConnectorAgent.start();
      console.log('Tool Connector Agent initialized and started');
    } catch (error) {
      console.error('Failed to initialize Tool Connector Agent:', error);
    }

    try {
      // Initialize Surface Assessment Agent
      const { surfaceAssessmentAgent } = await import('./agents/surface-assessment-agent');
      await surfaceAssessmentAgent.initialize();

      // Set up event listener for Surface Assessment completion
      surfaceAssessmentAgent.on('operation_completed', ({ operationId }) => {
        // Auto-trigger Web Hacker Agent
        this.handleSurfaceAssessmentCompleted(operationId, 'system').catch(console.error);
      });

      console.log('Surface Assessment Agent initialized');
    } catch (error) {
      console.error('Failed to initialize Surface Assessment Agent:', error);
    }

    try {
      // Initialize Web Hacker Agent
      const { webHackerAgent } = await import('./agents/web-hacker-agent');
      await webHackerAgent.initialize();
      console.log('Web Hacker Agent initialized');
    } catch (error) {
      console.error('Failed to initialize Web Hacker Agent:', error);
    }

    try {
      // Initialize Dynamic Workflow Orchestrator
      const { dynamicWorkflowOrchestrator } = await import('./dynamic-workflow-orchestrator');
      await dynamicWorkflowOrchestrator.refreshCapabilityCache();
      console.log('Dynamic Workflow Orchestrator initialized');
    } catch (error) {
      console.error('Failed to initialize Dynamic Workflow Orchestrator:', error);
    }

    // Phase 3: Initialize Vulnerability Reporter Agent
    try {
      const { vulnerabilityReporterAgent } = await import('./vulnerability-reporter-agent');
      await vulnerabilityReporterAgent.initialize();
      await vulnerabilityReporterAgent.startPolling();
      console.log('Vulnerability Reporter Agent initialized and polling');
    } catch (error) {
      console.error('Failed to initialize Vulnerability Reporter Agent:', error);
    }

    // Phase 3: Seed Operations Manager + Page Reporter agents
    try {
      const existingAgents = await db.select().from(agents);
      const existingNames = new Set(existingAgents.map((a) => a.name));

      const agentsToCreate: { name: string; type: "custom"; status: "idle"; config: Record<string, string> }[] = [];

      // Operations Manager agent
      if (!existingNames.has("Operations Manager")) {
        agentsToCreate.push({
          name: "Operations Manager",
          type: "custom",
          status: "idle",
          config: { role: "operations_manager" },
        });
      }

      // Page Reporter agents (one per page role)
      const pageRoles = [
        "dashboard", "operations", "targets", "vulnerabilities",
        "surface_assessment", "agents", "tools", "workflows",
      ];
      for (const pageRole of pageRoles) {
        const name = `Reporter: ${pageRole.charAt(0).toUpperCase() + pageRole.slice(1).replace(/_/g, " ")}`;
        if (!existingNames.has(name)) {
          agentsToCreate.push({
            name,
            type: "custom",
            status: "idle",
            config: { role: "page_reporter", pageRole },
          });
        }
      }

      if (agentsToCreate.length > 0) {
        await db.insert(agents).values(agentsToCreate);
        console.log(`Seeded ${agentsToCreate.length} ops management agents`);
      } else {
        console.log('Ops management agents already exist');
      }
    } catch (error) {
      console.error('Failed to seed ops management agents:', error);
    }

    this.initialized = true;
    console.log('Agent System initialization complete');
    this.emit('agent_system_initialized');
  }

  /**
   * Shutdown all agents gracefully
   */
  async shutdownAgentSystem(): Promise<void> {
    console.log('Shutting down Agent System...');

    try {
      const { toolConnectorAgent } = await import('./agents/tool-connector-agent');
      await toolConnectorAgent.stop();
    } catch (error) {
      console.error('Error stopping Tool Connector Agent:', error);
    }

    try {
      const { dynamicWorkflowOrchestrator } = await import('./dynamic-workflow-orchestrator');
      dynamicWorkflowOrchestrator.destroy();
    } catch (error) {
      console.error('Error destroying Dynamic Workflow Orchestrator:', error);
    }

    // Phase 3: Stop Vulnerability Reporter Agent
    try {
      const { vulnerabilityReporterAgent } = await import('./vulnerability-reporter-agent');
      await vulnerabilityReporterAgent.stopPolling();
    } catch (error) {
      console.error('Error stopping Vulnerability Reporter Agent:', error);
    }

    this.initialized = false;
    console.log('Agent System shutdown complete');
    this.emit('agent_system_shutdown');
  }

  /**
   * Manually trigger a workflow by template name
   */
  async triggerWorkflowByName(
    templateName: string,
    operationId: string,
    userId: string,
    additionalContext: Record<string, any> = {}
  ): Promise<string | null> {
    try {
      const [template] = await db
        .select()
        .from(workflowTemplates)
        .where(
          and(eq(workflowTemplates.name, templateName), eq(workflowTemplates.isActive, true))
        );

      if (!template) {
        console.error(`Workflow template "${templateName}" not found`);
        return null;
      }

      const { dynamicWorkflowOrchestrator } = await import('./dynamic-workflow-orchestrator');

      const workflowId = await dynamicWorkflowOrchestrator.buildWorkflow(template.id, operationId, {
        operationId,
        userId,
        ...additionalContext,
      });

      // Execute async
      dynamicWorkflowOrchestrator.executeWorkflow(workflowId).catch((err) => {
        console.error('Workflow execution failed:', err);
      });

      this.emit('workflow_triggered', { workflowId, templateName, operationId });
      return workflowId;
    } catch (error) {
      console.error(`Failed to trigger workflow "${templateName}":`, error);
      return null;
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): WorkflowEventHandlerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<WorkflowEventHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config_updated', this.config);
  }

  /**
   * Check if the agent system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const workflowEventHandlers = new WorkflowEventHandlers();

// Export individual functions for convenience
export const handleOperationCreated = (operationId: string, userId: string) =>
  workflowEventHandlers.handleOperationCreated(operationId, userId);

export const handleSurfaceAssessmentCompleted = (operationId: string, userId: string) =>
  workflowEventHandlers.handleSurfaceAssessmentCompleted(operationId, userId);

export const handleScanCompleted = (
  scanId: string,
  scanType: 'bbot' | 'nuclei' | 'nmap' | 'other',
  operationId: string,
  userId: string
) => workflowEventHandlers.handleScanCompleted(scanId, scanType, operationId, userId);

export const initializeAgentSystem = () => workflowEventHandlers.initializeAgentSystem();

export const shutdownAgentSystem = () => workflowEventHandlers.shutdownAgentSystem();

export const triggerWorkflowByName = (
  templateName: string,
  operationId: string,
  userId: string,
  additionalContext?: Record<string, any>
) => workflowEventHandlers.triggerWorkflowByName(templateName, operationId, userId, additionalContext);
