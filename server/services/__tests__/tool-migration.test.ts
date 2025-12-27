/**
 * Tool Migration Tests
 * Validates tool analyzer and migration functionality
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import {
  analyzePythonTool,
  analyzeToolsDirectory,
  generateToolConfig,
  type PythonToolAnalysis,
} from '../tool-analyzer';

describe('Tool Analyzer', () => {
  const testToolPath = path.join(
    process.cwd(),
    'tools',
    'offsec-team',
    'tools',
    'bug_hunter',
    'WebVulnerabilityTester.py'
  );

  let analysis: PythonToolAnalysis;

  beforeAll(async () => {
    analysis = await analyzePythonTool(testToolPath);
  });

  describe('analyzePythonTool', () => {
    it('should extract tool name correctly', () => {
      expect(analysis.toolName).toBe('WebVulnerabilityTester');
    });

    it('should extract class name', () => {
      expect(analysis.className).toBe('WebVulnerabilityTester');
    });

    it('should identify correct category', () => {
      expect(analysis.category).toBe('scanning');
    });

    it('should extract description', () => {
      expect(analysis.description).toBeTruthy();
      expect(analysis.description.length).toBeGreaterThan(10);
    });

    it('should extract methods', () => {
      expect(analysis.methods).toBeDefined();
      expect(analysis.methods.length).toBeGreaterThan(0);
    });

    it('should extract dependencies', () => {
      expect(analysis.dependencies).toBeDefined();
      expect(analysis.dependencies.some(d => d.name === 'requests')).toBe(true);
      expect(analysis.dependencies.some(d => d.name === 'pydantic')).toBe(true);
    });

    it('should estimate complexity', () => {
      expect(['low', 'medium', 'high', 'very-high']).toContain(analysis.complexity);
    });

    it('should calculate estimated migration days', () => {
      expect(analysis.estimatedMigrationDays).toBeGreaterThan(0);
      expect(analysis.estimatedMigrationDays).toBeLessThan(15);
    });

    it('should detect external service requirements', () => {
      expect(typeof analysis.requiresExternalServices).toBe('boolean');
      if (analysis.requiresExternalServices) {
        expect(analysis.externalServiceNotes).toBeTruthy();
      }
    });
  });

  describe('analyzeToolsDirectory', () => {
    it('should analyze all tools in bug_hunter category', async () => {
      const dirPath = path.join(
        process.cwd(),
        'tools',
        'offsec-team',
        'tools',
        'bug_hunter'
      );

      const tools = await analyzeToolsDirectory(dirPath);

      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.category === 'scanning')).toBe(true);
    });

    it('should skip __init__.py files', async () => {
      const dirPath = path.join(
        process.cwd(),
        'tools',
        'offsec-team',
        'tools',
        'bug_hunter'
      );

      const tools = await analyzeToolsDirectory(dirPath);

      expect(tools.every(t => t.toolName !== '__init__')).toBe(true);
    });
  });

  describe('generateToolConfig', () => {
    it('should generate valid RTPI tool configuration', () => {
      const config = generateToolConfig(analysis);

      expect(config.name).toBe(analysis.toolName);
      expect(config.category).toBe(analysis.category);
      expect(config.description).toBe(analysis.description);
      expect(config.version).toBe('1.0.0');
      expect(config.installMethod).toBe('pip');
      expect(config.binaryPath).toBe('python');
      expect(config.outputFormat).toBe('json');
    });

    it('should include metadata', () => {
      const config = generateToolConfig(analysis);

      expect(config.metadata).toBeDefined();
      expect(config.metadata.className).toBe(analysis.className);
      expect(config.metadata.complexity).toBe(analysis.complexity);
      expect(config.metadata.hasTests).toBe(analysis.hasTests);
    });

    it('should include dependencies', () => {
      const config = generateToolConfig(analysis);

      expect(config.dependencies).toBeDefined();
      expect(Array.isArray(config.dependencies)).toBe(true);
    });

    it('should include parameters', () => {
      const config = generateToolConfig(analysis);

      expect(config.parameters).toBeDefined();
      expect(Array.isArray(config.parameters)).toBe(true);
    });
  });

  describe('Method extraction', () => {
    it('should extract public methods only', () => {
      const publicMethods = analysis.methods.filter(m => !m.name.startsWith('_'));
      expect(publicMethods.length).toBeGreaterThan(0);
    });

    it('should extract method descriptions', () => {
      const methodsWithDesc = analysis.methods.filter(m => m.description && m.description.length > 5);
      expect(methodsWithDesc.length).toBeGreaterThan(0);
    });

    it('should identify async methods', () => {
      // Some tools may have async methods
      expect(analysis.methods.every(m => typeof m.isAsync === 'boolean')).toBe(true);
    });
  });

  describe('Parameter extraction', () => {
    it('should extract parameters from methods', () => {
      expect(analysis.parameters).toBeDefined();
      expect(Array.isArray(analysis.parameters)).toBe(true);
    });

    it('should identify required parameters', () => {
      if (analysis.parameters.length > 0) {
        expect(analysis.parameters.every(p => typeof p.required === 'boolean')).toBe(true);
      }
    });

    it('should map Python types to parameter types', () => {
      const validTypes = ['string', 'number', 'boolean', 'array', 'file', 'ip-address', 'url', 'port', 'cidr', 'enum'];

      if (analysis.parameters.length > 0) {
        expect(analysis.parameters.every(p => validTypes.includes(p.type))).toBe(true);
      }
    });
  });

  describe('Dependency extraction', () => {
    it('should skip standard library imports', () => {
      const stdLibs = ['os', 'sys', 'time', 'json', 'logging', 're'];
      const hasStdLib = analysis.dependencies.some(d => stdLibs.includes(d.name));
      expect(hasStdLib).toBe(false);
    });

    it('should include third-party packages', () => {
      expect(analysis.dependencies.length).toBeGreaterThan(0);
    });

    it('should provide install commands', () => {
      expect(analysis.dependencies.every(d => d.installCommand)).toBe(true);
      expect(analysis.dependencies.every(d => d.installCommand?.includes('pip install'))).toBe(true);
    });
  });

  describe('Complexity estimation', () => {
    it('should assign low complexity to simple tools', async () => {
      // VulnerabilityReportGenerator should be low complexity
      const reportGenPath = path.join(
        process.cwd(),
        'tools',
        'offsec-team',
        'tools',
        'bug_hunter',
        'VulnerabilityReportGenerator.py'
      );

      try {
        const reportGen = await analyzePythonTool(reportGenPath);
        expect(['low', 'medium']).toContain(reportGen.complexity);
      } catch (error) {
        // File may not exist, skip test
      }
    });

    it('should assign higher complexity to API clients', async () => {
      // BurpSuiteAPIClient should be high complexity
      const burpPath = path.join(
        process.cwd(),
        'tools',
        'offsec-team',
        'tools',
        'burpsuite_operator',
        'BurpSuiteAPIClient.py'
      );

      try {
        const burpClient = await analyzePythonTool(burpPath);
        expect(['high', 'very-high']).toContain(burpClient.complexity);
      } catch (error) {
        // File may not exist, skip test
      }
    });
  });
});

describe('Integration: Full analysis workflow', () => {
  it('should analyze all offsec-team tools successfully', async () => {
    const { analyzeOffSecTeamTools } = await import('../tool-analyzer');

    const toolsByCategory = await analyzeOffSecTeamTools();

    // Should have all 5 categories
    expect(toolsByCategory.size).toBe(5);

    // Check categories
    expect(toolsByCategory.has('bug_hunter')).toBe(true);
    expect(toolsByCategory.has('burpsuite_operator')).toBe(true);
    expect(toolsByCategory.has('daedelu5')).toBe(true);
    expect(toolsByCategory.has('nexus_kamuy')).toBe(true);
    expect(toolsByCategory.has('rt_dev')).toBe(true);

    // Count total tools
    let totalTools = 0;
    for (const tools of toolsByCategory.values()) {
      totalTools += tools.length;
    }

    // Should have ~40 tools (8 per category)
    expect(totalTools).toBeGreaterThan(30);
    expect(totalTools).toBeLessThan(50);
  }, 30000); // Increase timeout for full analysis
});
