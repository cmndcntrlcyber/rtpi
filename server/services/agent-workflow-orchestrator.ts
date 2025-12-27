import { db } from "../db";
import {
  agentWorkflows,
  workflowTasks,
  workflowLogs,
  agents,
  targets,
  securityTools,
  reports,
  empireServers,
  empireAgents,
  empireModules
} from "@shared/schema";
import { eq, asc } from "drizzle-orm";
import { agentToolConnector } from "./agent-tool-connector";
import { metasploitExecutor } from "./metasploit-executor";
import { empireExecutor } from "./empire-executor";
import { generateMarkdownReport } from "./report-generator";
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
      let previousAgentId: string | null = null;

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
            ...(task.inputData as any),
            previousOutput,
          };

          // Log handoff if there was a previous agent
          if (previousOutput && previousAgentId) {
            await this.log(
              workflowId,
              task.id,
              "info",
              `Received handoff from previous agent`,
              {
                previousAgentId,
                currentAgentId: task.agentId,
                dataKeys: Object.keys(previousOutput),
                hasExecutionPlan: !!previousOutput.plan,
                hasExploitationResults: !!previousOutput.attempts,
              }
            );
          }

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
              output = await this.executeOperationLead(agent, taskInput, workflowId, task.id);
              break;
            case "exploit":
              output = await this.executeSeniorCyberOperator(agent, taskInput, workflowId, task.id);
              break;
            case "report":
              output = await this.executeTechnicalWriter(agent, { ...taskInput, workflowId }, workflowId, task.id);
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
          previousAgentId = task.agentId;
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
  private async executeOperationLead(
    agent: any,
    input: any,
    workflowId: string,
    taskId: string
  ): Promise<any> {
    const targetId = input.targetId;
    const services = input.discoveredServices || [];
    const metadata = input.metadata || {};

    // Check for available Empire C2 infrastructure
    const empireInfo = await this.getEmpireInfrastructure(workflowId, taskId);

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

      await this.log(
        workflowId,
        taskId,
        "info",
        `Starting vulnerability research with SearchSploit`,
        { queriesCount: searchQueries.length }
      );

      // Execute SearchSploit for each service
      for (const query of searchQueries.slice(0, 3)) {
        try {
          await this.log(
            workflowId,
            taskId,
            "info",
            `SearchSploit query: "${query}"`,
            { tool: "SearchSploit", query }
          );

          const result = await agentToolConnector.execute(
            agent.id,
            searchSploitTool.id,
            targetId,
            `query="${query}"`
          );
          
          searchResults += `\n\n=== SearchSploit: ${query} ===\n${result}`;

          await this.log(
            workflowId,
            taskId,
            "info",
            `SearchSploit completed for: "${query}"`,
            { 
              tool: "SearchSploit",
              query,
              resultLength: result.length,
              hasResults: result.length > 100
            }
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`SearchSploit error for ${query}:`, error);
          
          await this.log(
            workflowId,
            taskId,
            "error",
            `SearchSploit failed for: "${query}"`,
            { tool: "SearchSploit", query, error: errorMsg }
          );
        }
      }
    }

    // Use GPT-5 to analyze and create execution plan
    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    await this.log(
      workflowId,
      taskId,
      "info",
      `Analyzing target and creating execution plan`,
      { 
        model: (agent.config as any)?.model || "gpt-4o",
        targetValue: input.targetValue
      }
    );

    const prompt = this.buildOperationLeadPrompt(
      input.targetValue,
      services,
      metadata,
      searchResults,
      empireInfo
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

    await this.log(
      workflowId,
      taskId,
      "info",
      `Execution plan created`,
      {
        modulesCount: executionPlan.modules?.length || 0,
        vulnerabilitiesCount: executionPlan.vulnerabilities?.length || 0,
        hasStrategy: !!executionPlan.strategy
      }
    );

    return {
      type: "execution_plan",
      plan: executionPlan,
      rawResponse: response,
      searchResults,
      services,
      empireInfo,
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
  private async executeSeniorCyberOperator(
    agent: any,
    input: any,
    workflowId: string,
    taskId: string
  ): Promise<any> {
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

    const modulesToExecute = Math.min(executionPlan.metasploitModules?.length || 0, maxAttempts);

    await this.log(
      workflowId,
      taskId,
      "info",
      `Starting Metasploit exploitation attempts`,
      {
        modulesPlanned: executionPlan.metasploitModules?.length || 0,
        modulesToExecute,
        empireTasksPlanned: executionPlan.empireTasks?.length || 0,
        targetValue: target.value
      }
    );

    // Execute Metasploit modules from plan
    for (let i = 0; i < modulesToExecute; i++) {
      const module = executionPlan.metasploitModules[i];

      await this.log(
        workflowId,
        taskId,
        "info",
        `Executing module ${i + 1}/${modulesToExecute}: ${module.type}/${module.path}`,
        {
          module: module.path,
          type: module.type,
          priority: module.priority,
          reasoning: module.reasoning,
          progress: Math.round(((i + 1) / modulesToExecute) * 100)
        }
      );

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

        await this.log(
          workflowId,
          taskId,
          result.success ? "info" : "warning",
          `Module execution ${result.success ? "succeeded" : "failed"}: ${module.type}/${module.path}`,
          {
            module: module.path,
            success: result.success,
            exitCode: result.exitCode,
            duration: result.duration,
            outputLength: result.output?.length || 0,
            hasOutput: !!result.output
          }
        );

        // Analyze result with Claude Sonnet 4.5
        if (this.anthropic) {
          const analysis = await this.analyzeExploitationResult(
            agent,
            result,
            attempts
          );

          await this.log(
            workflowId,
            taskId,
            "info",
            `AI analysis: ${analysis.success ? "Exploitation successful" : "Continue testing"}`,
            {
              analysisSuccess: analysis.success,
              reasoning: analysis.reasoning
            }
          );

          if (analysis.success) {
            successfulExploit = true;
            
            await this.log(
              workflowId,
              taskId,
              "info",
              `Successful exploitation achieved`,
              {
                module: module.path,
                attempt: i + 1,
                totalAttempts: attempts.length
              }
            );
            
            break;
          }
        } else {
          // Fallback: Check for success indicators
          if (
            result.output.includes("session opened") ||
            result.output.includes("meterpreter")
          ) {
            successfulExploit = true;
            
            await this.log(
              workflowId,
              taskId,
              "info",
              `Successful exploitation detected (pattern match)`,
              {
                module: module.path,
                attempt: i + 1
              }
            );
            
            break;
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        attempts.push({
          module: `${module.type}/${module.path}`,
          success: false,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        });

        await this.log(
          workflowId,
          taskId,
          "error",
          `Module execution error: ${module.type}/${module.path}`,
          {
            module: module.path,
            error: errorMsg
          }
        );
      }
    }

    await this.log(
      workflowId,
      taskId,
      "info",
      `Metasploit exploitation phase completed`,
      {
        totalAttempts: attempts.length,
        successfulExploits: attempts.filter(a => a.success).length,
        overallSuccess: successfulExploit
      }
    );

    // Execute Empire C2 tasks if present
    const empireResults = await this.executeEmpireTasks(
      executionPlan.empireTasks || [],
      input.previousOutput?.empireInfo,
      workflowId,
      taskId
    );

    return {
      type: "exploitation_results",
      success: successfulExploit || empireResults.success,
      attempts,
      empireResults,
      targetId: target.id,
      targetValue: target.value,
    };
  }

  /**
   * Technical Writer: Generate penetration test report
   */
  private async executeTechnicalWriter(
    agent: any,
    input: any,
    workflowId: string,
    taskId: string
  ): Promise<any> {
    const exploitationResults = input.previousOutput;

    if (!exploitationResults) {
      throw new Error("No exploitation results received from Senior Cyber Operator");
    }

    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    await this.log(
      workflowId,
      taskId,
      "info",
      `Generating penetration test report`,
      {
        model: (agent.config as any)?.model || "gpt-4o",
        targetValue: exploitationResults.targetValue,
        successfulExploitation: exploitationResults.success,
        attemptsCount: exploitationResults.attempts?.length || 0
      }
    );

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

    await this.log(
      workflowId,
      taskId,
      "info",
      `Report generated successfully`,
      {
        reportLength: reportContent.length,
        hasContent: reportContent.length > 0
      }
    );

    // Get workflow details for operationId and createdBy
    const workflow = await db
      .select()
      .from(agentWorkflows)
      .where(eq(agentWorkflows.id, workflowId))
      .limit(1)
      .then((rows) => rows[0]);

    // Auto-create report in database with actual file
    if (workflow && reportContent) {
      try {
        const target = await db
          .select()
          .from(targets)
          .where(eq(targets.id, exploitationResults.targetId))
          .limit(1)
          .then((rows) => rows[0]);

        const reportName = `Penetration Test - ${target?.name || "Target"}`;

        // Generate the markdown file on disk
        const fileData = await generateMarkdownReport({
          name: reportName,
          type: "network_penetration_test",
          format: "markdown",
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
        });

        // Insert report with file path
        await db.insert(reports).values({
          name: reportName,
          type: "network_penetration_test",
          status: "completed",
          format: "markdown",
          operationId: workflow.operationId || null,
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
          filePath: fileData.filePath,
          fileSize: fileData.fileSize,
          generatedBy: workflow.createdBy,
        });

        await this.log(
          workflowId,
          taskId,
          "info",
          `Report saved to database and file system`,
          {
            filePath: fileData.filePath,
            fileSize: fileData.fileSize,
            reportName
          }
        );

        console.log(`Auto-created report for workflow ${workflow.id} with file: ${fileData.filePath}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        await this.log(
          workflowId,
          taskId,
          "error",
          `Failed to save report to database`,
          { error: errorMsg }
        );
        
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
    searchResults: string,
    empireInfo: any
  ): string {
    // Build Empire infrastructure section
    let empireSection = "";
    if (empireInfo.available) {
      empireSection = `

**Empire C2 Infrastructure Available:**
- Servers: ${empireInfo.servers.length}
- Active Agents: ${empireInfo.agents.length}
${empireInfo.agents.length > 0 ? `
**Available Empire Agents:**
${empireInfo.agents.slice(0, 5).map((a: any) => `- ${a.name} (${a.hostname}) - ${a.username}@${a.internalIp} - ${a.language} ${a.highIntegrity ? '[HIGH INTEGRITY]' : ''}`).join("\n")}
${empireInfo.agents.length > 5 ? `... and ${empireInfo.agents.length - 5} more` : ''}
` : ''}
${empireInfo.modules.length > 0 ? `
**Sample Empire Modules Available:**
${empireInfo.modules.slice(0, 10).map((m: any) => `- ${m.name} (${m.category}): ${m.description}`).join("\n")}
${empireInfo.modules.length > 10 ? `... and ${empireInfo.modules.length - 10} more modules` : ''}
` : ''}

**Note:** You can use existing Empire agents for post-exploitation or choose Metasploit for initial access.`;
    }

    return `You are analyzing target "${targetValue}" for penetration testing.

**Target Information:**
- Value: ${targetValue}
- OS: ${metadata.os || "Unknown"}
- Open Ports: ${metadata.openPorts?.join(", ") || "Unknown"}

**Discovered Services:**
${services.map((s) => `- Port ${s.port}/${s.protocol}: ${s.service} ${s.version || ""}`).join("\n")}

**SearchSploit Results:**
${searchResults || "No exploit database results available"}
${empireSection}

**Task:** Create a detailed execution plan for exploiting this target. You can use Metasploit for exploitation and/or Empire C2 agents for post-exploitation tasks.

Provide your response in the following JSON format:
{
  "targetId": "${targetValue}",
  "vulnerabilities": ["list of identified vulnerabilities"],
  "metasploitModules": [
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
  "empireTasks": [
    {
      "priority": 2,
      "agentName": "agent name from available agents",
      "taskType": "shell or module",
      "command": "command to execute or module name",
      "parameters": {},
      "reasoning": "why this task"
    }
  ],
  "strategy": "overall exploitation and post-exploitation strategy"
}

**Important:**
- Use "metasploitModules" for initial access and exploitation
- Use "empireTasks" for post-exploitation on existing agents (lateral movement, privilege escalation, credential harvesting)
- Both arrays can be empty if not applicable
- Empire tasks should only be used if agents are available`;
  }

  /**
   * Parse execution plan from AI response
   */
  private parseExecutionPlan(response: string): any {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Normalize format: support both old "modules" and new "metasploitModules"
        if (parsed.modules && !parsed.metasploitModules) {
          parsed.metasploitModules = parsed.modules;
        }

        // Ensure empireTasks exists
        if (!parsed.empireTasks) {
          parsed.empireTasks = [];
        }

        return parsed;
      }
    } catch (error) {
      console.error("Failed to parse execution plan:", error);
    }

    // Fallback: Return basic plan
    return {
      targetId: "",
      vulnerabilities: [],
      metasploitModules: [],
      empireTasks: [],
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
    // Build Empire section if results exist
    let empireSection = "";
    if (exploitationResults.empireResults && exploitationResults.empireResults.tasks?.length > 0) {
      empireSection = `

**Empire C2 Post-Exploitation:**
${exploitationResults.empireResults.tasks
  .map(
    (t: any, i: number) =>
      `${i + 1}. ${t.task} (Agent: ${t.agentName}) - ${t.success ? "SUCCESS" : "FAILED"}`
  )
  .join("\n")}

**Empire Task Details:**
${exploitationResults.empireResults.tasks
  .map(
    (t: any) =>
      `\n### ${t.task} on ${t.agentName}\n${t.output || t.error || "No output"}`
  )
  .join("\n")}

${exploitationResults.empireResults.credentials?.length > 0 ? `
**Credentials Harvested:** ${exploitationResults.empireResults.credentials.length}
${exploitationResults.empireResults.credentials
  .slice(0, 10)
  .map((c: any) => `- ${c.username} (${c.credType})`)
  .join("\n")}
${exploitationResults.empireResults.credentials.length > 10 ? `... and ${exploitationResults.empireResults.credentials.length - 10} more` : ''}
` : ''}`;
    }

    return `Create a professional Network Penetration Test report based on these findings:

**Target:** ${exploitationResults.targetValue}
**Overall Success:** ${exploitationResults.success ? "Yes" : "No"}

**Metasploit Exploitation Attempts:**
${exploitationResults.attempts
  .map(
    (a: any, i: number) =>
      `${i + 1}. ${a.module} - ${a.success ? "SUCCESS" : "FAILED"}`
  )
  .join("\n")}

**Metasploit Detailed Output:**
${exploitationResults.attempts
  .map(
    (a: any) =>
      `\n### ${a.module}\n${a.output || a.error || "No output"}`
  )
  .join("\n")}
${empireSection}

Create a comprehensive penetration test report with:
1. Executive Summary
2. Technical Details (include both Metasploit and Empire C2 operations)
3. Findings and Vulnerabilities
4. Post-Exploitation Activities (if Empire was used)
5. Credentials Obtained (if any)
6. Recommendations
7. Conclusion

**Note:** Include Empire C2 post-exploitation activities in a dedicated section if they were performed.

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
   * Execute Empire C2 tasks from execution plan
   */
  private async executeEmpireTasks(
    empireTasks: any[],
    empireInfo: any,
    workflowId: string,
    taskId: string
  ): Promise<any> {
    if (!empireTasks || empireTasks.length === 0) {
      await this.log(
        workflowId,
        taskId,
        "info",
        "No Empire tasks to execute"
      );
      return { success: false, tasks: [], credentials: [] };
    }

    if (!empireInfo || !empireInfo.available) {
      await this.log(
        workflowId,
        taskId,
        "warning",
        "Empire tasks planned but no Empire infrastructure available"
      );
      return { success: false, tasks: [], credentials: [] };
    }

    await this.log(
      workflowId,
      taskId,
      "info",
      `Starting Empire C2 post-exploitation tasks`,
      { tasksPlanned: empireTasks.length }
    );

    const taskResults: any[] = [];
    let successfulTasks = 0;

    // Get first available Empire server
    const server = empireInfo.servers[0];
    if (!server) {
      await this.log(workflowId, taskId, "error", "No Empire server available");
      return { success: false, tasks: [], credentials: [] };
    }

    // Execute each Empire task
    for (let i = 0; i < Math.min(empireTasks.length, 10); i++) {
      const task = empireTasks[i];

      await this.log(
        workflowId,
        taskId,
        "info",
        `Executing Empire task ${i + 1}/${empireTasks.length}: ${task.taskType} on ${task.agentName}`,
        {
          agentName: task.agentName,
          taskType: task.taskType,
          reasoning: task.reasoning
        }
      );

      try {
        let result;

        if (task.taskType === "shell") {
          // Execute shell command
          result = await empireExecutor.executeTask(
            server.id,
            'system', // TODO: Get actual user ID from context
            {
              agentName: task.agentName,
              command: task.command
            }
          );
        } else if (task.taskType === "module") {
          // Execute Empire module
          result = await empireExecutor.executeModule(
            server.id,
            'system',
            task.agentName,
            task.command, // Module name
            task.parameters || {}
          );
        } else {
          throw new Error(`Unknown Empire task type: ${task.taskType}`);
        }

        const taskSuccess = result.success && !result.error;
        if (taskSuccess) {
          successfulTasks++;
        }

        taskResults.push({
          task: `${task.taskType}: ${task.command}`,
          agentName: task.agentName,
          success: taskSuccess,
          output: result.data,
          error: result.error,
          timestamp: new Date().toISOString(),
        });

        await this.log(
          workflowId,
          taskId,
          taskSuccess ? "info" : "warning",
          `Empire task ${taskSuccess ? "succeeded" : "failed"}: ${task.taskType} on ${task.agentName}`,
          {
            task: task.command,
            success: taskSuccess,
            hasOutput: !!result.data
          }
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        taskResults.push({
          task: `${task.taskType}: ${task.command}`,
          agentName: task.agentName,
          success: false,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        });

        await this.log(
          workflowId,
          taskId,
          "error",
          `Empire task execution error: ${task.command}`,
          {
            agentName: task.agentName,
            error: errorMsg
          }
        );
      }
    }

    // Fetch credentials harvested during execution
    let credentials: any[] = [];
    try {
      const credsResult = await empireExecutor.syncCredentials(server.id, 'system');
      if (credsResult.success && credsResult.data) {
        credentials = credsResult.data;
      }
    } catch (error) {
      console.error("Failed to fetch Empire credentials:", error);
    }

    await this.log(
      workflowId,
      taskId,
      "info",
      `Empire C2 tasks completed`,
      {
        totalTasks: taskResults.length,
        successfulTasks,
        credentialsHarvested: credentials.length
      }
    );

    return {
      success: successfulTasks > 0,
      tasks: taskResults,
      credentials,
    };
  }

  /**
   * Get available Empire C2 infrastructure
   */
  private async getEmpireInfrastructure(workflowId: string, taskId: string): Promise<any> {
    try {
      // Get connected Empire servers
      const servers = await db
        .select()
        .from(empireServers)
        .where(eq(empireServers.status, "connected"));

      if (servers.length === 0) {
        await this.log(
          workflowId,
          taskId,
          "info",
          "No Empire C2 servers available"
        );
        return { available: false, servers: [], agents: [], modules: [] };
      }

      await this.log(
        workflowId,
        taskId,
        "info",
        `Found ${servers.length} connected Empire server(s)`,
        { serverCount: servers.length }
      );

      // Get active agents from Empire
      const agents = await db
        .select()
        .from(empireAgents)
        .where(eq(empireAgents.checkinTime, empireAgents.checkinTime)); // Get all agents

      // Get available modules (sample for context)
      const modules = await db
        .select()
        .from(empireModules)
        .limit(50); // Limit to avoid overwhelming the prompt

      await this.log(
        workflowId,
        taskId,
        "info",
        `Empire infrastructure: ${agents.length} agent(s), ${modules.length} module(s)`,
        { agentCount: agents.length, moduleCount: modules.length }
      );

      return {
        available: true,
        servers: servers.map(s => ({
          id: s.id,
          name: s.name,
          url: s.restApiUrl
        })),
        agents: agents.map(a => ({
          id: a.id,
          name: a.name,
          hostname: a.hostname,
          internalIp: a.internalIp,
          externalIp: a.externalIp,
          username: a.username,
          highIntegrity: a.highIntegrity,
          os: a.osDetails,
          language: a.language
        })),
        modules: modules.map(m => ({
          name: m.moduleName,
          category: m.category,
          description: m.description
        }))
      };
    } catch (error) {
      console.error("Failed to get Empire infrastructure:", error);
      await this.log(
        workflowId,
        taskId,
        "error",
        "Failed to query Empire infrastructure",
        { error: error instanceof Error ? error.message : String(error) }
      );
      return { available: false, servers: [], agents: [], modules: [] };
    }
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
