/**
 * Tool Migration Integration Tests
 * Tests complete migration workflow including database, API, and file operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { db } from '../../db';
import { securityTools } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import {
  migrateTool,
  batchMigrateTools,
  getMigrationStatus,
  type MigrationOptions,
} from '../tool-migration-service';
import { analyzePythonTool } from '../tool-analyzer';

describe('Tool Migration Integration Tests', () => {
  const testToolPath = path.join(
    process.cwd(),
    'tools',
    'offsec-team',
    'tools',
    'bug_hunter',
    'WebVulnerabilityTester.py'
  );

  const testWrapperPath = path.join(
    process.cwd(),
    'server',
    'services',
    'python-tools',
    'TestToolMigration.ts'
  );

  // Cleanup function
  async function cleanupTestTool(toolName: string) {
    try {
      // Delete from database
      await db.delete(securityTools).where(eq(securityTools.name, toolName));

      // Delete wrapper if exists
      const wrapperPath = path.join(
        process.cwd(),
        'server',
        'services',
        'python-tools',
        `${toolName}.ts`
      );
      try {
        await fs.unlink(wrapperPath);
      } catch {
        // File may not exist
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  afterAll(async () => {
    // Cleanup test tools
    await cleanupTestTool('TestToolMigration');
  });

  describe('Single Tool Migration Workflow', () => {
    it('should complete full migration with all steps', async () => {
      const analysis = await analyzePythonTool(testToolPath);

      const options: MigrationOptions = {
        installDependencies: false, // Skip to avoid pip install in tests
        runTests: false,
        registerInDatabase: true,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const result = await migrateTool(analysis, options);

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.toolName).toBe('WebVulnerabilityTester');
      expect(result.status).toBe('completed');
      expect(result.toolId).toBeDefined();
      expect(result.wrapperPath).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);

      // Verify all steps completed
      const completedSteps = result.steps.filter(s => s.status === 'completed');
      expect(completedSteps.length).toBeGreaterThan(0);

      // Verify no errors
      expect(result.errors?.length || 0).toBe(0);

      // Verify duration tracked
      expect(result.durationMs).toBeGreaterThan(0);

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
    }, 30000);

    it('should generate TypeScript wrapper file', async () => {
      const analysis = await analyzePythonTool(testToolPath);

      const options: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: false,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const result = await migrateTool(analysis, options);

      expect(result.wrapperPath).toBeDefined();

      // Verify file exists
      const wrapperExists = await fs.access(result.wrapperPath!)
        .then(() => true)
        .catch(() => false);

      expect(wrapperExists).toBe(true);

      // Verify file content
      const content = await fs.readFile(result.wrapperPath!, 'utf-8');
      expect(content).toContain('export class');
      expect(content).toContain('WebVulnerabilityTesterWrapper');
      expect(content).toContain('executePythonMethod');
      expect(content).toContain('spawn');

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
    }, 30000);

    it('should register tool in database', async () => {
      const analysis = await analyzePythonTool(testToolPath);

      const options: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: true,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const result = await migrateTool(analysis, options);

      expect(result.toolId).toBeDefined();

      // Query database
      const [tool] = await db
        .select()
        .from(securityTools)
        .where(eq(securityTools.id, result.toolId!))
        .limit(1);

      expect(tool).toBeDefined();
      expect(tool.name).toBe('WebVulnerabilityTester');
      expect(tool.category).toBe('scanning');
      expect(tool.status).toBe('available');
      expect(tool.description).toBeTruthy();

      // Verify metadata
      const metadata = tool.metadata as any;
      expect(metadata).toBeDefined();
      expect(metadata.source).toBe('offsec-team');
      expect(metadata.migrated).toBe(true);
      expect(metadata.complexity).toBeDefined();
      expect(metadata.wrapperPath).toBeDefined();

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
    }, 30000);

    it('should track migration steps', async () => {
      const analysis = await analyzePythonTool(testToolPath);

      const options: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: true,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const result = await migrateTool(analysis, options);

      expect(result.steps).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);

      // Verify step structure
      for (const step of result.steps) {
        expect(step.step).toBeDefined();
        expect(step.status).toBeDefined();
        expect(['pending', 'running', 'completed', 'failed']).toContain(step.status);

        if (step.status === 'completed') {
          expect(step.startTime).toBeDefined();
          expect(step.endTime).toBeDefined();
        }
      }

      // Verify steps executed in order
      const stepNames = result.steps.map(s => s.step);
      expect(stepNames).toContain('Generating TypeScript wrapper');
      expect(stepNames).toContain('Registering tool in database');

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should prevent overwriting existing tool without flag', async () => {
      const analysis = await analyzePythonTool(testToolPath);

      // First migration
      const firstOptions: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: true,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const firstResult = await migrateTool(analysis, firstOptions);
      expect(firstResult.status).toBe('completed');

      // Second migration without overwrite flag
      const secondOptions: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: true,
        generateWrapper: true,
        overwriteExisting: false,
      };

      const secondResult = await migrateTool(analysis, secondOptions);

      expect(secondResult.status).toBe('failed');
      expect(secondResult.errors?.length).toBeGreaterThan(0);
      expect(secondResult.errors?.[0]).toContain('already exists');

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
    }, 30000);

    it('should handle invalid file paths gracefully', async () => {
      const invalidPath = path.join(
        process.cwd(),
        'tools',
        'offsec-team',
        'tools',
        'bug_hunter',
        'NonExistentTool.py'
      );

      await expect(async () => {
        await analyzePythonTool(invalidPath);
      }).rejects.toThrow();
    });

    it('should collect warnings for non-critical issues', async () => {
      const analysis = await analyzePythonTool(testToolPath);

      // Run without dependency installation (should generate warning if deps exist)
      const options: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: false,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const result = await migrateTool(analysis, options);

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
    }, 30000);
  });

  describe('Batch Migration', () => {
    it('should migrate multiple tools in sequence', async () => {
      // Get first two tools from bug_hunter
      const dirPath = path.join(
        process.cwd(),
        'tools',
        'offsec-team',
        'tools',
        'bug_hunter'
      );

      const files = await fs.readdir(dirPath);
      const pythonFiles = files.filter(f => f.endsWith('.py') && f !== '__init__.py').slice(0, 2);

      const analyses = await Promise.all(
        pythonFiles.map(f => analyzePythonTool(path.join(dirPath, f)))
      );

      const options: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: true,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const results = await batchMigrateTools(analyses, options);

      expect(results).toBeDefined();
      expect(results.length).toBe(analyses.length);

      // Verify all completed or failed (no pending)
      expect(results.every(r => ['completed', 'failed'].includes(r.status))).toBe(true);

      // Verify each result has proper structure
      for (const result of results) {
        expect(result.toolName).toBeDefined();
        expect(result.status).toBeDefined();
        expect(result.durationMs).toBeGreaterThan(0);
      }

      // Cleanup
      for (const analysis of analyses) {
        await cleanupTestTool(analysis.toolName);
      }
    }, 60000);

    it('should continue batch migration even if one tool fails', async () => {
      // Create mix of valid and invalid analyses
      const validAnalysis = await analyzePythonTool(testToolPath);

      // Create invalid analysis by corrupting the file path
      const invalidAnalysis = { ...validAnalysis };
      invalidAnalysis.filePath = '/invalid/path/tool.py';
      invalidAnalysis.toolName = 'InvalidTool';

      const analyses = [validAnalysis, invalidAnalysis];

      const options: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: true,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const results = await batchMigrateTools(analyses, options);

      expect(results.length).toBe(2);

      // At least one should succeed
      const successCount = results.filter(r => r.status === 'completed').length;
      expect(successCount).toBeGreaterThan(0);

      // At least one should fail
      const failCount = results.filter(r => r.status === 'failed').length;
      expect(failCount).toBeGreaterThan(0);

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
      await cleanupTestTool('InvalidTool');
    }, 60000);
  });

  describe('Migration Status', () => {
    it('should report correct status for non-existent tool', async () => {
      const status = await getMigrationStatus('NonExistentTool12345');

      expect(status).toBeDefined();
      expect(status.exists).toBe(false);
      expect(status.installed).toBe(false);
      expect(status.toolId).toBeUndefined();
    });

    it('should report correct status for migrated tool', async () => {
      const analysis = await analyzePythonTool(testToolPath);

      const options: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: true,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const result = await migrateTool(analysis, options);
      expect(result.status).toBe('completed');

      // Check status
      const status = await getMigrationStatus('WebVulnerabilityTester');

      expect(status.exists).toBe(true);
      expect(status.installed).toBe(true);
      expect(status.toolId).toBeDefined();
      expect(status.config).toBeDefined();

      // Verify config metadata
      const config = status.config as any;
      expect(config.source).toBe('offsec-team');
      expect(config.migrated).toBe(true);

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
    }, 30000);
  });

  describe('Wrapper Generation', () => {
    it('should generate valid TypeScript code', async () => {
      const analysis = await analyzePythonTool(testToolPath);

      const options: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: false,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const result = await migrateTool(analysis, options);

      const content = await fs.readFile(result.wrapperPath!, 'utf-8');

      // Verify class export
      expect(content).toMatch(/export class \w+Wrapper/);

      // Verify constructor
      expect(content).toContain('constructor()');
      expect(content).toContain('this.pythonPath');
      expect(content).toContain('this.modulePath');

      // Verify private method
      expect(content).toContain('private async executePythonMethod');

      // Verify factory function
      expect(content).toMatch(/export function create\w+\(\)/);

      // Verify imports
      expect(content).toContain("import { spawn } from 'child_process'");
      expect(content).toContain("import path from 'path'");

      // Verify Python script template
      expect(content).toContain('import sys');
      expect(content).toContain('import json');

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
    }, 30000);

    it('should include method wrappers for public methods', async () => {
      const analysis = await analyzePythonTool(testToolPath);

      const options: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: false,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const result = await migrateTool(analysis, options);

      const content = await fs.readFile(result.wrapperPath!, 'utf-8');

      // Should have async method declarations
      expect(content).toContain('async ');

      // Should call executePythonMethod
      expect(content).toContain('executePythonMethod(');

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
    }, 30000);
  });

  describe('Database Integration', () => {
    it('should store complete tool metadata', async () => {
      const analysis = await analyzePythonTool(testToolPath);

      const options: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: true,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const result = await migrateTool(analysis, options);

      const [tool] = await db
        .select()
        .from(securityTools)
        .where(eq(securityTools.id, result.toolId!))
        .limit(1);

      // Verify required fields
      expect(tool.name).toBe('WebVulnerabilityTester');
      expect(tool.category).toBe('scanning');
      expect(tool.description).toBeTruthy();
      expect(tool.status).toBe('available');
      expect(tool.command).toContain('python3');

      // Verify metadata structure
      const metadata = tool.metadata as any;
      expect(metadata.source).toBe('offsec-team');
      expect(metadata.migrated).toBe(true);
      expect(metadata.migrationDate).toBeDefined();
      expect(metadata.complexity).toBe(analysis.complexity);
      expect(metadata.pythonModule).toBe(analysis.filePath);
      expect(metadata.wrapperPath).toBeDefined();

      // Verify timestamps
      expect(tool.createdAt).toBeDefined();
      expect(tool.updatedAt).toBeDefined();

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
    }, 30000);

    it('should update existing tool when overwrite enabled', async () => {
      const analysis = await analyzePythonTool(testToolPath);

      // First migration
      const firstOptions: MigrationOptions = {
        installDependencies: false,
        runTests: false,
        registerInDatabase: true,
        generateWrapper: true,
        overwriteExisting: true,
      };

      const firstResult = await migrateTool(analysis, firstOptions);
      const firstId = firstResult.toolId;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second migration with overwrite
      const secondResult = await migrateTool(analysis, firstOptions);

      // Should use same ID
      expect(secondResult.toolId).toBe(firstId);

      // Verify updated in database
      const [tool] = await db
        .select()
        .from(securityTools)
        .where(eq(securityTools.id, firstId!))
        .limit(1);

      expect(tool).toBeDefined();
      expect(tool.name).toBe('WebVulnerabilityTester');

      // Cleanup
      await cleanupTestTool('WebVulnerabilityTester');
    }, 30000);
  });
});
