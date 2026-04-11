/**
 * Tool Execution Loop
 *
 * The core reasoning loop for autonomous agent tool execution.
 * AI decides → selects tool → executes in container → parses output → feeds back for next decision.
 *
 * Used by BaseTaskAgent.runToolLoop() to give any agent autonomous tool execution capability.
 */

import { EventEmitter } from "events";
import { multiContainerExecutor, ToolInfo } from "./multi-container-executor";
import { ExecutionResult } from "../docker-executor";
import { memoryService, SearchResult } from "../memory-service";
import { agentMessageBus } from "../agent-message-bus";
import { ollamaAIClient, AIMessage, AICompletionOptions } from "../ollama-ai-client";
import { db } from "../../db";
import { toolRegistry } from "../../../shared/schema";
import { eq, inArray } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface LoopConstraints {
  /** Maximum number of tool execution iterations (default: 10) */
  maxIterations: number;
  /** Maximum total duration in milliseconds (default: 30 minutes) */
  maxDurationMs: number;
  /** Tool categories that require human approval before execution */
  requireApprovalForCategories: string[];
  /** Autonomy level 1-10 (higher = less approval needed) */
  autonomyLevel: number;
  /** Maximum output size per tool in bytes before truncation (default: 50KB) */
  maxOutputBytes: number;
  /** AI provider configuration */
  aiProvider?: "ollama" | "openai" | "anthropic" | "auto";
  /** AI model override */
  aiModel?: string;
}

export interface ToolIterationResult {
  iteration: number;
  reasoning: string;
  toolUsed: string | null;
  args: string[];
  executionResult: ExecutionResult | null;
  parsedOutput: string | null;
  memoryId: string | null;
  durationMs: number;
}

export interface LoopResult {
  iterations: ToolIterationResult[];
  summary: string;
  memoryIds: string[];
  status: "completed" | "approval_pending" | "max_iterations" | "timeout" | "error";
  totalDurationMs: number;
  toolsUsed: string[];
  error?: string;
}

/** AI response for a single iteration */
interface AIDecision {
  action: "execute_tool" | "complete" | "request_approval";
  tool?: string;
  args?: string[];
  reasoning: string;
  summary?: string;
  approvalReason?: string;
}

/** Approval callback — injected by AgentWebSocketManager (B4) */
export type ApprovalCallback = (request: {
  tool: string;
  args: string[];
  reason: string;
  agentId: string;
  operationId: string;
}) => Promise<{ approved: boolean; reason?: string }>;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONSTRAINTS: LoopConstraints = {
  maxIterations: 10,
  maxDurationMs: 30 * 60 * 1000, // 30 minutes
  requireApprovalForCategories: ["exploitation", "post-exploitation", "c2"],
  autonomyLevel: 5,
  maxOutputBytes: 50 * 1024, // 50KB
};

const SLIDING_WINDOW_FULL = 5; // Keep last N iterations in full detail

// ============================================================================
// Tool Execution Loop
// ============================================================================

export class ToolExecutionLoop extends EventEmitter {
  private agentId: string;
  private agentName: string;
  private operationId: string;
  private targetId: string;
  private objective: string;
  private constraints: LoopConstraints;
  private approvalCallback: ApprovalCallback | null = null;
  private aborted = false;

  constructor(
    agentId: string,
    agentName: string,
    operationId: string,
    targetId: string,
    objective: string,
    constraints: Partial<LoopConstraints> = {},
  ) {
    super();
    this.agentId = agentId;
    this.agentName = agentName;
    this.operationId = operationId;
    this.targetId = targetId;
    this.objective = objective;
    this.constraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
  }

  /** Set the approval callback (wired by AgentWebSocketManager in B4) */
  setApprovalCallback(cb: ApprovalCallback): void {
    this.approvalCallback = cb;
  }

  /** Abort the loop externally */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Run the autonomous tool execution loop.
   */
  async run(): Promise<LoopResult> {
    const startTime = Date.now();
    const iterations: ToolIterationResult[] = [];
    const memoryIds: string[] = [];
    const toolsUsed: string[] = [];

    try {
      // 1. Gather context
      const [availableTools, relevantMemories] = await Promise.all([
        this.getAvailableTools(),
        this.getRelevantMemories(),
      ]);

      if (availableTools.length === 0) {
        return {
          iterations: [],
          summary: "No tools available in the registry.",
          memoryIds: [],
          status: "error",
          totalDurationMs: Date.now() - startTime,
          toolsUsed: [],
          error: "No tools found in registry. Run tool discovery first.",
        };
      }

      // 2. Iteration loop
      for (let i = 0; i < this.constraints.maxIterations; i++) {
        if (this.aborted) {
          return this.buildResult(iterations, memoryIds, toolsUsed, startTime, "error", "Aborted by user");
        }

        // Check timeout
        if (Date.now() - startTime > this.constraints.maxDurationMs) {
          return this.buildResult(iterations, memoryIds, toolsUsed, startTime, "timeout");
        }

        const iterStart = Date.now();

        // 2a. Call AI for decision
        const decision = await this.getAIDecision(
          availableTools,
          relevantMemories,
          iterations,
        );

        // 2b. Handle decision
        if (decision.action === "complete") {
          iterations.push({
            iteration: i + 1,
            reasoning: decision.reasoning,
            toolUsed: null,
            args: [],
            executionResult: null,
            parsedOutput: null,
            memoryId: null,
            durationMs: Date.now() - iterStart,
          });

          return this.buildResult(
            iterations,
            memoryIds,
            toolsUsed,
            startTime,
            "completed",
            undefined,
            decision.summary,
          );
        }

        if (decision.action === "request_approval") {
          iterations.push({
            iteration: i + 1,
            reasoning: decision.reasoning,
            toolUsed: null,
            args: [],
            executionResult: null,
            parsedOutput: null,
            memoryId: null,
            durationMs: Date.now() - iterStart,
          });

          return this.buildResult(iterations, memoryIds, toolsUsed, startTime, "approval_pending");
        }

        // 2c. Validate tool exists
        const toolName = decision.tool!;
        const toolInfo = availableTools.find(
          (t) => t.toolId === toolName || t.name === toolName,
        );
        if (!toolInfo) {
          // Tool not found — feed error back and let AI retry
          iterations.push({
            iteration: i + 1,
            reasoning: decision.reasoning,
            toolUsed: toolName,
            args: decision.args || [],
            executionResult: { stdout: "", stderr: `Tool '${toolName}' not found in registry.`, exitCode: 1, timedOut: false },
            parsedOutput: null,
            memoryId: null,
            durationMs: Date.now() - iterStart,
          });
          continue;
        }

        // 2d. Check if tool category requires approval
        if (this.needsApproval(toolInfo.category)) {
          if (this.approvalCallback) {
            const approval = await this.approvalCallback({
              tool: toolName,
              args: decision.args || [],
              reason: decision.reasoning,
              agentId: this.agentId,
              operationId: this.operationId,
            });

            if (!approval.approved) {
              iterations.push({
                iteration: i + 1,
                reasoning: `Approval denied for ${toolName}: ${approval.reason || "no reason given"}`,
                toolUsed: toolName,
                args: decision.args || [],
                executionResult: null,
                parsedOutput: null,
                memoryId: null,
                durationMs: Date.now() - iterStart,
              });
              continue;
            }
          } else {
            // No approval callback wired — block and return pending
            return this.buildResult(iterations, memoryIds, toolsUsed, startTime, "approval_pending");
          }
        }

        // 2e. Execute tool in container
        this.emit("tool_start", { iteration: i + 1, tool: toolName, args: decision.args });

        let execResult: ExecutionResult;
        try {
          execResult = await multiContainerExecutor.executeTool(
            toolInfo.toolId,
            decision.args || [],
            { timeout: Math.min(300000, this.constraints.maxDurationMs - (Date.now() - startTime)) },
          );
        } catch (execError) {
          execResult = {
            stdout: "",
            stderr: execError instanceof Error ? execError.message : String(execError),
            exitCode: 1,
            timedOut: false,
          };
        }

        // 2f. Truncate output
        const truncatedOutput = this.truncateOutput(execResult.stdout || execResult.stderr);
        if (!toolsUsed.includes(toolName)) {
          toolsUsed.push(toolName);
        }

        this.emit("tool_complete", {
          iteration: i + 1,
          tool: toolName,
          exitCode: execResult.exitCode,
          outputLength: (execResult.stdout || "").length,
        });

        // 2g. Store result in memory
        let memoryId: string | null = null;
        try {
          const context = await memoryService.createContext({
            contextType: "operation",
            contextId: this.operationId,
            contextName: `Operation ${this.operationId}`,
          });

          const memory = await memoryService.addMemory({
            contextId: context.id,
            memoryText: `[${this.agentName}] Tool: ${toolName} ${(decision.args || []).join(" ")}\nExit: ${execResult.exitCode}\nOutput: ${truncatedOutput.slice(0, 2000)}`,
            memoryType: "event",
            sourceAgentId: this.agentId,
            tags: [toolName, toolInfo.category, execResult.exitCode === 0 ? "success" : "failure"],
            metadata: {
              iteration: i + 1,
              toolName,
              args: decision.args,
              exitCode: execResult.exitCode,
              outputLength: (execResult.stdout || "").length,
            },
          });
          memoryId = memory.id;
          memoryIds.push(memory.id);
        } catch (memErr) {
          console.error(`[ToolExecutionLoop] Failed to store memory:`, memErr);
        }

        // 2h. Emit progress
        await this.emitProgress(i + 1, toolName, execResult);

        iterations.push({
          iteration: i + 1,
          reasoning: decision.reasoning,
          toolUsed: toolName,
          args: decision.args || [],
          executionResult: execResult,
          parsedOutput: truncatedOutput,
          memoryId,
          durationMs: Date.now() - iterStart,
        });
      }

      // Hit max iterations
      return this.buildResult(iterations, memoryIds, toolsUsed, startTime, "max_iterations");
    } catch (error) {
      return this.buildResult(
        iterations,
        memoryIds,
        toolsUsed,
        startTime,
        "error",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // ============================================================================
  // AI Decision Making
  // ============================================================================

  private async getAIDecision(
    tools: ToolInfo[],
    memories: SearchResult[],
    previousIterations: ToolIterationResult[],
  ): Promise<AIDecision> {
    const systemPrompt = this.buildSystemPrompt(tools);
    const userPrompt = this.buildUserPrompt(memories, previousIterations);

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const aiOptions: AICompletionOptions = {
      provider: (this.constraints.aiProvider as any) || "anthropic",
      model: this.constraints.aiModel,
      temperature: 0.2,
      maxTokens: 2048,
    };

    // Ensure correct model for provider
    if (aiOptions.provider === "anthropic" && (!aiOptions.model || !aiOptions.model.startsWith("claude"))) {
      aiOptions.model = "claude-sonnet-4-5";
    } else if (aiOptions.provider === "openai" && (!aiOptions.model || !aiOptions.model.startsWith("gpt"))) {
      aiOptions.model = "gpt-5.2-chat-latest";
    }

    const response = await ollamaAIClient.complete(messages, aiOptions);

    if (!response.success) {
      throw new Error(`AI decision failed: ${response.error}`);
    }

    return this.parseAIDecision(response.content);
  }

  private buildSystemPrompt(tools: ToolInfo[]): string {
    const toolList = tools
      .map((t) => `- ${t.toolId} (${t.category}): ${t.name} [container: ${t.containerName}]`)
      .join("\n");

    const approvalCategories = this.constraints.requireApprovalForCategories.join(", ");

    return `You are an autonomous security assessment agent executing tools to achieve an objective.

AVAILABLE TOOLS:
${toolList}

RULES:
1. Select tools from the AVAILABLE TOOLS list ONLY. Use the exact toolId.
2. Provide arguments as an array of strings (command-line args).
3. Categories requiring approval before execution: ${approvalCategories}
4. When the objective is achieved or you have enough information, use action "complete".
5. If you need human approval for a sensitive action, use action "request_approval".
6. Analyze tool output carefully before deciding the next step.
7. Do not repeat the same tool with the same arguments unless you have reason to expect different results.

RESPOND WITH VALID JSON ONLY:
{
  "action": "execute_tool" | "complete" | "request_approval",
  "tool": "toolId",
  "args": ["arg1", "arg2"],
  "reasoning": "Why this action",
  "summary": "Final summary (only for complete action)",
  "approvalReason": "Why approval is needed (only for request_approval)"
}`;
  }

  private buildUserPrompt(
    memories: SearchResult[],
    previousIterations: ToolIterationResult[],
  ): string {
    const parts: string[] = [];

    parts.push(`OBJECTIVE: ${this.objective}`);
    parts.push(`TARGET: ${this.targetId}`);
    parts.push(`OPERATION: ${this.operationId}`);

    // Relevant memories
    if (memories.length > 0) {
      parts.push("\nRELEVANT CONTEXT FROM MEMORY:");
      for (const mem of memories.slice(0, 5)) {
        parts.push(`- [${mem.memoryType}] ${mem.memoryText.slice(0, 300)}`);
      }
    }

    // Previous iterations with sliding window
    if (previousIterations.length > 0) {
      parts.push("\nPREVIOUS ITERATIONS:");

      const totalIters = previousIterations.length;
      const fullStart = Math.max(0, totalIters - SLIDING_WINDOW_FULL);

      // Summarized older iterations
      if (fullStart > 0) {
        parts.push(`[${fullStart} earlier iterations summarized]`);
        for (let i = 0; i < fullStart; i++) {
          const iter = previousIterations[i];
          parts.push(`  ${i + 1}. ${iter.toolUsed || "no-tool"}: ${iter.reasoning.slice(0, 100)}`);
        }
      }

      // Full recent iterations
      for (let i = fullStart; i < totalIters; i++) {
        const iter = previousIterations[i];
        parts.push(`\nIteration ${iter.iteration}:`);
        parts.push(`  Tool: ${iter.toolUsed || "none"}`);
        parts.push(`  Args: ${iter.args.join(" ")}`);
        parts.push(`  Reasoning: ${iter.reasoning}`);
        if (iter.executionResult) {
          parts.push(`  Exit Code: ${iter.executionResult.exitCode}`);
          parts.push(`  Output:\n${(iter.parsedOutput || "").slice(0, 3000)}`);
        }
      }
    }

    parts.push("\nWhat should be done next? Respond with JSON.");
    return parts.join("\n");
  }

  private parseAIDecision(content: string): AIDecision {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // Try to find raw JSON
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        jsonStr = braceMatch[0];
      }
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        action: parsed.action || "complete",
        tool: parsed.tool,
        args: Array.isArray(parsed.args) ? parsed.args.map(String) : [],
        reasoning: parsed.reasoning || "No reasoning provided",
        summary: parsed.summary,
        approvalReason: parsed.approvalReason,
      };
    } catch {
      // If JSON parsing fails, treat as complete with the raw text as summary
      return {
        action: "complete",
        reasoning: "Failed to parse AI response as JSON",
        summary: content.slice(0, 500),
      };
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async getAvailableTools(): Promise<ToolInfo[]> {
    const toolsByContainer = await multiContainerExecutor.listToolsByContainer();
    const allTools: ToolInfo[] = [];
    for (const tools of toolsByContainer.values()) {
      allTools.push(...tools);
    }
    return allTools;
  }

  private async getRelevantMemories(): Promise<SearchResult[]> {
    try {
      return await memoryService.searchMemories({
        query: this.objective,
        limit: 10,
      });
    } catch {
      return [];
    }
  }

  private needsApproval(category: string): boolean {
    if (this.constraints.autonomyLevel >= 9) return false;
    return this.constraints.requireApprovalForCategories.includes(category);
  }

  private truncateOutput(output: string): string {
    if (!output) return "";
    const maxBytes = this.constraints.maxOutputBytes;
    if (Buffer.byteLength(output) <= maxBytes) return output;
    // Truncate at character boundary
    let truncated = output;
    while (Buffer.byteLength(truncated) > maxBytes) {
      truncated = truncated.slice(0, truncated.length - 1000);
    }
    return truncated + `\n... [truncated, original ${Buffer.byteLength(output)} bytes]`;
  }

  private async emitProgress(
    iteration: number,
    toolName: string,
    result: ExecutionResult,
  ): Promise<void> {
    try {
      await agentMessageBus.sendMessage({
        messageType: "status",
        from: { agentId: this.agentId, agentRole: "tool_executor" },
        broadcastToRole: "operations_manager",
        subject: `Tool Execution: ${toolName} (iter ${iteration})`,
        content: {
          summary: `${toolName} exit=${result.exitCode}`,
          data: {
            iteration,
            toolName,
            exitCode: result.exitCode,
            outputLength: (result.stdout || "").length,
            operationId: this.operationId,
            targetId: this.targetId,
          },
        },
      });
    } catch {
      // Non-critical — don't break the loop
    }

    this.emit("iteration_complete", {
      iteration,
      toolName,
      exitCode: result.exitCode,
      agentId: this.agentId,
      operationId: this.operationId,
    });
  }

  private buildResult(
    iterations: ToolIterationResult[],
    memoryIds: string[],
    toolsUsed: string[],
    startTime: number,
    status: LoopResult["status"],
    error?: string,
    summary?: string,
  ): LoopResult {
    return {
      iterations,
      summary:
        summary ||
        `Loop ${status}: ${iterations.length} iterations, ${toolsUsed.length} tools used (${toolsUsed.join(", ")})`,
      memoryIds,
      status,
      totalDurationMs: Date.now() - startTime,
      toolsUsed,
      error,
    };
  }
}
