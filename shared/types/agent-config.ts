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
   * - "auto": Automatically select best available (default)
   */
  provider?: AIProvider;

  /**
   * Specific model to use
   * Examples:
   * - Ollama: "llama3:8b", "qwen2.5-coder:7b"
   * - OpenAI: "gpt-4-turbo-preview", "gpt-3.5-turbo"
   * - Anthropic: "claude-3-5-sonnet-20241022", "claude-3-opus-20240229"
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
   * Default: true
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
   * MCP server ID for this agent
   */
  mcpServerId?: string;

  /**
   * Additional metadata
   */
  [key: string]: any;
}

/**
 * Default AI configuration
 */
export const DEFAULT_AI_CONFIG: AgentAIConfig = {
  provider: "auto",
  temperature: 0.7,
  maxTokens: 2048,
  useCache: true,
  preferLocal: true,
};

/**
 * Model presets for different agent types
 */
export const MODEL_PRESETS = {
  // General purpose agents
  general: {
    ollama: "llama3:8b",
    openai: "gpt-4-turbo-preview",
    anthropic: "claude-3-5-sonnet-20241022",
  },
  // Code analysis agents
  code: {
    ollama: "qwen2.5-coder:7b",
    openai: "gpt-4-turbo-preview",
    anthropic: "claude-3-5-sonnet-20241022",
  },
  // Technical writing agents
  writing: {
    ollama: "llama3:8b",
    openai: "gpt-4-turbo-preview",
    anthropic: "claude-3-opus-20240229",
  },
  // Fast response agents
  fast: {
    ollama: "llama3:8b",
    openai: "gpt-3.5-turbo",
    anthropic: "claude-3-5-sonnet-20241022",
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
