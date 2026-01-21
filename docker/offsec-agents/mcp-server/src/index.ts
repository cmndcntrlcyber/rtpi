#!/usr/bin/env node
/**
 * OffSec Agent MCP Server
 *
 * Exposes security tools via Model Context Protocol (MCP).
 * Each agent container runs this server to allow AI agents to
 * discover and execute security tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { discoverTools, toMCPSchema, DiscoveredTool } from './tool-discovery.js';

const execAsync = promisify(exec);

// Configuration
const TOOLS_PATH = process.env.TOOLS_PATH || '/opt/tools';
const DOCS_PATH = process.env.DOCS_PATH || '/docs';
const AGENT_TYPE = process.env.AGENT_TYPE || 'generic';
const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB max output
const DEFAULT_TIMEOUT = 300000; // 5 minutes

// Cache discovered tools
let toolsCache: DiscoveredTool[] = [];
let lastDiscoveryTime = 0;
const CACHE_TTL = 300000; // 5 minutes

/**
 * Refresh tools cache if needed
 */
async function refreshToolsCache(): Promise<DiscoveredTool[]> {
  const now = Date.now();
  if (now - lastDiscoveryTime > CACHE_TTL || toolsCache.length === 0) {
    console.error('Refreshing tools cache...');
    toolsCache = await discoverTools(TOOLS_PATH);
    lastDiscoveryTime = now;
  }
  return toolsCache;
}

/**
 * Execute a tool with given arguments
 */
async function executeTool(
  toolName: string,
  args: Record<string, any>
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const tools = await refreshToolsCache();
  const tool = tools.find(t => t.name === toolName || t.name.replace(/[^a-zA-Z0-9_-]/g, '_') === toolName);

  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  // Build command arguments
  const cmdArgs: string[] = [];

  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null || value === '') continue;

    // Convert parameter name back to flag format
    const flag = key.length === 1 ? `-${key}` : `--${key.replace(/_/g, '-')}`;

    if (typeof value === 'boolean') {
      if (value) cmdArgs.push(flag);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        cmdArgs.push(flag, String(item));
      }
    } else {
      cmdArgs.push(flag, String(value));
    }
  }

  console.error(`Executing: ${tool.path} ${cmdArgs.join(' ')}`);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let outputSize = 0;

    const proc = spawn(tool.path, cmdArgs, {
      timeout: DEFAULT_TIMEOUT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data: Buffer) => {
      if (outputSize < MAX_OUTPUT_SIZE) {
        stdout += data.toString();
        outputSize += data.length;
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      if (outputSize < MAX_OUTPUT_SIZE) {
        stderr += data.toString();
        outputSize += data.length;
      }
    });

    proc.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0,
      });
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to execute ${toolName}: ${error.message}`));
    });

    // Timeout handling
    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Tool execution timed out after ${DEFAULT_TIMEOUT / 1000} seconds`));
    }, DEFAULT_TIMEOUT);
  });
}

/**
 * Get documentation content
 */
async function getDocumentation(): Promise<string> {
  try {
    const readmePath = path.join(DOCS_PATH, 'README.md');
    return await fs.readFile(readmePath, 'utf-8');
  } catch (error) {
    return '# Documentation\n\nNo documentation available. Run generate-docs.sh to create it.';
  }
}

/**
 * Main server initialization
 */
async function main() {
  console.error(`Starting OffSec Agent MCP Server (${AGENT_TYPE})...`);

  // Initial tool discovery
  await refreshToolsCache();
  console.error(`Discovered ${toolsCache.length} tools`);

  // Create MCP server
  const server = new Server(
    {
      name: `offsec-${AGENT_TYPE}-mcp`,
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = await refreshToolsCache();

    const mcpTools: Tool[] = tools.map((tool) => {
      const schema = toMCPSchema(tool);
      return {
        name: schema.name,
        description: `[${tool.category}] ${schema.description}`,
        inputSchema: schema.inputSchema,
      };
    });

    // Add meta tools
    mcpTools.push({
      name: 'list_categories',
      description: 'List all available tool categories',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    });

    mcpTools.push({
      name: 'get_tool_help',
      description: 'Get detailed help for a specific tool',
      inputSchema: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            description: 'Name of the tool to get help for',
          },
        },
        required: ['tool_name'],
      },
    });

    mcpTools.push({
      name: 'search_tools',
      description: 'Search for tools by keyword',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
        },
        required: ['query'],
      },
    });

    return { tools: mcpTools };
  });

  // Handle call tool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // Handle meta tools
      if (name === 'list_categories') {
        const tools = await refreshToolsCache();
        const categories = [...new Set(tools.map(t => t.category))];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ categories, count: categories.length }, null, 2),
            },
          ],
        };
      }

      if (name === 'get_tool_help') {
        const tools = await refreshToolsCache();
        const tool = tools.find(t => t.name === args?.tool_name);
        if (!tool) {
          return {
            content: [{ type: 'text', text: `Tool not found: ${args?.tool_name}` }],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `# ${tool.name}\n\n**Category:** ${tool.category}\n**Path:** ${tool.path}\n\n## Description\n${tool.description}\n\n## Help\n\`\`\`\n${tool.helpText}\n\`\`\``,
            },
          ],
        };
      }

      if (name === 'search_tools') {
        const tools = await refreshToolsCache();
        const query = String(args?.query || '').toLowerCase();
        const matches = tools.filter(
          t =>
            t.name.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query) ||
            t.category.toLowerCase().includes(query)
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query,
                  results: matches.map(t => ({
                    name: t.name,
                    category: t.category,
                    description: t.description,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Execute actual tool
      const result = await executeTool(name, args || {});

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                tool: name,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
              },
              null,
              2
            ),
          },
        ],
        isError: result.exitCode !== 0,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Handle list resources request
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'docs://readme',
          name: 'Tool Documentation',
          description: 'Documentation for all available tools',
          mimeType: 'text/markdown',
        },
        {
          uri: 'docs://tools',
          name: 'Tools List',
          description: 'JSON list of all available tools',
          mimeType: 'application/json',
        },
      ],
    };
  });

  // Handle read resource request
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'docs://readme') {
      const content = await getDocumentation();
      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: content,
          },
        ],
      };
    }

    if (uri === 'docs://tools') {
      const tools = await refreshToolsCache();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              tools.map(t => ({
                name: t.name,
                path: t.path,
                category: t.category,
                description: t.description,
                parameters: t.parameters,
              })),
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Resource not found: ${uri}`);
  });

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('MCP Server connected and ready');
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
