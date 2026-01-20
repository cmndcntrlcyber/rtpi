/**
 * Workflow Event Handlers
 *
 * Event-driven workflow triggers that automatically start agent workflows
 * based on system events like operation creation, scan completion, etc.
 */

import { db } from '../db';
import { operations, agents, workflowTemplates } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowEventHandlerConfig {
  enableAutoTrigger: boolean;
  enableSurfaceAssessmentOnOperationCreate: boolean;
  enableWebHackerOnSurfaceAssessmentComplete: boolean;
  requireScopeForSurfaceAssessment: boolean;
}

const DEFAULT_CONFIG: WorkflowEventHandlerConfig = {
  enableAutoTrigger: true,
  enableSurfaceAssessmentOnOperationCreate: true,
  enableWebHackerOnSurfaceAssessmentComplete: true,
  requireScopeForSurfaceAssessment: true,
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
    scanType: 'bbot' | 'nuclei' | 'other',
    operationId: string,
    userId: string
  ): Promise<void> {
    console.log(`Workflow Event: ${scanType} scan ${scanId} completed for operation ${operationId}`);

    // Emit event for listeners
    this.emit('scan_completed', { scanId, scanType, operationId, userId });

    // BBOT scan completion triggers Surface Assessment completion
    if (scanType === 'bbot') {
      await this.handleSurfaceAssessmentCompleted(operationId, userId);
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
  scanType: 'bbot' | 'nuclei' | 'other',
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
