import { db } from "../db";
import { agents, targets, mcpServers } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { dockerExecutor } from "./docker-executor";
import { executeTool } from "./tool-executor";
import { mcpGrpcBridge } from "./mcp-grpc-bridge";
import { mcpInvoker } from "./agents/mcp-invoker";
import { resolveAgentMcpServerIds } from "./agents/mcp-resolve";
import { resolveTool, type AgentToolResult } from "./agents/tool-resolve";
import type { ToolConfiguration } from "../../shared/types/tool-config";
import { harnessToolExecutor } from "./harness-tool-executor";
import { readFeatureFlags } from "@shared/feature-flags";
import { ferryClient } from "./ferry-client";
import { createLogger } from '../lib/logger';
const log = createLogger("agent-tool-connector");

async function forwardTelemetryIfEnabled(
  peerId: string | null | undefined,
  durationMs: number,
) {
  if (!readFeatureFlags(process.env).gmlTelemetry || !peerId) return;
  try {
    const now = Math.floor(Date.now() / 1000);
    await ferryClient.submitTelemetry({
      window_start: now - 60,
      window_end: now,
      node_features: {
        [peerId]: {
          peer_id: peerId,
          message_count: 1,
          task_count: 1,
          error_count: 0,
          mean_latency_ms: durationMs,
        },
      },
    });
  } catch {
    // Non-fatal: telemetry forwarding is best-effort
  }
}

/**
 * Generic Agent-Tool Connector
 * Links any AI agent with any security tool for automated execution
 */
export class AgentToolConnector {
  /**
   * Execute a tool using an AI agent's guidance.
   *
   * Returns the canonical {@link AgentToolResult} — structured fields for
   * programmatic callers AND a `formatted` summary for string consumers. Tool
   * resolution goes through the single `resolveTool` (tool_registry →
   * security_tools), and dispatch picks the one real executor for the tool:
   * installed registry tool → tool-executor; rtpi-tools container → docker;
   * MCP-attached agent → mcpInvoker. No path fabricates output.
   */
  async execute(
    agentId: string,
    toolId: string,
    targetId: string,
    input: string
  ): Promise<AgentToolResult> {
    // Get agent configuration
    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const resolved = await resolveTool(toolId);
    if (!resolved) {
      throw new Error(`Tool ${toolId} not found`);
    }
    const tool = resolved.tool;

    // Get target information
    const target = await db
      .select()
      .from(targets)
      .where(eq(targets.id, targetId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!target) {
      throw new Error(`Target ${targetId} not found`);
    }

    // Dispatch to the single real executor for this tool.
    let result: AgentToolResult;
    if (resolved.source === "registry" && resolved.installed) {
      result = await this.executeWithNewFramework(agent, tool, target, input);
    } else {
      result = await this.executeAgentWithTool(agent, tool, target, input);
    }

    forwardTelemetryIfEnabled((agent as any).peerId, result.durationMs ?? 0);
    return result;
  }

  /**
   * Execute a tool on a remote implant via MCP-gRPC bridge
   */
  async executeOnImplant(
    agentId: string,
    toolCall: {
      toolName: string;
      toolCategory: string;
      parameters: Record<string, any>;
    },
    implantId?: string
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    executionTimeMs: number;
    implantId?: string;
  }> {
    // Get agent configuration
    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!agent) {
      return {
        success: false,
        error: `Agent ${agentId} not found`,
        executionTimeMs: 0,
      };
    }

    // Ensure bridge is active
    const bridgeStatus = mcpGrpcBridge.getStatus();
    if (!bridgeStatus.isActive) {
      try {
        await mcpGrpcBridge.start();
      } catch (error) {
        return {
          success: false,
          error: `Failed to start MCP-gRPC bridge: ${error instanceof Error ? error.message : String(error)}`,
          executionTimeMs: 0,
        };
      }
    }

    // Create MCP tool request
    const requestId = `mcp_${agentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const request = {
      requestId,
      agentId,
      toolName: toolCall.toolName,
      toolCategory: toolCall.toolCategory,
      parameters: toolCall.parameters,
      implantId,
      timeout: 60000, // 1 minute default
    };

    log.info(`[AgentToolConnector] Executing tool on implant: ${toolCall.toolName}`);
    log.info(`[AgentToolConnector] Agent: ${agent.name}, Implant: ${implantId || 'auto-select'}`);

    // Execute via bridge
    const response = await mcpGrpcBridge.executeToolOnImplant(request);

    return {
      success: response.success,
      result: response.result,
      error: response.error,
      executionTimeMs: response.executionTimeMs,
      implantId: response.implantId,
    };
  }

  /**
   * Execute a tool on implant with streaming results
   */
  async executeOnImplantStreaming(
    agentId: string,
    toolCall: {
      toolName: string;
      toolCategory: string;
      parameters: Record<string, any>;
    },
    implantId: string | undefined,
    callbacks: {
      onData: (data: any) => void;
      onError: (error: Error) => void;
      onComplete: (result: any) => void;
    }
  ): Promise<void> {
    // First execute the tool to get task ID
    const result = await this.executeOnImplant(agentId, toolCall, implantId);

    if (!result.success) {
      callbacks.onError(new Error(result.error || 'Unknown error'));
      return;
    }

    // Result contains the task data - stream from it
    callbacks.onData(result.result);
    callbacks.onComplete(result);
  }

  /**
   * Get available implants with their capabilities for an agent
   */
  async getAvailableImplantsForAgent(agentId: string): Promise<{
    implantId: string;
    implantName: string;
    capabilities: string[];
    status: string;
    connectionQuality: number;
  }[]> {
    // Ensure bridge is active
    const bridgeStatus = mcpGrpcBridge.getStatus();
    if (!bridgeStatus.isActive) {
      await mcpGrpcBridge.start();
    }

    return mcpGrpcBridge.getAvailableCapabilities();
  }

  /**
   * Find the best implant for a specific tool
   */
  async findBestImplantForTool(
    toolName: string,
    toolCategory: string
  ): Promise<{
    implantId: string;
    implantName: string;
    capabilities: string[];
    status: string;
    connectionQuality: number;
  } | null> {
    // Ensure bridge is active
    const bridgeStatus = mcpGrpcBridge.getStatus();
    if (!bridgeStatus.isActive) {
      await mcpGrpcBridge.start();
    }

    return mcpGrpcBridge.findBestImplantForTool(toolName, toolCategory);
  }

  /**
   * Execute tool using new tool framework
   */
  private async executeWithNewFramework(
    agent: any,
    tool: any,
    target: any,
    input: string
  ): Promise<AgentToolResult> {
    const config = tool.config as ToolConfiguration;
    try {
      // Parse input parameters
      const parameters = this.parseInputParameters(input, {});

      // Add target to parameters if not already present
      if (!parameters.target && target) {
        parameters.target = target.value;
      }

      // Execute tool using tool-executor service (writes its own toolExecutions
      // record — telemetry for this path is already centralized there).
      const result = await executeTool({
        toolId: config.toolId,
        parameters,
        targetId: target.id,
        agentId: agent.id,
        userId: agent.createdBy || 'system',
        timeout: config.defaultTimeout || 300000,
        saveOutput: true,
        parseOutput: true,
      });

      return {
        success: result.status === 'completed',
        exitCode: typeof result.exitCode === 'number' ? result.exitCode : null,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        durationMs: result.duration ?? 0,
        formatted: this.formatNewFrameworkResponse(agent, config, target, result),
      };
    } catch (error: any) {
      return {
        success: false,
        exitCode: null,
        stdout: '',
        stderr: error?.message ?? String(error),
        durationMs: 0,
        formatted: `[Agent: ${agent.name}]\n[Tool: ${tool.name}]\n[Target: ${target.value}]\n\nError: ${error?.message ?? String(error)}`,
      };
    }
  }

  /**
   * Format response from new framework execution
   */
  private formatNewFrameworkResponse(
    agent: any,
    config: ToolConfiguration,
    target: any,
    result: any
  ): string {
    const lines = [
      `[Agent: ${agent.name}]`,
      `[Tool: ${config.name}]`,
      `[Target: ${target.value}]`,
      `[Status: ${result.status === 'completed' ? 'SUCCESS' : 'FAILED'}]`,
      `[Duration: ${result.duration}ms]`,
      '',
    ];

    // Include parsed output if available
    if (result.parsedOutput) {
      lines.push('=== Parsed Results ===');
      lines.push(JSON.stringify(result.parsedOutput, null, 2));
      lines.push('');
    }

    // Include raw output
    if (result.stdout) {
      lines.push('=== Output ===');
      lines.push(result.stdout);
      lines.push('');
    }

    if (result.stderr) {
      lines.push('=== Errors ===');
      lines.push(result.stderr);
      lines.push('');
    }

    if (result.error) {
      lines.push('=== Error ===');
      lines.push(result.error);
      lines.push('');
    }

    return lines.join('\n');
  }

  private async executeAgentWithTool(
    agent: any,
    tool: any,
    target: any,
    input: string
  ): Promise<AgentToolResult> {
    // Build context for AI agent
    const context = {
      tool: {
        name: tool.name,
        category: tool.category,
        description: tool.description,
        metadata: tool.metadata,
      },
      target: {
        name: target.name,
        type: target.type,
        value: target.value,
        description: target.description,
      },
      input,
    };

    // Ferry dispatch: when FF_FERRY_BRIDGE is enabled and the tool has a
    // harness skill mapping, route through nexus-harness via the ferry
    // gateway. Falls back to Docker on failure.
    const flags = readFeatureFlags(process.env);
    const toolName = tool.toolId || tool.name;
    if (flags.ferryBridge && harnessToolExecutor.hasSkillMapping(toolName)) {
      try {
        const harnessResult = await harnessToolExecutor.executeViaHarness(
          toolName,
          this.parseInputParameters(input, {}),
          undefined,
          agentId,
        );
        return {
          success: harnessResult.success,
          exitCode: harnessResult.success ? 0 : 1,
          stdout: harnessResult.output,
          stderr: harnessResult.success ? "" : harnessResult.output,
          durationMs: harnessResult.executionTimeMs,
          formatted: [
            `[Agent: ${agent.name}]`,
            `[Tool: ${tool.name}]`,
            `[Backend: Ferry/Harness]`,
            `[Skill: ${harnessResult.skillName}]`,
            `[Status: ${harnessResult.success ? "SUCCESS" : "FAILED"}]`,
            `[Duration: ${harnessResult.executionTimeMs}ms]`,
            "",
            harnessResult.output,
          ].join("\n"),
        };
      } catch (ferryErr) {
        log.warn(
          `[ferry dispatch] Failed for ${toolName}, falling back to Docker: ${ferryErr}`
        );
      }
    }

    // If tool has Docker configuration, execute via Docker
    if (tool.dockerImage === "rtpi-tools") {
      return await this.executeToolInDocker(agent, tool, target, context);
    }

    // Non-containerized tool: the only real execution backend left is MCP.
    // Tool execution is a function of the TOOL, not the agent's LLM provider —
    // so we route by capability, not by agent.type. The previous
    // executeOpenAI/executeAnthropic/executeCustom branches returned hard-coded
    // fictional "success" strings (architectural hallucination); they are gone.
    // An MCP-attached agent invokes the tool over JSON-RPC; anything else fails
    // honestly so a caller never mistakes a fabricated string for a real run.
    const mcpServerIds = resolveAgentMcpServerIds(agent.config);
    if (agent.type === "mcp_server" || mcpServerIds.length > 0) {
      return await this.executeMCP(agent, tool, target, context);
    }

    throw new Error(
      `Tool "${tool.name}" has no executable backend for agent "${agent.name}" ` +
        `(type "${agent.type}"). Use a containerized (rtpi-tools) tool, or attach ` +
        `the agent to an MCP server that provides this tool.`,
    );
  }

  /**
   * Execute tool in Docker container
   */
  private async executeToolInDocker(
    agent: any,
    tool: any,
    target: any,
    context: any
  ): Promise<AgentToolResult> {
    try {
      // Build command from tool metadata and target
      const command = this.buildCommand(tool, target, context.input);

      log.info(`[Agent: ${agent.name}] Executing tool: ${tool.name}`);
      log.info(`[Command] ${command.join(" ")}`);

      // Execute command in rtpi-tools container
      const result = await dockerExecutor.exec("rtpi-tools", command, {
        timeout: 300000, // 5 minutes
      });

      // Parse output based on tool's output parser
      const parsedOutput = this.parseToolOutput(tool, result);

      return {
        success: parsedOutput.success,
        exitCode: typeof parsedOutput.exitCode === 'number' ? parsedOutput.exitCode : null,
        stdout: parsedOutput.stdout ?? '',
        stderr: parsedOutput.stderr ?? '',
        durationMs: result.duration ?? 0,
        formatted: this.formatAgentResponse(agent, tool, target, parsedOutput),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`[Agent: ${agent.name}] Tool execution failed:`, errorMsg);

      const failOutput = { success: false, error: errorMsg, stdout: "", stderr: errorMsg };
      return {
        success: false,
        exitCode: null,
        stdout: '',
        stderr: errorMsg,
        durationMs: 0,
        formatted: this.formatAgentResponse(agent, tool, target, failOutput),
      };
    }
  }

  /**
   * Build command from tool template and parameters
   */
  private buildCommand(tool: any, target: any, input: string): string[] {
    const metadata = tool.metadata || {};
    const template = metadata.commandTemplate || tool.command;
    
    // Parse input for parameters
    const params = this.parseInputParameters(input, metadata.parameterSchema);
    
    // Add target value if not already in params
    if (!params.target && target) {
      params.target = target.value;
    }

    // Build command from template
    let commandStr = template;
    
    // Replace placeholders with actual values
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{${key}}`;
      if (commandStr.includes(placeholder)) {
        commandStr = commandStr.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
      }
    }

    // Remove empty placeholders
    commandStr = commandStr.replace(/\{[^}]+\}/g, '').trim();
    
    // Split into array, respecting quotes
    return this.splitCommand(commandStr);
  }

  /**
   * Parse input string for parameters
   */
  private parseInputParameters(input: string, _schema: any = {}): Record<string, any> {
    const params: Record<string, any> = {};
    
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(input);
      if (typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Not JSON, parse as key=value pairs
    }

    // Parse key=value format
    const matches = input.matchAll(/(\w+)=(['"]?)([^\s'"]+)\2/g);
    for (const match of matches) {
      params[match[1]] = match[3];
    }

    return params;
  }

  /**
   * Split command string into array, respecting quotes
   */
  private splitCommand(cmd: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < cmd.length; i++) {
      const char = cmd[i];
      
      if ((char === '"' || char === "'") && (i === 0 || cmd[i-1] !== '\\')) {
        if (!inQuote) {
          inQuote = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuote = false;
          quoteChar = '';
        } else {
          current += char;
        }
      } else if (char === ' ' && !inQuote) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Parse tool output based on tool type
   */
  private parseToolOutput(tool: any, result: any): any {
    const parser = tool.metadata?.outputParser || 'text';
    
    return {
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      duration: result.duration,
      parser,
      raw: result,
    };
  }

  /**
   * Format response for agent
   */
  private formatAgentResponse(
    agent: any,
    tool: any,
    target: any,
    output: any
  ): string {
    const lines = [
      `[Agent: ${agent.name}]`,
      `[Tool: ${tool.name}]`,
      `[Target: ${target.value}]`,
      `[Status: ${output.success ? 'SUCCESS' : 'FAILED'}]`,
      '',
    ];

    if (output.stdout) {
      lines.push('=== Output ===');
      lines.push(output.stdout);
      lines.push('');
    }

    if (output.stderr) {
      lines.push('=== Errors ===');
      lines.push(output.stderr);
      lines.push('');
    }

    if (output.error) {
      lines.push('=== Error ===');
      lines.push(output.error);
      lines.push('');
    }

    if (output.duration) {
      lines.push(`Duration: ${output.duration}ms`);
    }

    return lines.join('\n');
  }

  /**
   * Execute a tool over MCP (JSON-RPC 2.0 via the spawned server's stdio).
   * Resolves the agent's attached MCP servers, finds the running one that owns
   * the tool, and invokes it. Throws on any failure — never fabricates output.
   * Mirrors the resolution in `agent-mcp.ts POST /agents/:id/mcp-call`.
   */
  private async executeMCP(agent: any, tool: any, target: any, context: any): Promise<AgentToolResult> {
    const startedAt = Date.now();
    const serverIds = resolveAgentMcpServerIds(agent.config);
    if (serverIds.length === 0) {
      throw new Error(`Agent "${agent.name}" has no MCP servers configured.`);
    }

    const rows = await Promise.all(
      serverIds.map((id) =>
        db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1).then((r) => r[0]),
      ),
    );
    const running = rows.filter(
      (s): s is NonNullable<typeof s> => Boolean(s) && s.status === "running",
    );
    if (running.length === 0) {
      throw new Error(`No running MCP server attached to agent "${agent.name}".`);
    }

    const toolName: string = tool.name;
    let server: (typeof running)[number] | null = null;
    for (const candidate of running) {
      try {
        const tools = await mcpInvoker.listTools(candidate.id);
        if (tools.some((t) => t.name === toolName)) {
          server = candidate;
          break;
        }
      } catch {
        // Server may have crashed mid-loop; try the next attached one.
      }
    }
    if (!server) {
      throw new Error(
        `Tool "${toolName}" not found on any attached MCP server for agent "${agent.name}".`,
      );
    }

    // Merge parsed input params with the target value so the MCP tool receives
    // the same arguments a containerized tool would.
    const args = this.parseInputParameters(context.input, {});
    if (!args.target && target?.value) args.target = target.value;

    const result = await mcpInvoker.callTool(server.id, toolName, args);
    const blocks = Array.isArray((result as any).content) ? (result as any).content : [];
    const text = blocks
      .map((b: any) => (typeof b?.text === "string" ? b.text : JSON.stringify(b)))
      .join("\n");
    const isError = Boolean((result as any).isError);

    return {
      success: !isError,
      exitCode: isError ? 1 : 0,
      stdout: text,
      stderr: isError ? text : "",
      durationMs: Date.now() - startedAt,
      formatted: [
        `[Agent: ${agent.name}]`,
        `[MCP Tool: ${toolName}]`,
        `[Server: ${server.name}]`,
        `[Status: ${isError ? "FAILED" : "SUCCESS"}]`,
        "",
        text,
      ].join("\n"),
    };
  }
}

export const agentToolConnector = new AgentToolConnector();

/**
 * Agent Loop Execution
 * Manages iterative agent-to-agent communication for payload refinement
 */
export interface LoopExecution {
  id: string;
  agentId: string;
  partnerId: string;
  // Full participant ring. For a pairwise loop this is [agentId, partnerId];
  // a canvas "Add To Loop" group can have N>=2 agents that take turns in order.
  agentIds: string[];
  targetId: string;
  currentIteration: number;
  maxIterations: number;
  maxDurationMs: number; // Timeout in milliseconds
  exitCondition: string;
  status: "running" | "completed" | "failed" | "max_iterations_reached" | "timeout" | "stagnant";
  iterations: LoopIteration[];
  startedAt: Date;
  completedAt?: Date;
  terminationReason?: string;
}

export interface LoopIteration {
  iteration: number;
  agentId: string;
  input: string;
  output: string;
  success: boolean;
  exitConditionMet: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

class AgentLoopService {
  private activeLoops = new Map<string, LoopExecution>();

  async startLoop(
    agentId: string,
    targetId: string,
    initialInput: string
  ): Promise<LoopExecution | null> {
    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1)
      .then((rows) => rows[0]);

    const config = agent.config as any;
    
    if (!agent || !config?.loopEnabled || !config?.loopPartnerId) {
      throw new Error("Agent not configured for looping");
    }

    const partner = await db
      .select()
      .from(agents)
      .where(eq(agents.id, config.loopPartnerId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!partner) {
      throw new Error("Loop partner agent not found");
    }

    // Delegate to the shared ring runner with a 2-agent ring. The pairwise
    // settings (maxIterations / exitCondition) come from the lead agent's config.
    return this.startLoopGroup([agentId, partner.id], targetId, initialInput, {
      maxIterations: config?.maxLoopIterations || 5,
      maxDurationSec: config?.maxLoopDuration || 300,
      exitCondition: config?.loopExitCondition || "functional_poc",
    });
  }

  /**
   * Start a loop across N agents that take turns in ring order. This backs the
   * canvas "Add To Loop" feature. A 2-agent ring is exactly the legacy pairwise
   * loop, so startLoop() funnels through here too.
   */
  async startLoopGroup(
    agentIds: string[],
    targetId: string,
    initialInput: string,
    options: { maxIterations?: number; maxDurationSec?: number; exitCondition?: string } = {}
  ): Promise<LoopExecution | null> {
    const ring = (agentIds || []).filter(Boolean);
    if (ring.length < 1) {
      throw new Error("A loop requires at least one agent");
    }

    // Validate every participant exists.
    const rows = await db.select().from(agents).where(inArray(agents.id, ring));
    const found = new Set(rows.map((r) => r.id));
    const missing = ring.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new Error(`Loop participant agent(s) not found: ${missing.join(", ")}`);
    }

    const loopId = `loop_${ring[0]}_${ring.length}_${Date.now()}`;
    const loopExecution: LoopExecution = {
      id: loopId,
      agentId: ring[0],
      partnerId: ring[1] ?? ring[0],
      agentIds: ring,
      targetId,
      currentIteration: 0,
      maxIterations: options.maxIterations || 5,
      maxDurationMs: (options.maxDurationSec || 300) * 1000,
      exitCondition: options.exitCondition || "functional_poc",
      status: "running",
      iterations: [],
      startedAt: new Date(),
    };

    this.activeLoops.set(loopId, loopExecution);

    // Start loop execution in background
    this.executeLoop(loopExecution, initialInput).catch((error) => {
      log.error("Loop execution error:", error);
      loopExecution.status = "failed";
      loopExecution.completedAt = new Date();
    });

    return loopExecution;
  }

  private async executeLoop(
    loop: LoopExecution,
    input: string
  ): Promise<void> {
    let currentInput = input;
    // Round-robin position within the participant ring (loop.agentIds).
    const ring = loop.agentIds.length > 0 ? loop.agentIds : [loop.agentId];
    let ringIndex = 0;
    let currentAgentId = ring[ringIndex];
    const startTime = Date.now();

    // Circuit breaker: track recent output hashes to detect stagnation
    const recentOutputHashes: string[] = [];
    const maxConsecutiveRepeats = 3;

    while (
      loop.currentIteration < loop.maxIterations &&
      loop.status === "running"
    ) {
      // Timeout check
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > loop.maxDurationMs) {
        loop.status = "timeout";
        loop.terminationReason = `Loop timeout after ${Math.round(elapsedMs / 1000)}s (max: ${Math.round(loop.maxDurationMs / 1000)}s)`;
        loop.completedAt = new Date();
        log.warn(`[AgentLoop] ${loop.id} timed out after ${loop.currentIteration} iterations`);
        break;
      }

      try {
        // Execute current agent with target context. execute() now returns a
        // structured AgentToolResult; this legacy loop works in plain text, so
        // take the formatted view.
        const output = (await agentToolConnector.execute(
          currentAgentId,
          "", // No specific tool for general analysis
          loop.targetId,
          currentInput
        )).formatted;

        // Circuit breaker: check for stagnant outputs
        const outputHash = this.hashOutput(output);
        recentOutputHashes.push(outputHash);

        if (recentOutputHashes.length >= maxConsecutiveRepeats) {
          const lastN = recentOutputHashes.slice(-maxConsecutiveRepeats);
          const allSame = lastN.every(h => h === lastN[0]);
          if (allSame) {
            loop.status = "stagnant";
            loop.terminationReason = `Agent outputs are repeating (${maxConsecutiveRepeats} identical responses)`;
            loop.completedAt = new Date();
            log.warn(`[AgentLoop] ${loop.id} detected stagnant output after ${loop.currentIteration + 1} iterations`);
            break;
          }
        }

        // Check exit condition
        const exitConditionMet = this.checkExitCondition(
          loop.exitCondition,
          output
        );

        const iteration: LoopIteration = {
          iteration: loop.currentIteration + 1,
          agentId: currentAgentId,
          input: currentInput,
          output,
          success: true,
          exitConditionMet,
          timestamp: new Date(),
        };

        loop.iterations.push(iteration);
        loop.currentIteration++;

        if (exitConditionMet) {
          loop.status = "completed";
          loop.completedAt = new Date();
          break;
        }

        // Advance to the next agent in the ring for the next iteration
        ringIndex = (ringIndex + 1) % ring.length;
        currentAgentId = ring[ringIndex];
        currentInput = output;
      } catch (error) {
        const iteration: LoopIteration = {
          iteration: loop.currentIteration + 1,
          agentId: currentAgentId,
          input: currentInput,
          output: `Error: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
          exitConditionMet: false,
          timestamp: new Date(),
        };

        loop.iterations.push(iteration);
        loop.status = "failed";
        loop.terminationReason = error instanceof Error ? error.message : String(error);
        loop.completedAt = new Date();
        break;
      }
    }

    if (
      loop.currentIteration >= loop.maxIterations &&
      loop.status === "running"
    ) {
      loop.status = "max_iterations_reached";
      loop.terminationReason = `Reached maximum iterations (${loop.maxIterations})`;
      loop.completedAt = new Date();
    }
  }

  /**
   * Simple hash function for output comparison (circuit breaker)
   */
  private hashOutput(output: string): string {
    // Use a simple hash for comparison - normalize whitespace and case
    const normalized = output.toLowerCase().replace(/\s+/g, ' ').trim();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private checkExitCondition(condition: string, output: string): boolean {
    const outputLower = output.toLowerCase();

    // Check for negation patterns that would invalidate a positive match
    const negationPatterns = [
      "not a ", "not an ", "isn't ", "is not ", "cannot ", "can't ",
      "failed to ", "unable to ", "no ", "none ", "without ",
      "doesn't ", "does not ", "didn't ", "did not ", "wasn't ", "were not "
    ];

    // Helper to check if a keyword appears in a negated context
    const isNegated = (keyword: string): boolean => {
      const keywordIndex = outputLower.indexOf(keyword);
      if (keywordIndex === -1) return false;

      // Check if any negation pattern appears within 50 chars before the keyword
      const contextStart = Math.max(0, keywordIndex - 50);
      const context = outputLower.slice(contextStart, keywordIndex);

      return negationPatterns.some(neg => context.includes(neg));
    };

    switch (condition) {
      case "functional_poc": {
        const hasFunctional = outputLower.includes("functional");
        const hasPoc = outputLower.includes("poc") || outputLower.includes("proof of concept");
        const hasWorking = outputLower.includes("working") || outputLower.includes("successful");

        // Must have all required keywords and none should be negated
        if (!(hasFunctional && hasPoc && hasWorking)) return false;
        if (isNegated("functional") || isNegated("poc") || isNegated("proof of concept")) return false;
        if (isNegated("working") || isNegated("successful")) return false;
        return true;
      }

      case "vulnerability_confirmed": {
        const hasConfirmed = outputLower.includes("confirmed");
        const hasVerified = outputLower.includes("verified");
        const hasExploitable = outputLower.includes("exploitable");

        // At least one must be present and not negated
        if (hasConfirmed && !isNegated("confirmed")) return true;
        if (hasVerified && !isNegated("verified")) return true;
        if (hasExploitable && !isNegated("exploitable")) return true;
        return false;
      }

      case "exploit_successful": {
        const hasExploit = outputLower.includes("exploit");
        const hasSuccessful = outputLower.includes("successful") || outputLower.includes("working");

        if (!(hasExploit && hasSuccessful)) return false;
        if (isNegated("exploit") || isNegated("successful") || isNegated("working")) return false;
        return true;
      }

      default:
        return false;
    }
  }

  getActiveLoops(): LoopExecution[] {
    return Array.from(this.activeLoops.values());
  }

  getLoop(loopId: string): LoopExecution | undefined {
    return this.activeLoops.get(loopId);
  }

  stopLoop(loopId: string): boolean {
    const loop = this.activeLoops.get(loopId);
    if (loop && loop.status === "running") {
      loop.status = "completed";
      loop.completedAt = new Date();
      return true;
    }
    return false;
  }
}

export const agentLoopService = new AgentLoopService();
