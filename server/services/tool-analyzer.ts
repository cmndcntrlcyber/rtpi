/**
 * Tool Analyzer Service
 * Analyzes Python tools from offsec-team repository and generates RTPI tool configurations
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  ToolCategory,
  ToolParameter,
  ToolDependency,
  ParameterType,
} from '../../shared/types/tool-config';

/**
 * Python tool analysis result
 */
export interface PythonToolAnalysis {
  toolName: string;
  className: string;
  filePath: string;
  category: ToolCategory;
  description: string;
  methods: ToolMethod[];
  dependencies: ToolDependency[];
  parameters: ToolParameter[];
  complexity: 'low' | 'medium' | 'high' | 'very-high';
  estimatedMigrationDays: number;
  hasTests: boolean;
  requiresExternalServices: boolean;
  externalServiceNotes?: string;
}

/**
 * Python class method information
 */
export interface ToolMethod {
  name: string;
  description: string;
  parameters: MethodParameter[];
  returnType: string;
  isAsync: boolean;
}

/**
 * Method parameter information
 */
export interface MethodParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: any;
}

/**
 * Category mapping from directory names
 */
const CATEGORY_MAPPING: Record<string, ToolCategory> = {
  'bug_hunter': 'scanning',
  'burpsuite_operator': 'web-application',
  'daedelu5': 'other',
  'nexus_kamuy': 'other',
  'rt_dev': 'other',
};

/**
 * Complexity estimation based on tool characteristics
 */
const COMPLEXITY_INDICATORS = {
  'API Client': 3,
  'Orchestrator': 4,
  'Manager': 3,
  'Analyzer': 2,
  'Tester': 2,
  'Generator': 1,
  'Processor': 2,
  'Bridge': 3,
  'Intelligence': 2,
  'Coordinator': 4,
};

/**
 * Analyze a Python tool file and extract configuration
 */
export async function analyzePythonTool(toolFilePath: string): Promise<PythonToolAnalysis> {
  // Read the file content
  const content = await fs.readFile(toolFilePath, 'utf-8');

  // Extract basic information
  const fileName = path.basename(toolFilePath, '.py');
  const dirName = path.basename(path.dirname(toolFilePath));
  const category = CATEGORY_MAPPING[dirName] || 'other';

  // Extract class name and description
  const classInfo = extractClassInfo(content);
  const className = classInfo.name || fileName;
  const description = classInfo.docstring || `${fileName} security tool`;

  // Extract methods
  const methods = extractMethods(content);

  // Extract dependencies
  const dependencies = extractDependencies(content);

  // Extract parameters from methods (Pydantic Field descriptions)
  const parameters = extractParameters(methods);

  // Estimate complexity
  const complexity = estimateComplexity(className, content, dependencies, methods);

  // Check for tests
  const hasTests = await checkForTests(toolFilePath);

  // Check for external services
  const { requires, notes } = checkExternalServices(content, dependencies);

  return {
    toolName: fileName,
    className,
    filePath: toolFilePath,
    category,
    description,
    methods,
    dependencies,
    parameters,
    complexity,
    estimatedMigrationDays: getEstimatedDays(complexity),
    hasTests,
    requiresExternalServices: requires,
    externalServiceNotes: notes,
  };
}

/**
 * Extract class information from Python file
 */
function extractClassInfo(content: string): { name: string; docstring: string } {
  // Match class definition
  const classMatch = content.match(/class\s+(\w+)(?:\([^)]*\))?:\s*\n\s*"""([\s\S]*?)"""/);

  if (classMatch) {
    return {
      name: classMatch[1],
      docstring: classMatch[2].trim(),
    };
  }

  // Try without docstring
  const simpleClassMatch = content.match(/class\s+(\w+)(?:\([^)]*\))?:/);
  if (simpleClassMatch) {
    return {
      name: simpleClassMatch[1],
      docstring: '',
    };
  }

  return { name: '', docstring: '' };
}

/**
 * Extract methods from Python class
 */
function extractMethods(content: string): ToolMethod[] {
  const methods: ToolMethod[] = [];

  // Match method definitions with docstrings
  const methodRegex = /def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*([^:]+))?\s*:\s*\n\s*"""([\s\S]*?)"""/g;

  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    const methodName = match[1];
    const returnType = match[2]?.trim() || 'Any';
    const docstring = match[3].trim();

    // Skip private methods and __init__
    if (methodName.startsWith('_') && methodName !== '__init__') {
      continue;
    }

    // Extract method signature
    const methodSignatureMatch = content.match(
      new RegExp(`def\\s+${methodName}\\s*\\(([^)]*)\\)`)
    );

    const parameters = methodSignatureMatch
      ? extractMethodParameters(methodSignatureMatch[1], docstring)
      : [];

    // Check if async
    const isAsync = content.includes(`async def ${methodName}`);

    methods.push({
      name: methodName,
      description: extractMethodDescription(docstring),
      parameters,
      returnType,
      isAsync,
    });
  }

  return methods;
}

/**
 * Extract method parameters with Pydantic Field descriptions
 */
function extractMethodParameters(signature: string, docstring: string): MethodParameter[] {
  const parameters: MethodParameter[] = [];

  // Split parameters
  const params = signature.split(',').map(p => p.trim()).filter(p => p && p !== 'self');

  for (const param of params) {
    // Parse parameter: name: type = Field(..., description="...")
    const fieldMatch = param.match(/(\w+):\s*([^=]+)\s*=\s*Field\([^,]*,\s*description="([^"]+)"/);

    if (fieldMatch) {
      const [, name, type, description] = fieldMatch;
      const required = param.includes('Field(...)');

      parameters.push({
        name,
        type: type.trim(),
        description,
        required,
        defaultValue: required ? undefined : extractDefaultValue(param),
      });
    } else {
      // Simple parameter: name: type or name: type = default
      const simpleMatch = param.match(/(\w+):\s*([^=]+)(?:\s*=\s*(.+))?/);

      if (simpleMatch) {
        const [, name, type, defaultVal] = simpleMatch;
        const description = extractParamDescription(name, docstring);

        parameters.push({
          name,
          type: type.trim(),
          description,
          required: !defaultVal,
          defaultValue: defaultVal ? parseDefaultValue(defaultVal) : undefined,
        });
      }
    }
  }

  return parameters;
}

/**
 * Extract method description from docstring
 */
function extractMethodDescription(docstring: string): string {
  // Get first line or paragraph
  const lines = docstring.split('\n').map(l => l.trim()).filter(l => l);
  return lines[0] || '';
}

/**
 * Extract parameter description from docstring Args section
 */
function extractParamDescription(paramName: string, docstring: string): string {
  // Look for Args section
  const argsMatch = docstring.match(/Args:([\s\S]*?)(?:Returns:|$)/);
  if (!argsMatch) return '';

  const argsSection = argsMatch[1];
  const paramMatch = argsSection.match(new RegExp(`${paramName}:\\s*(.+?)(?:\\n|$)`));

  return paramMatch ? paramMatch[1].trim() : '';
}

/**
 * Extract default value from parameter string
 */
function extractDefaultValue(param: string): any {
  const match = param.match(/=\s*Field\([^,]*,\s*default=([^,)]+)/);
  if (match) {
    return parseDefaultValue(match[1]);
  }
  return undefined;
}

/**
 * Parse default value string to appropriate type
 */
function parseDefaultValue(value: string): any {
  value = value.trim();

  if (value === 'None' || value === 'null') return null;
  if (value === 'True') return true;
  if (value === 'False') return false;
  if (value.match(/^-?\d+$/)) return parseInt(value);
  if (value.match(/^-?\d+\.\d+$/)) return parseFloat(value);
  if (value.startsWith('"') || value.startsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}

/**
 * Extract dependencies from import statements
 */
function extractDependencies(content: string): ToolDependency[] {
  const dependencies: ToolDependency[] = [];
  const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;

  const standardLibs = new Set([
    'os', 'sys', 'time', 'json', 'logging', 're', 'urllib', 'datetime',
    'typing', 'pathlib', 'collections', 'functools', 'itertools',
  ]);

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const fromModule = match[1];
    const imports = match[2];

    // Determine the package name
    let packageName = fromModule || imports.split(',')[0].trim().split(' ')[0];

    // Skip standard library
    if (standardLibs.has(packageName)) {
      continue;
    }

    // Skip relative imports
    if (packageName.startsWith('.')) {
      continue;
    }

    // Map common package names
    if (packageName.includes('pydantic')) packageName = 'pydantic';
    if (packageName.includes('requests')) packageName = 'requests';

    // Skip if already added
    if (dependencies.some(d => d.name === packageName)) {
      continue;
    }

    dependencies.push({
      type: 'package',
      name: packageName,
      installCommand: `pip install ${packageName}`,
      checkCommand: `python -c "import ${packageName}"`,
    });
  }

  return dependencies;
}

/**
 * Extract tool parameters from methods
 */
function extractParameters(methods: ToolMethod[]): ToolParameter[] {
  const parameters: ToolParameter[] = [];
  const seen = new Set<string>();

  for (const method of methods) {
    // Skip private methods
    if (method.name.startsWith('_')) continue;

    for (const param of method.parameters) {
      if (seen.has(param.name)) continue;
      seen.add(param.name);

      parameters.push({
        name: param.name,
        type: mapPythonTypeToParameterType(param.type),
        description: param.description,
        required: param.required,
        defaultValue: param.defaultValue,
      });
    }
  }

  return parameters;
}

/**
 * Map Python type hints to RTPI parameter types
 */
function mapPythonTypeToParameterType(pythonType: string): ParameterType {
  const normalized = pythonType.toLowerCase().replace(/\s+/g, '');

  if (normalized.includes('str')) return 'string';
  if (normalized.includes('int')) return 'number';
  if (normalized.includes('float')) return 'number';
  if (normalized.includes('bool')) return 'boolean';
  if (normalized.includes('list') || normalized.includes('[]')) return 'array';
  if (normalized.includes('dict')) return 'string'; // JSON string
  if (normalized.includes('path')) return 'file';
  if (normalized.includes('url')) return 'url';
  if (normalized.includes('port')) return 'port';
  if (normalized.includes('ip')) return 'ip-address';

  return 'string'; // Default
}

/**
 * Estimate migration complexity
 */
function estimateComplexity(
  className: string,
  content: string,
  dependencies: ToolDependency[],
  methods: ToolMethod[]
): 'low' | 'medium' | 'high' | 'very-high' {
  let score = 0;

  // Check class name for complexity indicators
  for (const [indicator, points] of Object.entries(COMPLEXITY_INDICATORS)) {
    if (className.includes(indicator)) {
      score += points;
      break;
    }
  }

  // Dependencies count
  score += Math.min(dependencies.length * 0.5, 3);

  // Method count
  score += Math.min(methods.length * 0.3, 3);

  // External API integration
  if (content.includes('requests.') || content.includes('http')) {
    score += 2;
  }

  // Async operations
  if (content.includes('async def') || content.includes('await ')) {
    score += 1;
  }

  // State management
  if (content.includes('self.') && content.split('self.').length > 10) {
    score += 1;
  }

  // Determine complexity
  if (score <= 3) return 'low';
  if (score <= 6) return 'medium';
  if (score <= 9) return 'high';
  return 'very-high';
}

/**
 * Get estimated migration days based on complexity
 */
function getEstimatedDays(complexity: string): number {
  const mapping = {
    'low': 2,
    'medium': 3,
    'high': 5,
    'very-high': 8,
  };
  return mapping[complexity as keyof typeof mapping] || 3;
}

/**
 * Check if tool has tests
 */
async function checkForTests(toolFilePath: string): Promise<boolean> {
  const dirPath = path.dirname(toolFilePath);
  const fileName = path.basename(toolFilePath, '.py');

  // Check for test file
  const testFileName = `test_${fileName}.py`;
  const testFilePath = path.join(dirPath, testFileName);

  try {
    await fs.access(testFilePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if tool requires external services
 */
function checkExternalServices(
  content: string,
  dependencies: ToolDependency[]
): { requires: boolean; notes?: string } {
  const notes: string[] = [];

  // Check for Burp Suite
  if (content.includes('BurpSuite') || content.includes('burp')) {
    notes.push('Requires Burp Suite Professional with API enabled (port 1337)');
  }

  // Check for Empire C2
  if (content.includes('Empire') || content.includes('empire')) {
    notes.push('Requires Empire C2 server');
  }

  // Check for external APIs
  if (content.includes('api_key') || content.includes('API_KEY')) {
    notes.push('Requires API key configuration');
  }

  // Check for database
  if (dependencies.some(d => d.name.includes('sql') || d.name.includes('db'))) {
    notes.push('Requires database connection');
  }

  return {
    requires: notes.length > 0,
    notes: notes.length > 0 ? notes.join('; ') : undefined,
  };
}

/**
 * Analyze all tools in a directory
 */
export async function analyzeToolsDirectory(dirPath: string): Promise<PythonToolAnalysis[]> {
  const results: PythonToolAnalysis[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.py') && !entry.name.startsWith('__')) {
        const filePath = path.join(dirPath, entry.name);

        try {
          const analysis = await analyzePythonTool(filePath);
          results.push(analysis);
        } catch (error) {
          console.error(`Failed to analyze ${filePath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error);
  }

  return results;
}

/**
 * Analyze all tools in offsec-team repository
 */
export async function analyzeOffSecTeamTools(): Promise<Map<string, PythonToolAnalysis[]>> {
  const toolsBasePath = path.join(process.cwd(), 'tools', 'offsec-team', 'tools');
  const categories = ['bug_hunter', 'burpsuite_operator', 'daedelu5', 'nexus_kamuy', 'rt_dev'];

  const results = new Map<string, PythonToolAnalysis[]>();

  for (const category of categories) {
    const categoryPath = path.join(toolsBasePath, category);
    const tools = await analyzeToolsDirectory(categoryPath);
    results.set(category, tools);
  }

  return results;
}

/**
 * Generate RTPI tool configuration from analysis
 */
export function generateToolConfig(analysis: PythonToolAnalysis) {
  return {
    name: analysis.toolName,
    category: analysis.category,
    description: analysis.description,
    version: '1.0.0',
    installMethod: 'pip' as const,
    binaryPath: 'python',
    parameters: analysis.parameters,
    outputFormat: 'json' as const,
    timeout: 300000, // 5 minutes
    metadata: {
      className: analysis.className,
      pythonModule: analysis.filePath,
      complexity: analysis.complexity,
      estimatedMigrationDays: analysis.estimatedMigrationDays,
      hasTests: analysis.hasTests,
      requiresExternalServices: analysis.requiresExternalServices,
      externalServiceNotes: analysis.externalServiceNotes,
      methods: analysis.methods.map(m => ({
        name: m.name,
        description: m.description,
        isAsync: m.isAsync,
      })),
    },
    dependencies: analysis.dependencies,
  };
}
