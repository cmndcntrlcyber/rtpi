/**
 * Tool Discovery Module
 *
 * Automatically discovers executable tools in /opt/tools and generates
 * MCP-compatible tool schemas by parsing --help output.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default?: string | number | boolean;
}

export interface DiscoveredTool {
  name: string;
  path: string;
  description: string;
  parameters: ToolParameter[];
  category: string;
  helpText: string;
}

export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      default?: any;
    }>;
    required: string[];
  };
}

/**
 * Find all executable files in a directory recursively
 */
async function findExecutables(basePath: string): Promise<string[]> {
  const executables: string[] = [];

  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(basePath, entry.name);

      if (entry.isDirectory()) {
        // Skip common non-tool directories
        if (!['node_modules', '.git', '__pycache__', 'venv'].includes(entry.name)) {
          const subExecutables = await findExecutables(fullPath);
          executables.push(...subExecutables);
        }
      } else if (entry.isFile()) {
        try {
          await fs.access(fullPath, fs.constants.X_OK);
          executables.push(fullPath);
        } catch {
          // Not executable, skip
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${basePath}:`, error);
  }

  return executables;
}

/**
 * Get help text from a tool
 */
async function getHelpText(toolPath: string): Promise<string> {
  const commands = [
    `"${toolPath}" --help 2>&1`,
    `"${toolPath}" -h 2>&1`,
    `"${toolPath}" help 2>&1`,
  ];

  for (const cmd of commands) {
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 10000 });
      const output = stdout || stderr;
      if (output && output.length > 10) {
        return output;
      }
    } catch (error) {
      // Try next command
    }
  }

  return '';
}

/**
 * Parse description from help text
 */
function parseDescription(helpText: string): string {
  const lines = helpText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, usage lines, and option lines
    if (
      trimmed &&
      !trimmed.toLowerCase().startsWith('usage') &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('[') &&
      trimmed.length > 10 &&
      trimmed.length < 200
    ) {
      return trimmed;
    }
  }

  return 'Security tool';
}

/**
 * Parse parameters from help text
 */
function parseParameters(helpText: string): ToolParameter[] {
  const parameters: ToolParameter[] = [];
  const lines = helpText.split('\n');

  // Patterns for common argument formats
  const patterns = [
    // --option VALUE description
    /^\s*(--?[\w-]+)\s+(?:<(\w+)>|(\w+))?\s*(.*)$/,
    // --option=VALUE description
    /^\s*(--?[\w-]+)=(?:<(\w+)>|(\w+))?\s*(.*)$/,
    // --option description
    /^\s*(--?[\w-]+)\s+(.*)$/,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, flag, valueType1, valueType2, description] = match;
        const valueType = valueType1 || valueType2;

        // Clean up parameter name
        const paramName = flag?.replace(/^-+/, '').replace(/-/g, '_');
        if (!paramName || paramName.length < 2 || paramName.length > 30) continue;

        // Determine type
        let type: ToolParameter['type'] = 'boolean';
        if (valueType) {
          const lowerType = valueType.toLowerCase();
          if (['int', 'num', 'number', 'port', 'count'].some(t => lowerType.includes(t))) {
            type = 'number';
          } else if (['file', 'path', 'string', 'str', 'url', 'host', 'dir'].some(t => lowerType.includes(t))) {
            type = 'string';
          } else if (['list', 'array'].some(t => lowerType.includes(t))) {
            type = 'array';
          } else {
            type = 'string';
          }
        }

        // Check if required
        const descLower = (description || '').toLowerCase();
        const required = descLower.includes('required') || descLower.includes('must be');

        parameters.push({
          name: paramName,
          type,
          description: description?.trim().slice(0, 200) || `${paramName} parameter`,
          required,
        });

        break;
      }
    }
  }

  // Always add target/input parameter if not present
  if (!parameters.find(p => ['target', 'url', 'host', 'input'].includes(p.name))) {
    parameters.unshift({
      name: 'target',
      type: 'string',
      description: 'Target URL, host, or input for the tool',
      required: true,
    });
  }

  return parameters.slice(0, 20); // Limit to 20 parameters
}

/**
 * Determine tool category based on name and help text
 */
function categorizeTools(name: string, helpText: string): string {
  const text = `${name} ${helpText}`.toLowerCase();

  if (['scan', 'nmap', 'masscan', 'rustscan'].some(k => text.includes(k))) {
    return 'reconnaissance';
  }
  if (['vuln', 'nuclei', 'nikto', 'exploit'].some(k => text.includes(k))) {
    return 'vulnerability';
  }
  if (['fuzz', 'ffuf', 'gobuster', 'dirbuster', 'ferox'].some(k => text.includes(k))) {
    return 'fuzzing';
  }
  if (['c2', 'empire', 'listener', 'beacon', 'stager'].some(k => text.includes(k))) {
    return 'c2';
  }
  if (['reverse', 'ghidra', 'binary', 'rop', 'shellcode'].some(k => text.includes(k))) {
    return 'maldev';
  }
  if (['ad', 'blood', 'ldap', 'kerberos', 'azure', 'entra'].some(k => text.includes(k))) {
    return 'active-directory';
  }
  if (['cred', 'password', 'hash', 'crack'].some(k => text.includes(k))) {
    return 'credential';
  }

  return 'general';
}

/**
 * Discover all tools in a directory and generate schemas
 */
export async function discoverTools(basePath: string = '/opt/tools'): Promise<DiscoveredTool[]> {
  console.log(`Discovering tools in ${basePath}...`);

  const executables = await findExecutables(basePath);
  const tools: DiscoveredTool[] = [];

  for (const execPath of executables) {
    try {
      const name = path.basename(execPath);
      const helpText = await getHelpText(execPath);

      if (!helpText) {
        console.log(`Skipping ${name}: No help text available`);
        continue;
      }

      const tool: DiscoveredTool = {
        name,
        path: execPath,
        description: parseDescription(helpText),
        parameters: parseParameters(helpText),
        category: categorizeTools(name, helpText),
        helpText: helpText.slice(0, 5000),
      };

      tools.push(tool);
      console.log(`Discovered: ${name} (${tool.category})`);
    } catch (error) {
      console.error(`Error processing ${execPath}:`, error);
    }
  }

  console.log(`Discovered ${tools.length} tools`);
  return tools;
}

/**
 * Convert discovered tool to MCP tool schema
 */
export function toMCPSchema(tool: DiscoveredTool): MCPToolSchema {
  const properties: Record<string, { type: string; description: string; default?: any }> = {};
  const required: string[] = [];

  for (const param of tool.parameters) {
    properties[param.name] = {
      type: param.type === 'array' ? 'string' : param.type,
      description: param.description,
    };

    if (param.default !== undefined) {
      properties[param.name].default = param.default;
    }

    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    name: tool.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
    description: tool.description,
    inputSchema: {
      type: 'object',
      properties,
      required,
    },
  };
}

/**
 * Get all tools as MCP schemas
 */
export async function getMCPToolSchemas(basePath: string = '/opt/tools'): Promise<MCPToolSchema[]> {
  const tools = await discoverTools(basePath);
  return tools.map(toMCPSchema);
}
