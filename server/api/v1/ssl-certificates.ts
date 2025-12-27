import { Router } from 'express';
import { sslCertificateManager } from '../../services/ssl-certificate-manager';

const router = Router();

/**
 * SSL Certificate Management API
 *
 * Provides endpoints for managing SSL/TLS certificates via Let's Encrypt.
 * Supports both HTTP-01 and DNS-01 (Cloudflare) challenges.
 *
 * Phase 2: SSL Automation (#KW-11 to #KW-15)
 */

// ============================================================================
// Certificate Issuance (#KW-11)
// ============================================================================

/**
 * Request a new SSL certificate
 * POST /api/v1/ssl-certificates
 */
router.post('/', async (req, res) => {
  try {
    const {
      domain,
      email,
      challengeType = 'http-01',
      cloudflareApiToken,
      dryRun = false,
    } = req.body;

    // Validation
    if (!domain || !email) {
      return res.status(400).json({
        error: 'Domain and email are required',
      });
    }

    if (challengeType === 'dns-01' && !cloudflareApiToken) {
      return res.status(400).json({
        error: 'Cloudflare API token required for DNS-01 challenge',
      });
    }

    // Request certificate
    const certificate = await sslCertificateManager.requestCertificate({
      domain,
      email,
      challengeType: challengeType as 'http-01' | 'dns-01',
      cloudflareApiToken,
      dryRun,
    });

    res.status(201).json({
      message: dryRun ? 'Certificate dry run successful' : 'Certificate issued successfully',
      certificate,
    });
  } catch (error) {
    console.error('[API] Failed to request certificate:', error);
    res.status(500).json({
      error: 'Failed to request certificate',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Certificate Management
// ============================================================================

/**
 * List all certificates
 * GET /api/v1/ssl-certificates
 */
router.get('/', async (_req, res) => {
  try {
    const certificates = await sslCertificateManager.listCertificates();
    res.json(certificates);
  } catch (error) {
    console.error('[API] Failed to list certificates:', error);
    res.status(500).json({
      error: 'Failed to list certificates',
    });
  }
});

/**
 * Get certificate information
 * GET /api/v1/ssl-certificates/:domain
 */
router.get('/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const certificate = await sslCertificateManager.getCertificateInfo(domain);

    res.json(certificate);
  } catch (error) {
    console.error('[API] Failed to get certificate info:', error);
    res.status(404).json({
      error: 'Certificate not found',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Revoke a certificate
 * DELETE /api/v1/ssl-certificates/:domain
 */
router.delete('/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    const { reason } = req.body;

    await sslCertificateManager.revokeCertificate(domain, reason);

    res.json({
      message: `Certificate for ${domain} revoked successfully`,
    });
  } catch (error) {
    console.error('[API] Failed to revoke certificate:', error);
    res.status(500).json({
      error: 'Failed to revoke certificate',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Certificate Renewal (#KW-13)
// ============================================================================

/**
 * Renew expiring certificates
 * POST /api/v1/ssl-certificates/renew
 */
router.post('/renew', async (req, res) => {
  try {
    const { daysBeforeExpiry = 30 } = req.body;
    const results = await sslCertificateManager.renewCertificates(daysBeforeExpiry);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      message: `Renewal complete: ${successCount} successful, ${failureCount} failed`,
      successCount,
      failureCount,
      results,
    });
  } catch (error) {
    console.error('[API] Failed to renew certificates:', error);
    res.status(500).json({
      error: 'Failed to renew certificates',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Renew a specific certificate
 * POST /api/v1/ssl-certificates/:domain/renew
 */
router.post('/:domain/renew', async (req, res) => {
  try {
    const { domain } = req.params;
    await sslCertificateManager.renewCertificate(domain);

    // Get updated certificate info
    const certificate = await sslCertificateManager.getCertificateInfo(domain);

    res.json({
      message: `Certificate for ${domain} renewed successfully`,
      certificate,
    });
  } catch (error) {
    console.error('[API] Failed to renew certificate:', error);
    res.status(500).json({
      error: 'Failed to renew certificate',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Force renew all certificates (for testing)
 * POST /api/v1/ssl-certificates/renew/force
 */
router.post('/renew/force', async (_req, res) => {
  try {
    const results = await sslCertificateManager.forceRenewAll();

    res.json({
      message: 'All certificates force-renewed successfully',
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('[API] Failed to force renew certificates:', error);
    res.status(500).json({
      error: 'Failed to force renew certificates',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Nginx Integration (#KW-14)
// ============================================================================

/**
 * Reload nginx configuration
 * POST /api/v1/ssl-certificates/nginx/reload
 */
router.post('/nginx/reload', async (_req, res) => {
  try {
    await sslCertificateManager.reloadNginx();

    res.json({
      message: 'Nginx reloaded successfully',
    });
  } catch (error) {
    console.error('[API] Failed to reload nginx:', error);
    res.status(500).json({
      error: 'Failed to reload nginx',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Generate nginx SSL configuration
 * GET /api/v1/ssl-certificates/:domain/nginx-config
 */
router.get('/:domain/nginx-config', async (req, res) => {
  try {
    const { domain } = req.params;
    const config = sslCertificateManager.generateNginxSSLConfig(domain);

    res.set('Content-Type', 'text/plain');
    res.send(config);
  } catch (error) {
    console.error('[API] Failed to generate nginx config:', error);
    res.status(500).json({
      error: 'Failed to generate nginx config',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Testing (#KW-15)
// ============================================================================

/**
 * Test certificate rotation
 * POST /api/v1/ssl-certificates/:domain/test-rotation
 */
router.post('/:domain/test-rotation', async (req, res) => {
  try {
    const { domain } = req.params;
    const result = await sslCertificateManager.testCertificateRotation(domain);

    res.json({
      domain,
      success: result.success,
      message: result.success ? 'Certificate rotation test passed' : 'Certificate rotation test failed',
      steps: result.steps,
    });
  } catch (error) {
    console.error('[API] Failed to test certificate rotation:', error);
    res.status(500).json({
      error: 'Failed to test certificate rotation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// System Status
// ============================================================================

/**
 * Get certbot status
 * GET /api/v1/ssl-certificates/status
 */
router.get('/status/certbot', async (_req, res) => {
  try {
    const status = await sslCertificateManager.getCertbotStatus();
    res.json(status);
  } catch (error) {
    console.error('[API] Failed to get certbot status:', error);
    res.status(500).json({
      error: 'Failed to get certbot status',
    });
  }
});

/**
 * Health check for SSL automation
 * GET /api/v1/ssl-certificates/health
 */
router.get('/health/check', async (_req, res) => {
  try {
    const status = await sslCertificateManager.getCertbotStatus();
    const certificates = await sslCertificateManager.listCertificates();

    const expiringCerts = certificates.filter(cert => cert.status === 'expiring-soon');
    const expiredCerts = certificates.filter(cert => cert.status === 'expired');

    res.json({
      status: status.installed ? 'healthy' : 'unavailable',
      certbot: {
        installed: status.installed,
        version: status.version,
      },
      certificates: {
        total: certificates.length,
        valid: certificates.filter(cert => cert.status === 'valid').length,
        expiringSoon: expiringCerts.length,
        expired: expiredCerts.length,
      },
      warnings: [
        ...expiringCerts.map(cert => `Certificate for ${cert.domain} expires in ${cert.daysRemaining} days`),
        ...expiredCerts.map(cert => `Certificate for ${cert.domain} has expired`),
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Failed to check SSL health:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to check SSL health',
    });
  }
});

export default router;
