import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateToolConfiguration } from '../../../server/services/tool-tester';
import type { ToolConfiguration } from '@shared/types/tool-config';

describe('Tool Tester Service', () => {
  describe('validateToolConfiguration', () => {
    it('should validate a complete tool configuration', async () => {
      const validConfig: ToolConfiguration = {
        toolId: 'test-tool',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
        description: 'A test tool',
        version: '1.0.0',
        tags: ['test'],
        parameters: [],
      };

      const result = await validateToolConfiguration(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject configuration with missing toolId', async () => {
      const invalidConfig: any = {
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
      };

      const result = await validateToolConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Tool ID is required and must be at least 2 characters'
      );
    });

    it('should reject configuration with short toolId', async () => {
      const invalidConfig: any = {
        toolId: 'a',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
      };

      const result = await validateToolConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Tool ID is required and must be at least 2 characters'
      );
    });

    it('should reject configuration with missing name', async () => {
      const invalidConfig: any = {
        toolId: 'test-tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
      };

      const result = await validateToolConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Tool name is required and must be at least 2 characters'
      );
    });

    it('should reject configuration with missing binaryPath', async () => {
      const invalidConfig: any = {
        toolId: 'test-tool',
        name: 'Test Tool',
        category: 'reconnaissance',
      };

      const result = await validateToolConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Binary path is required');
    });

    it('should reject configuration with missing category', async () => {
      const invalidConfig: any = {
        toolId: 'test-tool',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
      };

      const result = await validateToolConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Category is required');
    });

    it('should reject configuration with duplicate parameter names', async () => {
      const invalidConfig: ToolConfiguration = {
        toolId: 'test-tool',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
        parameters: [
          {
            name: 'target',
            type: 'string',
            required: true,
            description: 'Target',
          },
          {
            name: 'target',
            type: 'string',
            required: false,
            description: 'Duplicate',
          },
        ],
      };

      const result = await validateToolConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate parameter name: target');
    });

    it('should reject enum parameter without enum values', async () => {
      const invalidConfig: ToolConfiguration = {
        toolId: 'test-tool',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
        parameters: [
          {
            name: 'mode',
            type: 'enum',
            required: true,
            description: 'Mode',
            enumValues: [],
          },
        ],
      };

      const result = await validateToolConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Parameter mode is type 'enum' but has no enum values"
      );
    });

    it('should reject custom parser without parser code', async () => {
      const invalidConfig: ToolConfiguration = {
        toolId: 'test-tool',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
        outputParser: {
          parserType: 'custom',
          outputFormat: 'custom',
        },
      };

      const result = await validateToolConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Custom parser requires parser code');
    });

    it('should reject regex parser without regex patterns', async () => {
      const invalidConfig: ToolConfiguration = {
        toolId: 'test-tool',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
        outputParser: {
          parserType: 'regex',
          outputFormat: 'text',
        },
      };

      const result = await validateToolConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Regex parser requires regex patterns');
    });

    it('should reject test without test command', async () => {
      const invalidConfig: ToolConfiguration = {
        toolId: 'test-tool',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
        tests: [
          {
            testType: 'execution',
            testCommand: '',
            expectedExitCode: 0,
          },
        ],
      };

      const result = await validateToolConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Test 1 is missing test command');
    });

    it('should accept valid configuration with parameters', async () => {
      const validConfig: ToolConfiguration = {
        toolId: 'test-tool',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
        parameters: [
          {
            name: 'target',
            type: 'string',
            required: true,
            description: 'Target host',
          },
          {
            name: 'port',
            type: 'integer',
            required: false,
            description: 'Target port',
            defaultValue: '80',
          },
          {
            name: 'mode',
            type: 'enum',
            required: false,
            description: 'Scan mode',
            enumValues: ['fast', 'slow', 'stealth'],
          },
        ],
      };

      const result = await validateToolConfiguration(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid configuration with JSON parser', async () => {
      const validConfig: ToolConfiguration = {
        toolId: 'test-tool',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
        outputParser: {
          parserType: 'json',
          outputFormat: 'json',
          jsonPaths: {
            findings: '$.results[*]',
            severity: '$.results[*].severity',
          },
        },
      };

      const result = await validateToolConfiguration(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid configuration with regex parser', async () => {
      const validConfig: ToolConfiguration = {
        toolId: 'test-tool',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
        outputParser: {
          parserType: 'regex',
          outputFormat: 'text',
          regexPatterns: {
            ip: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
            port: 'Port: (\\d+)',
          },
        },
      };

      const result = await validateToolConfiguration(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid configuration with tests', async () => {
      const validConfig: ToolConfiguration = {
        toolId: 'test-tool',
        name: 'Test Tool',
        binaryPath: '/usr/bin/test',
        category: 'reconnaissance',
        tests: [
          {
            testType: 'execution',
            testCommand: '--version',
            expectedExitCode: 0,
          },
          {
            testType: 'execution',
            testCommand: '--help',
            expectedExitCode: 0,
            expectedOutput: 'Usage:',
          },
        ],
      };

      const result = await validateToolConfiguration(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all validation errors', async () => {
      const invalidConfig: any = {
        // Missing toolId, name, binaryPath, category
        parameters: [
          {
            name: 'mode',
            type: 'enum',
            required: true,
            description: 'Mode',
            enumValues: [],
          },
        ],
        outputParser: {
          parserType: 'custom',
          outputFormat: 'custom',
        },
        tests: [
          {
            testType: 'execution',
            testCommand: '',
          },
        ],
      };

      const result = await validateToolConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
      expect(result.errors).toContain(
        'Tool ID is required and must be at least 2 characters'
      );
      expect(result.errors).toContain(
        'Tool name is required and must be at least 2 characters'
      );
      expect(result.errors).toContain('Binary path is required');
      expect(result.errors).toContain('Category is required');
    });
  });
});
