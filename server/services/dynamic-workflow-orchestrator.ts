/**
 * Dynamic Workflow Orchestrator
 *
 * Enables the system to automatically adapt when agents are added, removed, or modified.
 * Uses a capability-based matching system and dependency graph to construct workflows dynamically.
 *
 * Key Features:
 * - Capability-based agent matching
 * - Automatic dependency resolution with topological sort
 * - Dynamic workflow construction
 * - Event-driven triggers
 * - Fallback handling for missing capabilities
 */

import { db } from '../db';
import {
  agents,
  agentCapabilities,
  agentDependencies,
  workflowTemplates,
  workflowInstances,
  workflowTasks,
  workflowLogs,
} from '../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface AgentCapabilityMap {
  agentId: string;
  agentName: string;
  agentType: string;
  capabilities: string[];
  inputTypes: string[];
  outputTypes: string[];
  priority: number;
  isAvailable: boolean;
}

export interface ResolvedAgentNode {
  agentId: string;
  capability: string;
  phase: number;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export interface ExecutionGraph {
  nodes: Record<string, ResolvedAgentNode>;
  edges: Array<{ from: string; to: string; type: 'data' | 'sequence' }>;
}

export interface WorkflowTemplateConfig {
  maxParallelAgents: number;
  timeoutPerPhase: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
  };
  fallbackBehavior: 'skip' | 'fail' | 'substitute';
}

export interface DependencyCondition {
  field: string;
  operator: 'equals' | 'contains' | 'exists' | 'gt' | 'lt';
  value: any;
}

// ============================================================================
// Dynamic Workflow Orchestrator
// ============================================================================

export class DynamicWorkflowOrchestrator extends EventEmitter {
  private capabilityCache: Map<string, AgentCapabilityMap[]> = new Map();
  private activeWorkflows: Map<string, any> = new Map();
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize the orchestrator and start capability refresh
   */
  async initialize(): Promise<void> {
    await this.refreshCapabilityCache();
    this.startCapabilityRefresh();
    console.log('DynamicWorkflowOrchestrator initialized');
  }

  /**
   * Start periodic capability refresh to detect agent changes
   */
  private startCapabilityRefresh(intervalMs: number = 30000): void {
    this.refreshInterval = setInterval(async () => {
      await this.refreshCapabilityCache();
      this.emit('capabilities_refreshed', this.capabilityCache);
    }, intervalMs);
  }

  /**
   * Refresh the capability cache from database
   */
  async refreshCapabilityCache(): Promise<void> {
    try {
      const capabilities = await db
        .select({
          agentId: agents.id,
          agentName: agents.name,
          agentType: agents.type,
          agentStatus: agents.status,
          capability: agentCapabilities.capability,
          inputTypes: agentCapabilities.inputTypes,
          outputTypes: agentCapabilities.outputTypes,
          priority: agentCapabilities.priority,
          isEnabled: agentCapabilities.isEnabled,
        })
        .from(agentCapabilities)
        .innerJoin(agents, eq(agentCapabilities.agentId, agents.id))
        .where(eq(agentCapabilities.isEnabled, true));

      // Group by capability
      this.capabilityCache.clear();
      for (const cap of capabilities) {
        const capName = cap.capability;
        if (!this.capabilityCache.has(capName)) {
          this.capabilityCache.set(capName, []);
        }
        this.capabilityCache.get(capName)!.push({
          agentId: cap.agentId,
          agentName: cap.agentName,
          agentType: cap.agentType,
          capabilities: [cap.capability],
          inputTypes: (cap.inputTypes as string[]) || [],
          outputTypes: (cap.outputTypes as string[]) || [],
          priority: cap.priority || 0,
          isAvailable: cap.agentStatus === 'idle' || cap.agentStatus === 'running',
        });
      }

      // Sort each capability's agents by priority (higher = preferred)
      for (const [_, agentList] of this.capabilityCache) {
        agentList.sort((a, b) => b.priority - a.priority);
      }

      console.log(`Capability cache refreshed: ${this.capabilityCache.size} capabilities`);
    } catch (error) {
      console.error('Failed to refresh capability cache:', error);
    }
  }

  /**
   * Find the best agent for a given capability
   */
  findAgentForCapability(capability: string, context?: Record<string, any>): AgentCapabilityMap | null {
    const agentList = this.capabilityCache.get(capability);
    if (!agentList || agentList.length === 0) return null;

    // Return highest priority available agent
    const available = agentList.filter(a => a.isAvailable);
    return available.length > 0 ? available[0] : null;
  }

  /**
   * Find all agents that can satisfy a capability (for fallback)
   */
  findAllAgentsForCapability(capability: string): AgentCapabilityMap[] {
    return this.capabilityCache.get(capability) || [];
  }

  /**
   * Get all registered capabilities
   */
  getAllCapabilities(): string[] {
    return Array.from(this.capabilityCache.keys());
  }

  /**
   * Build a dynamic workflow based on required capabilities
   */
  async buildWorkflow(
    templateIdOrName: string,
    operationId: string,
    context: Record<string, any> = {}
  ): Promise<string> {
    // Get template by ID or name
    let template;
    [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, templateIdOrName));

    if (!template) {
      [template] = await db
        .select()
        .from(workflowTemplates)
        .where(eq(workflowTemplates.name, templateIdOrName));
    }

    if (!template) {
      throw new Error(`Workflow template '${templateIdOrName}' not found`);
    }

    // Resolve agents for each required capability
    const resolvedAgents: ResolvedAgentNode[] = [];
    const missingCapabilities: string[] = [];
    const requiredCapabilities = (template.requiredCapabilities as string[]) || [];
    const optionalCapabilities = (template.optionalCapabilities as string[]) || [];

    for (const capability of requiredCapabilities) {
      const agent = this.findAgentForCapability(capability, context);
      if (agent) {
        resolvedAgents.push({
          agentId: agent.agentId,
          capability,
          phase: 0, // Will be calculated later
          dependencies: [],
          status: 'pending',
        });
      } else {
        missingCapabilities.push(capability);
      }
    }

    // Handle missing capabilities based on fallback behavior
    const config = (template.configuration as WorkflowTemplateConfig) || {};
    if (missingCapabilities.length > 0) {
      if (config.fallbackBehavior === 'fail') {
        throw new Error(`Missing required capabilities: ${missingCapabilities.join(', ')}`);
      }
      // 'skip' or 'substitute' - log warning and continue
      console.warn(`Workflow missing capabilities: ${missingCapabilities.join(', ')}`);
    }

    // Add optional capabilities if available
    for (const capability of optionalCapabilities) {
      const agent = this.findAgentForCapability(capability, context);
      if (agent) {
        resolvedAgents.push({
          agentId: agent.agentId,
          capability,
          phase: 0,
          dependencies: [],
          status: 'pending',
        });
      }
    }

    // Build dependency graph and calculate phases
    const executionGraph = await this.buildExecutionGraph(resolvedAgents);

    // Create workflow instance
    const [instance] = await db
      .insert(workflowInstances)
      .values({
        templateId: template.id,
        operationId,
        status: 'pending',
        resolvedAgents,
        executionGraph,
        context,
      })
      .returning();

    this.activeWorkflows.set(instance.id, instance);
    this.emit('workflow_created', { workflowId: instance.id, operationId });

    return instance.id;
  }

  /**
   * Build execution graph with dependency resolution
   */
  private async buildExecutionGraph(agentNodes: ResolvedAgentNode[]): Promise<ExecutionGraph> {
    const graph: ExecutionGraph = {
      nodes: {},
      edges: [],
    };

    if (agentNodes.length === 0) {
      return graph;
    }

    // Get dependencies for all agents
    const agentIds = agentNodes.map(a => a.agentId);
    const dependencies = await db
      .select()
      .from(agentDependencies)
      .where(inArray(agentDependencies.agentId, agentIds));

    // Build dependency map
    const depMap = new Map<string, string[]>();
    for (const dep of dependencies) {
      if (!depMap.has(dep.agentId)) {
        depMap.set(dep.agentId, []);
      }
      depMap.get(dep.agentId)!.push(dep.dependsOnCapability);
    }

    // Calculate phases using topological sort
    const phases = this.calculatePhases(agentNodes, depMap);

    // Update agents with calculated phases and dependencies
    for (const agent of agentNodes) {
      agent.phase = phases.get(agent.agentId) || 0;
      agent.dependencies = depMap.get(agent.agentId) || [];
      graph.nodes[agent.agentId] = agent;
    }

    // Build edges based on dependencies
    for (const agent of agentNodes) {
      for (const depCapability of agent.dependencies) {
        const depAgent = agentNodes.find(a => a.capability === depCapability);
        if (depAgent) {
          graph.edges.push({
            from: depAgent.agentId,
            to: agent.agentId,
            type: 'data',
          });
        }
      }
    }

    return graph;
  }

  /**
   * Calculate execution phases using topological sort
   */
  private calculatePhases(
    agentNodes: ResolvedAgentNode[],
    depMap: Map<string, string[]>
  ): Map<string, number> {
    const phases = new Map<string, number>();
    const capabilityToAgent = new Map<string, string>();

    for (const agent of agentNodes) {
      capabilityToAgent.set(agent.capability, agent.agentId);
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (agentId: string): number => {
      if (phases.has(agentId)) return phases.get(agentId)!;
      if (visiting.has(agentId)) {
        throw new Error('Circular dependency detected in workflow');
      }

      visiting.add(agentId);
      let maxDepPhase = -1;

      const deps = depMap.get(agentId) || [];
      for (const depCap of deps) {
        const depAgentId = capabilityToAgent.get(depCap);
        if (depAgentId) {
          maxDepPhase = Math.max(maxDepPhase, visit(depAgentId));
        }
      }

      visiting.delete(agentId);
      visited.add(agentId);

      const phase = maxDepPhase + 1;
      phases.set(agentId, phase);
      return phase;
    };

    for (const agent of agentNodes) {
      if (!visited.has(agent.agentId)) {
        visit(agent.agentId);
      }
    }

    return phases;
  }

  /**
   * Execute a workflow instance
   */
  async executeWorkflow(workflowId: string): Promise<void> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, workflowId));

    if (!instance) {
      throw new Error(`Workflow instance ${workflowId} not found`);
    }

    await db
      .update(workflowInstances)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(workflowInstances.id, workflowId));

    this.emit('workflow_started', workflowId);

    const resolvedAgents = (instance.resolvedAgents as ResolvedAgentNode[]) || [];

    if (resolvedAgents.length === 0) {
      await db
        .update(workflowInstances)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(workflowInstances.id, workflowId));
      this.emit('workflow_completed', workflowId);
      return;
    }

    const maxPhase = Math.max(...resolvedAgents.map(a => a.phase));

    // Execute phase by phase
    for (let phase = 0; phase <= maxPhase; phase++) {
      await db
        .update(workflowInstances)
        .set({ currentPhase: phase })
        .where(eq(workflowInstances.id, workflowId));

      const phaseAgents = resolvedAgents.filter(a => a.phase === phase);

      // Execute all agents in this phase in parallel
      const results = await Promise.allSettled(
        phaseAgents.map(agent =>
          this.executeAgentTask(workflowId, agent, (instance.context as Record<string, any>) || {})
        )
      );

      // Check for failures
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        // Get template config for fallback behavior
        const [template] = instance.templateId
          ? await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, instance.templateId))
          : [null];

        const config = (template?.configuration as WorkflowTemplateConfig) || {};

        if (config.fallbackBehavior === 'fail') {
          await db
            .update(workflowInstances)
            .set({
              status: 'failed',
              completedAt: new Date(),
              errorMessage: `Phase ${phase} failed: ${failures.length} agent(s) failed`
            })
            .where(eq(workflowInstances.id, workflowId));

          this.emit('workflow_failed', { workflowId, phase, failures });
          return;
        }
        // Otherwise continue with 'skip' behavior
      }
    }

    await db
      .update(workflowInstances)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(workflowInstances.id, workflowId));

    this.emit('workflow_completed', workflowId);
  }

  /**
   * Execute a single agent task within a workflow
   */
  private async executeAgentTask(
    workflowId: string,
    agentNode: ResolvedAgentNode,
    context: Record<string, any>
  ): Promise<void> {
    // Update agent status to running
    await this.updateAgentStatus(workflowId, agentNode.agentId, 'running');

    // Log task start
    await db.insert(workflowLogs).values({
      workflowId,
      level: 'info',
      message: `Starting agent task: ${agentNode.capability}`,
      context: { agentId: agentNode.agentId, capability: agentNode.capability },
    });

    try {
      // Get the actual agent
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentNode.agentId));

      if (!agent) {
        throw new Error(`Agent ${agentNode.agentId} not found`);
      }

      // Create workflow task record
      const [task] = await db
        .insert(workflowTasks)
        .values({
          workflowId,
          agentId: agentNode.agentId,
          taskType: 'custom',
          taskName: agentNode.capability,
          status: 'in_progress',
          sequenceOrder: agentNode.phase,
          inputData: context,
        })
        .returning();

      // Execute based on agent type
      let result: any;
      const agentConfig = agent.config as any;

      switch (agent.type) {
        case 'custom':
          result = await this.executeCustomAgent(agent, context, agentConfig);
          break;
        case 'anthropic':
        case 'openai':
          result = await this.executeAIAgent(agent, context, agentConfig);
          break;
        default:
          // Mark as skipped for unsupported types
          console.warn(`Unsupported agent type: ${agent.type}`);
          result = { skipped: true, reason: `Unsupported agent type: ${agent.type}` };
      }

      // Update task with result
      await db
        .update(workflowTasks)
        .set({
          outputData: result,
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(workflowTasks.id, task.id));

      // Merge result into workflow context
      await this.updateWorkflowContext(workflowId, { [agentNode.capability]: result });

      await this.updateAgentStatus(workflowId, agentNode.agentId, 'completed');

      // Log success
      await db.insert(workflowLogs).values({
        workflowId,
        taskId: task.id,
        level: 'info',
        message: `Agent task completed: ${agentNode.capability}`,
        context: { agentId: agentNode.agentId },
      });

    } catch (error) {
      console.error(`Agent ${agentNode.agentId} failed:`, error);
      await this.updateAgentStatus(workflowId, agentNode.agentId, 'failed');

      // Log error
      await db.insert(workflowLogs).values({
        workflowId,
        level: 'error',
        message: `Agent ${agentNode.capability} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: { agentId: agentNode.agentId, error: String(error) },
      });

      throw error;
    }
  }

  /**
   * Execute custom agent (Tool Connector, Surface Assessment, Web Hacker)
   */
  private async executeCustomAgent(
    agent: typeof agents.$inferSelect,
    context: Record<string, any>,
    config: any
  ): Promise<any> {
    const handlerPath = config?.handlerPath;

    if (!handlerPath) {
      throw new Error('Custom agent missing handlerPath in config');
    }

    try {
      // Dynamic import of agent handler
      // Handlers should export a static `execute(context)` method
      const handlerModule = await import(handlerPath);

      if (typeof handlerModule.execute === 'function') {
        return handlerModule.execute(context);
      } else if (handlerModule.default && typeof handlerModule.default.execute === 'function') {
        return handlerModule.default.execute(context);
      } else {
        throw new Error(`Handler at ${handlerPath} does not export an execute function`);
      }
    } catch (error) {
      if ((error as any).code === 'ERR_MODULE_NOT_FOUND') {
        throw new Error(`Agent handler not found: ${handlerPath}`);
      }
      throw error;
    }
  }

  /**
   * Execute AI-powered agent (OpenAI/Anthropic)
   */
  private async executeAIAgent(
    agent: typeof agents.$inferSelect,
    context: Record<string, any>,
    config: any
  ): Promise<any> {
    // Use existing agent workflow orchestrator for AI agents
    const { AgentWorkflowOrchestrator } = await import('./agent-workflow-orchestrator');
    const orchestrator = new AgentWorkflowOrchestrator();

    const result = await orchestrator.callAgentAI(
      agent.type as 'openai' | 'anthropic',
      context.prompt || JSON.stringify(context),
      {
        model: config?.model,
        systemPrompt: config?.systemPrompt,
      }
    );

    return result;
  }

  /**
   * Update agent status within workflow
   */
  private async updateAgentStatus(
    workflowId: string,
    agentId: string,
    status: ResolvedAgentNode['status']
  ): Promise<void> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, workflowId));

    if (!instance) return;

    const agentNodes = (instance.resolvedAgents as ResolvedAgentNode[]) || [];
    const agent = agentNodes.find(a => a.agentId === agentId);
    if (agent) {
      agent.status = status;
    }

    await db
      .update(workflowInstances)
      .set({ resolvedAgents: agentNodes })
      .where(eq(workflowInstances.id, workflowId));
  }

  /**
   * Update workflow context with new data
   */
  private async updateWorkflowContext(
    workflowId: string,
    newContext: Record<string, any>
  ): Promise<void> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, workflowId));

    if (!instance) return;

    const mergedContext = { ...(instance.context as Record<string, any>), ...newContext };

    await db
      .update(workflowInstances)
      .set({ context: mergedContext })
      .where(eq(workflowInstances.id, workflowId));
  }

  /**
   * Register a new agent with capabilities (called when agents are added)
   */
  async registerAgent(
    agentId: string,
    capabilities: Array<{
      capability: string;
      inputTypes: string[];
      outputTypes: string[];
      priority?: number;
    }>,
    dependencies: Array<{
      dependsOnCapability: string;
      type: 'required' | 'optional' | 'conditional';
      condition?: DependencyCondition;
    }> = []
  ): Promise<void> {
    // Insert capabilities
    for (const cap of capabilities) {
      // Check if already exists
      const [existing] = await db
        .select()
        .from(agentCapabilities)
        .where(
          and(
            eq(agentCapabilities.agentId, agentId),
            eq(agentCapabilities.capability, cap.capability)
          )
        );

      if (!existing) {
        await db.insert(agentCapabilities).values({
          agentId,
          capability: cap.capability,
          inputTypes: cap.inputTypes,
          outputTypes: cap.outputTypes,
          priority: cap.priority || 0,
          isEnabled: true,
        });
      }
    }

    // Insert dependencies
    for (const dep of dependencies) {
      const [existing] = await db
        .select()
        .from(agentDependencies)
        .where(
          and(
            eq(agentDependencies.agentId, agentId),
            eq(agentDependencies.dependsOnCapability, dep.dependsOnCapability)
          )
        );

      if (!existing) {
        await db.insert(agentDependencies).values({
          agentId,
          dependsOnCapability: dep.dependsOnCapability,
          dependencyType: dep.type,
          condition: dep.condition || {},
        });
      }
    }

    // Refresh cache
    await this.refreshCapabilityCache();
    this.emit('agent_registered', agentId);
  }

  /**
   * Unregister an agent (called when agents are removed)
   */
  async unregisterAgent(agentId: string): Promise<void> {
    await db
      .delete(agentCapabilities)
      .where(eq(agentCapabilities.agentId, agentId));

    await db
      .delete(agentDependencies)
      .where(eq(agentDependencies.agentId, agentId));

    await this.refreshCapabilityCache();
    this.emit('agent_unregistered', agentId);
  }

  /**
   * Get workflow status and metrics
   */
  async getWorkflowStatus(workflowId: string): Promise<{
    status: string;
    progress: number;
    currentPhase: number;
    agents: ResolvedAgentNode[];
    context: Record<string, any>;
  }> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, workflowId));

    if (!instance) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const agentNodes = (instance.resolvedAgents as ResolvedAgentNode[]) || [];
    const completed = agentNodes.filter(a => a.status === 'completed').length;
    const progress = agentNodes.length > 0 ? (completed / agentNodes.length) * 100 : 0;

    return {
      status: instance.status || 'unknown',
      progress,
      currentPhase: instance.currentPhase || 0,
      agents: agentNodes,
      context: (instance.context as Record<string, any>) || {},
    };
  }

  /**
   * Get all active workflows
   */
  async getActiveWorkflows(): Promise<any[]> {
    return db
      .select()
      .from(workflowInstances)
      .where(
        inArray(workflowInstances.status, ['pending', 'running', 'paused'])
      );
  }

  /**
   * Pause a running workflow
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    await db
      .update(workflowInstances)
      .set({ status: 'paused' })
      .where(eq(workflowInstances.id, workflowId));

    this.emit('workflow_paused', workflowId);
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(workflowId: string): Promise<void> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, workflowId));

    if (!instance || instance.status !== 'paused') {
      throw new Error(`Workflow ${workflowId} is not paused`);
    }

    // Continue execution from current phase
    await this.executeWorkflow(workflowId);
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    await db
      .update(workflowInstances)
      .set({ status: 'cancelled', completedAt: new Date() })
      .where(eq(workflowInstances.id, workflowId));

    this.activeWorkflows.delete(workflowId);
    this.emit('workflow_cancelled', workflowId);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.removeAllListeners();
  }
}

// Singleton instance
export const dynamicWorkflowOrchestrator = new DynamicWorkflowOrchestrator();
