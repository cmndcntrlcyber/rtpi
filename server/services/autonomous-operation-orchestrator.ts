/**
 * Autonomous Operation Orchestrator (v2.4 Phase 4)
 *
 * Bridges System 1 (Autonomous Operation System) and System 2
 * (Technical Operation System) to execute operations end-to-end
 * with minimal human intervention.
 *
 * Flow:
 *   1. Operation approved → Review Agent parses scope, generates tasks
 *   2. Operation Lead Agent delegates tasks to technical agents
 *   3. Technical Reviewer validates findings (contrarian approach)
 *   4. QA Agent checks report quality (up to 3 iterations)
 *   5. Technical Writer generates final report
 *   6. Operation marked complete, awaiting human confirmation
 */

import { EventEmitter } from 'events';
import { db } from '../db';
import { operations, agentWorkflows, workflowTasks } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { reviewAgent } from './agents/review-agent';
import { operationLeadAgent } from './agents/operation-lead-agent';
import { technicalReviewerAgent } from './agents/technical-reviewer-agent';
import { qaAgent } from './agents/qa-agent';
import { technicalWriterAgent } from './agents/technical-writer-agent';

// ============================================================================
// Types
// ============================================================================

export interface AutonomousExecutionResult {
  operationId: string;
  success: boolean;
  phases: {
    review: { success: boolean; taskCount: number; error?: string };
    execution: { success: boolean; completed: number; failed: number; error?: string };
    validation: { success: boolean; confirmed: number; falsePositives: number; error?: string };
    qa: { success: boolean; iterations: number; passed: boolean; error?: string };
    reporting: { success: boolean; error?: string };
  };
  totalDurationMs: number;
}

// ============================================================================
// Autonomous Operation Orchestrator
// ============================================================================

class AutonomousOperationOrchestrator extends EventEmitter {
  private activeOperations: Map<string, AbortController> = new Map();
  private readonly MAX_QA_ITERATIONS = 3;

  /**
   * Execute an operation autonomously through all phases
   */
  async executeOperation(operationId: string): Promise<AutonomousExecutionResult> {
    const startTime = Date.now();

    if (this.activeOperations.has(operationId)) {
      throw new Error(`Operation ${operationId} is already executing autonomously`);
    }

    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);

    const result: AutonomousExecutionResult = {
      operationId,
      success: false,
      phases: {
        review: { success: false, taskCount: 0 },
        execution: { success: false, completed: 0, failed: 0 },
        validation: { success: false, confirmed: 0, falsePositives: 0 },
        qa: { success: false, iterations: 0, passed: false },
        reporting: { success: false },
      },
      totalDurationMs: 0,
    };

    try {
      // Update operation status
      await db.update(operations)
        .set({ status: 'in_progress' })
        .where(eq(operations.id, operationId));

      this.emit('operation_started', { operationId });

      // ── Phase 1: Review ──────────────────────────────────────────────
      console.log(`[Autonomous] Phase 1: Reviewing operation ${operationId}`);
      await this.initializeAgent(reviewAgent);

      const reviewResult = await reviewAgent.executeTask({
        taskType: 'review_operation',
        taskName: `Review Operation ${operationId}`,
        operationId,
        parameters: { operationId },
      });

      result.phases.review = {
        success: reviewResult.success,
        taskCount: reviewResult.data?.taskCount || 0,
        error: reviewResult.error,
      };

      if (!reviewResult.success || !reviewResult.data?.generatedTasks?.length) {
        throw new Error(`Review phase failed: ${reviewResult.error || 'No tasks generated'}`);
      }

      this.emit('phase_completed', { operationId, phase: 'review', result: reviewResult });

      // ── Phase 2: Technical Execution ─────────────────────────────────
      console.log(`[Autonomous] Phase 2: Executing ${result.phases.review.taskCount} tasks`);
      await this.initializeAgent(operationLeadAgent);

      const executionResult = await operationLeadAgent.executeTask({
        taskType: 'execute_operation_tasks',
        taskName: `Execute Tasks for ${operationId}`,
        operationId,
        parameters: {
          operationId,
          taskSpecs: reviewResult.data.generatedTasks,
        },
      });

      result.phases.execution = {
        success: executionResult.success,
        completed: executionResult.data?.completed || 0,
        failed: executionResult.data?.failed || 0,
        error: executionResult.error,
      };

      this.emit('phase_completed', { operationId, phase: 'execution', result: executionResult });

      // ── Phase 3: Technical Review (Contrarian) ───────────────────────
      console.log(`[Autonomous] Phase 3: Reviewing findings with contrarian approach`);
      await this.initializeAgent(technicalReviewerAgent);

      const validationResult = await technicalReviewerAgent.executeTask({
        taskType: 'review_findings',
        taskName: `Validate Findings for ${operationId}`,
        operationId,
        parameters: { operationId },
      });

      result.phases.validation = {
        success: validationResult.success,
        confirmed: validationResult.data?.confirmed || 0,
        falsePositives: validationResult.data?.falsePositives || 0,
        error: validationResult.error,
      };

      this.emit('phase_completed', { operationId, phase: 'validation', result: validationResult });

      // ── Phase 4: QA Loop (up to 3 iterations) ───────────────────────
      console.log(`[Autonomous] Phase 4: QA validation (max ${this.MAX_QA_ITERATIONS} iterations)`);
      await this.initializeAgent(qaAgent);

      let qaIterations = 0;
      let qaPassed = false;

      while (qaIterations < this.MAX_QA_ITERATIONS && !qaPassed) {
        qaIterations++;
        console.log(`[Autonomous] QA iteration ${qaIterations}/${this.MAX_QA_ITERATIONS}`);

        const qaResult = await qaAgent.executeTask({
          taskType: 'check_report_quality',
          taskName: `QA Check #${qaIterations} for ${operationId}`,
          operationId,
          parameters: { operationId, iteration: qaIterations },
        });

        if (qaResult.success && qaResult.data?.quality !== 'poor') {
          qaPassed = true;
        }
      }

      result.phases.qa = {
        success: true,
        iterations: qaIterations,
        passed: qaPassed,
      };

      this.emit('phase_completed', { operationId, phase: 'qa', iterations: qaIterations });

      // ── Phase 5: Final Report ────────────────────────────────────────
      console.log(`[Autonomous] Phase 5: Generating final report`);
      await this.initializeAgent(technicalWriterAgent);

      const reportResult = await technicalWriterAgent.executeTask({
        taskType: 'generate_report',
        taskName: `Final Report for ${operationId}`,
        operationId,
        parameters: { operationId, includeValidation: true },
      });

      result.phases.reporting = {
        success: reportResult.success,
        error: reportResult.error,
      };

      this.emit('phase_completed', { operationId, phase: 'reporting', result: reportResult });

      // ── Mark Operation Complete ──────────────────────────────────────
      result.success = true;

      await db.update(operations)
        .set({ status: 'completed' })
        .where(eq(operations.id, operationId));

      this.emit('operation_completed', {
        operationId,
        phases: result.phases,
        durationMs: Date.now() - startTime,
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Autonomous] Operation ${operationId} failed:`, msg);

      await db.update(operations)
        .set({ status: 'failed' })
        .where(eq(operations.id, operationId));

      this.emit('operation_failed', { operationId, error: msg });
    } finally {
      this.activeOperations.delete(operationId);
      result.totalDurationMs = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Cancel an autonomous operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    const controller = this.activeOperations.get(operationId);
    if (!controller) return false;

    controller.abort();
    this.activeOperations.delete(operationId);

    await db.update(operations)
      .set({ status: 'cancelled' })
      .where(eq(operations.id, operationId));

    return true;
  }

  isExecuting(operationId: string): boolean {
    return this.activeOperations.has(operationId);
  }

  get activeOperationCount(): number {
    return this.activeOperations.size;
  }

  private async initializeAgent(agent: { isInitialized: boolean; initialize: () => Promise<void> }): Promise<void> {
    if (!agent.isInitialized) {
      await agent.initialize();
    }
  }
}

export const autonomousOperationOrchestrator = new AutonomousOperationOrchestrator();
