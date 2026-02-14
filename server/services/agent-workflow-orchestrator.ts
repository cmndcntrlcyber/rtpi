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
  empireModules,
  vulnerabilities
} from "@shared/schema";
import { eq, asc } from "drizzle-orm";
import { agentToolConnector } from "./agent-tool-connector";
import { metasploitExecutor } from "./metasploit-executor";
import { empireExecutor } from "./empire-executor";
import { generateMarkdownReport } from "./report-generator";
import { ollamaAIClient } from "./ollama-ai-client";
import type { AgentConfig, AgentAIConfig } from "../../shared/types/agent-config";
import { mergeAgentAIConfig } from "../../shared/types/agent-config";
import { getAnthropicClient } from "./ai-clients";
import { randomUUID } from "crypto";

// ============================================================================
// ATTACK TREE TYPES — Recursive branching attack methodology
// ============================================================================

/**
 * Represents a single module execution node in the attack tree.
 * Auxiliary scans that discover info spawn exploit children; successful
 * exploits spawn post-exploitation children. The tree branches recursively
 * until termination conditions are met.
 */
interface AttackTreeNode {
  id: string;
  parentId: string | null;
  depth: number;
  module: {
    type: string;       // "auxiliary" | "exploit" | "post"
    path: string;
    parameters: Record<string, string>;
    reasoning: string;
  };
  execution: {
    success: boolean;
    output: string;
    stderr: string;
    exitCode: number;
    duration: number;
    timestamp: string;
  } | null;
  analysis: {
    isAuxiliaryDiscovery: boolean;
    isExploitSuccess: boolean;
    discoveredInfo: string[];
    searchQueries: string[];
    reasoning: string;
  } | null;
  children: AttackTreeNode[];
  status: "pending" | "executed" | "analyzed" | "branched" | "skipped";
}

/** Configurable limits to prevent runaway execution */
interface AttackTreeConfig {
  maxDepth: number;                    // Default: 5
  maxTotalExecutions: number;          // Default: 50
  maxChildrenPerNode: number;          // Default: 5
  maxPostExploitScans: number;         // Default: 3
  enablePostExploitBranching: boolean; // Default: true
}

/** Mutable state tracked across the entire tree execution */
interface AttackTreeState {
  totalExecutions: number;
  visitedModules: Set<string>;
  roots: AttackTreeNode[];
  allNodes: Map<string, AttackTreeNode>;
}

/**
 * Agent Workflow Orchestrator
 * Manages multi-agent workflows with database queue system
 */
export class AgentWorkflowOrchestrator {
  constructor() {
    // AI clients are now obtained via centralized getters on each call
  }

  /**
   * Get AI configuration from agent
   * Merges agent-specific config with defaults
   */
  private getAgentAIConfig(agent: any): AgentAIConfig {
    const config = agent.config as AgentConfig;
    return mergeAgentAIConfig(config?.ai);
  }

  /**
   * Call AI model using agent's configuration
   * Uses OllamaAIClient which handles provider selection and fallback
   */
  private async callAgentAI(
    agent: any,
    messages: Array<{ role: string; content: string }>,
    options?: Partial<AgentAIConfig>,
    logContext?: {
      workflowId: string;
      taskId: string | null;
      phase: string;
    }
  ): Promise<string> {
    const aiConfig = this.getAgentAIConfig(agent);
    const mergedConfig = { ...aiConfig, ...options };

    // Determine provider — default to Anthropic for reliable cloud inference
    let provider: "ollama" | "openai" | "anthropic" | undefined;
    if (mergedConfig.provider === "auto" || !mergedConfig.provider) {
      // Auto-select: prefer Anthropic, then OpenAI, then Ollama
      provider = "anthropic";
    } else {
      provider = mergedConfig.provider as any;
    }

    // Ensure model matches the selected provider (prevent Ollama model names going to cloud APIs)
    // Also set a default model when none is configured
    let model = mergedConfig.model;
    if (provider === "anthropic") {
      if (!model || model.includes(":") || model.startsWith("gpt-") || model.startsWith("llama")) {
        model = "claude-sonnet-4-5";
      }
    } else if (provider === "openai") {
      if (!model || model.includes(":") || model.startsWith("claude-") || model.startsWith("llama")) {
        model = "gpt-5.2-chat-latest";
      }
    }

    console.log(`[WorkflowOrchestrator] Calling AI: provider=${provider || "auto"}, model=${model || "default"}`);

    const startTime = Date.now();

    // Call AI
    const response = await ollamaAIClient.complete(messages as any, {
      provider,
      model,
      temperature: mergedConfig.temperature,
      maxTokens: mergedConfig.maxTokens,
      useCache: mergedConfig.useCache,
    });

    if (!response.success) {
      // Log failed AI calls
      if (logContext) {
        await this.log(logContext.workflowId, logContext.taskId, "ai_call",
          `AI Call Failed: ${logContext.phase}`, {
            type: "ai_call",
            phase: logContext.phase,
            provider: provider || "auto",
            model: model || "default",
            prompt: messages,
            response: null,
            error: response.error,
            durationMs: Date.now() - startTime,
            promptCharCount: messages.reduce((sum, m) => sum + m.content.length, 0),
          });
      }
      throw new Error(`AI completion failed: ${response.error}`);
    }

    // Log successful AI call
    if (logContext) {
      await this.log(logContext.workflowId, logContext.taskId, "ai_call",
        `AI Call: ${logContext.phase}`, {
          type: "ai_call",
          phase: logContext.phase,
          provider: provider || "auto",
          model: model || "default",
          prompt: messages,
          response: response.content,
          durationMs: Date.now() - startTime,
          promptCharCount: messages.reduce((sum, m) => sum + m.content.length, 0),
          responseCharCount: response.content.length,
        });
    }

    return response.content;
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

    // Build search queries from services (used by both SearchSploit and Tavily)
    const searchQueries = services
      .map((s: any) => `${s.service} ${s.version || ""}`.trim())
      .filter((q: string) => q.length > 0);

    if (searchSploitTool) {

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

    // Tavily vulnerability research (runs alongside SearchSploit for maximum coverage)
    let tavilyResults = "";
    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (tavilyApiKey && searchQueries.length > 0) {
      await this.log(
        workflowId,
        taskId,
        "info",
        `Starting Tavily vulnerability research`,
        { queriesCount: Math.min(searchQueries.length, 3) }
      );

      for (const query of searchQueries.slice(0, 3)) {
        try {
          const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: tavilyApiKey,
              query: `${query} CVE exploit PoC vulnerability`,
              search_depth: "advanced",
              max_results: 5,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const results = (data.results || [])
              .map((r: any) => `- ${r.title}\n  ${r.url}\n  ${r.content?.slice(0, 300) || ""}`)
              .join("\n\n");
            tavilyResults += `\n\n=== Tavily Research: ${query} ===\n${results}`;

            await this.log(workflowId, taskId, "info",
              `Tavily research completed for: "${query}"`,
              { tool: "Tavily", query, resultCount: data.results?.length || 0 }
            );
          }
        } catch (err) {
          await this.log(workflowId, taskId, "warning",
            `Tavily research failed for: "${query}"`,
            { error: err instanceof Error ? err.message : String(err) }
          );
        }
      }
    } else if (!tavilyApiKey) {
      await this.log(workflowId, taskId, "info",
        "Tavily API key not configured, skipping web vulnerability research"
      );
    }

    // Use AI to analyze and create execution plan (Ollama/OpenAI/Anthropic)
    const aiConfig = this.getAgentAIConfig(agent);

    await this.log(
      workflowId,
      taskId,
      "info",
      `Analyzing target and creating execution plan`,
      {
        provider: aiConfig.provider,
        model: aiConfig.model,
        targetValue: input.targetValue
      }
    );

    const prompt = this.buildOperationLeadPrompt(
      input.targetValue,
      services,
      metadata,
      searchResults,
      tavilyResults,
      empireInfo
    );

    const response = await this.callAgentAI(agent, [
      {
        role: "system",
        content: (agent.config as any)?.systemPrompt ||
          "You are an experienced penetration tester creating attack plans.",
      },
      { role: "user", content: prompt },
    ], undefined, {
      workflowId,
      taskId,
      phase: "Operation Lead: Execution Planning",
    });

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

    // --- ATTACK TREE INITIALIZATION ---
    const treeConfig: AttackTreeConfig = {
      maxDepth: 5,
      maxTotalExecutions: 50,
      maxChildrenPerNode: 5,
      maxPostExploitScans: 3,
      enablePostExploitBranching: true,
    };

    const treeState: AttackTreeState = {
      totalExecutions: 0,
      visitedModules: new Set<string>(),
      roots: [],
      allNodes: new Map<string, AttackTreeNode>(),
    };

    // Convert initial plan modules to root AttackTreeNodes
    const initialModules = (executionPlan.metasploitModules || []).slice(0, 5);

    for (const module of initialModules) {
      const nodeId = randomUUID();
      const rootNode: AttackTreeNode = {
        id: nodeId,
        parentId: null,
        depth: 0,
        module: {
          type: module.type || "exploit",
          path: module.path,
          parameters: module.parameters || {},
          reasoning: module.reasoning || "",
        },
        execution: null,
        analysis: null,
        children: [],
        status: "pending",
      };
      treeState.roots.push(rootNode);
      treeState.allNodes.set(nodeId, rootNode);
    }

    await this.log(workflowId, taskId, "info",
      `Starting recursive branching attack tree`,
      {
        rootModules: treeState.roots.length,
        maxDepth: treeConfig.maxDepth,
        maxExecutions: treeConfig.maxTotalExecutions,
        empireTasksPlanned: executionPlan.empireTasks?.length || 0,
        targetValue: target.value,
      }
    );

    // Execute the attack tree recursively — each successful auxiliary scan
    // will branch into up to 5 exploit modules, and successful exploits
    // will branch into post-exploitation scans, continuing until no
    // new vectors are discovered or limits are reached.
    await this.executeAttackTree(
      agent, treeState.roots, treeConfig, treeState,
      metasploitTool, target.value, workflowId, taskId
    );

    // Flatten tree for backward-compatible reporting
    const flattenedAttempts = this.flattenAttackTree(treeState.roots);
    const successfulExploit = flattenedAttempts.some(a => a.isExploitSuccess);
    const auxiliaryDiscoveries = flattenedAttempts.filter(a => a.isDiscovery).length;

    const treeStats = {
      totalExecutions: treeState.totalExecutions,
      maxDepthReached: flattenedAttempts.length > 0
        ? Math.max(...flattenedAttempts.map(a => a.depth))
        : 0,
      uniqueModules: treeState.visitedModules.size,
      branches: flattenedAttempts.filter(a => a.childCount > 0).length,
      auxiliaryDiscoveries,
    };

    await this.log(workflowId, taskId, "info",
      `Attack tree execution completed`,
      {
        ...treeStats,
        successfulExploits: flattenedAttempts.filter(a => a.isExploitSuccess).length,
        overallSuccess: successfulExploit,
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
      attempts: flattenedAttempts,
      attackTree: treeState.roots,
      treeStats,
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

    const aiConfig = this.getAgentAIConfig(agent);

    await this.log(
      workflowId,
      taskId,
      "info",
      `Generating penetration test report`,
      {
        provider: aiConfig.provider,
        model: aiConfig.model,
        targetValue: exploitationResults.targetValue,
        successfulExploitation: exploitationResults.success,
        attemptsCount: exploitationResults.attempts?.length || 0
      }
    );

    const prompt = this.buildReportPrompt(exploitationResults);

    const reportContent = await this.callAgentAI(agent, [
      {
        role: "system",
        content: (agent.config as any)?.systemPrompt ||
          "You are a technical writer creating professional penetration test reports.",
      },
      { role: "user", content: prompt },
    ], { maxTokens: 16384 }, {
      workflowId,
      taskId,
      phase: "Technical Writer: Report Generation",
    });

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

    // Auto-create vulnerability records from successful exploits and discoveries
    try {
      const vulnCount = await this.createVulnerabilitiesFromResults(
        exploitationResults,
        workflow?.operationId || null,
        workflowId,
        taskId
      );
      if (vulnCount > 0) {
        await this.log(workflowId, taskId, "info",
          `Auto-created ${vulnCount} vulnerability records from pentest results`
        );
      }
    } catch (error) {
      console.error("Failed to create vulnerability records:", error);
      // Non-fatal — don't fail the workflow
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
    tavilyResults: string,
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

**Vulnerability Research (Web):**
${tavilyResults || "No web research results available"}
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
      "path": "scanner/portscan/tcp",
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
- Empire tasks should only be used if agents are available
- For "path", provide ONLY the path after the type (e.g., "scanner/portscan/tcp", NOT "auxiliary/scanner/portscan/tcp")`;
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
    attempts: any[],
    workflowId?: string,
    taskId?: string | null
  ): Promise<{ success: boolean; reasoning: string }> {
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

    try {
      const response = await this.callAgentAI(
        agent,
        [{ role: "user", content: prompt }],
        { maxTokens: 1024 },
        workflowId ? { workflowId, taskId: taskId || null, phase: "Senior Cyber Operator: Exploit Result Analysis" } : undefined
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Failed to analyze exploitation result:", error);
    }

    return { success: false, reasoning: "Unable to determine success" };
  }

  /**
   * Analyze auxiliary module output to determine if target information was discovered.
   * Unlike analyzeExploitationResult() which checks for session/shell indicators,
   * this checks for service versions, OS fingerprints, banners, credentials, etc.
   * Returns discovered info and suggested Metasploit search queries for branching.
   */
  private async analyzeAuxiliaryResult(
    agent: any,
    result: any,
    modulePath: string,
    workflowId?: string,
    taskId?: string | null
  ): Promise<{
    isDiscovery: boolean;
    discoveredInfo: string[];
    searchQueries: string[];
    reasoning: string;
  }> {
    const prompt = `Analyze this Metasploit auxiliary module output to determine if meaningful target information was discovered.

**Module:** ${modulePath}
**Exit Code:** ${result.exitCode}
**Output:**
${(result.output || "").slice(0, 4000)}

**Question:** Did this auxiliary scan discover useful target information? Look for:
- Service versions (e.g., "Apache 2.4.49", "OpenSSH 7.2", "Samba 4.6.2")
- Operating system identification (e.g., "Windows 7 SP1", "Ubuntu 16.04")
- Service banners or fingerprints
- NetBIOS names, domain information
- Open shares, accessible resources
- Credentials or authentication details
- Protocol versions (e.g., "SMBv1", "TLS 1.0")

If information WAS discovered, also provide Metasploit search queries to find exploit modules that could validate or exploit the discovered vulnerabilities. Derive queries from the specific service names and versions found.

Respond with JSON:
{
  "isDiscovery": true/false,
  "discoveredInfo": ["list of specific facts discovered"],
  "searchQueries": ["metasploit search query 1", "metasploit search query 2"],
  "reasoning": "brief explanation of what was found or why nothing useful was found"
}

**Important for searchQueries:**
- Use service name + version as queries (e.g., "samba 4.6", "apache 2.4.49")
- Include generic service queries too (e.g., "smb", "http")
- Maximum 3 search queries
- These queries will be used with msfconsole \`search\` command`;

    try {
      const response = await this.callAgentAI(
        agent,
        [{ role: "user", content: prompt }],
        { maxTokens: 1024 },
        workflowId ? { workflowId, taskId: taskId || null, phase: "Senior Cyber Operator: Auxiliary Result Analysis" } : undefined
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isDiscovery: !!parsed.isDiscovery,
          discoveredInfo: Array.isArray(parsed.discoveredInfo) ? parsed.discoveredInfo : [],
          searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries.slice(0, 3) : [],
          reasoning: parsed.reasoning || "",
        };
      }
    } catch (error) {
      console.error("Failed to analyze auxiliary result:", error);
    }

    // Fallback: pattern-based detection
    return this.fallbackAuxiliaryAnalysis(result.output || "", modulePath);
  }

  /**
   * Fallback pattern-based auxiliary output analysis when AI is unavailable.
   * Extracts service versions and constructs search queries deterministically.
   */
  private fallbackAuxiliaryAnalysis(
    output: string,
    modulePath: string
  ): {
    isDiscovery: boolean;
    discoveredInfo: string[];
    searchQueries: string[];
    reasoning: string;
  } {
    const discoveredInfo: string[] = [];
    const searchQueries: string[] = [];

    // Version patterns
    const versionPatterns = [
      /(?:Samba|samba)\s+([\d.]+)/gi,
      /(?:Apache|apache)[\/\s]+([\d.]+)/gi,
      /(?:OpenSSH|openssh)[_\s]+([\d.p]+)/gi,
      /(?:nginx)[\/\s]+([\d.]+)/gi,
      /(?:Microsoft-IIS)[\/\s]+([\d.]+)/gi,
      /(?:vsftpd)\s+([\d.]+)/gi,
      /(?:ProFTPD)\s+([\d.]+)/gi,
      /(?:MySQL|MariaDB)\s+([\d.]+)/gi,
      /(?:PostgreSQL)\s+([\d.]+)/gi,
    ];

    for (const pattern of versionPatterns) {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        const service = match[0].split(/[\s\/]+/)[0].toLowerCase();
        const version = match[1];
        discoveredInfo.push(`${match[0]}`);
        searchQueries.push(`${service} ${version.split(".").slice(0, 2).join(".")}`);
      }
    }

    // OS patterns
    const osPatterns = [
      /Windows\s+(?:7|8|10|11|Server\s+\d{4})\s*(?:SP\d)?/gi,
      /Ubuntu\s+[\d.]+/gi,
      /Debian\s+[\d.]+/gi,
      /CentOS\s+[\d.]+/gi,
    ];
    for (const pattern of osPatterns) {
      const match = output.match(pattern);
      if (match) {
        discoveredInfo.push(match[0]);
      }
    }

    // SMB version detection
    if (/SMBv?[12]/i.test(output)) {
      discoveredInfo.push(output.match(/SMBv?[12][.\d]*/i)?.[0] || "SMB detected");
      searchQueries.push("smb");
    }

    // NetBIOS detection
    if (/NetBIOS/i.test(output)) {
      discoveredInfo.push("NetBIOS service detected");
      searchQueries.push("netbios");
    }

    const isDiscovery = discoveredInfo.length > 0;
    return {
      isDiscovery,
      discoveredInfo,
      searchQueries: [...new Set(searchQueries)].slice(0, 3),
      reasoning: isDiscovery
        ? `Pattern-based detection found ${discoveredInfo.length} item(s)`
        : "No recognizable service versions or OS information in output",
    };
  }

  /**
   * After a successful exploit opens a session, derive post-exploitation
   * modules to run for further discovery (credential harvesting, internal
   * network scanning, system enumeration).
   */
  private async derivePostExploitModules(
    agent: any,
    exploitResult: any,
    modulePath: string,
    workflowId?: string,
    taskId?: string | null
  ): Promise<Array<{ type: string; path: string; parameters: Record<string, string>; reasoning: string }>> {
    const prompt = `A Metasploit exploit was successful and a session was opened.

**Exploit Module:** ${modulePath}
**Output (excerpt):**
${(exploitResult.output || "").slice(0, 3000)}

**Task:** Recommend up to 3 post-exploitation modules to run for further discovery. These should gather information that could reveal additional attack vectors (new hosts, credentials, internal services).

Consider modules like:
- post/multi/gather/env (environment variables)
- post/linux/gather/enum_system or post/windows/gather/enum_system
- post/multi/gather/ssh_creds
- auxiliary/scanner/portscan/tcp (scan internal subnets discovered)
- post/windows/gather/hashdump
- post/multi/gather/firefox_creds

Respond with JSON array:
[
  {
    "type": "post or auxiliary",
    "path": "module/path/here",
    "parameters": {},
    "reasoning": "why this module"
  }
]

Only include modules that would help discover NEW attack vectors. Maximum 3 modules.`;

    try {
      const response = await this.callAgentAI(
        agent,
        [{ role: "user", content: prompt }],
        { maxTokens: 1024 },
        workflowId ? { workflowId, taskId: taskId || null, phase: "Senior Cyber Operator: Post-Exploit Module Derivation" } : undefined
      );

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
      }
    } catch (error) {
      console.error("Failed to derive post-exploit modules:", error);
    }

    // Fallback: basic post-exploitation modules
    return [
      {
        type: "post",
        path: "multi/gather/env",
        parameters: {},
        reasoning: "Gather environment variables for further attack surface discovery",
      },
    ];
  }

  /**
   * AI-guided module selection: given a pool of candidate exploit modules
   * and the discovery context, ask the AI to pick the most relevant ones.
   * This prevents blindly executing whatever msfconsole search returns first.
   */
  private async selectRelevantModules(
    agent: any,
    candidates: Array<{ type: string; path: string; fullPath: string; description: string; rank: string }>,
    discoveredInfo: string[],
    maxSelect: number,
    workflowId?: string,
    taskId?: string | null
  ): Promise<string[]> {
    const candidateList = candidates
      .slice(0, 30) // Cap to avoid prompt bloat
      .map((c, i) => `${i + 1}. ${c.fullPath} [rank: ${c.rank || "unknown"}] — ${c.description || "no description"}`)
      .join("\n");

    const prompt = `You are selecting Metasploit exploit modules to validate specific discoveries from a reconnaissance scan.

**Discoveries from auxiliary scan:**
${discoveredInfo.map(d => `- ${d}`).join("\n")}

**Candidate exploit modules returned by search:**
${candidateList}

**Task:** Select the ${maxSelect} MOST RELEVANT exploit modules that directly target the specific vulnerabilities or services discovered above. Prioritize:
1. Modules that match the exact service version discovered (e.g., if "Samba 4.6.2" was found, pick samba exploits)
2. Modules targeting the specific OS version (e.g., if "Windows 7 SP1" was found, pick Windows 7 exploits like EternalBlue/ms17_010)
3. Modules with higher rank (excellent > great > good > normal > average)
4. Avoid modules for unrelated services (e.g., don't pick HTTP exploits when SMB was discovered)

Respond with a JSON array of the full module paths you selected, in order of relevance:
["exploit/path/one", "exploit/path/two", ...]

Select at most ${maxSelect} modules. Only include modules from the candidate list above.`;

    try {
      const response = await this.callAgentAI(
        agent,
        [{ role: "user", content: prompt }],
        { maxTokens: 1024 },
        workflowId ? { workflowId, taskId: taskId || null, phase: "Senior Cyber Operator: Module Relevance Selection" } : undefined
      );

      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const selected = JSON.parse(jsonMatch[0]);
        if (Array.isArray(selected)) {
          return selected.filter((s: any) => typeof s === "string").slice(0, maxSelect);
        }
      }
    } catch (error) {
      console.error("AI module selection failed, falling back to keyword scoring:", error);
    }

    // Fallback: keyword-based relevance scoring
    return this.scoreAndRankModules(candidates, discoveredInfo, maxSelect);
  }

  /**
   * Keyword-based fallback relevance scoring when AI selection is unavailable.
   * Scores each candidate by how many discovery keywords appear in its path/description.
   */
  private scoreAndRankModules(
    candidates: Array<{ type: string; path: string; fullPath: string; description: string; rank: string }>,
    discoveredInfo: string[],
    maxSelect: number
  ): string[] {
    // Extract keywords from discoveries (lowercase, split on spaces/punctuation)
    const keywords = discoveredInfo
      .flatMap(info => info.toLowerCase().split(/[\s,.:;()\-\/]+/))
      .filter(w => w.length >= 3)
      // Remove noise words
      .filter(w => !["the", "and", "for", "with", "was", "from", "that", "this", "are", "port", "open"].includes(w));

    // Rank bonuses for msfconsole ranks
    const rankScore: Record<string, number> = {
      excellent: 5, great: 4, good: 3, normal: 2, average: 1, low: 0, manual: 0,
    };

    const scored = candidates.map(c => {
      const text = `${c.fullPath} ${c.description}`.toLowerCase();
      let score = 0;

      // Keyword match scoring
      for (const kw of keywords) {
        if (text.includes(kw)) score += 2;
      }

      // Specific high-value pattern matches
      if (discoveredInfo.some(d => /smb|samba/i.test(d)) && /smb|samba/i.test(text)) score += 10;
      if (discoveredInfo.some(d => /eternalblue|ms17.010/i.test(d)) && /eternal|ms17/i.test(text)) score += 15;
      if (discoveredInfo.some(d => /windows\s*7/i.test(d)) && /windows/i.test(text)) score += 3;
      if (discoveredInfo.some(d => /ssh|openssh/i.test(d)) && /ssh/i.test(text)) score += 10;
      if (discoveredInfo.some(d => /apache|http/i.test(d)) && /apache|http/i.test(text)) score += 10;
      if (discoveredInfo.some(d => /ftp|vsftpd|proftp/i.test(d)) && /ftp/i.test(text)) score += 10;

      // Rank bonus
      score += rankScore[c.rank?.toLowerCase()] || 0;

      // Penalty for clearly unrelated modules
      if (discoveredInfo.some(d => /smb|samba/i.test(d)) && !/smb|samba|windows|netbios/i.test(text)) score -= 5;

      return { candidate: c, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored
      .slice(0, maxSelect)
      .filter(s => s.score > 0)
      .map(s => s.candidate.fullPath);
  }

  // ============================================================================
  // VULNERABILITY RECORD CREATION — Auto-create from pentest results
  // ============================================================================

  /**
   * Create vulnerability records from pentest exploitation results.
   * Called after report generation to populate the /vulnerabilities page.
   * Follows the same pattern as nuclei-executor.ts and bbot-executor.ts.
   */
  private async createVulnerabilitiesFromResults(
    exploitationResults: any,
    operationId: string | null,
    workflowId: string,
    taskId: string
  ): Promise<number> {
    const attempts = exploitationResults.attempts || [];
    let created = 0;

    for (const attempt of attempts) {
      // Only create records for successful exploits or significant discoveries
      if (!attempt.isExploitSuccess && !attempt.isDiscovery) continue;

      const modulePath = attempt.module || "unknown";
      const moduleName = modulePath.split("/").pop() || modulePath;

      let title: string;
      let severity: "critical" | "high" | "medium" | "low" | "informational";
      let description: string;

      if (attempt.isExploitSuccess) {
        title = `Exploited: ${this.humanizeModuleName(moduleName)} (${modulePath})`;
        severity = (attempt.output || "").toLowerCase().includes("system") ? "critical" : "high";
        description = `Successfully exploited target ${exploitationResults.targetValue} using Metasploit module ${modulePath}. ` +
          (attempt.discoveredInfo?.length ? `Discovered: ${attempt.discoveredInfo.join(", ")}. ` : "") +
          `This vulnerability was verified through active exploitation during a penetration test.`;
      } else {
        title = `Discovery: ${attempt.discoveredInfo?.[0] || moduleName} (${modulePath})`;
        severity = "medium";
        description = `Auxiliary scan ${modulePath} discovered: ${(attempt.discoveredInfo || []).join(", ")}. ` +
          `Target: ${exploitationResults.targetValue}. This finding may indicate exploitable attack surface.`;
      }

      try {
        await db.insert(vulnerabilities).values({
          title,
          description,
          severity,
          targetId: exploitationResults.targetId,
          operationId: operationId || undefined,
          proofOfConcept: (attempt.output || "").slice(0, 4000),
          affectedServices: [{
            host: exploitationResults.targetValue,
            module: modulePath,
            discoveredInfo: attempt.discoveredInfo || [],
            depth: attempt.depth,
            parentModule: attempt.parentModule,
          }] as any,
          references: [] as any,
          status: "open",
          verifiedAt: attempt.isExploitSuccess ? new Date() : null,
          discoveredAt: new Date(attempt.timestamp || Date.now()),
        }).onConflictDoNothing();

        created++;
      } catch (err) {
        console.warn(`Failed to create vulnerability for ${modulePath}:`, err);
      }
    }

    if (created > 0) {
      await this.log(workflowId, taskId, "info",
        `Created ${created} vulnerability record(s) from exploitation results`,
        { created, total: attempts.length }
      );
    }

    return created;
  }

  private humanizeModuleName(name: string): string {
    return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // ============================================================================
  // ATTACK TREE EXECUTION ENGINE — Recursive branching methodology
  // ============================================================================

  /**
   * Entry point: iterate root nodes and execute the full attack tree.
   */
  private async executeAttackTree(
    agent: any,
    roots: AttackTreeNode[],
    config: AttackTreeConfig,
    state: AttackTreeState,
    metasploitTool: any,
    targetValue: string,
    workflowId: string,
    taskId: string
  ): Promise<void> {
    for (const root of roots) {
      if (state.totalExecutions >= config.maxTotalExecutions) {
        await this.log(workflowId, taskId, "info",
          `Attack tree execution limit reached (${state.totalExecutions}/${config.maxTotalExecutions}), skipping remaining roots`
        );
        break;
      }
      await this.executeAttackNode(agent, root, config, state, metasploitTool, targetValue, workflowId, taskId);
    }
  }

  /**
   * Core recursive function: execute a single attack tree node and branch.
   *
   * - Auxiliary modules: analyze output for discoveries → search for up to 5 exploit children
   * - Exploit modules: analyze for session success → derive up to 3 post-exploit children
   * - Post modules: treated like auxiliary (analyze for discoveries, branch)
   */
  private async executeAttackNode(
    agent: any,
    node: AttackTreeNode,
    config: AttackTreeConfig,
    state: AttackTreeState,
    metasploitTool: any,
    targetValue: string,
    workflowId: string,
    taskId: string
  ): Promise<void> {
    // --- Guard checks ---
    if (state.totalExecutions >= config.maxTotalExecutions) {
      node.status = "skipped";
      await this.log(workflowId, taskId, "info",
        `[Depth ${node.depth}] Skipping ${node.module.type}/${node.module.path} — execution limit reached (${state.totalExecutions}/${config.maxTotalExecutions})`
      );
      return;
    }

    if (node.depth > config.maxDepth) {
      node.status = "skipped";
      await this.log(workflowId, taskId, "info",
        `[Depth ${node.depth}] Skipping ${node.module.type}/${node.module.path} — max depth reached (${node.depth}/${config.maxDepth})`
      );
      return;
    }

    const moduleKey = `${node.module.type}/${node.module.path}`;
    if (state.visitedModules.has(moduleKey)) {
      node.status = "skipped";
      await this.log(workflowId, taskId, "info",
        `[Depth ${node.depth}] Skipping ${moduleKey} — already executed`
      );
      return;
    }

    // --- Execute the module ---
    await this.log(workflowId, taskId, "info",
      `[Depth ${node.depth}] Executing ${moduleKey}`,
      {
        depth: node.depth,
        parentId: node.parentId,
        nodeId: node.id,
        reasoning: node.module.reasoning,
        executionNumber: state.totalExecutions + 1,
      }
    );

    try {
      const result = await metasploitExecutor.execute(
        metasploitTool.id,
        {
          type: node.module.type as any,
          path: node.module.path,
          parameters: node.module.parameters,
        },
        targetValue
      );

      node.execution = {
        success: result.success,
        output: result.output,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration,
        timestamp: result.timestamp,
      };
      node.status = "executed";
      state.visitedModules.add(moduleKey);
      state.totalExecutions++;

      await this.log(workflowId, taskId, result.success ? "info" : "warning",
        `[Depth ${node.depth}] ${moduleKey} → exit=${result.exitCode}, duration=${result.duration}ms`,
        {
          depth: node.depth,
          nodeId: node.id,
          success: result.success,
          exitCode: result.exitCode,
          duration: result.duration,
          outputLength: result.output?.length || 0,
        }
      );

      // --- Classify and branch ---
      if (node.module.type === "auxiliary" || node.module.type === "post") {
        await this.branchFromAuxiliary(agent, node, config, state, metasploitTool, targetValue, workflowId, taskId);
      } else if (node.module.type === "exploit") {
        await this.branchFromExploit(agent, node, config, state, metasploitTool, targetValue, workflowId, taskId);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      node.execution = {
        success: false,
        output: "",
        stderr: errorMsg,
        exitCode: 1,
        duration: 0,
        timestamp: new Date().toISOString(),
      };
      node.status = "analyzed";
      node.analysis = {
        isAuxiliaryDiscovery: false,
        isExploitSuccess: false,
        discoveredInfo: [],
        searchQueries: [],
        reasoning: `Execution error: ${errorMsg}`,
      };
      state.visitedModules.add(moduleKey);
      state.totalExecutions++;

      await this.log(workflowId, taskId, "error",
        `[Depth ${node.depth}] ${moduleKey} execution error: ${errorMsg}`,
        { depth: node.depth, nodeId: node.id, error: errorMsg }
      );
    }
  }

  /**
   * Branch from an auxiliary/post module result.
   * Analyzes output for discoveries and searches for exploit modules to validate.
   */
  private async branchFromAuxiliary(
    agent: any,
    node: AttackTreeNode,
    config: AttackTreeConfig,
    state: AttackTreeState,
    metasploitTool: any,
    targetValue: string,
    workflowId: string,
    taskId: string
  ): Promise<void> {
    const analysis = await this.analyzeAuxiliaryResult(
      agent,
      node.execution,
      `${node.module.type}/${node.module.path}`,
      workflowId,
      taskId
    );

    node.analysis = {
      isAuxiliaryDiscovery: analysis.isDiscovery,
      isExploitSuccess: false,
      discoveredInfo: analysis.discoveredInfo,
      searchQueries: analysis.searchQueries,
      reasoning: analysis.reasoning,
    };
    node.status = "analyzed";

    if (!analysis.isDiscovery) {
      await this.log(workflowId, taskId, "info",
        `[Depth ${node.depth}] ${node.module.type}/${node.module.path} → No actionable discovery`,
        { reasoning: analysis.reasoning }
      );
      return;
    }

    await this.log(workflowId, taskId, "info",
      `[Depth ${node.depth}] ${node.module.type}/${node.module.path} → DISCOVERY: ${analysis.discoveredInfo.join(", ")}`,
      {
        discoveredInfo: analysis.discoveredInfo,
        searchQueries: analysis.searchQueries,
      }
    );

    // Search for exploit modules to validate the discoveries — collect ALL candidates first
    const candidatePool: Array<{ type: string; path: string; fullPath: string; description: string; rank: string; query: string }> = [];
    const seenPaths = new Set<string>();

    for (const query of analysis.searchQueries) {
      try {
        const searchResults = await metasploitExecutor.searchModules(query, "exploit");

        await this.log(workflowId, taskId, "info",
          `[Depth ${node.depth}] Search "${query}" → ${searchResults.length} exploit module(s) found`,
          { query, resultCount: searchResults.length }
        );

        for (const mod of searchResults) {
          const modKey = `${mod.type}/${mod.path}`;
          if (!state.visitedModules.has(modKey) && !seenPaths.has(modKey)) {
            seenPaths.add(modKey);
            candidatePool.push({
              type: mod.type,
              path: mod.path,
              fullPath: mod.fullPath || modKey,
              description: mod.description || "",
              rank: mod.rank || "unknown",
              query,
            });
          }
        }
      } catch (error) {
        await this.log(workflowId, taskId, "warning",
          `[Depth ${node.depth}] Module search failed for "${query}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (candidatePool.length === 0) {
      await this.log(workflowId, taskId, "info",
        `[Depth ${node.depth}] No new exploit modules found for discoveries — branch terminates`
      );
      return;
    }

    await this.log(workflowId, taskId, "info",
      `[Depth ${node.depth}] Candidate pool: ${candidatePool.length} exploit module(s) — selecting most relevant via AI`,
      { totalCandidates: candidatePool.length, discoveries: analysis.discoveredInfo }
    );

    // AI-guided selection: pick the most relevant modules from the candidate pool
    const selectedPaths = await this.selectRelevantModules(
      agent,
      candidatePool,
      analysis.discoveredInfo,
      config.maxChildrenPerNode,
      workflowId,
      taskId
    );

    // Map selected paths back to full module info
    const childModules: Array<{ type: string; path: string; parameters: Record<string, string>; reasoning: string }> = [];
    for (const selectedPath of selectedPaths) {
      const candidate = candidatePool.find(c => c.fullPath === selectedPath || `${c.type}/${c.path}` === selectedPath);
      if (candidate) {
        childModules.push({
          type: candidate.type,
          path: candidate.path,
          parameters: {},
          reasoning: `AI-selected: targets "${analysis.discoveredInfo[0] || candidate.query}" (rank: ${candidate.rank}, search: "${candidate.query}")`,
        });
      }
    }

    if (childModules.length === 0) {
      await this.log(workflowId, taskId, "info",
        `[Depth ${node.depth}] AI selection returned no relevant modules from ${candidatePool.length} candidates — branch terminates`
      );
      return;
    }

    // Create child nodes and recurse
    await this.log(workflowId, taskId, "info",
      `[Depth ${node.depth}] Branching: ${childModules.length} AI-selected exploit module(s) to validate discoveries`,
      { childModules: childModules.map(m => `${m.type}/${m.path}`) }
    );

    node.status = "branched";

    for (const mod of childModules) {
      const childId = randomUUID();
      const child: AttackTreeNode = {
        id: childId,
        parentId: node.id,
        depth: node.depth + 1,
        module: mod,
        execution: null,
        analysis: null,
        children: [],
        status: "pending",
      };
      node.children.push(child);
      state.allNodes.set(childId, child);

      await this.executeAttackNode(agent, child, config, state, metasploitTool, targetValue, workflowId, taskId);
    }
  }

  /**
   * Branch from a successful exploit result.
   * Derives post-exploitation modules for further discovery.
   */
  private async branchFromExploit(
    agent: any,
    node: AttackTreeNode,
    config: AttackTreeConfig,
    state: AttackTreeState,
    metasploitTool: any,
    targetValue: string,
    workflowId: string,
    taskId: string
  ): Promise<void> {
    // Analyze if the exploit was successful
    let isSuccess = false;

    if (getAnthropicClient()) {
      const exploitAnalysis = await this.analyzeExploitationResult(agent, node.execution, [], workflowId, taskId);
      isSuccess = exploitAnalysis.success;
      node.analysis = {
        isAuxiliaryDiscovery: false,
        isExploitSuccess: exploitAnalysis.success,
        discoveredInfo: [],
        searchQueries: [],
        reasoning: exploitAnalysis.reasoning,
      };
    } else {
      // Fallback pattern matching
      const output = node.execution?.output || "";
      isSuccess = output.includes("session opened") || output.includes("meterpreter") || output.includes("shell spawned");
      node.analysis = {
        isAuxiliaryDiscovery: false,
        isExploitSuccess: isSuccess,
        discoveredInfo: [],
        searchQueries: [],
        reasoning: isSuccess ? "Session/shell indicators detected in output" : "No session indicators found",
      };
    }

    node.status = "analyzed";

    const statusLabel = isSuccess ? "SUCCESS" : "FAILED";
    await this.log(workflowId, taskId, isSuccess ? "info" : "warning",
      `[Depth ${node.depth}] exploit/${node.module.path} → ${statusLabel}`,
      { isExploitSuccess: isSuccess, reasoning: node.analysis.reasoning }
    );

    // Branch into post-exploitation if enabled and successful
    if (!isSuccess || !config.enablePostExploitBranching) return;

    await this.log(workflowId, taskId, "info",
      `[Depth ${node.depth}] Successful exploitation — deriving post-exploitation modules`
    );

    const postModules = await this.derivePostExploitModules(
      agent,
      node.execution,
      `exploit/${node.module.path}`,
      workflowId,
      taskId
    );

    const limitedPostModules = postModules.slice(0, config.maxPostExploitScans);

    if (limitedPostModules.length === 0) {
      await this.log(workflowId, taskId, "info",
        `[Depth ${node.depth}] No post-exploitation modules derived — branch terminates`
      );
      return;
    }

    await this.log(workflowId, taskId, "info",
      `[Depth ${node.depth}] Branching: ${limitedPostModules.length} post-exploitation module(s)`,
      { postModules: limitedPostModules.map(m => `${m.type}/${m.path}`) }
    );

    node.status = "branched";

    for (const mod of limitedPostModules) {
      const childId = randomUUID();
      const child: AttackTreeNode = {
        id: childId,
        parentId: node.id,
        depth: node.depth + 1,
        module: {
          type: mod.type,
          path: mod.path,
          parameters: mod.parameters || {},
          reasoning: mod.reasoning || "Post-exploitation discovery",
        },
        execution: null,
        analysis: null,
        children: [],
        status: "pending",
      };
      node.children.push(child);
      state.allNodes.set(childId, child);

      await this.executeAttackNode(agent, child, config, state, metasploitTool, targetValue, workflowId, taskId);
    }
  }

  // ============================================================================
  // ATTACK TREE SERIALIZATION — For reporting and backward compatibility
  // ============================================================================

  /**
   * Flatten the attack tree into an ordered list for backward-compatible reporting.
   * Preserves depth/parent info for tree visualization in reports.
   */
  private flattenAttackTree(
    roots: AttackTreeNode[]
  ): Array<{
    module: string;
    depth: number;
    parentModule: string | null;
    success: boolean;
    isDiscovery: boolean;
    isExploitSuccess: boolean;
    discoveredInfo: string[];
    output: string;
    timestamp: string;
    childCount: number;
  }> {
    const flat: Array<any> = [];

    const walk = (nodes: AttackTreeNode[], parentModulePath: string | null) => {
      for (const node of nodes) {
        if (node.status === "skipped" && !node.execution) continue;

        flat.push({
          module: `${node.module.type}/${node.module.path}`,
          depth: node.depth,
          parentModule: parentModulePath,
          success: node.execution?.success || false,
          isDiscovery: node.analysis?.isAuxiliaryDiscovery || false,
          isExploitSuccess: node.analysis?.isExploitSuccess || false,
          discoveredInfo: node.analysis?.discoveredInfo || [],
          output: node.execution?.output || node.execution?.stderr || "",
          timestamp: node.execution?.timestamp || new Date().toISOString(),
          childCount: node.children.length,
        });

        if (node.children.length > 0) {
          walk(node.children, `${node.module.type}/${node.module.path}`);
        }
      }
    };

    walk(roots, null);
    return flat;
  }

  /**
   * Render the attack tree as indented text for the penetration test report.
   * Example output:
   *   [AUX] auxiliary/scanner/smb/smb_version → DISCOVERY: "Samba 4.6.2"
   *     [EXPLOIT] exploit/linux/samba/is_known_pipename → FAILED
   *     [EXPLOIT] exploit/multi/samba/nttrans → SUCCESS
   *       [POST] post/linux/gather/enum_system → DISCOVERY: "Ubuntu 16.04"
   */
  private renderAttackTreeForReport(roots: AttackTreeNode[], indent: number = 0): string {
    const lines: string[] = [];
    const prefix = "  ".repeat(indent);

    for (const node of roots) {
      if (node.status === "skipped" && !node.execution) continue;

      const typeLabel = node.module.type.toUpperCase().slice(0, 3);
      const modulePath = `${node.module.type}/${node.module.path}`;
      let statusLabel: string;

      if (node.analysis?.isExploitSuccess) {
        statusLabel = "SUCCESS (session opened)";
      } else if (node.analysis?.isAuxiliaryDiscovery) {
        const info = node.analysis.discoveredInfo.slice(0, 2).join(", ");
        statusLabel = `DISCOVERY: "${info}"`;
      } else if (node.execution) {
        statusLabel = node.execution.success ? "COMPLETED" : "FAILED";
      } else {
        statusLabel = "SKIPPED";
      }

      lines.push(`${prefix}[${typeLabel}] ${modulePath} → ${statusLabel}`);

      if (node.children.length > 0) {
        lines.push(this.renderAttackTreeForReport(node.children, indent + 1));
      }
    }

    return lines.join("\n");
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

    // Build attack tree section if tree data is present
    let attackTreeSection = "";
    if (exploitationResults.attackTree) {
      const treeVisualization = this.renderAttackTreeForReport(exploitationResults.attackTree);
      const stats = exploitationResults.treeStats || {};
      attackTreeSection = `

**Attack Tree Methodology:**
The assessment used a recursive branching methodology where each successful auxiliary
scan triggered searches for up to 5 exploit modules to validate discovered vulnerabilities.
Successful exploits further spawned post-exploitation scans, creating a branching attack
tree that was followed until no new vectors remained.

\`\`\`
${treeVisualization}
\`\`\`

**Tree Statistics:**
- Total module executions: ${stats.totalExecutions || 0}
- Maximum branch depth: ${stats.maxDepthReached || 0}
- Unique modules tested: ${stats.uniqueModules || 0}
- Branching points (discoveries): ${stats.branches || 0}
- Auxiliary discoveries: ${stats.auxiliaryDiscoveries || 0}
`;
    }

    return `Create a professional Network Penetration Test report based on these findings:

**Target:** ${exploitationResults.targetValue}
**Overall Success:** ${exploitationResults.success ? "Yes" : "No"}

**Metasploit Module Execution Summary:**
${exploitationResults.attempts
  .map(
    (a: any, i: number) => {
      const depthPrefix = a.depth > 0 ? `${"  ".repeat(a.depth)}[Branch D${a.depth}] ` : "";
      const statusLabel = a.isExploitSuccess ? "EXPLOIT SUCCESS" :
        a.isDiscovery ? `DISCOVERY (${(a.discoveredInfo || []).slice(0, 2).join(", ")})` :
        a.success ? "COMPLETED" : "FAILED";
      return `${i + 1}. ${depthPrefix}${a.module} - ${statusLabel}`;
    }
  )
  .join("\n")}

**Metasploit Detailed Output:**
${exploitationResults.attempts
  .map(
    (a: any) =>
      `\n### ${a.module}${a.depth > 0 ? ` (Branch Depth ${a.depth}, parent: ${a.parentModule || "root"})` : ""}\n${a.output || a.error || "No output"}`
  )
  .join("\n")}
${attackTreeSection}
${empireSection}

Create a comprehensive penetration test report with:
1. Executive Summary
2. Methodology (describe the recursive branching attack tree approach used)
3. Technical Details (include both Metasploit module tree and Empire C2 operations)
4. Attack Tree Analysis (show the branching path: auxiliary discovery → exploit validation → post-exploitation → further discovery)
5. Findings and Vulnerabilities (organized by discovery chain)
6. Post-Exploitation Activities (if Empire was used or post-exploit modules ran)
7. Credentials Obtained (if any)
8. Recommendations
9. Conclusion

**Important:**
- The report should clearly show how each auxiliary discovery led to targeted exploit validation attempts
- Include the attack tree visualization showing the branching methodology
- Differentiate between auxiliary scans (information gathering), exploit attempts (vulnerability validation), and post-exploitation (further discovery)
- Include Empire C2 post-exploitation activities in a dedicated section if they were performed

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
