/**
 * BurpSuite Activation API Endpoints
 * 
 * Handles dual-file upload (JAR + License) and activation workflow
 */

import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { burpActivationService } from '../../services/burp-activation-service';
import { ensureAuthenticated, ensureRole, logAudit } from '../../auth/middleware';

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// Staging directory for large uploads (streams to disk, no RAM buffering)
const BURP_SETUP_STAGING = path.join(
  process.env.BURP_SETUP_DIR || '/tmp/burp-setup',
  '_staging'
);

// Chunked upload directory
const BURP_CHUNK_DIR = path.join(
  process.env.BURP_SETUP_DIR || '/tmp/burp-setup',
  '_chunks'
);

// Track active chunked uploads
const activeChunkedUploads = new Map<string, {
  userId: string;
  fileName: string;
  totalChunks: number;
  totalSize: number;
  receivedChunks: Set<number>;
  createdAt: number;
}>();

// Clean up stale chunked uploads every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [uploadId, meta] of activeChunkedUploads) {
    if (now - meta.createdAt > 3600000) {
      activeChunkedUploads.delete(uploadId);
      const chunkDir = path.join(BURP_CHUNK_DIR, uploadId);
      fs.rm(chunkDir, { recursive: true, force: true }, () => {});
    }
  }
}, 1800000);

// Configure multer for file uploads (disk storage — prevents OOM on large JARs)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(BURP_SETUP_STAGING)) {
      fs.mkdirSync(BURP_SETUP_STAGING, { recursive: true });
    }
    cb(null, BURP_SETUP_STAGING);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'burp-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 800 * 1024 * 1024, // 800MB max (for BurpSuite JAR)
  },
});

// Chunk upload multer (60MB per chunk — within Cloudflare's 100MB limit)
const chunkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(BURP_CHUNK_DIR)) {
      fs.mkdirSync(BURP_CHUNK_DIR, { recursive: true });
    }
    cb(null, BURP_CHUNK_DIR);
  },
  filename: (_req, _file, cb) => {
    cb(null, 'chunk-' + Date.now() + '-' + Math.round(Math.random() * 1e9));
  },
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 60 * 1024 * 1024 },
});

// ============================================================================
// GET /api/v1/burp-activation/status
// Get current activation status
// ============================================================================

router.get('/status', async (req, res) => {
  try {
    const status = await burpActivationService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('[BurpActivation API] Get status failed:', error);
    res.status(500).json({
      error: 'Failed to get activation status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// POST /api/v1/burp-activation/upload-jar
// Upload BurpSuite Pro JAR file
// ============================================================================

router.post('/upload-jar', ensureRole('admin'), upload.single('jar'), async (req, res) => {
  const user = req.user as any;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await burpActivationService.uploadJar(
      req.file.path,
      req.file.originalname,
      req.file.size,
      user.id
    );

    if (result.success) {
      await logAudit(user.id, 'burp_jar_upload', '/burp-activation/upload-jar', null, true, req);
      res.json({
        success: true,
        message: 'JAR file uploaded successfully',
        filename: req.file.originalname,
        size: req.file.size,
      });
    } else {
      await logAudit(user.id, 'burp_jar_upload', '/burp-activation/upload-jar', null, false, req);
      res.status(400).json({
        success: false,
        error: result.error || 'Upload failed',
      });
    }
  } catch (error) {
    console.error('[BurpActivation API] JAR upload failed:', error);
    await logAudit(user.id, 'burp_jar_upload', '/burp-activation/upload-jar', null, false, req);
    res.status(500).json({
      error: 'JAR upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// POST /api/v1/burp-activation/upload-license
// Upload BurpSuite license file
// ============================================================================

router.post('/upload-license', ensureRole('admin'), upload.single('license'), async (req, res) => {
  const user = req.user as any;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await burpActivationService.uploadLicense(
      req.file.path,
      req.file.originalname,
      user.id
    );

    if (result.success) {
      await logAudit(user.id, 'burp_license_upload', '/burp-activation/upload-license', null, true, req);
      res.json({
        success: true,
        message: 'License file uploaded successfully',
        filename: req.file.originalname,
        validation: result.validation,
      });
    } else {
      await logAudit(user.id, 'burp_license_upload', '/burp-activation/upload-license', null, false, req);
      res.status(400).json({
        success: false,
        error: result.error || 'Upload failed',
        validation: result.validation,
      });
    }
  } catch (error) {
    console.error('[BurpActivation API] License upload failed:', error);
    await logAudit(user.id, 'burp_license_upload', '/burp-activation/upload-license', null, false, req);
    res.status(500).json({
      error: 'License upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Chunked JAR Upload — Bypasses Cloudflare's 100MB body limit
// ============================================================================

/**
 * Initialize a chunked upload session
 * POST /api/v1/burp-activation/upload-jar/chunked/init
 */
router.post('/upload-jar/chunked/init', ensureRole('admin'), (req, res) => {
  try {
    const { fileName, totalChunks, totalSize } = req.body;
    const user = req.user as any;

    if (!fileName || !totalChunks || !totalSize) {
      return res.status(400).json({ error: 'fileName, totalChunks, and totalSize are required' });
    }

    if (!fileName.endsWith('.jar') && !fileName.endsWith('.sh')) {
      return res.status(400).json({ error: 'Only .jar and .sh files are allowed' });
    }

    if (totalSize > 800 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (max 800MB)' });
    }

    const uploadId = randomUUID();
    const chunkDir = path.join(BURP_CHUNK_DIR, uploadId);
    fs.mkdirSync(chunkDir, { recursive: true });

    activeChunkedUploads.set(uploadId, {
      userId: user.id,
      fileName,
      totalChunks: Number(totalChunks),
      totalSize: Number(totalSize),
      receivedChunks: new Set(),
      createdAt: Date.now(),
    });

    console.log(`[BurpActivation] Chunked upload initialized: ${uploadId} (${totalChunks} chunks, ${(totalSize / 1024 / 1024).toFixed(1)}MB)`);

    res.json({ uploadId, totalChunks: Number(totalChunks) });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to initialize chunked upload', message: error.message });
  }
});

/**
 * Complete a chunked upload — reassemble chunks and process
 * POST /api/v1/burp-activation/upload-jar/chunked/:uploadId/complete
 */
router.post('/upload-jar/chunked/:uploadId/complete', ensureRole('admin'), async (req, res) => {
  const { uploadId } = req.params;
  const meta = activeChunkedUploads.get(uploadId);
  const user = req.user as any;

  if (!meta) {
    return res.status(404).json({ error: 'Upload session not found or expired' });
  }

  if (meta.receivedChunks.size !== meta.totalChunks) {
    return res.status(400).json({
      error: `Missing chunks: received ${meta.receivedChunks.size}/${meta.totalChunks}`,
    });
  }

  try {
    const chunkDir = path.join(BURP_CHUNK_DIR, uploadId);

    if (!fs.existsSync(BURP_SETUP_STAGING)) {
      fs.mkdirSync(BURP_SETUP_STAGING, { recursive: true });
    }

    // Reassemble chunks using streaming (no full-file RAM)
    const assembledPath = path.join(BURP_SETUP_STAGING, `burp-${uploadId}${path.extname(meta.fileName)}`);
    const writeStream = fs.createWriteStream(assembledPath);

    for (let i = 0; i < meta.totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk-${String(i).padStart(5, '0')}`);
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath);
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', resolve);
        readStream.on('error', reject);
      });
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      writeStream.end();
    });

    // Clean up chunks
    fs.rmSync(chunkDir, { recursive: true, force: true });
    activeChunkedUploads.delete(uploadId);

    const stats = fs.statSync(assembledPath);
    console.log(`[BurpActivation] Chunks reassembled: ${assembledPath} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);

    // Process through activation service
    const result = await burpActivationService.uploadJar(
      assembledPath,
      meta.fileName,
      stats.size,
      meta.userId
    );

    if (result.success) {
      await logAudit(user.id, 'burp_jar_upload', '/burp-activation/upload-jar/chunked', null, true, req);
      res.json({
        success: true,
        message: 'JAR uploaded successfully (chunked)',
        filename: meta.fileName,
        size: stats.size,
      });
    } else {
      await logAudit(user.id, 'burp_jar_upload', '/burp-activation/upload-jar/chunked', null, false, req);
      res.status(400).json({ success: false, error: result.error || 'Upload failed' });
    }
  } catch (error: any) {
    const chunkDir = path.join(BURP_CHUNK_DIR, uploadId);
    fs.rm(chunkDir, { recursive: true, force: true }, () => {});
    activeChunkedUploads.delete(uploadId);

    res.status(500).json({ error: 'Failed to reassemble and process JAR', message: error.message });
  }
});

/**
 * Upload a single chunk
 * POST /api/v1/burp-activation/upload-jar/chunked/:uploadId/:chunkIndex
 */
router.post('/upload-jar/chunked/:uploadId/:chunkIndex', ensureRole('admin'), (req, res, next) => {
  chunkUpload.single('chunk')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: 'Chunk upload error', message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.params;
    const idx = Number(chunkIndex);
    const meta = activeChunkedUploads.get(uploadId);

    if (!meta) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Upload session not found or expired' });
    }

    if (idx < 0 || idx >= meta.totalChunks) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `Invalid chunk index: ${idx}` });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No chunk data provided' });
    }

    // Move chunk to ordered location
    const chunkDir = path.join(BURP_CHUNK_DIR, uploadId);
    const chunkPath = path.join(chunkDir, `chunk-${String(idx).padStart(5, '0')}`);
    fs.renameSync(req.file.path, chunkPath);

    meta.receivedChunks.add(idx);

    res.json({
      uploadId,
      chunkIndex: idx,
      received: meta.receivedChunks.size,
      total: meta.totalChunks,
      complete: meta.receivedChunks.size === meta.totalChunks,
    });
  } catch (error: any) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to store chunk', message: error.message });
  }
});

// ============================================================================
// POST /api/v1/burp-activation/activate
// Activate BurpSuite (trigger container activation)
// ============================================================================

router.post('/activate', ensureRole('admin'), async (req, res) => {
  const user = req.user as any;
  
  try {
    const result = await burpActivationService.activate(user.id);

    if (result.success) {
      await logAudit(user.id, 'burp_activate', '/burp-activation/activate', null, true, req);
      res.json({
        success: true,
        status: result.status,
        message: result.message,
        mcpUrl: result.mcpUrl,
      });
    } else {
      await logAudit(user.id, 'burp_activate', '/burp-activation/activate', null, false, req);
      res.status(400).json({
        success: false,
        status: result.status,
        message: result.message,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('[BurpActivation API] Activation failed:', error);
    await logAudit(user.id, 'burp_activate', '/burp-activation/activate', null, false, req);
    res.status(500).json({
      error: 'Activation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// POST /api/v1/burp-activation/deactivate
// Deactivate BurpSuite (stop container)
// ============================================================================

router.post('/deactivate', ensureRole('admin'), async (req, res) => {
  const user = req.user as any;
  
  try {
    const result = await burpActivationService.deactivate();

    if (result.success) {
      await logAudit(user.id, 'burp_deactivate', '/burp-activation/deactivate', null, true, req);
      res.json({
        success: true,
        message: 'BurpSuite deactivated successfully',
      });
    } else {
      await logAudit(user.id, 'burp_deactivate', '/burp-activation/deactivate', null, false, req);
      res.status(400).json({
        success: false,
        error: result.error || 'Deactivation failed',
      });
    }
  } catch (error) {
    console.error('[BurpActivation API] Deactivation failed:', error);
    await logAudit(user.id, 'burp_deactivate', '/burp-activation/deactivate', null, false, req);
    res.status(500).json({
      error: 'Deactivation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// DELETE /api/v1/burp-activation/jar
// Remove JAR file
// ============================================================================

router.delete('/jar', ensureRole('admin'), async (req, res) => {
  const user = req.user as any;
  
  try {
    const result = await burpActivationService.removeJar();

    if (result.success) {
      await logAudit(user.id, 'burp_jar_remove', '/burp-activation/jar', null, true, req);
      res.json({
        success: true,
        message: 'JAR file removed successfully',
      });
    } else {
      await logAudit(user.id, 'burp_jar_remove', '/burp-activation/jar', null, false, req);
      res.status(400).json({
        success: false,
        error: result.error || 'Removal failed',
      });
    }
  } catch (error) {
    console.error('[BurpActivation API] JAR removal failed:', error);
    await logAudit(user.id, 'burp_jar_remove', '/burp-activation/jar', null, false, req);
    res.status(500).json({
      error: 'JAR removal failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// DELETE /api/v1/burp-activation/license
// Remove license file
// ============================================================================

router.delete('/license', ensureRole('admin'), async (req, res) => {
  const user = req.user as any;
  
  try {
    const result = await burpActivationService.removeLicense();

    if (result.success) {
      await logAudit(user.id, 'burp_license_remove', '/burp-activation/license', null, true, req);
      res.json({
        success: true,
        message: 'License file removed successfully',
      });
    } else {
      await logAudit(user.id, 'burp_license_remove', '/burp-activation/license', null, false, req);
      res.status(400).json({
        success: false,
        error: result.error || 'Removal failed',
      });
    }
  } catch (error) {
    console.error('[BurpActivation API] License removal failed:', error);
    await logAudit(user.id, 'burp_license_remove', '/burp-activation/license', null, false, req);
    res.status(500).json({
      error: 'License removal failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// GET /api/v1/burp-activation/health
// Check MCP server health
// ============================================================================

router.get('/health', async (req, res) => {
  try {
    const healthy = await burpActivationService.checkMCPHealth();
    res.json({
      healthy,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[BurpActivation API] Health check failed:', error);
    res.status(500).json({
      healthy: false,
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

export default router;
