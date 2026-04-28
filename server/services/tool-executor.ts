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

  const config = (tool.config as any) || {};

  // Build command with parameters (self-repairs registry if config is malformed)
  const command = await buildCommand(tool, request.parameters);

  // Defensive guard: never hand a nullish command to Drizzle, which would
  // serialize as `default` and fail the NOT NULL constraint with a cryptic SQL error.
  if (typeof command !== 'string' || command.length === 0) {
    throw new Error(
      `Refusing to insert tool_executions row: empty command for tool '${tool.toolId}' (${tool.id}). Registry config is invalid.`
    );
  }

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
    // binaryPath is a top-level column on toolRegistry; config.binaryPath is vestigial.
    const binaryPath = (tool as any).binaryPath || config.binaryPath || tool.toolId;
    const result = await runCommand(
      binaryPath,
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
 * Build command string from tool registry row and parameters.
 *
 * Self-repairing: if config.baseCommand or config.parameters are missing,
 * fall back to a positional-target invocation derived from toolId / binaryPath
 * and persist the inferred config back to tool_registry so subsequent runs
 * take the happy path without human intervention.
 */
async function buildCommand(tool: any, parameters: any): Promise<string> {
  const config = (tool.config as any) || {};
  const params = parameters || {};
  const hasBase = typeof config.baseCommand === 'string' && config.baseCommand.trim().length > 0;
  const hasParams = Array.isArray(config.parameters) && config.parameters.length > 0;

  // Happy path: full config present.
  if (hasBase || hasParams) {
    let command = config.baseCommand || '';
    for (const paramDef of config.parameters || []) {
      const value = params[paramDef.name];
      if (value === undefined || value === null) {
        if (paramDef.required) {
          throw new Error(`Required parameter '${paramDef.name}' is missing`);
        }
        continue;
      }
      validateParameter(paramDef, value);
      command = command ? `${command} ${formatParameter(paramDef, value)}` : formatParameter(paramDef, value);
    }
    return command.trim();
  }

  // Fallback path: registry row lacks a usable config. Build a minimal
  // positional invocation using whatever target-like parameter the caller
  // provided, then self-repair the registry row.
  const target = params.target ?? params.url ?? params.host ?? params.domain ?? params.ip;
  const fallbackCommand = target ? String(target) : '';

  console.warn(
    `[ToolExecutor] tool_registry row '${tool.toolId}' (${tool.id}) has no baseCommand/parameters; using positional fallback.`
  );

  // Self-repair: write a minimal config so next run hits the happy path.
  // Fire-and-forget; do not block execution if the update fails.
  void (async () => {
    try {
      const repaired = {
        ...config,
        baseCommand: config.baseCommand || '',
        parameters: [
          {
            name: 'target',
            type: 'string',
            required: false,
            description: 'Target host/URL/IP (positional, auto-seeded by self-repair).',
            positional: true,
          },
        ],
      };
      await db
        .update(toolRegistry)
        .set({ config: repaired, updatedAt: new Date() })
        .where(eq(toolRegistry.id, tool.id));
      console.info(`[ToolExecutor] Auto-patched tool_registry config for '${tool.toolId}'.`);
    } catch (e: any) {
      console.warn(`[ToolExecutor] Auto-patch failed for '${tool.toolId}': ${e?.message || e}`);
    }
  })();

  // Command must be non-empty for the NOT NULL DB column. Use target when available,
  // otherwise fall back to the tool's own id so the row is still insertable and the
  // execution will fail later with a clearer error from the container rather than SQL.
  return fallbackCommand || `# no-target-supplied for ${tool.toolId}`;
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

/**
 * Boot-time self-repair for tool_registry rows with missing command config.
 *
 * Scans every registered tool; any row whose config lacks both `baseCommand`
 * and a usable `parameters` array is patched in place with a minimal
 * positional-target config. Idempotent — re-running does nothing once rows
 * are healthy. Non-fatal on error so it never blocks server startup.
 */
export async function repairToolRegistryConfigs(): Promise<{ scanned: number; patched: number }> {
  let scanned = 0;
  let patched = 0;
  try {
    const rows = await db.select().from(toolRegistry);
    scanned = rows.length;
    for (const row of rows) {
      const config = ((row as any).config as any) || {};
      const hasBase = typeof config.baseCommand === 'string' && config.baseCommand.trim().length > 0;
      const hasParams = Array.isArray(config.parameters) && config.parameters.length > 0;
      if (hasBase || hasParams) continue;

      const repaired = {
        ...config,
        baseCommand: config.baseCommand || '',
        parameters: [
          {
            name: 'target',
            type: 'string',
            required: false,
            description: 'Target host/URL/IP (positional, auto-seeded by self-repair).',
            positional: true,
          },
        ],
      };
      try {
        await db
          .update(toolRegistry)
          .set({ config: repaired, updatedAt: new Date() })
          .where(eq(toolRegistry.id, row.id));
        patched++;
      } catch (e: any) {
        console.warn(`[ToolExecutor] repair: failed to patch '${row.toolId}': ${e?.message || e}`);
      }
    }
    if (patched > 0) {
      console.log(`🔧 tool_registry self-repair: scanned ${scanned}, patched ${patched} rows with missing baseCommand/parameters`);
    } else {
      console.log(`✅ tool_registry healthy: scanned ${scanned}, no repairs needed`);
    }
  } catch (e: any) {
    console.warn(`[ToolExecutor] repairToolRegistryConfigs failed (non-fatal): ${e?.message || e}`);
  }
  return { scanned, patched };
}
