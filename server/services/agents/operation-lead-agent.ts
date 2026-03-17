/**
 * Operation Lead Agent (v2.4 Phase 4 - System 2)
 *
 * Coordinates the Technical Operation System. Receives task specifications
 * from System 1, delegates to Technical Operator agents (web-hacker, rd-team,
 * tool-connector), collects results, and routes to Technical Reviewer for
 * validation before passing to Technical Writer.
 */

import { BaseTaskAgent, TaskDefinition, TaskResult } from './base-task-agent';
import { webHackerAgent } from './web-hacker-agent';
import { rdTeamAgent } from './rd-team-agent';
import { toolConnectorAgent } from './tool-connector-agent';
import { surfaceAssessmentAgent } from './surface-assessment-agent';
import type { OperationTaskSpec } from './review-agent';

// ============================================================================
// Operation Lead Agent
// ============================================================================

class OperationLeadAgent extends BaseTaskAgent {
  constructor() {
    super(
      'Operation Lead Agent',
      'operation_lead',
      ['task_coordination', 'agent_delegation', 'result_aggregation']
    );
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    await this.updateStatus('running');

    try {
      switch (task.taskType) {
        case 'execute_operation_tasks':
          return await this.executeOperationTasks(task);
        case 'execute_single_task':
          return await this.executeSingleTask(task);
        default:
          return { success: false, error: `Unknown task type: ${task.taskType}` };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    } finally {
      await this.updateStatus('idle');
    }
  }

  /**
   * Execute a batch of operation tasks sequentially
   */
  private async executeOperationTasks(task: TaskDefinition): Promise<TaskResult> {
    const { operationId, taskSpecs } = task.parameters as {
      operationId: string;
      taskSpecs: OperationTaskSpec[];
    };

    if (!taskSpecs || taskSpecs.length === 0) {
      return { success: false, error: 'No task specifications provided' };
    }

    const results: Array<{ taskName: string; success: boolean; data?: any; error?: string }> = [];
    let completedCount = 0;

    // Execute tasks in priority order
    const sortedTasks = [...taskSpecs].sort((a, b) => a.priority - b.priority);

    for (const spec of sortedTasks) {
      const result = await this.delegateTask(spec, operationId);
      results.push({
        taskName: spec.taskName,
        success: result.success,
        data: result.data,
        error: result.error,
      });

      if (result.success) completedCount++;

      // Report progress
      await this.reportProgress(
        task.id || '',
        Math.round((results.length / sortedTasks.length) * 100),
        `Completed ${results.length}/${sortedTasks.length}: ${spec.taskName}`
      );
    }

    return {
      success: completedCount > 0,
      data: {
        operationId,
        totalTasks: sortedTasks.length,
        completed: completedCount,
        failed: sortedTasks.length - completedCount,
        results,
      },
    };
  }

  /**
   * Execute a single operation task
   */
  private async executeSingleTask(task: TaskDefinition): Promise<TaskResult> {
    const spec = task.parameters as OperationTaskSpec;
    return this.delegateTask(spec, task.operationId || '');
  }

  /**
   * Delegate a task spec to the appropriate technical agent
   */
  private async delegateTask(
    spec: OperationTaskSpec,
    operationId: string
  ): Promise<TaskResult> {
    const agent = this.selectAgent(spec);

    if (!agent.isInitialized) {
      await agent.initialize();
    }

    // Map task spec to agent-specific task definition
    const agentTask: TaskDefinition = {
      taskType: this.mapTaskType(spec),
      taskName: spec.taskName,
      description: spec.description,
      operationId,
      targetId: spec.targetId,
      parameters: {
        ...spec.parameters,
        tools: spec.estimatedTools,
        techniques: spec.attackTechniques,
      },
    };

    try {
      const result = await agent.executeTask(agentTask);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Delegation failed';
      return { success: false, error: `${spec.taskName}: ${msg}` };
    }
  }

  /**
   * Select the best agent for a given task type
   */
  private selectAgent(spec: OperationTaskSpec): BaseTaskAgent {
    switch (spec.taskType) {
      case 'reconnaissance':
        return surfaceAssessmentAgent;
      case 'vulnerability_scan':
        return webHackerAgent;
      case 'exploitation':
        return rdTeamAgent;
      case 'post_exploitation':
        return toolConnectorAgent;
      case 'reporting':
        return toolConnectorAgent; // Technical writer handles this upstream
      default:
        return toolConnectorAgent;
    }
  }

  /**
   * Map operation task types to agent-specific task types
   */
  private mapTaskType(spec: OperationTaskSpec): string {
    switch (spec.taskType) {
      case 'reconnaissance':
        return 'surface_scan';
      case 'vulnerability_scan':
        return 'web_scan';
      case 'exploitation':
        return 'exploit_research';
      case 'post_exploitation':
        return 'execute_tool';
      case 'reporting':
        return 'execute_tool';
      default:
        return 'execute_tool';
    }
  }
}

export const operationLeadAgent = new OperationLeadAgent();
