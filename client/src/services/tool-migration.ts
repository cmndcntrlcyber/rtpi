import { api } from "@/lib/api";

export interface PythonToolAnalysis {
  toolName: string;
  className: string;
  category: string;
  filePath: string;
  description: string;
  methods: Array<{
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: string;
      required: boolean;
    }>;
    returnType: string;
  }>;
  dependencies: Array<{
    name: string;
    version?: string;
    installMethod: string;
  }>;
  complexity: "low" | "medium" | "high" | "very-high";
  estimatedMigrationDays: number;
  hasTests: boolean;
  requiresExternalServices: boolean;
}

export interface MigrationResult {
  toolName: string;
  status: "pending" | "analyzing" | "generating-wrapper" | "installing-dependencies" | "testing" | "registering" | "completed" | "failed";
  toolId?: string;
  wrapperPath?: string;
  errors?: string[];
  warnings?: string[];
  steps: Array<{
    step: string;
    status: "pending" | "running" | "completed" | "failed";
    startTime?: string;
    endTime?: string;
    output?: string;
    error?: string;
  }>;
  durationMs: number;
}

export interface MigrationOptions {
  installDependencies?: boolean;
  runTests?: boolean;
  registerInDatabase?: boolean;
  generateWrapper?: boolean;
  overwriteExisting?: boolean;
}

export interface ToolMigrationStatus {
  exists: boolean;
  installed: boolean;
  toolId?: string;
  config?: any;
}

export const toolMigrationService = {
  // Analyze all offsec-team tools
  analyzeAll: () =>
    api.get<{
      success: boolean;
      data: {
        summary: {
          totalTools: number;
          byCategory: Record<string, number>;
          byComplexity: {
            low: number;
            medium: number;
            high: number;
            "very-high": number;
          };
          tools: PythonToolAnalysis[];
        };
        toolsByCategory: Record<string, PythonToolAnalysis[]>;
      };
    }>("/tool-migration/analyze"),

  // Analyze specific file
  analyzeFile: (filePath: string) =>
    api.post<{
      success: boolean;
      data: PythonToolAnalysis;
    }>("/tool-migration/analyze-file", { filePath }),

  // Analyze directory
  analyzeDirectory: (dirPath: string) =>
    api.post<{
      success: boolean;
      data: {
        count: number;
        tools: PythonToolAnalysis[];
      };
    }>("/tool-migration/analyze-directory", { dirPath }),

  // Migrate single tool
  migrate: (filePath: string, options?: MigrationOptions) =>
    api.post<{
      success: boolean;
      data: MigrationResult;
    }>("/tool-migration/migrate", { filePath, options }),

  // Batch migrate tools
  migrateBatch: (params: {
    toolNames?: string[];
    category?: string;
    options?: MigrationOptions;
  }) =>
    api.post<{
      success: boolean;
      data: {
        summary: {
          total: number;
          completed: number;
          failed: number;
          totalDurationMs: number;
        };
        results: MigrationResult[];
      };
    }>("/tool-migration/migrate-batch", params),

  // Get migration status
  getStatus: (toolName: string) =>
    api.get<{
      success: boolean;
      data: ToolMigrationStatus;
    }>(`/tool-migration/status/${toolName}`),

  // Get recommended tools for migration
  getRecommendations: () =>
    api.get<{
      success: boolean;
      data: {
        recommended: Array<PythonToolAnalysis & { priorityScore: number }>;
        total: number;
        criteria: Record<string, string>;
      };
    }>("/tool-migration/recommendations"),
};
