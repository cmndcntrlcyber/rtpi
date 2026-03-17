/**
 * ATT&CK Workflow Builder (v2.4 Phase 3)
 *
 * Converts ATT&CK technique selections into executable workflows
 * backed by agentWorkflows + workflowTasks, with tool mapping from
 * the toolRegistry and visual flow data for the attack flow UI.
 */

import { db } from '../db';
import {
  attackTechniques,
  attackTactics,
  attackTechniqueTactics,
  toolRegistry,
  toolRegistryTechniques,
  agentWorkflows,
  workflowTasks,
  attackFlows,
  agents,
} from '@shared/schema';
import { eq, inArray, asc } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowBuildRequest {
  operationId: string;
  targetId: string;
  techniqueIds: string[]; // ATT&CK IDs like 'T1190', 'T1059'
  userId: string;
  name?: string;
}

export interface WorkflowBuildResult {
  workflowId: string;
  attackFlowId: string;
  taskCount: number;
  techniques: Array<{
    attackId: string;
    name: string;
    tacticName: string;
    toolCount: number;
  }>;
}

interface ResolvedTechnique {
  id: string; // DB UUID
  attackId: string; // e.g., 'T1190'
  name: string;
  tacticId: string;
  tacticName: string;
  tacticShortname: string;
  killChainOrder: number;
  toolIds: string[]; // toolRegistry UUIDs
  toolNames: string[];
}

// Kill chain phase ordering
const KILL_CHAIN_ORDER: Record<string, number> = {
  'reconnaissance': 1,
  'resource-development': 2,
  'initial-access': 3,
  'execution': 4,
  'persistence': 5,
  'privilege-escalation': 6,
  'defense-evasion': 7,
  'credential-access': 8,
  'discovery': 9,
  'lateral-movement': 10,
  'collection': 11,
  'command-and-control': 12,
  'exfiltration': 13,
  'impact': 14,
};

// ============================================================================
// ATT&CK Workflow Builder
// ============================================================================

class AttackWorkflowBuilder {
  /**
   * Build an executable workflow from selected ATT&CK techniques
   */
  async buildWorkflowFromTechniques(
    params: WorkflowBuildRequest
  ): Promise<WorkflowBuildResult> {
    const { operationId, targetId, techniqueIds, userId, name } = params;

    // Step 1: Resolve techniques with tactic context
    const resolved = await this.resolveTechniques(techniqueIds);

    if (resolved.length === 0) {
      throw new Error('No matching ATT&CK techniques found for the provided IDs');
    }

    // Sort by kill chain order
    resolved.sort((a, b) => a.killChainOrder - b.killChainOrder);

    // Step 2: Map techniques to tools
    await this.mapToolsToTechniques(resolved);

    // Step 3: Find a default agent for task assignment
    const defaultAgentId = await this.getDefaultAgentId();

    // Step 4: Create the agent workflow
    const workflowName = name || `ATT&CK Workflow: ${resolved.map(t => t.attackId).join(', ')}`;

    const [workflow] = await db.insert(agentWorkflows).values({
      name: workflowName,
      workflowType: 'attack_flow',
      targetId,
      operationId,
      status: 'pending',
      progress: 0,
      metadata: {
        techniqueIds: resolved.map(t => t.attackId),
        generatedBy: 'attack-workflow-builder',
      },
      createdBy: userId,
    }).returning();

    // Step 5: Create workflow tasks (one per technique)
    for (let i = 0; i < resolved.length; i++) {
      const tech = resolved[i];
      await db.insert(workflowTasks).values({
        workflowId: workflow.id,
        agentId: defaultAgentId,
        taskType: 'execute_tools',
        taskName: `${tech.attackId}: ${tech.name}`,
        status: 'pending',
        sequenceOrder: i + 1,
        inputData: {
          techniqueId: tech.id,
          attackId: tech.attackId,
          tacticName: tech.tacticName,
          toolIds: tech.toolIds,
          toolNames: tech.toolNames,
          parameters: {},
        },
      });
    }

    // Step 6: Create attack flow with React Flow data
    const flowData = this.buildFlowData(resolved);

    const [flow] = await db.insert(attackFlows).values({
      operationId,
      name: workflowName,
      description: `Auto-generated from ${resolved.length} ATT&CK techniques`,
      flowData,
      status: 'draft',
      createdBy: userId,
    }).returning();

    return {
      workflowId: workflow.id,
      attackFlowId: flow.id,
      taskCount: resolved.length,
      techniques: resolved.map(t => ({
        attackId: t.attackId,
        name: t.name,
        tacticName: t.tacticName,
        toolCount: t.toolIds.length,
      })),
    };
  }

  /**
   * Get tools mapped to a specific ATT&CK technique
   */
  async getToolsForTechnique(attackId: string): Promise<Array<{
    toolId: string;
    name: string;
    category: string;
  }>> {
    const [technique] = await db
      .select({ id: attackTechniques.id })
      .from(attackTechniques)
      .where(eq(attackTechniques.attackId, attackId))
      .limit(1);

    if (!technique) return [];

    const tools = await db
      .select({
        toolId: toolRegistry.id,
        name: toolRegistry.name,
        category: toolRegistry.category,
      })
      .from(toolRegistryTechniques)
      .innerJoin(toolRegistry, eq(toolRegistryTechniques.toolId, toolRegistry.id))
      .where(eq(toolRegistryTechniques.techniqueId, technique.id));

    return tools;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async resolveTechniques(attackIds: string[]): Promise<ResolvedTechnique[]> {
    // Fetch techniques
    const techniques = await db
      .select({
        id: attackTechniques.id,
        attackId: attackTechniques.attackId,
        name: attackTechniques.name,
      })
      .from(attackTechniques)
      .where(inArray(attackTechniques.attackId, attackIds));

    if (techniques.length === 0) return [];

    const resolved: ResolvedTechnique[] = [];

    for (const tech of techniques) {
      // Get tactic for this technique
      const [mapping] = await db
        .select({
          tacticId: attackTactics.id,
          tacticName: attackTactics.name,
          tacticShortname: attackTactics.xMitreShortname,
        })
        .from(attackTechniqueTactics)
        .innerJoin(attackTactics, eq(attackTechniqueTactics.tacticId, attackTactics.id))
        .where(eq(attackTechniqueTactics.techniqueId, tech.id))
        .limit(1);

      const tacticShortname = mapping?.tacticShortname || 'reconnaissance';

      resolved.push({
        id: tech.id,
        attackId: tech.attackId,
        name: tech.name,
        tacticId: mapping?.tacticId || '',
        tacticName: mapping?.tacticName || 'Unknown',
        tacticShortname,
        killChainOrder: KILL_CHAIN_ORDER[tacticShortname] || 99,
        toolIds: [],
        toolNames: [],
      });
    }

    return resolved;
  }

  private async mapToolsToTechniques(techniques: ResolvedTechnique[]): Promise<void> {
    for (const tech of techniques) {
      const tools = await db
        .select({
          toolId: toolRegistry.id,
          toolName: toolRegistry.name,
        })
        .from(toolRegistryTechniques)
        .innerJoin(toolRegistry, eq(toolRegistryTechniques.toolId, toolRegistry.id))
        .where(eq(toolRegistryTechniques.techniqueId, tech.id));

      tech.toolIds = tools.map(t => t.toolId);
      tech.toolNames = tools.map(t => t.toolName);
    }
  }

  private async getDefaultAgentId(): Promise<string> {
    // Look for an existing operator-type agent
    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.type, 'task'))
      .limit(1);

    if (agent) return agent.id;

    // Fallback: use any agent
    const [fallback] = await db
      .select({ id: agents.id })
      .from(agents)
      .limit(1);

    if (fallback) return fallback.id;

    throw new Error('No agents found in database for workflow task assignment');
  }

  private buildFlowData(techniques: ResolvedTechnique[]): {
    nodes: any[];
    edges: any[];
  } {
    const nodes = techniques.map((tech, i) => ({
      id: `node-${tech.attackId}`,
      type: 'technique',
      position: { x: 250, y: i * 150 + 50 },
      data: {
        label: `${tech.attackId}: ${tech.name}`,
        techniqueId: tech.id,
        attackId: tech.attackId,
        tacticName: tech.tacticName,
        toolIds: tech.toolIds,
        toolNames: tech.toolNames,
        killChainOrder: tech.killChainOrder,
      },
    }));

    const edges = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `edge-${nodes[i].id}-${nodes[i + 1].id}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        animated: true,
      });
    }

    return { nodes, edges };
  }
}

export const attackWorkflowBuilder = new AttackWorkflowBuilder();
