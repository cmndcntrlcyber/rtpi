/**
 * Tool Testing and Validation Service
 * Performs automated testing and validation of security tools
 */

import { spawn } from 'child_process';
import { db } from '../db';
import { toolRegistry, toolTestResults } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { getToolById, updateValidationStatus, addToolTestResult } from './tool-registry-manager';
import type { ToolConfiguration, ToolTestConfig } from '../../shared/types/tool-config';

/**
 * Test types
 */
export type TestType = 'syntax' | 'execution' | 'output-parsing' | 'health-check';

/**
 * Test result interface
 */
export interface TestResult {
  testType: TestType;
  passed: boolean;
  message: string;
  details?: any;
  executionTimeMs?: number;
  actualOutput?: string;
  expectedOutput?: string;
  actualExitCode?: number;
  expectedExitCode?: number;
}

/**
 * Run all tests for a tool
 */
export async function runAllTests(
  toolId: string,
  userId?: string
): Promise<TestResult[]> {
  const tool = await getToolById(toolId);
  if (!tool) {
    throw new Error(`Tool not found: ${toolId}`);
  }

  const config = tool.config as ToolConfiguration;
  const results: TestResult[] = [];

  console.log(`Running all tests for tool: ${config.name}`);

  // 1. Syntax test (binary exists and is executable)
  const syntaxResult = await testSyntax(tool.binaryPath, config);
  results.push(syntaxResult);

  // Save syntax test result
  await addToolTestResult(
    toolId,
    'syntax',
    syntaxResult.passed,
    {
      testCommand: syntaxResult.details?.command,
      actualExitCode: syntaxResult.actualExitCode,
      actualOutput: syntaxResult.actualOutput,
      errorMessage: syntaxResult.passed ? undefined : syntaxResult.message,
      executionTimeMs: syntaxResult.executionTimeMs,
    },
    userId
  );

  // If syntax test fails, don't continue with other tests
  if (!syntaxResult.passed) {
    console.error(`Syntax test failed for ${config.name}`);
    await updateValidationStatus(toolId, 'failed');
    return results;
  }

  // 2. Health check test
  if (config.healthCheckCommand) {
    const healthResult = await testHealthCheck(tool.binaryPath, config);
    results.push(healthResult);

    await addToolTestResult(
      toolId,
      'execution',
      healthResult.passed,
      {
        testCommand: config.healthCheckCommand,
        actualExitCode: healthResult.actualExitCode,
        actualOutput: healthResult.actualOutput,
        errorMessage: healthResult.passed ? undefined : healthResult.message,
        executionTimeMs: healthResult.executionTimeMs,
      },
      userId
    );
  }

  // 3. Configuration-defined tests
  if (config.tests && config.tests.length > 0) {
    for (const test of config.tests) {
      const testResult = await runConfigTest(tool.binaryPath, test, config);
      results.push(testResult);

      await addToolTestResult(
        toolId,
        test.testType,
        testResult.passed,
        {
          testCommand: test.testCommand,
          expectedExitCode: test.expectedExitCode,
          actualExitCode: testResult.actualExitCode,
          expectedOutput: test.expectedOutput,
          actualOutput: testResult.actualOutput,
          errorMessage: testResult.passed ? undefined : testResult.message,
          executionTimeMs: testResult.executionTimeMs,
        },
        userId
      );
    }
  }

  // 4. Output parsing test (if parser is configured)
  if (config.outputParser) {
    const parsingResult = await testOutputParsing(toolId, config);
    results.push(parsingResult);

    await addToolTestResult(
      toolId,
      'output-parsing',
      parsingResult.passed,
      {
        errorMessage: parsingResult.passed ? undefined : parsingResult.message,
      },
      userId
    );
  }

  // Update validation status based on all results
  const allPassed = results.every(r => r.passed);
  await updateValidationStatus(toolId, allPassed ? 'validated' : 'failed');

  console.log(
    `All tests completed for ${config.name}: ${allPassed ? 'PASSED' : 'FAILED'}`
  );

  return results;
}

/**
 * Test if the tool binary exists and is executable (syntax test)
 */
async function testSyntax(
  binaryPath: string,
  _config: ToolConfiguration
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Try to run the tool with --version or --help to verify it's executable
    const testCommand = `${binaryPath} --version`;
    const result = await runTestCommand(testCommand, 5000); // 5 second timeout

    const executionTime = Date.now() - startTime;

    // Binary is executable if exit code is 0 or 1 (some tools return 1 for --version)
    const passed = result.exitCode === 0 || result.exitCode === 1;

    return {
      testType: 'syntax',
      passed,
      message: passed
        ? 'Binary is executable and responds to commands'
        : `Binary exists but returned unexpected exit code: ${result.exitCode}`,
      details: {
        command: testCommand,
        binaryPath,
      },
      executionTimeMs: executionTime,
      actualExitCode: result.exitCode,
      actualOutput: result.stdout,
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    return {
      testType: 'syntax',
      passed: false,
      message: `Binary not found or not executable: ${error.message}`,
      details: {
        binaryPath,
        error: error.message,
      },
      executionTimeMs: executionTime,
    };
  }
}

/**
 * Test tool health check command
 */
async function testHealthCheck(
  binaryPath: string,
  config: ToolConfiguration
): Promise<TestResult> {
  if (!config.healthCheckCommand) {
    return {
      testType: 'health-check',
      passed: true,
      message: 'No health check configured (skipped)',
    };
  }

  const startTime = Date.now();

  try {
    const result = await runTestCommand(
      `${binaryPath} ${config.healthCheckCommand}`,
      10000 // 10 second timeout
    );

    const executionTime = Date.now() - startTime;
    const passed = result.exitCode === 0;

    return {
      testType: 'health-check',
      passed,
      message: passed
        ? 'Health check passed'
        : `Health check failed with exit code: ${result.exitCode}`,
      executionTimeMs: executionTime,
      actualExitCode: result.exitCode,
      actualOutput: result.stdout,
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    return {
      testType: 'health-check',
      passed: false,
      message: `Health check failed: ${error.message}`,
      executionTimeMs: executionTime,
    };
  }
}

/**
 * Run a configuration-defined test
 */
async function runConfigTest(
  binaryPath: string,
  test: ToolTestConfig,
  _config: ToolConfiguration
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const command = `${binaryPath} ${test.testCommand}`;
    const result = await runTestCommand(command, test.timeout || 30000);

    const executionTime = Date.now() - startTime;

    // Check exit code if expected
    let passed = true;
    let message = 'Test passed';

    if (test.expectedExitCode !== undefined) {
      passed = result.exitCode === test.expectedExitCode;
      if (!passed) {
        message = `Expected exit code ${test.expectedExitCode}, got ${result.exitCode}`;
      }
    }

    // Check output if expected
    if (passed && test.expectedOutput) {
      passed = result.stdout.includes(test.expectedOutput);
      if (!passed) {
        message = 'Expected output not found in stdout';
      }
    }

    // Check output regex if provided
    if (passed && test.expectedOutputRegex) {
      const regex = new RegExp(test.expectedOutputRegex);
      passed = regex.test(result.stdout);
      if (!passed) {
        message = 'Output does not match expected regex pattern';
      }
    }

    return {
      testType: test.testType,
      passed,
      message,
      executionTimeMs: executionTime,
      actualExitCode: result.exitCode,
      expectedExitCode: test.expectedExitCode,
      actualOutput: result.stdout,
      expectedOutput: test.expectedOutput,
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    return {
      testType: test.testType,
      passed: false,
      message: `Test execution failed: ${error.message}`,
      executionTimeMs: executionTime,
    };
  }
}

/**
 * Test output parsing
 */
async function testOutputParsing(
  _toolId: string,
  config: ToolConfiguration
): Promise<TestResult> {
  if (!config.outputParser) {
    return {
      testType: 'output-parsing',
      passed: true,
      message: 'No output parser configured (skipped)',
    };
  }

  try {
    // Use example input/output if available
    const parser = config.outputParser;

    if (!parser.parserCode && parser.parserType === 'custom') {
      return {
        testType: 'output-parsing',
        passed: false,
        message: 'Custom parser configured but no parser code provided',
      };
    }

    // TODO: Test parser with example data if available
    // For now, just validate that parser configuration is valid

    const hasValidConfig =
      (parser.parserType === 'json' && !!parser.jsonPaths) ||
      (parser.parserType === 'xml' && !!parser.xmlPaths) ||
      (parser.parserType === 'regex' && !!parser.regexPatterns) ||
      (parser.parserType === 'custom' && !!parser.parserCode);

    return {
      testType: 'output-parsing',
      passed: hasValidConfig || parser.parserType === 'json',
      message: hasValidConfig
        ? 'Output parser configuration is valid'
        : 'Output parser configuration is incomplete',
    };
  } catch (error: any) {
    return {
      testType: 'output-parsing',
      passed: false,
      message: `Output parser validation failed: ${error.message}`,
    };
  }
}

/**
 * Run a test command with timeout
 */
function runTestCommand(
  command: string,
  timeout: number
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(command, {
      shell: true,
      timeout,
    });

    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timeout after ${timeout}ms`));
    }, timeout);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Quick health check for a tool (lightweight version)
 */
export async function quickHealthCheck(toolId: string): Promise<boolean> {
  const tool = await getToolById(toolId);
  if (!tool) {
    return false;
  }

  const config = tool.config as ToolConfiguration;

  try {
    // Just try to run --version or --help
    const command = config.healthCheckCommand || '--version';
    const result = await runTestCommand(
      `${tool.binaryPath} ${command}`,
      5000 // 5 second timeout
    );

    return result.exitCode === 0 || result.exitCode === 1;
  } catch (error) {
    return false;
  }
}

/**
 * Batch health check for multiple tools
 */
export async function batchHealthCheck(toolIds: string[]): Promise<{
  [toolId: string]: boolean;
}> {
  const results: { [toolId: string]: boolean } = {};

  // Run health checks in parallel
  const promises = toolIds.map(async (toolId) => {
    const healthy = await quickHealthCheck(toolId);
    results[toolId] = healthy;
  });

  await Promise.all(promises);

  return results;
}

/**
 * Validate tool configuration without running tests
 */
export async function validateToolConfiguration(
  config: ToolConfiguration
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Check required fields
  if (!config.toolId || config.toolId.length < 2) {
    errors.push('Tool ID is required and must be at least 2 characters');
  }

  if (!config.name || config.name.length < 2) {
    errors.push('Tool name is required and must be at least 2 characters');
  }

  if (!config.binaryPath) {
    errors.push('Binary path is required');
  }

  if (!config.category) {
    errors.push('Category is required');
  }

  // Validate parameters
  if (config.parameters) {
    const paramNames = new Set<string>();

    for (const param of config.parameters) {
      if (paramNames.has(param.name)) {
        errors.push(`Duplicate parameter name: ${param.name}`);
      }
      paramNames.add(param.name);

      if (param.type === 'enum' && (!param.enumValues || param.enumValues.length === 0)) {
        errors.push(`Parameter ${param.name} is type 'enum' but has no enum values`);
      }
    }
  }

  // Validate output parser
  if (config.outputParser) {
    const parser = config.outputParser;

    if (parser.parserType === 'custom' && !parser.parserCode) {
      errors.push('Custom parser requires parser code');
    }

    if (parser.parserType === 'regex' && !parser.regexPatterns) {
      errors.push('Regex parser requires regex patterns');
    }
  }

  // Validate tests
  if (config.tests) {
    for (let i = 0; i < config.tests.length; i++) {
      const test = config.tests[i];

      if (!test.testCommand) {
        errors.push(`Test ${i + 1} is missing test command`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get test coverage for a tool
 */
export async function getTestCoverage(toolId: string): Promise<{
  hasTests: boolean;
  testCount: number;
  passedCount: number;
  failedCount: number;
  coverage: number;
}> {
  const results = await db
    .select()
    .from(toolTestResults)
    .where(eq(toolTestResults.toolId, toolId));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  // Calculate coverage (percentage of test types covered)
  const testTypes = new Set(results.map(r => r.testType));
  const totalTestTypes = 4; // syntax, execution, output-parsing, health-check
  const coverage = (testTypes.size / totalTestTypes) * 100;

  return {
    hasTests: results.length > 0,
    testCount: results.length,
    passedCount: passed,
    failedCount: failed,
    coverage: Math.round(coverage),
  };
}

/**
 * Re-validate all tools
 */
export async function revalidateAllTools(userId?: string): Promise<{
  total: number;
  validated: number;
  failed: number;
}> {
  const tools = await db.select().from(toolRegistry);

  let validated = 0;
  let failed = 0;

  for (const tool of tools) {
    if (tool.installStatus !== 'installed') {
      continue;
    }

    try {
      const results = await runAllTests(tool.id, userId);
      const allPassed = results.every(r => r.passed);

      if (allPassed) {
        validated++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Failed to validate tool ${tool.name}:`, error);
      failed++;
    }
  }

  return {
    total: tools.length,
    validated,
    failed,
  };
}

/**
 * Get tools that need revalidation (not validated in X days)
 */
export async function getToolsNeedingRevalidation(
  daysSinceLastValidation: number = 30
): Promise<string[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastValidation);

  const tools = await db.select().from(toolRegistry);

  return tools
    .filter(tool => {
      if (tool.installStatus !== 'installed') {
        return false;
      }

      if (!tool.lastValidated) {
        return true; // Never validated
      }

      return new Date(tool.lastValidated) < cutoffDate;
    })
    .map(tool => tool.id);
}
