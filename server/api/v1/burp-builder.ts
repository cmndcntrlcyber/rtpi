import { Router } from 'express';
import multer from 'multer';
import { burpImageBuilder } from '../../services/burp-image-builder';

const router = Router();

// Configure multer for JAR uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.jar')) {
      cb(null, true);
    } else {
      cb(new Error('Only JAR files are allowed'));
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
 * Upload Burp Suite JAR file
 * POST /api/v1/burp-builder/upload
 */
router.post('/upload', upload.single('jarFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No JAR file provided' });
    }

    // Get user ID (from body)
    const userId = req.body.userId || 'default';

    const uploadResult = await burpImageBuilder.processJARUpload(userId, req.file);

    res.json({
      message: 'Burp Suite JAR uploaded successfully',
      upload: uploadResult,
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      error: 'Failed to upload JAR file',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
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
