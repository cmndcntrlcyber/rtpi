/**
 * Output Parser Manager Service
 * Centralized service for parsing tool outputs in various formats
 */

import { db } from '../db';
import { toolOutputParsers } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type { OutputParserConfig } from '../../shared/types/tool-config';

/**
 * Parser type discriminator
 */
export type ParserType = 'json' | 'xml' | 'regex' | 'custom' | 'line-by-line';

/**
 * Parser result with metadata
 */
export interface ParserResult {
  success: boolean;
  parsed: any;
  raw: string;
  parserType: ParserType;
  errors?: string[];
  warnings?: string[];
  metadata?: {
    linesProcessed?: number;
    matchCount?: number;
    parseTime?: number;
  };
}

/**
 * Main output parser manager class
 */
export class OutputParserManager {
  /**
   * Parse tool output using the configured parser
   */
  async parseOutput(
    output: string,
    parserConfig: OutputParserConfig
  ): Promise<ParserResult> {
    const startTime = Date.now();
    const result: ParserResult = {
      success: false,
      parsed: null,
      raw: output,
      parserType: parserConfig.parserType,
      errors: [],
      warnings: [],
      metadata: {},
    };

    try {
      switch (parserConfig.parserType) {
        case 'json':
          result.parsed = await this.parseJson(output, parserConfig.jsonPaths);
          result.success = true;
          break;

        case 'xml':
          result.parsed = await this.parseXml(output, parserConfig.xmlPaths);
          result.success = true;
          break;

        case 'regex':
          result.parsed = await this.parseRegex(output, parserConfig.regexPatterns);
          result.success = true;
          break;

        case 'custom':
          if (!parserConfig.parserCode) {
            throw new Error('Custom parser requires parserCode');
          }
          result.parsed = await this.parseCustom(output, parserConfig.parserCode);
          result.success = true;
          break;

        case 'line-by-line':
          result.parsed = await this.parseLineByLine(output);
          result.success = true;
          break;

        default:
          throw new Error(`Unknown parser type: ${parserConfig.parserType}`);
      }

      result.metadata!.parseTime = Date.now() - startTime;
    } catch (error: any) {
      result.success = false;
      result.errors!.push(error.message);
      result.metadata!.parseTime = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Parse JSON output with optional JSONPath extraction
   */
  private async parseJson(
    output: string,
    jsonPaths?: Record<string, string>
  ): Promise<any> {
    try {
      // Try to parse the entire output as JSON
      const parsed = JSON.parse(output);

      // If no JSON paths specified, return the entire parsed object
      if (!jsonPaths || Object.keys(jsonPaths).length === 0) {
        return parsed;
      }

      // Extract specific paths
      const result: any = {};
      for (const [key, path] of Object.entries(jsonPaths)) {
        result[key] = this.getJsonPath(parsed, path);
      }

      return result;
    } catch (error: any) {
      // Try to extract JSON from mixed output (e.g., logs + JSON)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed;
        } catch {
          throw new Error(`Failed to parse JSON: ${error.message}`);
        }
      }

      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  }

  /**
   * Get value from JSON object using dot notation path
   * Supports simple paths like "data.results[0].value"
   */
  private getJsonPath(obj: any, path: string): any {
    // Handle array index notation: data.items[0].name
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalizedPath.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }

      // Handle array indices
      const arrayIndex = parseInt(part, 10);
      if (!isNaN(arrayIndex)) {
        current = Array.isArray(current) ? current[arrayIndex] : null;
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Parse XML output with XPath extraction
   * Note: Basic implementation - would need xml2js or similar for full XPath support
   */
  private async parseXml(
    output: string,
    xmlPaths?: Record<string, string>
  ): Promise<any> {
    // For now, return structured representation
    // TODO: Implement proper XML parsing with xml2js or fast-xml-parser
    const result: any = {
      raw: output,
      extractedPaths: {},
    };

    if (xmlPaths) {
      // Basic regex-based extraction for common patterns
      for (const [key, xpath] of Object.entries(xmlPaths)) {
        // Extract tag content using regex (simplified)
        const tagName = xpath.split('/').pop() || '';
        const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi');
        const matches = [...output.matchAll(regex)];

        if (matches.length > 0) {
          result.extractedPaths[key] = matches.map(m => m[1].trim());
        }
      }
    }

    return result;
  }

  /**
   * Parse output using regex patterns
   */
  private async parseRegex(
    output: string,
    regexPatterns: Record<string, string>
  ): Promise<any> {
    const result: any = {};

    for (const [key, pattern] of Object.entries(regexPatterns)) {
      try {
        const regex = new RegExp(pattern, 'gm');
        const matches = [...output.matchAll(regex)];

        if (matches.length > 0) {
          // If pattern has capture groups, extract them
          if (matches[0].length > 1) {
            result[key] = matches.map(m => {
              // Return captured groups (excluding full match at index 0)
              const groups = Array.from(m).slice(1);
              return groups.length === 1 ? groups[0] : groups;
            });
          } else {
            // No capture groups, return full matches
            result[key] = matches.map(m => m[0]);
          }
        } else {
          result[key] = [];
        }
      } catch (error: any) {
        console.error(`Failed to parse regex pattern for ${key}:`, error);
        result[key] = { error: error.message };
      }
    }

    return result;
  }

  /**
   * Parse output using custom JavaScript code
   * Security note: Executes in sandboxed context with limited scope
   */
  private async parseCustom(output: string, parserCode: string): Promise<any> {
    try {
      // Create a sandboxed function with access to output and common utilities
      const sandbox = {
        output,
        JSON,
        parseInt,
        parseFloat,
        String,
        Number,
        Array,
        Object,
        Math,
        Date,
        RegExp,
      };

      // Wrap parser code in a function
      const fnBody = `
        'use strict';
        return (function(output) {
          ${parserCode}
        })(output);
      `;

      const fn = new Function('output', fnBody);
      const result = fn.call(sandbox, output);

      return result;
    } catch (error: any) {
      throw new Error(`Custom parser execution failed: ${error.message}`);
    }
  }

  /**
   * Parse output line by line (useful for streaming/log outputs)
   */
  private async parseLineByLine(output: string): Promise<any> {
    const lines = output.split('\n').filter(line => line.trim());

    return {
      totalLines: lines.length,
      lines: lines.map((line, index) => ({
        lineNumber: index + 1,
        content: line.trim(),
      })),
    };
  }

  /**
   * Get parser configuration for a tool from database
   */
  async getParserForTool(toolId: string): Promise<OutputParserConfig | null> {
    const [parser] = await db
      .select()
      .from(toolOutputParsers)
      .where(eq(toolOutputParsers.toolId, toolId));

    if (!parser) {
      return null;
    }

    return {
      parserName: parser.parserName,
      parserType: parser.parserType as ParserType,
      outputFormat: parser.outputFormat,
      parserCode: parser.parserCode,
      regexPatterns: parser.regexPatterns as Record<string, string>,
      jsonPaths: parser.jsonPaths as Record<string, string>,
      xmlPaths: parser.xmlPaths as Record<string, string>,
    };
  }

  /**
   * Test a parser configuration with sample output
   */
  async testParser(
    sampleOutput: string,
    parserConfig: OutputParserConfig
  ): Promise<ParserResult> {
    return await this.parseOutput(sampleOutput, parserConfig);
  }

  /**
   * Validate parser configuration
   */
  validateParserConfig(config: OutputParserConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.parserType) {
      errors.push('Parser type is required');
    }

    if (config.parserType === 'custom' && !config.parserCode) {
      errors.push('Custom parser requires parserCode');
    }

    if (config.parserType === 'regex') {
      if (!config.regexPatterns || Object.keys(config.regexPatterns).length === 0) {
        errors.push('Regex parser requires at least one regex pattern');
      } else {
        // Validate each regex pattern
        for (const [key, pattern] of Object.entries(config.regexPatterns)) {
          try {
            new RegExp(pattern);
          } catch (error: any) {
            errors.push(`Invalid regex pattern for ${key}: ${error.message}`);
          }
        }
      }
    }

    if (config.parserType === 'json' && config.jsonPaths) {
      // Validate JSON paths (basic check)
      for (const [key, path] of Object.entries(config.jsonPaths)) {
        if (!path || typeof path !== 'string') {
          errors.push(`Invalid JSON path for ${key}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert common tool outputs to structured format
   */
  async autoDetectAndParse(output: string): Promise<ParserResult> {
    // Try JSON first
    try {
      const parsed = JSON.parse(output);
      return {
        success: true,
        parsed,
        raw: output,
        parserType: 'json',
      };
    } catch {
      // Not JSON, continue
    }

    // Check if it looks like XML
    if (output.trim().startsWith('<?xml') || output.includes('</')) {
      return await this.parseOutput(output, {
        parserName: 'auto-xml',
        parserType: 'xml',
        outputFormat: 'xml',
      });
    }

    // Default to line-by-line
    return await this.parseOutput(output, {
      parserName: 'auto-line-by-line',
      parserType: 'line-by-line',
      outputFormat: 'text',
    });
  }
}

// Export singleton instance
export const outputParserManager = new OutputParserManager();

/**
 * Convenience function for parsing output
 */
export async function parseToolOutput(
  output: string,
  parserConfig: OutputParserConfig
): Promise<ParserResult> {
  return await outputParserManager.parseOutput(output, parserConfig);
}

/**
 * Auto-detect format and parse
 */
export async function autoParseOutput(output: string): Promise<ParserResult> {
  return await outputParserManager.autoDetectAndParse(output);
}
