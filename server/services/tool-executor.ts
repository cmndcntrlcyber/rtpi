/**
 * Tool Executor Service
 * Executes security tools with parameter validation and output parsing
 */

import { spawn } from 'child_process';
import { db } from '../db';
import { toolExecutions, toolRegistry, toolOutputParsers } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type {
  ToolExecutionRequest,
  ToolExecutionResult,
  ExecutionStatus,
} from '../../shared/types/tool-config';
import { getToolByToolId, getToolOutputParser } from './tool-registry-manager';
import { validateToolExecutionRequest } from '../validation/tool-config-schema';

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
  const { error, value } = validateToolExecutionRequest(request);
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

    // Execute the command
    const result = await runCommand(
      config.binaryPath,
      command,
      request.timeout || DEFAULT_TIMEOUT,
      config.workingDirectory
    );

    // Parse output if requested and parser is available
    let parsedOutput = null;
    if (request.parseOutput !== false) {
      const parser = await getToolOutputParser(tool.id);
      if (parser) {
        try {
          parsedOutput = await parseOutput(result.stdout, parser);
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

    case 'ip-address':
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(value)) {
        throw new Error(`Parameter '${name}' must be a valid IP address`);
      }
      break;

    case 'cidr':
      const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
      if (!cidrRegex.test(value)) {
        throw new Error(`Parameter '${name}' must be a valid CIDR notation`);
      }
      break;

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
 * Run command with timeout
 */
function runCommand(
  binaryPath: string,
  command: string,
  timeout: number,
  workingDirectory?: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const args = command.split(' ').filter(arg => arg.length > 0);

    const child = spawn(binaryPath, args, {
      cwd: workingDirectory || process.cwd(),
      shell: true,
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command execution timeout after ${timeout}ms`));
    }, timeout);

    // Capture stdout
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Capture stderr
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle completion
    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
      });
    });

    // Handle errors
    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Command execution failed: ${error.message}`));
    });
  });
}

/**
 * Parse tool output using configured parser
 */
async function parseOutput(output: string, parser: any): Promise<any> {
  const { parserType, parserCode, regexPatterns, jsonPaths, xmlPaths } = parser;

  switch (parserType) {
    case 'json':
      return parseJsonOutput(output, jsonPaths);

    case 'xml':
      return parseXmlOutput(output, xmlPaths);

    case 'regex':
      return parseRegexOutput(output, regexPatterns);

    case 'custom':
      return parseCustomOutput(output, parserCode);

    default:
      throw new Error(`Unknown parser type: ${parserType}`);
  }
}

/**
 * Parse JSON output
 */
function parseJsonOutput(output: string, jsonPaths?: any): any {
  try {
    const parsed = JSON.parse(output);

    if (!jsonPaths) {
      return parsed;
    }

    // Extract specific paths
    const result: any = {};
    for (const [key, path] of Object.entries(jsonPaths)) {
      result[key] = getJsonPath(parsed, path as string);
    }

    return result;
  } catch (error: any) {
    throw new Error(`Failed to parse JSON output: ${error.message}`);
  }
}

/**
 * Get value from JSON path (simple dot notation)
 */
function getJsonPath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return null;
    }
    current = current[part];
  }

  return current;
}

/**
 * Parse XML output (basic implementation)
 */
function parseXmlOutput(output: string, xmlPaths?: any): any {
  // For now, return raw XML
  // TODO: Implement proper XML parsing with xpath if needed
  return { raw: output };
}

/**
 * Parse output using regex patterns
 */
function parseRegexOutput(output: string, regexPatterns: any): any {
  const result: any = {};

  for (const [key, pattern] of Object.entries(regexPatterns)) {
    const regex = new RegExp(pattern as string, 'gm');
    const matches = [...output.matchAll(regex)];

    if (matches.length > 0) {
      result[key] = matches.map(m => m[1] || m[0]);
    }
  }

  return result;
}

/**
 * Parse output using custom JavaScript parser
 */
function parseCustomOutput(output: string, parserCode: string): any {
  try {
    // Create a safe execution context
    const fn = new Function('output', parserCode);
    return fn(output);
  } catch (error: any) {
    throw new Error(`Custom parser execution failed: ${error.message}`);
  }
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
