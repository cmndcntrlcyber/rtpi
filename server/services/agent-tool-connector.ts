import { db } from "../db";
import { agents, targets, securityTools, mcpServers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { dockerExecutor } from "./docker-executor";
import { metasploitExecutor } from "./metasploit-executor";

/**
 * Generic Agent-Tool Connector
 * Links any AI agent with any security tool for automated execution
 */
export class AgentToolConnector {
  /**
   * Execute a tool using an AI agent's guidance
   */
  async execute(
    agentId: string,
    toolId: string,
    targetId: string,
    input: string
  ): Promise<string> {
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

    // Get tool configuration
    const tool = await db
      .select()
      .from(securityTools)
      .where(eq(securityTools.id, toolId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

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

    // Execute based on agent type
    return await this.executeAgentWithTool(agent, tool, target, input);
  }

  private async executeAgentWithTool(
    agent: any,
    tool: any,
    target: any,
    input: string
  ): Promise<string> {
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

    // If tool has Docker configuration, execute via Docker
    if (tool.dockerImage === "rtpi-tools") {
      return await this.executeToolInDocker(agent, tool, target, context);
    }

    // Otherwise, use agent-specific execution
    switch (agent.type) {
      case "openai":
        return await this.executeOpenAI(agent, context);
      case "anthropic":
        return await this.executeAnthropic(agent, context);
      case "mcp_server":
        return await this.executeMCP(agent, context);
      case "custom":
        return await this.executeCustom(agent, context);
      default:
        throw new Error(`Unsupported agent type: ${agent.type}`);
    }
  }

  /**
   * Execute tool in Docker container
   */
  private async executeToolInDocker(
    agent: any,
    tool: any,
    target: any,
    context: any
  ): Promise<string> {
    try {
      // Build command from tool metadata and target
      const command = this.buildCommand(tool, target, context.input);
      
      console.log(`[Agent: ${agent.name}] Executing tool: ${tool.name}`);
      console.log(`[Command] ${command.join(" ")}`);

      // Execute command in rtpi-tools container
      const result = await dockerExecutor.exec("rtpi-tools", command, {
        timeout: 300000, // 5 minutes
      });

      // Parse output based on tool's output parser
      const parsedOutput = this.parseToolOutput(tool, result);

      // Format result for agent
      return this.formatAgentResponse(agent, tool, target, parsedOutput);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Agent: ${agent.name}] Tool execution failed:`, errorMsg);
      
      return this.formatAgentResponse(agent, tool, target, {
        success: false,
        error: errorMsg,
        stdout: "",
        stderr: errorMsg,
      });
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
  private parseInputParameters(input: string, schema: any = {}): Record<string, any> {
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

  private async executeOpenAI(agent: any, context: any): Promise<string> {
    // Placeholder - integrate with OpenAI API
    const prompt = agent.config?.systemPrompt || "You are a security testing assistant";
    return `[OpenAI Agent: ${agent.name}]\n\nTool: ${context.tool.name}\nTarget: ${context.target.value}\n\nAnalysis: Automated vulnerability assessment initiated.\nRecommendation: Continue with payload development.`;
  }

  private async executeAnthropic(agent: any, context: any): Promise<string> {
    // Placeholder - integrate with Anthropic API
    const prompt = agent.config?.systemPrompt || "You are a security researcher";
    return `[Anthropic Agent: ${agent.name}]\n\nTool: ${context.tool.name}\nTarget: ${context.target.value}\n\nDeep analysis: Security posture evaluated.\nNext steps: Exploit chain development.`;
  }

  private async executeMCP(agent: any, context: any): Promise<string> {
    // Get MCP server ID from agent config
    const config = agent.config as any;
    const mcpServerId = config?.mcpServerId;

    if (!mcpServerId) {
      return `[MCP Agent: ${agent.name}]\n\nError: No MCP server configured for this agent.`;
    }

    // Get MCP server details
    const mcpServer = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, mcpServerId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!mcpServer) {
      return `[MCP Agent: ${agent.name}]\n\nError: MCP server not found.`;
    }

    if (mcpServer.status !== "running") {
      return `[MCP Agent: ${agent.name}]\n\nError: MCP server is not running.`;
    }

    // TODO: Integrate with actual MCP server
    // For now, return formatted response
    return `[MCP Agent: ${agent.name}]\n\nMCP Server: ${mcpServer.name}\nTool: ${context.tool.name}\nTarget: ${context.target.value}\n\nMCP server processing complete.\nResults: Tool execution successful.`;
  }

  private async executeCustom(agent: any, context: any): Promise<string> {
    // Placeholder - custom agent logic
    return `[Custom Agent: ${agent.name}]\n\nTool: ${context.tool.name}\nTarget: ${context.target.value}\n\nCustom processing complete.`;
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
  targetId: string;
  currentIteration: number;
  maxIterations: number;
  exitCondition: string;
  status: "running" | "completed" | "failed" | "max_iterations_reached";
  iterations: LoopIteration[];
  startedAt: Date;
  completedAt?: Date;
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

    const loopId = `loop_${agentId}_${partner.id}_${Date.now()}`;

    const loopExecution: LoopExecution = {
      id: loopId,
      agentId,
      partnerId: partner.id,
      targetId,
      currentIteration: 0,
      maxIterations: config?.maxLoopIterations || 5,
      exitCondition: config?.loopExitCondition || "functional_poc",
      status: "running",
      iterations: [],
      startedAt: new Date(),
    };

    this.activeLoops.set(loopId, loopExecution);

    // Start loop execution in background
    this.executeLoop(loopExecution, initialInput).catch((error) => {
      console.error("Loop execution error:", error);
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
    let currentAgentId = loop.agentId;

    while (
      loop.currentIteration < loop.maxIterations &&
      loop.status === "running"
    ) {
      try {
        // Execute current agent with target context
        const output = await agentToolConnector.execute(
          currentAgentId,
          "", // No specific tool for general analysis
          loop.targetId,
          currentInput
        );

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

        // Switch agents for next iteration
        currentAgentId =
          currentAgentId === loop.agentId ? loop.partnerId : loop.agentId;
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
        loop.completedAt = new Date();
        break;
      }
    }

    if (
      loop.currentIteration >= loop.maxIterations &&
      loop.status === "running"
    ) {
      loop.status = "max_iterations_reached";
      loop.completedAt = new Date();
    }
  }

  private checkExitCondition(condition: string, output: string): boolean {
    const outputLower = output.toLowerCase();

    switch (condition) {
      case "functional_poc":
        return (
          outputLower.includes("functional") &&
          (outputLower.includes("poc") ||
            outputLower.includes("proof of concept")) &&
          (outputLower.includes("working") ||
            outputLower.includes("successful"))
        );

      case "vulnerability_confirmed":
        return (
          outputLower.includes("confirmed") ||
          outputLower.includes("verified") ||
          outputLower.includes("exploitable")
        );

      case "exploit_successful":
        return (
          outputLower.includes("exploit") &&
          (outputLower.includes("successful") ||
            outputLower.includes("working"))
        );

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
