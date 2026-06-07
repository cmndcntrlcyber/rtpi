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
import { containerRuntime } from './runtime/container-runtime';
import { ContainerError, classifyContainerError } from './runtime/error-classifier';
import { loadSkillBody, loadSkillFileByRelativePath } from './skills/skill-loader';
import { deriveToolConfigFromSkill } from './tool-config-deriver';

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
    // Classify into the structured taxonomy so callers can render
    // {code, retryable, remediation} instead of leaking exec internals.
    const structured =
      error instanceof ContainerError
        ? error.structured
        : classifyContainerError(error);
    const finalStatus = structured.code === 'timeout' ? 'timeout' : 'failed';

    await db.update(toolExecutions)
      .set({
        status: finalStatus,
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

  // Fallback path: registry row lacks a usable config. Try the SKILL.md
  // deriver first — it turns the tool's manual into a structured template
  // and caches the result back to tool_registry.config so the next run
  // takes the happy path above. If derivation fails (no SKILL.md, no
  // reasoning provider, garbage response), fall through to the legacy
  // positional stub so the row is at least insertable.
  console.warn(
    `[ToolExecutor] tool_registry row '${tool.toolId}' (${tool.id}) has no baseCommand/parameters; attempting SKILL.md-driven derivation.`
  );

  const skillBody = await loadSkillForTool(tool);
  if (skillBody) {
    const derived = await deriveToolConfigFromSkill({
      toolId: tool.toolId,
      toolName: tool.name,
      skillBody,
      agentInputs: params,
    });
    if (derived) {
      // Persist for next time (best-effort, never block execution).
      void db
        .update(toolRegistry)
        .set({ config: derived, updatedAt: new Date() })
        .where(eq(toolRegistry.id, tool.id))
        .then(() =>
          console.info(
            `[ToolExecutor] cached derived config for '${tool.toolId}' (baseCommand='${derived.baseCommand}', params=${derived.parameters.length})`,
          ),
        )
        .catch((e) =>
          console.warn(`[ToolExecutor] cache derived config failed for '${tool.toolId}':`, e),
        );
      return buildCommandFromConfig(derived, params);
    }
  }

  // Legacy positional stub — last resort when the deriver can't help. Better
  // than emitting `--target "X"` (which is the bug we're fixing), but still
  // likely to fail at the container level. The row remains insertable.
  const target = params.target ?? params.url ?? params.host ?? params.domain ?? params.ip;
  const fallbackCommand = target ? String(target) : '';

  // Cache a minimal positional config so the next attempt at least hits the
  // happy path with the corrected formatParameter (no spurious `--target`).
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
            description: 'Target host/URL/IP (positional, auto-seeded by legacy stub).',
            positional: true,
          },
        ],
      };
      await db
        .update(toolRegistry)
        .set({ config: repaired, updatedAt: new Date() })
        .where(eq(toolRegistry.id, tool.id));
      console.info(`[ToolExecutor] Auto-patched tool_registry config for '${tool.toolId}' (legacy stub).`);
    } catch (e: any) {
      console.warn(`[ToolExecutor] Auto-patch failed for '${tool.toolId}': ${e?.message || e}`);
    }
  })();

  // Command must be non-empty for the NOT NULL DB column.
  return fallbackCommand || `# no-target-supplied for ${tool.toolId}`;
}

/**
 * Renders a DerivedToolConfig into the same string shape that the happy
 * path produces, so runCommand's split-on-space tokenizer gives the right
 * argv. Extracted so the deriver-path and the cached-config-path agree.
 */
function buildCommandFromConfig(
  config: { baseCommand: string; parameters: any[] },
  params: Record<string, any>,
): string {
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
    const piece = formatParameter(paramDef, value);
    command = command ? `${command} ${piece}` : piece;
  }
  return command.trim();
}

/**
 * Loads the SKILL.md body for a tool. Prefers the explicit `skillPath`
 * column populated by the skill generator; falls back to slug-based lookup
 * under skills/tools/registry/ when the column is empty (covers older rows).
 */
async function loadSkillForTool(tool: any): Promise<string | null> {
  if (tool.skillPath) {
    const body = await loadSkillFileByRelativePath(tool.skillPath);
    if (body) return body;
  }
  // Fallback: try the registry slug. May miss for tools whose skill was
  // generated under the security/ subdir; the deriver-null path is handled.
  try {
    return await loadSkillBody('registry', tool.toolId);
  } catch {
    return null;
  }
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
 * Format a single parameter into the shell-arg fragment that gets joined
 * into the command string. The string is later split on whitespace by
 * runCommand to build argv, so we deliberately emit values WITHOUT literal
 * double-quotes — those used to be left in argv and were causing tools to
 * receive `"traveler.marriott.com"` (quotes included) as the target.
 *
 * Switch precedence per parameter definition:
 *   - `positional: true`  → just the value, no flag token
 *   - explicit `flag`      → `<flag> <value>` (or just `<flag>` for booleans)
 *   - neither              → `--<name> <value>` (legacy default; preserves
 *                            backwards-compat with rows that don't supply
 *                            `flag`/`positional`)
 *
 * Exported for unit testing — not meant to be called directly by other
 * services. Use buildCommand() / buildCommandFromConfig() instead.
 */
export function formatParameter(paramDef: any, value: any): string {
  const { name, type, flag, positional } = paramDef;

  if (positional) {
    if (type === 'array') return (value as any[]).map((v) => String(v)).join(' ');
    return String(value);
  }

  const switchToken = (typeof flag === 'string' && flag.length > 0) ? flag : `--${name}`;

  if (type === 'boolean') {
    return value ? switchToken : '';
  }

  if (type === 'array') {
    return (value as any[]).map((v) => `${switchToken} ${v}`).join(' ');
  }

  return `${switchToken} ${value}`;
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

  // Route through containerRuntime for preflight + structured errors.
  // Throws ContainerError on inspect/exec failure; callers up the stack
  // either re-throw or pass through error.structured to the UI.
  const result = await containerRuntime.exec(containerName, cmd, {
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
