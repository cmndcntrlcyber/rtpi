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
  type: 'context_has' | 'context_equals' | 'capability_available' | 'custom';
  field?: string;
  operator?: 'equals' | 'contains' | 'exists' | 'gt' | 'lt' | 'not_equals';
  value?: any;
  expression?: string; // For custom type - simple expression evaluation
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
   * Evaluate a dependency condition against the current context
   */
  evaluateDependencyCondition(
    condition: DependencyCondition | null | undefined,
    context: Record<string, any>
  ): boolean {
    // No condition means the dependency is always active
    if (!condition || Object.keys(condition).length === 0) {
      return true;
    }

    try {
      switch (condition.type) {
        case 'context_has':
          // Check if context contains a specific key
          if (!condition.field) return true;
          return condition.field in context;

        case 'context_equals':
          // Check if context value equals expected value
          if (!condition.field) return true;
          const contextValue = this.getNestedValue(context, condition.field);
          if (condition.operator === 'not_equals') {
            return contextValue !== condition.value;
          }
          return contextValue === condition.value;

        case 'capability_available':
          // Check if a capability is registered and available
          if (!condition.field) return true;
          const capabilityName = condition.field;
          const agent = this.findAgentForCapability(capabilityName, context);
          return agent !== null;

        case 'custom':
          // Evaluate a simple expression (limited for security)
          return this.evaluateSimpleExpression(condition.expression || '', context);

        default:
          // Legacy condition format support
          if (condition.field && condition.operator) {
            return this.evaluateLegacyCondition(condition, context);
          }
          return true;
      }
    } catch (error) {
      console.warn('Failed to evaluate dependency condition:', error);
      return true; // Default to including the dependency on error
    }
  }

  /**
   * Get a nested value from an object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  /**
   * Evaluate legacy condition format (field + operator + value)
   */
  private evaluateLegacyCondition(
    condition: DependencyCondition,
    context: Record<string, any>
  ): boolean {
    const fieldValue = this.getNestedValue(context, condition.field || '');

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        if (typeof fieldValue === 'string') {
          return fieldValue.includes(String(condition.value));
        }
        return false;
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'gt':
        return typeof fieldValue === 'number' && fieldValue > condition.value;
      case 'lt':
        return typeof fieldValue === 'number' && fieldValue < condition.value;
      default:
        return true;
    }
  }

  /**
   * Evaluate a simple expression (limited operations for security)
   * Supports: context.field, boolean literals, simple comparisons
   */
  private evaluateSimpleExpression(expression: string, context: Record<string, any>): boolean {
    if (!expression || expression.trim() === '') return true;

    const trimmed = expression.trim().toLowerCase();

    // Boolean literals
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Simple field existence check: "context.fieldName"
    const fieldMatch = expression.match(/^context\.(\w+(?:\.\w+)*)$/);
    if (fieldMatch) {
      const value = this.getNestedValue(context, fieldMatch[1]);
      return Boolean(value);
    }

    // Simple equality: "context.field == 'value'" or "context.field === 'value'"
    const eqMatch = expression.match(/^context\.(\w+(?:\.\w+)*)\s*===?\s*['"]?(.+?)['"]?$/);
    if (eqMatch) {
      const value = this.getNestedValue(context, eqMatch[1]);
      const expected = eqMatch[2];
      return String(value) === expected;
    }

    // Simple inequality: "context.field != 'value'" or "context.field !== 'value'"
    const neqMatch = expression.match(/^context\.(\w+(?:\.\w+)*)\s*!==?\s*['"]?(.+?)['"]?$/);
    if (neqMatch) {
      const value = this.getNestedValue(context, neqMatch[1]);
      const expected = neqMatch[2];
      return String(value) !== expected;
    }

    // Default to true for unrecognized expressions (safe fallback)
    console.warn(`Unrecognized expression format: ${expression}`);
    return true;
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

    // Build dependency graph and calculate phases with conditional evaluation
    const executionGraph = await this.buildExecutionGraph(resolvedAgents, context);

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
   * Build execution graph with dependency resolution and conditional evaluation
   */
  private async buildExecutionGraph(
    agentNodes: ResolvedAgentNode[],
    context: Record<string, any> = {}
  ): Promise<ExecutionGraph> {
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

    // Build dependency map, evaluating conditions
    const depMap = new Map<string, string[]>();
    const skippedDeps: Array<{ agentId: string; dependency: string; reason: string }> = [];

    for (const dep of dependencies) {
      // Evaluate the dependency condition
      const condition = dep.condition as DependencyCondition | null;
      const conditionMet = this.evaluateDependencyCondition(condition, context);

      // Handle based on dependency type and condition result
      if (dep.dependencyType === 'conditional' && !conditionMet) {
        // Conditional dependency with unmet condition - skip it
        skippedDeps.push({
          agentId: dep.agentId,
          dependency: dep.dependsOnCapability,
          reason: 'Condition not met',
        });
        continue;
      }

      if (dep.dependencyType === 'optional' && !conditionMet) {
        // Optional dependency with unmet condition - skip it
        skippedDeps.push({
          agentId: dep.agentId,
          dependency: dep.dependsOnCapability,
          reason: 'Optional dependency condition not met',
        });
        continue;
      }

      // Required dependencies or dependencies with met conditions are included
      if (!depMap.has(dep.agentId)) {
        depMap.set(dep.agentId, []);
      }
      depMap.get(dep.agentId)!.push(dep.dependsOnCapability);
    }

    // Log skipped dependencies for debugging
    if (skippedDeps.length > 0) {
      console.log(
        `Conditional dependency evaluation: ${skippedDeps.length} dependencies skipped`,
        skippedDeps
      );
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
   * Execute a workflow instance with checkpoint/resume support
   * @param workflowId - The workflow instance ID
   * @param resumeFromPhase - Optional phase to resume from (for checkpoint/resume)
   */
  async executeWorkflow(workflowId: string, resumeFromPhase?: number): Promise<void> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, workflowId));

    if (!instance) {
      throw new Error(`Workflow instance ${workflowId} not found`);
    }

    // Load template config upfront for retry policy and fallback behavior
    const [template] = instance.templateId
      ? await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, instance.templateId))
      : [null];

    const config = (template?.configuration as WorkflowTemplateConfig) || {};
    const retryConfig = config.retryPolicy || {
      maxRetries: parseInt(process.env.WORKFLOW_RETRY_MAX_RETRIES || '3', 10),
      backoffMultiplier: parseFloat(process.env.WORKFLOW_RETRY_BACKOFF_MULTIPLIER || '2'),
    };

    // Determine starting phase - use resumeFromPhase, or instance.currentPhase for paused workflows, or 0
    const isResuming = resumeFromPhase !== undefined || instance.status === 'paused';
    const startPhase = resumeFromPhase ?? (instance.status === 'paused' ? (instance.currentPhase || 0) : 0);

    // Get current context, preserving any intermediate results from previous execution
    let workflowContext = (instance.context as Record<string, any>) || {};

    // If resuming, load completed task outputs to restore context
    if (isResuming) {
      const completedTasks = await db
        .select()
        .from(workflowTasks)
        .where(
          and(
            eq(workflowTasks.workflowId, workflowId),
            eq(workflowTasks.status, 'completed')
          )
        );

      // Merge completed task outputs into context
      for (const task of completedTasks) {
        if (task.outputData && task.taskName) {
          workflowContext[task.taskName] = task.outputData;
        }
      }

      // Update the instance context with restored data
      await db
        .update(workflowInstances)
        .set({ context: workflowContext })
        .where(eq(workflowInstances.id, workflowId));
    }

    await db
      .update(workflowInstances)
      .set({
        status: 'running',
        startedAt: instance.startedAt || new Date(),
      })
      .where(eq(workflowInstances.id, workflowId));

    this.emit(isResuming ? 'workflow_resumed' : 'workflow_started', workflowId);

    // Log workflow configuration
    await db.insert(workflowLogs).values({
      workflowId,
      level: 'info',
      message: isResuming
        ? `Workflow resumed from phase ${startPhase} with restored context`
        : `Workflow started with retry policy: maxRetries=${retryConfig.maxRetries}, backoffMultiplier=${retryConfig.backoffMultiplier}`,
      context: {
        config: retryConfig,
        isResuming,
        startPhase,
        restoredContextKeys: isResuming ? Object.keys(workflowContext) : [],
      },
    });

    const resolvedAgents = (instance.resolvedAgents as ResolvedAgentNode[]) || [];

    if (resolvedAgents.length === 0) {
      const errorMessage = 'Workflow has no agents assigned. Please configure agents for this workflow template.';
      await db
        .update(workflowInstances)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage
        })
        .where(eq(workflowInstances.id, workflowId));

      await db.insert(workflowLogs).values({
        workflowId,
        level: 'error',
        message: errorMessage,
        context: { reason: 'no_agents_resolved' },
      });

      this.emit('workflow_failed', workflowId, new Error(errorMessage));
      console.warn(`[DynamicWorkflowOrchestrator] Workflow ${workflowId} failed: no agents resolved`);
      return;
    }

    const maxPhase = Math.max(...resolvedAgents.map(a => a.phase));

    // Execute phase by phase, starting from the appropriate phase
    for (let phase = startPhase; phase <= maxPhase; phase++) {
      // Check if workflow was paused or cancelled
      const [currentState] = await db
        .select({ status: workflowInstances.status })
        .from(workflowInstances)
        .where(eq(workflowInstances.id, workflowId));

      if (currentState?.status === 'paused' || currentState?.status === 'cancelled') {
        await db.insert(workflowLogs).values({
          workflowId,
          level: 'info',
          message: `Workflow execution stopped at phase ${phase}: status changed to ${currentState.status}`,
          context: { phase, status: currentState.status },
        });
        return;
      }

      await db
        .update(workflowInstances)
        .set({ currentPhase: phase })
        .where(eq(workflowInstances.id, workflowId));

      const phaseAgents = resolvedAgents.filter(a => a.phase === phase);

      // When resuming, check for already completed tasks in this phase
      let agentsToExecute = phaseAgents;
      if (isResuming) {
        const completedTaskNames = await db
          .select({ taskName: workflowTasks.taskName })
          .from(workflowTasks)
          .where(
            and(
              eq(workflowTasks.workflowId, workflowId),
              eq(workflowTasks.status, 'completed')
            )
          );

        const completedCapabilities = new Set(completedTaskNames.map(t => t.taskName));

        // Filter out agents whose tasks are already completed
        agentsToExecute = phaseAgents.filter(agent => !completedCapabilities.has(agent.capability));

        if (agentsToExecute.length < phaseAgents.length) {
          const skippedCount = phaseAgents.length - agentsToExecute.length;
          await db.insert(workflowLogs).values({
            workflowId,
            level: 'info',
            message: `Phase ${phase}: Skipping ${skippedCount} already completed agent(s)`,
            context: {
              phase,
              skippedCount,
              skippedCapabilities: phaseAgents
                .filter(a => completedCapabilities.has(a.capability))
                .map(a => a.capability),
            },
          });
        }
      }

      // Skip if all agents in this phase are already completed
      if (agentsToExecute.length === 0) {
        continue;
      }

      // Execute remaining agents in this phase in parallel with retry support
      const results = await Promise.allSettled(
        agentsToExecute.map(agent =>
          this.executeAgentTask(
            workflowId,
            agent,
            workflowContext,
            retryConfig
          )
        )
      );

      // Update context with new results after phase completion
      const [updatedInstance] = await db
        .select({ context: workflowInstances.context })
        .from(workflowInstances)
        .where(eq(workflowInstances.id, workflowId));

      if (updatedInstance?.context) {
        workflowContext = updatedInstance.context as Record<string, any>;
      }

      // Check for failures (after all retries exhausted)
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        if (config.fallbackBehavior === 'fail') {
          const failureReasons = failures.map(f =>
            f.status === 'rejected' ? (f.reason as Error)?.message : 'Unknown'
          );

          await db
            .update(workflowInstances)
            .set({
              status: 'failed',
              completedAt: new Date(),
              errorMessage: `Phase ${phase} failed: ${failures.length} agent(s) failed after retries. Reasons: ${failureReasons.join('; ')}`
            })
            .where(eq(workflowInstances.id, workflowId));

          this.emit('workflow_failed', { workflowId, phase, failures });
          return;
        }
        // Otherwise continue with 'skip' behavior
        await db.insert(workflowLogs).values({
          workflowId,
          level: 'warn',
          message: `Phase ${phase} had ${failures.length} failure(s), continuing due to skip fallback behavior`,
          context: { phase, failureCount: failures.length },
        });
      }
    }

    await db
      .update(workflowInstances)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(workflowInstances.id, workflowId));

    this.emit('workflow_completed', workflowId);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(
    attempt: number,
    baseDelayMs: number = 1000,
    multiplier: number = 2,
    maxDelayMs: number = 60000
  ): number {
    const delay = baseDelayMs * Math.pow(multiplier, attempt - 1);
    return Math.min(delay, maxDelayMs);
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute a single agent task within a workflow with retry support
   */
  private async executeAgentTask(
    workflowId: string,
    agentNode: ResolvedAgentNode,
    context: Record<string, any>,
    retryConfig?: { maxRetries: number; backoffMultiplier: number }
  ): Promise<void> {
    // Get retry configuration from workflow or use defaults
    const maxRetries = retryConfig?.maxRetries ?? 3;
    const backoffMultiplier = retryConfig?.backoffMultiplier ?? 2;
    const baseDelayMs = parseInt(process.env.WORKFLOW_RETRY_BASE_DELAY_MS || '1000', 10);

    // Update agent status to running
    await this.updateAgentStatus(workflowId, agentNode.agentId, 'running');

    // Log task start
    await db.insert(workflowLogs).values({
      workflowId,
      level: 'info',
      message: `Starting agent task: ${agentNode.capability}`,
      context: { agentId: agentNode.agentId, capability: agentNode.capability },
    });

    // Get the actual agent
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentNode.agentId));

    if (!agent) {
      throw new Error(`Agent ${agentNode.agentId} not found`);
    }

    // Create workflow task record with retry configuration
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
        maxRetries,
        retryCount: 0,
      })
      .returning();

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;

      try {
        // Update task status for retry attempts
        if (attempt > 1) {
          await db
            .update(workflowTasks)
            .set({
              status: 'in_progress',
              retryCount: attempt - 1,
              startedAt: new Date(),
              errorMessage: null,
            })
            .where(eq(workflowTasks.id, task.id));

          // Log retry attempt
          await db.insert(workflowLogs).values({
            workflowId,
            taskId: task.id,
            level: 'info',
            message: `Retrying agent task: ${agentNode.capability} (attempt ${attempt}/${maxRetries + 1})`,
            context: {
              agentId: agentNode.agentId,
              attempt,
              maxRetries: maxRetries + 1,
              previousError: lastError?.message,
            },
          });
        }

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

        // Update task with successful result
        await db
          .update(workflowTasks)
          .set({
            outputData: result,
            status: 'completed',
            completedAt: new Date(),
            retryCount: attempt - 1,
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
          message: attempt > 1
            ? `Agent task completed after ${attempt} attempts: ${agentNode.capability}`
            : `Agent task completed: ${agentNode.capability}`,
          context: { agentId: agentNode.agentId, attempts: attempt },
        });

        // Success - exit retry loop
        return;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Agent ${agentNode.agentId} failed (attempt ${attempt}/${maxRetries + 1}):`, lastError.message);

        // Update task with error info
        await db
          .update(workflowTasks)
          .set({
            status: 'failed',
            errorMessage: lastError.message,
            retryCount: attempt - 1,
            completedAt: new Date(),
          })
          .where(eq(workflowTasks.id, task.id));

        // Check if we should retry
        if (attempt <= maxRetries) {
          const backoffDelay = this.calculateBackoffDelay(attempt, baseDelayMs, backoffMultiplier);

          // Log retry scheduled
          await db.insert(workflowLogs).values({
            workflowId,
            taskId: task.id,
            level: 'warn',
            message: `Agent task failed, scheduling retry in ${backoffDelay}ms: ${agentNode.capability}`,
            context: {
              agentId: agentNode.agentId,
              error: lastError.message,
              attempt,
              nextRetryIn: backoffDelay,
              maxRetries: maxRetries + 1,
            },
          });

          // Wait before retrying
          await this.sleep(backoffDelay);
        }
      }
    }

    // All retries exhausted - mark as permanently failed
    await this.updateAgentStatus(workflowId, agentNode.agentId, 'failed');

    // Log final failure
    await db.insert(workflowLogs).values({
      workflowId,
      taskId: task.id,
      level: 'error',
      message: `Agent task failed after ${maxRetries + 1} attempts: ${agentNode.capability}`,
      context: {
        agentId: agentNode.agentId,
        error: lastError?.message,
        totalAttempts: maxRetries + 1,
      },
    });

    throw lastError || new Error(`Agent ${agentNode.capability} failed after ${maxRetries + 1} attempts`);
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
   * Pause a running workflow and create checkpoint
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, workflowId));

    if (!instance) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Get all completed task outputs to preserve in context
    const completedTasks = await db
      .select()
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.workflowId, workflowId),
          eq(workflowTasks.status, 'completed')
        )
      );

    // Build checkpoint context with all completed task outputs
    const checkpointContext = { ...(instance.context as Record<string, any>) };
    for (const task of completedTasks) {
      if (task.outputData && task.taskName) {
        checkpointContext[task.taskName] = task.outputData;
      }
    }

    // Update workflow with checkpoint data
    await db
      .update(workflowInstances)
      .set({
        status: 'paused',
        context: checkpointContext,
      })
      .where(eq(workflowInstances.id, workflowId));

    // Log checkpoint creation
    await db.insert(workflowLogs).values({
      workflowId,
      level: 'info',
      message: `Workflow paused at phase ${instance.currentPhase}. Checkpoint created with ${completedTasks.length} completed task(s).`,
      context: {
        currentPhase: instance.currentPhase,
        completedTaskCount: completedTasks.length,
        completedCapabilities: completedTasks.map(t => t.taskName),
        checkpointKeys: Object.keys(checkpointContext),
      },
    });

    this.emit('workflow_paused', workflowId);
  }

  /**
   * Resume a paused workflow from checkpoint
   */
  async resumeWorkflow(workflowId: string): Promise<void> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, workflowId));

    if (!instance) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (instance.status !== 'paused' && instance.status !== 'failed') {
      throw new Error(`Workflow ${workflowId} cannot be resumed (status: ${instance.status})`);
    }

    // Log resume attempt
    await db.insert(workflowLogs).values({
      workflowId,
      level: 'info',
      message: `Resuming workflow from phase ${instance.currentPhase}`,
      context: {
        previousStatus: instance.status,
        currentPhase: instance.currentPhase,
        contextKeys: Object.keys((instance.context as Record<string, any>) || {}),
      },
    });

    // Continue execution from saved checkpoint
    // The executeWorkflow method will handle context restoration and skip completed tasks
    await this.executeWorkflow(workflowId, instance.currentPhase || 0);
  }

  /**
   * Get checkpoint information for a workflow
   */
  async getWorkflowCheckpoint(workflowId: string): Promise<{
    phase: number;
    completedTasks: string[];
    contextKeys: string[];
    canResume: boolean;
  }> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, workflowId));

    if (!instance) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const completedTasks = await db
      .select({ taskName: workflowTasks.taskName })
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.workflowId, workflowId),
          eq(workflowTasks.status, 'completed')
        )
      );

    return {
      phase: instance.currentPhase || 0,
      completedTasks: completedTasks.map(t => t.taskName).filter(Boolean) as string[],
      contextKeys: Object.keys((instance.context as Record<string, any>) || {}),
      canResume: instance.status === 'paused' || instance.status === 'failed',
    };
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
