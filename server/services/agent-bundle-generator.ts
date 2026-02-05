/**
 * Agent Bundle Generator Service
 *
 * Generates complete agent bundles containing:
 * - Compiled agent binary (from agent-build-service)
 * - Client certificates (signed by CA)
 * - Configuration file (config.toml)
 * - CA certificate
 * - README with instructions
 *
 * Bundles are packaged as ZIP files for easy distribution.
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { db } from '@db';
import { agentBundles, rustNexusCertificates } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { agentBuildService, BuildResult, AgentPlatform, AgentArchitecture } from './agent-build-service';
import { agentTokenService } from './agent-token-service';

// ============================================================================
// Types
// ============================================================================

export type ImplantType = 'reconnaissance' | 'exploitation' | 'exfiltration' | 'general';

export interface BundleOptions {
  name: string;
  platform: AgentPlatform;
  architecture: AgentArchitecture;
  features?: string[];
  implantType: ImplantType;
  controllerUrl: string;
  userId: string;
  operationId?: string; // Operation to auto-assign implant to on registration
  autonomyLevel?: number;
  heartbeatInterval?: number;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface GeneratedBundle {
  bundleId: string;
  filePath: string;
  fileSize: number;
  fileHash: string;
  certificateSerial: string;
  certificateFingerprint: string;
  downloadUrl: string;
  publicDownloadUrl?: string;
  tokenId?: string;
  tokenExpiresAt?: Date;
}

export interface CertificateInfo {
  serial: string;
  fingerprint: string;
  keyPath: string;
  certPath: string;
  caCertPath: string;
  certificatePem: string;
  publicKeyPem: string;
  commonName: string;
  issuerCommonName: string;
}

// ============================================================================
// Agent Bundle Generator Service
// ============================================================================

class AgentBundleGenerator {
  private readonly caDir: string;
  private readonly bundlesDir: string;
  private readonly clientCertValidityDays: number;

  constructor() {
    this.caDir = process.env.CA_DIR || path.join(process.cwd(), 'ca');
    this.bundlesDir = process.env.AGENT_BUNDLES_DIR || './uploads/agent-bundles';
    this.clientCertValidityDays = 90;
  }

  /**
   * Generate a complete agent bundle
   */
  async generateBundle(options: BundleOptions): Promise<GeneratedBundle> {
    console.log(`[AgentBundleGenerator] Generating bundle: ${options.name} (${options.platform}/${options.architecture})`);

    // 1. Trigger or wait for build
    const buildId = await agentBuildService.triggerBuild({
      platform: options.platform,
      architecture: options.architecture,
      features: options.features,
      userId: options.userId,
    });

    console.log(`[AgentBundleGenerator] Build ${buildId} triggered, waiting for completion...`);

    // 2. Wait for build to complete
    const buildResult = await agentBuildService.waitForBuild(buildId);

    if (buildResult.status !== 'completed' || !buildResult.binaryPath) {
      throw new Error(`Build failed: ${buildResult.errorMessage || 'Unknown error'}`);
    }

    console.log(`[AgentBundleGenerator] Build completed: ${buildResult.binaryPath}`);

    // 3. Generate certificates
    const bundleId = crypto.randomUUID();
    const bundleDir = path.join(this.bundlesDir, bundleId);
    await fs.mkdir(bundleDir, { recursive: true });

    const certs = await this.generateCertificates(options.name, bundleDir);

    // 4. Generate config.toml
    const configPath = path.join(bundleDir, 'config.toml');
    await this.generateConfig(configPath, options, certs);

    // 5. Copy CA certificate
    const caCertDest = path.join(bundleDir, 'ca.crt');
    await fs.copyFile(certs.caCertPath, caCertDest);

    // 6. Copy binary
    const binaryName = options.platform === 'windows' ? 'nexus-agent.exe' : 'nexus-agent';
    const binaryDest = path.join(bundleDir, binaryName);
    await fs.copyFile(buildResult.binaryPath, binaryDest);

    // 7. Generate README
    const readmePath = path.join(bundleDir, 'README.txt');
    await this.generateReadme(readmePath, options, binaryName);

    // 8. Create ZIP bundle
    const zipPath = path.join(bundleDir, 'bundle.zip');
    await this.createZipBundle(zipPath, bundleDir, options.name, binaryName);

    // 9. Calculate hash and size
    const stats = await fs.stat(zipPath);
    const fileHash = await this.calculateFileHash(zipPath);

    // 10. Store certificate in database
    const [certRecord] = await db.insert(rustNexusCertificates).values({
      certificateType: 'client',
      implantId: null, // Will be linked when implant registers
      serialNumber: certs.serial,
      fingerprintSha256: certs.fingerprint,
      commonName: certs.commonName,
      certificatePem: certs.certificatePem,
      publicKeyPem: certs.publicKeyPem,
      issuerCommonName: certs.issuerCommonName,
      issuedBy: options.userId,
      notBefore: new Date(),
      notAfter: new Date(Date.now() + this.clientCertValidityDays * 24 * 60 * 60 * 1000),
      isValid: true,
      revoked: false,
      metadata: {
        bundleId,
        implantName: options.name,
        platform: options.platform,
        architecture: options.architecture,
      },
    }).returning();

    // 11. Store bundle in database
    const [bundleRecord] = await db.insert(agentBundles).values({
      name: options.name,
      platform: options.platform,
      architecture: options.architecture,
      buildId,
      certificateId: certRecord.id,
      certificateSerial: certs.serial,
      certificateFingerprint: certs.fingerprint,
      filePath: zipPath,
      fileSize: stats.size,
      fileHash,
      controllerUrl: options.controllerUrl,
      implantType: options.implantType,
      isActive: true,
      downloadCount: 0,
      createdBy: options.userId,
      expiresAt: options.expiresAt,
      metadata: options.metadata || {},
    }).returning();

    console.log(`[AgentBundleGenerator] Bundle ${bundleRecord.id} created successfully`);

    // Auto-generate download token (if enabled)
    let publicDownloadUrl: string | undefined;
    let tokenId: string | undefined;
    let tokenExpiresAt: Date | undefined;

    try {
      const autoGenerate = process.env.AGENT_TOKEN_AUTO_GENERATE !== 'false';

      if (autoGenerate) {
        const token = await agentTokenService.autoGenerateToken(
          bundleRecord.id,
          options.userId
        );
        publicDownloadUrl = token.downloadUrl;
        tokenId = token.tokenId;
        tokenExpiresAt = token.expiresAt;

        console.log(
          `[AgentBundleGenerator] Auto-generated token ${token.tokenId} for bundle ${bundleRecord.id}`
        );
      }
    } catch (error) {
      console.warn(
        `[AgentBundleGenerator] Failed to auto-generate token:`,
        error
      );
      // Don't fail bundle generation if token creation fails
    }

    return {
      bundleId: bundleRecord.id,
      filePath: zipPath,
      fileSize: stats.size,
      fileHash,
      certificateSerial: certs.serial,
      certificateFingerprint: certs.fingerprint,
      downloadUrl: `/api/v1/rust-nexus/agents/bundles/${bundleRecord.id}/download`,
      publicDownloadUrl,
      tokenId,
      tokenExpiresAt,
    };
  }

  /**
   * Generate client certificates
   */
  private async generateCertificates(implantName: string, outputDir: string): Promise<CertificateInfo> {
    const clientKeyPath = path.join(outputDir, 'client.key');
    const clientCsrPath = path.join(outputDir, 'client.csr');
    const clientCertPath = path.join(outputDir, 'client.crt');
    const clientExtPath = path.join(outputDir, 'client.ext');

    const caKeyPath = path.join(this.caDir, 'ca.key');
    const caCertPath = path.join(this.caDir, 'ca.crt');

    // Verify CA exists
    try {
      await fs.access(caCertPath);
      await fs.access(caKeyPath);
    } catch {
      throw new Error('CA certificate not found. Run setup-mtls-ca.ts first.');
    }

    // Generate client private key
    execSync(`openssl genrsa -out "${clientKeyPath}" 2048`, { stdio: 'pipe' });

    // Generate CSR
    const subject = `/C=US/ST=California/L=San Francisco/O=RTPI/OU=Implant/CN=${implantName}`;
    execSync(
      `openssl req -new -key "${clientKeyPath}" -out "${clientCsrPath}" -subj "${subject}"`,
      { stdio: 'pipe' }
    );

    // Create client certificate extensions
    const extConfig = `
subjectAltName = DNS:${implantName}
extendedKeyUsage = clientAuth
`;
    await fs.writeFile(clientExtPath, extConfig.trim());

    // Sign client certificate
    execSync(
      `openssl x509 -req -in "${clientCsrPath}" ` +
      `-CA "${caCertPath}" -CAkey "${caKeyPath}" ` +
      `-CAcreateserial -out "${clientCertPath}" ` +
      `-days ${this.clientCertValidityDays} ` +
      `-sha256 -extfile "${clientExtPath}"`,
      { stdio: 'pipe' }
    );

    // Set permissions
    await fs.chmod(clientKeyPath, 0o600);
    await fs.chmod(clientCertPath, 0o644);

    // Cleanup temp files
    await fs.unlink(clientCsrPath);
    await fs.unlink(clientExtPath);

    // Get certificate fingerprint
    const fingerprintOutput = execSync(
      `openssl x509 -in "${clientCertPath}" -noout -fingerprint -sha256`,
      { encoding: 'utf-8' }
    );
    const fingerprint = fingerprintOutput
      .split('=')[1]
      .trim()
      .replace(/:/g, '');

    // Get serial number
    const serialOutput = execSync(
      `openssl x509 -in "${clientCertPath}" -noout -serial`,
      { encoding: 'utf-8' }
    );
    const serial = serialOutput.split('=')[1].trim();

    // Read certificate PEM
    const certificatePem = await fs.readFile(clientCertPath, 'utf-8');

    // Extract public key from certificate
    const publicKeyPem = execSync(
      `openssl x509 -in "${clientCertPath}" -pubkey -noout`,
      { encoding: 'utf-8' }
    );

    // Get issuer common name from CA cert
    let issuerCommonName = 'RTPI CA';
    try {
      const issuerOutput = execSync(
        `openssl x509 -in "${caCertPath}" -noout -subject`,
        { encoding: 'utf-8' }
      );
      const cnMatch = issuerOutput.match(/CN\s*=\s*([^,\/\n]+)/);
      if (cnMatch) {
        issuerCommonName = cnMatch[1].trim();
      }
    } catch {
      // Use default if extraction fails
    }

    return {
      serial,
      fingerprint,
      keyPath: clientKeyPath,
      certPath: clientCertPath,
      caCertPath,
      certificatePem,
      publicKeyPem,
      commonName: implantName,
      issuerCommonName,
    };
  }

  /**
   * Generate config.toml
   */
  private async generateConfig(
    configPath: string,
    options: BundleOptions,
    certs: CertificateInfo
  ): Promise<void> {
    const authToken = crypto.randomBytes(32).toString('hex');

    const config = `
# rust-nexus Agent Configuration
# Agent: ${options.name}
# Generated: ${new Date().toISOString()}

[implant]
name = "${options.name}"
type = "${options.implantType}"
version = "1.0.0"
architecture = "${options.architecture}"${options.operationId ? `\noperation_id = "${options.operationId}"` : ''}

[controller]
url = "${options.controllerUrl}"
certificate = "ca.crt"
client_certificate = "client.crt"
client_key = "client.key"

[auth]
certificate_serial = "${certs.serial}"
certificate_fingerprint = "${certs.fingerprint}"
token = "${authToken}"

[behavior]
heartbeat_interval = ${options.heartbeatInterval || 30}
max_concurrent_tasks = 3
autonomy_level = ${options.autonomyLevel || 1}
retry_attempts = 3
connection_timeout = 30

[telemetry]
enabled = true
interval = 60
include_system_metrics = true
include_network_metrics = true
`;

    await fs.writeFile(configPath, config.trim());
  }

  /**
   * Generate README file
   */
  private async generateReadme(
    readmePath: string,
    options: BundleOptions,
    binaryName: string
  ): Promise<void> {
    const readme = `
================================================================================
                          rust-nexus Agent Bundle
================================================================================

Agent Name:     ${options.name}
Platform:       ${options.platform}
Architecture:   ${options.architecture}
Implant Type:   ${options.implantType}
Generated:      ${new Date().toISOString()}

================================================================================
                              Quick Start
================================================================================

1. Extract all files to a directory on the target system

2. Ensure all files are present:
   - ${binaryName}       (agent binary)
   - ca.crt              (CA certificate)
   - client.crt          (client certificate)
   - client.key          (client private key)
   - config.toml         (configuration)

3. Run the agent:
${options.platform === 'windows' ? `
   Windows:
   > .\\${binaryName} --config config.toml

   Or install as service:
   > .\\${binaryName} --install --config config.toml
` : `
   Linux:
   $ chmod +x ${binaryName}
   $ ./${binaryName} --config config.toml

   Or run as background daemon:
   $ nohup ./${binaryName} --config config.toml &
`}

================================================================================
                              Security Notice
================================================================================

This bundle contains sensitive cryptographic material:
- client.key: Private key for mTLS authentication

KEEP THESE FILES SECURE. Do not share or expose them publicly.

================================================================================
                              Support
================================================================================

Controller URL: ${options.controllerUrl}
Documentation:  https://docs.rtpi.local/agents

================================================================================
`;

    await fs.writeFile(readmePath, readme.trim());
  }

  /**
   * Create ZIP bundle
   */
  private async createZipBundle(
    zipPath: string,
    sourceDir: string,
    agentName: string,
    binaryName: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);

      // Add files with agent name as root directory
      const filesToAdd = [
        binaryName,
        'ca.crt',
        'client.crt',
        'client.key',
        'config.toml',
        'README.txt',
      ];

      for (const file of filesToAdd) {
        const filePath = path.join(sourceDir, file);
        archive.file(filePath, { name: `${agentName}/${file}` });
      }

      archive.finalize();
    });
  }

  /**
   * Calculate SHA256 hash of a file
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Get bundle by ID
   */
  async getBundle(bundleId: string) {
    return db.query.agentBundles.findFirst({
      where: eq(agentBundles.id, bundleId)
    });
  }

  /**
   * List all bundles
   */
  async listBundles(options: {
    limit?: number;
    platform?: AgentPlatform;
    isActive?: boolean;
  } = {}) {
    const limit = options.limit || 50;

    // Basic query - filtering would be added based on options
    const bundles = await db.select()
      .from(agentBundles)
      .orderBy(agentBundles.createdAt)
      .limit(limit);

    return bundles;
  }

  /**
   * Increment download count
   */
  async incrementDownloadCount(bundleId: string): Promise<void> {
    const bundle = await this.getBundle(bundleId);
    if (bundle) {
      await db.update(agentBundles)
        .set({ downloadCount: (bundle.downloadCount || 0) + 1 })
        .where(eq(agentBundles.id, bundleId));
    }
  }

  /**
   * Deactivate a bundle
   */
  async deactivateBundle(bundleId: string): Promise<void> {
    await db.update(agentBundles)
      .set({ isActive: false })
      .where(eq(agentBundles.id, bundleId));
  }

  /**
   * Delete bundle and associated files
   */
  async deleteBundle(bundleId: string): Promise<void> {
    const bundle = await this.getBundle(bundleId);
    if (bundle?.filePath) {
      const bundleDir = path.dirname(bundle.filePath);
      try {
        await fs.rm(bundleDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`[AgentBundleGenerator] Failed to delete bundle files:`, error);
      }
    }

    // Delete from database (cascade will handle related records)
    // Note: Using soft delete (deactivate) is preferred
    await this.deactivateBundle(bundleId);
  }
}

// Singleton export
export const agentBundleGenerator = new AgentBundleGenerator();
