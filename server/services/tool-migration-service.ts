/**
 * Tool Migration Service
 * Handles automated migration of Python tools from offsec-team to RTPI
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { db } from '../db';
import { securityTools } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type { PythonToolAnalysis } from './tool-analyzer';
import { generateToolConfig } from './tool-analyzer';

/**
 * Migration status
 */
export type MigrationStatus =
  | 'pending'
  | 'analyzing'
  | 'generating-wrapper'
  | 'installing-dependencies'
  | 'testing'
  | 'registering'
  | 'completed'
  | 'failed';

/**
 * Migration result
 */
export interface MigrationResult {
  toolName: string;
  status: MigrationStatus;
  toolId?: string;
  wrapperPath?: string;
  errors?: string[];
  warnings?: string[];
  steps: MigrationStep[];
  durationMs: number;
}

/**
 * Migration step tracking
 */
export interface MigrationStep {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  output?: string;
  error?: string;
}

/**
 * Migration options
 */
export interface MigrationOptions {
  installDependencies?: boolean;
  runTests?: boolean;
  registerInDatabase?: boolean;
  generateWrapper?: boolean;
  overwriteExisting?: boolean;
}

const DEFAULT_OPTIONS: MigrationOptions = {
  installDependencies: true,
  runTests: false,
  registerInDatabase: true,
  generateWrapper: true,
  overwriteExisting: false,
};

/**
 * Migrate a Python tool to RTPI
 */
export async function migrateTool(
  analysis: PythonToolAnalysis,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const result: MigrationResult = {
    toolName: analysis.toolName,
    status: 'pending',
    errors: [],
    warnings: [],
    steps: [],
    durationMs: 0,
  };

  try {
    // Step 1: Check if tool already exists
    const existingTool = await checkExistingTool(analysis.toolName);
    if (existingTool && !opts.overwriteExisting) {
      result.status = 'failed';
      result.errors!.push(`Tool ${analysis.toolName} already exists. Use overwriteExisting option.`);
      return result;
    }

    // Step 2: Install dependencies
    if (opts.installDependencies && analysis.dependencies.length > 0) {
      const depStep = addStep(result, 'install-dependencies', 'Installing Python dependencies');
      result.status = 'installing-dependencies';

      try {
        await installDependencies(analysis.dependencies);
        completeStep(depStep, 'Installed successfully');
      } catch (error) {
        failStep(depStep, (error as Error).message);
        result.warnings!.push(`Dependency installation failed: ${(error as Error).message}`);
      }
    }

    // Step 3: Generate TypeScript wrapper
    if (opts.generateWrapper) {
      const wrapperStep = addStep(result, 'generate-wrapper', 'Generating TypeScript wrapper');
      result.status = 'generating-wrapper';

      try {
        const { wrapperPath } = await generateToolWrapper(analysis);
        completeStep(wrapperStep, `Wrapper created at ${wrapperPath}`);
        result.wrapperPath = wrapperPath;
      } catch (error) {
        failStep(wrapperStep, (error as Error).message);
        throw new Error(`Wrapper generation failed: ${(error as Error).message}`);
      }
    }

    // Step 4: Test the tool
    if (opts.runTests) {
      const testStep = addStep(result, 'run-tests', 'Running tool tests');
      result.status = 'testing';

      try {
        const testResult = await testTool(analysis);
        completeStep(testStep, testResult.success ? 'Tests passed' : 'Tests failed');

        if (!testResult.success) {
          result.warnings!.push(`Tests failed: ${testResult.error}`);
        }
      } catch (error) {
        failStep(testStep, (error as Error).message);
        result.warnings!.push(`Testing failed: ${(error as Error).message}`);
      }
    }

    // Step 5: Register in database
    if (opts.registerInDatabase) {
      const registerStep = addStep(result, 'register-database', 'Registering tool in database');
      result.status = 'registering';

      try {
        // Get wrapper info from previous step
        const wrapperInfo = { wrapperPath: result.wrapperPath || '', relativePath: result.wrapperPath || '' };
        const toolId = await registerToolInDatabase(analysis, wrapperInfo, existingTool?.id);
        completeStep(registerStep, `Registered with ID ${toolId}`);
        result.toolId = toolId;
      } catch (error) {
        failStep(registerStep, (error as Error).message);
        throw new Error(`Database registration failed: ${(error as Error).message}`);
      }
    }

    result.status = 'completed';
  } catch (error) {
    result.status = 'failed';
    result.errors!.push((error as Error).message);
  } finally {
    result.durationMs = Date.now() - startTime;
  }

  return result;
}

/**
 * Check if tool already exists in database
 */
async function checkExistingTool(toolName: string): Promise<{ id: string } | null> {
  const [tool] = await db
    .select({ id: securityTools.id })
    .from(securityTools)
    .where(eq(securityTools.name, toolName))
    .limit(1);

  return tool || null;
}

/**
 * Install Python dependencies
 */
async function installDependencies(dependencies: any[]): Promise<void> {
  const packages = dependencies.map(d => d.name).join(' ');

  return new Promise((resolve, reject) => {
    const proc = spawn('pip', ['install', ...packages.split(' ')], {
      stdio: 'pipe',
    });

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Dependency installation failed: ${errorOutput || output}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Generate TypeScript wrapper for Python tool
 */
async function generateToolWrapper(analysis: PythonToolAnalysis): Promise<{ wrapperPath: string; relativePath: string }> {
  const wrapperDir = path.join(process.cwd(), 'server', 'services', 'python-tools');

  // Ensure directory exists
  try {
    await fs.mkdir(wrapperDir, { recursive: true });
  } catch (error) {
    // Directory may already exist
  }

  const wrapperPath = path.join(wrapperDir, `${analysis.toolName}.ts`);
  const relativePath = path.relative(process.cwd(), wrapperPath);

  const wrapperCode = generateWrapperCode(analysis);

  await fs.writeFile(wrapperPath, wrapperCode, 'utf-8');

  return { wrapperPath, relativePath };
}

/**
 * Generate TypeScript wrapper code
 */
function generateWrapperCode(analysis: PythonToolAnalysis): string {
  const { toolName, className, filePath, methods, description } = analysis;

  // Generate method signatures
  const methodSignatures = methods
    .filter(m => !m.name.startsWith('_'))
    .map(m => {
      const params = m.parameters
        .map(p => `${p.name}: ${mapPythonTypeToTS(p.type)}`)
        .join(', ');

      return `  /**
   * ${m.description}
   */
  async ${m.name}(${params}): Promise<any> {
    return this.executePythonMethod('${m.name}', {
      ${m.parameters.map(p => p.name).join(', ')}
    });
  }`;
    }).join('\n\n');

  return `/**
 * ${toolName} - TypeScript Wrapper
 * Auto-generated from offsec-team Python tool
 *
 * ${description}
 */

import { spawn } from 'child_process';
import path from 'path';

export class ${className}Wrapper {
  private pythonPath: string;
  private modulePath: string;

  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.modulePath = path.join(
      process.cwd(),
      '${filePath.replace(process.cwd(), '.')}'
    );
  }

  /**
   * Execute a Python method with parameters
   */
  private async executePythonMethod(
    methodName: string,
    params: Record<string, any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonScript = \`
import sys
import json
sys.path.append('${path.dirname(filePath)}')

from ${path.basename(filePath, '.py')} import ${className}

# Create instance
tool = ${className}()

# Call method
result = tool.\${methodName}(**json.loads(sys.argv[1]))

# Return result as JSON
print(json.dumps(result))
\`;

      const proc = spawn(this.pythonPath, ['-c', pythonScript, JSON.stringify(params)], {
        stdio: 'pipe',
      });

      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (error) {
            reject(new Error(\`Failed to parse output: \${output}\`));
          }
        } else {
          reject(new Error(\`Python execution failed: \${errorOutput || output}\`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

${methodSignatures}
}

/**
 * Create a new instance of the tool
 */
export function create${className}(): ${className}Wrapper {
  return new ${className}Wrapper();
}
`;
}

/**
 * Map Python types to TypeScript types
 */
function mapPythonTypeToTS(pythonType: string): string {
  const normalized = pythonType.toLowerCase().replace(/\s+/g, '');

  if (normalized.includes('str')) return 'string';
  if (normalized.includes('int') || normalized.includes('float')) return 'number';
  if (normalized.includes('bool')) return 'boolean';
  if (normalized.includes('list')) return 'any[]';
  if (normalized.includes('dict')) return 'Record<string, any>';
  if (normalized.includes('optional')) return `${mapPythonTypeToTS(normalized.replace('optional', ''))} | null`;

  return 'any';
}

/**
 * Test the tool
 */
async function testTool(analysis: PythonToolAnalysis): Promise<{ success: boolean; error?: string }> {
  if (!analysis.hasTests) {
    return { success: true }; // Skip if no tests
  }

  const testFilePath = analysis.filePath.replace('.py', '_test.py');

  return new Promise((resolve) => {
    const proc = spawn('python', ['-m', 'pytest', testFilePath], {
      stdio: 'pipe',
    });

    let output = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: output });
      }
    });

    proc.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Register tool in database
 */
async function registerToolInDatabase(
  analysis: PythonToolAnalysis,
  wrapperInfo: { wrapperPath: string; relativePath: string },
  existingId?: string
): Promise<string> {
  const config = generateToolConfig(analysis);

  const toolData = {
    name: config.name,
    category: config.category,
    description: config.description,
    version: config.version,
    status: 'available' as const, // Match schema: "available" | "unavailable" | "deprecated"
    command: `python3 ${analysis.filePath}`, // Command to execute the Python tool
    metadata: {
      ...config.metadata,
      source: 'offsec-team',
      migrated: true,
      migrationDate: new Date().toISOString(),
      installMethod: config.installMethod,
      pythonModule: analysis.filePath,
      wrapperPath: wrapperInfo.relativePath,
    },
  };

  if (existingId) {
    // Update existing tool
    await db
      .update(securityTools)
      .set(toolData)
      .where(eq(securityTools.id, existingId));

    return existingId;
  } else {
    // Insert new tool
    const [result] = await db
      .insert(securityTools)
      .values(toolData)
      .returning({ id: securityTools.id });

    return result.id;
  }
}

/**
 * Helper: Add migration step
 */
function addStep(result: MigrationResult, _step: string, description: string): MigrationStep {
  const migrationStep: MigrationStep = {
    step: description,
    status: 'running',
    startTime: new Date(),
  };

  result.steps.push(migrationStep);
  return migrationStep;
}

/**
 * Helper: Complete migration step
 */
function completeStep(step: MigrationStep, output?: string) {
  step.status = 'completed';
  step.endTime = new Date();
  if (output) step.output = output;
}

/**
 * Helper: Fail migration step
 */
function failStep(step: MigrationStep, error: string) {
  step.status = 'failed';
  step.endTime = new Date();
  step.error = error;
}

/**
 * Batch migrate multiple tools
 */
export async function batchMigrateTools(
  analyses: PythonToolAnalysis[],
  options: MigrationOptions = {}
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const analysis of analyses) {
    try {
      const result = await migrateTool(analysis, options);
      results.push(result);
    } catch (error) {
      results.push({
        toolName: analysis.toolName,
        status: 'failed',
        errors: [(error as Error).message],
        warnings: [],
        steps: [],
        durationMs: 0,
      });
    }
  }

  return results;
}

/**
 * Get migration status
 */
export async function getMigrationStatus(toolName: string): Promise<{
  exists: boolean;
  installed: boolean;
  toolId?: string;
  config?: unknown;
}> {
  const [tool] = await db
    .select()
    .from(securityTools)
    .where(eq(securityTools.name, toolName))
    .limit(1);

  if (!tool) {
    return { exists: false, installed: false };
  }

  return {
    exists: true,
    installed: tool.status === 'available',
    toolId: tool.id,
    config: tool.metadata,
  };
}
