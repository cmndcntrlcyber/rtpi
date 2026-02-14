/**
 * Multi-Container Tool Executor
 *
 * Enables any agent to execute tools in any container by looking up
 * the tool's container in the registry and routing execution accordingly.
 */

import { db } from '../../db';
import { toolRegistry } from '../../../shared/schema';
import { DockerExecutor, ExecutionResult, ExecutionOptions } from '../docker-executor';
import { eq } from 'drizzle-orm';

export interface ToolExecutionOptions extends ExecutionOptions {
  /** Override container (useful for testing tools in different containers) */
  containerOverride?: string;
  /** Override user (useful for privilege escalation scenarios) */
  userOverride?: string;
  /** Stream output as it arrives */
  stream?: boolean;
}

export interface ToolInfo {
  toolId: string;
  name: string;
  binaryPath: string;
  containerName: string;
  containerUser: string;
  category: string;
  version: string | null;
}

/**
 * Multi-Container Tool Executor
 *
 * Provides a unified interface for executing security tools across multiple
 * Docker containers. Automatically routes tool execution to the correct
 * container based on the tool registry.
 */
export class MultiContainerExecutor {
  private dockerExecutor: DockerExecutor;
  private toolCache: Map<string, ToolInfo> = new Map();
  private cacheExpiry: number = 60000; // 1 minute
  private lastCacheRefresh: number = 0;

  constructor() {
    this.dockerExecutor = new DockerExecutor();
  }

  /**
   * Execute a tool by name with arguments
   *
   * @param toolName - The tool identifier (e.g., 'nmap', 'nuclei')
   * @param args - Arguments to pass to the tool
   * @param options - Execution options
   * @returns Execution result with stdout, stderr, and exit code
   */
  async executeTool(
    toolName: string,
    args: string[],
    options: ToolExecutionOptions = {}
  ): Promise<ExecutionResult> {
    // Lookup tool in registry
    const toolInfo = await this.getToolInfo(toolName);
    if (!toolInfo) {
      throw new Error(`Tool '${toolName}' not found in registry. Run tool discovery first.`);
    }

    // Determine container and user
    const containerName = options.containerOverride || toolInfo.containerName;
    const containerUser = options.userOverride || toolInfo.containerUser;

    // Build command
    const cmd = [toolInfo.binaryPath, ...args];

    console.log(`[MultiContainerExecutor] Executing ${toolName} in ${containerName} as ${containerUser}`);

    // Execute in container
    return this.dockerExecutor.exec(containerName, cmd, {
      timeout: options.timeout,
      workDir: options.workDir,
      env: options.env,
      user: containerUser,
    });
  }

  /**
   * Execute a tool with streaming output
   *
   * @param toolName - The tool identifier
   * @param args - Arguments to pass to the tool
   * @param options - Execution options
   * @yields Output lines as they arrive
   */
  async *executeToolStream(
    toolName: string,
    args: string[],
    options: ToolExecutionOptions = {}
  ): AsyncIterableIterator<string> {
    const toolInfo = await this.getToolInfo(toolName);
    if (!toolInfo) {
      throw new Error(`Tool '${toolName}' not found in registry.`);
    }

    const containerName = options.containerOverride || toolInfo.containerName;
    const containerUser = options.userOverride || toolInfo.containerUser;
    const cmd = [toolInfo.binaryPath, ...args];

    yield* this.dockerExecutor.execStream(containerName, cmd, {
      timeout: options.timeout,
      workDir: options.workDir,
      env: options.env,
      user: containerUser,
    });
  }

  /**
   * Execute a raw command in a specific container
   *
   * @param containerName - Target container name
   * @param command - Command string to execute
   * @param options - Execution options
   * @returns Execution result
   */
  async executeRawCommand(
    containerName: string,
    command: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    return this.dockerExecutor.exec(
      containerName,
      ['bash', '-c', command],
      options
    );
  }

  /**
   * Get tool information from registry (with caching)
   *
   * @param toolName - Tool identifier
   * @returns Tool information or null if not found
   */
  async getToolInfo(toolName: string): Promise<ToolInfo | null> {
    // Refresh cache if expired
    if (Date.now() - this.lastCacheRefresh > this.cacheExpiry) {
      await this.refreshCache();
    }

    // Check cache first
    if (this.toolCache.has(toolName)) {
      return this.toolCache.get(toolName)!;
    }

    // Query database if not in cache
    const [tool] = await db
      .select({
        toolId: toolRegistry.toolId,
        name: toolRegistry.name,
        binaryPath: toolRegistry.binaryPath,
        containerName: toolRegistry.containerName,
        containerUser: toolRegistry.containerUser,
        category: toolRegistry.category,
        version: toolRegistry.version,
      })
      .from(toolRegistry)
      .where(eq(toolRegistry.toolId, toolName));

    if (!tool) {
      return null;
    }

    const toolInfo: ToolInfo = {
      toolId: tool.toolId,
      name: tool.name,
      binaryPath: tool.binaryPath,
      containerName: tool.containerName || 'rtpi-tools',
      containerUser: tool.containerUser || 'rtpi-tools',
      category: tool.category,
      version: tool.version,
    };

    // Cache the result
    this.toolCache.set(toolName, toolInfo);

    return toolInfo;
  }

  /**
   * Refresh the tool cache from database
   */
  async refreshCache(): Promise<void> {
    const tools = await db
      .select({
        toolId: toolRegistry.toolId,
        name: toolRegistry.name,
        binaryPath: toolRegistry.binaryPath,
        containerName: toolRegistry.containerName,
        containerUser: toolRegistry.containerUser,
        category: toolRegistry.category,
        version: toolRegistry.version,
      })
      .from(toolRegistry);

    this.toolCache.clear();
    for (const tool of tools) {
      this.toolCache.set(tool.toolId, {
        toolId: tool.toolId,
        name: tool.name,
        binaryPath: tool.binaryPath,
        containerName: tool.containerName || 'rtpi-tools',
        containerUser: tool.containerUser || 'rtpi-tools',
        category: tool.category,
        version: tool.version,
      });
    }

    this.lastCacheRefresh = Date.now();
    console.log(`[MultiContainerExecutor] Cache refreshed with ${tools.length} tools`);
  }

  /**
   * List all available tools grouped by container
   *
   * @returns Map of container names to tool lists
   */
  async listToolsByContainer(): Promise<Map<string, ToolInfo[]>> {
    await this.refreshCache();

    const byContainer = new Map<string, ToolInfo[]>();

    const tools = Array.from(this.toolCache.values());
    for (const tool of tools) {
      const container = tool.containerName;
      if (!byContainer.has(container)) {
        byContainer.set(container, []);
      }
      byContainer.get(container)!.push(tool);
    }

    return byContainer;
  }

  /**
   * Check if a specific container is running
   *
   * @param containerName - Container to check
   * @returns True if running
   */
  async isContainerAvailable(containerName: string): Promise<boolean> {
    try {
      const status = await this.dockerExecutor.getContainerStatus(containerName);
      return status.running;
    } catch {
      return false;
    }
  }

  /**
   * Get status of all tool containers
   *
   * @returns Map of container names to running status
   */
  async getContainerStatuses(): Promise<Map<string, boolean>> {
    const containers = [
      'rtpi-tools',
      'rtpi-maldev-agent',
      'rtpi-azure-ad-agent',
      'rtpi-burp-agent',
      'rtpi-empire-agent',
      'rtpi-fuzzing-agent',
      'rtpi-framework-agent',
      'rtpi-research-agent',
    ];

    const statuses = new Map<string, boolean>();

    await Promise.all(
      containers.map(async (name) => {
        statuses.set(name, await this.isContainerAvailable(name));
      })
    );

    return statuses;
  }
}

// Export singleton instance
export const multiContainerExecutor = new MultiContainerExecutor();
