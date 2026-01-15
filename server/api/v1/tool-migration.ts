/**
 * Tool Migration API Endpoints
 * REST API for analyzing and migrating Python tools from offsec-team
 */

import express from 'express';
import type { Request, Response } from 'express';
import {
  analyzePythonTool,
  analyzeToolsDirectory,
  analyzeOffSecTeamTools,
  type PythonToolAnalysis,
} from '../../services/tool-analyzer';
import {
  migrateTool,
  batchMigrateTools,
  getMigrationStatus,
  type MigrationOptions,
} from '../../services/tool-migration-service';
import path from 'path';

const router = express.Router();

/**
 * GET /api/v1/tool-migration/analyze
 * Analyze all offsec-team tools
 */
router.get('/analyze', async (_req: Request, res: Response) => {
  try {
    const toolsByCategory = await analyzeOffSecTeamTools();

    const summary = {
      totalTools: 0,
      byCategory: {} as Record<string, number>,
      byComplexity: {
        low: 0,
        medium: 0,
        high: 0,
        'very-high': 0,
      },
      tools: [] as PythonToolAnalysis[],
    };

    for (const [category, tools] of toolsByCategory.entries()) {
      summary.byCategory[category] = tools.length;
      summary.totalTools += tools.length;

      for (const tool of tools) {
        summary.byComplexity[tool.complexity]++;
        summary.tools.push(tool);
      }
    }

    res.json({
      success: true,
      data: {
        summary,
        toolsByCategory: Object.fromEntries(toolsByCategory),
      },
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      success: false,
      error: 'Failed to analyze tools',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/v1/tool-migration/analyze-file
 * Analyze a specific Python tool file
 */
router.post('/analyze-file', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath is required',
      });
    }

    const analysis = await analyzePythonTool(filePath);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      success: false,
      error: 'Failed to analyze file',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/v1/tool-migration/analyze-directory
 * Analyze all tools in a directory
 */
router.post('/analyze-directory', async (req: Request, res: Response) => {
  try {
    const { dirPath } = req.body;

    if (!dirPath) {
      return res.status(400).json({
        success: false,
        error: 'dirPath is required',
      });
    }

    const tools = await analyzeToolsDirectory(dirPath);

    res.json({
      success: true,
      data: {
        count: tools.length,
        tools,
      },
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      success: false,
      error: 'Failed to analyze directory',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/v1/tool-migration/migrate
 * Migrate a single tool
 */
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    const { filePath, options } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath is required',
      });
    }

    // Analyze the tool
    const analysis = await analyzePythonTool(filePath);

    // Migrate it
    const migrationOptions: MigrationOptions = {
      installDependencies: options?.installDependencies ?? true,
      runTests: options?.runTests ?? false,
      registerInDatabase: options?.registerInDatabase ?? true,
      generateWrapper: options?.generateWrapper ?? true,
      overwriteExisting: options?.overwriteExisting ?? false,
    };

    const result = await migrateTool(analysis, migrationOptions);

    if (result.status === 'completed') {
      res.json({
        success: true,
        data: result,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Migration failed',
        data: result,
      });
    }
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/v1/tool-migration/migrate-batch
 * Migrate multiple tools
 */
router.post('/migrate-batch', async (req: Request, res: Response) => {
  try {
    const { toolNames, category, options } = req.body;

    if (!toolNames && !category) {
      return res.status(400).json({
        success: false,
        error: 'Either toolNames array or category is required',
      });
    }

    let analyses: PythonToolAnalysis[] = [];

    if (category) {
      // Migrate all tools in a category
      const toolsBasePath = path.join(process.cwd(), 'tools', 'offsec-team', 'tools');
      const categoryPath = path.join(toolsBasePath, category);
      analyses = await analyzeToolsDirectory(categoryPath);
    } else {
      // Migrate specific tools
      const toolsBasePath = path.join(process.cwd(), 'tools', 'offsec-team', 'tools');

      for (const toolName of toolNames) {
        // Try to find the tool in all categories
        const categories = ['bug_hunter', 'burpsuite_operator', 'daedelu5', 'nexus_kamuy', 'rt_dev'];

        for (const cat of categories) {
          const filePath = path.join(toolsBasePath, cat, `${toolName}.py`);

          try {
            const analysis = await analyzePythonTool(filePath);
            analyses.push(analysis);
            break;
          } catch {
            // Tool not in this category, try next
          }
        }
      }
    }

    if (analyses.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No tools found to migrate',
      });
    }

    const migrationOptions: MigrationOptions = {
      installDependencies: options?.installDependencies ?? true,
      runTests: options?.runTests ?? false,
      registerInDatabase: options?.registerInDatabase ?? true,
      generateWrapper: options?.generateWrapper ?? true,
      overwriteExisting: options?.overwriteExisting ?? false,
    };

    const results = await batchMigrateTools(analyses, migrationOptions);

    const summary = {
      total: results.length,
      completed: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      totalDurationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    };

    res.json({
      success: true,
      data: {
        summary,
        results,
      },
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      success: false,
      error: 'Batch migration failed',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/v1/tool-migration/status/:toolName
 * Get migration status for a tool
 */
router.get('/status/:toolName', async (req: Request, res: Response) => {
  try {
    const { toolName } = req.params;

    const status = await getMigrationStatus(toolName);

    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      success: false,
      error: 'Failed to check migration status',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/v1/tool-migration/recommendations
 * Get recommended tools for migration based on priority
 */
router.get('/recommendations', async (_req: Request, res: Response) => {
  try {
    const toolsByCategory = await analyzeOffSecTeamTools();
    const allTools: PythonToolAnalysis[] = [];

    for (const tools of toolsByCategory.values()) {
      allTools.push(...tools);
    }

    // Priority scoring
    const scoredTools = allTools.map(tool => {
      let score = 0;

      // Category priority
      if (tool.category === 'scanning' || tool.category === 'web-application') {
        score += 5;
      }

      // Complexity (lower is better for quick wins)
      const complexityScore = {
        'low': 4,
        'medium': 3,
        'high': 2,
        'very-high': 1,
      };
      score += complexityScore[tool.complexity];

      // Has tests
      if (tool.hasTests) {
        score += 2;
      }

      // Doesn't require external services
      if (!tool.requiresExternalServices) {
        score += 3;
      }

      // Specific high-value tools
      const highValueTools = [
        'WebVulnerabilityTester',
        'BurpSuiteAPIClient',
        'VulnerabilityReportGenerator',
        'BurpScanOrchestrator',
      ];
      if (highValueTools.includes(tool.className)) {
        score += 5;
      }

      return {
        ...tool,
        priorityScore: score,
      };
    });

    // Sort by priority score (highest first)
    scoredTools.sort((a, b) => b.priorityScore - a.priorityScore);

    // Get top 16 tools
    const recommended = scoredTools.slice(0, 16);

    res.json({
      success: true,
      data: {
        recommended,
        total: scoredTools.length,
        criteria: {
          categoryPriority: 'scanning and web-application get +5 points',
          complexityBonus: 'lower complexity gets more points (low=4, medium=3, high=2, very-high=1)',
          hasTests: '+2 points',
          noExternalServices: '+3 points',
          highValueTools: '+5 points for specific critical tools',
        },
      },
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      message: (error as Error).message,
    });
  }
});

export default router;
