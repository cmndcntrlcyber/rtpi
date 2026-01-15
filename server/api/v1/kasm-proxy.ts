import { Router } from 'express';
import { kasmNginxManager } from '../../services/kasm-nginx-manager';

const router = Router();

/**
 * Kasm Proxy Management API
 * Provides endpoints for managing nginx proxy routes for:
 * - Empire C2 listeners
 * - Kasm Workspaces
 */

// ============================================================================
// Proxy Route Management
// ============================================================================

/**
 * List all proxy routes
 * GET /api/v1/kasm-proxy/routes
 */
router.get('/routes', async (_req, res) => {
  try {
    const routes = await kasmNginxManager.listAllProxyRoutes();
    res.json(routes);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to list proxy routes' });
  }
});

/**
 * List Empire listener proxy routes
 * GET /api/v1/kasm-proxy/routes/empire
 */
router.get('/routes/empire', async (_req, res) => {
  try {
    const routes = await kasmNginxManager.listProxyRoutes();
    res.json(routes);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to list Empire proxy routes' });
  }
});

/**
 * List workspace proxy routes
 * GET /api/v1/kasm-proxy/routes/workspaces
 */
router.get('/routes/workspaces', async (_req, res) => {
  try {
    const routes = await kasmNginxManager.listWorkspaceProxyRoutes();
    res.json(routes);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to list workspace proxy routes' });
  }
});

/**
 * Get specific proxy route by ID
 * GET /api/v1/kasm-proxy/routes/:type/:id
 */
router.get('/routes/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type !== 'empire-listener' && type !== 'kasm-workspace') {
      return res.status(400).json({
        error: 'Invalid route type. Must be "empire-listener" or "kasm-workspace"'
      });
    }

    const route = await kasmNginxManager.getProxyRouteById(id, type as any);

    if (!route) {
      return res.status(404).json({ error: 'Proxy route not found' });
    }

    res.json(route);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to get proxy route' });
  }
});

// ============================================================================
// Callback URL Management (#KW-33)
// ============================================================================

/**
 * Get callback URL for a route
 * GET /api/v1/kasm-proxy/callbacks/:routeId
 */
router.get('/callbacks/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const callbackUrl = kasmNginxManager.getCallbackUrl(routeId);

    if (!callbackUrl) {
      return res.status(404).json({ error: 'Callback URL not found' });
    }

    res.json({ routeId, callbackUrl });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to get callback URL' });
  }
});

/**
 * List all callback URLs
 * GET /api/v1/kasm-proxy/callbacks
 */
router.get('/callbacks', async (_req, res) => {
  try {
    const callbackUrls = kasmNginxManager.getAllCallbackUrls();
    const formatted = Array.from(callbackUrls.entries()).map(([routeId, url]) => ({
      routeId,
      callbackUrl: url,
    }));

    res.json(formatted);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to list callback URLs' });
  }
});

/**
 * Update callback URL for a route
 * PUT /api/v1/kasm-proxy/callbacks/:routeId
 */
router.put('/callbacks/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const { callbackUrl } = req.body;

    if (!callbackUrl) {
      return res.status(400).json({ error: 'callbackUrl is required' });
    }

    kasmNginxManager.updateCallbackUrl(routeId, callbackUrl);

    res.json({ routeId, callbackUrl });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to update callback URL' });
  }
});

// ============================================================================
// Access Logging (#KW-35)
// ============================================================================

/**
 * Get access logs
 * GET /api/v1/kasm-proxy/logs
 */
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await kasmNginxManager.getAccessLogs(limit);

    res.json(logs);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to get access logs' });
  }
});

/**
 * Get access logs for a specific subdomain
 * GET /api/v1/kasm-proxy/logs/:subdomain
 */
router.get('/logs/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await kasmNginxManager.getAccessLogsBySubdomain(subdomain, limit);

    res.json(logs);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to get access logs for subdomain' });
  }
});

/**
 * Rotate access logs
 * POST /api/v1/kasm-proxy/logs/rotate
 */
router.post('/logs/rotate', async (req, res) => {
  try {
    const daysToKeep = parseInt(req.body.daysToKeep) || 7;
    await kasmNginxManager.rotateAccessLogs(daysToKeep);

    res.json({ message: `Access logs rotated, kept last ${daysToKeep} days` });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to rotate access logs' });
  }
});

// ============================================================================
// Proxy Statistics
// ============================================================================

/**
 * Get proxy statistics
 * GET /api/v1/kasm-proxy/stats
 */
router.get('/stats', async (_req, res) => {
  try {
    const stats = await kasmNginxManager.getProxyStats();
    res.json(stats);
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to get proxy stats' });
  }
});

// ============================================================================
// Nginx Configuration Management
// ============================================================================

/**
 * Test nginx configuration
 * GET /api/v1/kasm-proxy/config/test
 */
router.get('/config/test', async (_req, res) => {
  try {
    const isValid = await kasmNginxManager.testConfiguration();
    res.json({ valid: isValid });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: 'Failed to test nginx configuration' });
  }
});

/**
 * Health check for proxy service
 * GET /api/v1/kasm-proxy/health
 */
router.get('/health', async (_req, res) => {
  try {
    const isValid = await kasmNginxManager.testConfiguration();
    const stats = await kasmNginxManager.getProxyStats();

    res.json({
      status: isValid ? 'healthy' : 'unhealthy',
      configValid: isValid,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to check proxy health'
    });
  }
});

export default router;
