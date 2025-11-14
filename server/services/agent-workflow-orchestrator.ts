import { db } from "../db";
import { 
  agentWorkflows, 
  workflowTasks, 
  workflowLogs, 
  agents, 
  targets, 
  securityTools,
  reports 
} from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { agentToolConnector } from "./agent-tool-connector";
import { metasploitExecutor } from "./metasploit-executor";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Agent Workflow Orchestrator
 * Manages multi-agent workflows with database queue system
 */
export class AgentWorkflowOrchestrator {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    // Initialize AI clients if API keys are available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  /**
   * Start a new penetration test workflow
   */
  async startPenetrationTestWorkflow(
    targetId: string,
    userId: string,
    operationId?: string
  ): Promise<any> {
    try {
      // Get target details
      const target = await db
        .select()
        .from(targets)
        .where(eq(targets.id, targetId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!target) {
        throw new Error("Target not found");
      }

      // Get all three agents
      const allAgents = await db.select().from(agents);
      const operationLead = allAgents.find((a) => a.name === "Operation Lead");
      const seniorCyberOperator = allAgents.find(
        (a) => a.name === "Senior Cyber Operator"
      );
      const technicalWriter = allAgents.find(
        (a) => a.name === "Technical Writer"
      );

      if (!operationLead || !seniorCyberOperator || !technicalWriter) {
        throw new Error(
          "Required agents not found. Ensure Operation Lead, Senior Cyber Operator, and Technical Writer agents exist."
        );
      }

      // Create workflow instance
      const workflow = await db
        .insert(agentWorkflows)
        .values({
          name: `Penetration Test - ${target.name}`,
          workflowType: "penetration_test",
          targetId: target.id,
          operationId: operationId || target.operationId,
          currentAgentId: operationLead.id,
          status: "pending",
          progress: 0,
          metadata: {
            targetName: target.name,
            targetValue: target.value,
          },
          createdBy: userId,
        })
        .returning();

      const workflowId = workflow[0].id;

      // Create task queue: Operation Lead → Senior Cyber Operator → Technical Writer
      const tasks = [
        {
          workflowId,
          agentId: operationLead.id,
          taskType: "analyze" as const,
          taskName: "Analyze target and create execution plan",
          sequenceOrder: 1,
          inputData: {
            targetId: target.id,
            targetValue: target.value,
            discoveredServices: target.discoveredServices,
            metadata: target.metadata,
          },
        },
        {
          workflowId,
          agentId: seniorCyberOperator.id,
          taskType: "exploit" as const,
          taskName: "Execute exploitation attempts",
          sequenceOrder: 2,
          inputData: {}, // Will be populated by Operation Lead's output
        },
        {
          workflowId,
          agentId: technicalWriter.id,
          taskType: "report" as const,
          taskName: "Generate penetration test report",
          sequenceOrder: 3,
          inputData: {}, // Will be populated by Senior Cyber Operator's output
        },
      ];

      await db.insert(workflowTasks).values(tasks);

      // Log workflow start
      await this.log(workflowId, null, "info", "Workflow started", {
        target: target.name,
        agents: [operationLead.name, seniorCyberOperator.name, technicalWriter.name],
      });

      // Start processing in background
      this.processWorkflow(workflowId).catch((error) => {
        console.error("Workflow processing error:", error);
      });

      return {
        workflow: workflow[0],
        tasks: await db
          .select()
          .from(workflowTasks)
          .where(eq(workflowTasks.workflowId, workflowId))
          .orderBy(asc(workflowTasks.sequenceOrder)),
      };
    } catch (error) {
      console.error("Failed to start workflow:", error);
      throw error;
    }
  }

  /**
   * Process workflow - execute tasks in sequence
   */
  private async processWorkflow(workflowId: string): Promise<void> {
    try {
      // Update workflow status to running
      await db
        .update(agentWorkflows)
        .set({
          status: "running",
          startedAt: new Date(),
          progress: 0,
        })
        .where(eq(agentWorkflows.id, workflowId));

      // Get all tasks in order
      const tasks = await db
        .select()
        .from(workflowTasks)
        .where(eq(workflowTasks.workflowId, workflowId))
        .orderBy(asc(workflowTasks.sequenceOrder));

      let previousOutput: any = null;

      for (const task of tasks) {
        try {
          // Update task to in_progress
          await db
            .update(workflowTasks)
            .set({
              status: "in_progress",
              startedAt: new Date(),
            })
            .where(eq(workflowTasks.id, task.id));

          // Update workflow current task
          await db
            .update(agentWorkflows)
            .set({
              currentTaskId: task.id,
              currentAgentId: task.agentId,
              progress: Math.round((task.sequenceOrder / tasks.length) * 100),
            })
            .where(eq(agentWorkflows.id, workflowId));

          await this.log(
            workflowId,
            task.id,
            "info",
            `Starting task: ${task.taskName}`,
            { agentId: task.agentId }
          );

          // Merge previous output into current task input
          const taskInput = {
            ...task.inputData,
            previousOutput,
          };

          // Execute task based on type and agent
          const agent = await db
            .select()
            .from(agents)
            .where(eq(agents.id, task.agentId))
            .limit(1)
            .then((rows) => rows[0]);

          let output: any;

          switch (task.taskType) {
            case "analyze":
              output = await this.executeOperationLead(agent, taskInput);
              break;
            case "exploit":
              output = await this.executeSeniorCyberOperator(agent, taskInput);
              break;
            case "report":
              output = await this.executeTechnicalWriter(agent, { ...taskInput, workflowId });
              break;
            default:
              throw new Error(`Unknown task type: ${task.taskType}`);
          }

          // Update task with output
          await db
            .update(workflowTasks)
            .set({
              status: "completed",
              outputData: output,
              completedAt: new Date(),
            })
            .where(eq(workflowTasks.id, task.id));

          await this.log(
            workflowId,
            task.id,
            "info",
            `Task completed: ${task.taskName}`,
            { success: true }
          );

          // Store output for next task
          previousOutput = output;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          
          await db
            .update(workflowTasks)
            .set({
              status: "failed",
              errorMessage: errorMsg,
              completedAt: new Date(),
            })
            .where(eq(workflowTasks.id, task.id));

          await this.log(
            workflowId,
            task.id,
            "error",
            `Task failed: ${task.taskName}`,
            { error: errorMsg }
          );

          throw error;
        }
      }

      // Workflow completed successfully
      await db
        .update(agentWorkflows)
        .set({
          status: "completed",
          progress: 100,
          completedAt: new Date(),
        })
        .where(eq(agentWorkflows.id, workflowId));

      await this.log(workflowId, null, "info", "Workflow completed successfully");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      await db
        .update(agentWorkflows)
        .set({
          status: "failed",
          completedAt: new Date(),
        })
        .where(eq(agentWorkflows.id, workflowId));

      await this.log(workflowId, null, "error", "Workflow failed", {
        error: errorMsg,
      });

      throw error;
    }
  }

  /**
   * Operation Lead: Analyze target and create execution plan
   */
  private async executeOperationLead(agent: any, input: any): Promise<any> {
    const targetId = input.targetId;
    const services = input.discoveredServices || [];
    const metadata = input.metadata || {};

    // Get SearchSploit tool
    const searchSploitTool = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.name, "SearchSploit"))
      .limit(1)
      .then((rows) => rows[0]);

    let searchResults = "";

    if (searchSploitTool) {
      // Build search query from services
      const searchQueries = services
        .map((s: any) => `${s.service} ${s.version || ""}`.trim())
        .filter((q: string) => q.length > 0);

      // Execute SearchSploit for each service
      for (const query of searchQueries.slice(0, 3)) {
        try {
          const result = await agentToolConnector.execute(
            agent.id,
            searchSploitTool.id,
            targetId,
            `query="${query}"`
          );
          searchResults += `\n\n=== SearchSploit: ${query} ===\n${result}`;
        } catch (error) {
          console.error(`SearchSploit error for ${query}:`, error);
        }
      }
    }

    // Use GPT-5 to analyze and create execution plan
    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    const prompt = this.buildOperationLeadPrompt(
      input.targetValue,
      services,
      metadata,
      searchResults
    );

    const completion = await this.openai.chat.completions.create({
      model: (agent.config as any)?.model || "gpt-4o",
      messages: [
        {
          role: "system",
          content: (agent.config as any)?.systemPrompt || 
            "You are an experienced penetration tester creating attack plans.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || "";

    // Parse execution plan from response
    const executionPlan = this.parseExecutionPlan(response);

    return {
      type: "execution_plan",
      plan: executionPlan,
      rawResponse: response,
      searchResults,
      services,
      metadata: {
        ...metadata,
        targetId: input.targetId, // Pass the UUID through metadata
        targetValue: input.targetValue, // Pass the IP for reference
      },
    };
  }

  /**
   * Senior Cyber Operator: Execute Metasploit modules iteratively
   */
  private async executeSeniorCyberOperator(agent: any, input: any): Promise<any> {
    const executionPlan = input.previousOutput?.plan;
    
    if (!executionPlan) {
      throw new Error("No execution plan received from Operation Lead");
    }

    // Get targetId from original input (UUID), not from plan (which has IP value)
    const targetId = input.previousOutput?.metadata?.targetId || input.targetId;
    
    if (!targetId) {
      throw new Error("Target ID not found in workflow input");
    }

    // Get target details
    const target = await db
      .select()
      .from(targets)
      .where(eq(targets.id, targetId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!target) {
      throw new Error(`Target not found with ID: ${targetId}`);
    }

    // Get Metasploit tool
    const metasploitTool = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.name, "Metasploit Framework"))
      .limit(1)
      .then((rows) => rows[0]);

    if (!metasploitTool) {
      throw new Error("Metasploit Framework tool not found");
    }

    const attempts: any[] = [];
    const maxAttempts = 5;
    let successfulExploit = false;

    // Execute modules from plan
    for (let i = 0; i < Math.min(executionPlan.modules?.length || 0, maxAttempts); i++) {
      const module = executionPlan.modules[i];

      try {
        const result = await metasploitExecutor.execute(
          metasploitTool.id,
          {
            type: module.type || "exploit",
            path: module.path,
            parameters: module.parameters || {},
          },
          target.value
        );

        attempts.push({
          module: `${module.type}/${module.path}`,
          success: result.success,
          output: result.output,
          timestamp: new Date().toISOString(),
        });

        // Analyze result with Claude Sonnet 4.5
        if (this.anthropic) {
          const analysis = await this.analyzeExploitationResult(
            agent,
            result,
            attempts
          );

          if (analysis.success) {
            successfulExploit = true;
            break;
          }
        } else {
          // Fallback: Check for success indicators
          if (
            result.output.includes("session opened") ||
            result.output.includes("meterpreter")
          ) {
            successfulExploit = true;
            break;
          }
        }
      } catch (error) {
        attempts.push({
          module: `${module.type}/${module.path}`,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }
    }

    return {
      type: "exploitation_results",
      success: successfulExploit,
      attempts,
      targetId: target.id,
      targetValue: target.value,
    };
  }

  /**
   * Technical Writer: Generate penetration test report
   */
  private async executeTechnicalWriter(agent: any, input: any): Promise<any> {
    const exploitationResults = input.previousOutput;
    const workflowId = input.workflowId;

    if (!exploitationResults) {
      throw new Error("No exploitation results received from Senior Cyber Operator");
    }

    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    const prompt = this.buildReportPrompt(exploitationResults);

    const completion = await this.openai.chat.completions.create({
      model: (agent.config as any)?.model || "gpt-4o",
      messages: [
        {
          role: "system",
          content: (agent.config as any)?.systemPrompt || 
            "You are a technical writer creating professional penetration test reports.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const reportContent = completion.choices[0]?.message?.content || "";

    // Get workflow details for operationId and createdBy
    const workflow = await db
      .select()
      .from(agentWorkflows)
      .where(eq(agentWorkflows.id, workflowId))
      .limit(1)
      .then((rows) => rows[0]);

    // Auto-create report in database
    if (workflow && reportContent) {
      try {
        const target = await db
          .select()
          .from(targets)
          .where(eq(targets.id, exploitationResults.targetId))
          .limit(1)
          .then((rows) => rows[0]);

        await db.insert(reports).values({
          name: `Penetration Test - ${target?.name || "Target"}`,
          type: "network_penetration_test",
          status: "completed",
          format: "markdown",
          operationId: workflow.operationId,
          content: {
            markdown: reportContent,
            workflowId: workflow.id,
            target: {
              id: exploitationResults.targetId,
              value: exploitationResults.targetValue,
            },
            executionSummary: {
              success: exploitationResults.success,
              attempts: exploitationResults.attempts?.length || 0,
              completedAt: new Date().toISOString(),
            },
          },
          generatedBy: workflow.createdBy,
        });

        console.log(`Auto-created report for workflow ${workflow.id}`);
      } catch (error) {
        console.error("Failed to auto-create report:", error);
        // Don't throw - report creation failure shouldn't fail the workflow
      }
    }

    return {
      type: "report",
      report: reportContent,
      format: "markdown",
      exploitationResults,
    };
  }

  /**
   * Build prompt for Operation Lead
   */
  private buildOperationLeadPrompt(
    targetValue: string,
    services: any[],
    metadata: any,
    searchResults: string
  ): string {
    return `You are analyzing target "${targetValue}" for penetration testing.

**Target Information:**
- Value: ${targetValue}
- OS: ${metadata.os || "Unknown"}
- Open Ports: ${metadata.openPorts?.join(", ") || "Unknown"}

**Discovered Services:**
${services.map((s) => `- Port ${s.port}/${s.protocol}: ${s.service} ${s.version || ""}`).join("\n")}

**SearchSploit Results:**
${searchResults || "No exploit database results available"}

**Task:** Create a detailed execution plan for exploiting this target using Metasploit.

Provide your response in the following JSON format:
{
  "targetId": "${targetValue}",
  "vulnerabilities": ["list of identified vulnerabilities"],
  "modules": [
    {
      "priority": 1,
      "type": "exploit or auxiliary",
      "path": "metasploit/module/path",
      "parameters": {
        "LHOST": "attacker IP if needed",
        "LPORT": "port if needed",
        "PAYLOAD": "payload if needed"
      },
      "reasoning": "why this module"
    }
  ],
  "strategy": "overall exploitation strategy"
}`;
  }

  /**
   * Parse execution plan from AI response
   */
  private parseExecutionPlan(response: string): any {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Failed to parse execution plan:", error);
    }

    // Fallback: Return basic plan
    return {
      targetId: "",
      vulnerabilities: [],
      modules: [],
      strategy: response,
    };
  }

  /**
   * Analyze exploitation result with Claude
   */
  private async analyzeExploitationResult(
    agent: any,
    result: any,
    attempts: any[]
  ): Promise<{ success: boolean; reasoning: string }> {
    if (!this.anthropic) {
      return { success: false, reasoning: "Anthropic API not configured" };
    }

    const prompt = `Analyze this Metasploit execution result:

**Output:**
${result.output}

**Previous Attempts:** ${attempts.length}

**Question:** Was this exploitation attempt successful? Look for indicators like:
- "session opened"
- "meterpreter"
- "shell spawned"
- "exploit completed successfully"

Respond with JSON: {"success": true/false, "reasoning": "brief explanation"}`;

    const message = await this.anthropic.messages.create({
      model: (agent.config as any)?.model || "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type === "text") {
      try {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (error) {
        console.error("Failed to parse analysis:", error);
      }
    }

    return { success: false, reasoning: "Unable to determine success" };
  }

  /**
   * Build prompt for Technical Writer
   */
  private buildReportPrompt(exploitationResults: any): string {
    return `Create a professional Network Penetration Test report based on these findings:

**Target:** ${exploitationResults.targetValue}
**Success:** ${exploitationResults.success ? "Yes" : "No"}

**Exploitation Attempts:**
${exploitationResults.attempts
  .map(
    (a: any, i: number) =>
      `${i + 1}. ${a.module} - ${a.success ? "SUCCESS" : "FAILED"}`
  )
  .join("\n")}

**Detailed Output:**
${exploitationResults.attempts
  .map(
    (a: any) =>
      `\n### ${a.module}\n${a.output || a.error || "No output"}`
  )
  .join("\n")}

Create a report with:
1. Executive Summary
2. Technical Details
3. Findings and Vulnerabilities
4. Recommendations
5. Conclusion

Format in markdown.`;
  }

  /**
   * Log workflow event
   */
  private async log(
    workflowId: string,
    taskId: string | null,
    level: string,
    message: string,
    context: any = {}
  ): Promise<void> {
    try {
      await db.insert(workflowLogs).values({
        workflowId,
        taskId,
        level,
        message,
        context,
      });
    } catch (error) {
      console.error("Failed to write workflow log:", error);
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<any> {
    const workflow = await db
      .select()
      .from(agentWorkflows)
      .where(eq(agentWorkflows.id, workflowId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!workflow) {
      return null;
    }

    const tasks = await db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.workflowId, workflowId))
      .orderBy(asc(workflowTasks.sequenceOrder));

    const logs = await db
      .select()
      .from(workflowLogs)
      .where(eq(workflowLogs.workflowId, workflowId))
      .orderBy(asc(workflowLogs.timestamp))
      .limit(100);

    return {
      workflow,
      tasks,
      logs,
    };
  }

  /**
   * Cancel workflow
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    await db
      .update(agentWorkflows)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(eq(agentWorkflows.id, workflowId));

    await this.log(workflowId, null, "info", "Workflow cancelled by user");
  }
}

export const agentWorkflowOrchestrator = new AgentWorkflowOrchestrator();
