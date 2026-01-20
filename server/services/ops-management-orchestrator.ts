import { db } from "../db";
import {
  agentWorkflows,
  workflowTasks,
  workflowLogs,
  agents,
  operations,
} from "../../shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { pageReporterAgent } from "./page-reporter-agent";
import { operationsManagerAgent } from "./operations-manager-agent";

/**
 * Operations Management Orchestrator
 *
 * Orchestrates hourly Operations Management workflows:
 * 1. Create workflow with 20+ reporter tasks (parallel) + 1 manager task (sequential)
 * 2. Execute all reporter agents in parallel
 * 3. Execute operations manager to synthesize reports and make decisions
 */
class OpsManagementOrchestrator {
  /**
   * Start a new Operations Management workflow
   *
   * @param operationId - ID of the operation to manage
   * @param workflowName - Name for the workflow
   * @returns Created workflow
   */
  async startOpsManagementWorkflow(
    operationId: string,
    workflowName: string
  ): Promise<typeof agentWorkflows.$inferSelect> {
    console.log(`🚀 [OpsManagementOrchestrator] Starting workflow for operation ${operationId}`);

    try {
      // Verify operation exists
      const operation = await db
        .select()
        .from(operations)
        .where(eq(operations.id, operationId))
        .limit(1);

      if (operation.length === 0) {
        throw new Error(`Operation ${operationId} not found`);
      }

      // Get all page reporter agents
      const reporterAgents = await this.getPageReporterAgents();
      console.log(`📊 [OpsManagementOrchestrator] Found ${reporterAgents.length} reporter agents`);

      // Get operations manager agent
      const managerAgent = await this.getOperationsManagerAgent();
      if (!managerAgent) {
        throw new Error("Operations Manager agent not found");
      }

      // Create workflow
      const workflow = await db
        .insert(agentWorkflows)
        .values({
          name: workflowName,
          workflowType: "ops_management_hourly",
          operationId,
          status: "pending",
          progress: 0,
          metadata: {
            reportingPeriod: new Date().toISOString(),
            reporterCount: reporterAgents.length,
          },
          createdBy: operation[0].ownerId,
        })
        .returning();

      const createdWorkflow = workflow[0];

      console.log(`✅ [OpsManagementOrchestrator] Created workflow ${createdWorkflow.id}`);

      // Create reporter tasks (all parallel, sequence 1-N)
      const reporterTasks = reporterAgents.map((agent, idx) => ({
        workflowId: createdWorkflow.id,
        agentId: agent.id,
        taskType: "custom" as const,
        taskName: `Reporter: ${agent.name}`,
        sequenceOrder: idx + 1,
        status: "pending" as const,
        inputData: {
          operationId,
          reportingPeriod: new Date().toISOString(),
          pageRole: agent.config?.pageRole || "unknown",
        },
      }));

      // Create manager task (sequential after all reporters)
      const managerTask = {
        workflowId: createdWorkflow.id,
        agentId: managerAgent.id,
        taskType: "custom" as const,
        taskName: "Operations Manager Synthesis",
        sequenceOrder: reporterAgents.length + 1,
        status: "pending" as const,
        inputData: {
          operationId,
          reportingPeriod: new Date().toISOString(),
          reporterTaskIds: [], // Will be populated after reporter tasks are created
        },
      };

      // Insert all tasks
      const allTasks = [...reporterTasks, managerTask];
      const createdTasks = await db.insert(workflowTasks).values(allTasks).returning();

      console.log(`✅ [OpsManagementOrchestrator] Created ${createdTasks.length} tasks`);

      // Update manager task with reporter task IDs
      const reporterTaskIds = createdTasks
        .slice(0, reporterAgents.length)
        .map((task) => task.id);

      await db
        .update(workflowTasks)
        .set({
          inputData: {
            operationId,
            reportingPeriod: new Date().toISOString(),
            reporterTaskIds,
          },
        })
        .where(eq(workflowTasks.id, createdTasks[createdTasks.length - 1].id));

      // Log workflow start
      await this.logWorkflow(createdWorkflow.id, "info", "Workflow created and ready to execute");

      // Start workflow execution asynchronously
      this.processWorkflow(createdWorkflow.id).catch((error) => {
        console.error(
          `❌ [OpsManagementOrchestrator] Error processing workflow ${createdWorkflow.id}:`,
          error
        );
      });

      return createdWorkflow;
    } catch (error) {
      console.error(
        `❌ [OpsManagementOrchestrator] Failed to start workflow:`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Process a workflow
   * Executes all reporter agents in parallel, then the operations manager
   */
  private async processWorkflow(workflowId: string): Promise<void> {
    console.log(`⚙️  [OpsManagementOrchestrator] Processing workflow ${workflowId}`);

    try {
      // Update workflow status to running
      await db
        .update(agentWorkflows)
        .set({
          status: "running",
          startedAt: new Date(),
          currentTaskId: null,
        })
        .where(eq(agentWorkflows.id, workflowId));

      await this.logWorkflow(workflowId, "info", "Workflow execution started");

      // Get all tasks
      const tasks = await db
        .select()
        .from(workflowTasks)
        .where(eq(workflowTasks.workflowId, workflowId))
        .orderBy(asc(workflowTasks.sequenceOrder));

      if (tasks.length === 0) {
        throw new Error("No tasks found for workflow");
      }

      // Separate reporter tasks and manager task
      const reporterTasks = tasks.slice(0, -1);
      const managerTask = tasks[tasks.length - 1];

      console.log(
        `📋 [OpsManagementOrchestrator] Executing ${reporterTasks.length} reporter tasks in parallel`
      );

      // Execute all reporter agents in parallel
      const reporterResults = await Promise.allSettled(
        reporterTasks.map((task) => this.executeReporterTask(workflowId, task))
      );

      // Count successes and failures
      const successCount = reporterResults.filter((r) => r.status === "fulfilled").length;
      const failureCount = reporterResults.filter((r) => r.status === "rejected").length;

      console.log(
        `📊 [OpsManagementOrchestrator] Reporter execution complete: ${successCount} succeeded, ${failureCount} failed`
      );

      await this.logWorkflow(
        workflowId,
        failureCount > 0 ? "warning" : "info",
        `Reporter agents completed: ${successCount}/${reporterTasks.length} succeeded`
      );

      // Update workflow progress
      const reporterProgress = Math.round((successCount / reporterTasks.length) * 80); // Reporters = 80% of total progress
      await db
        .update(agentWorkflows)
        .set({ progress: reporterProgress })
        .where(eq(agentWorkflows.id, workflowId));

      // Continue with manager even if some reporters failed (graceful degradation)
      if (successCount === 0) {
        throw new Error("All reporter agents failed, cannot proceed with synthesis");
      }

      // Execute operations manager
      console.log(`🧠 [OpsManagementOrchestrator] Executing Operations Manager task`);

      await this.executeManagerTask(workflowId, managerTask);

      // Mark workflow as completed
      await db
        .update(agentWorkflows)
        .set({
          status: "completed",
          progress: 100,
          completedAt: new Date(),
        })
        .where(eq(agentWorkflows.id, workflowId));

      await this.logWorkflow(workflowId, "info", "Workflow completed successfully");

      console.log(`✅ [OpsManagementOrchestrator] Workflow ${workflowId} completed successfully`);
    } catch (error) {
      console.error(
        `❌ [OpsManagementOrchestrator] Workflow ${workflowId} failed:`,
        error instanceof Error ? error.message : error
      );

      // Mark workflow as failed
      await db
        .update(agentWorkflows)
        .set({
          status: "failed",
          completedAt: new Date(),
        })
        .where(eq(agentWorkflows.id, workflowId));

      await this.logWorkflow(
        workflowId,
        "error",
        `Workflow failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );

      throw error;
    }
  }

  /**
   * Execute a reporter task
   */
  private async executeReporterTask(
    workflowId: string,
    task: typeof workflowTasks.$inferSelect
  ): Promise<void> {
    console.log(`📝 [OpsManagementOrchestrator] Executing reporter task ${task.id}: ${task.taskName}`);

    try {
      // Update task status
      await db
        .update(workflowTasks)
        .set({
          status: "in_progress",
          startedAt: new Date(),
        })
        .where(eq(workflowTasks.id, task.id));

      // Execute reporter agent
      const result = await pageReporterAgent.executeReporter(
        task.agentId,
        task.inputData.operationId,
        new Date(task.inputData.reportingPeriod)
      );

      // Update task with results
      await db
        .update(workflowTasks)
        .set({
          status: "completed",
          completedAt: new Date(),
          outputData: result,
        })
        .where(eq(workflowTasks.id, task.id));

      console.log(`✅ [OpsManagementOrchestrator] Reporter task ${task.id} completed`);
    } catch (error) {
      console.error(
        `❌ [OpsManagementOrchestrator] Reporter task ${task.id} failed:`,
        error instanceof Error ? error.message : error
      );

      // Update task as failed
      await db
        .update(workflowTasks)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(workflowTasks.id, task.id));

      throw error;
    }
  }

  /**
   * Execute the operations manager task
   */
  private async executeManagerTask(
    workflowId: string,
    task: typeof workflowTasks.$inferSelect
  ): Promise<void> {
    console.log(`🧠 [OpsManagementOrchestrator] Executing manager task ${task.id}`);

    try {
      // Update task status
      await db
        .update(workflowTasks)
        .set({
          status: "in_progress",
          startedAt: new Date(),
        })
        .where(eq(workflowTasks.id, task.id));

      // Execute operations manager
      const result = await operationsManagerAgent.executeOperationsManager(
        task.inputData.operationId,
        task.inputData.reporterTaskIds
      );

      // Update task with results
      await db
        .update(workflowTasks)
        .set({
          status: "completed",
          completedAt: new Date(),
          outputData: result,
        })
        .where(eq(workflowTasks.id, task.id));

      console.log(`✅ [OpsManagementOrchestrator] Manager task ${task.id} completed`);
    } catch (error) {
      console.error(
        `❌ [OpsManagementOrchestrator] Manager task ${task.id} failed:`,
        error instanceof Error ? error.message : error
      );

      // Update task as failed
      await db
        .update(workflowTasks)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(workflowTasks.id, task.id));

      throw error;
    }
  }

  /**
   * Get all page reporter agents
   */
  private async getPageReporterAgents(): Promise<typeof agents.$inferSelect[]> {
    // Get agents with config.role = 'page_reporter'
    const allAgents = await db.select().from(agents);

    return allAgents.filter((agent) => {
      const config = agent.config as any;
      return config?.role === "page_reporter";
    });
  }

  /**
   * Get the operations manager agent
   */
  private async getOperationsManagerAgent(): Promise<typeof agents.$inferSelect | null> {
    const allAgents = await db.select().from(agents);

    const manager = allAgents.find((agent) => {
      const config = agent.config as any;
      return config?.role === "operations_manager";
    });

    return manager || null;
  }

  /**
   * Log a workflow event
   */
  private async logWorkflow(
    workflowId: string,
    level: string,
    message: string,
    context?: any
  ): Promise<void> {
    await db.insert(workflowLogs).values({
      workflowId,
      level,
      message,
      context: context || {},
    });
  }
}

// Singleton instance
export const opsManagementOrchestrator = new OpsManagementOrchestrator();
