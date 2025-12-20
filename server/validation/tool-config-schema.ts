/**
 * Joi Validation Schemas for Tool Framework
 * Validates tool configurations, parameters, and execution requests
 */

import Joi from 'joi';

/**
 * Tool category validation
 */
const toolCategorySchema = Joi.string().valid(
  'reconnaissance',
  'scanning',
  'exploitation',
  'post-exploitation',
  'wireless',
  'web-application',
  'password-cracking',
  'forensics',
  'social-engineering',
  'reporting',
  'other'
).required();

/**
 * Parameter type validation
 */
const parameterTypeSchema = Joi.string().valid(
  'string',
  'number',
  'boolean',
  'array',
  'file',
  'ip-address',
  'cidr',
  'url',
  'port',
  'enum'
).required();

/**
 * Install method validation
 */
const installMethodSchema = Joi.string().valid(
  'apt',
  'pip',
  'npm',
  'go-install',
  'cargo',
  'docker',
  'github-binary',
  'github-source',
  'manual'
).required();

/**
 * Output format validation
 */
const outputFormatSchema = Joi.string().valid(
  'json',
  'xml',
  'csv',
  'text',
  'nmap-xml',
  'custom'
).required();

/**
 * Tool dependency schema
 */
const toolDependencySchema = Joi.object({
  type: Joi.string().valid('package', 'binary', 'library').required(),
  name: Joi.string().required(),
  version: Joi.string().optional(),
  installCommand: Joi.string().optional(),
  checkCommand: Joi.string().optional(),
});

/**
 * Tool parameter schema
 */
const toolParameterSchema = Joi.object({
  name: Joi.string().required()
    .pattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
    .messages({
      'string.pattern.base': 'Parameter name must start with a letter and contain only letters, numbers, hyphens, and underscores'
    }),
  type: parameterTypeSchema,
  description: Joi.string().required().min(3).max(500),
  required: Joi.boolean().required(),
  defaultValue: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean()
  ).optional(),
  validationRegex: Joi.string().optional(),
  enumValues: Joi.array().items(Joi.string()).when('type', {
    is: 'enum',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  placeholder: Joi.string().optional(),
  helpText: Joi.string().optional(),
}).required();

/**
 * Output parser configuration schema
 */
const outputParserConfigSchema = Joi.object({
  parserName: Joi.string().required(),
  parserType: Joi.string().valid('json', 'xml', 'regex', 'custom').required(),
  outputFormat: outputFormatSchema,
  parserCode: Joi.string().when('parserType', {
    is: 'custom',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  regexPatterns: Joi.object().pattern(
    Joi.string(),
    Joi.string()
  ).when('parserType', {
    is: 'regex',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  jsonPaths: Joi.object().pattern(
    Joi.string(),
    Joi.string()
  ).when('parserType', {
    is: 'json',
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  }),
  xmlPaths: Joi.object().pattern(
    Joi.string(),
    Joi.string()
  ).when('parserType', {
    is: 'xml',
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  }),
}).optional();

/**
 * Tool test configuration schema
 */
const toolTestConfigSchema = Joi.object({
  testType: Joi.string().valid('syntax', 'execution', 'output-parsing').required(),
  testCommand: Joi.string().required(),
  expectedExitCode: Joi.number().integer().min(0).max(255).optional(),
  expectedOutput: Joi.string().optional(),
  expectedOutputRegex: Joi.string().optional(),
  timeout: Joi.number().integer().min(1000).max(600000).optional(), // 1s to 10 minutes
}).optional();

/**
 * Complete tool configuration schema
 */
export const toolConfigurationSchema = Joi.object({
  // Basic Information
  toolId: Joi.string().required()
    .pattern(/^[a-z][a-z0-9-]*$/)
    .min(2)
    .max(50)
    .messages({
      'string.pattern.base': 'Tool ID must be lowercase, start with a letter, and contain only letters, numbers, and hyphens'
    }),
  name: Joi.string().required().min(2).max(100),
  version: Joi.string().required()
    .pattern(/^[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9]+)?$/)
    .messages({
      'string.pattern.base': 'Version must follow semantic versioning (e.g., 1.0.0, 2.1.0-beta)'
    }),
  category: toolCategorySchema,
  description: Joi.string().required().min(10).max(1000),
  author: Joi.string().optional(),
  license: Joi.string().optional(),
  homepage: Joi.string().uri().optional(),
  documentation: Joi.string().uri().optional(),

  // Installation
  installMethod: installMethodSchema,
  installCommand: Joi.string().when('installMethod', {
    is: Joi.valid('apt', 'pip', 'npm', 'go-install', 'cargo', 'manual'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  dockerImage: Joi.string().when('installMethod', {
    is: 'docker',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  githubUrl: Joi.string().uri().pattern(/github\.com/).when('installMethod', {
    is: Joi.valid('github-binary', 'github-source'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  dependencies: Joi.array().items(toolDependencySchema).optional(),

  // Execution
  binaryPath: Joi.string().required(),
  baseCommand: Joi.string().required(),
  parameters: Joi.array().items(toolParameterSchema).required().min(0),
  environmentVariables: Joi.object().pattern(
    Joi.string(),
    Joi.string()
  ).optional(),
  workingDirectory: Joi.string().optional(),
  requiresRoot: Joi.boolean().optional(),
  defaultTimeout: Joi.number().integer().min(1000).max(3600000).optional(), // 1s to 1 hour

  // Output Handling
  outputParser: outputParserConfigSchema,
  stdoutFile: Joi.string().optional(),
  stderrFile: Joi.string().optional(),
  combinedOutput: Joi.boolean().optional(),

  // Testing & Validation
  tests: Joi.array().items(toolTestConfigSchema).optional(),
  healthCheckCommand: Joi.string().optional(),

  // Agent Integration
  supportedAgents: Joi.array().items(Joi.string()).optional(),
  agentCapabilities: Joi.array().items(Joi.string()).optional(),
  agentPrerequisites: Joi.array().items(Joi.string()).optional(),

  // Metadata
  tags: Joi.array().items(Joi.string()).optional(),
  lastValidated: Joi.string().isoDate().optional(),
  validationStatus: Joi.string().valid('validated', 'pending', 'failed').optional(),
  notes: Joi.string().max(2000).optional(),
});

/**
 * Tool execution request schema
 */
export const toolExecutionRequestSchema = Joi.object({
  toolId: Joi.string().required(),
  parameters: Joi.object().required(),
  operationId: Joi.string().uuid().optional(),
  targetId: Joi.string().uuid().optional(),
  agentId: Joi.string().uuid().optional(),
  userId: Joi.string().uuid().required(),
  timeout: Joi.number().integer().min(1000).max(3600000).optional(),
  saveOutput: Joi.boolean().optional().default(true),
  parseOutput: Joi.boolean().optional().default(true),
});

/**
 * Tool registry entry creation schema
 */
export const createToolRegistrySchema = Joi.object({
  toolId: Joi.string().required()
    .pattern(/^[a-z][a-z0-9-]*$/)
    .min(2)
    .max(50),
  name: Joi.string().required().min(2).max(100),
  version: Joi.string().required(),
  category: toolCategorySchema,
  description: Joi.string().required().min(10).max(1000),
  installMethod: installMethodSchema,
  installCommand: Joi.string().optional(),
  dockerImage: Joi.string().optional(),
  githubUrl: Joi.string().uri().optional(),
  binaryPath: Joi.string().required(),
  config: toolConfigurationSchema.required(),
  tags: Joi.array().items(Joi.string()).optional(),
  notes: Joi.string().max(2000).optional(),
});

/**
 * Tool registry entry update schema (all fields optional)
 */
export const updateToolRegistrySchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  version: Joi.string().optional(),
  category: toolCategorySchema.optional(),
  description: Joi.string().min(10).max(1000).optional(),
  installMethod: installMethodSchema.optional(),
  installCommand: Joi.string().optional().allow(null),
  dockerImage: Joi.string().optional().allow(null),
  githubUrl: Joi.string().uri().optional().allow(null),
  binaryPath: Joi.string().optional(),
  config: Joi.object().optional(),
  installStatus: Joi.string().valid('pending', 'installing', 'installed', 'failed', 'updating').optional(),
  validationStatus: Joi.string().valid('validated', 'pending', 'failed').optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  notes: Joi.string().max(2000).optional().allow(null),
}).min(1); // At least one field must be provided

/**
 * GitHub repository URL validation
 */
export const githubUrlSchema = Joi.string()
  .uri()
  .pattern(/^https:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/?$/)
  .required()
  .messages({
    'string.pattern.base': 'Must be a valid GitHub repository URL (e.g., https://github.com/user/repo)'
  });

/**
 * GitHub tool installation request schema
 */
export const githubInstallRequestSchema = Joi.object({
  githubUrl: githubUrlSchema,
  toolId: Joi.string().optional()
    .pattern(/^[a-z][a-z0-9-]*$/)
    .min(2)
    .max(50),
  customConfig: Joi.object().optional(),
});

/**
 * Tool test request schema
 */
export const toolTestRequestSchema = Joi.object({
  toolId: Joi.string().uuid().required(),
  testTypes: Joi.array().items(
    Joi.string().valid('syntax', 'execution', 'output-parsing')
  ).min(1).required(),
  customTestCommand: Joi.string().optional(),
});

/**
 * Validate tool configuration
 */
export function validateToolConfiguration(config: any) {
  return toolConfigurationSchema.validate(config, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validate tool execution request
 */
export function validateToolExecutionRequest(request: any) {
  return toolExecutionRequestSchema.validate(request, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validate tool registry creation
 */
export function validateCreateToolRegistry(data: any) {
  return createToolRegistrySchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validate tool registry update
 */
export function validateUpdateToolRegistry(data: any) {
  return updateToolRegistrySchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validate GitHub URL
 */
export function validateGitHubUrl(url: string) {
  return githubUrlSchema.validate(url);
}

/**
 * Validate GitHub install request
 */
export function validateGitHubInstallRequest(request: any) {
  return githubInstallRequestSchema.validate(request, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validate tool test request
 */
export function validateToolTestRequest(request: any) {
  return toolTestRequestSchema.validate(request, {
    abortEarly: false,
    stripUnknown: true,
  });
}
