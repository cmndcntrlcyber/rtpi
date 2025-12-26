/**
 * Tool Framework Configuration Types
 * Defines the standardized configuration schema for all security tools in RTPI
 */

/**
 * Tool categories for classification
 */
export type ToolCategory =
  | 'reconnaissance'
  | 'scanning'
  | 'exploitation'
  | 'post-exploitation'
  | 'wireless'
  | 'web-application'
  | 'password-cracking'
  | 'forensics'
  | 'social-engineering'
  | 'reporting'
  | 'other';

/**
 * Parameter types for tool configuration
 */
export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'file'
  | 'ip-address'
  | 'cidr'
  | 'url'
  | 'port'
  | 'enum';

/**
 * Installation methods for tools
 */
export type InstallMethod =
  | 'apt'
  | 'pip'
  | 'npm'
  | 'go-install'
  | 'cargo'
  | 'docker'
  | 'github-binary'
  | 'github-source'
  | 'manual';

/**
 * Output formats for tool execution results
 */
export type OutputFormat =
  | 'json'
  | 'xml'
  | 'csv'
  | 'text'
  | 'nmap-xml'
  | 'custom';

/**
 * Tool execution status
 */
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

/**
 * Parameter definition for a tool
 */
export interface ToolParameter {
  name: string;
  type: ParameterType;
  description: string;
  required: boolean;
  defaultValue?: string | number | boolean;
  validationRegex?: string;
  enumValues?: string[];
  placeholder?: string;
  helpText?: string;
}

/**
 * Dependency information for a tool
 */
export interface ToolDependency {
  type: 'package' | 'binary' | 'library';
  name: string;
  version?: string;
  installCommand?: string;
  checkCommand?: string;
}

/**
 * Output parser configuration
 */
export interface OutputParserConfig {
  parserName: string;
  parserType: 'json' | 'xml' | 'regex' | 'custom' | 'line-by-line';
  outputFormat: OutputFormat;
  parserCode?: string; // JavaScript/TypeScript parser function as string
  regexPatterns?: {
    [key: string]: string;
  };
  jsonPaths?: {
    [key: string]: string;
  };
  xmlPaths?: {
    [key: string]: string;
  };
}

/**
 * Tool validation test configuration
 */
export interface ToolTestConfig {
  testType: 'syntax' | 'execution' | 'output-parsing';
  testCommand: string;
  expectedExitCode?: number;
  expectedOutput?: string;
  expectedOutputRegex?: string;
  timeout?: number;
}

/**
 * Complete tool configuration schema
 */
export interface ToolConfiguration {
  // Basic Information
  toolId: string;
  name: string;
  version: string;
  category: ToolCategory;
  description: string;
  author?: string;
  license?: string;
  homepage?: string;
  documentation?: string;

  // Installation
  installMethod: InstallMethod;
  installCommand?: string;
  dockerImage?: string;
  githubUrl?: string;
  dependencies?: ToolDependency[];

  // Execution
  binaryPath: string;
  baseCommand: string;
  parameters: ToolParameter[];
  environmentVariables?: {
    [key: string]: string;
  };
  workingDirectory?: string;
  requiresRoot?: boolean;
  defaultTimeout?: number; // milliseconds

  // Output Handling
  outputParser?: OutputParserConfig;
  stdoutFile?: string;
  stderrFile?: string;
  combinedOutput?: boolean;

  // Testing & Validation
  tests?: ToolTestConfig[];
  healthCheckCommand?: string;

  // Agent Integration
  supportedAgents?: string[];
  agentCapabilities?: string[];
  agentPrerequisites?: string[];

  // Metadata
  tags?: string[];
  lastValidated?: string; // ISO 8601 date
  validationStatus?: 'validated' | 'pending' | 'failed';
  notes?: string;
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  toolId: string;
  parameters: {
    [key: string]: string | number | boolean | string[];
  };
  operationId?: string;
  targetId?: string;
  agentId?: string;
  userId: string;
  timeout?: number;
  saveOutput?: boolean;
  parseOutput?: boolean;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  executionId: string;
  toolId: string;
  status: ExecutionStatus;
  command: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  parsedOutput?: any;
  error?: string;
  startTime: string;
  endTime?: string;
  duration?: number; // milliseconds
  metadata?: {
    [key: string]: any;
  };
}

/**
 * GitHub repository analysis result for auto-installer
 */
export interface GitHubRepoAnalysis {
  repoUrl: string;
  repoName: string;
  language: string;
  detectedDependencies: ToolDependency[];
  suggestedInstallMethod: InstallMethod;
  suggestedDockerfile?: string;
  suggestedBuildScript?: string;
  readme?: string;
  license?: string;
  hasTests?: boolean;
  estimatedBuildTime?: number; // minutes
}

/**
 * Tool registry entry
 * Matches the database schema for tool_registry table
 */
export interface ToolRegistryEntry {
  id: string;
  toolId: string;
  name: string;
  category: ToolCategory;
  version: string | null;
  description: string | null;
  installMethod: InstallMethod;
  installCommand: string | null;
  dockerImage: string | null;
  githubUrl: string | null;
  binaryPath: string; // Top-level property from database schema
  config: ToolConfiguration | any; // JSONB config field
  installStatus: 'pending' | 'installing' | 'installed' | 'failed' | 'updating';
  installLog: string | null;
  validationStatus: string | null;
  lastValidated: Date | null;
  tags: any;
  notes: string | null;
  homepage: string | null;
  documentation: string | null;
  installedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tool test result
 */
export interface ToolTestResult {
  id: string;
  toolId: string;
  testType: 'syntax' | 'execution' | 'output-parsing';
  passed: boolean;
  errorMessage?: string;
  executionTime?: number;
  testedAt: string;
}
