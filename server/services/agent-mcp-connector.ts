import { EventEmitter } from "events";
import { createHash } from "crypto";
import { db } from "../db";
import { agents, mcpServers, notifications, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { mcpInvoker } from "./agents/mcp-invoker";
import { createLogger } from '../lib/logger';
const log = createLogger("agent-mcp-connector");

/**
 * MCP Tool Schema - describes a tool available from an MCP server
 */
interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, {
      type: string;
      description?: string;
      required?: boolean;
      default?: any;
      enum?: string[];
    }>;
    required?: string[];
  };
  category?: string;
  examples?: string[];
}

/**
 * MCP Server Capabilities - tools and resources from a server
 */
interface MCPServerCapabilities {
  serverId: string;
  serverName: string;
  tools: MCPToolSchema[];
  resources?: {
    name: string;
    uri: string;
    description?: string;
  }[];
  prompts?: {
    name: string;
    description?: string;
    arguments?: { name: string; required?: boolean }[];
  }[];
  discoveredAt: Date;
}

/**
 * Agent-MCP Attachment - links an agent to MCP servers
 */
interface AgentMCPAttachment {
  agentId: string;
  mcpServerId: string;
  priority: number;
  enabledTools: string[];
  toolDocumentation: Record<string, string>;
  attachedAt: Date;
}

/**
 * Tool Documentation
 */
interface ToolDocumentation {
  toolName: string;
  mcpServerId: string;
  description: string;
  usage: string;
  parameters: {
    name: string;
    type: string;
    description: string;
    required: boolean;
    default?: any;
  }[];
  examples: string[];
  category: string;
  generatedAt: Date;
}

/**
 * Agent-MCP Connector Service
 *
 * Handles dynamic connection between AI agents and MCP servers,
 * including tool discovery, capability registration, and documentation generation.
 */
class AgentMCPConnector extends EventEmitter {
  private serverCapabilities: Map<string, MCPServerCapabilities> = new Map();
  private agentAttachments: Map<string, AgentMCPAttachment[]> = new Map();
  private toolDocumentationCache: Map<string, ToolDocumentation> = new Map();
  private discoveryInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Start the connector service
   */
  async start(): Promise<void> {
    log.info("[AgentMCPConnector] Starting service...");

    // Initial discovery
    await this.discoverAllServerCapabilities();

    // Rebuild the in-memory attachment map from persisted agent configs. The
    // map is otherwise only populated by attachAgentToMCP(), so without this a
    // server restart silently forgets every agent→MCP assignment until each is
    // re-attached via the API. agents.config.toolContainers[] is the durable
    // source of truth written at attach time.
    await this.rehydrateAttachments();

    // Periodic rediscovery every 5 minutes
    this.discoveryInterval = setInterval(async () => {
      await this.discoverAllServerCapabilities();
    }, 5 * 60 * 1000);

    this.emit("started");
    log.info("[AgentMCPConnector] Service started");
  }

  /**
   * Rebuild `agentAttachments` from each agent's persisted
   * `config.toolContainers[]`. Idempotent — safe to call on every start.
   * Tool documentation is left empty here and regenerated lazily on demand;
   * the load-bearing fields (mcpServerId, enabledTools, priority) come straight
   * from the same shape attachAgentToMCP() writes.
   */
  private async rehydrateAttachments(): Promise<void> {
    try {
      const rows = await db.select().from(agents);
      let restored = 0;
      for (const agent of rows) {
        const cfg = (agent.config as any) || {};
        const containers: any[] = Array.isArray(cfg.toolContainers) ? cfg.toolContainers : [];
        if (containers.length === 0) continue;

        const attachments: AgentMCPAttachment[] = containers
          .filter((c) => c && typeof c.serverId === "string")
          .map((c) => ({
            agentId: agent.id,
            mcpServerId: c.serverId,
            priority: typeof c.order === "number" ? c.order : 0,
            enabledTools: Array.isArray(c.enabledTools) ? c.enabledTools : [],
            toolDocumentation: {},
            attachedAt: new Date(),
          }))
          .sort((a, b) => a.priority - b.priority);

        if (attachments.length > 0) {
          this.agentAttachments.set(agent.id, attachments);
          restored += attachments.length;
        }
      }
      log.info(
        `[AgentMCPConnector] Rehydrated ${restored} attachment(s) across ${this.agentAttachments.size} agent(s) from agents.config`,
      );
    } catch (err) {
      log.error("[AgentMCPConnector] Attachment rehydration failed (non-fatal):", err);
    }
  }

  /**
   * Stop the connector service
   */
  async stop(): Promise<void> {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    this.emit("stopped");
    log.info("[AgentMCPConnector] Service stopped");
  }

  /**
   * Attach an agent to an MCP server
   */
  async attachAgentToMCP(
    agentId: string,
    mcpServerId: string,
    options: {
      priority?: number;
      enabledTools?: string[];
    } = {}
  ): Promise<boolean> {
    // Verify agent exists
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      log.error(`[AgentMCPConnector] Agent ${agentId} not found`);
      return false;
    }

    // Verify MCP server exists
    const [server] = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, mcpServerId))
      .limit(1);

    if (!server) {
      log.error(`[AgentMCPConnector] MCP server ${mcpServerId} not found`);
      return false;
    }

    // Discover capabilities if not cached
    if (!this.serverCapabilities.has(mcpServerId)) {
      await this.discoverServerCapabilities(mcpServerId);
    }

    const capabilities = this.serverCapabilities.get(mcpServerId);

    // Create attachment
    const attachment: AgentMCPAttachment = {
      agentId,
      mcpServerId,
      priority: options.priority ?? 0,
      enabledTools: options.enabledTools ?? capabilities?.tools.map(t => t.name) ?? [],
      toolDocumentation: {},
      attachedAt: new Date(),
    };

    // Generate documentation for enabled tools
    for (const toolName of attachment.enabledTools) {
      const doc = await this.generateToolDocumentation(mcpServerId, toolName);
      if (doc) {
        attachment.toolDocumentation[toolName] = doc.usage;
      }
    }

    // Store attachment
    const existingAttachments = this.agentAttachments.get(agentId) || [];
    const existingIndex = existingAttachments.findIndex(a => a.mcpServerId === mcpServerId);

    if (existingIndex >= 0) {
      existingAttachments[existingIndex] = attachment;
    } else {
      existingAttachments.push(attachment);
    }

    // Sort by priority
    existingAttachments.sort((a, b) => a.priority - b.priority);
    this.agentAttachments.set(agentId, existingAttachments);

    // Update agent config in database
    const currentConfig = (agent.config as any) || {};
    const toolContainers = currentConfig.toolContainers || [];

    const containerIndex = toolContainers.findIndex((c: any) => c.serverId === mcpServerId);
    const containerEntry = {
      serverId: mcpServerId,
      name: server.name,
      order: options.priority ?? toolContainers.length,
      enabledTools: attachment.enabledTools,
    };

    if (containerIndex >= 0) {
      toolContainers[containerIndex] = containerEntry;
    } else {
      toolContainers.push(containerEntry);
    }

    await db
      .update(agents)
      .set({
        config: {
          ...currentConfig,
          mcpServerId: currentConfig.mcpServerId || mcpServerId,
          toolContainers,
        },
      })
      .where(eq(agents.id, agentId));

    log.info(`[AgentMCPConnector] Agent ${agent.name} attached to MCP server ${server.name}`);
    this.emit("agent_attached", { agentId, mcpServerId, attachment });

    return true;
  }

  /**
   * Detach an agent from an MCP server
   */
  async detachAgentFromMCP(agentId: string, mcpServerId: string): Promise<boolean> {
    const attachments = this.agentAttachments.get(agentId);
    if (!attachments) return false;

    const index = attachments.findIndex(a => a.mcpServerId === mcpServerId);
    if (index < 0) return false;

    attachments.splice(index, 1);

    // Update agent config
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agent) {
      const currentConfig = (agent.config as any) || {};
      const toolContainers = (currentConfig.toolContainers || [])
        .filter((c: any) => c.serverId !== mcpServerId);

      await db
        .update(agents)
        .set({
          config: {
            ...currentConfig,
            toolContainers,
            mcpServerId: toolContainers[0]?.serverId || null,
          },
        })
        .where(eq(agents.id, agentId));
    }

    this.emit("agent_detached", { agentId, mcpServerId });
    return true;
  }

  /**
   * Discover capabilities from all running MCP servers
   */
  async discoverAllServerCapabilities(): Promise<void> {
    const servers = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.status, "running"));

    for (const server of servers) {
      await this.discoverServerCapabilities(server.id);
    }

    this.emit("discovery_complete", {
      serverCount: servers.length,
      totalTools: Array.from(this.serverCapabilities.values())
        .reduce((sum, cap) => sum + cap.tools.length, 0),
    });
  }

  /**
   * Discover capabilities from a specific MCP server
   */
  async discoverServerCapabilities(serverId: string): Promise<MCPServerCapabilities | null> {
    const [server] = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, serverId))
      .limit(1);

    if (!server) {
      log.error(`[AgentMCPConnector] Server ${serverId} not found`);
      return null;
    }

    log.info(`[AgentMCPConnector] Discovering capabilities from ${server.name}...`);

    // Prefer LIVE discovery: query the running server's actual tools/list over
    // JSON-RPC. Static `inferToolsFromServerConfig` is only a fallback for
    // servers that aren't running or fail the round-trip — otherwise agents get
    // offered tools the server doesn't have (and miss tools it does).
    let tools = await this.discoverLiveTools(server);
    const isLive = tools.length > 0;
    if (!isLive) {
      tools = this.inferToolsFromServerConfig(server);
    }

    const capabilities: MCPServerCapabilities = {
      serverId,
      serverName: server.name,
      tools,
      discoveredAt: new Date(),
    };

    this.serverCapabilities.set(serverId, capabilities);

    log.info(`[AgentMCPConnector] Discovered ${tools.length} tools from ${server.name}`);
    this.emit("server_discovered", { serverId, capabilities });

    // v3.1.10 — Capability drift detection (only for live-discovered tools)
    if (isLive) {
      await this.detectCapabilityDrift(serverId, server.name, tools);
    }

    return capabilities;
  }

  private computeToolsHash(tools: MCPToolSchema[]): string {
    const canonical = tools
      .map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  }

  private async detectCapabilityDrift(
    serverId: string,
    serverName: string,
    tools: MCPToolSchema[],
  ): Promise<void> {
    try {
      const newHash = this.computeToolsHash(tools);

      const [row] = await db
        .select({
          lastCapabilityHash: mcpServers.lastCapabilityHash,
          lastCapabilitySnapshot: mcpServers.lastCapabilitySnapshot,
        })
        .from(mcpServers)
        .where(eq(mcpServers.id, serverId))
        .limit(1);

      const oldHash = row?.lastCapabilityHash;

      if (oldHash && oldHash !== newHash) {
        const oldSnapshot = (Array.isArray(row?.lastCapabilitySnapshot) ? row.lastCapabilitySnapshot : []) as { name: string }[];
        const oldNames = new Set(oldSnapshot.map((t) => t.name));
        const newNames = new Set(tools.map((t) => t.name));

        const added = tools.filter((t) => !oldNames.has(t.name)).map((t) => t.name);
        const removed = oldSnapshot.filter((t) => !newNames.has(t.name)).map((t) => t.name);

        log.warn(
          `[AgentMCPConnector] Capability drift on ${serverName}: added=[${added.join(",")}] removed=[${removed.join(",")}]`,
        );

        this.emit("capability_drift", { serverId, serverName, added, removed, oldHash, newHash });

        await this.notifyCapabilityDrift(serverName, serverId, added, removed);
      }

      const toolSnapshot = tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
      await db
        .update(mcpServers)
        .set({ lastCapabilityHash: newHash, lastCapabilitySnapshot: toolSnapshot })
        .where(eq(mcpServers.id, serverId));
    } catch (err) {
      log.warn(`[AgentMCPConnector] Drift detection failed for ${serverId} (non-fatal):`, err);
    }
  }

  private async notifyCapabilityDrift(
    serverName: string,
    serverId: string,
    added: string[],
    removed: string[],
  ): Promise<void> {
    try {
      const admins = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"));

      if (admins.length === 0) return;

      const parts: string[] = [];
      if (added.length > 0) parts.push(`added: ${added.join(", ")}`);
      if (removed.length > 0) parts.push(`removed: ${removed.join(", ")}`);
      const changesSummary = parts.join("; ");

      for (const admin of admins) {
        await db.insert(notifications).values({
          userId: admin.id,
          type: "capability_drift",
          title: `MCP capability drift: ${serverName}`,
          message: `Tools changed on "${serverName}": ${changesSummary}`,
          metadata: { serverId, added, removed },
        });
      }
    } catch (err) {
      log.warn(`[AgentMCPConnector] drift notification failed for ${serverId}:`, err);
    }
  }

  /**
   * Live tool discovery via JSON-RPC `tools/list` against a running server.
   * Returns [] (so the caller falls back to static inference) when the server
   * isn't running or the round-trip fails. Result is cached 60s inside
   * mcpInvoker, so repeated discovery sweeps are cheap.
   */
  private async discoverLiveTools(
    server: typeof mcpServers.$inferSelect,
  ): Promise<MCPToolSchema[]> {
    if (server.status !== "running") return [];
    try {
      const live = await mcpInvoker.listTools(server.id);
      return live.map((t) => {
        const schema = (t.inputSchema && typeof t.inputSchema === "object" ? t.inputSchema : {}) as any;
        return {
          name: t.name,
          description: t.description ?? "",
          category: "mcp",
          inputSchema: {
            type: schema.type ?? "object",
            properties: schema.properties ?? {},
            required: Array.isArray(schema.required) ? schema.required : undefined,
          },
        };
      });
    } catch (err) {
      log.warn(
        `[AgentMCPConnector] Live tools/list failed for ${server.name}; falling back to static inference:`,
        err instanceof Error ? err.message : err,
      );
      return [];
    }
  }

  /**
   * Infer tools from server configuration
   */
  private inferToolsFromServerConfig(server: typeof mcpServers.$inferSelect): MCPToolSchema[] {
    const command = server.command.toLowerCase();
    const name = server.name.toLowerCase();
    const tools: MCPToolSchema[] = [];

    // Tavily MCP server
    if (command.includes("tavily") || name.includes("tavily")) {
      tools.push(
        {
          name: "tavily_search",
          description: "Search the web using Tavily AI-powered search",
          category: "search",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              search_depth: { type: "string", description: "Search depth: basic or advanced", enum: ["basic", "advanced"] },
              max_results: { type: "number", description: "Maximum results to return" },
            },
            required: ["query"],
          },
          examples: ["Search for latest security vulnerabilities", "Find documentation for React hooks"],
        },
        {
          name: "tavily_extract",
          description: "Extract content from URLs",
          category: "extraction",
          inputSchema: {
            type: "object",
            properties: {
              urls: { type: "array", description: "URLs to extract content from" },
            },
            required: ["urls"],
          },
        }
      );
    }

    // Filesystem MCP server
    if (command.includes("filesystem") || name.includes("file")) {
      tools.push(
        {
          name: "read_file",
          description: "Read contents of a file",
          category: "filesystem",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Path to the file" },
            },
            required: ["path"],
          },
        },
        {
          name: "write_file",
          description: "Write contents to a file",
          category: "filesystem",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Path to the file" },
              content: { type: "string", description: "Content to write" },
            },
            required: ["path", "content"],
          },
        },
        {
          name: "list_directory",
          description: "List contents of a directory",
          category: "filesystem",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Path to the directory" },
            },
            required: ["path"],
          },
        }
      );
    }

    // GitHub MCP server
    if (command.includes("github") || name.includes("github")) {
      tools.push(
        {
          name: "search_repositories",
          description: "Search GitHub repositories",
          category: "github",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              per_page: { type: "number", description: "Results per page" },
            },
            required: ["query"],
          },
        },
        {
          name: "get_file_contents",
          description: "Get contents of a file from a repository",
          category: "github",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Repository owner" },
              repo: { type: "string", description: "Repository name" },
              path: { type: "string", description: "File path" },
            },
            required: ["owner", "repo", "path"],
          },
        }
      );
    }

    // Security/Nuclei MCP server
    if (command.includes("nuclei") || name.includes("nuclei") || name.includes("security")) {
      tools.push(
        {
          name: "scan_target",
          description: "Run vulnerability scan against a target",
          category: "security",
          inputSchema: {
            type: "object",
            properties: {
              target: { type: "string", description: "Target URL or IP" },
              templates: { type: "array", description: "Template tags to use" },
              severity: { type: "string", description: "Minimum severity", enum: ["info", "low", "medium", "high", "critical"] },
            },
            required: ["target"],
          },
        },
        {
          name: "list_templates",
          description: "List available nuclei templates",
          category: "security",
          inputSchema: {
            type: "object",
            properties: {
              tags: { type: "array", description: "Filter by tags" },
            },
          },
        }
      );
    }

    // Default fallback - add generic tools
    if (tools.length === 0) {
      tools.push({
        name: "execute",
        description: `Execute a command via ${server.name}`,
        category: "general",
        inputSchema: {
          type: "object",
          properties: {
            command: { type: "string", description: "Command to execute" },
            args: { type: "array", description: "Command arguments" },
          },
          required: ["command"],
        },
      });
    }

    return tools;
  }

  /**
   * Get capabilities for an MCP server
   */
  async getServerCapabilities(serverId: string): Promise<MCPServerCapabilities | null> {
    if (!this.serverCapabilities.has(serverId)) {
      await this.discoverServerCapabilities(serverId);
    }
    return this.serverCapabilities.get(serverId) || null;
  }

  /**
   * Return the raw attachment list for an agent (used by the backup service
   * to snapshot the in-memory MCP wiring to disk).
   */
  getAgentAttachments(agentId: string): AgentMCPAttachment[] {
    return [...(this.agentAttachments.get(agentId) || [])];
  }

  /**
   * FF_TOOL_SKILL_GENERATION — return per-tool SKILL.md summaries for every
   * MCP server attached to an agent. Used by agent-prompt-generator callers
   * to inject operational guidance into the agent's system prompt.
   *
   * Returns [] when no MCP servers are attached, or when none of the attached
   * servers have generated SKILL.md files yet (e.g. flag was off at install
   * time). Never throws — file-not-found is the common path.
   */
  async getAgentToolSkills(agentId: string): Promise<Array<{
    registry: "mcp" | "registry" | "security";
    id: string;
    name: string;
    summary: string;
    skillPath: string;
  }>> {
    const { loadSkillSummary } = await import("./skills/skill-loader");
    const attachments = this.agentAttachments.get(agentId) || [];
    const summaries: Array<{
      registry: "mcp" | "registry" | "security";
      id: string;
      name: string;
      summary: string;
      skillPath: string;
    }> = [];
    for (const attachment of attachments) {
      const summary = await loadSkillSummary("mcp", attachment.mcpServerId);
      if (summary) {
        summaries.push({
          registry: "mcp",
          id: attachment.mcpServerId,
          name: summary.name,
          summary: summary.summary,
          skillPath: summary.skillPath,
        });
      }
    }
    return summaries;
  }

  /**
   * Get all tools available to an agent
   */
  async getAgentTools(agentId: string): Promise<{
    tools: MCPToolSchema[];
    servers: { serverId: string; serverName: string; toolCount: number }[];
  }> {
    const attachments = this.agentAttachments.get(agentId) || [];
    const tools: MCPToolSchema[] = [];
    const servers: { serverId: string; serverName: string; toolCount: number }[] = [];

    for (const attachment of attachments) {
      const capabilities = this.serverCapabilities.get(attachment.mcpServerId);
      if (capabilities) {
        const enabledTools = capabilities.tools.filter(
          t => attachment.enabledTools.includes(t.name)
        );
        tools.push(...enabledTools);
        servers.push({
          serverId: capabilities.serverId,
          serverName: capabilities.serverName,
          toolCount: enabledTools.length,
        });
      }
    }

    return { tools, servers };
  }

  /**
   * Register capability from MCP tool schema
   */
  async registerCapabilityFromSchema(
    agentId: string,
    toolSchema: MCPToolSchema
  ): Promise<void> {
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) return;

    const capabilities = (agent.capabilities as string[]) || [];

    // Map tool category to capability
    const capabilityMap: Record<string, string> = {
      search: "web_search",
      extraction: "content_extraction",
      filesystem: "file_operations",
      github: "code_repository",
      security: "vulnerability_scanning",
      general: "command_execution",
    };

    const capability = capabilityMap[toolSchema.category || "general"] || toolSchema.category || "general";

    if (!capabilities.includes(capability)) {
      capabilities.push(capability);
      await db
        .update(agents)
        .set({ capabilities })
        .where(eq(agents.id, agentId));

      log.info(`[AgentMCPConnector] Registered capability '${capability}' for agent ${agent.name}`);
    }
  }

  /**
   * Generate tool usage documentation
   */
  async generateToolDocumentation(
    mcpServerId: string,
    toolName: string
  ): Promise<ToolDocumentation | null> {
    const cacheKey = `${mcpServerId}:${toolName}`;

    if (this.toolDocumentationCache.has(cacheKey)) {
      return this.toolDocumentationCache.get(cacheKey)!;
    }

    const capabilities = this.serverCapabilities.get(mcpServerId);
    if (!capabilities) return null;

    const tool = capabilities.tools.find(t => t.name === toolName);
    if (!tool) return null;

    const parameters = Object.entries(tool.inputSchema.properties || {}).map(
      ([name, prop]) => ({
        name,
        type: prop.type,
        description: prop.description || "",
        required: tool.inputSchema.required?.includes(name) || false,
        default: prop.default,
      })
    );

    const usage = this.generateUsageMarkdown(tool, parameters);

    const documentation: ToolDocumentation = {
      toolName: tool.name,
      mcpServerId,
      description: tool.description,
      usage,
      parameters,
      examples: tool.examples || [],
      category: tool.category || "general",
      generatedAt: new Date(),
    };

    this.toolDocumentationCache.set(cacheKey, documentation);
    return documentation;
  }

  /**
   * Generate markdown usage documentation for a tool
   */
  private generateUsageMarkdown(
    tool: MCPToolSchema,
    parameters: ToolDocumentation["parameters"]
  ): string {
    const lines: string[] = [
      `# ${tool.name}`,
      "",
      tool.description,
      "",
      "## Parameters",
      "",
    ];

    if (parameters.length === 0) {
      lines.push("This tool takes no parameters.");
    } else {
      lines.push("| Name | Type | Required | Description |");
      lines.push("|------|------|----------|-------------|");

      for (const param of parameters) {
        const required = param.required ? "Yes" : "No";
        const desc = param.default !== undefined
          ? `${param.description} (default: ${param.default})`
          : param.description;
        lines.push(`| ${param.name} | ${param.type} | ${required} | ${desc} |`);
      }
    }

    if (tool.examples && tool.examples.length > 0) {
      lines.push("");
      lines.push("## Examples");
      lines.push("");
      for (const example of tool.examples) {
        lines.push(`- ${example}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Get documentation for all tools of an MCP server
   */
  async getServerToolDocumentation(serverId: string): Promise<ToolDocumentation[]> {
    const capabilities = await this.getServerCapabilities(serverId);
    if (!capabilities) return [];

    const docs: ToolDocumentation[] = [];
    for (const tool of capabilities.tools) {
      const doc = await this.generateToolDocumentation(serverId, tool.name);
      if (doc) {
        docs.push(doc);
      }
    }

    return docs;
  }

  /**
   * Get documentation for all tools available to an agent
   */
  async getAgentToolDocumentation(agentId: string): Promise<ToolDocumentation[]> {
    const { tools } = await this.getAgentTools(agentId);
    const attachments = this.agentAttachments.get(agentId) || [];
    const docs: ToolDocumentation[] = [];

    for (const attachment of attachments) {
      for (const toolName of attachment.enabledTools) {
        const doc = await this.generateToolDocumentation(attachment.mcpServerId, toolName);
        if (doc) {
          docs.push(doc);
        }
      }
    }

    return docs;
  }

  /**
   * Generate a complete Usage.md file for an agent
   */
  async generateAgentUsageDocument(agentId: string): Promise<string> {
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) return "";

    const docs = await this.getAgentToolDocumentation(agentId);
    const { servers } = await this.getAgentTools(agentId);

    const lines: string[] = [
      `# Tool Usage Guide for ${agent.name}`,
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
      "## Connected MCP Servers",
      "",
    ];

    for (const server of servers) {
      lines.push(`- **${server.serverName}**: ${server.toolCount} tools`);
    }

    lines.push("");
    lines.push("## Available Tools");
    lines.push("");

    // Group by category
    const byCategory = docs.reduce((acc, doc) => {
      const cat = doc.category || "general";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(doc);
      return acc;
    }, {} as Record<string, ToolDocumentation[]>);

    for (const [category, categoryDocs] of Object.entries(byCategory)) {
      lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      lines.push("");

      for (const doc of categoryDocs) {
        lines.push(`#### ${doc.toolName}`);
        lines.push("");
        lines.push(doc.description);
        lines.push("");

        if (doc.parameters.length > 0) {
          lines.push("**Parameters:**");
          for (const param of doc.parameters) {
            const req = param.required ? " (required)" : "";
            lines.push(`- \`${param.name}\` (${param.type})${req}: ${param.description}`);
          }
          lines.push("");
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Get status of the connector service
   */
  getStatus(): {
    serverCount: number;
    totalTools: number;
    agentAttachments: number;
    cachedDocuments: number;
  } {
    return {
      serverCount: this.serverCapabilities.size,
      totalTools: Array.from(this.serverCapabilities.values())
        .reduce((sum, cap) => sum + cap.tools.length, 0),
      agentAttachments: Array.from(this.agentAttachments.values())
        .reduce((sum, attachments) => sum + attachments.length, 0),
      cachedDocuments: this.toolDocumentationCache.size,
    };
  }
}

// Export singleton instance
export const agentMCPConnector = new AgentMCPConnector();
export default agentMCPConnector;
