import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { burpImageBuilder } from '../../services/burp-image-builder';

const router = Router();

// Burp JAR upload staging directory (same filesystem as final dest for O(1) rename)
const BURP_UPLOAD_STAGING = path.join(
  process.env.BURP_UPLOAD_DIR || '/tmp/burp-uploads',
  '_staging'
);

// Chunked upload directory
const BURP_CHUNK_DIR = path.join(
  process.env.BURP_UPLOAD_DIR || '/tmp/burp-uploads',
  '_chunks'
);

// Track active chunked uploads (uploadId → metadata)
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
    if (now - meta.createdAt > 3600000) { // 1 hour
      activeChunkedUploads.delete(uploadId);
      const chunkDir = path.join(BURP_CHUNK_DIR, uploadId);
      fs.rm(chunkDir, { recursive: true, force: true }, () => {});
    }
  }
}, 1800000);

// Configure multer for JAR uploads using disk storage (streams to disk, no RAM buffering)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(BURP_UPLOAD_STAGING)) {
      fs.mkdirSync(BURP_UPLOAD_STAGING, { recursive: true });
    }
    cb(null, BURP_UPLOAD_STAGING);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'burp-jar-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 800 * 1024 * 1024, // 800MB -- headroom for future JAR versions
  },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.jar') || file.originalname.endsWith('.sh')) {
      cb(null, true);
    } else {
      cb(new Error('Only JAR and .sh installer files are allowed'));
    }
  },
});

/**
 * Burp Suite Image Builder API
 *
 * Handles JAR uploads and dynamic Docker image building for Burp Suite workspaces.
 *
 * Phase 3: Workspace Images (#KW-20, #KW-21)
 */

// ============================================================================
// JAR Upload (#KW-21)
// ============================================================================

/**
 * Upload endpoint info (GET returns usage info, POST handles file upload)
 * GET /api/v1/burp-builder/upload
 */
router.get('/upload', (_req, res) => {
  res.json({
    endpoint: 'POST /api/v1/burp-builder/upload',
    method: 'POST',
    contentType: 'multipart/form-data',
    fields: {
      jarFile: 'BurpSuite Pro .jar file (required, max 800MB)',
      userId: 'User identifier (optional, defaults to "default")',
    },
    maxFileSize: '800MB',
    status: 'ready',
  });
});

/**
 * Upload Burp Suite JAR file
 * POST /api/v1/burp-builder/upload
 */
router.post('/upload', (req, res, next) => {
  upload.single('jarFile')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'File too large',
            message: 'JAR file exceeds the 800MB size limit',
          });
        }
        return res.status(400).json({
          error: 'Upload error',
          message: err.message,
        });
      }
      // Custom fileFilter error
      return res.status(400).json({
        error: 'Invalid file',
        message: err.message,
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No JAR file provided' });
    }

    const userId = req.body.userId || 'default';

    const uploadResult = await burpImageBuilder.processJARUpload(userId, req.file);

    res.json({
      message: 'Burp Suite JAR uploaded successfully',
      upload: uploadResult,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to upload JAR file',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Chunked Upload — Bypasses Cloudflare's 100MB body limit
// ============================================================================

// Multer for chunk uploads (50MB per chunk)
const chunkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(BURP_CHUNK_DIR)) {
      fs.mkdirSync(BURP_CHUNK_DIR, { recursive: true });
    }
    cb(null, BURP_CHUNK_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, 'chunk-' + Date.now() + '-' + Math.round(Math.random() * 1e9));
  },
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB per chunk (headroom within CF 100MB limit)
});

/**
 * Initialize a chunked upload session
 * POST /api/v1/burp-builder/upload/chunked/init
 */
router.post('/upload/chunked/init', (req, res) => {
  try {
    const { userId, fileName, totalChunks, totalSize } = req.body;

    if (!fileName || !totalChunks || !totalSize) {
      return res.status(400).json({ error: 'fileName, totalChunks, and totalSize are required' });
    }

    if (!fileName.endsWith('.jar') && !fileName.endsWith('.sh')) {
      return res.status(400).json({ error: 'Only JAR and .sh installer files are allowed' });
    }

    if (totalSize > 800 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (max 800MB)' });
    }

    const uploadId = randomUUID();
    const chunkDir = path.join(BURP_CHUNK_DIR, uploadId);
    fs.mkdirSync(chunkDir, { recursive: true });

    activeChunkedUploads.set(uploadId, {
      userId: userId || 'default',
      fileName,
      totalChunks: Number(totalChunks),
      totalSize: Number(totalSize),
      receivedChunks: new Set(),
      createdAt: Date.now(),
    });

    console.log(`[Burp Builder] Chunked upload initialized: ${uploadId} (${totalChunks} chunks, ${(totalSize / 1024 / 1024).toFixed(1)}MB)`);

    res.json({ uploadId, chunkDir: uploadId, totalChunks: Number(totalChunks) });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to initialize chunked upload', message: error.message });
  }
});

/**
 * Complete a chunked upload — reassemble chunks and process the JAR
 * IMPORTANT: This route must be defined BEFORE /:chunkIndex to avoid "complete" matching as a chunk index
 * POST /api/v1/burp-builder/upload/chunked/:uploadId/complete
 */
router.post('/upload/chunked/:uploadId/complete', async (req, res) => {
  const { uploadId } = req.params;
  const meta = activeChunkedUploads.get(uploadId);

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

    // Ensure staging dir exists
    if (!fs.existsSync(BURP_UPLOAD_STAGING)) {
      fs.mkdirSync(BURP_UPLOAD_STAGING, { recursive: true });
    }

    // Reassemble chunks into a single file in staging using streaming (no full-file RAM)
    const assembledPath = path.join(BURP_UPLOAD_STAGING, `burp-jar-${uploadId}.jar`);
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

    // Clean up chunk directory
    fs.rmSync(chunkDir, { recursive: true, force: true });
    activeChunkedUploads.delete(uploadId);

    // Get assembled file stats
    const stats = fs.statSync(assembledPath);

    console.log(`[Burp Builder] Chunks reassembled: ${assembledPath} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);

    // Process as a regular multer-style file object
    const fakeMulterFile: Express.Multer.File = {
      fieldname: 'jarFile',
      originalname: meta.fileName,
      encoding: '7bit',
      mimetype: 'application/java-archive',
      destination: BURP_UPLOAD_STAGING,
      filename: path.basename(assembledPath),
      path: assembledPath,
      size: stats.size,
      stream: null as any,
      buffer: null as any,
    };

    const uploadResult = await burpImageBuilder.processJARUpload(meta.userId, fakeMulterFile);

    res.json({
      message: 'Burp Suite JAR uploaded successfully (chunked)',
      upload: uploadResult,
    });
  } catch (error: any) {
    // Clean up on error
    const chunkDir = path.join(BURP_CHUNK_DIR, uploadId);
    fs.rm(chunkDir, { recursive: true, force: true }, () => {});
    activeChunkedUploads.delete(uploadId);

    res.status(500).json({
      error: 'Failed to reassemble and process JAR',
      message: error.message,
    });
  }
});

/**
 * Upload a single chunk
 * POST /api/v1/burp-builder/upload/chunked/:uploadId/:chunkIndex
 */
router.post('/upload/chunked/:uploadId/:chunkIndex', (req, res, next) => {
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

    // Move chunk to the upload's chunk directory with ordered filename
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

/**
 * Get uploaded JAR info
 * GET /api/v1/burp-builder/upload/:userId
 */
router.get('/upload/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const jarInfo = await burpImageBuilder.getUploadedJAR(userId);

    if (!jarInfo) {
      return res.status(404).json({ error: 'No JAR uploaded for this user' });
    }

    res.json(jarInfo);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to get JAR info' });
  }
});

/**
 * Delete uploaded JAR
 * DELETE /api/v1/burp-builder/upload/:userId
 */
router.delete('/upload/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    await burpImageBuilder.deleteUploadedJAR(userId);

    res.json({ message: 'JAR deleted successfully' });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to delete JAR' });
  }
});

// ============================================================================
// Image Building (#KW-20)
// ============================================================================

/**
 * Build Burp Suite Docker image
 * POST /api/v1/burp-builder/build/:userId
 */
router.post('/build/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if JAR is uploaded
    const jarInfo = await burpImageBuilder.getUploadedJAR(userId);
    if (!jarInfo) {
      return res.status(400).json({
        error: 'No Burp Suite JAR uploaded. Please upload a JAR first.',
      });
    }

    // Build image
    const buildResult = await burpImageBuilder.buildBurpImage(userId);

    if (!buildResult.success) {
      return res.status(500).json({
        error: 'Image build failed',
        ...buildResult,
      });
    }

    res.json({
      message: 'Burp Suite image built successfully',
      ...buildResult,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      error: 'Failed to build image',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Image Management
// ============================================================================

/**
 * List Burp images for user
 * GET /api/v1/burp-builder/images/:userId
 */
router.get('/images/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const images = await burpImageBuilder.listUserBurpImages(userId);

    res.json(images);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to list images' });
  }
});

/**
 * Get Burp image info
 * GET /api/v1/burp-builder/images/:imageName/:imageTag
 */
router.get('/images/:imageName/:imageTag', async (req, res) => {
  try {
    const { imageName, imageTag } = req.params;

    const imageInfo = await burpImageBuilder.getBurpImageInfo(imageName, imageTag);

    if (!imageInfo) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json(imageInfo);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to get image info' });
  }
});

/**
 * Delete Burp image
 * DELETE /api/v1/burp-builder/images/:imageName/:imageTag
 */
router.delete('/images/:imageName/:imageTag', async (req, res) => {
  try {
    const { imageName, imageTag } = req.params;

    await burpImageBuilder.deleteBurpImage(imageName, imageTag);

    res.json({ message: 'Image deleted successfully' });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ============================================================================
// Health Check
// ============================================================================

/**
 * Health check for Burp builder
 * GET /api/v1/burp-builder/health
 */
router.get('/health', async (_req, res) => {
  try {
    res.json({
      status: 'healthy',
      service: 'Burp Suite Image Builder',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
    });
  }
});

export default router;
