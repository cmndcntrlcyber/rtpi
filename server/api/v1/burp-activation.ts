/**
 * BurpSuite Activation API Endpoints
 * 
 * Handles dual-file upload (JAR + License) and activation workflow
 */

import { Router } from 'express';
import multer from 'multer';
import { burpActivationService } from '../../services/burp-activation-service';
import { ensureAuthenticated, ensureRole, logAudit } from '../../auth/middleware';

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 800 * 1024 * 1024, // 800MB max (for BurpSuite JAR)
  },
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
      req.file.buffer,
      req.file.originalname,
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
      req.file.buffer,
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
