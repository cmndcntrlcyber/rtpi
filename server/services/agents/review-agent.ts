/**
 * Review Agent (v2.4 Phase 4 - System 1)
 *
 * Parses approved operation data, determines required tasks,
 * and generates task specifications for the Task Agent to delegate
 * to the Technical Operation System.
 */

import { BaseTaskAgent, TaskDefinition, TaskResult } from './base-task-agent';
import { db } from '../../db';
import { operations, targets, vulnerabilities } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { ollamaAIClient } from '../ollama-ai-client';

// ============================================================================
// Types
// ============================================================================

export interface OperationTaskSpec {
  taskType: 'reconnaissance' | 'vulnerability_scan' | 'exploitation' | 'post_exploitation' | 'reporting';
  taskName: string;
  description: string;
  priority: number; // 1-5, 1 = highest
  targetId?: string;
  parameters: Record<string, any>;
  estimatedTools: string[];
  attackTechniques: string[];
}

// ============================================================================
// Review Agent
// ============================================================================

class ReviewAgent extends BaseTaskAgent {
  constructor() {
    super(
      'Review Agent',
      'review_agent',
      ['operation_review', 'task_generation', 'scope_analysis']
    );
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    await this.updateStatus('running');

    try {
      switch (task.taskType) {
        case 'review_operation':
          return await this.reviewOperation(task);
        case 'generate_tasks':
          return await this.generateTasks(task);
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

  private async reviewOperation(task: TaskDefinition): Promise<TaskResult> {
    const { operationId } = task.parameters;

    // Fetch operation details
    const [operation] = await db
      .select()
      .from(operations)
      .where(eq(operations.id, operationId))
      .limit(1);

    if (!operation) {
      return { success: false, error: `Operation ${operationId} not found` };
    }

    // Fetch associated targets
    const operationTargets = await db
      .select()
      .from(targets)
      .where(eq(targets.operationId, operationId));

    // Fetch existing vulnerabilities
    const existingVulns = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.operationId, operationId));

    // Analyze scope and generate task breakdown
    const taskSpecs = await this.analyzeAndGenerateTasks(
      operation,
      operationTargets,
      existingVulns
    );

    return {
      success: true,
      data: {
        operationId,
        operationName: operation.name,
        targetCount: operationTargets.length,
        existingVulnCount: existingVulns.length,
        generatedTasks: taskSpecs,
        taskCount: taskSpecs.length,
      },
    };
  }

  private async generateTasks(task: TaskDefinition): Promise<TaskResult> {
    return this.reviewOperation(task);
  }

  private async analyzeAndGenerateTasks(
    operation: any,
    operationTargets: any[],
    existingVulns: any[]
  ): Promise<OperationTaskSpec[]> {
    const tasks: OperationTaskSpec[] = [];

    // Phase 1: Reconnaissance for each target
    for (const target of operationTargets) {
      tasks.push({
        taskType: 'reconnaissance',
        taskName: `Recon: ${target.name || target.value}`,
        description: `Perform reconnaissance on ${target.type} target: ${target.value}`,
        priority: 1,
        targetId: target.id,
        parameters: { targetType: target.type, targetValue: target.value },
        estimatedTools: ['nmap', 'bbot', 'nuclei'],
        attackTechniques: ['T1595', 'T1046'],
      });
    }

    // Phase 2: Vulnerability scanning
    for (const target of operationTargets) {
      tasks.push({
        taskType: 'vulnerability_scan',
        taskName: `Vuln Scan: ${target.name || target.value}`,
        description: `Run vulnerability scans against ${target.value}`,
        priority: 2,
        targetId: target.id,
        parameters: { targetType: target.type, targetValue: target.value },
        estimatedTools: ['nuclei', 'nikto', 'dalfox'],
        attackTechniques: ['T1190', 'T1210'],
      });
    }

    // Phase 3: Exploitation (if vulnerabilities exist or scope permits)
    if (existingVulns.length > 0 || operation.metadata?.scope?.includes('exploitation')) {
      for (const vuln of existingVulns.filter(v => v.severity === 'critical' || v.severity === 'high')) {
        tasks.push({
          taskType: 'exploitation',
          taskName: `Exploit: ${vuln.title}`,
          description: `Attempt exploitation of ${vuln.title} (${vuln.severity})`,
          priority: 3,
          parameters: { vulnerabilityId: vuln.id, cveId: vuln.cveId },
          estimatedTools: ['metasploit', 'custom-exploit'],
          attackTechniques: ['T1190', 'T1059'],
        });
      }
    }

    // Phase 4: Reporting
    tasks.push({
      taskType: 'reporting',
      taskName: `Final Report: ${operation.name}`,
      description: `Generate comprehensive penetration test report for operation ${operation.name}`,
      priority: 5,
      parameters: { operationId: operation.id },
      estimatedTools: ['report-generator'],
      attackTechniques: [],
    });

    // Use AI to refine task breakdown if available
    try {
      const aiRefinement = await this.refineWithAI(operation, operationTargets, tasks);
      if (aiRefinement) {
        return aiRefinement;
      }
    } catch {
      // Fall back to rule-based tasks
    }

    return tasks;
  }

  private async refineWithAI(
    operation: any,
    targets: any[],
    baseTasks: OperationTaskSpec[]
  ): Promise<OperationTaskSpec[] | null> {
    const response = await ollamaAIClient.complete(
      [
        {
          role: 'system',
          content: `You are a penetration test planning assistant. Review the operation scope and refine the task breakdown.
Output ONLY valid JSON array of task objects with fields: taskType, taskName, description, priority (1-5), estimatedTools (string[]), attackTechniques (string[]).
Do not include any text outside the JSON array.`,
        },
        {
          role: 'user',
          content: `Operation: ${operation.name}
Description: ${operation.description || 'N/A'}
Targets: ${targets.map(t => `${t.type}: ${t.value}`).join(', ')}
Current task count: ${baseTasks.length}
Current tasks: ${baseTasks.map(t => t.taskName).join(', ')}

Refine this task list. Add missing tasks or remove redundant ones.`,
        },
      ],
      { temperature: 0.3, maxTokens: 2048 }
    );

    try {
      const parsed = JSON.parse(response.content || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t: any) => ({
          taskType: t.taskType || 'reconnaissance',
          taskName: t.taskName || 'Unnamed task',
          description: t.description || '',
          priority: t.priority || 3,
          parameters: {},
          estimatedTools: t.estimatedTools || [],
          attackTechniques: t.attackTechniques || [],
        }));
      }
    } catch {
      // AI output wasn't valid JSON, use base tasks
    }

    return null;
  }
}

export const reviewAgent = new ReviewAgent();
