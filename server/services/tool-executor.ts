/**
 * Tool Executor Service
 * Executes security tools with parameter validation and output parsing
 */

import { db } from '../db';
import { toolExecutions, toolRegistry, agents } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import type {
  ToolExecutionRequest,
  ToolExecutionResult,
  ExecutionStatus,
} from '../../shared/types/tool-config';
import { getToolByToolId, getToolOutputParser } from './tool-registry-manager';
import { validateToolExecutionRequest } from '../validation/tool-config-schema';
import { outputParserManager } from './output-parser-manager';
import { dockerExecutor } from './docker-executor';

// Maximum concurrent tool executions
const MAX_CONCURRENT_EXECUTIONS = parseInt(
  process.env.MAX_CONCURRENT_TOOL_EXECUTIONS || '5'
);

// Default timeout
const DEFAULT_TIMEOUT = parseInt(
  process.env.TOOL_EXECUTION_TIMEOUT || '300000'
); // 5 minutes

// Track running executions
const runningExecutions = new Set<string>();

/**
 * Execute a tool with given parameters
 */
export async function executeTool(
  request: ToolExecutionRequest
): Promise<ToolExecutionResult> {
  // Validate request
  const { error } = validateToolExecutionRequest(request);
  if (error) {
    throw new Error(`Invalid execution request: ${error.message}`);
  }

  // Check concurrent execution limit
  if (runningExecutions.size >= MAX_CONCURRENT_EXECUTIONS) {
    throw new Error(
      `Maximum concurrent executions reached (${MAX_CONCURRENT_EXECUTIONS}). Please try again later.`
    );
  }

  // Get tool from registry
  const tool = await getToolByToolId(request.toolId);
  if (!tool) {
    throw new Error(`Tool '${request.toolId}' not found in registry`);
  }

  if (tool.installStatus !== 'installed') {
    throw new Error(
      `Tool '${request.toolId}' is not installed. Status: ${tool.installStatus}`
    );
  }

  const config = tool.config as any;

  // Build command with parameters
  const command = buildCommand(config, request.parameters);

  // Create execution record
  const [execution] = await db.insert(toolExecutions).values({
    toolId: tool.id,
    userId: request.userId,
    operationId: request.operationId,
    targetId: request.targetId,
    agentId: request.agentId,
    command,
    parameters: request.parameters,
    status: 'pending',
    timeoutMs: request.timeout || DEFAULT_TIMEOUT,
  }).returning();

  const executionId = execution.id;
  runningExecutions.add(executionId);

  try {
    // Update status to running
    await updateExecutionStatus(executionId, 'running');

    // Execute the command in the tool's container
    const containerName = (tool as any).containerName || 'rtpi-tools';
    const containerUser = (tool as any).containerUser || 'rtpi-tools';
    const result = await runCommand(
      config.binaryPath,
      command,
      request.timeout || DEFAULT_TIMEOUT,
      containerName,
      containerUser,
    );

    // Parse output if requested and parser is available
    let parsedOutput = null;
    if (request.parseOutput !== false) {
      const parserConfig = await getToolOutputParser(tool.id);
      if (parserConfig) {
        try {
          const parseResult = await outputParserManager.parseOutput(
            result.stdout,
            parserConfig
          );

          if (parseResult.success) {
            parsedOutput = parseResult.parsed;
          } else {
            console.warn(`Failed to parse output:`, parseResult.errors);
          }
        } catch (parseError: any) {
          console.warn(`Failed to parse output: ${parseError.message}`);
        }
      }
    }

    // Update execution record with results
    const endTime = new Date();
    const duration = endTime.getTime() - new Date(execution.createdAt).getTime();

    await db.update(toolExecutions)
      .set({
        status: result.exitCode === 0 ? 'completed' : 'failed',
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        parsedOutput,
        startTime: new Date(execution.createdAt),
        endTime,
        durationMs: duration,
      })
      .where(eq(toolExecutions.id, executionId));

    // Update denormalized stats on toolRegistry
    try {
      await db.update(toolRegistry)
        .set({
          usageCount: sql`${toolRegistry.usageCount} + 1`,
          lastUsed: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(toolRegistry.id, tool.id));
    } catch (e) { console.warn('[ToolExecutor] Failed to update tool stats:', e); }

    // Update agent stats if agent-initiated
    if (request.agentId) {
      try {
        const isSuccess = result.exitCode === 0;
        await db.update(agents)
          .set({
            ...(isSuccess
              ? { tasksCompleted: sql`${agents.tasksCompleted} + 1` }
              : { tasksFailed: sql`${agents.tasksFailed} + 1` }),
            lastActivity: new Date(),
          })
          .where(eq(agents.id, request.agentId));
      } catch (e) { console.warn('[ToolExecutor] Failed to update agent stats:', e); }
    }

    const executionResult: ToolExecutionResult = {
      executionId,
      toolId: request.toolId,
      status: result.exitCode === 0 ? 'completed' : 'failed',
      command,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      parsedOutput,
      startTime: execution.createdAt.toISOString(),
      endTime: endTime.toISOString(),
      duration,
    };

    return executionResult;
  } catch (error: any) {
    // Update execution record with error
    await db.update(toolExecutions)
      .set({
        status: error.message.includes('timeout') ? 'timeout' : 'failed',
        errorMessage: error.message,
        endTime: new Date(),
      })
      .where(eq(toolExecutions.id, executionId));

    // Update agent failure stats if agent-initiated
    if (request.agentId) {
      try {
        await db.update(agents)
          .set({ tasksFailed: sql`${agents.tasksFailed} + 1`, lastActivity: new Date() })
          .where(eq(agents.id, request.agentId));
      } catch (e) { console.warn('[ToolExecutor] Failed to update agent failure stats:', e); }
    }

    throw error;
  } finally {
    runningExecutions.delete(executionId);
  }
}

/**
 * Build command string from configuration and parameters
 */
function buildCommand(config: any, parameters: any): string {
  let command = config.baseCommand;

  // Add parameters
  for (const paramDef of config.parameters || []) {
    const value = parameters[paramDef.name];

    // Skip if not provided and not required
    if (value === undefined || value === null) {
      if (paramDef.required) {
        throw new Error(`Required parameter '${paramDef.name}' is missing`);
      }
      continue;
    }

    // Validate parameter type
    validateParameter(paramDef, value);

    // Add parameter to command
    command += ` ${formatParameter(paramDef, value)}`;
  }

  return command;
}

/**
 * Validate parameter value against definition
 */
function validateParameter(paramDef: any, value: any): void {
  const { type, name, validationRegex, enumValues } = paramDef;

  switch (type) {
    case 'number':
    case 'port':
      if (typeof value !== 'number') {
        throw new Error(`Parameter '${name}' must be a number`);
      }
      if (type === 'port' && (value < 1 || value > 65535)) {
        throw new Error(`Parameter '${name}' must be a valid port (1-65535)`);
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(`Parameter '${name}' must be a boolean`);
      }
      break;

    case 'enum':
      if (!enumValues || !enumValues.includes(value)) {
        throw new Error(
          `Parameter '${name}' must be one of: ${enumValues.join(', ')}`
        );
      }
      break;

    case 'ip-address': {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(value)) {
        throw new Error(`Parameter '${name}' must be a valid IP address`);
      }
      break;
    }

    case 'cidr': {
      const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
      if (!cidrRegex.test(value)) {
        throw new Error(`Parameter '${name}' must be a valid CIDR notation`);
      }
      break;
    }

    case 'url':
      try {
        new URL(value);
      } catch {
        throw new Error(`Parameter '${name}' must be a valid URL`);
      }
      break;

    case 'string':
      if (typeof value !== 'string') {
        throw new Error(`Parameter '${name}' must be a string`);
      }
      if (validationRegex) {
        const regex = new RegExp(validationRegex);
        if (!regex.test(value)) {
          throw new Error(
            `Parameter '${name}' does not match required pattern: ${validationRegex}`
          );
        }
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        throw new Error(`Parameter '${name}' must be an array`);
      }
      break;
  }
}

/**
 * Format parameter for command line
 */
function formatParameter(paramDef: any, value: any): string {
  const { name, type } = paramDef;

  // Boolean flags
  if (type === 'boolean') {
    return value ? `--${name}` : '';
  }

  // Array parameters
  if (type === 'array') {
    return value.map((v: any) => `--${name} "${v}"`).join(' ');
  }

  // Regular parameters
  return `--${name} "${value}"`;
}

/**
 * Run command inside a Docker container via dockerExecutor.
 * Tools live in various containers (rtpi-tools, rtpi-framework-agent, etc.),
 * so we must execute remotely rather than via local spawn().
 */
async function runCommand(
  binaryPath: string,
  command: string,
  timeout: number,
  containerName: string,
  containerUser: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  // Build the full command: binaryPath + args from the command string
  // command already contains the base command + formatted params
  // Perl scripts need an interpreter prefix
  const cmdPrefix = binaryPath.endsWith('.pl') ? ['perl', binaryPath] : [binaryPath];
  const cmd = [...cmdPrefix, ...command.split(' ').filter(a => a.length > 0)];

  const result = await dockerExecutor.exec(containerName, cmd, {
    timeout,
    user: containerUser,
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}


/**
 * Update execution status
 */
async function updateExecutionStatus(
  executionId: string,
  status: ExecutionStatus
): Promise<void> {
  await db.update(toolExecutions)
    .set({ status })
    .where(eq(toolExecutions.id, executionId));
}

/**
 * Get execution result
 */
export async function getExecutionResult(executionId: string): Promise<any> {
  const [execution] = await db
    .select()
    .from(toolExecutions)
    .where(eq(toolExecutions.id, executionId));

  return execution;
}

/**
 * Cancel a running execution
 */
export async function cancelExecution(executionId: string): Promise<void> {
  // Update status to cancelled
  await db.update(toolExecutions)
    .set({
      status: 'cancelled',
      endTime: new Date(),
    })
    .where(eq(toolExecutions.id, executionId));

  // Remove from running set
  runningExecutions.delete(executionId);
}

/**
 * Get running executions count
 */
export function getRunningExecutionsCount(): number {
  return runningExecutions.size;
}

/**
 * Get running executions
 */
export function getRunningExecutions(): string[] {
  return Array.from(runningExecutions);
}
