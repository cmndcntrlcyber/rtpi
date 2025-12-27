import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * SSL Certificate Manager
 *
 * Manages SSL/TLS certificates for Kasm Workspaces using Let's Encrypt.
 * Supports both HTTP-01 and DNS-01 challenges (Cloudflare DNS).
 *
 * Phase 2: SSL Automation (#KW-11 to #KW-15)
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface CertificateInfo {
  domain: string;
  issuer: string;
  validFrom: Date;
  validUntil: Date;
  daysRemaining: number;
  status: 'valid' | 'expiring-soon' | 'expired';
  certificatePath: string;
  keyPath: string;
  chainPath?: string;
}

export interface CertificateRequest {
  domain: string;
  email: string;
  challengeType: 'http-01' | 'dns-01';
  cloudflareApiToken?: string;
  dryRun?: boolean;
}

export interface RenewalResult {
  domain: string;
  success: boolean;
  message: string;
  timestamp: Date;
}

export interface CertbotStatus {
  installed: boolean;
  version?: string;
  certificateCount: number;
  certificates: Array<{
    domain: string;
    expiryDate: string;
    daysRemaining: number;
  }>;
}

// ============================================================================
// SSL Certificate Manager Class
// ============================================================================

class SSLCertificateManager {
  private certbotContainer = process.env.CERTBOT_CONTAINER || 'rtpi-certbot';
  private nginxContainer = process.env.KASM_NGINX_CONTAINER || 'rtpi-kasm-proxy';
  private certPath = '/etc/letsencrypt/live';
  private webroot = '/var/www/certbot';
  private cloudflareCredFile = '/etc/letsencrypt/cloudflare.ini';

  constructor() {
    this.initialize();
  }

  /**
   * Initialize SSL certificate manager
   */
  private async initialize(): Promise<void> {
    console.log('[SSL Certificate Manager] Initializing...');

    try {
      // Check if certbot is available
      const status = await this.getCertbotStatus();

      if (status.installed) {
        console.log(`[SSL Certificate Manager] Certbot version ${status.version} detected`);
        console.log(`[SSL Certificate Manager] Managing ${status.certificateCount} certificate(s)`);
      } else {
        console.warn('[SSL Certificate Manager] Certbot not available - SSL automation disabled');
      }
    } catch (error) {
      console.error('[SSL Certificate Manager] Initialization warning:', error);
    }
  }

  // ============================================================================
  // Certificate Issuance (#KW-11)
  // ============================================================================

  /**
   * Request a new SSL certificate from Let's Encrypt
   */
  async requestCertificate(request: CertificateRequest): Promise<CertificateInfo> {
    console.log(`[SSL] Requesting certificate for ${request.domain}...`);

    // Validate request
    if (!request.domain || !request.email) {
      throw new Error('Domain and email are required');
    }

    if (request.challengeType === 'dns-01' && !request.cloudflareApiToken) {
      throw new Error('Cloudflare API token required for DNS-01 challenge');
    }

    try {
      // Prepare certbot command based on challenge type
      let certbotCmd: string;

      if (request.challengeType === 'dns-01') {
        // DNS-01 challenge with Cloudflare (#KW-12)
        await this.setupCloudflareCredentials(request.cloudflareApiToken!);

        certbotCmd = [
          'certbot certonly',
          '--dns-cloudflare',
          `--dns-cloudflare-credentials ${this.cloudflareCredFile}`,
          `--email ${request.email}`,
          `-d ${request.domain}`,
          `-d *.${request.domain}`,  // Wildcard certificate
          '--agree-tos',
          '--non-interactive',
          request.dryRun ? '--dry-run' : '',
        ].filter(Boolean).join(' ');
      } else {
        // HTTP-01 challenge (webroot)
        certbotCmd = [
          'certbot certonly',
          '--webroot',
          `--webroot-path ${this.webroot}`,
          `--email ${request.email}`,
          `-d ${request.domain}`,
          '--agree-tos',
          '--non-interactive',
          request.dryRun ? '--dry-run' : '',
        ].filter(Boolean).join(' ');
      }

      // Execute certbot in container
      const { stdout, stderr } = await this.execInCertbotContainer(certbotCmd);

      console.log('[SSL] Certbot output:', stdout);
      if (stderr) {
        console.warn('[SSL] Certbot warnings:', stderr);
      }

      if (!request.dryRun) {
        // Reload nginx to use new certificate (#KW-14)
        await this.reloadNginx();

        // Return certificate info
        return await this.getCertificateInfo(request.domain);
      }

      return {
        domain: request.domain,
        issuer: 'Let\'s Encrypt (Dry Run)',
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        daysRemaining: 90,
        status: 'valid',
        certificatePath: `${this.certPath}/${request.domain}/fullchain.pem`,
        keyPath: `${this.certPath}/${request.domain}/privkey.pem`,
      };
    } catch (error) {
      console.error(`[SSL] Failed to request certificate for ${request.domain}:`, error);
      throw new Error(`Certificate request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup Cloudflare DNS credentials for DNS-01 challenge (#KW-12)
   */
  private async setupCloudflareCredentials(apiToken: string): Promise<void> {
    console.log('[SSL] Setting up Cloudflare DNS credentials...');

    const credentialsContent = `# Cloudflare API token
dns_cloudflare_api_token = ${apiToken}
`;

    try {
      // Write credentials to container
      const writeCmd = `echo '${credentialsContent}' > ${this.cloudflareCredFile} && chmod 600 ${this.cloudflareCredFile}`;
      await this.execInCertbotContainer(writeCmd);

      console.log('[SSL] Cloudflare credentials configured');
    } catch (error) {
      console.error('[SSL] Failed to setup Cloudflare credentials:', error);
      throw new Error('Failed to configure Cloudflare DNS credentials');
    }
  }

  // ============================================================================
  // Certificate Renewal (#KW-13)
  // ============================================================================

  /**
   * Renew all expiring certificates
   */
  async renewCertificates(daysBeforeExpiry: number = 30): Promise<RenewalResult[]> {
    console.log(`[SSL] Checking for certificates expiring within ${daysBeforeExpiry} days...`);

    try {
      // Get all certificates
      const certificates = await this.listCertificates();
      const expiringCerts = certificates.filter(cert => cert.daysRemaining <= daysBeforeExpiry);

      if (expiringCerts.length === 0) {
        console.log('[SSL] No certificates need renewal');
        return [];
      }

      console.log(`[SSL] Found ${expiringCerts.length} certificate(s) to renew`);
      const results: RenewalResult[] = [];

      // Renew each expiring certificate
      for (const cert of expiringCerts) {
        try {
          await this.renewCertificate(cert.domain);
          results.push({
            domain: cert.domain,
            success: true,
            message: `Certificate renewed successfully. Valid until ${cert.validUntil}`,
            timestamp: new Date(),
          });
        } catch (error) {
          results.push({
            domain: cert.domain,
            success: false,
            message: error instanceof Error ? error.message : 'Renewal failed',
            timestamp: new Date(),
          });
        }
      }

      // Reload nginx after renewals (#KW-14)
      if (results.some(r => r.success)) {
        await this.reloadNginx();
      }

      return results;
    } catch (error) {
      console.error('[SSL] Certificate renewal check failed:', error);
      throw new Error(`Renewal check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Renew a specific certificate
   */
  async renewCertificate(domain: string): Promise<void> {
    console.log(`[SSL] Renewing certificate for ${domain}...`);

    try {
      const renewCmd = `certbot renew --cert-name ${domain} --non-interactive`;
      const { stdout, stderr } = await this.execInCertbotContainer(renewCmd);

      console.log('[SSL] Renewal output:', stdout);
      if (stderr) {
        console.warn('[SSL] Renewal warnings:', stderr);
      }

      console.log(`[SSL] Certificate for ${domain} renewed successfully`);
    } catch (error) {
      console.error(`[SSL] Failed to renew certificate for ${domain}:`, error);
      throw new Error(`Certificate renewal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Force renew all certificates (for testing) (#KW-15)
   */
  async forceRenewAll(): Promise<RenewalResult[]> {
    console.log('[SSL] Force renewing all certificates...');

    try {
      const renewCmd = 'certbot renew --force-renewal --non-interactive';
      const { stdout } = await this.execInCertbotContainer(renewCmd);

      console.log('[SSL] Force renewal output:', stdout);

      // Reload nginx
      await this.reloadNginx();

      // Get updated certificate list
      const certificates = await this.listCertificates();

      return certificates.map(cert => ({
        domain: cert.domain,
        success: true,
        message: 'Certificate force-renewed successfully',
        timestamp: new Date(),
      }));
    } catch (error) {
      console.error('[SSL] Force renewal failed:', error);
      throw new Error(`Force renewal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Certificate Management
  // ============================================================================

  /**
   * Get information about a specific certificate
   */
  async getCertificateInfo(domain: string): Promise<CertificateInfo> {
    try {
      // Read certificate from container
      const certCmd = `openssl x509 -in ${this.certPath}/${domain}/fullchain.pem -noout -text`;
      const { stdout } = await this.execInCertbotContainer(certCmd);

      // Parse certificate information
      const issuerMatch = stdout.match(/Issuer:.*CN\s*=\s*([^,\n]+)/);
      const validFromMatch = stdout.match(/Not Before\s*:\s*(.+)/);
      const validUntilMatch = stdout.match(/Not After\s*:\s*(.+)/);

      const validFrom = validFromMatch ? new Date(validFromMatch[1]) : new Date();
      const validUntil = validUntilMatch ? new Date(validUntilMatch[1]) : new Date();
      const daysRemaining = Math.floor((validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      let status: 'valid' | 'expiring-soon' | 'expired';
      if (daysRemaining < 0) {
        status = 'expired';
      } else if (daysRemaining <= 30) {
        status = 'expiring-soon';
      } else {
        status = 'valid';
      }

      return {
        domain,
        issuer: issuerMatch ? issuerMatch[1] : 'Unknown',
        validFrom,
        validUntil,
        daysRemaining,
        status,
        certificatePath: `${this.certPath}/${domain}/fullchain.pem`,
        keyPath: `${this.certPath}/${domain}/privkey.pem`,
        chainPath: `${this.certPath}/${domain}/chain.pem`,
      };
    } catch (error) {
      console.error(`[SSL] Failed to get certificate info for ${domain}:`, error);
      throw new Error(`Failed to get certificate info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all managed certificates
   */
  async listCertificates(): Promise<CertificateInfo[]> {
    try {
      const listCmd = 'certbot certificates --cert-name';
      const { stdout } = await this.execInCertbotContainer(listCmd);

      // Parse certbot output to extract domain names
      const domainMatches = stdout.matchAll(/Certificate Name:\s*(\S+)/g);
      const domains = Array.from(domainMatches, m => m[1]);

      // Get detailed info for each certificate
      const certificates: CertificateInfo[] = [];
      for (const domain of domains) {
        try {
          const certInfo = await this.getCertificateInfo(domain);
          certificates.push(certInfo);
        } catch (error) {
          console.warn(`[SSL] Failed to get info for ${domain}:`, error);
        }
      }

      return certificates;
    } catch (error) {
      console.error('[SSL] Failed to list certificates:', error);
      return [];
    }
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(domain: string, reason?: string): Promise<void> {
    console.log(`[SSL] Revoking certificate for ${domain}...`);

    try {
      const revokeCmd = [
        'certbot revoke',
        `--cert-name ${domain}`,
        reason ? `--reason ${reason}` : '',
        '--non-interactive',
      ].filter(Boolean).join(' ');

      const { stdout } = await this.execInCertbotContainer(revokeCmd);
      console.log('[SSL] Revocation output:', stdout);

      // Delete certificate files
      const deleteCmd = `certbot delete --cert-name ${domain} --non-interactive`;
      await this.execInCertbotContainer(deleteCmd);

      console.log(`[SSL] Certificate for ${domain} revoked and deleted`);
    } catch (error) {
      console.error(`[SSL] Failed to revoke certificate for ${domain}:`, error);
      throw new Error(`Certificate revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Nginx Integration (#KW-14)
  // ============================================================================

  /**
   * Reload nginx to apply new certificates
   */
  async reloadNginx(): Promise<void> {
    console.log('[SSL] Reloading nginx...');

    try {
      // Test nginx configuration first
      const testCmd = 'nginx -t';
      await this.execInNginxContainer(testCmd);

      // Reload nginx
      const reloadCmd = 'nginx -s reload';
      const { stdout } = await this.execInNginxContainer(reloadCmd);

      console.log('[SSL] Nginx reloaded:', stdout || 'success');
    } catch (error) {
      console.error('[SSL] Failed to reload nginx:', error);
      throw new Error(`Nginx reload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate nginx SSL configuration for a domain
   */
  generateNginxSSLConfig(domain: string, certPath?: string, keyPath?: string): string {
    const certFile = certPath || `${this.certPath}/${domain}/fullchain.pem`;
    const keyFile = keyPath || `${this.certPath}/${domain}/privkey.pem`;

    return `# SSL Configuration for ${domain}
# Generated by SSL Certificate Manager

ssl_certificate ${certFile};
ssl_certificate_key ${keyFile};

# SSL Protocol and Ciphers
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers off;

# SSL Session Cache
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate ${certFile};

# Security Headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
`;
  }

  // ============================================================================
  // Certificate Rotation Testing (#KW-15)
  // ============================================================================

  /**
   * Test certificate rotation process
   */
  async testCertificateRotation(domain: string): Promise<{
    success: boolean;
    steps: Array<{ step: string; success: boolean; message: string }>;
  }> {
    console.log(`[SSL] Testing certificate rotation for ${domain}...`);

    const steps: Array<{ step: string; success: boolean; message: string }> = [];

    try {
      // Step 1: Get current certificate info
      try {
        const currentCert = await this.getCertificateInfo(domain);
        steps.push({
          step: 'Get current certificate',
          success: true,
          message: `Certificate valid until ${currentCert.validUntil.toISOString()}`,
        });
      } catch (error) {
        steps.push({
          step: 'Get current certificate',
          success: false,
          message: error instanceof Error ? error.message : 'Failed to get certificate',
        });
        throw error;
      }

      // Step 2: Force renewal (dry run)
      try {
        const renewCmd = `certbot renew --cert-name ${domain} --dry-run --non-interactive`;
        await this.execInCertbotContainer(renewCmd);
        steps.push({
          step: 'Test renewal process',
          success: true,
          message: 'Renewal dry run successful',
        });
      } catch (error) {
        steps.push({
          step: 'Test renewal process',
          success: false,
          message: error instanceof Error ? error.message : 'Renewal test failed',
        });
        throw error;
      }

      // Step 3: Test nginx reload
      try {
        await this.reloadNginx();
        steps.push({
          step: 'Test nginx reload',
          success: true,
          message: 'Nginx reload successful',
        });
      } catch (error) {
        steps.push({
          step: 'Test nginx reload',
          success: false,
          message: error instanceof Error ? error.message : 'Nginx reload failed',
        });
        throw error;
      }

      return {
        success: true,
        steps,
      };
    } catch (error) {
      return {
        success: false,
        steps,
      };
    }
  }

  // ============================================================================
  // System Status
  // ============================================================================

  /**
   * Get certbot status and version
   */
  async getCertbotStatus(): Promise<CertbotStatus> {
    try {
      // Check if certbot container is running
      const { stdout: psOutput } = await execAsync(`docker ps --filter name=${this.certbotContainer} --format "{{.Names}}"`);

      if (!psOutput.trim()) {
        return {
          installed: false,
          certificateCount: 0,
          certificates: [],
        };
      }

      // Get certbot version
      const { stdout: versionOutput } = await this.execInCertbotContainer('certbot --version');
      const versionMatch = versionOutput.match(/certbot\s+([\d.]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      // Get certificate list
      const certificates = await this.listCertificates();

      return {
        installed: true,
        version,
        certificateCount: certificates.length,
        certificates: certificates.map(cert => ({
          domain: cert.domain,
          expiryDate: cert.validUntil.toISOString(),
          daysRemaining: cert.daysRemaining,
        })),
      };
    } catch (error) {
      console.error('[SSL] Failed to get certbot status:', error);
      return {
        installed: false,
        certificateCount: 0,
        certificates: [],
      };
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Execute command in certbot container
   */
  private async execInCertbotContainer(command: string): Promise<{ stdout: string; stderr: string }> {
    const fullCommand = `docker exec ${this.certbotContainer} ${command}`;
    return await execAsync(fullCommand);
  }

  /**
   * Execute command in nginx container
   */
  private async execInNginxContainer(command: string): Promise<{ stdout: string; stderr: string }> {
    const fullCommand = `docker exec ${this.nginxContainer} ${command}`;
    return await execAsync(fullCommand);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const sslCertificateManager = new SSLCertificateManager();
