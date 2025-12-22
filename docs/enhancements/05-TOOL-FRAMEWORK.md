# Tool Framework Enhancements - Tier 1/2 Priority

**Parent Document:** [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md)  
**Priority:** 🔴 Tier 1 (Core) / 🟡 Tier 2 (Advanced)  
**Timeline:** Week 1-2 (Core), Week 3-4 (Advanced)  
**Total Items:** 25  
**Last Updated:** December 4, 2025

---

## Overview

This document details the comprehensive tool framework enhancements, including tool configuration schema, GitHub auto-installer, testing framework, and agent-tool validation.

### Purpose
- **Standardize tool configuration** across all security tools
- **Enable easy tool addition** via GitHub repository URL
- **Provide testing framework** for tool validation
- **Support agent-tool integration** with validation
- **Automate tool discovery** and installation

### Success Criteria
- ✅ Tool configuration schema implemented
- ✅ GitHub auto-installer functional
- ✅ Testing framework operational
- ✅ Agent-tool validation working
- ✅ rtpi-tools container automatically updated

---

## Table of Contents

1. [Tool Configuration Schema](#tool-configuration-schema)
2. [GitHub Tool Auto-Installer](#github-tool-auto-installer)
3. [Tool Testing Framework](#tool-testing-framework)
4. [Agent-Tool Assignment & Validation](#agent-tool-assignment--validation)
5. [Tool Registry & Management](#tool-registry--management)
6. [Output Parsing System](#output-parsing-system)
7. [rtpi-tools Container Integration](#rtpi-tools-container-integration)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [Testing Requirements](#testing-requirements)

---

## Tool Configuration Schema

### Status: 🔴 Tier 1 - High Priority

### Description
Standardized configuration schema for all security tools to ensure consistent behavior and integration.

### Schema Definition
```typescript
interface ToolConfiguration {
  // Basic Info
  toolId: string;
  name: string;
  category: string; // 'reconnaissance', 'exploitation', 'web_security', etc.
  description: string;
  version: string;
  
  // Execution
  command: string;
  entrypoint?: string;
  workingDirectory?: string;
  
  // Parameters
  parameters: ToolParameter[];
  
  // Target Compatibility
  supportedTargetTypes: ('ip' | 'domain' | 'url' | 'network' | 'range')[];
  
  // Output
  outputFormat: 'text' | 'json' | 'xml' | 'csv';
  outputParser: string; // Function name or parsing script
  
  // Execution Settings
  requiresSudo: boolean;
  timeout: number; // seconds
  maxRetries: number;
  environment: Record<string, string>;
  
  // Container/Docker
  dockerImage?: string;
  dockerfile?: string;
  buildArgs?: Record<string, string>;
  
  // GitHub Integration
  githubUrl?: string;
  installMethod?: 'docker' | 'binary' | 'script' | 'pip' | 'npm';
  
  // Documentation
  documentation: string;
  exampleCommands: string[];
  usageNotes: string;
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  required: boolean;
  default?: any;
  options?: string[]; // For select/multiselect
  validation?: string; // Regex pattern
  description: string;
  example?: string;
}
```

### Implementation Checklist
- [ ] Define TypeScript interfaces
- [ ] Create schema validation
- [ ] Update existing tools to use schema
- [ ] Add schema editor UI
- [ ] Create configuration templates
- [ ] Add import/export functionality

### Implementation Details

#### File: `shared/types/tool-config.ts`

```typescript
import Joi from 'joi';

export type ToolCategory =
  | 'reconnaissance'
  | 'exploitation'
  | 'web_security'
  | 'vulnerability_scanning'
  | 'network_scanning'
  | 'enumeration'
  | 'post_exploitation'
  | 'reporting'
  | 'auxiliary';

export type OutputFormat = 'text' | 'json' | 'xml' | 'csv' | 'html';
export type InstallMethod = 'docker' | 'binary' | 'script' | 'pip' | 'npm' | 'cargo' | 'apt';
export type ParameterType = 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'file' | 'array';

/**
 * Complete tool configuration interface
 */
export interface ToolConfiguration {
  // Basic Info
  toolId: string;
  name: string;
  category: ToolCategory;
  description: string;
  version: string;
  author?: string;
  license?: string;
  homepage?: string;

  // Execution
  command: string;                    // Template command with {placeholders}
  entrypoint?: string;                // Binary/script name
  workingDirectory?: string;          // Default: /workspace

  // Parameters
  parameters: ToolParameter[];

  // Target Compatibility
  supportedTargetTypes: ('ip' | 'domain' | 'url' | 'network' | 'range' | 'cidr' | 'hostname')[];
  targetParameterName: string;        // Which parameter receives target (e.g., 'target', 'url', 'host')

  // Output
  outputFormat: OutputFormat;
  outputParser: string;               // Function name or parser ID
  outputFile?: string;                // Template for output file path
  streamOutput?: boolean;             // Support real-time output streaming

  // Execution Settings
  requiresSudo: boolean;
  timeout: number;                    // seconds, default: 300
  maxRetries: number;                 // default: 0
  retryDelay?: number;                // seconds between retries
  environment: Record<string, string>; // Environment variables

  // Container/Docker
  dockerImage?: string;               // Pre-built image name
  dockerfile?: string;                // Custom Dockerfile content
  buildArgs?: Record<string, string>; // Docker build arguments
  containerVolumes?: string[];        // Volume mounts
  networkMode?: 'bridge' | 'host' | 'none';

  // GitHub Integration
  githubUrl?: string;
  installMethod?: InstallMethod;
  repositoryPath?: string;            // Path within repo to tool
  buildCommand?: string;              // Custom build command

  // Rate Limiting & Resource Control
  rateLimitPerMinute?: number;        // Max executions per minute
  maxConcurrent?: number;             // Max parallel executions
  memoryLimit?: string;               // e.g., "512m", "2g"
  cpuLimit?: number;                  // CPU cores (0.5, 1, 2, etc.)

  // Documentation
  documentation: string;              // Markdown documentation
  exampleCommands: string[];          // Example usage
  usageNotes: string;                 // Important notes
  prerequisites?: string[];           // Required setup steps

  // Metadata
  tags?: string[];                    // Searchable tags
  isActive: boolean;                  // Enable/disable tool
  createdBy?: string;                 // User ID
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string;                       // Parameter name (used in command template)
  displayName?: string;               // Human-readable name
  type: ParameterType;
  required: boolean;
  default?: any;
  options?: string[];                 // For select/multiselect
  validation?: {
    pattern?: string;                 // Regex pattern
    min?: number;                     // Min value/length
    max?: number;                     // Max value/length
    custom?: string;                  // Custom validator function name
  };
  description: string;
  example?: string;
  placeholder?: string;               // UI placeholder text
  helpText?: string;                  // Additional help
  group?: string;                     // Parameter grouping for UI
  dependsOn?: {                       // Conditional parameter
    parameter: string;
    value: any;
  };
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * Tool configuration validator using Joi
 */
export class ToolConfigValidator {

  private static parameterSchema = Joi.object({
    name: Joi.string().required().pattern(/^[a-zA-Z0-9_]+$/),
    displayName: Joi.string().optional(),
    type: Joi.string().valid('string', 'number', 'boolean', 'select', 'multiselect', 'file', 'array').required(),
    required: Joi.boolean().required(),
    default: Joi.any().optional(),
    options: Joi.array().items(Joi.string()).optional(),
    validation: Joi.object({
      pattern: Joi.string().optional(),
      min: Joi.number().optional(),
      max: Joi.number().optional(),
      custom: Joi.string().optional()
    }).optional(),
    description: Joi.string().required(),
    example: Joi.string().optional(),
    placeholder: Joi.string().optional(),
    helpText: Joi.string().optional(),
    group: Joi.string().optional(),
    dependsOn: Joi.object({
      parameter: Joi.string().required(),
      value: Joi.any().required()
    }).optional()
  });

  private static configSchema = Joi.object({
    toolId: Joi.string().uuid().optional(),
    name: Joi.string().min(2).max(100).required(),
    category: Joi.string().valid('reconnaissance', 'exploitation', 'web_security',
      'vulnerability_scanning', 'network_scanning', 'enumeration',
      'post_exploitation', 'reporting', 'auxiliary').required(),
    description: Joi.string().min(10).max(1000).required(),
    version: Joi.string().required(),
    author: Joi.string().optional(),
    license: Joi.string().optional(),
    homepage: Joi.string().uri().optional(),

    command: Joi.string().required(),
    entrypoint: Joi.string().optional(),
    workingDirectory: Joi.string().optional(),

    parameters: Joi.array().items(ToolConfigValidator.parameterSchema).required(),

    supportedTargetTypes: Joi.array().items(
      Joi.string().valid('ip', 'domain', 'url', 'network', 'range', 'cidr', 'hostname')
    ).min(1).required(),
    targetParameterName: Joi.string().required(),

    outputFormat: Joi.string().valid('text', 'json', 'xml', 'csv', 'html').required(),
    outputParser: Joi.string().required(),
    outputFile: Joi.string().optional(),
    streamOutput: Joi.boolean().optional(),

    requiresSudo: Joi.boolean().required(),
    timeout: Joi.number().min(10).max(3600).required(),
    maxRetries: Joi.number().min(0).max(5).required(),
    retryDelay: Joi.number().min(1).optional(),
    environment: Joi.object().pattern(Joi.string(), Joi.string()).optional(),

    dockerImage: Joi.string().optional(),
    dockerfile: Joi.string().optional(),
    buildArgs: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
    containerVolumes: Joi.array().items(Joi.string()).optional(),
    networkMode: Joi.string().valid('bridge', 'host', 'none').optional(),

    githubUrl: Joi.string().uri().pattern(/github\.com/).optional(),
    installMethod: Joi.string().valid('docker', 'binary', 'script', 'pip', 'npm', 'cargo', 'apt').optional(),
    repositoryPath: Joi.string().optional(),
    buildCommand: Joi.string().optional(),

    rateLimitPerMinute: Joi.number().min(1).optional(),
    maxConcurrent: Joi.number().min(1).max(10).optional(),
    memoryLimit: Joi.string().pattern(/^\d+[kmg]$/i).optional(),
    cpuLimit: Joi.number().min(0.1).max(8).optional(),

    documentation: Joi.string().required(),
    exampleCommands: Joi.array().items(Joi.string()).min(1).required(),
    usageNotes: Joi.string().required(),
    prerequisites: Joi.array().items(Joi.string()).optional(),

    tags: Joi.array().items(Joi.string()).optional(),
    isActive: Joi.boolean().required(),
    createdBy: Joi.string().uuid().optional(),
    createdAt: Joi.date().iso().optional(),
    updatedAt: Joi.date().iso().optional()
  });

  /**
   * Validate complete tool configuration
   */
  async validate(config: Partial<ToolConfiguration>): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Joi validation
    const { error, value } = ToolConfigValidator.configSchema.validate(config, {
      abortEarly: false,
      allowUnknown: false
    });

    if (error) {
      error.details.forEach(detail => {
        errors.push({
          field: detail.path.join('.'),
          message: detail.message,
          code: detail.type
        });
      });
    }

    // Custom validation logic
    if (config.command) {
      const commandValidation = await this.validateCommandTemplate(
        config.command,
        config.parameters || []
      );
      if (!commandValidation.valid) {
        errors.push(...commandValidation.errors);
      }
    }

    // Parameter validation
    if (config.parameters) {
      config.parameters.forEach((param, index) => {
        const paramValidation = this.validateParameter(param);
        if (!paramValidation) {
          errors.push({
            field: `parameters[${index}]`,
            message: `Invalid parameter configuration: ${param.name}`,
            code: 'invalid_parameter'
          });
        }
      });
    }

    // Docker validation
    if (config.dockerImage && config.dockerfile) {
      warnings.push({
        field: 'docker',
        message: 'Both dockerImage and dockerfile specified. dockerImage will take precedence.',
        suggestion: 'Remove dockerfile if using pre-built image'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate individual parameter
   */
  validateParameter(param: ToolParameter): boolean {
    const { error } = ToolConfigValidator.parameterSchema.validate(param);

    // Additional checks
    if (param.type === 'select' || param.type === 'multiselect') {
      if (!param.options || param.options.length === 0) {
        return false;
      }
    }

    if (param.default !== undefined) {
      // Validate default matches type
      if (param.type === 'number' && typeof param.default !== 'number') {
        return false;
      }
      if (param.type === 'boolean' && typeof param.default !== 'boolean') {
        return false;
      }
    }

    return !error;
  }

  /**
   * Validate command template against parameters
   */
  async validateCommandTemplate(
    template: string,
    parameters: ToolParameter[]
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Extract all placeholders from command template
    const placeholderRegex = /\{([a-zA-Z0-9_]+)\}/g;
    const matches = [...template.matchAll(placeholderRegex)];
    const placeholders = new Set(matches.map(m => m[1]));

    const paramNames = new Set(parameters.map(p => p.name));

    // Check all placeholders have corresponding parameters
    placeholders.forEach(placeholder => {
      if (!paramNames.has(placeholder)) {
        errors.push({
          field: 'command',
          message: `Placeholder {${placeholder}} has no corresponding parameter`,
          code: 'missing_parameter'
        });
      }
    });

    // Warn about unused parameters
    paramNames.forEach(paramName => {
      if (!placeholders.has(paramName) && !template.includes(`{${paramName}}`)) {
        warnings.push({
          field: `parameters.${paramName}`,
          message: `Parameter '${paramName}' is not used in command template`,
          suggestion: 'Remove unused parameter or add to command'
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Sanitize and prepare configuration for storage
   */
  sanitize(config: Partial<ToolConfiguration>): ToolConfiguration {
    const sanitized = {
      ...config,
      isActive: config.isActive ?? true,
      timeout: config.timeout ?? 300,
      maxRetries: config.maxRetries ?? 0,
      requiresSudo: config.requiresSudo ?? false,
      environment: config.environment ?? {},
      parameters: config.parameters ?? [],
      tags: config.tags ?? [],
      workingDirectory: config.workingDirectory ?? '/workspace',
      networkMode: config.networkMode ?? 'bridge'
    } as ToolConfiguration;

    return sanitized;
  }
}

/**
 * Pre-built configuration templates for common tool types
 */
export class ToolConfigTemplates {

  /**
   * Get template by tool type
   */
  static getTemplate(type: 'python' | 'nodejs' | 'go' | 'rust' | 'network_scanner' | 'web_scanner'): Partial<ToolConfiguration> {
    switch (type) {
      case 'python':
        return this.pythonTemplate();
      case 'nodejs':
        return this.nodejsTemplate();
      case 'go':
        return this.goTemplate();
      case 'rust':
        return this.rustTemplate();
      case 'network_scanner':
        return this.networkScannerTemplate();
      case 'web_scanner':
        return this.webScannerTemplate();
      default:
        return this.defaultTemplate();
    }
  }

  private static pythonTemplate(): Partial<ToolConfiguration> {
    return {
      installMethod: 'pip',
      entrypoint: 'python',
      command: 'python {script} {target} {options}',
      outputFormat: 'text',
      requiresSudo: false,
      timeout: 300,
      maxRetries: 0,
      dockerImage: 'python:3.11-slim',
      environment: {
        PYTHONUNBUFFERED: '1'
      },
      parameters: [
        {
          name: 'script',
          type: 'string',
          required: true,
          description: 'Python script to execute',
          example: 'scanner.py'
        },
        {
          name: 'target',
          type: 'string',
          required: true,
          description: 'Target to scan',
          example: 'example.com'
        },
        {
          name: 'options',
          type: 'string',
          required: false,
          description: 'Additional options',
          example: '--verbose'
        }
      ],
      supportedTargetTypes: ['ip', 'domain', 'url'],
      targetParameterName: 'target',
      category: 'reconnaissance',
      isActive: true,
      documentation: '# Python Tool\n\nAdd tool documentation here.',
      exampleCommands: ['python scanner.py example.com --verbose'],
      usageNotes: 'Requires Python 3.8+'
    };
  }

  private static nodejsTemplate(): Partial<ToolConfiguration> {
    return {
      installMethod: 'npm',
      entrypoint: 'node',
      command: 'node {script} {target} {options}',
      outputFormat: 'json',
      requiresSudo: false,
      timeout: 300,
      maxRetries: 0,
      dockerImage: 'node:18-alpine',
      environment: {
        NODE_ENV: 'production'
      },
      parameters: [
        {
          name: 'script',
          type: 'string',
          required: true,
          description: 'Node.js script to execute',
          example: 'index.js'
        },
        {
          name: 'target',
          type: 'string',
          required: true,
          description: 'Target to scan',
          example: 'https://example.com'
        },
        {
          name: 'options',
          type: 'string',
          required: false,
          description: 'Additional options',
          example: '--json'
        }
      ],
      supportedTargetTypes: ['url', 'domain'],
      targetParameterName: 'target',
      category: 'web_security',
      isActive: true,
      documentation: '# Node.js Tool\n\nAdd tool documentation here.',
      exampleCommands: ['node scanner.js https://example.com --json'],
      usageNotes: 'Requires Node.js 16+'
    };
  }

  private static goTemplate(): Partial<ToolConfiguration> {
    return {
      installMethod: 'binary',
      command: './{binary} {flags} {target}',
      outputFormat: 'json',
      requiresSudo: false,
      timeout: 600,
      maxRetries: 1,
      dockerImage: 'golang:1.21-alpine',
      buildCommand: 'go build -o {binary} .',
      parameters: [
        {
          name: 'binary',
          type: 'string',
          required: true,
          description: 'Binary name',
          example: 'scanner'
        },
        {
          name: 'flags',
          type: 'string',
          required: false,
          description: 'Command flags',
          example: '-v -json'
        },
        {
          name: 'target',
          type: 'string',
          required: true,
          description: 'Target to scan',
          example: 'example.com'
        }
      ],
      supportedTargetTypes: ['ip', 'domain', 'cidr', 'range'],
      targetParameterName: 'target',
      category: 'network_scanning',
      isActive: true,
      documentation: '# Go Tool\n\nAdd tool documentation here.',
      exampleCommands: ['./scanner -v -json example.com'],
      usageNotes: 'Pre-compiled binary included'
    };
  }

  private static rustTemplate(): Partial<ToolConfiguration> {
    return {
      installMethod: 'cargo',
      command: '{binary} {subcommand} {target} {options}',
      outputFormat: 'json',
      requiresSudo: false,
      timeout: 600,
      maxRetries: 1,
      dockerImage: 'rust:1.75-slim',
      buildCommand: 'cargo build --release',
      parameters: [
        {
          name: 'binary',
          type: 'string',
          required: true,
          description: 'Binary name',
          example: 'scanner'
        },
        {
          name: 'subcommand',
          type: 'select',
          required: true,
          options: ['scan', 'enum', 'exploit'],
          description: 'Subcommand to execute',
          example: 'scan'
        },
        {
          name: 'target',
          type: 'string',
          required: true,
          description: 'Target to scan',
          example: '192.168.1.0/24'
        },
        {
          name: 'options',
          type: 'string',
          required: false,
          description: 'Additional options',
          example: '--json --verbose'
        }
      ],
      supportedTargetTypes: ['ip', 'cidr', 'range'],
      targetParameterName: 'target',
      category: 'network_scanning',
      isActive: true,
      documentation: '# Rust Tool\n\nAdd tool documentation here.',
      exampleCommands: ['scanner scan 192.168.1.0/24 --json'],
      usageNotes: 'Built with Rust 1.75+'
    };
  }

  private static networkScannerTemplate(): Partial<ToolConfiguration> {
    return {
      command: '{tool} {scan_type} {timing} -p {ports} {target} {output}',
      outputFormat: 'xml',
      requiresSudo: true,
      timeout: 900,
      maxRetries: 1,
      networkMode: 'host',
      parameters: [
        {
          name: 'tool',
          type: 'string',
          required: true,
          default: 'nmap',
          description: 'Scanner binary',
          example: 'nmap'
        },
        {
          name: 'scan_type',
          type: 'select',
          required: true,
          options: ['-sS', '-sT', '-sU', '-sV', '-sC', '-A'],
          default: '-sS',
          description: 'Scan type',
          example: '-sS'
        },
        {
          name: 'timing',
          type: 'select',
          required: false,
          options: ['-T0', '-T1', '-T2', '-T3', '-T4', '-T5'],
          default: '-T3',
          description: 'Timing template',
          example: '-T3'
        },
        {
          name: 'ports',
          type: 'string',
          required: false,
          default: '1-65535',
          description: 'Ports to scan',
          example: '80,443,8080'
        },
        {
          name: 'target',
          type: 'string',
          required: true,
          description: 'Target IP/CIDR',
          example: '192.168.1.0/24'
        },
        {
          name: 'output',
          type: 'string',
          required: false,
          default: '-oX -',
          description: 'Output format',
          example: '-oX scan.xml'
        }
      ],
      supportedTargetTypes: ['ip', 'cidr', 'range', 'hostname'],
      targetParameterName: 'target',
      category: 'network_scanning',
      isActive: true,
      documentation: '# Network Scanner\n\nComprehensive network port scanner.',
      exampleCommands: ['nmap -sS -T3 -p 1-65535 192.168.1.0/24 -oX -'],
      usageNotes: 'Requires sudo for SYN scans'
    };
  }

  private static webScannerTemplate(): Partial<ToolConfiguration> {
    return {
      command: '{tool} -u {target} {options} --json-output {output}',
      outputFormat: 'json',
      requiresSudo: false,
      timeout: 1800,
      maxRetries: 2,
      parameters: [
        {
          name: 'tool',
          type: 'string',
          required: true,
          description: 'Web scanner binary',
          example: 'nuclei'
        },
        {
          name: 'target',
          type: 'string',
          required: true,
          description: 'Target URL',
          example: 'https://example.com'
        },
        {
          name: 'options',
          type: 'string',
          required: false,
          description: 'Scanner options',
          example: '-severity critical,high,medium'
        },
        {
          name: 'output',
          type: 'string',
          required: false,
          default: '/workspace/results.json',
          description: 'Output file path',
          example: '/workspace/results.json'
        }
      ],
      supportedTargetTypes: ['url', 'domain'],
      targetParameterName: 'target',
      category: 'web_security',
      streamOutput: true,
      rateLimitPerMinute: 30,
      maxConcurrent: 3,
      isActive: true,
      documentation: '# Web Scanner\n\nWeb application vulnerability scanner.',
      exampleCommands: ['nuclei -u https://example.com --json-output results.json'],
      usageNotes: 'Supports rate limiting to avoid detection'
    };
  }

  private static defaultTemplate(): Partial<ToolConfiguration> {
    return {
      command: '{tool} {target} {options}',
      outputFormat: 'text',
      requiresSudo: false,
      timeout: 300,
      maxRetries: 0,
      parameters: [
        {
          name: 'tool',
          type: 'string',
          required: true,
          description: 'Tool binary or script',
          example: 'scanner'
        },
        {
          name: 'target',
          type: 'string',
          required: true,
          description: 'Target to scan',
          example: 'example.com'
        },
        {
          name: 'options',
          type: 'string',
          required: false,
          description: 'Additional options',
          example: '--verbose'
        }
      ],
      supportedTargetTypes: ['ip', 'domain', 'url'],
      targetParameterName: 'target',
      category: 'reconnaissance',
      isActive: true,
      documentation: '# Custom Tool\n\nAdd tool documentation here.',
      exampleCommands: ['tool target --options'],
      usageNotes: 'Configure tool-specific settings'
    };
  }

  /**
   * Apply template to partial configuration
   */
  static applyTemplate(
    type: 'python' | 'nodejs' | 'go' | 'rust' | 'network_scanner' | 'web_scanner',
    overrides: Partial<ToolConfiguration>
  ): Partial<ToolConfiguration> {
    const template = this.getTemplate(type);
    return {
      ...template,
      ...overrides,
      // Merge arrays instead of replacing
      parameters: overrides.parameters ?? template.parameters,
      exampleCommands: overrides.exampleCommands ?? template.exampleCommands,
      supportedTargetTypes: overrides.supportedTargetTypes ?? template.supportedTargetTypes,
      tags: [...(template.tags ?? []), ...(overrides.tags ?? [])],
      environment: { ...template.environment, ...overrides.environment }
    };
  }
}

// Export default validator instance
export const toolConfigValidator = new ToolConfigValidator();
```

#### Integration Points

**Database Extension** (`shared/schema.ts`):
The existing `securityTools` table should be extended to store these configuration fields:

```typescript
// Add to shared/schema.ts
export const securityTools = pgTable("security_tools", {
  // ... existing fields ...

  // New configuration fields
  configuration: jsonb("configuration").$type<ToolConfiguration>(),
  githubUrl: text("github_url"),
  dockerfile: text("dockerfile"),
  buildArgs: jsonb("build_args").$type<Record<string, string>>(),
  installMethod: text("install_method"),
  testSuite: jsonb("test_suite"),

  // Metadata
  tags: jsonb("tags").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true).notNull(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Frontend Tool Configuration Dialog** (`client/src/components/tools/ToolConfigDialog.tsx`):
- Template selector dropdown
- Parameter builder with drag-and-drop
- Command preview with syntax highlighting
- Validation feedback in real-time
- Import/export configuration as JSON

**Service Layer** (`server/services/tool-config-manager.ts`):
```typescript
export class ToolConfigManager {
  async createTool(config: Partial<ToolConfiguration>): Promise<string> {
    // Validate configuration
    const validation = await toolConfigValidator.validate(config);
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }

    // Sanitize and store
    const sanitized = toolConfigValidator.sanitize(config);
    const toolId = await db.insert(securityTools).values(sanitized);

    return toolId;
  }

  async updateTool(toolId: string, updates: Partial<ToolConfiguration>): Promise<void> {
    // Validate and update
  }

  async validateToolConfig(toolId: string): Promise<ValidationResult> {
    // Runtime validation
  }
}
```

### Estimated Effort
2-3 days

---

## GitHub Tool Auto-Installer

### Status: 🟡 Tier 2 - Medium Priority

### Description
Automated tool installation system that analyzes GitHub repositories, detects dependencies, generates Dockerfiles, and installs tools into the rtpi-tools container.

### User Flow
```
1. User clicks "Add New Tool" → Enter GitHub URL
2. System analyzes repository:
   - Detects language (Python, Go, Rust, Node.js, etc.)
   - Finds dependency files (requirements.txt, package.json, etc.)
   - Extracts installation instructions from README
   - Identifies entry points
3. Shows analysis preview with editable config
4. User reviews and adjusts configuration
5. User clicks "Install"
6. System:
   - Generates Dockerfile
   - Builds Docker image
   - Tests installation
   - Registers in database
   - Updates rtpi-tools container
7. Tool ready for use
```

### UI Design
```
┌─────────────────────────────────────────────────────────────────┐
│ Add New Tool from GitHub                                         │
├─────────────────────────────────────────────────────────────────┤
│ GitHub Repository URL *                                          │
│ ┌──────────────────────────────────────────────────────────┐    │
│ │ https://github.com/SecFathy/Bugzee                       │    │
│ └──────────────────────────────────────────────────────────┘    │
│ [Analyze Repository]                                             │
│                                                                  │
│ ✅ Repository Analysis Complete:                                │
│ ┌──────────────────────────────────────────────────────────┐    │
│ │ Name: Bugzee                                             │    │
│ │ Language: Python 3.9+                                    │    │
│ │ Requirements: requirements.txt found                     │    │
│ │ Installation: pip install -r requirements.txt            │    │
│ │ Entry Point: bugzee.py                                   │    │
│ │ License: MIT                                             │    │
│ │ Size: 2.4 MB                                             │    │
│ │ Last Updated: 2 weeks ago                                │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│ Tool Configuration                                               │
│ Category: [Vulnerability Scanning ▼]                             │
│ Command: [bugzee scan {target}                           ]       │
│ Output Format: [JSON ▼]                                          │
│                                                                  │
│ [Cancel]                              [Install in rtpi-tools →] │
└─────────────────────────────────────────────────────────────────┘
```

### Components

#### A. GitHub Repository Analyzer

**File:** `server/services/github-tool-analyzer.ts`

Complete service implementation for analyzing GitHub repositories to extract tool metadata, detect languages, parse dependencies, and generate installation configurations.

```typescript
import { Octokit } from '@octokit/rest';
import * as yaml from 'js-yaml';

/**
 * Analysis result interface
 */
export interface ToolAnalysis {
  name: string;
  description: string;
  owner: string;
  repo: string;
  stars: number;
  forks: number;
  lastUpdated: string;
  license: string | null;
  primaryLanguage: string;
  languages: Record<string, number>;
  dependencies: Dependencies;
  entryPoints: string[];
  installInstructions: InstallInstructions;
  suggestedConfig: Partial<ToolConfiguration>;
  size: number;
  topics: string[];
  hasDockerfile: boolean;
  hasTests: boolean;
}

export interface Dependencies {
  python?: DetectedDependency[];
  node?: DetectedDependency[];
  go?: GoModule[];
  rust?: RustCrate[];
  apt?: string[];
  system?: string[];
}

export interface DetectedDependency {
  name: string;
  version?: string;
  isDev?: boolean;
}

export interface GoModule {
  path: string;
  version: string;
}

export interface RustCrate {
  name: string;
  version: string;
  features?: string[];
}

export interface InstallInstructions {
  method: 'docker' | 'binary' | 'pip' | 'npm' | 'cargo' | 'apt' | 'script';
  steps: string[];
  buildCommand?: string;
  runCommand?: string;
  requirements: string[];
}

/**
 * GitHub Tool Analyzer Service
 *
 * Analyzes GitHub repositories to extract tool metadata and configuration
 */
export class GitHubToolAnalyzer {
  private octokit: Octokit;

  constructor(githubToken?: string) {
    this.octokit = new Octokit({
      auth: githubToken || process.env.GITHUB_TOKEN,
    });
  }

  /**
   * Main analysis method
   * Analyzes a GitHub repository and returns comprehensive tool information
   */
  async analyzeRepository(githubUrl: string): Promise<ToolAnalysis> {
    // 1. Parse GitHub URL
    const { owner, repo } = this.parseGitHubUrl(githubUrl);

    // 2. Fetch repository metadata
    const repoData = await this.octokit.repos.get({ owner, repo });
    const repository = repoData.data;

    // 3. Fetch languages
    const languagesData = await this.octokit.repos.listLanguages({ owner, repo });
    const languages = languagesData.data;

    // 4. Detect primary language
    const primaryLanguage = this.detectPrimaryLanguage(languages);

    // 5. Detect dependencies
    const dependencies = await this.detectDependencies(owner, repo, primaryLanguage);

    // 6. Parse installation instructions from README
    const installInstructions = await this.parseInstallInstructions(owner, repo, primaryLanguage);

    // 7. Identify entry points
    const entryPoints = await this.identifyEntryPoints(owner, repo, primaryLanguage);

    // 8. Check for Dockerfile
    const hasDockerfile = await this.checkFileExists(owner, repo, 'Dockerfile');

    // 9. Check for tests
    const hasTests = await this.checkForTests(owner, repo, primaryLanguage);

    // 10. Generate suggested configuration
    const suggestedConfig = this.generateSuggestedConfig({
      name: repository.name,
      description: repository.description || '',
      primaryLanguage,
      dependencies,
      entryPoints,
      installInstructions,
      hasDockerfile
    });

    return {
      name: repository.name,
      description: repository.description || '',
      owner,
      repo,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      lastUpdated: repository.updated_at,
      license: repository.license?.spdx_id || null,
      primaryLanguage,
      languages,
      dependencies,
      entryPoints,
      installInstructions,
      suggestedConfig,
      size: repository.size,
      topics: repository.topics || [],
      hasDockerfile,
      hasTests
    };
  }

  /**
   * Parse GitHub URL to extract owner and repo
   */
  private parseGitHubUrl(url: string): { owner: string; repo: string } {
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\.]+)/,  // Standard URL
      /([^\/]+)\/([^\/]+)/                   // Short format
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }
    }

    throw new Error(`Invalid GitHub URL: ${url}`);
  }

  /**
   * Detect primary language based on bytes of code
   */
  private detectPrimaryLanguage(languages: Record<string, number>): string {
    if (Object.keys(languages).length === 0) {
      return 'Unknown';
    }

    let maxBytes = 0;
    let primaryLang = 'Unknown';

    for (const [lang, bytes] of Object.entries(languages)) {
      if (bytes > maxBytes) {
        maxBytes = bytes;
        primaryLang = lang;
      }
    }

    return primaryLang;
  }

  /**
   * Detect dependencies based on language
   */
  private async detectDependencies(
    owner: string,
    repo: string,
    primaryLanguage: string
  ): Promise<Dependencies> {
    const dependencies: Dependencies = {};

    // Python dependencies
    if (primaryLanguage === 'Python') {
      dependencies.python = await this.detectPythonDependencies(owner, repo);
    }

    // Node.js dependencies
    if (primaryLanguage === 'JavaScript' || primaryLanguage === 'TypeScript') {
      dependencies.node = await this.detectNodeDependencies(owner, repo);
    }

    // Go dependencies
    if (primaryLanguage === 'Go') {
      dependencies.go = await this.detectGoDependencies(owner, repo);
    }

    // Rust dependencies
    if (primaryLanguage === 'Rust') {
      dependencies.rust = await this.detectRustDependencies(owner, repo);
    }

    // APT packages (check Dockerfile or docs)
    dependencies.apt = await this.detectAptPackages(owner, repo);

    return dependencies;
  }

  /**
   * Detect Python dependencies from requirements.txt, setup.py, or pyproject.toml
   */
  private async detectPythonDependencies(owner: string, repo: string): Promise<DetectedDependency[]> {
    const dependencies: DetectedDependency[] = [];

    // Try requirements.txt
    try {
      const content = await this.getFileContent(owner, repo, 'requirements.txt');
      const parsed = this.parsePythonRequirements(content);
      dependencies.push(...parsed);
    } catch (err) {
      // File doesn't exist, try next
    }

    // Try setup.py
    try {
      const content = await this.getFileContent(owner, repo, 'setup.py');
      const parsed = this.parseSetupPy(content);
      dependencies.push(...parsed);
    } catch (err) {
      // File doesn't exist
    }

    // Try pyproject.toml
    try {
      const content = await this.getFileContent(owner, repo, 'pyproject.toml');
      const parsed = this.parsePyprojectToml(content);
      dependencies.push(...parsed);
    } catch (err) {
      // File doesn't exist
    }

    return dependencies;
  }

  /**
   * Parse requirements.txt format
   */
  private parsePythonRequirements(content: string): DetectedDependency[] {
    return content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => {
        const match = line.match(/^([a-zA-Z0-9\-_]+)([>=<~!]+)?(.+)?$/);
        if (match) {
          return {
            name: match[1],
            version: match[3] ? match[3].trim() : undefined
          };
        }
        return null;
      })
      .filter(dep => dep !== null) as DetectedDependency[];
  }

  /**
   * Parse setup.py (basic extraction)
   */
  private parseSetupPy(content: string): DetectedDependency[] {
    const dependencies: DetectedDependency[] = [];
    const installRequiresMatch = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/);

    if (installRequiresMatch) {
      const deps = installRequiresMatch[1]
        .split(',')
        .map(dep => dep.trim().replace(/['"]/g, ''))
        .filter(dep => dep);

      deps.forEach(dep => {
        const match = dep.match(/^([a-zA-Z0-9\-_]+)([>=<~!]+)?(.+)?$/);
        if (match) {
          dependencies.push({
            name: match[1],
            version: match[3] ? match[3].trim() : undefined
          });
        }
      });
    }

    return dependencies;
  }

  /**
   * Parse pyproject.toml
   */
  private parsePyprojectToml(content: string): DetectedDependency[] {
    // Simple TOML parsing for dependencies section
    const dependencies: DetectedDependency[] = [];
    const depsMatch = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\[|$)/);

    if (depsMatch) {
      const lines = depsMatch[1].split('\n');
      lines.forEach(line => {
        const match = line.match(/^([a-zA-Z0-9\-_]+)\s*=\s*['"](.*)['"]/);
        if (match) {
          dependencies.push({
            name: match[1],
            version: match[2]
          });
        }
      });
    }

    return dependencies;
  }

  /**
   * Detect Node.js dependencies from package.json
   */
  private async detectNodeDependencies(owner: string, repo: string): Promise<DetectedDependency[]> {
    try {
      const content = await this.getFileContent(owner, repo, 'package.json');
      const packageJson = JSON.parse(content);

      const dependencies: DetectedDependency[] = [];

      if (packageJson.dependencies) {
        Object.entries(packageJson.dependencies).forEach(([name, version]) => {
          dependencies.push({ name, version: version as string, isDev: false });
        });
      }

      if (packageJson.devDependencies) {
        Object.entries(packageJson.devDependencies).forEach(([name, version]) => {
          dependencies.push({ name, version: version as string, isDev: true });
        });
      }

      return dependencies;
    } catch (err) {
      return [];
    }
  }

  /**
   * Detect Go dependencies from go.mod
   */
  private async detectGoDependencies(owner: string, repo: string): Promise<GoModule[]> {
    try {
      const content = await this.getFileContent(owner, repo, 'go.mod');
      const modules: GoModule[] = [];

      const lines = content.split('\n');
      let inRequire = false;

      lines.forEach(line => {
        line = line.trim();

        if (line.startsWith('require (')) {
          inRequire = true;
          return;
        }

        if (inRequire && line === ')') {
          inRequire = false;
          return;
        }

        if (inRequire || line.startsWith('require ')) {
          const match = line.match(/([^\s]+)\s+v([^\s]+)/);
          if (match) {
            modules.push({
              path: match[1],
              version: match[2]
            });
          }
        }
      });

      return modules;
    } catch (err) {
      return [];
    }
  }

  /**
   * Detect Rust dependencies from Cargo.toml
   */
  private async detectRustDependencies(owner: string, repo: string): Promise<RustCrate[]> {
    try {
      const content = await this.getFileContent(owner, repo, 'Cargo.toml');
      const crates: RustCrate[] = [];

      const depsMatch = content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
      if (depsMatch) {
        const lines = depsMatch[1].split('\n');
        lines.forEach(line => {
          const simpleMatch = line.match(/^([a-zA-Z0-9\-_]+)\s*=\s*"([^"]+)"/);
          if (simpleMatch) {
            crates.push({
              name: simpleMatch[1],
              version: simpleMatch[2]
            });
            return;
          }

          const complexMatch = line.match(/^([a-zA-Z0-9\-_]+)\s*=\s*\{/);
          if (complexMatch) {
            const versionMatch = line.match(/version\s*=\s*"([^"]+)"/);
            crates.push({
              name: complexMatch[1],
              version: versionMatch ? versionMatch[1] : 'latest'
            });
          }
        });
      }

      return crates;
    } catch (err) {
      return [];
    }
  }

  /**
   * Detect APT packages from Dockerfile or documentation
   */
  private async detectAptPackages(owner: string, repo: string): Promise<string[]> {
    const packages: Set<string> = new Set();

    try {
      const content = await this.getFileContent(owner, repo, 'Dockerfile');
      const aptMatches = content.matchAll(/apt-get install.*?([a-z0-9\-]+)/g);

      for (const match of aptMatches) {
        const pkgs = match[0]
          .replace(/apt-get install -y/, '')
          .split(/\s+/)
          .filter(pkg => pkg && !pkg.startsWith('-'));
        pkgs.forEach(pkg => packages.add(pkg));
      }
    } catch (err) {
      // No Dockerfile
    }

    return Array.from(packages);
  }

  /**
   * Parse installation instructions from README
   */
  private async parseInstallInstructions(
    owner: string,
    repo: string,
    primaryLanguage: string
  ): Promise<InstallInstructions> {
    try {
      const content = await this.getFileContent(owner, repo, 'README.md');

      // Look for installation section
      const installSection = this.extractInstallationSection(content);

      // Detect method based on content and language
      const method = this.detectInstallMethod(installSection, primaryLanguage);

      // Extract steps
      const steps = this.extractInstallSteps(installSection);

      // Extract commands
      const buildCommand = this.extractBuildCommand(installSection, primaryLanguage);
      const runCommand = this.extractRunCommand(installSection, primaryLanguage);

      // Extract requirements
      const requirements = this.extractRequirements(installSection);

      return {
        method,
        steps,
        buildCommand,
        runCommand,
        requirements
      };
    } catch (err) {
      // Fallback to language defaults
      return this.getDefaultInstallInstructions(primaryLanguage);
    }
  }

  /**
   * Extract installation section from README
   */
  private extractInstallationSection(readme: string): string {
    const patterns = [
      /##\s+Installation([\s\S]*?)(?=##|$)/i,
      /##\s+Getting Started([\s\S]*?)(?=##|$)/i,
      /##\s+Quick Start([\s\S]*?)(?=##|$)/i,
      /##\s+Setup([\s\S]*?)(?=##|$)/i
    ];

    for (const pattern of patterns) {
      const match = readme.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return readme; // Use full README if no section found
  }

  /**
   * Detect installation method from content
   */
  private detectInstallMethod(content: string, primaryLanguage: string): InstallInstructions['method'] {
    if (content.includes('docker pull') || content.includes('docker build')) {
      return 'docker';
    }
    if (content.includes('pip install') && primaryLanguage === 'Python') {
      return 'pip';
    }
    if (content.includes('npm install') && (primaryLanguage === 'JavaScript' || primaryLanguage === 'TypeScript')) {
      return 'npm';
    }
    if (content.includes('cargo install') && primaryLanguage === 'Rust') {
      return 'cargo';
    }
    if (content.includes('apt-get install')) {
      return 'apt';
    }
    if (content.includes('go install') || content.includes('go build')) {
      return 'binary';
    }

    // Default based on language
    const defaults: Record<string, InstallInstructions['method']> = {
      'Python': 'pip',
      'JavaScript': 'npm',
      'TypeScript': 'npm',
      'Go': 'binary',
      'Rust': 'cargo'
    };

    return defaults[primaryLanguage] || 'script';
  }

  /**
   * Extract installation steps from content
   */
  private extractInstallSteps(content: string): string[] {
    const steps: string[] = [];

    // Extract numbered lists
    const numberedSteps = content.matchAll(/^\d+\.\s+(.+)$/gm);
    for (const match of numberedSteps) {
      steps.push(match[1].trim());
    }

    // Extract code blocks
    const codeBlocks = content.matchAll(/```(?:bash|shell|sh)?\n([\s\S]*?)```/g);
    for (const match of codeBlocks) {
      const commands = match[1]
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.trim());
      steps.push(...commands);
    }

    return steps;
  }

  /**
   * Extract build command
   */
  private extractBuildCommand(content: string, primaryLanguage: string): string | undefined {
    const patterns = [
      /(?:build|compile).*?:\s*`([^`]+)`/i,
      /```(?:bash|shell|sh)?\n.*?((?:go build|cargo build|npm run build|python setup\.py build)[^\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Language defaults
    const defaults: Record<string, string> = {
      'Go': 'go build -o tool .',
      'Rust': 'cargo build --release'
    };

    return defaults[primaryLanguage];
  }

  /**
   * Extract run command
   */
  private extractRunCommand(content: string, primaryLanguage: string): string | undefined {
    const patterns = [
      /(?:usage|run).*?:\s*`([^`]+)`/i,
      /```(?:bash|shell|sh)?\n.*?((?:python |node |\.\/)[^\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract requirements
   */
  private extractRequirements(content: string): string[] {
    const requirements: string[] = [];

    // Look for requirements or prerequisites section
    const reqMatch = content.match(/(?:requirements|prerequisites):([\s\S]*?)(?=##|$)/i);
    if (reqMatch) {
      const items = reqMatch[1].matchAll(/[-*]\s+(.+)/g);
      for (const match of items) {
        requirements.push(match[1].trim());
      }
    }

    return requirements;
  }

  /**
   * Get default installation instructions for a language
   */
  private getDefaultInstallInstructions(primaryLanguage: string): InstallInstructions {
    const defaults: Record<string, InstallInstructions> = {
      'Python': {
        method: 'pip',
        steps: ['pip install -r requirements.txt'],
        requirements: ['Python 3.8+', 'pip']
      },
      'JavaScript': {
        method: 'npm',
        steps: ['npm install'],
        requirements: ['Node.js 16+', 'npm']
      },
      'TypeScript': {
        method: 'npm',
        steps: ['npm install', 'npm run build'],
        buildCommand: 'npm run build',
        requirements: ['Node.js 16+', 'npm']
      },
      'Go': {
        method: 'binary',
        steps: ['go build -o tool .'],
        buildCommand: 'go build -o tool .',
        requirements: ['Go 1.19+']
      },
      'Rust': {
        method: 'cargo',
        steps: ['cargo build --release'],
        buildCommand: 'cargo build --release',
        requirements: ['Rust 1.70+', 'Cargo']
      }
    };

    return defaults[primaryLanguage] || {
      method: 'script',
      steps: [],
      requirements: []
    };
  }

  /**
   * Identify entry points for the tool
   */
  private async identifyEntryPoints(
    owner: string,
    repo: string,
    primaryLanguage: string
  ): Promise<string[]> {
    const entryPoints: string[] = [];

    try {
      // Language-specific entry point patterns
      const patterns: Record<string, string[]> = {
        'Python': ['main.py', '__main__.py', 'cli.py', 'app.py'],
        'JavaScript': ['index.js', 'main.js', 'cli.js', 'bin.js'],
        'TypeScript': ['index.ts', 'main.ts', 'cli.ts'],
        'Go': ['main.go', 'cmd/main.go'],
        'Rust': ['main.rs', 'src/main.rs']
      };

      const filesToCheck = patterns[primaryLanguage] || [];

      for (const file of filesToCheck) {
        const exists = await this.checkFileExists(owner, repo, file);
        if (exists) {
          entryPoints.push(file);
        }
      }

      // Check package.json bin field for Node.js
      if (primaryLanguage === 'JavaScript' || primaryLanguage === 'TypeScript') {
        try {
          const pkgContent = await this.getFileContent(owner, repo, 'package.json');
          const pkg = JSON.parse(pkgContent);
          if (pkg.bin) {
            if (typeof pkg.bin === 'string') {
              entryPoints.push(pkg.bin);
            } else {
              Object.values(pkg.bin).forEach(path => entryPoints.push(path as string));
            }
          }
          if (pkg.main) {
            entryPoints.push(pkg.main);
          }
        } catch (err) {
          // No package.json
        }
      }
    } catch (err) {
      console.error('Error identifying entry points:', err);
    }

    return entryPoints;
  }

  /**
   * Generate suggested tool configuration
   */
  private generateSuggestedConfig(info: {
    name: string;
    description: string;
    primaryLanguage: string;
    dependencies: Dependencies;
    entryPoints: string[];
    installInstructions: InstallInstructions;
    hasDockerfile: boolean;
  }): Partial<ToolConfiguration> {
    const config: Partial<ToolConfiguration> = {
      name: info.name,
      description: info.description,
      version: '1.0.0',
      installMethod: info.installInstructions.method,
      category: this.suggestCategory(info.name, info.description),
      isActive: true
    };

    // Set entry point
    if (info.entryPoints.length > 0) {
      config.entrypoint = info.entryPoints[0];
    }

    // Set command template based on language
    if (info.primaryLanguage === 'Python') {
      config.command = `python ${config.entrypoint || 'main.py'} {target} {options}`;
      config.dockerImage = 'python:3.11-slim';
    } else if (info.primaryLanguage === 'JavaScript' || info.primaryLanguage === 'TypeScript') {
      config.command = `node ${config.entrypoint || 'index.js'} {target} {options}`;
      config.dockerImage = 'node:18-alpine';
    } else if (info.primaryLanguage === 'Go') {
      config.command = `./${info.name} {target} {options}`;
      config.dockerImage = 'golang:1.21-alpine';
      config.buildCommand = `go build -o ${info.name} .`;
    } else if (info.primaryLanguage === 'Rust') {
      config.command = `./${info.name} {target} {options}`;
      config.dockerImage = 'rust:1.75-slim';
      config.buildCommand = 'cargo build --release';
    }

    // Set suggested parameters
    config.parameters = [
      {
        name: 'target',
        type: 'string',
        required: true,
        description: 'Target to scan',
        example: 'example.com'
      },
      {
        name: 'options',
        type: 'string',
        required: false,
        description: 'Additional options',
        example: '--verbose'
      }
    ];

    // Set target compatibility
    config.supportedTargetTypes = ['ip', 'domain', 'url'];
    config.targetParameterName = 'target';

    // Set defaults
    config.outputFormat = 'text';
    config.requiresSudo = false;
    config.timeout = 300;
    config.maxRetries = 0;

    return config;
  }

  /**
   * Suggest category based on tool name and description
   */
  private suggestCategory(name: string, description: string): ToolCategory {
    const text = `${name} ${description}`.toLowerCase();

    if (text.match(/recon|enum|discover|scan/)) {
      return 'reconnaissance';
    }
    if (text.match(/exploit|payload|shell/)) {
      return 'exploitation';
    }
    if (text.match(/web|xss|sql|owasp|burp/)) {
      return 'web_security';
    }
    if (text.match(/vuln|cve|nuclei/)) {
      return 'vulnerability_scanning';
    }
    if (text.match(/network|port|nmap/)) {
      return 'network_scanning';
    }
    if (text.match(/post|persist|lateral/)) {
      return 'post_exploitation';
    }
    if (text.match(/report|document/)) {
      return 'reporting';
    }

    return 'auxiliary';
  }

  /**
   * Helper: Get file content from repository
   */
  private async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const response = await this.octokit.repos.getContent({
      owner,
      repo,
      path
    });

    if ('content' in response.data) {
      return Buffer.from(response.data.content, 'base64').toString('utf-8');
    }

    throw new Error(`File ${path} not found`);
  }

  /**
   * Helper: Check if file exists
   */
  private async checkFileExists(owner: string, repo: string, path: string): Promise<boolean> {
    try {
      await this.octokit.repos.getContent({ owner, repo, path });
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Helper: Check for tests
   */
  private async checkForTests(owner: string, repo: string, primaryLanguage: string): Promise<boolean> {
    const testPaths: Record<string, string[]> = {
      'Python': ['tests/', 'test/', 'test_*.py'],
      'JavaScript': ['test/', 'tests/', '__tests__/', '*.test.js'],
      'TypeScript': ['test/', 'tests/', '__tests__/', '*.test.ts'],
      'Go': ['*_test.go'],
      'Rust': ['tests/']
    };

    const paths = testPaths[primaryLanguage] || [];

    for (const path of paths) {
      const exists = await this.checkFileExists(owner, repo, path);
      if (exists) {
        return true;
      }
    }

    return false;
  }
}

// Export singleton instance
export const githubToolAnalyzer = new GitHubToolAnalyzer();
```

**Usage Example:**

```typescript
// In API endpoint or service
import { githubToolAnalyzer } from './github-tool-analyzer';

const analysis = await githubToolAnalyzer.analyzeRepository(
  'https://github.com/projectdiscovery/nuclei'
);

console.log('Tool Analysis:', {
  name: analysis.name,
  language: analysis.primaryLanguage,
  dependencies: analysis.dependencies,
  installMethod: analysis.installInstructions.method,
  suggestedConfig: analysis.suggestedConfig
});
```

**Key Features:**
- Complete GitHub API integration via Octokit
- Multi-language support (Python, Node, Go, Rust)
- Dependency file parsing (requirements.txt, package.json, go.mod, Cargo.toml)
- README parsing for installation instructions
- Entry point detection per language
- Suggested configuration generation
- Error handling and fallbacks

#### B. Dockerfile Generator

**File:** `server/services/tool-dockerfile-generator.ts`

Complete service for generating optimized, secure Docker files tailored to different programming languages and tool types.

```typescript
import type { ToolAnalysis, Dependencies } from './github-tool-analyzer';

export interface DockerfileOptions {
  useMultiStage?: boolean;
  includeHealthcheck?: boolean;
  nonRootUser?: boolean;
  optimizeSize?: boolean;
  baseImage?: string;
  workdir?: string;
  exposePorts?: number[];
  customCommands?: string[];
}

/**
 * Dockerfile Generator Service
 *
 * Generates optimized, secure Dockerfiles for tools based on language and dependencies
 */
export class ToolDockerfileGenerator {

  /**
   * Main generation method
   * Routes to language-specific generators
   */
  generateDockerfile(analysis: ToolAnalysis, options: DockerfileOptions = {}): string {
    const lang = analysis.primaryLanguage;

    switch (lang) {
      case 'Python':
        return this.generatePythonDockerfile(analysis, options);
      case 'JavaScript':
      case 'TypeScript':
        return this.generateNodeDockerfile(analysis, options);
      case 'Go':
        return this.generateGoDockerfile(analysis, options);
      case 'Rust':
        return this.generateRustDockerfile(analysis, options);
      default:
        return this.generateGenericDockerfile(analysis, options);
    }
  }

  /**
   * Generate Dockerfile for Python tools
   * Uses multi-stage builds for smaller images
   */
  private generatePythonDockerfile(analysis: ToolAnalysis, options: DockerfileOptions): string {
    const baseImage = options.baseImage || 'python:3.11-slim';
    const workdir = options.workdir || '/app';
    const useMultiStage = options.useMultiStage ?? true;
    const nonRoot = options.nonRootUser ?? true;

    const pythonDeps = analysis.dependencies.python || [];
    const aptDeps = analysis.dependencies.apt || [];

    let dockerfile = '';

    if (useMultiStage) {
      // Multi-stage build for smaller final image
      dockerfile += `# Build stage\n`;
      dockerfile += `FROM ${baseImage} AS builder\n\n`;
    } else {
      dockerfile += `FROM ${baseImage}\n\n`;
    }

    // Set environment variables
    dockerfile += `# Set environment variables\n`;
    dockerfile += `ENV PYTHONUNBUFFERED=1 \\\n`;
    dockerfile += `    PYTHONDONTWRITEBYTECODE=1 \\\n`;
    dockerfile += `    PIP_NO_CACHE_DIR=1 \\\n`;
    dockerfile += `    PIP_DISABLE_PIP_VERSION_CHECK=1\n\n`;

    // Install system dependencies
    if (aptDeps.length > 0) {
      dockerfile += `# Install system dependencies\n`;
      dockerfile += `RUN apt-get update && apt-get install -y --no-install-recommends \\\n`;
      aptDeps.forEach((dep, index) => {
        dockerfile += `    ${dep}${index < aptDeps.length - 1 ? ' \\' : ''}\n`;
      });
      dockerfile += `    && rm -rf /var/lib/apt/lists/*\n\n`;
    }

    // Set working directory
    dockerfile += `WORKDIR ${workdir}\n\n`;

    // Copy requirements first (for better caching)
    if (pythonDeps.length > 0) {
      dockerfile += `# Copy requirements file\n`;
      dockerfile += `COPY requirements.txt .\n\n`;

      dockerfile += `# Install Python dependencies\n`;
      dockerfile += `RUN pip install --no-cache-dir -r requirements.txt\n\n`;
    }

    // Copy application code
    dockerfile += `# Copy application code\n`;
    dockerfile += `COPY . .\n\n`;

    // Setup permissions if using specific entry point
    if (analysis.entryPoints.length > 0) {
      dockerfile += `# Make entry point executable\n`;
      dockerfile += `RUN chmod +x ${analysis.entryPoints[0]}\n\n`;
    }

    if (useMultiStage) {
      // Final stage - copy only necessary files
      dockerfile += `# Final stage\n`;
      dockerfile += `FROM ${baseImage}\n\n`;

      dockerfile += `ENV PYTHONUNBUFFERED=1\n\n`;

      // Install runtime system dependencies only
      if (aptDeps.length > 0) {
        const runtimeDeps = aptDeps.filter(dep => !dep.includes('-dev'));
        if (runtimeDeps.length > 0) {
          dockerfile += `# Install runtime dependencies\n`;
          dockerfile += `RUN apt-get update && apt-get install -y --no-install-recommends \\\n`;
          runtimeDeps.forEach((dep, index) => {
            dockerfile += `    ${dep}${index < runtimeDeps.length - 1 ? ' \\' : ''}\n`;
          });
          dockerfile += `    && rm -rf /var/lib/apt/lists/*\n\n`;
        }
      }

      dockerfile += `WORKDIR ${workdir}\n\n`;

      // Copy from builder
      dockerfile += `# Copy from builder\n`;
      dockerfile += `COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages\n`;
      dockerfile += `COPY --from=builder /usr/local/bin /usr/local/bin\n`;
      dockerfile += `COPY --from=builder ${workdir} ${workdir}\n\n`;
    }

    // Create non-root user
    if (nonRoot) {
      dockerfile += `# Create non-root user\n`;
      dockerfile += `RUN useradd -m -u 1000 tooluser && \\\n`;
      dockerfile += `    chown -R tooluser:tooluser ${workdir}\n\n`;
      dockerfile += `USER tooluser\n\n`;
    }

    // Healthcheck if requested
    if (options.includeHealthcheck && analysis.entryPoints[0]) {
      dockerfile += `# Healthcheck\n`;
      dockerfile += `HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\\n`;
      dockerfile += `    CMD python ${analysis.entryPoints[0]} --version || exit 1\n\n`;
    }

    // Entry point
    if (analysis.entryPoints.length > 0) {
      dockerfile += `# Set entrypoint\n`;
      dockerfile += `ENTRYPOINT ["python", "${analysis.entryPoints[0]}"]\n`;
    } else {
      dockerfile += `# Default command\n`;
      dockerfile += `CMD ["python"]\n`;
    }

    return dockerfile;
  }

  /**
   * Generate Dockerfile for Node.js/TypeScript tools
   */
  private generateNodeDockerfile(analysis: ToolAnalysis, options: DockerfileOptions): string {
    const baseImage = options.baseImage || 'node:18-alpine';
    const workdir = options.workdir || '/app';
    const useMultiStage = options.useMultiStage ?? true;
    const nonRoot = options.nonRootUser ?? true;
    const isTypeScript = analysis.primaryLanguage === 'TypeScript';

    const aptDeps = analysis.dependencies.apt || [];

    let dockerfile = '';

    if (useMultiStage) {
      // Build stage
      dockerfile += `# Build stage\n`;
      dockerfile += `FROM ${baseImage} AS builder\n\n`;
    } else {
      dockerfile += `FROM ${baseImage}\n\n`;
    }

    // Install system dependencies (Alpine uses apk, not apt)
    if (aptDeps.length > 0) {
      dockerfile += `# Install system dependencies\n`;
      dockerfile += `RUN apk add --no-cache \\\n`;
      aptDeps.forEach((dep, index) => {
        // Convert apt package names to apk equivalents
        const apkDep = this.convertAptToApk(dep);
        dockerfile += `    ${apkDep}${index < aptDeps.length - 1 ? ' \\' : ''}\n`;
      });
      dockerfile += `\n`;
    }

    dockerfile += `WORKDIR ${workdir}\n\n`;

    // Copy package files first (for better caching)
    dockerfile += `# Copy package files\n`;
    dockerfile += `COPY package*.json ./\n\n`;

    // Install dependencies
    dockerfile += `# Install dependencies\n`;
    dockerfile += `RUN npm ci --only=production\n\n`;

    if (isTypeScript) {
      // Install dev dependencies for build
      dockerfile += `# Install dev dependencies for TypeScript build\n`;
      dockerfile += `RUN npm ci\n\n`;
    }

    // Copy source code
    dockerfile += `# Copy source code\n`;
    dockerfile += `COPY . .\n\n`;

    // Build TypeScript if needed
    if (isTypeScript) {
      dockerfile += `# Build TypeScript\n`;
      dockerfile += `RUN npm run build\n\n`;

      // Remove dev dependencies after build
      dockerfile += `# Remove dev dependencies\n`;
      dockerfile += `RUN npm prune --production\n\n`;
    }

    if (useMultiStage) {
      // Production stage
      dockerfile += `# Production stage\n`;
      dockerfile += `FROM ${baseImage}\n\n`;

      // Runtime dependencies
      if (aptDeps.length > 0) {
        const runtimeDeps = aptDeps.filter(dep => !dep.includes('-dev'));
        if (runtimeDeps.length > 0) {
          dockerfile += `# Install runtime dependencies\n`;
          dockerfile += `RUN apk add --no-cache \\\n`;
          runtimeDeps.forEach((dep, index) => {
            const apkDep = this.convertAptToApk(dep);
            dockerfile += `    ${apkDep}${index < runtimeDeps.length - 1 ? ' \\' : ''}\n`;
          });
          dockerfile += `\n`;
        }
      }

      dockerfile += `WORKDIR ${workdir}\n\n`;

      // Copy from builder
      dockerfile += `# Copy from builder\n`;
      dockerfile += `COPY --from=builder ${workdir}/node_modules ./node_modules\n`;
      if (isTypeScript) {
        dockerfile += `COPY --from=builder ${workdir}/dist ./dist\n`;
      }
      dockerfile += `COPY --from=builder ${workdir}/package*.json ./\n`;
      dockerfile += `COPY --from=builder ${workdir}/${analysis.entryPoints[0] || 'index.js'} ./\n\n`;
    }

    // Create non-root user
    if (nonRoot) {
      dockerfile += `# Create non-root user\n`;
      dockerfile += `RUN addgroup -g 1000 tooluser && \\\n`;
      dockerfile += `    adduser -D -u 1000 -G tooluser tooluser && \\\n`;
      dockerfile += `    chown -R tooluser:tooluser ${workdir}\n\n`;
      dockerfile += `USER tooluser\n\n`;
    }

    // Environment
    dockerfile += `ENV NODE_ENV=production\n\n`;

    // Entry point
    if (analysis.entryPoints.length > 0) {
      const entrypoint = isTypeScript ? `dist/${analysis.entryPoints[0].replace('.ts', '.js')}` : analysis.entryPoints[0];
      dockerfile += `# Set entrypoint\n`;
      dockerfile += `ENTRYPOINT ["node", "${entrypoint}"]\n`;
    } else {
      dockerfile += `CMD ["node"]\n`;
    }

    return dockerfile;
  }

  /**
   * Generate Dockerfile for Go tools
   * Uses multi-stage build to create minimal binary-only image
   */
  private generateGoDockerfile(analysis: ToolAnalysis, options: DockerfileOptions): string {
    const buildImage = 'golang:1.21-alpine';
    const runtimeImage = options.baseImage || 'alpine:latest';
    const workdir = options.workdir || '/app';
    const binaryName = analysis.name;

    let dockerfile = '';

    // Build stage
    dockerfile += `# Build stage\n`;
    dockerfile += `FROM ${buildImage} AS builder\n\n`;

    dockerfile += `WORKDIR /build\n\n`;

    // Install build dependencies
    dockerfile += `# Install build dependencies\n`;
    dockerfile += `RUN apk add --no-cache git ca-certificates\n\n`;

    // Copy go mod files
    dockerfile += `# Copy go mod files\n`;
    dockerfile += `COPY go.mod go.sum ./\n\n`;

    // Download dependencies
    dockerfile += `# Download dependencies\n`;
    dockerfile += `RUN go mod download\n\n`;

    // Copy source
    dockerfile += `# Copy source code\n`;
    dockerfile += `COPY . .\n\n`;

    // Build binary with optimizations
    dockerfile += `# Build binary\n`;
    dockerfile += `RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \\\n`;
    dockerfile += `    -ldflags="-w -s" \\\n`;
    dockerfile += `    -a -installsuffix cgo \\\n`;
    dockerfile += `    -o ${binaryName} .\n\n`;

    // Runtime stage - minimal image
    dockerfile += `# Runtime stage\n`;
    dockerfile += `FROM ${runtimeImage}\n\n`;

    // Install runtime dependencies
    dockerfile += `# Install ca-certificates for HTTPS\n`;
    dockerfile += `RUN apk --no-cache add ca-certificates\n\n`;

    dockerfile += `WORKDIR ${workdir}\n\n`;

    // Copy binary from builder
    dockerfile += `# Copy binary from builder\n`;
    dockerfile += `COPY --from=builder /build/${binaryName} .\n\n`;

    // Make executable
    dockerfile += `# Make binary executable\n`;
    dockerfile += `RUN chmod +x ${binaryName}\n\n`;

    // Create non-root user
    if (options.nonRootUser !== false) {
      dockerfile += `# Create non-root user\n`;
      dockerfile += `RUN addgroup -g 1000 tooluser && \\\n`;
      dockerfile += `    adduser -D -u 1000 -G tooluser tooluser && \\\n`;
      dockerfile += `    chown tooluser:tooluser ${binaryName}\n\n`;
      dockerfile += `USER tooluser\n\n`;
    }

    // Entry point
    dockerfile += `# Set entrypoint\n`;
    dockerfile += `ENTRYPOINT ["./${binaryName}"]\n`;

    return dockerfile;
  }

  /**
   * Generate Dockerfile for Rust tools
   * Uses multi-stage build for optimized release binary
   */
  private generateRustDockerfile(analysis: ToolAnalysis, options: DockerfileOptions): string {
    const buildImage = 'rust:1.75-slim';
    const runtimeImage = options.baseImage || 'debian:bookworm-slim';
    const workdir = options.workdir || '/app';
    const binaryName = analysis.name;

    let dockerfile = '';

    // Build stage
    dockerfile += `# Build stage\n`;
    dockerfile += `FROM ${buildImage} AS builder\n\n`;

    // Install build dependencies
    dockerfile += `# Install build dependencies\n`;
    dockerfile += `RUN apt-get update && apt-get install -y \\\n`;
    dockerfile += `    pkg-config \\\n`;
    dockerfile += `    libssl-dev \\\n`;
    dockerfile += `    && rm -rf /var/lib/apt/lists/*\n\n`;

    dockerfile += `WORKDIR /build\n\n`;

    // Copy Cargo files
    dockerfile += `# Copy Cargo files\n`;
    dockerfile += `COPY Cargo.toml Cargo.lock ./\n\n`;

    // Create dummy main for dependency caching
    dockerfile += `# Create dummy main.rs for dependency caching\n`;
    dockerfile += `RUN mkdir src && echo "fn main() {}" > src/main.rs\n\n`;

    // Build dependencies
    dockerfile += `# Build dependencies (cached layer)\n`;
    dockerfile += `RUN cargo build --release && rm -rf src\n\n`;

    // Copy real source
    dockerfile += `# Copy source code\n`;
    dockerfile += `COPY . .\n\n`;

    // Build actual binary
    dockerfile += `# Build release binary\n`;
    dockerfile += `RUN cargo build --release --bin ${binaryName}\n\n`;

    // Strip binary
    dockerfile += `# Strip binary to reduce size\n`;
    dockerfile += `RUN strip target/release/${binaryName}\n\n`;

    // Runtime stage
    dockerfile += `# Runtime stage\n`;
    dockerfile += `FROM ${runtimeImage}\n\n`;

    // Install runtime dependencies
    dockerfile += `# Install runtime dependencies\n`;
    dockerfile += `RUN apt-get update && apt-get install -y \\\n`;
    dockerfile += `    ca-certificates \\\n`;
    dockerfile += `    libssl3 \\\n`;
    dockerfile += `    && rm -rf /var/lib/apt/lists/*\n\n`;

    dockerfile += `WORKDIR ${workdir}\n\n`;

    // Copy binary
    dockerfile += `# Copy binary from builder\n`;
    dockerfile += `COPY --from=builder /build/target/release/${binaryName} .\n\n`;

    // Create non-root user
    if (options.nonRootUser !== false) {
      dockerfile += `# Create non-root user\n`;
      dockerfile += `RUN useradd -m -u 1000 tooluser && \\\n`;
      dockerfile += `    chown tooluser:tooluser ${binaryName}\n\n`;
      dockerfile += `USER tooluser\n\n`;
    }

    // Entry point
    dockerfile += `# Set entrypoint\n`;
    dockerfile += `ENTRYPOINT ["./${binaryName}"]\n`;

    return dockerfile;
  }

  /**
   * Generate generic Dockerfile for unknown languages or script-based tools
   */
  private generateGenericDockerfile(analysis: ToolAnalysis, options: DockerfileOptions): string {
    const baseImage = options.baseImage || 'ubuntu:22.04';
    const workdir = options.workdir || '/app';
    const aptDeps = analysis.dependencies.apt || [];

    let dockerfile = '';

    dockerfile += `FROM ${baseImage}\n\n`;

    // Update and install dependencies
    if (aptDeps.length > 0 || analysis.installInstructions.method === 'apt') {
      dockerfile += `# Install system dependencies\n`;
      dockerfile += `RUN apt-get update && apt-get install -y --no-install-recommends \\\n`;

      const allDeps = [...aptDeps];
      if (!allDeps.includes('ca-certificates')) {
        allDeps.push('ca-certificates');
      }
      if (!allDeps.includes('curl')) {
        allDeps.push('curl');
      }

      allDeps.forEach((dep, index) => {
        dockerfile += `    ${dep}${index < allDeps.length - 1 ? ' \\' : ''}\n`;
      });
      dockerfile += `    && rm -rf /var/lib/apt/lists/*\n\n`;
    }

    dockerfile += `WORKDIR ${workdir}\n\n`;

    // Copy application
    dockerfile += `# Copy application\n`;
    dockerfile += `COPY . .\n\n`;

    // Run install steps if provided
    if (analysis.installInstructions.steps.length > 0) {
      dockerfile += `# Run installation steps\n`;
      analysis.installInstructions.steps.forEach(step => {
        dockerfile += `RUN ${step}\n`;
      });
      dockerfile += `\n`;
    }

    // Create non-root user
    if (options.nonRootUser !== false) {
      dockerfile += `# Create non-root user\n`;
      dockerfile += `RUN useradd -m -u 1000 tooluser && \\\n`;
      dockerfile += `    chown -R tooluser:tooluser ${workdir}\n\n`;
      dockerfile += `USER tooluser\n\n`;
    }

    // Entry point
    if (analysis.entryPoints.length > 0) {
      dockerfile += `# Set entrypoint\n`;
      dockerfile += `ENTRYPOINT ["${analysis.entryPoints[0]}"]\n`;
    } else if (analysis.installInstructions.runCommand) {
      const cmdParts = analysis.installInstructions.runCommand.split(' ');
      dockerfile += `# Set entrypoint\n`;
      dockerfile += `ENTRYPOINT ${JSON.stringify(cmdParts)}\n`;
    } else {
      dockerfile += `CMD ["/bin/bash"]\n`;
    }

    return dockerfile;
  }

  /**
   * Convert APT package names to APK equivalents (Alpine Linux)
   */
  private convertAptToApk(aptPackage: string): string {
    const mapping: Record<string, string> = {
      'build-essential': 'build-base',
      'python3-dev': 'python3-dev',
      'libssl-dev': 'openssl-dev',
      'libffi-dev': 'libffi-dev',
      'libxml2-dev': 'libxml2-dev',
      'libxslt-dev': 'libxslt-dev',
      'libpq-dev': 'postgresql-dev',
      'default-libmysqlclient-dev': 'mariadb-dev',
      'libjpeg-dev': 'jpeg-dev',
      'libpng-dev': 'libpng-dev',
      'zlib1g-dev': 'zlib-dev',
      'git': 'git',
      'curl': 'curl',
      'wget': 'wget',
      'ca-certificates': 'ca-certificates'
    };

    return mapping[aptPackage] || aptPackage;
  }

  /**
   * Generate Dockerfile with custom base image
   */
  generateWithCustomBase(
    baseImage: string,
    installCommands: string[],
    entrypoint?: string
  ): string {
    let dockerfile = `FROM ${baseImage}\n\n`;

    dockerfile += `WORKDIR /app\n\n`;

    dockerfile += `# Custom installation\n`;
    installCommands.forEach(cmd => {
      dockerfile += `RUN ${cmd}\n`;
    });
    dockerfile += `\n`;

    dockerfile += `COPY . .\n\n`;

    if (entrypoint) {
      dockerfile += `ENTRYPOINT ["${entrypoint}"]\n`;
    }

    return dockerfile;
  }

  /**
   * Optimize Dockerfile for size
   */
  optimizeForSize(dockerfile: string): string {
    // Combine RUN commands
    let optimized = dockerfile.replace(
      /(RUN .+\n)+/g,
      (match) => {
        const commands = match
          .split('\n')
          .filter(line => line.startsWith('RUN'))
          .map(line => line.replace('RUN ', ''))
          .join(' && \\\n    ');
        return `RUN ${commands}\n`;
      }
    );

    // Add cleanup commands
    if (optimized.includes('apt-get install')) {
      optimized = optimized.replace(
        /RUN apt-get update/g,
        'RUN apt-get update && apt-get install -y --no-install-recommends'
      );
      optimized = optimized.replace(
        /apt-get install -y/g,
        'apt-get install -y --no-install-recommends'
      );
      // Add cleanup if not present
      if (!optimized.includes('rm -rf /var/lib/apt/lists/*')) {
        optimized = optimized.replace(
          /(RUN apt-get .*)\n/g,
          '$1 && rm -rf /var/lib/apt/lists/*\n'
        );
      }
    }

    return optimized;
  }

  /**
   * Add security hardening to Dockerfile
   */
  addSecurityHardening(dockerfile: string): string {
    let hardened = dockerfile;

    // Add security labels
    const labels = `# Security labels\n` +
      `LABEL security.scan="enabled" \\\n` +
      `      maintainer="RTPI Security Team"\n\n`;

    hardened = labels + hardened;

    // Ensure non-root user if not present
    if (!hardened.includes('USER ')) {
      const userSetup = `# Create non-root user\n` +
        `RUN useradd -m -u 1000 tooluser\n` +
        `USER tooluser\n\n`;

      // Insert before ENTRYPOINT
      hardened = hardened.replace(
        /(ENTRYPOINT|CMD)/,
        userSetup + '$1'
      );
    }

    return hardened;
  }
}

// Export singleton instance
export const dockerfileGenerator = new ToolDockerfileGenerator();
```

**Usage Example:**

```typescript
import { githubToolAnalyzer } from './github-tool-analyzer';
import { dockerfileGenerator } from './tool-dockerfile-generator';

// Analyze repository
const analysis = await githubToolAnalyzer.analyzeRepository(
  'https://github.com/projectdiscovery/nuclei'
);

// Generate Dockerfile
const dockerfile = dockerfileGenerator.generateDockerfile(analysis, {
  useMultiStage: true,
  nonRootUser: true,
  includeHealthcheck: true,
  optimizeSize: true
});

// Optimize for size
const optimizedDockerfile = dockerfileGenerator.optimizeForSize(dockerfile);

// Add security hardening
const secureDockerfile = dockerfileGenerator.addSecurityHardening(optimizedDockerfile);

console.log(secureDockerfile);
```

**Key Features:**
- Multi-language support (Python, Node, Go, Rust, Generic)
- Multi-stage builds for minimal image size
- Security best practices (non-root user, minimal base images)
- Dependency caching for faster builds
- Alpine/Debian base image options
- Binary stripping and optimization
- Security hardening capabilities
- APT to APK package conversion
- Custom base image support

#### C. Auto-Installer Service

**File:** `server/services/tool-auto-installer.ts`

Complete orchestration service that automates the entire tool installation workflow from GitHub URL to production-ready Docker container.

```typescript
import Docker from 'dockerode';
import { db } from '@/db';
import { securityTools, toolInstallationLogs } from '@/shared/schema';
import { githubToolAnalyzer, type ToolAnalysis } from './github-tool-analyzer';
import { dockerfileGenerator } from './tool-dockerfile-generator';
import type { ToolConfiguration } from '@/shared/types/tool-config';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface InstallOptions {
  skipTests?: boolean;
  customConfig?: Partial<ToolConfiguration>;
  dockerOptions?: {
    useMultiStage?: boolean;
    nonRootUser?: boolean;
    optimizeSize?: boolean;
  };
  userId?: string;
}

export interface InstallResult {
  success: boolean;
  toolId?: string;
  dockerImage?: string;
  analysis?: ToolAnalysis;
  buildLog?: string;
  testResults?: TestResult[];
  error?: string;
  installationLogId?: string;
}

export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  output?: string;
  error?: string;
}

export interface InstallProgress {
  stage: 'analyzing' | 'generating' | 'building' | 'testing' | 'registering' | 'updating' | 'complete';
  message: string;
  progress: number; // 0-100
  details?: any;
}

/**
 * Tool Auto-Installer Service
 *
 * Orchestrates the complete tool installation workflow:
 * 1. Analyze GitHub repository
 * 2. Generate Dockerfile
 * 3. Build Docker image
 * 4. Test installation
 * 5. Register in database
 * 6. Update rtpi-tools container
 */
export class ToolAutoInstaller {
  private docker: Docker;
  private progressCallbacks: Map<string, (progress: InstallProgress) => void>;

  constructor() {
    this.docker = new Docker();
    this.progressCallbacks = new Map();
  }

  /**
   * Main installation method
   * Orchestrates the complete workflow with progress tracking
   */
  async installTool(
    githubUrl: string,
    options: InstallOptions = {}
  ): Promise<InstallResult> {
    const installId = this.generateInstallId();
    const result: InstallResult = {
      success: false
    };

    try {
      // Create installation log
      const [logEntry] = await db.insert(toolInstallationLogs).values({
        githubUrl,
        status: 'in_progress',
        installedBy: options.userId
      }).returning();

      result.installationLogId = logEntry.id;

      // Stage 1: Analyze repository
      this.updateProgress(installId, {
        stage: 'analyzing',
        message: 'Analyzing GitHub repository...',
        progress: 10
      });

      const analysis = await githubToolAnalyzer.analyzeRepository(githubUrl);
      result.analysis = analysis;

      this.updateProgress(installId, {
        stage: 'analyzing',
        message: `Repository analyzed: ${analysis.name} (${analysis.primaryLanguage})`,
        progress: 20,
        details: { language: analysis.primaryLanguage, dependencies: Object.keys(analysis.dependencies) }
      });

      // Update log with analysis
      await db.update(toolInstallationLogs)
        .set({ analysisResult: analysis as any })
        .where(eq(toolInstallationLogs.id, logEntry.id));

      // Stage 2: Generate Dockerfile
      this.updateProgress(installId, {
        stage: 'generating',
        message: 'Generating Dockerfile...',
        progress: 30
      });

      const dockerfile = dockerfileGenerator.generateDockerfile(analysis, {
        useMultiStage: options.dockerOptions?.useMultiStage ?? true,
        nonRootUser: options.dockerOptions?.nonRootUser ?? true,
        optimizeSize: options.dockerOptions?.optimizeSize ?? true
      });

      // Optimize and harden
      const optimizedDockerfile = dockerfileGenerator.optimizeForSize(dockerfile);
      const secureDockerfile = dockerfileGenerator.addSecurityHardening(optimizedDockerfile);

      this.updateProgress(installId, {
        stage: 'generating',
        message: 'Dockerfile generated successfully',
        progress: 40
      });

      // Stage 3: Build Docker image
      this.updateProgress(installId, {
        stage: 'building',
        message: 'Building Docker image...',
        progress: 50
      });

      const buildResult = await this.buildDockerImage(
        githubUrl,
        analysis.name,
        secureDockerfile,
        installId
      );

      result.dockerImage = buildResult.imageName;
      result.buildLog = buildResult.buildLog;

      this.updateProgress(installId, {
        stage: 'building',
        message: `Image built successfully: ${buildResult.imageName}`,
        progress: 70
      });

      // Update log with build result
      await db.update(toolInstallationLogs)
        .set({ buildLog: buildResult.buildLog })
        .where(eq(toolInstallationLogs.id, logEntry.id));

      // Stage 4: Test installation (if not skipped)
      if (!options.skipTests) {
        this.updateProgress(installId, {
          stage: 'testing',
          message: 'Testing tool installation...',
          progress: 75
        });

        const testResults = await this.testToolInstallation(
          buildResult.imageName,
          analysis
        );

        result.testResults = testResults;

        const allTestsPassed = testResults.every(t => t.passed);
        if (!allTestsPassed) {
          throw new Error('Installation tests failed');
        }

        this.updateProgress(installId, {
          stage: 'testing',
          message: `All tests passed (${testResults.length}/${testResults.length})`,
          progress: 85
        });

        // Update log with test results
        await db.update(toolInstallationLogs)
          .set({ testOutput: JSON.stringify(testResults) })
          .where(eq(toolInstallationLogs.id, logEntry.id));
      }

      // Stage 5: Register in database
      this.updateProgress(installId, {
        stage: 'registering',
        message: 'Registering tool in database...',
        progress: 90
      });

      const toolConfig: Partial<ToolConfiguration> = {
        ...analysis.suggestedConfig,
        ...options.customConfig,
        githubUrl,
        dockerImage: buildResult.imageName,
        dockerfile: secureDockerfile
      };

      const [tool] = await db.insert(securityTools).values({
        name: toolConfig.name!,
        description: toolConfig.description!,
        category: toolConfig.category!,
        configuration: toolConfig as any,
        dockerImage: buildResult.imageName,
        githubUrl,
        dockerfile: secureDockerfile,
        installMethod: analysis.installInstructions.method,
        isActive: true,
        createdBy: options.userId
      }).returning();

      result.toolId = tool.id;

      this.updateProgress(installId, {
        stage: 'registering',
        message: `Tool registered: ${tool.name}`,
        progress: 95
      });

      // Stage 6: Update rtpi-tools container (optional)
      this.updateProgress(installId, {
        stage: 'updating',
        message: 'Updating rtpi-tools container...',
        progress: 97
      });

      await this.updateRtpiToolsContainer(buildResult.imageName);

      // Mark as complete
      this.updateProgress(installId, {
        stage: 'complete',
        message: 'Installation complete!',
        progress: 100
      });

      // Update log as successful
      await db.update(toolInstallationLogs)
        .set({ status: 'completed' })
        .where(eq(toolInstallationLogs.id, logEntry.id));

      result.success = true;
      return result;

    } catch (error: any) {
      console.error('Tool installation failed:', error);

      result.error = error.message;

      // Update log as failed
      if (result.installationLogId) {
        await db.update(toolInstallationLogs)
          .set({
            status: 'failed',
            errorMessage: error.message
          })
          .where(eq(toolInstallationLogs.id, result.installationLogId));
      }

      this.updateProgress(installId, {
        stage: 'complete',
        message: `Installation failed: ${error.message}`,
        progress: 100
      });

      return result;
    }
  }

  /**
   * Build Docker image from Dockerfile
   */
  private async buildDockerImage(
    githubUrl: string,
    toolName: string,
    dockerfile: string,
    installId: string
  ): Promise<{ imageName: string; buildLog: string }> {
    // Create temporary build context
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rtpi-tool-'));
    const dockerfilePath = path.join(tempDir, 'Dockerfile');
    const buildLog: string[] = [];

    try {
      // Write Dockerfile
      await fs.writeFile(dockerfilePath, dockerfile);

      // Clone repository
      this.updateProgress(installId, {
        stage: 'building',
        message: 'Cloning repository...',
        progress: 52
      });

      await this.cloneRepository(githubUrl, tempDir);

      // Build image
      const imageName = `rtpi-tools/${toolName.toLowerCase()}:latest`;

      this.updateProgress(installId, {
        stage: 'building',
        message: 'Building Docker image (this may take several minutes)...',
        progress: 55
      });

      const stream = await this.docker.buildImage({
        context: tempDir,
        src: ['.']
      }, {
        t: imageName,
        rm: true, // Remove intermediate containers
        forcerm: true, // Always remove intermediate containers
        pull: true // Always pull newer base images
      });

      // Capture build output
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err: any, res: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }, (event: any) => {
          if (event.stream) {
            buildLog.push(event.stream);

            // Update progress based on build steps
            if (event.stream.includes('Step ')) {
              const match = event.stream.match(/Step (\d+)\/(\d+)/);
              if (match) {
                const current = parseInt(match[1]);
                const total = parseInt(match[2]);
                const progress = 55 + Math.floor((current / total) * 10);

                this.updateProgress(installId, {
                  stage: 'building',
                  message: `Building... Step ${current}/${total}`,
                  progress
                });
              }
            }
          }
        });
      });

      return {
        imageName,
        buildLog: buildLog.join('')
      };

    } finally {
      // Cleanup temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Failed to cleanup temp directory:', err);
      }
    }
  }

  /**
   * Clone GitHub repository to local directory
   */
  private async cloneRepository(githubUrl: string, targetDir: string): Promise<void> {
    const { execSync } = require('child_process');

    try {
      // Use shallow clone for faster downloads
      execSync(`git clone --depth 1 ${githubUrl} ${targetDir}`, {
        stdio: 'pipe',
        timeout: 300000 // 5 minutes timeout
      });
    } catch (error: any) {
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Test tool installation by running basic checks
   */
  private async testToolInstallation(
    imageName: string,
    analysis: ToolAnalysis
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test 1: Container starts successfully
    const startTest = await this.testContainerStart(imageName);
    results.push(startTest);

    // Test 2: Binary/entrypoint exists
    if (analysis.entryPoints.length > 0) {
      const entrypointTest = await this.testEntrypoint(imageName, analysis.entryPoints[0]);
      results.push(entrypointTest);
    }

    // Test 3: Version command (if available)
    const versionTest = await this.testVersionCommand(imageName);
    results.push(versionTest);

    // Test 4: Help command
    const helpTest = await this.testHelpCommand(imageName);
    results.push(helpTest);

    return results;
  }

  /**
   * Test if container starts successfully
   */
  private async testContainerStart(imageName: string): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const container = await this.docker.createContainer({
        Image: imageName,
        Cmd: ['--help'],
        Tty: false,
        AttachStdout: true,
        AttachStderr: true
      });

      await container.start();
      await container.wait({ condition: 'not-running' });
      await container.remove();

      return {
        testName: 'Container Start',
        passed: true,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        testName: 'Container Start',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Test if entrypoint exists in container
   */
  private async testEntrypoint(imageName: string, entrypoint: string): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const container = await this.docker.createContainer({
        Image: imageName,
        Cmd: ['test', '-f', entrypoint],
        Tty: false
      });

      await container.start();
      const result = await container.wait({ condition: 'not-running' });
      await container.remove();

      return {
        testName: 'Entrypoint Exists',
        passed: result.StatusCode === 0,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        testName: 'Entrypoint Exists',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Test version command
   */
  private async testVersionCommand(imageName: string): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const container = await this.docker.createContainer({
        Image: imageName,
        Cmd: ['--version'],
        Tty: false,
        AttachStdout: true,
        AttachStderr: true
      });

      await container.start();
      const result = await container.wait({ condition: 'not-running' });

      // Get output
      const stream = await container.logs({
        stdout: true,
        stderr: true
      });

      await container.remove();

      return {
        testName: 'Version Command',
        passed: result.StatusCode === 0,
        duration: Date.now() - startTime,
        output: stream.toString()
      };
    } catch (error: any) {
      return {
        testName: 'Version Command',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Test help command
   */
  private async testHelpCommand(imageName: string): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const container = await this.docker.createContainer({
        Image: imageName,
        Cmd: ['--help'],
        Tty: false,
        AttachStdout: true,
        AttachStderr: true
      });

      await container.start();
      const result = await container.wait({ condition: 'not-running' });

      // Get output
      const stream = await container.logs({
        stdout: true,
        stderr: true
      });

      await container.remove();

      return {
        testName: 'Help Command',
        passed: result.StatusCode === 0,
        duration: Date.now() - startTime,
        output: stream.toString()
      };
    } catch (error: any) {
      return {
        testName: 'Help Command',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Update rtpi-tools container to include new tool
   * This rebuilds the rtpi-tools container with the new tool layer
   */
  private async updateRtpiToolsContainer(toolImage: string): Promise<void> {
    try {
      // Check if rtpi-tools container exists
      const containers = await this.docker.listContainers({ all: true });
      const rtpiTools = containers.find(c => c.Names.some(name => name.includes('rtpi-tools')));

      if (rtpiTools) {
        // Tag the new tool image
        const image = this.docker.getImage(toolImage);
        await image.tag({
          repo: 'rtpi-tools',
          tag: `tool-${Date.now()}`
        });

        // TODO: Implement container layer merging or volume mounting
        // For now, tools are independent containers
        console.log(`Tool image ${toolImage} tagged for rtpi-tools integration`);
      }
    } catch (error: any) {
      console.error('Failed to update rtpi-tools container:', error);
      // Non-fatal error - tool is still installed
    }
  }

  /**
   * Register progress callback
   */
  onProgress(installId: string, callback: (progress: InstallProgress) => void): void {
    this.progressCallbacks.set(installId, callback);
  }

  /**
   * Update and emit progress
   */
  private updateProgress(installId: string, progress: InstallProgress): void {
    const callback = this.progressCallbacks.get(installId);
    if (callback) {
      callback(progress);
    }
  }

  /**
   * Generate unique installation ID
   */
  private generateInstallId(): string {
    return `install-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Rollback installation on failure
   */
  async rollback(installId: string, result: Partial<InstallResult>): Promise<void> {
    try {
      // Remove Docker image if created
      if (result.dockerImage) {
        const image = this.docker.getImage(result.dockerImage);
        await image.remove({ force: true });
      }

      // Remove database entry if created
      if (result.toolId) {
        await db.delete(securityTools).where(eq(securityTools.id, result.toolId));
      }

      console.log(`Rolled back installation: ${installId}`);
    } catch (error) {
      console.error('Rollback failed:', error);
    }
  }
}

// Export singleton instance
export const toolAutoInstaller = new ToolAutoInstaller();
```

**Usage Example:**

```typescript
import { toolAutoInstaller } from './tool-auto-installer';

// Install with progress tracking
const installId = 'install-' + Date.now();

toolAutoInstaller.onProgress(installId, (progress) => {
  console.log(`[${progress.stage}] ${progress.message} - ${progress.progress}%`);
});

const result = await toolAutoInstaller.installTool(
  'https://github.com/projectdiscovery/nuclei',
  {
    userId: currentUser.id,
    skipTests: false,
    dockerOptions: {
      useMultiStage: true,
      nonRootUser: true,
      optimizeSize: true
    }
  }
);

if (result.success) {
  console.log('Tool installed successfully!');
  console.log('Tool ID:', result.toolId);
  console.log('Docker Image:', result.dockerImage);
} else {
  console.error('Installation failed:', result.error);
}
```

**Key Features:**
- Complete 6-stage workflow orchestration
- Real-time progress tracking
- Docker image building with dockerode
- Automated testing (container start, entrypoint, version, help)
- Database registration
- Error handling and rollback
- Installation logging
- rtpi-tools container integration
- Temporary build context management
- Git repository cloning
- Build output capture

### Implementation Checklist
- [ ] Create GitHub analyzer service
- [ ] Implement language detection
- [ ] Add dependency parser for Python, Node, Go, Rust
- [ ] Create Dockerfile generator
- [ ] Implement Docker build process
- [ ] Add installation testing
- [ ] Create tool registration
- [ ] Update rtpi-tools container
- [ ] Build UI components
- [ ] Add error handling

### Estimated Effort
5-6 days

---

## Tool Testing Framework

### Status: 🔴 Tier 1 - High Priority

### Description
Comprehensive testing framework for validating tool installations and ensuring they work correctly before use.

### Test Suite Structure
```typescript
interface ToolTest {
  toolId: string;
  testName: string;
  testTarget: string; // Safe target for testing
  expectedOutput: {
    minPorts?: number;
    services?: string[];
    shouldSucceed: boolean;
    outputPattern?: RegExp;
  };
  timeout: number;
}

// Run test suite for a tool
async function testTool(toolId: string): Promise<ToolTestResult[]> {
  // Execute predefined tests
  // Validate outputs
  // Return pass/fail results
}
```

### Pre-defined Tests

The pre-defined test framework provides standardized test suites for common security tools. Each test suite validates installation correctness, functionality, output format compliance, and error handling.

#### Test Suite Structure

```typescript
interface ToolTestSuite {
  toolId: string;
  toolName: string;
  tests: ToolTest[];
  safeTargets: SafeTestTarget[];
}

interface ToolTest {
  testId: string;
  testName: string;
  category: 'installation' | 'functionality' | 'output_format' | 'error_handling';
  target: string;
  command: string[];
  expectedOutput: TestExpectation;
  timeout: number;
  requiresNetwork: boolean;
  description: string;
}

interface TestExpectation {
  exitCode?: number | number[];
  outputPattern?: RegExp;
  outputContains?: string[];
  outputNotContains?: string[];
  jsonValid?: boolean;
  xmlValid?: boolean;
  minOutputLength?: number;
  maxOutputLength?: number;
  customValidator?: (output: string, stderr: string, exitCode: number) => ValidationResult;
}

interface SafeTestTarget {
  name: string;
  url: string;
  type: 'scanner_test' | 'xss_playground' | 'vulnerable_app' | 'honeypot';
  description: string;
  allowedTools: string[];
}

interface ValidationResult {
  valid: boolean;
  message?: string;
  details?: any;
}
```

#### Safe Test Targets Registry

```typescript
// Safe, intentionally vulnerable targets for testing
export const SAFE_TEST_TARGETS: SafeTestTarget[] = [
  {
    name: 'Scanme Nmap',
    url: 'scanme.nmap.org',
    type: 'scanner_test',
    description: 'Official Nmap test server - safe for port scanning',
    allowedTools: ['nmap', 'masscan', 'rustscan']
  },
  {
    name: 'TestPHP Vulnweb',
    url: 'http://testphp.vulnweb.com',
    type: 'vulnerable_app',
    description: 'Acunetix test application for web vulnerability scanning',
    allowedTools: ['nuclei', 'sqlmap', 'xsstrike', 'nikto', 'wpscan']
  },
  {
    name: 'Example Domain',
    url: 'example.com',
    type: 'scanner_test',
    description: 'IANA example domain for DNS/subdomain enumeration',
    allowedTools: ['bbot', 'amass', 'subfinder', 'assetfinder']
  },
  {
    name: 'XSS Game',
    url: 'https://xss-game.appspot.com',
    type: 'xss_playground',
    description: 'Google XSS challenge - safe for XSS testing',
    allowedTools: ['xsstrike', 'dalfox']
  }
];
```

#### Tool Test Suites

##### Nmap Test Suite

```typescript
const NMAP_TEST_SUITE: ToolTestSuite = {
  toolId: 'nmap',
  toolName: 'Nmap',
  safeTargets: [SAFE_TEST_TARGETS[0]], // scanme.nmap.org
  tests: [
    {
      testId: 'nmap_install_check',
      testName: 'Installation Verification',
      category: 'installation',
      target: '',
      command: ['nmap', '--version'],
      expectedOutput: {
        exitCode: 0,
        outputPattern: /Nmap version \d+\.\d+/,
        outputContains: ['Nmap', 'version']
      },
      timeout: 5000,
      requiresNetwork: false,
      description: 'Verify Nmap is installed and reports version'
    },
    {
      testId: 'nmap_basic_scan',
      testName: 'Basic Port Scan',
      category: 'functionality',
      target: 'scanme.nmap.org',
      command: ['nmap', '-p', '22,80,443', '-Pn', 'scanme.nmap.org'],
      expectedOutput: {
        exitCode: 0,
        outputPattern: /Nmap scan report for/,
        outputContains: ['PORT', 'STATE', 'SERVICE'],
        minOutputLength: 100
      },
      timeout: 30000,
      requiresNetwork: true,
      description: 'Scan common ports on safe target'
    },
    {
      testId: 'nmap_xml_output',
      testName: 'XML Output Format',
      category: 'output_format',
      target: 'scanme.nmap.org',
      command: ['nmap', '-p', '22,80', '-oX', '-', 'scanme.nmap.org'],
      expectedOutput: {
        exitCode: 0,
        xmlValid: true,
        outputPattern: /<nmaprun/,
        outputContains: ['<?xml', '<host>', '<ports>']
      },
      timeout: 30000,
      requiresNetwork: true,
      description: 'Verify XML output is well-formed'
    },
    {
      testId: 'nmap_invalid_target',
      testName: 'Error Handling - Invalid Target',
      category: 'error_handling',
      target: 'invalid.invalid.invalid',
      command: ['nmap', '-p', '80', 'invalid.invalid.invalid'],
      expectedOutput: {
        exitCode: [0, 1, 2], // Nmap may exit 0 with warnings or 2 for errors
        outputPattern: /(Failed to resolve|ERROR|WARNING)/i
      },
      timeout: 15000,
      requiresNetwork: true,
      description: 'Handle invalid hostname gracefully'
    }
  ]
};
```

##### Nuclei Test Suite

```typescript
const NUCLEI_TEST_SUITE: ToolTestSuite = {
  toolId: 'nuclei',
  toolName: 'Nuclei',
  safeTargets: [SAFE_TEST_TARGETS[1]], // testphp.vulnweb.com
  tests: [
    {
      testId: 'nuclei_install_check',
      testName: 'Installation Verification',
      category: 'installation',
      target: '',
      command: ['nuclei', '-version'],
      expectedOutput: {
        exitCode: 0,
        outputPattern: /Nuclei \d+\.\d+\.\d+/
      },
      timeout: 5000,
      requiresNetwork: false,
      description: 'Verify Nuclei is installed'
    },
    {
      testId: 'nuclei_template_list',
      testName: 'Template Loading',
      category: 'functionality',
      target: '',
      command: ['nuclei', '-tl'],
      expectedOutput: {
        exitCode: 0,
        outputContains: ['templates', 'loaded'],
        minOutputLength: 50
      },
      timeout: 10000,
      requiresNetwork: false,
      description: 'Verify templates can be listed'
    },
    {
      testId: 'nuclei_json_output',
      testName: 'JSON Output Format',
      category: 'output_format',
      target: 'http://testphp.vulnweb.com',
      command: ['nuclei', '-u', 'http://testphp.vulnweb.com', '-t', 'http/misconfiguration/', '-json'],
      expectedOutput: {
        jsonValid: true,
        customValidator: (output: string) => {
          try {
            const lines = output.trim().split('\n').filter(l => l.trim());
            for (const line of lines) {
              const obj = JSON.parse(line);
              if (!obj.template_id || !obj.info) {
                return { valid: false, message: 'Invalid Nuclei JSON structure' };
              }
            }
            return { valid: true };
          } catch (e) {
            return { valid: false, message: 'JSON parsing failed' };
          }
        }
      },
      timeout: 60000,
      requiresNetwork: true,
      description: 'Verify JSON output format with severity tags'
    }
  ]
};
```

##### BBOT Test Suite

```typescript
const BBOT_TEST_SUITE: ToolTestSuite = {
  toolId: 'bbot',
  toolName: 'BBOT',
  safeTargets: [SAFE_TEST_TARGETS[2]], // example.com
  tests: [
    {
      testId: 'bbot_install_check',
      testName: 'Installation Verification',
      category: 'installation',
      target: '',
      command: ['bbot', '--version'],
      expectedOutput: {
        exitCode: 0,
        outputPattern: /bbot \d+\.\d+\.\d+/
      },
      timeout: 5000,
      requiresNetwork: false,
      description: 'Verify BBOT is installed'
    },
    {
      testId: 'bbot_subdomain_enum',
      testName: 'Subdomain Enumeration',
      category: 'functionality',
      target: 'example.com',
      command: ['bbot', '-t', 'example.com', '-f', 'subdomain-enum', '--json'],
      expectedOutput: {
        exitCode: 0,
        jsonValid: true,
        outputContains: ['DNS_NAME', 'example.com'],
        minOutputLength: 50,
        customValidator: (output: string) => {
          const events = output.trim().split('\n').filter(l => l.includes('DNS_NAME'));
          if (events.length > 0) {
            return { valid: true, details: { eventsFound: events.length } };
          }
          return { valid: false, message: 'No DNS_NAME events found' };
        }
      },
      timeout: 120000,
      requiresNetwork: true,
      description: 'Enumerate subdomains and verify JSON output'
    }
  ]
};
```

##### XSStrike Test Suite

```typescript
const XSSTRIKE_TEST_SUITE: ToolTestSuite = {
  toolId: 'xsstrike',
  toolName: 'XSStrike',
  safeTargets: [SAFE_TEST_TARGETS[1]], // testphp.vulnweb.com
  tests: [
    {
      testId: 'xsstrike_install_check',
      testName: 'Installation Verification',
      category: 'installation',
      target: '',
      command: ['python3', '/app/xsstrike.py', '--help'],
      expectedOutput: {
        exitCode: 0,
        outputContains: ['XSStrike', 'usage']
      },
      timeout: 5000,
      requiresNetwork: false,
      description: 'Verify XSStrike is accessible'
    },
    {
      testId: 'xsstrike_basic_scan',
      testName: 'Basic XSS Detection',
      category: 'functionality',
      target: 'http://testphp.vulnweb.com/search.php?test=query',
      command: ['python3', '/app/xsstrike.py', '-u', 'http://testphp.vulnweb.com/search.php?test=query'],
      expectedOutput: {
        exitCode: 0,
        outputPattern: /(Reflections found|parameter|testing)/i,
        minOutputLength: 50
      },
      timeout: 60000,
      requiresNetwork: true,
      description: 'Test XSS detection on safe vulnerable target'
    }
  ]
};
```

#### Test Execution Service

```typescript
export class ToolTestExecutor {
  private docker: Docker;

  constructor(docker: Docker) {
    this.docker = docker;
  }

  async executeTestSuite(
    toolConfig: ToolConfiguration,
    testSuite: ToolTestSuite,
    options: { skipNetworkTests?: boolean } = {}
  ): Promise<TestSuiteResult> {
    const results: ToolTestResult[] = [];

    for (const test of testSuite.tests) {
      if (options.skipNetworkTests && test.requiresNetwork) {
        results.push({
          testId: test.testId,
          testName: test.testName,
          status: 'skipped',
          reason: 'Network tests disabled'
        });
        continue;
      }

      const result = await this.executeTest(toolConfig, test);
      results.push(result);
    }

    return {
      toolId: testSuite.toolId,
      toolName: testSuite.toolName,
      timestamp: new Date().toISOString(),
      results,
      summary: this.generateSummary(results)
    };
  }

  private async executeTest(
    toolConfig: ToolConfiguration,
    test: ToolTest
  ): Promise<ToolTestResult> {
    const startTime = Date.now();

    try {
      const container = await this.docker.createContainer({
        Image: toolConfig.dockerImage!,
        Cmd: test.command,
        NetworkMode: test.requiresNetwork ? 'bridge' : 'none',
        HostConfig: {
          AutoRemove: true,
          Memory: 512 * 1024 * 1024, // 512MB limit for tests
          CpuShares: 512
        }
      });

      await container.start();

      const output = await this.waitForContainer(container, test.timeout);
      const duration = Date.now() - startTime;

      const validation = this.validateOutput(output, test.expectedOutput);

      return {
        testId: test.testId,
        testName: test.testName,
        category: test.category,
        status: validation.valid ? 'passed' : 'failed',
        duration,
        output: output.stdout,
        stderr: output.stderr,
        exitCode: output.exitCode,
        validationMessage: validation.message,
        validationDetails: validation.details
      };

    } catch (error: any) {
      return {
        testId: test.testId,
        testName: test.testName,
        category: test.category,
        status: 'error',
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private validateOutput(
    output: { stdout: string; stderr: string; exitCode: number },
    expected: TestExpectation
  ): ValidationResult {
    // Exit code validation
    if (expected.exitCode !== undefined) {
      const expectedCodes = Array.isArray(expected.exitCode)
        ? expected.exitCode
        : [expected.exitCode];

      if (!expectedCodes.includes(output.exitCode)) {
        return {
          valid: false,
          message: `Exit code ${output.exitCode} not in expected: ${expectedCodes.join(', ')}`
        };
      }
    }

    const combinedOutput = output.stdout + output.stderr;

    // Pattern validation
    if (expected.outputPattern && !expected.outputPattern.test(combinedOutput)) {
      return {
        valid: false,
        message: `Output does not match pattern: ${expected.outputPattern}`
      };
    }

    // Contains validation
    if (expected.outputContains) {
      for (const str of expected.outputContains) {
        if (!combinedOutput.includes(str)) {
          return {
            valid: false,
            message: `Output missing expected string: "${str}"`
          };
        }
      }
    }

    // Not contains validation
    if (expected.outputNotContains) {
      for (const str of expected.outputNotContains) {
        if (combinedOutput.includes(str)) {
          return {
            valid: false,
            message: `Output contains forbidden string: "${str}"`
          };
        }
      }
    }

    // JSON validation
    if (expected.jsonValid) {
      try {
        JSON.parse(output.stdout);
      } catch {
        return { valid: false, message: 'Output is not valid JSON' };
      }
    }

    // XML validation
    if (expected.xmlValid) {
      if (!output.stdout.trim().startsWith('<?xml') && !output.stdout.includes('<nmaprun')) {
        return { valid: false, message: 'Output is not valid XML' };
      }
    }

    // Length validation
    if (expected.minOutputLength && combinedOutput.length < expected.minOutputLength) {
      return {
        valid: false,
        message: `Output too short: ${combinedOutput.length} < ${expected.minOutputLength}`
      };
    }

    if (expected.maxOutputLength && combinedOutput.length > expected.maxOutputLength) {
      return {
        valid: false,
        message: `Output too long: ${combinedOutput.length} > ${expected.maxOutputLength}`
      };
    }

    // Custom validator
    if (expected.customValidator) {
      return expected.customValidator(output.stdout, output.stderr, output.exitCode);
    }

    return { valid: true, message: 'All validations passed' };
  }

  private generateSummary(results: ToolTestResult[]): TestSummary {
    return {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      errors: results.filter(r => r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0)
    };
  }

  private async waitForContainer(
    container: Docker.Container,
    timeout: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        container.kill().catch(() => {});
        reject(new Error(`Test timeout after ${timeout}ms`));
      }, timeout);

      container.wait((err, data) => {
        clearTimeout(timer);
        if (err) {
          reject(err);
          return;
        }

        container.logs({ stdout: true, stderr: true }, (logErr, stream) => {
          if (logErr) {
            reject(logErr);
            return;
          }

          let stdout = '';
          let stderr = '';

          stream.on('data', (chunk) => {
            const str = chunk.toString();
            if (chunk[0] === 1) stdout += str.slice(8); // stdout stream
            else if (chunk[0] === 2) stderr += str.slice(8); // stderr stream
          });

          stream.on('end', () => {
            resolve({
              stdout,
              stderr,
              exitCode: data.StatusCode
            });
          });
        });
      });
    });
  }
}

// Export all test suites
export const TOOL_TEST_SUITES: Record<string, ToolTestSuite> = {
  nmap: NMAP_TEST_SUITE,
  nuclei: NUCLEI_TEST_SUITE,
  bbot: BBOT_TEST_SUITE,
  xsstrike: XSSTRIKE_TEST_SUITE
};
```

#### Test Result Interfaces

```typescript
interface ToolTestResult {
  testId: string;
  testName: string;
  category?: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration?: number;
  output?: string;
  stderr?: string;
  exitCode?: number;
  validationMessage?: string;
  validationDetails?: any;
  error?: string;
  reason?: string;
}

interface TestSuiteResult {
  toolId: string;
  toolName: string;
  timestamp: string;
  results: ToolTestResult[];
  summary: TestSummary;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
  totalDuration: number;
}
```

This comprehensive test framework provides:
- Standardized test suites for nmap, nuclei, BBOT, and XSStrike
- Safe, authorized test targets
- Multiple validation methods (exit codes, patterns, JSON/XML, custom validators)
- Timeout handling and error recovery
- Network isolation for non-network tests
- Detailed result reporting and aggregation

### UI Components
```
┌─────────────────────────────────────────────────────────────────┐
│ Tool Testing - Nmap                                              │
├─────────────────────────────────────────────────────────────────┤
│ Test Name              Status      Duration    Details           │
│ ─────────────────────────────────────────────────────────────── │
│ Basic Scan             ✅ Pass      2.3s        22 ports found   │
│ Service Detection      ✅ Pass      4.1s        SSH, HTTP OK     │
│ Invalid Target         ✅ Pass      0.1s        Error handled    │
│ Timeout Handling       🚧 Running   --          In progress...   │
│                                                                  │
│ Overall: 3/3 passing                          [Run All Tests]    │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Checklist
- [ ] Create test framework service
- [ ] Define test suites for core tools
- [ ] Implement test execution
- [ ] Add result validation
- [ ] Create testing UI
- [ ] Add test history logging
- [ ] Implement automated testing on tool updates

### Estimated Effort
3-4 days

---

## Agent-Tool Assignment & Validation

### Status: 🔴 Tier 1 - High Priority

### Description
Validate that tools assigned to agents are properly configured, accessible, and compatible.

### Validation Checks

The Agent-Tool Validation system ensures tools assigned to agents are properly configured, accessible, and compatible before task execution. It performs comprehensive checks and provides auto-fix suggestions for common issues.

#### Validation Service Implementation

```typescript
import Docker from 'dockerode';
import { db } from '../db';
import { agents, securityTools, agentWorkflows } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

export interface ValidationCheck {
  checkId: string;
  checkName: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  details?: any;
  autoFixAvailable?: boolean;
  autoFixAction?: () => Promise<void>;
}

export interface ToolValidationResult {
  toolId: string;
  toolName: string;
  agentId: string;
  agentName: string;
  overallStatus: 'valid' | 'invalid' | 'warning';
  timestamp: string;
  checks: ValidationCheck[];
  recommendations: string[];
}

export class AgentToolValidator {
  private docker: Docker;
  private validationCache: Map<string, { result: ToolValidationResult; timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(docker: Docker) {
    this.docker = docker;
    this.validationCache = new Map();
  }

  /**
   * Validate a tool for a specific agent
   */
  async validateToolForAgent(
    agentId: string,
    toolId: string,
    options: { skipCache?: boolean; skipNetworkChecks?: boolean } = {}
  ): Promise<ToolValidationResult> {
    const cacheKey = `${agentId}:${toolId}`;

    // Check cache
    if (!options.skipCache) {
      const cached = this.validationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.result;
      }
    }

    // Fetch agent and tool info
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    const [tool] = await db.select().from(securityTools).where(eq(securityTools.id, toolId)).limit(1);

    if (!agent || !tool) {
      throw new Error('Agent or tool not found');
    }

    const checks: ValidationCheck[] = [];

    // Run all validation checks
    checks.push(await this.checkToolAvailability(tool));
    checks.push(await this.checkAgentPermissions(agent, tool));
    checks.push(await this.checkToolDependencies(tool));
    checks.push(await this.checkToolCompatibility(agent, tool));
    checks.push(await this.checkToolConfiguration(tool));

    if (!options.skipNetworkChecks) {
      checks.push(await this.checkNetworkAccess(tool));
    }

    // Determine overall status
    const failedChecks = checks.filter(c => c.status === 'failed');
    const warningChecks = checks.filter(c => c.status === 'warning');

    let overallStatus: 'valid' | 'invalid' | 'warning';
    if (failedChecks.length > 0) {
      overallStatus = 'invalid';
    } else if (warningChecks.length > 0) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'valid';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(checks);

    const result: ToolValidationResult = {
      toolId: tool.id,
      toolName: tool.name,
      agentId: agent.id,
      agentName: agent.name,
      overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      recommendations
    };

    // Cache result
    this.validationCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  }

  /**
   * Check 1: Tool Availability - Verify tool is installed and accessible
   */
  private async checkToolAvailability(tool: any): Promise<ValidationCheck> {
    try {
      if (!tool.dockerImage) {
        return {
          checkId: 'tool_availability',
          checkName: 'Tool Availability',
          status: 'failed',
          message: 'Tool does not have a Docker image configured',
          autoFixAvailable: false
        };
      }

      // Check if Docker image exists
      const images = await this.docker.listImages({
        filters: { reference: [tool.dockerImage] }
      });

      if (images.length === 0) {
        // Image not found - offer to pull it
        return {
          checkId: 'tool_availability',
          checkName: 'Tool Availability',
          status: 'failed',
          message: `Docker image "${tool.dockerImage}" not found locally`,
          autoFixAvailable: true,
          autoFixAction: async () => {
            await this.docker.pull(tool.dockerImage);
          },
          details: {
            suggestedAction: `Pull image: docker pull ${tool.dockerImage}`
          }
        };
      }

      // Verify image is not corrupted by running basic command
      const container = await this.docker.createContainer({
        Image: tool.dockerImage,
        Cmd: ['echo', 'test'],
        HostConfig: { AutoRemove: true, NetworkMode: 'none' }
      });

      await container.start();
      await container.wait();

      return {
        checkId: 'tool_availability',
        checkName: 'Tool Availability',
        status: 'passed',
        message: `Tool "${tool.name}" is available and accessible`,
        details: {
          dockerImage: tool.dockerImage,
          imageId: images[0].Id
        }
      };

    } catch (error: any) {
      return {
        checkId: 'tool_availability',
        checkName: 'Tool Availability',
        status: 'failed',
        message: `Failed to verify tool availability: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Check 2: Permission Check - Ensure agent has permissions to run tool
   */
  private async checkAgentPermissions(agent: any, tool: any): Promise<ValidationCheck> {
    try {
      // Check if agent has required capabilities
      const requiredCapabilities = tool.requiresSudo
        ? ['NET_ADMIN', 'NET_RAW', 'SYS_ADMIN']
        : [];

      if (requiredCapabilities.length > 0) {
        const agentCapabilities = agent.capabilities || [];
        const missingCapabilities = requiredCapabilities.filter(
          cap => !agentCapabilities.includes(cap)
        );

        if (missingCapabilities.length > 0) {
          return {
            checkId: 'agent_permissions',
            checkName: 'Agent Permissions',
            status: 'failed',
            message: `Agent missing required capabilities: ${missingCapabilities.join(', ')}`,
            autoFixAvailable: true,
            autoFixAction: async () => {
              await db.update(agents)
                .set({
                  capabilities: [...agentCapabilities, ...missingCapabilities]
                })
                .where(eq(agents.id, agent.id));
            },
            details: {
              required: requiredCapabilities,
              missing: missingCapabilities
            }
          };
        }
      }

      // Check RBAC permissions
      const agentRole = agent.role || 'operator';
      const toolRequiredRole = tool.minimumRole || 'operator';

      const roleHierarchy: Record<string, number> = {
        viewer: 1,
        operator: 2,
        admin: 3
      };

      if (roleHierarchy[agentRole] < roleHierarchy[toolRequiredRole]) {
        return {
          checkId: 'agent_permissions',
          checkName: 'Agent Permissions',
          status: 'failed',
          message: `Agent role "${agentRole}" insufficient for tool (requires "${toolRequiredRole}")`,
          autoFixAvailable: false,
          details: {
            agentRole,
            requiredRole: toolRequiredRole
          }
        };
      }

      return {
        checkId: 'agent_permissions',
        checkName: 'Agent Permissions',
        status: 'passed',
        message: 'Agent has sufficient permissions to run this tool',
        details: { agentRole, requiredRole: toolRequiredRole }
      };

    } catch (error: any) {
      return {
        checkId: 'agent_permissions',
        checkName: 'Agent Permissions',
        status: 'failed',
        message: `Permission check failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Check 3: Dependency Check - Validate all dependencies are met
   */
  private async checkToolDependencies(tool: any): Promise<ValidationCheck> {
    try {
      const config = tool.configuration ? JSON.parse(tool.configuration) : {};
      const dependencies = config.dependencies || [];

      if (dependencies.length === 0) {
        return {
          checkId: 'tool_dependencies',
          checkName: 'Tool Dependencies',
          status: 'passed',
          message: 'No external dependencies required'
        };
      }

      const missingDeps: string[] = [];

      // Check each dependency
      for (const dep of dependencies) {
        const [depTool] = await db.select()
          .from(securityTools)
          .where(eq(securityTools.name, dep))
          .limit(1);

        if (!depTool) {
          missingDeps.push(dep);
        }
      }

      if (missingDeps.length > 0) {
        return {
          checkId: 'tool_dependencies',
          checkName: 'Tool Dependencies',
          status: 'warning',
          message: `Missing optional dependencies: ${missingDeps.join(', ')}`,
          details: {
            required: dependencies,
            missing: missingDeps
          }
        };
      }

      return {
        checkId: 'tool_dependencies',
        checkName: 'Tool Dependencies',
        status: 'passed',
        message: 'All dependencies are met',
        details: { dependencies }
      };

    } catch (error: any) {
      return {
        checkId: 'tool_dependencies',
        checkName: 'Tool Dependencies',
        status: 'failed',
        message: `Dependency check failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Check 4: Compatibility Check - Confirm tool supports agent's target types
   */
  private async checkToolCompatibility(agent: any, tool: any): Promise<ValidationCheck> {
    try {
      const config = tool.configuration ? JSON.parse(tool.configuration) : {};
      const supportedTargetTypes = config.supportedTargetTypes || [];
      const agentTargetTypes = agent.supportedTargets || ['ip', 'domain', 'url'];

      if (supportedTargetTypes.length === 0) {
        return {
          checkId: 'tool_compatibility',
          checkName: 'Tool Compatibility',
          status: 'warning',
          message: 'Tool does not specify supported target types',
          details: { agentTargetTypes }
        };
      }

      // Check if there's any overlap
      const compatibleTypes = agentTargetTypes.filter((type: string) =>
        supportedTargetTypes.includes(type)
      );

      if (compatibleTypes.length === 0) {
        return {
          checkId: 'tool_compatibility',
          checkName: 'Tool Compatibility',
          status: 'failed',
          message: 'No compatible target types between agent and tool',
          details: {
            agentTargets: agentTargetTypes,
            toolTargets: supportedTargetTypes
          }
        };
      }

      return {
        checkId: 'tool_compatibility',
        checkName: 'Tool Compatibility',
        status: 'passed',
        message: `Compatible target types: ${compatibleTypes.join(', ')}`,
        details: {
          compatibleTypes,
          agentTargets: agentTargetTypes,
          toolTargets: supportedTargetTypes
        }
      };

    } catch (error: any) {
      return {
        checkId: 'tool_compatibility',
        checkName: 'Tool Compatibility',
        status: 'failed',
        message: `Compatibility check failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Check 5: Configuration Check - Validate tool parameters are correct
   */
  private async checkToolConfiguration(tool: any): Promise<ValidationCheck> {
    try {
      const config = tool.configuration ? JSON.parse(tool.configuration) : {};

      // Validate required configuration fields
      const requiredFields = ['command', 'outputFormat'];
      const missingFields = requiredFields.filter(field => !config[field]);

      if (missingFields.length > 0) {
        return {
          checkId: 'tool_configuration',
          checkName: 'Tool Configuration',
          status: 'failed',
          message: `Missing required configuration fields: ${missingFields.join(', ')}`,
          details: { missingFields }
        };
      }

      // Validate parameters schema
      const parameters = config.parameters || [];
      const invalidParams = parameters.filter((param: any) => {
        return !param.name || !param.type || !param.description;
      });

      if (invalidParams.length > 0) {
        return {
          checkId: 'tool_configuration',
          checkName: 'Tool Configuration',
          status: 'warning',
          message: `${invalidParams.length} parameters missing required fields`,
          details: { invalidParams }
        };
      }

      // Check for API keys or credentials if required
      if (config.requiresApiKey && !config.apiKeyEnvVar) {
        return {
          checkId: 'tool_configuration',
          checkName: 'Tool Configuration',
          status: 'warning',
          message: 'Tool requires API key but none configured',
          autoFixAvailable: false,
          details: {
            suggestion: 'Configure API key in tool settings or environment variables'
          }
        };
      }

      return {
        checkId: 'tool_configuration',
        checkName: 'Tool Configuration',
        status: 'passed',
        message: 'Tool configuration is valid',
        details: {
          parametersCount: parameters.length,
          hasApiKey: !!config.apiKeyEnvVar
        }
      };

    } catch (error: any) {
      return {
        checkId: 'tool_configuration',
        checkName: 'Tool Configuration',
        status: 'failed',
        message: `Configuration validation failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Check 6: Network Access - Verify tool can access required networks
   */
  private async checkNetworkAccess(tool: any): Promise<ValidationCheck> {
    try {
      const config = tool.configuration ? JSON.parse(tool.configuration) : {};
      const networkMode = config.networkMode || 'bridge';

      // Test basic network connectivity
      const container = await this.docker.createContainer({
        Image: tool.dockerImage!,
        Cmd: ['ping', '-c', '1', '8.8.8.8'],
        HostConfig: {
          AutoRemove: true,
          NetworkMode: networkMode
        }
      });

      await container.start();
      const result = await container.wait();

      if (result.StatusCode !== 0) {
        return {
          checkId: 'network_access',
          checkName: 'Network Access',
          status: 'warning',
          message: 'Tool may have limited network access',
          details: {
            networkMode,
            testResult: 'Network test failed'
          }
        };
      }

      return {
        checkId: 'network_access',
        checkName: 'Network Access',
        status: 'passed',
        message: 'Tool has network access',
        details: { networkMode }
      };

    } catch (error: any) {
      return {
        checkId: 'network_access',
        checkName: 'Network Access',
        status: 'skipped',
        message: 'Network check skipped or failed',
        details: { error: error.message }
      };
    }
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(checks: ValidationCheck[]): string[] {
    const recommendations: string[] = [];

    for (const check of checks) {
      if (check.status === 'failed') {
        if (check.autoFixAvailable) {
          recommendations.push(
            `${check.checkName}: ${check.message} - Auto-fix available`
          );
        } else {
          recommendations.push(
            `${check.checkName}: ${check.message} - Manual intervention required`
          );
        }
      } else if (check.status === 'warning') {
        recommendations.push(
          `${check.checkName}: ${check.message} - Consider addressing this warning`
        );
      }
    }

    return recommendations;
  }

  /**
   * Apply all available auto-fixes for a validation result
   */
  async applyAutoFixes(validationResult: ToolValidationResult): Promise<{
    applied: number;
    failed: number;
    results: Array<{ checkId: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ checkId: string; success: boolean; error?: string }> = [];
    let applied = 0;
    let failed = 0;

    for (const check of validationResult.checks) {
      if (check.autoFixAvailable && check.autoFixAction) {
        try {
          await check.autoFixAction();
          results.push({ checkId: check.checkId, success: true });
          applied++;
        } catch (error: any) {
          results.push({
            checkId: check.checkId,
            success: false,
            error: error.message
          });
          failed++;
        }
      }
    }

    return { applied, failed, results };
  }

  /**
   * Validate all tools for an agent
   */
  async validateAllToolsForAgent(agentId: string): Promise<ToolValidationResult[]> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    if (!agent) {
      throw new Error('Agent not found');
    }

    const assignedTools = agent.assignedTools ? JSON.parse(agent.assignedTools) : [];
    const results: ToolValidationResult[] = [];

    for (const toolId of assignedTools) {
      const result = await this.validateToolForAgent(agentId, toolId);
      results.push(result);
    }

    return results;
  }

  /**
   * Clear validation cache
   */
  clearCache(agentId?: string, toolId?: string): void {
    if (agentId && toolId) {
      this.validationCache.delete(`${agentId}:${toolId}`);
    } else if (agentId) {
      for (const key of this.validationCache.keys()) {
        if (key.startsWith(`${agentId}:`)) {
          this.validationCache.delete(key);
        }
      }
    } else {
      this.validationCache.clear();
    }
  }
}
```

#### Integration with Agent Workflow

```typescript
// Example: Validate tools before starting agent workflow
export async function validateAgentBeforeWorkflow(
  agentId: string,
  workflowId: string
): Promise<{ valid: boolean; issues: string[] }> {
  const validator = new AgentToolValidator(new Docker());

  const validationResults = await validator.validateAllToolsForAgent(agentId);

  const invalidTools = validationResults.filter(r => r.overallStatus === 'invalid');
  const issues: string[] = [];

  if (invalidTools.length > 0) {
    for (const result of invalidTools) {
      issues.push(`Tool "${result.toolName}": ${result.checks.find(c => c.status === 'failed')?.message}`);
    }

    return { valid: false, issues };
  }

  return { valid: true, issues: [] };
}
```

This validation system provides:
- **Comprehensive checks**: 6 validation checks covering availability, permissions, dependencies, compatibility, configuration, and network access
- **Auto-fix capabilities**: Automatically resolve common issues like pulling missing Docker images or adding required capabilities
- **Performance optimization**: 5-minute validation cache to reduce redundant checks
- **Detailed reporting**: Clear status messages, recommendations, and actionable details
- **Workflow integration**: Pre-execution validation to prevent failures during agent operations

### UI Components
```
┌─────────────────────────────────────────────────────────────────┐
│ Agent Tool Configuration - [Agent Name]                          │
├─────────────────────────────────────────────────────────────────┤
│ Assigned Tools:                                                  │
│                                                                  │
│ ☑ Nmap                   ✅ Validated    [Test] [Configure]     │
│ ☑ BBOT                   ⚠️  Warning     [Test] [Configure]     │
│   └─ Missing API key for full functionality                     │
│ ☐ XSStrike               ⏸️  Not tested  [Test] [Configure]     │
│ ☑ Metasploit             ✅ Validated    [Test] [Configure]     │
│                                                                  │
│ [+ Add Tool]  [Test All]  [Save]                                │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Checklist
- [ ] Create validation service
- [ ] Implement availability checks
- [ ] Add permission validation
- [ ] Test tool execution
- [ ] Create validation UI
- [ ] Add warning/error displays
- [ ] Implement auto-fix suggestions

### Estimated Effort
2-3 days

---

## Tool Registry & Management

### Status: 🟡 Tier 2 - Medium Priority

### Description
Centralized registry for all tools with version tracking, health checks, and usage analytics.

### Features

The Tool Registry provides a centralized catalog for all security tools with comprehensive version tracking, health monitoring, usage analytics, and intelligent recommendations.

#### Tool Registry Service

```typescript
import { db } from '../db';
import { securityTools, agents, workflowTasks } from '../shared/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import Docker from 'dockerode';

export interface ToolRegistryEntry {
  id: string;
  name: string;
  category: string;
  version: string;
  dockerImage?: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastHealthCheck?: string;
  usageCount: number;
  lastUsed?: string;
  averageExecutionTime?: number;
  successRate?: number;
  tags: string[];
  deprecated: boolean;
  replacedBy?: string;
}

export interface ToolVersionInfo {
  toolId: string;
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  changelog?: string;
  releaseDate?: string;
}

export interface ToolUsageStats {
  toolId: string;
  toolName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastUsed: string;
  topAgents: Array<{ agentId: string; agentName: string; usageCount: number }>;
  targetTypeDistribution: Record<string, number>;
}

export class ToolRegistryManager {
  private docker: Docker;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(docker: Docker) {
    this.docker = docker;
  }

  /**
   * Get all tools from registry with enriched metadata
   */
  async getAllTools(filters?: {
    category?: string;
    healthStatus?: string;
    searchQuery?: string;
    deprecated?: boolean;
  }): Promise<ToolRegistryEntry[]> {
    let query = db.select().from(securityTools);

    // Apply filters
    const conditions = [];
    if (filters?.category) {
      conditions.push(eq(securityTools.category, filters.category));
    }
    if (filters?.deprecated !== undefined) {
      conditions.push(eq(securityTools.deprecated || sql`false`, filters.deprecated));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const tools = await query;

    // Enrich with health and usage data
    const enrichedTools = await Promise.all(
      tools.map(async (tool) => {
        const usageStats = await this.getToolUsageStats(tool.id);

        return {
          id: tool.id,
          name: tool.name,
          category: tool.category,
          version: tool.version || 'unknown',
          dockerImage: tool.dockerImage,
          healthStatus: (tool.healthStatus as any) || 'unknown',
          lastHealthCheck: tool.lastHealthCheck,
          usageCount: usageStats?.totalExecutions || 0,
          lastUsed: usageStats?.lastUsed,
          averageExecutionTime: usageStats?.averageDuration,
          successRate: usageStats
            ? (usageStats.successfulExecutions / usageStats.totalExecutions) * 100
            : undefined,
          tags: tool.tags ? JSON.parse(tool.tags) : [],
          deprecated: (tool.deprecated as boolean) || false,
          replacedBy: tool.replacedBy
        };
      })
    );

    // Apply search filter
    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      return enrichedTools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(query) ||
          tool.category.toLowerCase().includes(query) ||
          tool.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply health status filter
    if (filters?.healthStatus) {
      return enrichedTools.filter((tool) => tool.healthStatus === filters.healthStatus);
    }

    return enrichedTools;
  }

  /**
   * Get version information for a tool
   */
  async getToolVersionInfo(toolId: string): Promise<ToolVersionInfo | null> {
    const [tool] = await db.select().from(securityTools).where(eq(securityTools.id, toolId)).limit(1);

    if (!tool || !tool.dockerImage) {
      return null;
    }

    // Check current version
    const currentVersion = tool.version || 'unknown';

    // Check for updates on Docker Hub (simplified - would use registry API in production)
    let latestVersion: string | undefined;
    let updateAvailable = false;

    try {
      // In production, query Docker registry API for latest tag
      // For now, we'll check if :latest tag exists
      const [imageName, currentTag] = tool.dockerImage.split(':');

      if (currentTag && currentTag !== 'latest') {
        latestVersion = 'latest'; // Placeholder
        updateAvailable = true;
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }

    return {
      toolId: tool.id,
      currentVersion,
      latestVersion,
      updateAvailable,
      changelog: undefined, // Would fetch from repository in production
      releaseDate: tool.updatedAt
    };
  }

  /**
   * Perform health check on a tool
   */
  async performHealthCheck(toolId: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{ name: string; passed: boolean; message: string }>;
  }> {
    const [tool] = await db.select().from(securityTools).where(eq(securityTools.id, toolId)).limit(1);

    if (!tool) {
      throw new Error('Tool not found');
    }

    const checks: Array<{ name: string; passed: boolean; message: string }> = [];

    // Check 1: Docker image availability
    try {
      if (tool.dockerImage) {
        const images = await this.docker.listImages({
          filters: { reference: [tool.dockerImage] }
        });

        checks.push({
          name: 'Docker Image',
          passed: images.length > 0,
          message: images.length > 0 ? 'Image available' : 'Image not found'
        });
      } else {
        checks.push({
          name: 'Docker Image',
          passed: false,
          message: 'No Docker image configured'
        });
      }
    } catch (error: any) {
      checks.push({
        name: 'Docker Image',
        passed: false,
        message: `Check failed: ${error.message}`
      });
    }

    // Check 2: Container startup test
    if (tool.dockerImage) {
      try {
        const container = await this.docker.createContainer({
          Image: tool.dockerImage,
          Cmd: ['echo', 'healthcheck'],
          HostConfig: { AutoRemove: true, NetworkMode: 'none' }
        });

        await container.start();
        const result = await container.wait({ condition: 'not-running' });

        checks.push({
          name: 'Container Startup',
          passed: result.StatusCode === 0,
          message: result.StatusCode === 0 ? 'Container starts successfully' : 'Startup failed'
        });
      } catch (error: any) {
        checks.push({
          name: 'Container Startup',
          passed: false,
          message: `Startup test failed: ${error.message}`
        });
      }
    }

    // Check 3: Recent usage success rate
    const usageStats = await this.getToolUsageStats(toolId);
    if (usageStats && usageStats.totalExecutions > 0) {
      const successRate = (usageStats.successfulExecutions / usageStats.totalExecutions) * 100;
      checks.push({
        name: 'Success Rate',
        passed: successRate >= 70,
        message: `${successRate.toFixed(1)}% success rate (${usageStats.totalExecutions} executions)`
      });
    }

    // Determine overall health status
    const passedChecks = checks.filter((c) => c.passed).length;
    const totalChecks = checks.length;
    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (passedChecks === totalChecks) {
      status = 'healthy';
    } else if (passedChecks >= totalChecks / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    // Update database
    await db.update(securityTools)
      .set({
        healthStatus: status,
        lastHealthCheck: new Date().toISOString()
      })
      .where(eq(securityTools.id, toolId));

    return { status, checks };
  }

  /**
   * Get usage statistics for a tool
   */
  async getToolUsageStats(toolId: string): Promise<ToolUsageStats | null> {
    // Query workflow tasks to get usage data
    const tasks = await db.select()
      .from(workflowTasks)
      .where(eq(workflowTasks.toolId, toolId))
      .orderBy(desc(workflowTasks.createdAt));

    if (tasks.length === 0) {
      return null;
    }

    const totalExecutions = tasks.length;
    const successfulExecutions = tasks.filter((t) => t.status === 'completed').length;
    const failedExecutions = tasks.filter((t) => t.status === 'failed').length;

    // Calculate average duration (in seconds)
    const completedTasks = tasks.filter((t) => t.completedAt && t.startedAt);
    const averageDuration = completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => {
          const duration = new Date(t.completedAt!).getTime() - new Date(t.startedAt!).getTime();
          return sum + duration / 1000;
        }, 0) / completedTasks.length
      : 0;

    const lastUsed = tasks[0].createdAt;

    // Get top agents using this tool
    const agentUsage = new Map<string, { name: string; count: number }>();
    for (const task of tasks) {
      const current = agentUsage.get(task.agentId) || { name: '', count: 0 };
      current.count++;
      agentUsage.set(task.agentId, current);
    }

    // Fetch agent names
    const topAgents = await Promise.all(
      Array.from(agentUsage.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(async ([agentId, data]) => {
          const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
          return {
            agentId,
            agentName: agent?.name || 'Unknown',
            usageCount: data.count
          };
        })
    );

    // Target type distribution (would need to join with targets table in production)
    const targetTypeDistribution: Record<string, number> = {
      ip: 0,
      domain: 0,
      url: 0,
      network: 0
    };

    const [tool] = await db.select().from(securityTools).where(eq(securityTools.id, toolId)).limit(1);

    return {
      toolId,
      toolName: tool?.name || 'Unknown',
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageDuration,
      lastUsed,
      topAgents,
      targetTypeDistribution
    };
  }

  /**
   * Get tool recommendations based on target type and operation context
   */
  async getToolRecommendations(criteria: {
    targetType: string;
    operationType: 'reconnaissance' | 'exploitation' | 'post_exploitation';
    excludeDeprecated?: boolean;
  }): Promise<ToolRegistryEntry[]> {
    const allTools = await this.getAllTools({
      deprecated: criteria.excludeDeprecated ? false : undefined
    });

    // Filter by target type compatibility
    const compatibleTools = allTools.filter((tool) => {
      const config = tool.dockerImage ? JSON.parse('{}') : {}; // Would parse actual config
      const supportedTargets = config.supportedTargetTypes || [];
      return supportedTargets.length === 0 || supportedTargets.includes(criteria.targetType);
    });

    // Filter by operation type (category mapping)
    const categoryMap: Record<string, string[]> = {
      reconnaissance: ['reconnaissance', 'network_scanning', 'enumeration'],
      exploitation: ['exploitation', 'web_security', 'vulnerability_scanning'],
      post_exploitation: ['post_exploitation', 'auxiliary']
    };

    const relevantCategories = categoryMap[criteria.operationType] || [];
    const filteredTools = compatibleTools.filter((tool) =>
      relevantCategories.includes(tool.category)
    );

    // Sort by success rate and usage
    return filteredTools.sort((a, b) => {
      const aScore = (a.successRate || 0) * 0.7 + (a.usageCount || 0) * 0.3;
      const bScore = (b.successRate || 0) * 0.7 + (b.usageCount || 0) * 0.3;
      return bScore - aScore;
    });
  }

  /**
   * Mark a tool as deprecated and suggest replacement
   */
  async deprecateTool(toolId: string, replacementToolId?: string): Promise<void> {
    await db.update(securityTools)
      .set({
        deprecated: true,
        replacedBy: replacementToolId,
        updatedAt: new Date().toISOString()
      })
      .where(eq(securityTools.id, toolId));
  }

  /**
   * Start periodic health checks for all tools
   */
  startPeriodicHealthChecks(intervalMinutes: number = 60): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const tools = await db.select().from(securityTools);

      for (const tool of tools) {
        try {
          await this.performHealthCheck(tool.id);
        } catch (error) {
          console.error(`Health check failed for tool ${tool.name}:`, error);
        }
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
```

This registry system provides:
- **Centralized catalog**: Complete tool inventory with metadata, health status, and usage statistics
- **Version tracking**: Monitor current versions and check for updates
- **Health monitoring**: Automated health checks with multi-criteria validation (image availability, startup tests, success rates)
- **Usage analytics**: Track execution counts, success rates, average durations, and top-using agents
- **Intelligent recommendations**: Suggest tools based on target type, operation context, and historical performance
- **Deprecation workflow**: Mark tools as deprecated and suggest replacements
- **Periodic monitoring**: Automated health checks run at configurable intervals

### Implementation Checklist
- [ ] Create tool registry service
- [ ] Implement version tracking
- [ ] Add health check system
- [ ] Track usage analytics
- [ ] Create catalog UI
- [ ] Add search and filtering

### Estimated Effort
3 days

---

## Output Parsing System

### Status: 🟡 Tier 2 - Medium Priority

### Description
Unified output parsing system to handle different tool output formats and extract structured data.

### Supported Formats
- Text (unstructured)
- JSON
- XML
- CSV
- Custom formats

### Parser Implementation

The Output Parsing System provides a unified framework for handling diverse tool output formats. It includes built-in parsers for common formats, a plugin system for custom parsers, and transformation pipelines for structured data extraction.

```typescript
// server/services/tool-output-parser.ts

import { XMLParser } from 'fast-xml-parser';
import { parse as parseCSV } from 'csv-parse/sync';
import { db } from '../db';
import { securityTools } from '../shared/schema';
import { eq } from 'drizzle-orm';

export interface ParsedOutput {
  format: string;
  data: any;
  findings?: Finding[];
  metadata?: Record<string, any>;
  errors?: string[];
}

export interface Finding {
  type: 'vulnerability' | 'service' | 'subdomain' | 'port' | 'credential' | 'file';
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description?: string;
  target: string;
  details: Record<string, any>;
  references?: string[];
}

export interface OutputParser {
  format: string;
  parse(rawOutput: string, options?: any): ParsedOutput;
  validate(rawOutput: string): { valid: boolean; errors?: string[] };
  extractFindings?(parsedData: any): Finding[];
}

export class ToolOutputParser {
  private parsers: Map<string, OutputParser>;
  private toolSpecificParsers: Map<string, OutputParser>;

  constructor() {
    this.parsers = new Map();
    this.toolSpecificParsers = new Map();
    this.registerBuiltInParsers();
  }

  /**
   * Parse tool output based on tool configuration
   */
  async parse(
    toolId: string,
    rawOutput: string,
    options?: { extractFindings?: boolean }
  ): Promise<ParsedOutput> {
    // Get tool configuration
    const [tool] = await db.select().from(securityTools).where(eq(securityTools.id, toolId)).limit(1);

    if (!tool) {
      throw new Error('Tool not found');
    }

    const config = tool.configuration ? JSON.parse(tool.configuration) : {};
    const outputFormat = config.outputFormat || 'text';

    // Check for tool-specific parser first
    let parser = this.toolSpecificParsers.get(tool.name.toLowerCase());

    // Fall back to generic format parser
    if (!parser) {
      parser = this.parsers.get(outputFormat);
    }

    if (!parser) {
      throw new Error(`No parser registered for format: ${outputFormat}`);
    }

    // Validate output
    const validation = parser.validate(rawOutput);
    if (!validation.valid) {
      return {
        format: outputFormat,
        data: null,
        errors: validation.errors
      };
    }

    // Parse output
    const parsedOutput = parser.parse(rawOutput, { toolConfig: config });

    // Extract findings if requested
    if (options?.extractFindings && parser.extractFindings) {
      parsedOutput.findings = parser.extractFindings(parsedOutput.data);
    }

    return parsedOutput;
  }

  /**
   * Register built-in parsers
   */
  private registerBuiltInParsers(): void {
    this.registerParser(new JSONParser());
    this.registerParser(new XMLParser());
    this.registerParser(new CSVParser());
    this.registerParser(new TextParser());

    // Tool-specific parsers
    this.registerToolParser('nmap', new NmapXMLParser());
    this.registerToolParser('nuclei', new NucleiJSONParser());
    this.registerToolParser('bbot', new BBOTJSONParser());
  }

  /**
   * Register a format parser
   */
  registerParser(parser: OutputParser): void {
    this.parsers.set(parser.format, parser);
  }

  /**
   * Register a tool-specific parser
   */
  registerToolParser(toolName: string, parser: OutputParser): void {
    this.toolSpecificParsers.set(toolName.toLowerCase(), parser);
  }

  /**
   * Get available parsers
   */
  getAvailableParsers(): string[] {
    return Array.from(this.parsers.keys());
  }
}

/**
 * JSON Parser
 */
export class JSONParser implements OutputParser {
  format = 'json';

  parse(rawOutput: string): ParsedOutput {
    try {
      const data = JSON.parse(rawOutput);
      return {
        format: this.format,
        data,
        metadata: {
          entryCount: Array.isArray(data) ? data.length : 1
        }
      };
    } catch (error: any) {
      return {
        format: this.format,
        data: null,
        errors: [`JSON parsing failed: ${error.message}`]
      };
    }
  }

  validate(rawOutput: string): { valid: boolean; errors?: string[] } {
    try {
      JSON.parse(rawOutput);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Invalid JSON: ${error.message}`]
      };
    }
  }
}

/**
 * XML Parser
 */
export class XMLParser implements OutputParser {
  format = 'xml';
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    });
  }

  parse(rawOutput: string): ParsedOutput {
    try {
      const data = this.xmlParser.parse(rawOutput);
      return {
        format: this.format,
        data
      };
    } catch (error: any) {
      return {
        format: this.format,
        data: null,
        errors: [`XML parsing failed: ${error.message}`]
      };
    }
  }

  validate(rawOutput: string): { valid: boolean; errors?: string[] } {
    try {
      this.xmlParser.parse(rawOutput);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Invalid XML: ${error.message}`]
      };
    }
  }
}

/**
 * CSV Parser
 */
export class CSVParser implements OutputParser {
  format = 'csv';

  parse(rawOutput: string): ParsedOutput {
    try {
      const data = parseCSV(rawOutput, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      return {
        format: this.format,
        data,
        metadata: {
          rowCount: data.length,
          columns: data.length > 0 ? Object.keys(data[0]) : []
        }
      };
    } catch (error: any) {
      return {
        format: this.format,
        data: null,
        errors: [`CSV parsing failed: ${error.message}`]
      };
    }
  }

  validate(rawOutput: string): { valid: boolean; errors?: string[] } {
    try {
      parseCSV(rawOutput);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Invalid CSV: ${error.message}`]
      };
    }
  }
}

/**
 * Text Parser (regex-based)
 */
export class TextParser implements OutputParser {
  format = 'text';

  parse(rawOutput: string, options?: { toolConfig?: any }): ParsedOutput {
    const lines = rawOutput.split('\n').filter((line) => line.trim());

    // Apply custom patterns if provided
    const patterns = options?.toolConfig?.outputPatterns || [];
    const extractedData: Record<string, any>[] = [];

    for (const line of lines) {
      const lineData: Record<string, any> = { raw: line };

      for (const pattern of patterns) {
        const regex = new RegExp(pattern.regex);
        const match = line.match(regex);

        if (match && pattern.fields) {
          pattern.fields.forEach((field: string, index: number) => {
            lineData[field] = match[index + 1];
          });
        }
      }

      extractedData.push(lineData);
    }

    return {
      format: this.format,
      data: extractedData.length > 0 ? extractedData : { raw: rawOutput },
      metadata: {
        lineCount: lines.length
      }
    };
  }

  validate(rawOutput: string): { valid: boolean } {
    // Text is always valid
    return { valid: true };
  }
}

/**
 * Nmap XML Parser (tool-specific)
 */
export class NmapXMLParser implements OutputParser {
  format = 'xml';
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }

  parse(rawOutput: string): ParsedOutput {
    const data = this.xmlParser.parse(rawOutput);

    return {
      format: this.format,
      data,
      metadata: {
        scanInfo: data.nmaprun?.scaninfo,
        hostsCount: Array.isArray(data.nmaprun?.host)
          ? data.nmaprun.host.length
          : data.nmaprun?.host
          ? 1
          : 0
      }
    };
  }

  validate(rawOutput: string): { valid: boolean; errors?: string[] } {
    if (!rawOutput.includes('<nmaprun')) {
      return { valid: false, errors: ['Not a valid Nmap XML output'] };
    }

    try {
      this.xmlParser.parse(rawOutput);
      return { valid: true };
    } catch (error: any) {
      return { valid: false, errors: [error.message] };
    }
  }

  extractFindings(parsedData: any): Finding[] {
    const findings: Finding[] = [];
    const hosts = Array.isArray(parsedData.nmaprun?.host)
      ? parsedData.nmaprun.host
      : parsedData.nmaprun?.host
      ? [parsedData.nmaprun.host]
      : [];

    for (const host of hosts) {
      const address = host.address?.['@_addr'] || 'unknown';
      const ports = Array.isArray(host.ports?.port)
        ? host.ports.port
        : host.ports?.port
        ? [host.ports.port]
        : [];

      for (const port of ports) {
        if (port.state?.['@_state'] === 'open') {
          findings.push({
            type: 'port',
            severity: 'info',
            title: `Open Port: ${port['@_portid']}/${port['@_protocol']}`,
            target: address,
            details: {
              port: port['@_portid'],
              protocol: port['@_protocol'],
              service: port.service?.['@_name'],
              version: port.service?.['@_version']
            }
          });
        }
      }
    }

    return findings;
  }
}

/**
 * Nuclei JSON Parser (tool-specific)
 */
export class NucleiJSONParser implements OutputParser {
  format = 'json';

  parse(rawOutput: string): ParsedOutput {
    // Nuclei outputs JSON lines
    const lines = rawOutput.trim().split('\n').filter((l) => l.trim());
    const results = lines.map((line) => JSON.parse(line));

    return {
      format: this.format,
      data: results,
      metadata: {
        resultCount: results.length
      }
    };
  }

  validate(rawOutput: string): { valid: boolean; errors?: string[] } {
    try {
      const lines = rawOutput.trim().split('\n').filter((l) => l.trim());
      for (const line of lines) {
        JSON.parse(line);
      }
      return { valid: true };
    } catch (error: any) {
      return { valid: false, errors: [error.message] };
    }
  }

  extractFindings(parsedData: any[]): Finding[] {
    return parsedData.map((result) => ({
      type: 'vulnerability',
      severity: result.info?.severity?.toLowerCase() || 'info',
      title: result.info?.name || 'Unknown Vulnerability',
      description: result.info?.description,
      target: result.host || 'unknown',
      details: {
        templateId: result.template_id,
        matcher: result.matcher_name,
        extractedData: result.extracted_results,
        tags: result.info?.tags
      },
      references: result.info?.reference
    }));
  }
}

/**
 * BBOT JSON Parser (tool-specific)
 */
export class BBOTJSONParser implements OutputParser {
  format = 'json';

  parse(rawOutput: string): ParsedOutput {
    // BBOT outputs JSON lines
    const lines = rawOutput.trim().split('\n').filter((l) => l.trim());
    const events = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((e) => e !== null);

    return {
      format: this.format,
      data: events,
      metadata: {
        eventCount: events.length,
        eventTypes: [...new Set(events.map((e) => e.type))]
      }
    };
  }

  validate(rawOutput: string): { valid: boolean; errors?: string[] } {
    try {
      const lines = rawOutput.trim().split('\n').filter((l) => l.trim());
      if (lines.length === 0) {
        return { valid: false, errors: ['Empty output'] };
      }

      for (const line of lines) {
        JSON.parse(line);
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, errors: [error.message] };
    }
  }

  extractFindings(parsedData: any[]): Finding[] {
    const findings: Finding[] = [];

    for (const event of parsedData) {
      if (event.type === 'DNS_NAME') {
        findings.push({
          type: 'subdomain',
          severity: 'info',
          title: `Subdomain Discovered: ${event.data}`,
          target: event.data,
          details: {
            source: event.source,
            tags: event.tags
          }
        });
      } else if (event.type === 'VULNERABILITY') {
        findings.push({
          type: 'vulnerability',
          severity: event.severity || 'medium',
          title: event.description || 'Vulnerability Found',
          target: event.host || event.data,
          details: event
        });
      }
    }

    return findings;
  }
}

// Export singleton instance
export const toolOutputParser = new ToolOutputParser();
```

This comprehensive parsing system provides:
- **Multi-format support**: Built-in parsers for JSON, XML, CSV, and text
- **Tool-specific parsers**: Specialized parsers for Nmap, Nuclei, and BBOT with finding extraction
- **Plugin architecture**: Easy registration of custom parsers via `registerParser()` and `registerToolParser()`
- **Validation**: Pre-parse validation to catch malformed outputs early
- **Finding extraction**: Automatic conversion of tool outputs to standardized Finding objects
- **Transformation pipelines**: Regex-based pattern extraction for text outputs
- **Error handling**: Graceful error handling with detailed error messages

### Implementation Checklist
- [ ] Create parser framework
- [ ] Implement JSON parser
- [ ] Implement XML parser
- [ ] Implement text parser (regex-based)
- [ ] Add custom parser support
- [ ] Create parser registry
- [ ] Add validation

### Estimated Effort
3-4 days

---

## rtpi-tools Container Integration

### Status: 🟡 Tier 2 - Medium Priority

### Description
Automatically update the rtpi-tools Docker container when new tools are installed.

### Integration Methods

The rtpi-tools container integration system provides multiple strategies for managing tool installations within the main runtime container. The system automatically selects the optimal method based on tool characteristics and deployment requirements.

```typescript
// server/services/rtpi-tools-container-manager.ts

import Docker from 'dockerode';
import { promises as fs } from 'fs';
import path from 'path';
import { db } from '../db';
import { securityTools } from '../shared/schema';
import { eq } from 'drizzle-orm';

export interface ContainerIntegrationStrategy {
  name: string;
  description: string;
  supportedToolTypes: string[];
  apply(toolId: string, dockerImage: string): Promise<IntegrationResult>;
  rollback(toolId: string): Promise<void>;
}

export interface IntegrationResult {
  success: boolean;
  method: string;
  imageTag?: string;
  error?: string;
  details?: any;
}

export class RTPIToolsContainerManager {
  private docker: Docker;
  private strategies: Map<string, ContainerIntegrationStrategy>;
  private readonly BASE_IMAGE = 'rtpi-tools';
  private readonly TOOLS_VOLUME = '/opt/rtpi-tools';

  constructor(docker: Docker) {
    this.docker = docker;
    this.strategies = new Map();
    this.registerStrategies();
  }

  /**
   * Register integration strategies
   */
  private registerStrategies(): void {
    this.strategies.set('layer_injection', new LayerInjectionStrategy(this.docker));
    this.strategies.set('volume_mount', new VolumeMountStrategy(this.docker, this.TOOLS_VOLUME));
    this.strategies.set('multi_stage', new MultiStageStrategy(this.docker));
  }

  /**
   * Integrate a new tool into rtpi-tools container
   */
  async integrateTool(toolId: string): Promise<IntegrationResult> {
    const [tool] = await db.select().from(securityTools).where(eq(securityTools.id, toolId)).limit(1);

    if (!tool || !tool.dockerImage) {
      throw new Error('Tool not found or missing Docker image');
    }

    const config = tool.configuration ? JSON.parse(tool.configuration) : {};

    // Determine best integration strategy
    const strategy = this.selectStrategy(config);

    console.log(`Integrating tool "${tool.name}" using strategy: ${strategy.name}`);

    try {
      const result = await strategy.apply(toolId, tool.dockerImage);

      if (result.success) {
        // Update tool record with integration info
        await db.update(securityTools)
          .set({
            containerIntegrationMethod: strategy.name,
            containerImageTag: result.imageTag,
            updatedAt: new Date().toISOString()
          })
          .where(eq(securityTools.id, toolId));
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        method: strategy.name,
        error: error.message
      };
    }
  }

  /**
   * Select optimal integration strategy based on tool configuration
   */
  private selectStrategy(config: any): ContainerIntegrationStrategy {
    // Prefer layer injection for stable, production tools
    if (config.stable && !config.requiresVolume) {
      return this.strategies.get('layer_injection')!;
    }

    // Use volume mounting for development or frequently updated tools
    if (config.development || config.requiresVolume) {
      return this.strategies.get('volume_mount')!;
    }

    // Default to multi-stage for complex builds
    return this.strategies.get('multi_stage')!;
  }

  /**
   * Rebuild rtpi-tools container with all integrated tools
   */
  async rebuildContainer(): Promise<{ success: boolean; newImageId?: string; error?: string }> {
    try {
      // Get all integrated tools
      const tools = await db.select().from(securityTools)
        .where(sql`container_integration_method IS NOT NULL`);

      // Generate Dockerfile
      const dockerfile = await this.generateDockerfile(tools);

      // Build new image
      const stream = await this.docker.buildImage(
        {
          context: path.dirname(dockerfile),
          src: [path.basename(dockerfile)]
        },
        {
          t: `${this.BASE_IMAGE}:latest`,
          labels: {
            'rtpi.tools.count': tools.length.toString(),
            'rtpi.build.timestamp': new Date().toISOString()
          }
        }
      );

      // Wait for build to complete
      const imageId = await new Promise<string>((resolve, reject) => {
        this.docker.modem.followProgress(
          stream,
          (err, res) => {
            if (err) reject(err);
            else {
              const lastMessage = res[res.length - 1];
              resolve(lastMessage.stream || '');
            }
          },
          (event) => console.log(event.stream)
        );
      });

      return { success: true, newImageId: imageId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate Dockerfile with all integrated tools
   */
  private async generateDockerfile(tools: any[]): Promise<string> {
    const toolsDir = '/tmp/rtpi-tools-build';
    await fs.mkdir(toolsDir, { recursive: true });

    const dockerfilePath = path.join(toolsDir, 'Dockerfile');

    const layers = tools
      .filter((t) => t.dockerImage)
      .map(
        (t, idx) => `
# Layer ${idx + 1}: ${t.name}
FROM ${t.dockerImage} AS tool_${idx}
COPY --from=tool_${idx} /app /opt/tools/${t.name}
`
      )
      .join('\n');

    const dockerfile = `
# Base image
FROM alpine:latest AS base
RUN apk add --no-cache bash curl git python3 py3-pip

# Tool layers
${layers}

# Final stage
FROM base AS final
WORKDIR /workspace

# Copy all tools
${tools.map((t, idx) => `COPY --from=tool_${idx} /app /opt/tools/${t.name}`).join('\n')}

# Set PATH
ENV PATH="/opt/tools/bin:$PATH"

CMD ["/bin/bash"]
`;

    await fs.writeFile(dockerfilePath, dockerfile);
    return dockerfilePath;
  }

  /**
   * Hot-reload container with new tool (no downtime)
   */
  async hotReload(toolId: string): Promise<{ success: boolean; error?: string }> {
    // Implementation would involve:
    // 1. Create new container with updated tools
    // 2. Migrate running tasks to new container
    // 3. Gracefully shutdown old container
    // 4. Start new container
    // This is a placeholder for the complex hot-reload logic
    return { success: false, error: 'Hot-reload not yet implemented' };
  }
}

/**
 * Strategy 1: Layer Injection - Build new layer for each tool
 */
class LayerInjectionStrategy implements ContainerIntegrationStrategy {
  name = 'layer_injection';
  description = 'Build a new container layer containing the tool';
  supportedToolTypes = ['stable', 'production'];

  constructor(private docker: Docker) {}

  async apply(toolId: string, dockerImage: string): Promise<IntegrationResult> {
    try {
      // Pull the tool's image
      await this.docker.pull(dockerImage);

      // Create a new image layer with the tool
      const newTag = `rtpi-tools:with-${toolId}`;

      // This is a simplified example - in production would use buildah or similar
      const dockerfile = `
FROM rtpi-tools:latest
COPY --from=${dockerImage} /app /opt/tools/${toolId}
`;

      // Build would happen here

      return {
        success: true,
        method: this.name,
        imageTag: newTag,
        details: { dockerImage }
      };
    } catch (error: any) {
      return {
        success: false,
        method: this.name,
        error: error.message
      };
    }
  }

  async rollback(toolId: string): Promise<void> {
    // Remove the layer containing this tool
    // This would involve rebuilding the image without this tool's layer
  }
}

/**
 * Strategy 2: Volume Mounting - Mount tools at runtime
 */
class VolumeMountStrategy implements ContainerIntegrationStrategy {
  name = 'volume_mount';
  description = 'Mount tool directory as volume for runtime access';
  supportedToolTypes = ['development', 'dynamic'];

  constructor(private docker: Docker, private toolsVolume: string) {}

  async apply(toolId: string, dockerImage: string): Promise<IntegrationResult> {
    try {
      // Pull the tool image
      await this.docker.pull(dockerImage);

      // Extract tool files to volume directory
      const container = await this.docker.createContainer({
        Image: dockerImage,
        Cmd: ['tar', 'c', '/app'],
        HostConfig: {
          Binds: [`${this.toolsVolume}/${toolId}:/extract`]
        }
      });

      await container.start();
      await container.wait();
      await container.remove();

      return {
        success: true,
        method: this.name,
        details: {
          volumePath: `${this.toolsVolume}/${toolId}`,
          dockerImage
        }
      };
    } catch (error: any) {
      return {
        success: false,
        method: this.name,
        error: error.message
      };
    }
  }

  async rollback(toolId: string): Promise<void> {
    // Remove the tool's volume directory
    await fs.rm(`${this.toolsVolume}/${toolId}`, { recursive: true, force: true });
  }
}

/**
 * Strategy 3: Multi-Stage Build - Complex dependency management
 */
class MultiStageStrategy implements ContainerIntegrationStrategy {
  name = 'multi_stage';
  description = 'Use multi-stage Dockerfile for complex build dependencies';
  supportedToolTypes = ['complex', 'multi_dependency'];

  constructor(private docker: Docker) {}

  async apply(toolId: string, dockerImage: string): Promise<IntegrationResult> {
    try {
      // Generate multi-stage Dockerfile
      const dockerfile = `
# Stage 1: Base
FROM alpine:latest AS base
RUN apk add --no-cache bash

# Stage 2: Tool
FROM ${dockerImage} AS tool

# Stage 3: Final
FROM base AS final
COPY --from=tool /app /opt/tools/${toolId}
`;

      // Build would happen here with this Dockerfile

      return {
        success: true,
        method: this.name,
        imageTag: `rtpi-tools:multi-${toolId}`,
        details: { dockerfile }
      };
    } catch (error: any) {
      return {
        success: false,
        method: this.name,
        error: error.message
      };
    }
  }

  async rollback(toolId: string): Promise<void> {
    // Rebuild multi-stage Dockerfile without this tool
  }
}
```

#### Method 1: Layer Injection (Recommended for Stable Tools)

**Advantages:**
- Minimal image size increase
- Fast deployment
- Immutable tool versions
- Easy rollback

**Use Cases:**
- Production-ready tools
- Tools that rarely update
- Tools without complex runtime dependencies

**Example:**
```bash
# Automatically creates new layer:
# rtpi-tools:latest → rtpi-tools:with-nmap → rtpi-tools:with-nmap-nuclei
```

#### Method 2: Volume Mounting (Recommended for Development)

**Advantages:**
- No container rebuilds required
- Easy tool updates
- Shared tools across multiple containers
- Development-friendly

**Use Cases:**
- Tools under active development
- Tools requiring frequent updates
- Custom or modified tools

**Example:**
```yaml
volumes:
  - /opt/rtpi-tools/nmap:/tools/nmap:ro
  - /opt/rtpi-tools/nuclei:/tools/nuclei:ro
```

#### Method 3: Multi-Stage Build (Recommended for Complex Tools)

**Advantages:**
- Clean separation of build and runtime dependencies
- Minimal final image size
- Reproducible builds
- Complex dependency management

**Use Cases:**
- Tools with complex build processes
- Tools requiring build-time dependencies not needed at runtime
- Tools with multiple stages (compile, package, deploy)

This container integration system provides:
- **Automatic strategy selection**: Chooses optimal method based on tool characteristics
- **Hot-reload capability**: Update tools without container downtime (where supported)
- **Rollback support**: Revert to previous tool versions
- **Layer management**: Efficiently manage Docker layers to minimize image bloat
- **Volume persistence**: Persistent tool storage across container restarts

### Implementation Checklist
- [ ] Choose integration method
- [ ] Implement container update mechanism
- [ ] Add tool layer management
- [ ] Create rebuild automation
- [ ] Test container updates
- [ ] Add rollback capability

### Estimated Effort
3 days

---

## Database Schema

### Enhanced Tools Schema

#### security_tools (Enhanced)
```sql
ALTER TABLE security_tools
ADD COLUMN github_url TEXT,
ADD COLUMN install_method TEXT,
ADD COLUMN dockerfile TEXT,
ADD COLUMN build_args JSONB,
ADD COLUMN dependencies JSONB,
ADD COLUMN test_suite JSONB;
```

#### tool_installation_logs
```sql
CREATE TABLE tool_installation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES security_tools(id) ON DELETE CASCADE,
  github_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  analysis_result JSONB,
  build_log TEXT,
  test_output TEXT,
  error_message TEXT,
  installed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### tool_test_results

Complete Drizzle ORM schema and SQL table definition for tracking tool test results:

**Drizzle ORM Schema** (`shared/schema.ts`):
```typescript
export const toolTestResults = pgTable(
  'tool_test_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id').notNull().references(() => securityTools.id, { onDelete: 'cascade' }),
    testSuiteId: varchar('test_suite_id', { length: 100 }).notNull(),
    testId: varchar('test_id', { length: 100 }).notNull(),
    testName: varchar('test_name', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(), // passed, failed, error, skipped
    category: varchar('category', { length: 50 }), // installation, functionality, output_format, error_handling
    duration: integer('duration'), // milliseconds
    output: text('output'),
    stderr: text('stderr'),
    exitCode: integer('exit_code'),
    validationMessage: text('validation_message'),
    validationDetails: jsonb('validation_details'),
    error: text('error'),
    executedBy: uuid('executed_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => ({
    toolIdIdx: index('tool_test_results_tool_id_idx').on(table.toolId),
    statusIdx: index('tool_test_results_status_idx').on(table.status),
    createdAtIdx: index('tool_test_results_created_at_idx').on(table.createdAt),
    toolStatusIdx: index('tool_test_results_tool_status_idx').on(table.toolId, table.status)
  })
);
```

**SQL Table Definition:**
```sql
CREATE TABLE tool_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES security_tools(id) ON DELETE CASCADE,
  test_suite_id VARCHAR(100) NOT NULL,
  test_id VARCHAR(100) NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('passed', 'failed', 'error', 'skipped')),
  category VARCHAR(50) CHECK (category IN ('installation', 'functionality', 'output_format', 'error_handling')),
  duration INTEGER, -- milliseconds
  output TEXT,
  stderr TEXT,
  exit_code INTEGER,
  validation_message TEXT,
  validation_details JSONB,
  error TEXT,
  executed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for query performance
CREATE INDEX tool_test_results_tool_id_idx ON tool_test_results(tool_id);
CREATE INDEX tool_test_results_status_idx ON tool_test_results(status);
CREATE INDEX tool_test_results_created_at_idx ON tool_test_results(created_at);
CREATE INDEX tool_test_results_tool_status_idx ON tool_test_results(tool_id, status);

-- Comments
COMMENT ON TABLE tool_test_results IS 'Stores test execution results for security tools';
COMMENT ON COLUMN tool_test_results.test_suite_id IS 'Identifier for the test suite (e.g., nmap, nuclei)';
COMMENT ON COLUMN tool_test_results.duration IS 'Test execution time in milliseconds';
COMMENT ON COLUMN tool_test_results.validation_details IS 'JSON object with detailed validation info';
```

### Migration File
**File:** `migrations/0009_enhance_tool_framework.sql`

Complete SQL migration for all Tool Framework enhancements:

```sql
-- Migration: 0009_enhance_tool_framework.sql
-- Description: Add comprehensive tool framework enhancements including auto-installer, testing, validation, and registry features
-- Date: 2025-01-XX
-- Author: RTPI Team

BEGIN;

-- ============================================================================
-- 1. Enhance security_tools table with new columns
-- ============================================================================

ALTER TABLE security_tools
ADD COLUMN IF NOT EXISTS github_url TEXT,
ADD COLUMN IF NOT EXISTS install_method VARCHAR(50) CHECK (install_method IN ('docker', 'binary', 'script', 'pip', 'npm', 'cargo', 'apt')),
ADD COLUMN IF NOT EXISTS dockerfile TEXT,
ADD COLUMN IF NOT EXISTS build_args JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS dependencies JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS test_suite JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS health_status VARCHAR(20) CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMP,
ADD COLUMN IF NOT EXISTS container_integration_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS container_image_tag VARCHAR(255),
ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS replaced_by UUID REFERENCES security_tools(id),
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS security_tools_github_url_idx ON security_tools(github_url);
CREATE INDEX IF NOT EXISTS security_tools_health_status_idx ON security_tools(health_status);
CREATE INDEX IF NOT EXISTS security_tools_deprecated_idx ON security_tools(deprecated);
CREATE INDEX IF NOT EXISTS security_tools_tags_idx ON security_tools USING GIN (tags);

COMMENT ON COLUMN security_tools.github_url IS 'GitHub repository URL for auto-installation';
COMMENT ON COLUMN security_tools.install_method IS 'Primary installation method';
COMMENT ON COLUMN security_tools.dockerfile IS 'Generated or custom Dockerfile for tool';
COMMENT ON COLUMN security_tools.build_args IS 'Docker build arguments (key-value pairs)';
COMMENT ON COLUMN security_tools.dependencies IS 'Array of tool dependencies';
COMMENT ON COLUMN security_tools.test_suite IS 'Predefined test configuration for tool validation';
COMMENT ON COLUMN security_tools.health_status IS 'Current health status from automated checks';
COMMENT ON COLUMN security_tools.container_integration_method IS 'Method used to integrate tool into rtpi-tools container';
COMMENT ON COLUMN security_tools.deprecated IS 'Whether tool is deprecated';
COMMENT ON COLUMN security_tools.tags IS 'Array of searchable tags';

-- ============================================================================
-- 2. Create tool_installation_logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tool_installation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES security_tools(id) ON DELETE CASCADE,
  github_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('analyzing', 'building', 'testing', 'completed', 'failed', 'rolled_back')),
  stage VARCHAR(50), -- analyze, clone, generate_dockerfile, build, test, register
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  analysis_result JSONB,
  dockerfile_content TEXT,
  build_log TEXT,
  test_output TEXT,
  error_message TEXT,
  docker_image_id VARCHAR(255),
  docker_image_tag VARCHAR(255),
  install_duration INTEGER, -- seconds
  installed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS tool_installation_logs_tool_id_idx ON tool_installation_logs(tool_id);
CREATE INDEX IF NOT EXISTS tool_installation_logs_status_idx ON tool_installation_logs(status);
CREATE INDEX IF NOT EXISTS tool_installation_logs_created_at_idx ON tool_installation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS tool_installation_logs_installed_by_idx ON tool_installation_logs(installed_by);

COMMENT ON TABLE tool_installation_logs IS 'Audit log for tool auto-installation processes';
COMMENT ON COLUMN tool_installation_logs.stage IS 'Current stage in installation pipeline';
COMMENT ON COLUMN tool_installation_logs.progress_percentage IS 'Installation progress (0-100)';
COMMENT ON COLUMN tool_installation_logs.install_duration IS 'Total installation time in seconds';

-- ============================================================================
-- 3. Create tool_test_results table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tool_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES security_tools(id) ON DELETE CASCADE,
  test_suite_id VARCHAR(100) NOT NULL,
  test_id VARCHAR(100) NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('passed', 'failed', 'error', 'skipped')),
  category VARCHAR(50) CHECK (category IN ('installation', 'functionality', 'output_format', 'error_handling')),
  duration INTEGER, -- milliseconds
  output TEXT,
  stderr TEXT,
  exit_code INTEGER,
  validation_message TEXT,
  validation_details JSONB,
  error TEXT,
  executed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS tool_test_results_tool_id_idx ON tool_test_results(tool_id);
CREATE INDEX IF NOT EXISTS tool_test_results_status_idx ON tool_test_results(status);
CREATE INDEX IF NOT EXISTS tool_test_results_created_at_idx ON tool_test_results(created_at DESC);
CREATE INDEX IF NOT EXISTS tool_test_results_tool_status_idx ON tool_test_results(tool_id, status);
CREATE INDEX IF NOT EXISTS tool_test_results_category_idx ON tool_test_results(category);

COMMENT ON TABLE tool_test_results IS 'Stores test execution results for security tools';
COMMENT ON COLUMN tool_test_results.test_suite_id IS 'Identifier for the test suite (e.g., nmap, nuclei)';
COMMENT ON COLUMN tool_test_results.duration IS 'Test execution time in milliseconds';

-- ============================================================================
-- 4. Create agent_tool_validation_cache table (optional performance optimization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_tool_validation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES security_tools(id) ON DELETE CASCADE,
  validation_result JSONB NOT NULL,
  overall_status VARCHAR(20) NOT NULL CHECK (overall_status IN ('valid', 'invalid', 'warning')),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(agent_id, tool_id)
);

CREATE INDEX IF NOT EXISTS agent_tool_validation_cache_agent_id_idx ON agent_tool_validation_cache(agent_id);
CREATE INDEX IF NOT EXISTS agent_tool_validation_cache_tool_id_idx ON agent_tool_validation_cache(tool_id);
CREATE INDEX IF NOT EXISTS agent_tool_validation_cache_expires_at_idx ON agent_tool_validation_cache(expires_at);

COMMENT ON TABLE agent_tool_validation_cache IS 'Caches agent-tool validation results for 5-minute TTL';

-- ============================================================================
-- 5. Update existing data (if needed)
-- ============================================================================

-- Mark any tools with known issues as unhealthy
UPDATE security_tools
SET health_status = 'unknown',
    last_health_check = NOW()
WHERE health_status IS NULL;

-- ============================================================================
-- 6. Create functions for automated maintenance
-- ============================================================================

-- Function to clean up expired validation cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_validation_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM agent_tool_validation_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate tool test statistics
CREATE OR REPLACE FUNCTION get_tool_test_statistics(p_tool_id UUID)
RETURNS TABLE (
  total_tests BIGINT,
  passed_tests BIGINT,
  failed_tests BIGINT,
  error_tests BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_tests,
    COUNT(*) FILTER (WHERE status = 'passed')::BIGINT AS passed_tests,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS failed_tests,
    COUNT(*) FILTER (WHERE status = 'error')::BIGINT AS error_tests,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE status = 'passed')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END AS success_rate
  FROM tool_test_results
  WHERE tool_id = p_tool_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================================================
-- Rollback instructions (for reference - run separately if needed)
-- ============================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS agent_tool_validation_cache CASCADE;
-- DROP TABLE IF EXISTS tool_test_results CASCADE;
-- DROP TABLE IF EXISTS tool_installation_logs CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS github_url CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS install_method CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS dockerfile CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS build_args CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS dependencies CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS test_suite CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS health_status CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS last_health_check CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS container_integration_method CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS container_image_tag CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS deprecated CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS replaced_by CASCADE;
-- ALTER TABLE security_tools DROP COLUMN IF EXISTS tags CASCADE;
-- DROP FUNCTION IF EXISTS cleanup_expired_validation_cache CASCADE;
-- DROP FUNCTION IF EXISTS get_tool_test_statistics CASCADE;
-- COMMIT;
```

This migration provides:
- **Schema enhancements**: 13 new columns added to security_tools table
- **New tables**: 3 new tables (tool_installation_logs, tool_test_results, agent_tool_validation_cache)
- **Indexes**: 20+ indexes for query optimization
- **Constraints**: CHECK constraints for data integrity
- **Functions**: 2 utility functions for cache cleanup and statistics
- **Comments**: Comprehensive column documentation
- **Rollback script**: Complete rollback instructions for safe migration reversal

---

## API Endpoints

### Tool Management API

#### POST /api/v1/tools/analyze-github
**Request:**
```json
{
  "githubUrl": "https://github.com/SecFathy/Bugzee"
}
```
**Response:**
```json
{
  "analysis": {
    "name": "Bugzee",
    "language": "Python",
    "dependencies": [...],
    "entrypoint": "bugzee.py"
  }
}
```

#### POST /api/v1/tools/install

**Description:** Automatically install a security tool from a GitHub repository URL using the auto-installer pipeline.

**Authentication:** Required (session or API key)

**Request:**
```typescript
interface InstallToolRequest {
  githubUrl: string;
  options?: {
    skipTests?: boolean;
    customConfig?: Partial<ToolConfiguration>;
    forceRebuild?: boolean;
  };
}
```

**Example Request:**
```json
{
  "githubUrl": "https://github.com/projectdiscovery/nuclei",
  "options": {
    "skipTests": false,
    "forceRebuild": false
  }
}
```

**Response:**
```typescript
interface InstallToolResponse {
  success: boolean;
  installId: string;
  toolId?: string;
  stages: {
    analyze: StageResult;
    clone: StageResult;
    generateDockerfile: StageResult;
    build: StageResult;
    test: StageResult;
    register: StageResult;
  };
  tool?: {
    id: string;
    name: string;
    dockerImage: string;
    version: string;
  };
  error?: string;
}

interface StageResult {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  output?: string;
  error?: string;
}
```

**Example Response (Success):**
```json
{
  "success": true,
  "installId": "550e8400-e29b-41d4-a716-446655440000",
  "toolId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "stages": {
    "analyze": {
      "status": "completed",
      "startedAt": "2025-01-15T10:00:00Z",
      "completedAt": "2025-01-15T10:00:05Z",
      "duration": 5000
    },
    "clone": {
      "status": "completed",
      "startedAt": "2025-01-15T10:00:05Z",
      "completedAt": "2025-01-15T10:00:15Z",
      "duration": 10000
    },
    "generateDockerfile": {
      "status": "completed",
      "startedAt": "2025-01-15T10:00:15Z",
      "completedAt": "2025-01-15T10:00:16Z",
      "duration": 1000
    },
    "build": {
      "status": "completed",
      "startedAt": "2025-01-15T10:00:16Z",
      "completedAt": "2025-01-15T10:02:30Z",
      "duration": 134000
    },
    "test": {
      "status": "completed",
      "startedAt": "2025-01-15T10:02:30Z",
      "completedAt": "2025-01-15T10:02:45Z",
      "duration": 15000
    },
    "register": {
      "status": "completed",
      "startedAt": "2025-01-15T10:02:45Z",
      "completedAt": "2025-01-15T10:02:46Z",
      "duration": 1000
    }
  },
  "tool": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "name": "nuclei",
    "dockerImage": "rtpi-tools/nuclei:latest",
    "version": "3.1.5"
  }
}
```

**Error Codes:**
- `400 Bad Request`: Invalid GitHub URL or malformed request
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `409 Conflict`: Tool already exists (use forceRebuild: true to override)
- `500 Internal Server Error`: Installation failed (check stages for details)

**Rate Limiting:** 5 installations per hour per user

**Implementation:**
```typescript
// server/api/v1/tools.ts
router.post('/install', requireAuth, async (req: Request, res: Response) => {
  const { githubUrl, options } = req.body;

  // Validate GitHub URL
  if (!githubUrl || !githubUrl.startsWith('https://github.com/')) {
    return res.status(400).json({
      error: 'Invalid GitHub URL. Must be a valid https://github.com/ URL'
    });
  }

  // Check rate limit
  const recentInstalls = await db.select()
    .from(toolInstallationLogs)
    .where(
      and(
        eq(toolInstallationLogs.installedBy, req.user.id),
        gte(toolInstallationLogs.createdAt, new Date(Date.now() - 3600000))
      )
    );

  if (recentInstalls.length >= 5) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Maximum 5 installations per hour.'
    });
  }

  try {
    const autoInstaller = new ToolAutoInstaller(docker);
    const result = await autoInstaller.installTool(githubUrl, {
      skipTests: options?.skipTests || false,
      customConfig: options?.customConfig,
      forceRebuild: options?.forceRebuild || false,
      userId: req.user.id
    });

    return res.status(result.success ? 200 : 500).json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

#### POST /api/v1/tools/:id/test

**Description:** Execute the predefined test suite for a specific tool to verify functionality and output format.

**Authentication:** Required (session or API key)

**Path Parameters:**
- `id` (UUID): Tool ID

**Request:**
```typescript
interface TestToolRequest {
  skipNetworkTests?: boolean;
  testSuiteOverride?: {
    testId: string;
    testName: string;
    command: string[];
    expectedOutput: TestExpectation;
    timeout: number;
  }[];
}
```

**Example Request:**
```json
{
  "skipNetworkTests": false
}
```

**Response:**
```typescript
interface TestToolResponse {
  toolId: string;
  toolName: string;
  timestamp: string;
  results: ToolTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    skipped: number;
    totalDuration: number;
    successRate: number;
  };
}

interface ToolTestResult {
  testId: string;
  testName: string;
  category: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration: number;
  output?: string;
  stderr?: string;
  exitCode?: number;
  validationMessage?: string;
  error?: string;
}
```

**Example Response (Success):**
```json
{
  "toolId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "toolName": "nmap",
  "timestamp": "2025-01-15T10:30:00Z",
  "results": [
    {
      "testId": "nmap_install_check",
      "testName": "Installation Verification",
      "category": "installation",
      "status": "passed",
      "duration": 1200,
      "exitCode": 0,
      "validationMessage": "All validations passed"
    },
    {
      "testId": "nmap_basic_scan",
      "testName": "Basic Port Scan",
      "category": "functionality",
      "status": "passed",
      "duration": 15300,
      "exitCode": 0,
      "validationMessage": "All validations passed"
    },
    {
      "testId": "nmap_xml_output",
      "testName": "XML Output Format",
      "category": "output_format",
      "status": "passed",
      "duration": 14800,
      "exitCode": 0,
      "validationMessage": "All validations passed"
    }
  ],
  "summary": {
    "total": 3,
    "passed": 3,
    "failed": 0,
    "errors": 0,
    "skipped": 0,
    "totalDuration": 31300,
    "successRate": 100
  }
}
```

**Error Codes:**
- `400 Bad Request`: Invalid tool ID or malformed request
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Tool not found or no test suite configured
- `500 Internal Server Error`: Test execution failed

**Implementation:**
```typescript
// server/api/v1/tools.ts
router.post('/:id/test', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { skipNetworkTests, testSuiteOverride } = req.body;

  // Fetch tool
  const [tool] = await db.select().from(securityTools).where(eq(securityTools.id, id)).limit(1);

  if (!tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  // Get test suite
  const testSuite = testSuiteOverride || TOOL_TEST_SUITES[tool.name.toLowerCase()];

  if (!testSuite) {
    return res.status(404).json({
      error: 'No test suite configured for this tool'
    });
  }

  try {
    const executor = new ToolTestExecutor(docker);
    const config = tool.configuration ? JSON.parse(tool.configuration) : {};

    const result = await executor.executeTestSuite(config, testSuite, {
      skipNetworkTests
    });

    // Save test results to database
    for (const testResult of result.results) {
      await db.insert(toolTestResults).values({
        toolId: id,
        testSuiteId: testSuite.toolId,
        testId: testResult.testId,
        testName: testResult.testName,
        status: testResult.status,
        category: testResult.category,
        duration: testResult.duration,
        output: testResult.output,
        stderr: testResult.stderr,
        exitCode: testResult.exitCode,
        validationMessage: testResult.validationMessage,
        validationDetails: testResult.validationDetails,
        error: testResult.error,
        executedBy: req.user.id
      });
    }

    // Calculate success rate
    const successRate = result.summary.total > 0
      ? (result.summary.passed / result.summary.total) * 100
      : 0;

    return res.json({
      ...result,
      summary: {
        ...result.summary,
        successRate
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message
    });
  }
});
```

---

#### GET /api/v1/tools/:id/validation

**Description:** Validate that a tool is properly configured and compatible with a specific agent (or all agents if agentId not provided).

**Authentication:** Required (session or API key)

**Path Parameters:**
- `id` (UUID): Tool ID

**Query Parameters:**
- `agentId` (UUID, optional): Agent ID to validate against. If omitted, returns general tool validation status.
- `skipCache` (boolean, optional): Skip validation cache and perform fresh validation

**Response:**
```typescript
interface ToolValidationResponse {
  toolId: string;
  toolName: string;
  agentId?: string;
  agentName?: string;
  overallStatus: 'valid' | 'invalid' | 'warning';
  timestamp: string;
  checks: ValidationCheck[];
  recommendations: string[];
  autoFixesAvailable: number;
}

interface ValidationCheck {
  checkId: string;
  checkName: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  details?: any;
  autoFixAvailable?: boolean;
}
```

**Example Response (Tool valid for agent):**
```json
{
  "toolId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "toolName": "nmap",
  "agentId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "agentName": "Recon Agent 1",
  "overallStatus": "valid",
  "timestamp": "2025-01-15T10:45:00Z",
  "checks": [
    {
      "checkId": "tool_availability",
      "checkName": "Tool Availability",
      "status": "passed",
      "message": "Tool \"nmap\" is available and accessible",
      "details": {
        "dockerImage": "rtpi-tools/nmap:latest",
        "imageId": "sha256:abc123..."
      }
    },
    {
      "checkId": "agent_permissions",
      "checkName": "Agent Permissions",
      "status": "passed",
      "message": "Agent has sufficient permissions to run this tool",
      "details": {
        "agentRole": "operator",
        "requiredRole": "operator"
      }
    },
    {
      "checkId": "tool_dependencies",
      "checkName": "Tool Dependencies",
      "status": "passed",
      "message": "All dependencies are met"
    },
    {
      "checkId": "tool_compatibility",
      "checkName": "Tool Compatibility",
      "status": "passed",
      "message": "Compatible target types: ip, domain, hostname",
      "details": {
        "compatibleTypes": ["ip", "domain", "hostname"]
      }
    },
    {
      "checkId": "tool_configuration",
      "checkName": "Tool Configuration",
      "status": "passed",
      "message": "Tool configuration is valid"
    }
  ],
  "recommendations": [],
  "autoFixesAvailable": 0
}
```

**Example Response (Tool has warnings):**
```json
{
  "toolId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "toolName": "bbot",
  "agentId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "agentName": "Recon Agent 1",
  "overallStatus": "warning",
  "timestamp": "2025-01-15T10:45:00Z",
  "checks": [
    {
      "checkId": "tool_availability",
      "checkName": "Tool Availability",
      "status": "passed",
      "message": "Tool \"bbot\" is available and accessible"
    },
    {
      "checkId": "tool_configuration",
      "checkName": "Tool Configuration",
      "status": "warning",
      "message": "Tool requires API key but none configured",
      "details": {
        "suggestion": "Configure API key in tool settings or environment variables"
      }
    }
  ],
  "recommendations": [
    "Tool Configuration: Tool requires API key but none configured - Consider addressing this warning"
  ],
  "autoFixesAvailable": 0
}
```

**Error Codes:**
- `400 Bad Request`: Invalid tool ID or agent ID
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Tool or agent not found
- `500 Internal Server Error`: Validation check failed

**Implementation:**
```typescript
// server/api/v1/tools.ts
router.get('/:id/validation', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { agentId, skipCache } = req.query;

  // Fetch tool
  const [tool] = await db.select().from(securityTools).where(eq(securityTools.id, id)).limit(1);

  if (!tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  try {
    const validator = new AgentToolValidator(docker);

    if (agentId) {
      // Validate for specific agent
      const result = await validator.validateToolForAgent(
        agentId as string,
        id,
        { skipCache: skipCache === 'true' }
      );

      const autoFixesAvailable = result.checks.filter(c => c.autoFixAvailable).length;

      return res.json({
        ...result,
        autoFixesAvailable
      });
    } else {
      // General tool validation (no specific agent)
      // Perform basic checks without agent context
      const checks: ValidationCheck[] = [];

      // Check 1: Tool availability
      if (tool.dockerImage) {
        const images = await docker.listImages({
          filters: { reference: [tool.dockerImage] }
        });

        checks.push({
          checkId: 'tool_availability',
          checkName: 'Tool Availability',
          status: images.length > 0 ? 'passed' : 'failed',
          message: images.length > 0
            ? `Tool "${tool.name}" is available`
            : `Docker image "${tool.dockerImage}" not found`
        });
      }

      // Check 2: Configuration validity
      const config = tool.configuration ? JSON.parse(tool.configuration) : {};
      const hasRequiredFields = config.command && config.outputFormat;

      checks.push({
        checkId: 'tool_configuration',
        checkName: 'Tool Configuration',
        status: hasRequiredFields ? 'passed' : 'failed',
        message: hasRequiredFields
          ? 'Tool configuration is valid'
          : 'Missing required configuration fields'
      });

      const overallStatus = checks.some(c => c.status === 'failed')
        ? 'invalid'
        : checks.some(c => c.status === 'warning')
        ? 'warning'
        : 'valid';

      return res.json({
        toolId: tool.id,
        toolName: tool.name,
        overallStatus,
        timestamp: new Date().toISOString(),
        checks,
        recommendations: [],
        autoFixesAvailable: 0
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      error: error.message
    });
  }
});
```

**Usage Examples:**

```bash
# Validate tool availability (general check)
curl -X GET "http://localhost:3001/api/v1/tools/f47ac10b/validation" \
  -H "Authorization: Bearer $TOKEN"

# Validate tool for specific agent
curl -X GET "http://localhost:3001/api/v1/tools/f47ac10b/validation?agentId=a1b2c3d4" \
  -H "Authorization: Bearer $TOKEN"

# Force fresh validation (skip cache)
curl -X GET "http://localhost:3001/api/v1/tools/f47ac10b/validation?agentId=a1b2c3d4&skipCache=true" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Testing Requirements

### Unit Tests
- [ ] GitHub analyzer functions
- [ ] Dockerfile generator
- [ ] Dependency detector
- [ ] Tool configuration validator

**Target Coverage:** 80%

### Integration Tests
- [ ] Complete installation workflow
- [ ] Tool testing framework
- [ ] Container update process
- [ ] Agent-tool validation

**Target Coverage:** 70%

### E2E Tests
- [ ] GitHub URL → Installed tool
- [ ] Tool test execution
- [ ] Agent assignment and validation

**Target Coverage:** 60%

---

## Implementation Timeline

### Week 1-2 (Tier 1 - Core Framework)
- [ ] Tool configuration schema
- [ ] Tool testing framework
- [ ] Agent-tool validation
- [ ] Basic registry

### Week 3-4 (Tier 2 - Auto-installer)
- [ ] GitHub repository analyzer
- [ ] Dockerfile generator
- [ ] Auto-installer service
- [ ] UI components
- [ ] Container integration

---

## Dependencies

### External Dependencies
- GitHub API for repository analysis
- Docker SDK for container operations
- Language-specific package managers (pip, npm, cargo, etc.)

### Internal Dependencies
- Docker executor service
- Agent system
- Tool configuration schema

---

## Success Metrics

### Functional Requirements
- [ ] Tool configuration schema adopted
- [ ] GitHub auto-installer working
- [ ] Tool testing passing for all core tools
- [ ] Agent-tool validation operational
- [ ] rtpi-tools container auto-updates

### Performance Requirements
- [ ] Repository analysis <10 seconds
- [ ] Docker build <5 minutes
- [ ] Tool tests <2 minutes
- [ ] Validation checks <1 second

### User Experience
- [ ] Simple tool addition process
- [ ] Clear error messages
- [ ] Progress indicators
- [ ] Helpful documentation

---

## Related Documentation
- [FUTURE-ENHANCEMENTS.md](../FUTURE-ENHANCEMENTS.md) - Parent document
- [01-CRITICAL-BUGS.md](01-CRITICAL-BUGS.md) - Critical bugs (Nmap fixes)
- [RTPI-TOOLS-IMPLEMENTATION.md](../RTPI-TOOLS-IMPLEMENTATION.md) - Tools documentation

---

**Status Legend:**
- 🔴 Tier 1 - Critical for beta
- 🟡 Tier 2 - Beta enhancement
- 🟢 Tier 3 - Post-beta
- ✅ Complete
- 🚧 In Progress
- ⏸️ Blocked

---

**Last Updated:** December 4, 2025  
**Maintained By:** RTPI Development Team
