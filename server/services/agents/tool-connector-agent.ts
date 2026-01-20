/**
 * Tool Connector Agent
 *
 * Autonomously polls the rtpi-tools container to discover available tools,
 * their parameters, and capabilities. Maintains the tool registry in sync
 * with the actual container state.
 *
 * Capabilities:
 * - tool_discovery: Discover tools in rtpi-tools container
 * - tool_registry_sync: Synchronize tool registry database
 */

import { db } from '../../db';
import { agents, toolRegistry, toolParameters } from '../../../shared/schema';
import { DockerExecutor } from '../docker-executor';
import { eq, and } from 'drizzle-orm';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface DiscoveredTool {
  name: string;
  path: string;
  version: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  helpText: string;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'enum';
  required: boolean;
  default?: any;
  description: string;
  enumValues?: string[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface ToolConnectorConfig {
  pollIntervalMs: number;
  containerName: string;
  toolsBasePath: string;
  enabledCategories: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ToolConnectorConfig = {
  pollIntervalMs: 300000, // 5 minutes
  containerName: 'rtpi-tools',
  toolsBasePath: '/home/rtpi-tools',
  enabledCategories: ['reconnaissance', 'vulnerability', 'exploitation', 'web', 'network'],
};

// ============================================================================
// Tool Connector Agent
// ============================================================================

export class ToolConnectorAgent extends EventEmitter {
  private config: ToolConnectorConfig;
  private dockerExecutor: DockerExecutor;
  private pollInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastPollTime: Date | null = null;
  private agentId: string | null = null;

  // Tool discovery commands for different tool types
  private readonly TOOL_DISCOVERY_COMMANDS: Record<string, string[]> = {
    reconnaissance: [
      'which nmap && nmap --version 2>&1 | head -2',
      'which bbot && bbot --version 2>&1 | head -1',
      'which amass && amass -version 2>&1 | head -1',
      'which subfinder && subfinder -version 2>&1 | head -1',
      'which httpx && httpx -version 2>&1 | head -1',
      'which katana && katana -version 2>&1 | head -1',
      'which dnsx && dnsx -version 2>&1 | head -1',
    ],
    vulnerability: [
      'which nuclei && nuclei -version 2>&1 | head -1',
      'which nikto && nikto -Version 2>&1 | head -2',
      'which wpscan && wpscan --version 2>&1 | head -1',
      'which sqlmap && sqlmap --version 2>&1 | head -1',
    ],
    web: [
      'which ffuf && ffuf -V 2>&1 | head -1',
      'which gobuster && gobuster version 2>&1 | head -1',
      'which feroxbuster && feroxbuster --version 2>&1 | head -1',
      'which dirsearch && dirsearch --version 2>&1 | head -1',
    ],
    network: [
      'which masscan && masscan --version 2>&1 | head -2',
      'which rustscan && rustscan --version 2>&1 | head -1',
      'which testssl.sh && testssl.sh --version 2>&1 | head -1',
    ],
    exploitation: [
      'which msfconsole && msfconsole --version 2>&1 | head -1',
      'which searchsploit && searchsploit --version 2>&1 | head -1',
    ],
  };

  // Parameter extraction patterns for common tools
  private readonly HELP_PARSE_PATTERNS: Record<string, RegExp> = {
    nmap: /(-[a-zA-Z0-9]+)\s+(.+?)(?=\n\s+-|$)/gs,
    nuclei: /(-[a-z-]+),?\s*(?:--([a-z-]+))?\s+(\w+)?\s*(.+?)(?=\n\s+-|$)/gs,
    bbot: /--([a-z-]+)\s+(\w+)?\s*(.+?)(?=\n\s+--|$)/gs,
    generic: /(--?[a-zA-Z][-a-zA-Z0-9]*)\s*(?:[=\s](\w+))?\s*(.+?)(?=\n\s+-|$)/gs,
  };

  constructor(config: Partial<ToolConnectorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dockerExecutor = new DockerExecutor();
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    // Check if agent exists, create if not
    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.name, 'Tool Connector Agent'));

    if (existingAgent) {
      this.agentId = existingAgent.id;
      console.log(`Tool Connector Agent found: ${this.agentId}`);
    } else {
      const [newAgent] = await db
        .insert(agents)
        .values({
          name: 'Tool Connector Agent',
          type: 'custom',
          status: 'idle',
          config: {
            handlerPath: './agents/tool-connector-agent',
            pollIntervalMs: this.config.pollIntervalMs,
          },
          capabilities: ['tool_discovery', 'tool_registry_sync'],
        })
        .returning();
      this.agentId = newAgent.id;
      console.log(`Tool Connector Agent created: ${this.agentId}`);
    }

    // Register with dynamic workflow orchestrator
    try {
      const { dynamicWorkflowOrchestrator } = await import('../dynamic-workflow-orchestrator');
      await dynamicWorkflowOrchestrator.registerAgent(
        this.agentId,
        [
          {
            capability: 'tool_discovery',
            inputTypes: [],
            outputTypes: ['tool_list', 'tool_parameters'],
            priority: 10,
          },
          {
            capability: 'tool_registry_sync',
            inputTypes: ['tool_list'],
            outputTypes: ['registry_update_event'],
            priority: 10,
          },
        ],
        [] // No dependencies
      );
      console.log('Tool Connector Agent registered with orchestrator');
    } catch (error) {
      console.warn('Could not register with orchestrator:', error);
    }
  }

  /**
   * Start the agent (begin polling)
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Tool Connector Agent already running');
      return;
    }

    this.isRunning = true;
    await this.updateAgentStatus('running');
    this.emit('started');

    // Initial poll
    try {
      await this.poll();
    } catch (error) {
      console.error('Initial poll failed:', error);
    }

    // Set up recurring poll
    this.pollInterval = setInterval(async () => {
      try {
        await this.poll();
      } catch (error) {
        console.error('Poll failed:', error);
        this.emit('poll_error', error);
      }
    }, this.config.pollIntervalMs);

    console.log(`Tool Connector Agent started, polling every ${this.config.pollIntervalMs / 1000}s`);
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    await this.updateAgentStatus('idle');
    this.emit('stopped');
    console.log('Tool Connector Agent stopped');
  }

  /**
   * Update agent status in database
   */
  private async updateAgentStatus(status: 'idle' | 'running' | 'error'): Promise<void> {
    if (this.agentId) {
      await db
        .update(agents)
        .set({ status, lastActivity: new Date() })
        .where(eq(agents.id, this.agentId));
    }
  }

  /**
   * Execute a single poll cycle
   */
  async poll(): Promise<DiscoveredTool[]> {
    console.log('Tool Connector Agent: Starting poll...');
    this.lastPollTime = new Date();

    try {
      // Discover all tools
      const discoveredTools: DiscoveredTool[] = [];

      for (const category of this.config.enabledCategories) {
        const commands = this.TOOL_DISCOVERY_COMMANDS[category] || [];

        for (const cmd of commands) {
          try {
            const tool = await this.discoverTool(cmd, category);
            if (tool) {
              discoveredTools.push(tool);
            }
          } catch (error) {
            // Tool not found or error - skip silently
            console.debug(`Tool discovery skipped: ${cmd.split('&&')[0].trim()}`);
          }
        }
      }

      // Sync to registry
      await this.syncRegistry(discoveredTools);

      this.emit('poll_complete', discoveredTools);
      console.log(`Tool Connector Agent: Discovered ${discoveredTools.length} tools`);

      // Update agent stats
      if (this.agentId) {
        await db
          .update(agents)
          .set({
            tasksCompleted: discoveredTools.length,
            lastActivity: new Date(),
          })
          .where(eq(agents.id, this.agentId));
      }

      return discoveredTools;

    } catch (error) {
      console.error('Tool Connector Agent poll failed:', error);
      await this.updateAgentStatus('error');
      this.emit('poll_error', error);
      throw error;
    }
  }

  /**
   * Discover a single tool
   */
  private async discoverTool(versionCmd: string, category: string): Promise<DiscoveredTool | null> {
    // Execute version command in container
    const result = await this.dockerExecutor.exec(versionCmd, {
      timeout: 15000,
    });

    if (result.exitCode !== 0 || !result.stdout) {
      return null;
    }

    // Parse tool name from command
    const toolName = versionCmd.split('which ')[1]?.split(' ')[0]?.trim();
    if (!toolName) return null;

    // Get tool path
    const whichResult = await this.dockerExecutor.exec(`which ${toolName}`, {
      timeout: 5000,
    });
    const toolPath = whichResult.stdout?.trim() || `/usr/bin/${toolName}`;

    // Parse version from output
    const version = this.parseVersion(result.stdout);

    // Get help text and parse parameters
    let helpText = '';
    let parameters: ToolParameter[] = [];

    try {
      const helpResult = await this.dockerExecutor.exec(
        `${toolName} --help 2>&1 || ${toolName} -h 2>&1 || true`,
        { timeout: 15000 }
      );
      helpText = helpResult.stdout?.substring(0, 10000) || '';
      parameters = this.parseParameters(toolName, helpText);
    } catch (error) {
      // Help command failed, continue without parameters
    }

    const description = this.parseDescription(helpText);

    return {
      name: toolName,
      path: toolPath,
      version,
      description,
      category,
      parameters,
      helpText: helpText.substring(0, 5000), // Limit stored help text
    };
  }

  /**
   * Parse version from tool output
   */
  private parseVersion(output: string): string {
    // Common version patterns
    const patterns = [
      /v?(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.]+)?)/,
      /version\s+v?(\d+\.\d+(?:\.\d+)?)/i,
      /(\d+\.\d+(?:\.\d+)?)/,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return 'unknown';
  }

  /**
   * Parse description from help output
   */
  private parseDescription(helpText: string): string {
    if (!helpText) return '';

    // Get first non-empty line that isn't a usage line
    const lines = helpText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.toLowerCase().startsWith('usage') &&
        !trimmed.startsWith('-') &&
        !trimmed.startsWith('[') &&
        trimmed.length > 10 &&
        trimmed.length < 500
      ) {
        return trimmed.substring(0, 200);
      }
    }
    return '';
  }

  /**
   * Parse parameters from help text
   */
  private parseParameters(toolName: string, helpText: string): ToolParameter[] {
    if (!helpText) return [];

    const parameters: ToolParameter[] = [];
    const seenParams = new Set<string>();

    // Get tool-specific or generic pattern
    const patternKey = Object.keys(this.HELP_PARSE_PATTERNS).find(k =>
      toolName.toLowerCase().includes(k)
    ) || 'generic';

    const pattern = new RegExp(this.HELP_PARSE_PATTERNS[patternKey].source, 'gm');

    let match;
    while ((match = pattern.exec(helpText)) !== null) {
      const [_, flag, longFlag, argType, description] = match;

      const paramName = (longFlag || flag)?.replace(/^-+/, '');
      if (!paramName || paramName.length < 2 || seenParams.has(paramName)) continue;

      seenParams.add(paramName);

      // Determine parameter type
      let type: ToolParameter['type'] = 'boolean';
      const argTypeLower = argType?.toLowerCase() || '';
      const descLower = description?.toLowerCase() || '';

      if (argTypeLower) {
        if (['int', 'num', 'number', 'port', 'count'].some(t => argTypeLower.includes(t))) {
          type = 'number';
        } else if (['file', 'path', 'string', 'str', 'url', 'host', 'target', 'dir'].some(t => argTypeLower.includes(t))) {
          type = 'string';
        } else if (argTypeLower.includes('list') || argTypeLower.includes(',')) {
          type = 'array';
        }
      }

      // Check description for type hints
      if (descLower.includes('file') || descLower.includes('path')) {
        type = 'string';
      }

      // Check for required indicators
      const required = descLower.includes('required') || descLower.includes('mandatory');

      parameters.push({
        name: paramName,
        type,
        required,
        description: description?.trim()?.substring(0, 200) || '',
      });

      // Limit parameters to avoid noise
      if (parameters.length >= 50) break;
    }

    return parameters;
  }

  /**
   * Sync discovered tools to registry
   */
  private async syncRegistry(tools: DiscoveredTool[]): Promise<void> {
    for (const tool of tools) {
      try {
        // Check if tool exists by name
        const [existing] = await db
          .select()
          .from(toolRegistry)
          .where(eq(toolRegistry.toolId, tool.name));

        if (existing) {
          // Update existing tool
          await db
            .update(toolRegistry)
            .set({
              version: tool.version,
              description: tool.description || existing.description,
              binaryPath: tool.path,
              updatedAt: new Date(),
            })
            .where(eq(toolRegistry.id, existing.id));

          // Update parameters
          await this.syncParameters(existing.id, tool.parameters);

        } else {
          // Insert new tool
          const [newTool] = await db
            .insert(toolRegistry)
            .values({
              toolId: tool.name,
              name: this.formatDisplayName(tool.name),
              category: tool.category as any,
              version: tool.version,
              description: tool.description,
              binaryPath: tool.path,
              installMethod: 'manual',
              installStatus: 'installed',
              config: {
                helpText: tool.helpText,
              },
            })
            .returning();

          // Insert parameters
          await this.syncParameters(newTool.id, tool.parameters);
        }
      } catch (error) {
        console.error(`Failed to sync tool ${tool.name}:`, error);
      }
    }

    this.emit('registry_synced', tools.length);
  }

  /**
   * Sync parameters for a tool
   */
  private async syncParameters(toolId: string, parameters: ToolParameter[]): Promise<void> {
    // Delete existing parameters
    await db.delete(toolParameters).where(eq(toolParameters.toolId, toolId));

    // Insert new parameters
    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      try {
        await db.insert(toolParameters).values({
          toolId,
          parameterName: param.name,
          parameterType: param.type as any,
          description: param.description,
          required: param.required,
          defaultValue: param.default?.toString(),
          enumValues: param.enumValues || [],
          displayOrder: i,
        });
      } catch (error) {
        // Skip duplicate or invalid parameters
      }
    }
  }

  /**
   * Format tool/parameter name for display
   */
  private formatDisplayName(name: string): string {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Execute handler for workflow orchestrator
   */
  static async execute(context: Record<string, any>): Promise<DiscoveredTool[]> {
    const agent = new ToolConnectorAgent(context.config);
    await agent.initialize();
    return agent.poll();
  }

  /**
   * Get agent status
   */
  getStatus(): {
    isRunning: boolean;
    lastPollTime: Date | null;
    agentId: string | null;
    config: ToolConnectorConfig;
  } {
    return {
      isRunning: this.isRunning,
      lastPollTime: this.lastPollTime,
      agentId: this.agentId,
      config: this.config,
    };
  }
}

// Singleton instance
export const toolConnectorAgent = new ToolConnectorAgent();

// Export execute function for dynamic import
export const execute = ToolConnectorAgent.execute;
