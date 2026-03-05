/**
 * Tool Testing and Validation Service
 * Performs automated testing and validation of security tools
 * Tests run INSIDE Docker containers via dockerExecutor (not local spawn)
 */

import { dockerExecutor } from './docker-executor';
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
 * Per-tool help command configuration
 * Maps toolId → correct help flag, acceptable exit codes, and verification string
 * Sourced from docs/TOOL-REFERENCE.md
 */
const TOOL_HELP_CONFIG: Record<string, { helpFlag: string; exitCodes: number[]; verifyString: string }> = {
  'nmap':                 { helpFlag: '-h',      exitCodes: [0],    verifyString: 'Nmap' },
  'ffuf':                 { helpFlag: '-h',      exitCodes: [0],    verifyString: 'Fuzz Faster' },
  'nuclei':               { helpFlag: '-h',      exitCodes: [0],    verifyString: 'Nuclei' },
  'gobuster':             { helpFlag: '--help',  exitCodes: [0],    verifyString: 'Usage:' },
  'nikto':                { helpFlag: '-H',      exitCodes: [0],    verifyString: 'Nikto' },
  'searchsploit':         { helpFlag: '-h',      exitCodes: [0, 2], verifyString: 'Usage: searchsploit' },
  'proxychains4':         { helpFlag: '--help',  exitCodes: [0, 1], verifyString: 'Usage:' },
  'hydra':                { helpFlag: '-h',      exitCodes: [0],    verifyString: 'Hydra' },
  'hashcat':              { helpFlag: '--help',  exitCodes: [0],    verifyString: 'hashcat' },
  'msfconsole':           { helpFlag: '-h',      exitCodes: [0],    verifyString: 'Usage: msfconsole' },
  'wpscan':               { helpFlag: '--help',  exitCodes: [0],    verifyString: 'WordPress Security Scanner' },
  'tshark':               { helpFlag: '-h',      exitCodes: [0],    verifyString: 'TShark' },
  'bbot':                 { helpFlag: '-h',      exitCodes: [0],    verifyString: 'usage: bbot' },
  'subfinder':            { helpFlag: '-h',      exitCodes: [0],    verifyString: 'subfinder' },
  'amass':                { helpFlag: '-h',      exitCodes: [0],    verifyString: 'amass' },
  'httpx':                { helpFlag: '-h',      exitCodes: [0],    verifyString: 'httpx' },
  'katana':               { helpFlag: '-h',      exitCodes: [0],    verifyString: 'katana' },
  'feroxbuster':          { helpFlag: '--help',  exitCodes: [0],    verifyString: 'feroxbuster' },
  'dirsearch':            { helpFlag: '--help',  exitCodes: [0],    verifyString: 'dirsearch' },
  'dnsx':                 { helpFlag: '-h',      exitCodes: [0],    verifyString: 'dnsx' },
  'x8':                   { helpFlag: '--help',  exitCodes: [0],    verifyString: 'x8' },
  'enum4linux':           { helpFlag: '-h',      exitCodes: [0],    verifyString: 'enum4linux' },
  'nxc':                  { helpFlag: '--help',  exitCodes: [0],    verifyString: 'nxc' },
  'testssl.sh':           { helpFlag: '--help',  exitCodes: [0],    verifyString: 'testssl' },
  'evil-winrm':           { helpFlag: '-h',      exitCodes: [0],    verifyString: 'Evil-WinRM' },
  'impacket-secretsdump': { helpFlag: '-h',      exitCodes: [0],    verifyString: 'Impacket' },
  'bloodhound-python':    { helpFlag: '-h',      exitCodes: [0],    verifyString: 'bloodhound' },
  'certbot':              { helpFlag: '--help',  exitCodes: [0],    verifyString: 'certbot' },
  'masscan':              { helpFlag: '--help',  exitCodes: [0, 1], verifyString: 'masscan' },
  'nbtscan':              { helpFlag: '-h',      exitCodes: [0],    verifyString: 'NBTscan' },
  'python3':              { helpFlag: '--help',  exitCodes: [0],    verifyString: 'usage: python' },
  'pwsh':                 { helpFlag: '--help',  exitCodes: [0],    verifyString: 'PowerShell' },
  'node':                 { helpFlag: '--help',  exitCodes: [0],    verifyString: 'Usage: node' },
  'az':                   { helpFlag: '--help',  exitCodes: [0],    verifyString: 'az' },
  'whatweb':              { helpFlag: '--help',  exitCodes: [0],    verifyString: 'WhatWeb' },
  'freeze':               { helpFlag: '--help',  exitCodes: [0],    verifyString: 'Freeze' },
  'scarecrow':            { helpFlag: '--help',  exitCodes: [0],    verifyString: 'ScareCrow' },
  'dalfox':               { helpFlag: '--help',  exitCodes: [0],    verifyString: 'DalFox' },
  'zmap':                 { helpFlag: '--help',  exitCodes: [0, 1], verifyString: 'zmap' },
  'wafw00f':              { helpFlag: '--help',  exitCodes: [0],    verifyString: 'wafw00f' },
  'joomscan':             { helpFlag: '--help',  exitCodes: [0],    verifyString: 'OWASP' },
  'r2':                   { helpFlag: '-h',      exitCodes: [0],    verifyString: 'radare2' },
  'radare2':              { helpFlag: '-h',      exitCodes: [0],    verifyString: 'radare2' },
};

/** Default fallback for tools not in the config map */
const DEFAULT_HELP_CONFIG = { helpFlag: '--help', exitCodes: [0, 1], verifyString: '' };

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
  const containerName = (tool as any).containerName || 'rtpi-tools';
  const containerUser = (tool as any).containerUser || 'root';
  const toolShortId = (tool as any).toolId || '';
  // Use baseCommand from config if set (e.g., 'perl /path/to/nikto.pl'), else binaryPath
  const effectiveBinary = (config as any)?.baseCommand || tool.binaryPath;
  const results: TestResult[] = [];

  console.log(`Running all tests for tool: ${tool.name} (container: ${containerName}, user: ${containerUser})`);

  // 1. Syntax test — runs help command inside Docker container
  const syntaxResult = await testSyntax(effectiveBinary, config, containerName, containerUser, toolShortId);
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
    console.error(`Syntax test failed for ${tool.name}`);
    await updateValidationStatus(toolId, 'tested');
    return results;
  }

  // 2. Health check test
  if (config.healthCheckCommand) {
    const healthResult = await testHealthCheck(tool.binaryPath, config, containerName, containerUser);
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
      const testResult = await runConfigTest(tool.binaryPath, test, config, containerName, containerUser);
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
  await updateValidationStatus(toolId, allPassed ? 'validated' : 'tested');

  console.log(
    `All tests completed for ${tool.name}: ${allPassed ? 'PASSED' : 'FAILED'}`
  );

  return results;
}

/**
 * Test if the tool binary exists and is executable via help command
 * Runs the tool's help flag inside the Docker container and verifies output
 */
async function testSyntax(
  binaryPath: string,
  _config: ToolConfiguration,
  containerName: string,
  containerUser: string,
  toolShortId: string
): Promise<TestResult> {
  const startTime = Date.now();
  const helpConfig = TOOL_HELP_CONFIG[toolShortId] || DEFAULT_HELP_CONFIG;

  try {
    // Split binaryPath on spaces to handle interpreter prefixes (e.g., 'perl /path/to/nikto.pl')
    const cmdParts = binaryPath.includes(' ') ? binaryPath.split(/\s+/) : [binaryPath];
    const cmd = [...cmdParts, helpConfig.helpFlag];
    const result = await runTestCommand(cmd, 10000, containerName, containerUser);
    const executionTime = Date.now() - startTime;
    const output = (result.stdout || '') + (result.stderr || '');

    const exitOk = helpConfig.exitCodes.includes(result.exitCode);
    const outputOk = !helpConfig.verifyString || output.toLowerCase().includes(helpConfig.verifyString.toLowerCase());
    const passed = exitOk && outputOk;

    return {
      testType: 'syntax',
      passed,
      message: passed
        ? `Tool responds to '${helpConfig.helpFlag}' — installation, execution, and output verified`
        : `Help command failed: exit=${result.exitCode}${!outputOk ? `, expected output containing "${helpConfig.verifyString}"` : ''}`,
      details: {
        command: cmd.join(' '),
        binaryPath,
        helpFlag: helpConfig.helpFlag,
        containerName,
      },
      executionTimeMs: executionTime,
      actualExitCode: result.exitCode,
      actualOutput: output.substring(0, 2000),
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    return {
      testType: 'syntax',
      passed: false,
      message: `Binary not found or container not running: ${error.message}`,
      details: {
        binaryPath,
        containerName,
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
  config: ToolConfiguration,
  containerName: string,
  containerUser: string
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
    const healthArgs = config.healthCheckCommand.split(/\s+/);
    const cmd = [binaryPath, ...healthArgs];
    const result = await runTestCommand(cmd, 10000, containerName, containerUser);

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
  _config: ToolConfiguration,
  containerName: string,
  containerUser: string
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const testArgs = test.testCommand.split(/\s+/);
    const cmd = [binaryPath, ...testArgs];
    const result = await runTestCommand(cmd, test.timeout || 30000, containerName, containerUser);

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

    // Validate that parser configuration is valid
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
 * Run a test command inside a Docker container
 */
async function runTestCommand(
  cmd: string[],
  timeout: number,
  containerName: string,
  containerUser: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
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
 * Quick health check for a tool (lightweight version)
 */
export async function quickHealthCheck(toolId: string): Promise<boolean> {
  const tool = await getToolById(toolId);
  if (!tool) {
    return false;
  }

  const config = tool.config as ToolConfiguration;
  const containerName = (tool as any).containerName || 'rtpi-tools';
  const containerUser = (tool as any).containerUser || 'root';

  try {
    const commandStr = config.healthCheckCommand || '--help';
    const args = commandStr.split(/\s+/);
    const effectiveBin = (config as any)?.baseCommand || tool.binaryPath;
    const binParts = effectiveBin.includes(' ') ? effectiveBin.split(/\s+/) : [effectiveBin];
    const cmd = [...binParts, ...args];
    const result = await runTestCommand(cmd, 5000, containerName, containerUser);

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

/**
 * Export the help config for use by other services (e.g., AI command generation)
 */
export { TOOL_HELP_CONFIG, DEFAULT_HELP_CONFIG };
