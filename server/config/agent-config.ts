/**
 * Agent System Configuration (v2.3.2)
 * Centralized configuration for the multi-agent architecture.
 * All values are configurable via environment variables with sensible defaults.
 */

export interface AgentModelConfig {
  provider: "openai" | "anthropic";
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface OperationsManagerConfig {
  enabled: boolean;
  questionProcessingIntervalMs: number;
  loopMonitoringIntervalMs: number;
  taskDelegationIntervalMs: number;
  memorySynthesisIntervalMs: number;
  aiModel: AgentModelConfig;
  maxConcurrentTasks: number;
  questionAnswerTimeoutHours: number;
}

export interface PageReporterConfig {
  enabled: boolean;
  defaultPollingIntervalMs: number;
  changeDetectionEnabled: boolean;
  memoryEnabled: boolean;
  memoryRetentionDays: number;
  changeThresholdPercent: number;
  aiModel: AgentModelConfig;
  maxHistorySnapshots: number;
}

export interface TaskAgentConfig {
  enabled: boolean;
  maxConcurrentTasks: number;
  taskTimeoutMs: number;
  memoryEnabled: boolean;
  aiModel: AgentModelConfig;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelayMs: number;
  };
}

export interface MessageBusConfig {
  enabled: boolean;
  messageExpirationMs: number;
  cleanupIntervalMs: number;
  heartbeatIntervalMs: number;
  staleAgentThresholdMs: number;
  maxQueueSizePerAgent: number;
}

export interface AgentSystemConfig {
  operationsManager: OperationsManagerConfig;
  pageReporter: PageReporterConfig;
  taskAgent: TaskAgentConfig;
  messageBus: MessageBusConfig;
}

export const agentConfig: AgentSystemConfig = {
  operationsManager: {
    enabled: process.env.OPS_MANAGER_ENABLED !== "false",
    questionProcessingIntervalMs: parseInt(process.env.OPS_MANAGER_QUESTION_INTERVAL || "10000", 10),
    loopMonitoringIntervalMs: parseInt(process.env.OPS_MANAGER_LOOP_INTERVAL || "30000", 10),
    taskDelegationIntervalMs: parseInt(process.env.OPS_MANAGER_DELEGATION_INTERVAL || "60000", 10),
    memorySynthesisIntervalMs: parseInt(process.env.OPS_MANAGER_SYNTHESIS_INTERVAL || "300000", 10),
    aiModel: {
      provider: (process.env.OPS_MANAGER_AI_PROVIDER as "openai" | "anthropic") || "anthropic",
      model: process.env.OPS_MANAGER_AI_MODEL || "claude-sonnet-4-5",
      temperature: parseFloat(process.env.OPS_MANAGER_AI_TEMP || "0.7"),
      maxTokens: parseInt(process.env.OPS_MANAGER_AI_MAX_TOKENS || "4096", 10),
    },
    maxConcurrentTasks: parseInt(process.env.OPS_MANAGER_MAX_TASKS || "10", 10),
    questionAnswerTimeoutHours: parseInt(process.env.OPS_MANAGER_QUESTION_TIMEOUT_HOURS || "24", 10),
  },

  pageReporter: {
    enabled: process.env.PAGE_REPORTER_ENABLED !== "false",
    defaultPollingIntervalMs: parseInt(process.env.PAGE_REPORTER_POLL_INTERVAL || "3600000", 10),
    changeDetectionEnabled: process.env.PAGE_REPORTER_CHANGE_DETECTION !== "false",
    memoryEnabled: process.env.PAGE_REPORTER_MEMORY_ENABLED !== "false",
    memoryRetentionDays: parseInt(process.env.PAGE_REPORTER_MEMORY_RETENTION_DAYS || "30", 10),
    changeThresholdPercent: parseFloat(process.env.PAGE_REPORTER_CHANGE_THRESHOLD || "5.0"),
    aiModel: {
      provider: (process.env.PAGE_REPORTER_AI_PROVIDER as "openai" | "anthropic") || "openai",
      model: process.env.PAGE_REPORTER_AI_MODEL || "gpt-5.2-chat-latest",
      temperature: parseFloat(process.env.PAGE_REPORTER_AI_TEMP || "0.5"),
      maxTokens: parseInt(process.env.PAGE_REPORTER_AI_MAX_TOKENS || "2048", 10),
    },
    maxHistorySnapshots: parseInt(process.env.PAGE_REPORTER_MAX_HISTORY || "168", 10),
  },

  taskAgent: {
    enabled: process.env.TASK_AGENT_ENABLED !== "false",
    maxConcurrentTasks: parseInt(process.env.TASK_AGENT_MAX_CONCURRENT || "5", 10),
    taskTimeoutMs: parseInt(process.env.TASK_AGENT_TIMEOUT || "600000", 10),
    memoryEnabled: process.env.TASK_AGENT_MEMORY_ENABLED !== "false",
    aiModel: {
      provider: (process.env.TASK_AGENT_AI_PROVIDER as "openai" | "anthropic") || "anthropic",
      model: process.env.TASK_AGENT_AI_MODEL || "claude-sonnet-4-5",
      temperature: parseFloat(process.env.TASK_AGENT_AI_TEMP || "0.3"),
      maxTokens: parseInt(process.env.TASK_AGENT_AI_MAX_TOKENS || "8192", 10),
    },
    retryPolicy: {
      maxRetries: parseInt(process.env.TASK_AGENT_MAX_RETRIES || "3", 10),
      backoffMultiplier: parseFloat(process.env.TASK_AGENT_BACKOFF_MULTIPLIER || "2.0"),
      initialDelayMs: parseInt(process.env.TASK_AGENT_INITIAL_DELAY || "1000", 10),
    },
  },

  messageBus: {
    enabled: process.env.MESSAGE_BUS_ENABLED !== "false",
    messageExpirationMs: parseInt(process.env.MESSAGE_BUS_EXPIRATION || "86400000", 10),
    cleanupIntervalMs: parseInt(process.env.MESSAGE_BUS_CLEANUP_INTERVAL || "300000", 10),
    heartbeatIntervalMs: parseInt(process.env.MESSAGE_BUS_HEARTBEAT_INTERVAL || "60000", 10),
    staleAgentThresholdMs: parseInt(process.env.MESSAGE_BUS_STALE_THRESHOLD || "300000", 10),
    maxQueueSizePerAgent: parseInt(process.env.MESSAGE_BUS_MAX_QUEUE_SIZE || "100", 10),
  },
};
