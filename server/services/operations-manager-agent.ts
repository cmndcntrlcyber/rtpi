import { db } from "../db";
import {
  reporters,
  reporterQuestions,
  reporterTasks,
  agents,
  operations,
} from "@shared/schema";
import { eq, and, desc, inArray, isNull, count } from "drizzle-orm";
import { EventEmitter } from "events";
import { reporterAgentService } from "./reporter-agent-service";
import { agentLoopService, LoopExecution } from "./agent-tool-connector";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Initialize AI clients
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

interface QuestionWithReporter {
  question: typeof reporterQuestions.$inferSelect;
  reporter: typeof reporters.$inferSelect | null;
}

interface GeneratedTask {
  taskName: string;
  taskDescription: string;
  taskType: string;
  instructions: string;
  parameters: Record<string, any>;
  priority: number;
}

interface OpsManagerStatus {
  isActive: boolean;
  pendingQuestions: number;
  activeReporters: number;
  totalTasksAssigned: number;
  activeLoops: number;
}

interface LoopTerminationDecision {
  terminate: boolean;
  reason: string;
}

class OperationsManagerAgent extends EventEmitter {
  private isActive = false;
  private questionProcessingInterval: NodeJS.Timeout | null = null;
  private loopMonitoringInterval: NodeJS.Timeout | null = null;
  private readonly QUESTION_CHECK_INTERVAL_MS = 10000; // 10 seconds
  private readonly LOOP_CHECK_INTERVAL_MS = 30000; // 30 seconds

  constructor() {
    super();

    // Listen for reporter events
    reporterAgentService.on("question_submitted", (data) => {
      this.emit("new_question", data);
    });

    reporterAgentService.on("data_changed", (data) => {
      this.handleDataChange(data);
    });
  }

  /**
   * Start the Operations Manager
   */
  async start(): Promise<void> {
    if (this.isActive) return;

    console.log("[OpsManager] Starting Operations Manager Agent...");
    this.isActive = true;

    // Start periodic question processing
    this.questionProcessingInterval = setInterval(async () => {
      await this.processHighPriorityQuestions();
    }, this.QUESTION_CHECK_INTERVAL_MS);

    // Start periodic loop monitoring
    this.loopMonitoringInterval = setInterval(async () => {
      await this.evaluateActiveLoops();
    }, this.LOOP_CHECK_INTERVAL_MS);

    this.emit("started");
    console.log("[OpsManager] Operations Manager Agent started");
  }

  /**
   * Stop the Operations Manager
   */
  async stop(): Promise<void> {
    if (!this.isActive) return;

    console.log("[OpsManager] Stopping Operations Manager Agent...");
    this.isActive = false;

    if (this.questionProcessingInterval) {
      clearInterval(this.questionProcessingInterval);
      this.questionProcessingInterval = null;
    }

    if (this.loopMonitoringInterval) {
      clearInterval(this.loopMonitoringInterval);
      this.loopMonitoringInterval = null;
    }

    this.emit("stopped");
    console.log("[OpsManager] Operations Manager Agent stopped");
  }

  /**
   * Get Operations Manager status
   */
  async getStatus(): Promise<OpsManagerStatus> {
    const pendingQuestions = await db
      .select({ count: count() })
      .from(reporterQuestions)
      .where(eq(reporterQuestions.status, "pending"));

    const activeReporters = await db
      .select({ count: count() })
      .from(reporters)
      .where(eq(reporters.status, "active"));

    const totalTasks = await db
      .select({ count: count() })
      .from(reporterTasks);

    const activeLoops = agentLoopService.getActiveLoops()
      .filter(loop => loop.status === "running").length;

    return {
      isActive: this.isActive,
      pendingQuestions: pendingQuestions[0]?.count || 0,
      activeReporters: activeReporters[0]?.count || 0,
      totalTasksAssigned: totalTasks[0]?.count || 0,
      activeLoops,
    };
  }

  /**
   * Request current status data from a reporter
   */
  async requestReporterStatus(reporterId: string): Promise<Record<string, any> | null> {
    const data = await reporterAgentService.releaseData(reporterId);
    return data;
  }

  /**
   * Get pending questions queue
   */
  async getPendingQuestions(operationId?: string): Promise<QuestionWithReporter[]> {
    let query = db
      .select()
      .from(reporterQuestions)
      .where(eq(reporterQuestions.status, "pending"))
      .orderBy(desc(reporterQuestions.priority), desc(reporterQuestions.createdAt));

    if (operationId) {
      query = query.where(eq(reporterQuestions.operationId, operationId)) as typeof query;
    }

    const questions = await query;

    // Enrich with reporter data
    const enrichedQuestions: QuestionWithReporter[] = [];
    for (const question of questions) {
      const [reporter] = await db
        .select()
        .from(reporters)
        .where(eq(reporters.id, question.reporterId))
        .limit(1);

      enrichedQuestions.push({
        question,
        reporter: reporter || null,
      });
    }

    return enrichedQuestions;
  }

  /**
   * Respond to a question and optionally generate a task
   */
  async respondToQuestion(
    questionId: string,
    response: string,
    userId: string,
    generateTask: boolean = false
  ): Promise<{ question: any; task?: any }> {
    const [updatedQuestion] = await db
      .update(reporterQuestions)
      .set({
        response,
        respondedBy: userId,
        respondedAt: new Date(),
        status: "answered",
        updatedAt: new Date(),
      })
      .where(eq(reporterQuestions.id, questionId))
      .returning();

    if (!updatedQuestion) {
      throw new Error("Question not found");
    }

    let task = null;

    if (generateTask) {
      const generatedTask = await this.generateTaskFromResponse(updatedQuestion, response);
      if (generatedTask) {
        const taskId = await reporterAgentService.assignTask({
          reporterId: updatedQuestion.reporterId,
          taskName: generatedTask.taskName,
          taskDescription: generatedTask.taskDescription,
          taskType: generatedTask.taskType,
          instructions: generatedTask.instructions,
          parameters: generatedTask.parameters,
          priority: generatedTask.priority,
          questionId: questionId,
          assignedBy: userId,
        });

        await db
          .update(reporterQuestions)
          .set({ generatedTaskId: taskId })
          .where(eq(reporterQuestions.id, questionId));

        const [createdTask] = await db
          .select()
          .from(reporterTasks)
          .where(eq(reporterTasks.id, taskId))
          .limit(1);

        task = createdTask;
      }
    }

    this.emit("question_answered", { questionId, response, taskGenerated: !!task });
    return { question: updatedQuestion, task };
  }

  /**
   * Generate a task from AI based on response
   */
  async generateTaskFromResponse(
    question: typeof reporterQuestions.$inferSelect,
    response: string
  ): Promise<GeneratedTask | null> {
    // Fallback task generation
    return {
      taskName: "Follow-up: " + question.question.substring(0, 50),
      taskDescription: "Task generated from human response",
      taskType: "investigate",
      instructions: response,
      parameters: {},
      priority: question.priority,
    };
  }

  /**
   * Dismiss a question
   */
  async dismissQuestion(questionId: string, reason?: string): Promise<void> {
    await db
      .update(reporterQuestions)
      .set({
        status: "dismissed",
        response: reason || "Dismissed by operator",
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reporterQuestions.id, questionId));

    this.emit("question_dismissed", { questionId, reason });
  }

  /**
   * Escalate a question
   */
  async escalateQuestion(questionId: string): Promise<void> {
    await db
      .update(reporterQuestions)
      .set({
        status: "escalated",
        priority: 10,
        updatedAt: new Date(),
      })
      .where(eq(reporterQuestions.id, questionId));

    this.emit("question_escalated", { questionId });
  }

  private async processHighPriorityQuestions(): Promise<void> {
    const highPriorityQuestions = await db
      .select()
      .from(reporterQuestions)
      .where(eq(reporterQuestions.status, "pending"))
      .orderBy(desc(reporterQuestions.priority))
      .limit(5);

    const urgent = highPriorityQuestions.filter(q => q.priority >= 8);

    if (urgent.length > 0) {
      this.emit("urgent_questions", { count: urgent.length, questions: urgent });
    }
  }

  private handleDataChange(data: any): void {
    if (data.changes?.length >= 3) {
      this.emit("significant_data_change", {
        reporterId: data.reporterId,
        changeCount: data.changes.length,
        changes: data.changes,
      });
    }
  }

  /**
   * Get question analytics
   */
  async getQuestionAnalytics(operationId?: string): Promise<any> {
    let query = db.select().from(reporterQuestions);

    if (operationId) {
      query = query.where(eq(reporterQuestions.operationId, operationId)) as typeof query;
    }

    const questions = await query;

    return {
      total: questions.length,
      pending: questions.filter(q => q.status === "pending").length,
      answered: questions.filter(q => q.status === "answered").length,
      dismissed: questions.filter(q => q.status === "dismissed").length,
      escalated: questions.filter(q => q.status === "escalated").length,
    };
  }

  // ==========================================
  // LOOP MANAGEMENT CAPABILITIES
  // ==========================================

  /**
   * Get all active agent loops for monitoring
   */
  getActiveLoops(): LoopExecution[] {
    return agentLoopService.getActiveLoops();
  }

  /**
   * Evaluate active loops and terminate those not progressing toward mission success
   */
  async evaluateActiveLoops(): Promise<void> {
    const activeLoops = agentLoopService.getActiveLoops()
      .filter(loop => loop.status === "running");

    if (activeLoops.length === 0) return;

    for (const loop of activeLoops) {
      const decision = await this.shouldTerminateLoop(loop);
      if (decision.terminate) {
        const success = agentLoopService.stopLoop(loop.id);
        if (success) {
          console.log(`[OpsManager] Terminated loop ${loop.id}: ${decision.reason}`);
          this.emit("loop_terminated", {
            loopId: loop.id,
            reason: decision.reason,
            iterations: loop.currentIteration,
            automatic: true
          });
        }
      }
    }
  }

  /**
   * Determine if a loop should be terminated based on progress analysis
   */
  private async shouldTerminateLoop(loop: LoopExecution): Promise<LoopTerminationDecision> {
    // Check for approaching max iterations without exit condition progress
    if (loop.currentIteration >= loop.maxIterations * 0.8) {
      return {
        terminate: true,
        reason: `Approaching max iterations (${loop.currentIteration}/${loop.maxIterations}) without achieving exit condition`
      };
    }

    // Check for stagnant output patterns (similar outputs repeated)
    if (loop.iterations.length >= 3) {
      const recent = loop.iterations.slice(-3);
      const outputs = recent.map(i => i.output.toLowerCase().substring(0, 200));
      if (outputs[0] === outputs[1] && outputs[1] === outputs[2]) {
        return {
          terminate: true,
          reason: "Detected repeating outputs - agents stuck in non-productive loop"
        };
      }
    }

    // Check elapsed time vs expected progress rate
    const elapsedMs = Date.now() - loop.startedAt.getTime();
    const elapsedMinutes = elapsedMs / 60000;
    if (elapsedMinutes > 0 && loop.currentIteration > 2) {
      const progressRate = loop.currentIteration / elapsedMinutes; // iterations per minute
      if (progressRate < 0.5) {
        return {
          terminate: true,
          reason: `Progress rate too slow (${progressRate.toFixed(2)} iterations/min) - loop may be stuck`
        };
      }
    }

    // Check if loop has been running too long without meaningful progress
    if (elapsedMinutes > 10 && loop.currentIteration < 3) {
      return {
        terminate: true,
        reason: `Running for ${Math.round(elapsedMinutes)} minutes with only ${loop.currentIteration} iterations`
      };
    }

    return { terminate: false, reason: "" };
  }

  /**
   * Manually terminate a specific loop with a reason
   */
  terminateLoop(loopId: string, reason: string): boolean {
    const success = agentLoopService.stopLoop(loopId);
    if (success) {
      console.log(`[OpsManager] Manually terminated loop ${loopId}: ${reason}`);
      this.emit("loop_terminated", {
        loopId,
        reason,
        manual: true
      });
    }
    return success;
  }

  /**
   * Get detailed information about a specific loop
   */
  getLoopDetails(loopId: string): LoopExecution | undefined {
    return agentLoopService.getLoop(loopId);
  }
}

export const operationsManagerAgent = new OperationsManagerAgent();
export default operationsManagerAgent;
