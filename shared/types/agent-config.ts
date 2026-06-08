/**
 * Agent Configuration Types
 * Enhancement #08 - Ollama AI Integration (Phase 4)
 *
 * Defines the structure of agent.config JSON field
 */

export type AIProvider = "ollama" | "openai" | "anthropic" | "auto";

export interface AgentAIConfig {
  /**
   * AI provider to use for this agent
   * - "ollama": Use local Ollama models
   * - "openai": Use OpenAI API
   * - "anthropic": Use Anthropic API
   * - "auto": Defer to inference router — Settings defaults then provider fallback
   *   chain. This is the default and the recommended value.
   */
  provider?: AIProvider;

  /**
   * Specific model to use
   * Examples:
   * - Ollama/RKLLama: "qwen2.5:3b", "qwen2.5-coder:3b", "tinyllama:1.1b", "qwen2.5:7b"
   * - OpenAI: "gpt-5.2", "gpt-5.2-chat-latest", "gpt-4.1-mini"
   * - Anthropic: "claude-opus-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"
   */
  model?: string;

  /**
   * Temperature for AI responses (0.0 - 2.0)
   * Lower = more deterministic, Higher = more creative
   * Default: 0.7
   */
  temperature?: number;

  /**
   * Maximum tokens for AI responses
   * Default: 2048
   */
  maxTokens?: number;

  /**
   * Enable response caching
   * Default: true
   */
  useCache?: boolean;

  /**
   * Prefer local models over cloud
   * If true, will try Ollama first even if cloud keys are available
   * Default: false
   */
  preferLocal?: boolean;
}

export interface AgentConfig {
  /**
   * AI configuration (Ollama, OpenAI, Anthropic)
   */
  ai?: AgentAIConfig;

  /**
   * System prompt for the agent
   */
  systemPrompt?: string;

  /**
   * Agent loop configuration
   */
  loopEnabled?: boolean;
  loopPartnerId?: string;
  maxLoopIterations?: number;
  loopExitCondition?: string;

  /**
   * Flow order for multi-agent workflows
   */
  flowOrder?: number;

  /**
   * Enabled tools for this agent
   */
  enabledTools?: string[];

  /**
   * Enabled skills for this agent. Values are namespaced IDs from the
   * /api/v1/skills/available catalog so tool skills and bug-hunter
   * knowledge_base skills coexist cleanly:
   *   - `tool:<registry>:<rowId>` — per-tool SKILL.md file
   *   - `bh:skill:<skill-slug>`   — full bug-hunter skill (grouped form)
   *   - `bh:<knowledge_base.id>`  — individual chunk (un-grouped form)
   */
  enabledSkills?: string[];

  /**
   * Primary MCP server ID for this agent (legacy single-server field).
   * Kept in sync with `mcpServerIds[0]` so single-server consumers continue to
   * work; new code should prefer `mcpServerIds`.
   */
  mcpServerId?: string;

  /**
   * v2.9.3 — multi-server selection. The first id mirrors the legacy
   * `mcpServerId` field for backward compatibility. Backend dispatch
   * (POST /api/v1/agents/:id/mcp-call) iterates this array and routes the
   * tool call to whichever server's listTools() owns the requested tool.
   */
  mcpServerIds?: string[];

  /**
   * Additional metadata
   */
  [key: string]: any;
}

/**
 * Default AI configuration. Provider/model are intentionally unset so the
 * inference router consults Settings (DEFAULT_MODEL / DEFAULT_AGENT_MODEL /
 * DEFAULT_REASONING_MODEL) before falling back to provider defaults.
 */
export const DEFAULT_AI_CONFIG: AgentAIConfig = {
  provider: "auto",
  temperature: 0.7,
  maxTokens: 2048,
  useCache: true,
  preferLocal: false,
};

/**
 * Model presets for different agent types
 */
export const MODEL_PRESETS = {
  // General purpose agents (vuln analysis, CVE extraction, CVSS, remediation)
  general: {
    ollama: "qwen2.5:3b",
    openai: "gpt-5.2-chat-latest",
    anthropic: "claude-sonnet-4-5",
  },
  // Code analysis agents (secure code review, exploit analysis)
  code: {
    ollama: "qwen2.5-coder:3b",
    openai: "gpt-5.2",
    anthropic: "claude-sonnet-4-5",
  },
  // Technical writing agents (reports, vuln descriptions)
  writing: {
    ollama: "qwen2.5:7b",
    openai: "gpt-5.2-chat-latest",
    anthropic: "claude-opus-4-6",
  },
  // Fast response agents (tool commands, quick classification)
  fast: {
    ollama: "tinyllama:1.1b",
    openai: "gpt-4.1-mini",
    anthropic: "claude-haiku-4-5",
  },
};

/**
 * Get recommended model for agent based on provider
 */
export function getRecommendedModel(
  agentType: keyof typeof MODEL_PRESETS,
  provider: AIProvider
): string | undefined {
  if (provider === "auto") return undefined;
  return MODEL_PRESETS[agentType]?.[provider];
}

/**
 * Merge agent config with defaults
 */
export function mergeAgentAIConfig(config?: Partial<AgentAIConfig>): AgentAIConfig {
  return {
    ...DEFAULT_AI_CONFIG,
    ...config,
  };
}
