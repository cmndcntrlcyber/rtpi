/**
 * Tool Registry Manager Service
 * Manages CRUD operations for the tool registry
 */

import { db } from '../db';
import {
  toolRegistry,
  toolParameters,
  toolExecutions,
  toolOutputParsers,
  toolTestResults,
} from '../../shared/schema';
import { eq, and, like } from 'drizzle-orm';
import type {
  ToolConfiguration,
  ToolRegistryEntry,
} from '../../shared/types/tool-config';
import {
  validateToolConfiguration,
  validateUpdateToolRegistry,
} from '../validation/tool-config-schema';

/**
 * Register a new tool in the registry
 */
export async function registerTool(config: ToolConfiguration, _userId?: string): Promise<string> {
  // Validate configuration
  const { error } = validateToolConfiguration(config);
  if (error) {
    throw new Error(`Invalid tool configuration: ${error.message}`);
  }

  try {
    // Check if tool already exists
    const existing = await db
      .select()
      .from(toolRegistry)
      .where(eq(toolRegistry.toolId, config.toolId));

    if (existing.length > 0) {
      throw new Error(`Tool with ID '${config.toolId}' already exists`);
    }

    // Insert tool registry entry
    const [tool] = await db.insert(toolRegistry).values({
      toolId: config.toolId,
      name: config.name,
      version: config.version,
      category: config.category,
      description: config.description,
      installMethod: config.installMethod,
      installCommand: config.installCommand,
      dockerImage: config.dockerImage,
      githubUrl: config.githubUrl,
      binaryPath: config.binaryPath,
      config: config as any, // Store full config as JSONB
      tags: config.tags || [],
      notes: config.notes,
      homepage: config.homepage,
      documentation: config.documentation,
      installStatus: 'pending',
      validationStatus: 'pending',
    }).returning();

    // Insert parameters
    if (config.parameters && config.parameters.length > 0) {
      await db.insert(toolParameters).values(
        config.parameters.map((param, index) => ({
          toolId: tool.id,
          parameterName: param.name,
          parameterType: param.type,
          description: param.description,
          required: param.required,
          defaultValue: param.defaultValue?.toString(),
          validationRegex: param.validationRegex,
          enumValues: param.enumValues || [],
          placeholder: param.placeholder,
          helpText: param.helpText,
          displayOrder: index,
        }))
      );
    }

    // Insert output parser if configured
    if (config.outputParser) {
      await db.insert(toolOutputParsers).values({
        toolId: tool.id,
        parserName: config.outputParser.parserName,
        parserType: config.outputParser.parserType,
        outputFormat: config.outputParser.outputFormat,
        parserCode: config.outputParser.parserCode,
        regexPatterns: config.outputParser.regexPatterns || {},
        jsonPaths: config.outputParser.jsonPaths || {},
        xmlPaths: config.outputParser.xmlPaths || {},
      });
    }

    console.log(`Tool '${config.name}' registered successfully with ID: ${tool.id}`);
    return tool.id;
  } catch (error: any) {
    console.error('Failed to register tool:', error);
    throw new Error(`Failed to register tool: ${error.message}`);
  }
}

/**
 * Get a tool by ID (UUID)
 */
export async function getToolById(id: string): Promise<ToolRegistryEntry | null> {
  const [tool] = await db
    .select()
    .from(toolRegistry)
    .where(eq(toolRegistry.id, id));

  return tool || null;
}

/**
 * Get a tool by tool ID (string identifier like 'nmap')
 */
export async function getToolByToolId(toolId: string): Promise<ToolRegistryEntry | null> {
  const [tool] = await db
    .select()
    .from(toolRegistry)
    .where(eq(toolRegistry.toolId, toolId));

  return tool || null;
}

/**
 * Get tool parameters
 */
export async function getToolParameters(toolId: string): Promise<any[]> {
  return await db
    .select()
    .from(toolParameters)
    .where(eq(toolParameters.toolId, toolId))
    .orderBy(toolParameters.displayOrder);
}

/**
 * List all tools with optional filters
 */
export async function listTools(filters?: {
  category?: string;
  installStatus?: string;
  validationStatus?: string;
  search?: string;
  tags?: string[];
}): Promise<ToolRegistryEntry[]> {
  let query = db.select().from(toolRegistry);

  const conditions: any[] = [];

  if (filters?.category) {
    conditions.push(eq(toolRegistry.category, filters.category as any));
  }

  if (filters?.installStatus) {
    conditions.push(eq(toolRegistry.installStatus, filters.installStatus as any));
  }

  if (filters?.validationStatus) {
    conditions.push(eq(toolRegistry.validationStatus, filters.validationStatus));
  }

  if (filters?.search) {
    conditions.push(
      like(toolRegistry.name, `%${filters.search}%`)
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const tools = await query;

  // Filter by tags if provided (JSONB array contains check)
  if (filters?.tags && filters.tags.length > 0) {
    return tools.filter(tool => {
      const toolTags = Array.isArray(tool.tags) ? tool.tags : [];
      return filters.tags!.some(tag => toolTags.includes(tag));
    });
  }

  return tools;
}

/**
 * Update a tool
 */
export async function updateTool(
  id: string,
  updates: Partial<ToolRegistryEntry>
): Promise<void> {
  // Validate updates
  const { error } = validateUpdateToolRegistry(updates);
  if (error) {
    throw new Error(`Invalid update data: ${error.message}`);
  }

  const updateData: any = {
    ...updates,
    updatedAt: new Date(),
  };

  await db
    .update(toolRegistry)
    .set(updateData)
    .where(eq(toolRegistry.id, id));

  console.log(`Tool ${id} updated successfully`);
}

/**
 * Update tool installation status
 */
export async function updateInstallStatus(
  id: string,
  status: 'pending' | 'installing' | 'installed' | 'failed' | 'updating',
  log?: string
): Promise<void> {
  const updateData: any = {
    installStatus: status,
    updatedAt: new Date(),
  };

  if (log) {
    updateData.installLog = log;
  }

  if (status === 'installed') {
    updateData.installedAt = new Date();
  }

  await db
    .update(toolRegistry)
    .set(updateData)
    .where(eq(toolRegistry.id, id));
}

/**
 * Update tool validation status
 */
export async function updateValidationStatus(
  id: string,
  status: 'validated' | 'pending' | 'failed'
): Promise<void> {
  await db
    .update(toolRegistry)
    .set({
      validationStatus: status,
      lastValidated: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(toolRegistry.id, id));
}

/**
 * Delete a tool from the registry
 */
export async function deleteTool(id: string): Promise<void> {
  // Parameters, parsers, executions, and test results will be cascade deleted
  await db.delete(toolRegistry).where(eq(toolRegistry.id, id));
  console.log(`Tool ${id} deleted successfully`);
}

/**
 * Get tool execution history
 */
export async function getToolExecutionHistory(
  toolId: string,
  limit: number = 50
): Promise<any[]> {
  return await db
    .select()
    .from(toolExecutions)
    .where(eq(toolExecutions.toolId, toolId))
    .orderBy(toolExecutions.createdAt)
    .limit(limit);
}

/**
 * Get tool statistics
 */
export async function getToolStatistics(toolId: string): Promise<{
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastExecutedAt: Date | null;
}> {
  const executions = await db
    .select()
    .from(toolExecutions)
    .where(eq(toolExecutions.toolId, toolId));

  const successful = executions.filter(e => e.status === 'completed').length;
  const failed = executions.filter(e => e.status === 'failed').length;

  const durations = executions
    .filter(e => e.durationMs !== null)
    .map(e => e.durationMs!);

  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const lastExecution = executions.length > 0
    ? new Date(Math.max(...executions.map(e => new Date(e.createdAt).getTime())))
    : null;

  return {
    totalExecutions: executions.length,
    successfulExecutions: successful,
    failedExecutions: failed,
    averageDuration: Math.round(avgDuration),
    lastExecutedAt: lastExecution,
  };
}

/**
 * Search tools by name, description, or tags
 */
export async function searchTools(query: string): Promise<ToolRegistryEntry[]> {
  const tools = await db.select().from(toolRegistry);

  const lowerQuery = query.toLowerCase();

  return tools.filter(tool => {
    const nameMatch = tool.name.toLowerCase().includes(lowerQuery);
    const descMatch = tool.description?.toLowerCase().includes(lowerQuery);
    const toolIdMatch = tool.toolId.toLowerCase().includes(lowerQuery);
    const tagsMatch = Array.isArray(tool.tags) &&
      tool.tags.some(tag => tag.toLowerCase().includes(lowerQuery));

    return nameMatch || descMatch || toolIdMatch || tagsMatch;
  });
}

/**
 * Get tools by category
 */
export async function getToolsByCategory(category: string): Promise<ToolRegistryEntry[]> {
  return await db
    .select()
    .from(toolRegistry)
    .where(eq(toolRegistry.category, category as any));
}

/**
 * Get installed tools only
 */
export async function getInstalledTools(): Promise<ToolRegistryEntry[]> {
  return await db
    .select()
    .from(toolRegistry)
    .where(eq(toolRegistry.installStatus, 'installed'));
}

/**
 * Get validated tools only
 */
export async function getValidatedTools(): Promise<ToolRegistryEntry[]> {
  return await db
    .select()
    .from(toolRegistry)
    .where(eq(toolRegistry.validationStatus, 'validated'));
}

/**
 * Get tool output parser
 */
export async function getToolOutputParser(toolId: string): Promise<any | null> {
  const [parser] = await db
    .select()
    .from(toolOutputParsers)
    .where(eq(toolOutputParsers.toolId, toolId));

  return parser || null;
}

/**
 * Update tool output parser
 */
export async function updateToolOutputParser(
  toolId: string,
  parserConfig: any
): Promise<void> {
  // Check if parser exists
  const existing = await getToolOutputParser(toolId);

  if (existing) {
    // Update existing parser
    await db
      .update(toolOutputParsers)
      .set({
        ...parserConfig,
        updatedAt: new Date(),
      })
      .where(eq(toolOutputParsers.toolId, toolId));
  } else {
    // Insert new parser
    await db.insert(toolOutputParsers).values({
      toolId,
      ...parserConfig,
    });
  }
}

/**
 * Get tool test results
 */
export async function getToolTestResults(toolId: string): Promise<any[]> {
  return await db
    .select()
    .from(toolTestResults)
    .where(eq(toolTestResults.toolId, toolId))
    .orderBy(toolTestResults.testedAt);
}

/**
 * Add test result
 */
export async function addToolTestResult(
  toolId: string,
  testType: string,
  passed: boolean,
  details?: {
    testCommand?: string;
    expectedExitCode?: number;
    actualExitCode?: number;
    expectedOutput?: string;
    actualOutput?: string;
    errorMessage?: string;
    executionTimeMs?: number;
  },
  testedBy?: string
): Promise<string> {
  const [result] = await db.insert(toolTestResults).values({
    toolId,
    testType,
    passed,
    testCommand: details?.testCommand,
    expectedExitCode: details?.expectedExitCode,
    actualExitCode: details?.actualExitCode,
    expectedOutput: details?.expectedOutput,
    actualOutput: details?.actualOutput,
    errorMessage: details?.errorMessage,
    executionTimeMs: details?.executionTimeMs,
    testedBy: testedBy,
  }).returning();

  return result.id;
}

/**
 * Export tool configuration
 */
export async function exportToolConfiguration(toolId: string): Promise<ToolConfiguration> {
  const tool = await getToolByToolId(toolId);
  if (!tool) {
    throw new Error(`Tool '${toolId}' not found`);
  }

  // Return the full configuration stored in JSONB
  return tool.config as ToolConfiguration;
}

/**
 * Import tool configuration
 */
export async function importToolConfiguration(config: ToolConfiguration): Promise<string> {
  return await registerTool(config);
}
