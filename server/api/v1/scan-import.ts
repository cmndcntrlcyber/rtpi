/**
 * Scan Import API
 *
 * Endpoints for importing security tool JSON output (BBOT, Nuclei, Nmap, Burp Suite)
 * into the RTPI database, triggering the workflow pipeline.
 */

import { Router } from 'express';
import multer from 'multer';
import { scanImportService } from '../../services/scan-import-service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/**
 * POST /api/v1/scan-import/:operationId/upload
 * Import a security tool JSON file via multipart upload.
 *
 * Form fields:
 *   - file: JSON file (required)
 *   - toolHint: 'bbot' | 'nuclei' | 'nmap' | 'burp' (optional, overrides auto-detection)
 */
router.post('/:operationId/upload', upload.single('file'), async (req, res) => {
  try {
    const { operationId } = req.params;
    const userId = (req as any).user?.id || 'system';
    const toolHint = req.body?.toolHint;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Upload a JSON file as the "file" field.' });
    }

    const content = req.file.buffer.toString('utf-8');

    if (!content.trim()) {
      return res.status(400).json({ error: 'Uploaded file is empty.' });
    }

    const result = await scanImportService.importFile(content, operationId, userId, toolHint);

    res.json(result);
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Import failed';

    if (message.includes('Unable to detect') || message.includes('Invalid JSON')) {
      return res.status(400).json({ error: message });
    }

    console.error('Scan import upload failed:', error);
    res.status(500).json({ error: 'Import failed', message });
  }
});

/**
 * POST /api/v1/scan-import/:operationId/json
 * Import security tool output via JSON body (no file upload needed).
 *
 * Body:
 *   - data: object | array (required) — the raw tool output
 *   - toolHint: 'bbot' | 'nuclei' | 'nmap' | 'burp' (optional)
 */
router.post('/:operationId/json', async (req, res) => {
  try {
    const { operationId } = req.params;
    const userId = (req as any).user?.id || 'system';
    const { data, toolHint } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Request body must include a "data" field with the tool output.' });
    }

    const content = typeof data === 'string' ? data : JSON.stringify(data);

    const result = await scanImportService.importFile(content, operationId, userId, toolHint);

    res.json(result);
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Import failed';

    if (message.includes('Unable to detect') || message.includes('Invalid JSON')) {
      return res.status(400).json({ error: message });
    }

    console.error('Scan import JSON failed:', error);
    res.status(500).json({ error: 'Import failed', message });
  }
});

export default router;
