/**
 * Bug Bounty Import API
 *
 * Endpoints for importing bug bounty program scope files (HackerOne CSV + Burp JSON)
 * into RTPI operations with auto-created targets.
 */

import { Router } from 'express';
import multer from 'multer';
import { bugBountyImportService } from '../../services/bug-bounty-import-service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/**
 * POST /api/v1/bug-bounty-import/from-url
 * Fetch scope files from HackerOne by program slug.
 */
router.post('/from-url', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const { platform, programSlug, operationName, autoActivate, authHeaders } = req.body;

    if (!programSlug) {
      return res.status(400).json({ error: 'programSlug is required.' });
    }

    const result = await bugBountyImportService.importFromUrl(
      programSlug,
      platform || 'hackerone',
      userId,
      { operationName, autoActivate: autoActivate === true, authHeaders }
    );

    res.json(result);
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Import failed';
    console.error('Bug bounty import from-url failed:', error);
    res.status(error.message?.includes('fetch failed') ? 502 : 500).json({ error: message });
  }
});

/**
 * POST /api/v1/bug-bounty-import/upload
 * Upload CSV and/or Burp JSON files directly.
 */
router.post(
  '/upload',
  upload.fields([
    { name: 'csvFile', maxCount: 1 },
    { name: 'burpJsonFile', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = (req as any).user?.id || 'system';
      const files = req.files as Record<string, Express.Multer.File[]>;

      const csvContent = files?.csvFile?.[0]?.buffer?.toString('utf-8');
      const burpContent = files?.burpJsonFile?.[0]?.buffer?.toString('utf-8');

      if (!csvContent && !burpContent) {
        return res.status(400).json({
          error: 'At least one file is required: csvFile (CSV) or burpJsonFile (Burp project config JSON).',
        });
      }

      const { operationName, autoActivate, programSlug } = req.body;

      const result = await bugBountyImportService.importFromFiles(
        { csv: csvContent, burpJson: burpContent },
        userId,
        {
          operationName: operationName || (programSlug ? `Bug Bounty: ${programSlug}` : undefined),
          autoActivate: autoActivate === 'true',
        }
      );

      res.json(result);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Import failed';
      if (message.includes('missing required') || message.includes('empty')) {
        return res.status(400).json({ error: message });
      }
      console.error('Bug bounty import upload failed:', error);
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/v1/bug-bounty-import/preview
 * Parse files without creating any records (dry run).
 */
router.post(
  '/preview',
  upload.fields([
    { name: 'csvFile', maxCount: 1 },
    { name: 'burpJsonFile', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;

      const csvContent = files?.csvFile?.[0]?.buffer?.toString('utf-8');
      const burpContent = files?.burpJsonFile?.[0]?.buffer?.toString('utf-8');

      if (!csvContent && !burpContent) {
        return res.status(400).json({
          error: 'At least one file is required for preview.',
        });
      }

      const scope = bugBountyImportService.preview({ csv: csvContent, burpJson: burpContent });

      const targetsToCreate = scope.inScope.filter(e => e.rtpiTargetType !== null).length;
      const nonTargetableAssets = scope.inScope.filter(e => e.rtpiTargetType === null).length;

      res.json({
        programName: scope.programName,
        platform: scope.platform,
        inScope: scope.inScope,
        outOfScope: scope.outOfScope,
        targetsToCreate,
        nonTargetableAssets,
        burpConfigPresent: !!scope.burpProjectConfig,
      });
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Preview failed';
      if (message.includes('missing required') || message.includes('empty') || message.includes('Invalid')) {
        return res.status(400).json({ error: message });
      }
      console.error('Bug bounty import preview failed:', error);
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/v1/bug-bounty-import/into-operation
 * Import scope files into an existing operation (add targets only).
 */
router.post(
  '/into-operation',
  upload.fields([
    { name: 'csvFile', maxCount: 1 },
    { name: 'burpJsonFile', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = (req as any).user?.id || 'system';
      const files = req.files as Record<string, Express.Multer.File[]>;
      const { operationId } = req.body;

      if (!operationId) {
        return res.status(400).json({ error: 'operationId is required.' });
      }

      const csvContent = files?.csvFile?.[0]?.buffer?.toString('utf-8');
      const burpContent = files?.burpJsonFile?.[0]?.buffer?.toString('utf-8');

      if (!csvContent && !burpContent) {
        return res.status(400).json({
          error: 'At least one file is required: csvFile (CSV) or burpJsonFile (Burp project config JSON).',
        });
      }

      const result = await bugBountyImportService.importIntoExistingOperation(
        { csv: csvContent, burpJson: burpContent },
        operationId,
        userId,
      );

      res.json(result);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Import failed';
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      console.error('Bug bounty import into-operation failed:', error);
      res.status(500).json({ error: message });
    }
  }
);

export default router;
