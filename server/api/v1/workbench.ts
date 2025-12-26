/**
 * ATT&CK Workbench API Routes
 *
 * Provides endpoints for integrating with ATT&CK Workbench,
 * enabling bidirectional sync of techniques, collections, and custom ATT&CK data.
 */

import { Router, Request, Response } from 'express';
import { workbenchClient } from '../../services/attack-workbench-client';
import { db } from '../../../db';
import { attackTechniques, attackTactics } from '../../../shared/schema';
import { eq, inArray } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/v1/workbench/health
 * Test connection to Workbench API
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isHealthy = await workbenchClient.testConnection();

    if (isHealthy) {
      res.json({
        status: 'connected',
        message: 'Workbench API is reachable',
        apiUrl: process.env.WORKBENCH_API_URL || 'http://localhost:3010',
      });
    } else {
      res.status(503).json({
        status: 'disconnected',
        message: 'Unable to reach Workbench API',
        apiUrl: process.env.WORKBENCH_API_URL || 'http://localhost:3010',
      });
    }
  } catch (error) {
    console.error('Workbench health check error:', error);
    res.status(500).json({
      error: 'Failed to check Workbench health',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/workbench/techniques
 * Get all techniques from Workbench
 */
router.get('/techniques', async (req: Request, res: Response) => {
  try {
    const { limit, offset, state, includeRevoked, includeDeprecated } = req.query;

    const techniques = await workbenchClient.getTechniques({
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      state: state as string,
      includeRevoked: includeRevoked === 'true',
      includeDeprecated: includeDeprecated === 'true',
    });

    res.json(techniques);
  } catch (error) {
    console.error('Failed to fetch Workbench techniques:', error);
    res.status(500).json({
      error: 'Failed to fetch techniques from Workbench',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/workbench/techniques/:stixId
 * Get a single technique by STIX ID
 */
router.get('/techniques/:stixId', async (req: Request, res: Response) => {
  try {
    const { stixId } = req.params;
    const technique = await workbenchClient.getTechnique(stixId);

    if (technique) {
      res.json(technique);
    } else {
      res.status(404).json({ error: 'Technique not found in Workbench' });
    }
  } catch (error) {
    console.error('Failed to fetch Workbench technique:', error);
    res.status(500).json({
      error: 'Failed to fetch technique from Workbench',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/workbench/techniques
 * Create a new technique in Workbench
 */
router.post('/techniques', async (req: Request, res: Response) => {
  try {
    const technique = await workbenchClient.createTechnique(req.body);

    if (technique) {
      res.status(201).json(technique);
    } else {
      res.status(400).json({ error: 'Failed to create technique in Workbench' });
    }
  } catch (error) {
    console.error('Failed to create Workbench technique:', error);
    res.status(500).json({
      error: 'Failed to create technique in Workbench',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/workbench/collections
 * Get all collections from Workbench
 */
router.get('/collections', async (req: Request, res: Response) => {
  try {
    const collections = await workbenchClient.getCollections();
    res.json(collections);
  } catch (error) {
    console.error('Failed to fetch Workbench collections:', error);
    res.status(500).json({
      error: 'Failed to fetch collections from Workbench',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/workbench/collections/:stixId
 * Get a single collection by STIX ID
 */
router.get('/collections/:stixId', async (req: Request, res: Response) => {
  try {
    const { stixId } = req.params;
    const collection = await workbenchClient.getCollection(stixId);

    if (collection) {
      res.json(collection);
    } else {
      res.status(404).json({ error: 'Collection not found in Workbench' });
    }
  } catch (error) {
    console.error('Failed to fetch Workbench collection:', error);
    res.status(500).json({
      error: 'Failed to fetch collection from Workbench',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/workbench/collections/:stixId/bundle
 * Get collection bundle (STIX format)
 */
router.get('/collections/:stixId/bundle', async (req: Request, res: Response) => {
  try {
    const { stixId } = req.params;
    const bundle = await workbenchClient.getCollectionBundle(stixId);

    if (bundle) {
      res.json(bundle);
    } else {
      res.status(404).json({ error: 'Collection bundle not found' });
    }
  } catch (error) {
    console.error('Failed to fetch collection bundle:', error);
    res.status(500).json({
      error: 'Failed to fetch collection bundle',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/workbench/collections
 * Create a new collection in Workbench
 */
router.post('/collections', async (req: Request, res: Response) => {
  try {
    const collection = await workbenchClient.createCollection(req.body);

    if (collection) {
      res.status(201).json(collection);
    } else {
      res.status(400).json({ error: 'Failed to create collection in Workbench' });
    }
  } catch (error) {
    console.error('Failed to create Workbench collection:', error);
    res.status(500).json({
      error: 'Failed to create collection in Workbench',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/workbench/sync/push-techniques
 * Push RTPI techniques to Workbench
 */
router.post('/sync/push-techniques', async (req: Request, res: Response) => {
  try {
    const { techniqueIds } = req.body;

    if (!Array.isArray(techniqueIds) || techniqueIds.length === 0) {
      return res.status(400).json({ error: 'techniqueIds array is required' });
    }

    // Fetch techniques from RTPI database
    const techniques = await db
      .select()
      .from(attackTechniques)
      .where(inArray(attackTechniques.id, techniqueIds));

    if (techniques.length === 0) {
      return res.status(404).json({ error: 'No techniques found with provided IDs' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Push each technique to Workbench
    for (const technique of techniques) {
      const result = await workbenchClient.sendTechniqueToWorkbench({
        attackId: technique.attackId,
        name: technique.name,
        description: technique.description || '',
        platforms: technique.platforms as string[],
        dataSources: technique.dataSources as string[],
        tactics: [], // TODO: Fetch tactics from relationships
      });

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(...result.errors);
      }
    }

    res.json({
      message: `Pushed ${results.success} techniques to Workbench`,
      ...results,
    });
  } catch (error) {
    console.error('Failed to push techniques to Workbench:', error);
    res.status(500).json({
      error: 'Failed to push techniques to Workbench',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/workbench/sync/pull-techniques
 * Pull techniques from Workbench to RTPI
 */
router.post('/sync/pull-techniques', async (req: Request, res: Response) => {
  try {
    const result = await workbenchClient.pullTechniquesFromWorkbench();

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to pull techniques from Workbench',
        errors: result.errors,
      });
    }

    // Import techniques into RTPI database
    const imported = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const technique of result.items || []) {
      try {
        // Check if technique already exists
        const existing = await db
          .select()
          .from(attackTechniques)
          .where(eq(attackTechniques.attackId, technique.attackId))
          .limit(1);

        if (existing.length > 0) {
          imported.skipped++;
          continue;
        }

        // Insert new technique
        await db.insert(attackTechniques).values({
          attackId: technique.attackId,
          name: technique.name,
          description: technique.description,
          platforms: technique.platforms,
          dataSources: technique.dataSources,
          isSubtechnique: false,
          url: `https://attack.mitre.org/techniques/${technique.attackId}`,
        });

        imported.success++;
      } catch (error) {
        imported.failed++;
        imported.errors.push(
          `Failed to import ${technique.attackId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    res.json({
      message: `Pulled ${result.synced} techniques from Workbench`,
      synced: result.synced,
      imported: imported.success,
      skipped: imported.skipped,
      failed: imported.failed,
      errors: imported.errors,
    });
  } catch (error) {
    console.error('Failed to pull techniques from Workbench:', error);
    res.status(500).json({
      error: 'Failed to pull techniques from Workbench',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/workbench/groups
 * Get all groups from Workbench
 */
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const groups = await workbenchClient.getGroups();
    res.json(groups);
  } catch (error) {
    console.error('Failed to fetch Workbench groups:', error);
    res.status(500).json({
      error: 'Failed to fetch groups from Workbench',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/workbench/software
 * Get all software from Workbench
 */
router.get('/software', async (req: Request, res: Response) => {
  try {
    const software = await workbenchClient.getSoftware();
    res.json(software);
  } catch (error) {
    console.error('Failed to fetch Workbench software:', error);
    res.status(500).json({
      error: 'Failed to fetch software from Workbench',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/workbench/mitigations
 * Get all mitigations from Workbench
 */
router.get('/mitigations', async (req: Request, res: Response) => {
  try {
    const mitigations = await workbenchClient.getMitigations();
    res.json(mitigations);
  } catch (error) {
    console.error('Failed to fetch Workbench mitigations:', error);
    res.status(500).json({
      error: 'Failed to fetch mitigations from Workbench',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
