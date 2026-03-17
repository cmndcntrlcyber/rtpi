/**
 * BurpSuite Activation Service
 * 
 * Manages the dual-file upload and activation workflow for BurpSuite Professional.
 * Keeps the rtpi-burp-agent container and BurpSuite Orchestrator Agent in dormant
 * state until both JAR and license files are uploaded and activation is triggered.
 */

import { db } from '../db';
import { burpSetup, mcpServers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

// ============================================================================
// Types
// ============================================================================

export interface BurpSetupStatus {
  jarUploaded: boolean;
  licenseUploaded: boolean;
  canActivate: boolean;
  activationStatus: 'dormant' | 'activating' | 'active' | 'error';
  jarInfo?: {
    filename: string;
    size: number;
    hash: string;
    uploadedAt: Date;
  };
  licenseInfo?: {
    filename: string;
    type: string;
    expiryDate?: Date;
    uploadedAt: Date;
  };
  mcpHealthCheckPassed?: boolean;
  errorMessage?: string;
}

export interface LicenseValidationResult {
  valid: boolean;
  type?: 'pro' | 'enterprise';
  expiryDate?: Date;
  error?: string;
}

export interface ActivationResult {
  success: boolean;
  status: 'active' | 'error';
  message: string;
  mcpUrl?: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const BURP_SETUP_DIR = process.env.BURP_SETUP_DIR || '/tmp/burp-setup';
const BURP_MCP_URL = process.env.BURP_MCP_URL || 'http://localhost:9876';

// ============================================================================
// BurpSuite Activation Service
// ============================================================================

class BurpActivationService {
  /**
   * Get current activation status
   */
  async getStatus(): Promise<BurpSetupStatus> {
    const [setup] = await db
      .select()
      .from(burpSetup)
      .limit(1);

    if (!setup) {
      // Initialize default record
      await this.initializeSetup();
      return {
        jarUploaded: false,
        licenseUploaded: false,
        canActivate: false,
        activationStatus: 'dormant',
      };
    }

    const status: BurpSetupStatus = {
      jarUploaded: setup.jarUploaded,
      licenseUploaded: setup.licenseUploaded,
      canActivate: setup.jarUploaded && setup.licenseUploaded,
      activationStatus: setup.activationStatus,
    };

    if (setup.jarUploaded && setup.jarFilename) {
      status.jarInfo = {
        filename: setup.jarFilename,
        size: setup.jarFileSize || 0,
        hash: setup.jarFileHash || '',
        uploadedAt: setup.jarUploadedAt || new Date(),
      };
    }

    if (setup.licenseUploaded && setup.licenseFilename) {
      status.licenseInfo = {
        filename: setup.licenseFilename,
        type: setup.licenseType || 'pro',
        expiryDate: setup.licenseExpiryDate || undefined,
        uploadedAt: setup.licenseUploadedAt || new Date(),
      };
    }

    if (setup.activationStatus === 'active') {
      status.mcpHealthCheckPassed = setup.mcpHealthCheckPassed;

      // Ensure MCP server record exists (handles server restarts)
      const [mcpRecord] = await db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.name, BurpActivationService.MCP_SERVER_NAME))
        .limit(1);
      if (!mcpRecord || mcpRecord.status !== 'running') {
        await this.registerMCPServer();
      }
    }

    if (setup.errorMessage) {
      status.errorMessage = setup.errorMessage;
    }

    return status;
  }

  /**
   * Upload BurpSuite Pro JAR file (streaming — no RAM buffering)
   */
  async uploadJar(
    filePath: string,
    filename: string,
    fileSize: number,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate file extension
      if (!filename.toLowerCase().endsWith('.jar')) {
        await fs.unlink(filePath).catch(() => {});
        return { success: false, error: 'File must be a .jar file' };
      }

      // Check minimum size (Burp is large, > 100MB)
      if (fileSize < 100 * 1024 * 1024) {
        await fs.unlink(filePath).catch(() => {});
        return { success: false, error: 'File too small to be BurpSuite Pro (minimum 100MB)' };
      }

      // Check magic bytes by reading only first 4 bytes (no full-file load)
      const fd = await fs.open(filePath, 'r');
      const magicBuf = Buffer.alloc(4);
      await fd.read(magicBuf, 0, 4, 0);
      await fd.close();
      const magicBytes = magicBuf.toString('hex');
      if (magicBytes !== '504b0304') { // PK\x03\x04
        await fs.unlink(filePath).catch(() => {});
        return { success: false, error: 'Invalid JAR file: incorrect magic bytes' };
      }

      // Calculate SHA256 hash using streaming (no full-file buffer)
      const hash = await new Promise<string>((resolve, reject) => {
        const hashStream = crypto.createHash('sha256');
        const readStream = fsSync.createReadStream(filePath);
        readStream.on('data', (chunk) => hashStream.update(chunk));
        readStream.on('end', () => resolve(hashStream.digest('hex')));
        readStream.on('error', reject);
      });

      // Ensure setup directory exists
      await fs.mkdir(BURP_SETUP_DIR, { recursive: true });

      // Move JAR from staging to final location
      const jarPath = path.join(BURP_SETUP_DIR, 'burpsuite_pro.jar');
      try {
        await fs.rename(filePath, jarPath);
      } catch {
        // Cross-filesystem fallback: copy then delete
        await fs.copyFile(filePath, jarPath);
        await fs.unlink(filePath).catch(() => {});
      }

      // Update database
      const [setup] = await db
        .select()
        .from(burpSetup)
        .limit(1);

      if (setup) {
        await db
          .update(burpSetup)
          .set({
            jarUploaded: true,
            jarFilename: filename,
            jarFileSize: fileSize,
            jarFileHash: hash,
            jarUploadedAt: new Date(),
            jarUploadedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(burpSetup.id, setup.id));
      } else {
        await db.insert(burpSetup).values({
          jarUploaded: true,
          jarFilename: filename,
          jarFileSize: fileSize,
          jarFileHash: hash,
          jarUploadedAt: new Date(),
          jarUploadedBy: userId,
        });
      }

      console.log(`[BurpActivation] JAR uploaded: ${filename} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
      return { success: true };
    } catch (error) {
      // Clean up staging file on error
      await fs.unlink(filePath).catch(() => {});
      console.error('[BurpActivation] JAR upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload BurpSuite license file
   */
  async uploadLicense(
    filePath: string,
    filename: string,
    userId: string
  ): Promise<{ success: boolean; validation?: LicenseValidationResult; error?: string }> {
    try {
      // Validate file
      if (!filename.toLowerCase().endsWith('.txt')) {
        await fs.unlink(filePath).catch(() => {});
        return { success: false, error: 'License file must be a .txt file' };
      }

      // Read license content (small file, safe to read fully)
      const licenseContent = await fs.readFile(filePath, 'utf-8');
      const validation = this.validateLicense(licenseContent);

      if (!validation.valid) {
        await fs.unlink(filePath).catch(() => {});
        return {
          success: false,
          validation,
          error: validation.error || 'Invalid license file',
        };
      }

      // Ensure setup directory exists
      await fs.mkdir(BURP_SETUP_DIR, { recursive: true });

      // Move license file to final location
      const licensePath = path.join(BURP_SETUP_DIR, 'burpsuite.license');
      try {
        await fs.rename(filePath, licensePath);
      } catch {
        await fs.copyFile(filePath, licensePath);
        await fs.unlink(filePath).catch(() => {});
      }

      // Update database
      const [setup] = await db
        .select()
        .from(burpSetup)
        .limit(1);

      if (setup) {
        await db
          .update(burpSetup)
          .set({
            licenseUploaded: true,
            licenseFilename: filename,
            licenseType: validation.type,
            licenseExpiryDate: validation.expiryDate || null,
            licenseUploadedAt: new Date(),
            licenseUploadedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(burpSetup.id, setup.id));
      } else {
        await db.insert(burpSetup).values({
          licenseUploaded: true,
          licenseFilename: filename,
          licenseType: validation.type,
          licenseExpiryDate: validation.expiryDate || null,
          licenseUploadedAt: new Date(),
          licenseUploadedBy: userId,
        });
      }

      console.log(`[BurpActivation] License uploaded: ${filename} (${validation.type})`);
      return { success: true, validation };
    } catch (error) {
      await fs.unlink(filePath).catch(() => {});
      console.error('[BurpActivation] License upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Validate BurpSuite license content
   */
  private validateLicense(content: string): LicenseValidationResult {
    // Basic validation: ensure file has content (BurpSuite validates the actual license at activation)
    const trimmed = content.trim();
    if (!trimmed || trimmed.length < 10) {
      return {
        valid: false,
        error: 'License file appears to be empty or too short',
      };
    }

    // Detect license type
    let type: 'pro' | 'enterprise' = 'pro';
    if (content.toLowerCase().includes('enterprise')) {
      type = 'enterprise';
    }

    // Try to extract expiry date (varies by license format)
    let expiryDate: Date | undefined;
    const expiryMatch = content.match(/(?:expir|valid\s+until|expires?)[\s:]*(\d{4}[-\/]\d{2}[-\/]\d{2})/i);
    if (expiryMatch) {
      const dateStr = expiryMatch[1].replace(/\//g, '-');
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        expiryDate = parsed;

        // Check if expired
        if (parsed < new Date()) {
          return {
            valid: false,
            type,
            expiryDate,
            error: `License expired on ${parsed.toISOString().split('T')[0]}`,
          };
        }
      }
    }

    return {
      valid: true,
      type,
      expiryDate,
    };
  }

  /**
   * Activate BurpSuite (trigger container restart with files)
   */
  async activate(userId: string): Promise<ActivationResult> {
    try {
      // Check status
      const status = await this.getStatus();

      if (!status.canActivate) {
        return {
          success: false,
          status: 'error',
          message: 'Cannot activate: missing JAR or license file',
          error: 'Both JAR and license must be uploaded before activation',
        };
      }

      // Update status to activating
      const [setup] = await db.select().from(burpSetup).limit(1);
      if (setup) {
        await db
          .update(burpSetup)
          .set({
            activationStatus: 'activating',
            activatedBy: userId,
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(burpSetup.id, setup.id));
      }

      console.log('[BurpActivation] Starting activation process...');

      // Create activation flag file
      const flagPath = path.join(BURP_SETUP_DIR, '.activate');
      await fs.writeFile(flagPath, new Date().toISOString());

      // Run health polling in background — don't block the HTTP response
      // (frontend polls /status every 3s while activationStatus === "activating")
      if (setup) {
        this.pollForActivation(setup.id).catch(err => {
          console.error('[BurpActivation] Background activation polling failed:', err);
        });
      }

      return {
        success: true,
        status: 'active',
        message: 'BurpSuite activation started',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Activation failed';
      console.error('[BurpActivation] Activation failed:', error);

      // Update status to error
      const [setup] = await db.select().from(burpSetup).limit(1);
      if (setup) {
        await db
          .update(burpSetup)
          .set({
            activationStatus: 'error',
            errorMessage: errorMsg,
            updatedAt: new Date(),
          })
          .where(eq(burpSetup.id, setup.id));
      }

      return {
        success: false,
        status: 'error',
        message: 'Activation failed',
        error: errorMsg,
      };
    }
  }

  /**
   * Background polling for MCP server health after activation
   */
  private async pollForActivation(setupId: number): Promise<void> {
    const maxWaitTime = 120000; // 2 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    console.log('[BurpActivation] Waiting for MCP server to become healthy...');

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const healthy = await this.checkMCPHealth();
      if (healthy) {
        await db
          .update(burpSetup)
          .set({
            activationStatus: 'active',
            activatedAt: new Date(),
            mcpServerUrl: BURP_MCP_URL,
            mcpHealthCheckPassed: true,
            lastHealthCheck: new Date(),
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(burpSetup.id, setupId));

        console.log('[BurpActivation] Activation successful!');

        // Auto-register BurpSuite MCP server so it appears in agent config dropdown
        await this.registerMCPServer();
        return;
      }
    }

    // Timeout
    const errorMsg = 'Activation timeout: MCP server did not become healthy';
    await db
      .update(burpSetup)
      .set({
        activationStatus: 'error',
        errorMessage: errorMsg,
        updatedAt: new Date(),
      })
      .where(eq(burpSetup.id, setupId));

    console.error(`[BurpActivation] ${errorMsg}`);
  }

  /**
   * Deactivate BurpSuite (stop container)
   */
  async deactivate(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[BurpActivation] Deactivating BurpSuite...');

      // Remove activation flag
      const flagPath = path.join(BURP_SETUP_DIR, '.activate');
      try {
        await fs.unlink(flagPath);
      } catch {
        // Flag might not exist
      }

      // Update database
      const [setup] = await db.select().from(burpSetup).limit(1);
      if (setup) {
        await db
          .update(burpSetup)
          .set({
            activationStatus: 'dormant',
            deactivatedAt: new Date(),
            mcpHealthCheckPassed: false,
            updatedAt: new Date(),
          })
          .where(eq(burpSetup.id, setup.id));
      }

      // Mark MCP server as stopped so it disappears from agent config dropdown
      await this.unregisterMCPServer();

      console.log('[BurpActivation] Deactivation complete');
      return { success: true };
    } catch (error) {
      console.error('[BurpActivation] Deactivation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deactivation failed',
      };
    }
  }

  /**
   * Register BurpSuite MCP server in mcpServers table (idempotent)
   */
  private static readonly MCP_SERVER_NAME = 'BurpSuite Pro MCP';

  private async registerMCPServer(): Promise<void> {
    try {
      const [existing] = await db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.name, BurpActivationService.MCP_SERVER_NAME))
        .limit(1);

      if (existing) {
        await db
          .update(mcpServers)
          .set({
            status: 'running',
            restartCount: 0,
            uptime: new Date(),
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(mcpServers.id, existing.id));
        console.log(`[BurpActivation] MCP server record updated to running: ${existing.id}`);
      } else {
        const [server] = await db
          .insert(mcpServers)
          .values({
            name: BurpActivationService.MCP_SERVER_NAME,
            command: 'docker',
            args: ['exec', '-i', 'rtpi-burp-agent', 'node', '/mcp/dist/index.js'],
            env: { AGENT_TYPE: 'burp-suite', CONTAINER_NAME: 'rtpi-burp-agent' },
            status: 'running',
            autoRestart: false,
            maxRestarts: 0,
            restartCount: 0,
            uptime: new Date(),
          })
          .returning();
        console.log(`[BurpActivation] MCP server registered: ${server.id}`);
      }
    } catch (error) {
      console.error('[BurpActivation] MCP server registration failed:', error);
    }
  }

  /**
   * Mark BurpSuite MCP server as stopped on deactivation
   */
  private async unregisterMCPServer(): Promise<void> {
    try {
      await db
        .update(mcpServers)
        .set({
          status: 'stopped',
          uptime: null,
          updatedAt: new Date(),
        })
        .where(eq(mcpServers.name, BurpActivationService.MCP_SERVER_NAME));
      console.log('[BurpActivation] MCP server marked as stopped');
    } catch (error) {
      console.error('[BurpActivation] MCP server unregistration failed:', error);
    }
  }

  /**
   * Check MCP server health
   */
  async checkMCPHealth(): Promise<boolean> {
    try {
      // MCP server uses stdio transport (not HTTP), so check container health via Docker
      const { stdout } = await execFileAsync('docker', [
        'inspect', '--format', '{{.State.Running}}', 'rtpi-burp-agent'
      ], { timeout: 5000 });

      const running = stdout.trim() === 'true';
      if (!running) return false;

      // Verify the MCP node process is alive inside the container
      const { stdout: pgrep } = await execFileAsync('docker', [
        'exec', 'rtpi-burp-agent', 'pgrep', '-f', 'node dist/index.js'
      ], { timeout: 5000 });

      const healthy = pgrep.trim().length > 0;

      // Update database
      const [setup] = await db.select().from(burpSetup).limit(1);
      if (setup) {
        await db
          .update(burpSetup)
          .set({
            mcpHealthCheckPassed: healthy,
            lastHealthCheck: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(burpSetup.id, setup.id));
      }

      return healthy;
    } catch {
      return false;
    }
  }

  /**
   * Remove JAR file
   */
  async removeJar(): Promise<{ success: boolean; error?: string }> {
    try {
      const status = await this.getStatus();
      if (status.activationStatus === 'active') {
        return {
          success: false,
          error: 'Cannot remove JAR while BurpSuite is active. Deactivate first.',
        };
      }

      const jarPath = path.join(BURP_SETUP_DIR, 'burpsuite_pro.jar');
      try {
        await fs.unlink(jarPath);
      } catch {
        // File might not exist
      }

      const [setup] = await db.select().from(burpSetup).limit(1);
      if (setup) {
        await db
          .update(burpSetup)
          .set({
            jarUploaded: false,
            jarFilename: null,
            jarFileSize: null,
            jarFileHash: null,
            jarUploadedAt: null,
            jarUploadedBy: null,
            updatedAt: new Date(),
          })
          .where(eq(burpSetup.id, setup.id));
      }

      console.log('[BurpActivation] JAR file removed');
      return { success: true };
    } catch (error) {
      console.error('[BurpActivation] JAR removal failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Removal failed',
      };
    }
  }

  /**
   * Remove license file
   */
  async removeLicense(): Promise<{ success: boolean; error?: string }> {
    try {
      const status = await this.getStatus();
      if (status.activationStatus === 'active') {
        return {
          success: false,
          error: 'Cannot remove license while BurpSuite is active. Deactivate first.',
        };
      }

      const licensePath = path.join(BURP_SETUP_DIR, 'burpsuite.license');
      try {
        await fs.unlink(licensePath);
      } catch {
        // File might not exist
      }

      const [setup] = await db.select().from(burpSetup).limit(1);
      if (setup) {
        await db
          .update(burpSetup)
          .set({
            licenseUploaded: false,
            licenseFilename: null,
            licenseType: null,
            licenseExpiryDate: null,
            licenseUploadedAt: null,
            licenseUploadedBy: null,
            updatedAt: new Date(),
          })
          .where(eq(burpSetup.id, setup.id));
      }

      console.log('[BurpActivation] License file removed');
      return { success: true };
    } catch (error) {
      console.error('[BurpActivation] License removal failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Removal failed',
      };
    }
  }

  /**
   * Initialize setup record in database
   */
  private async initializeSetup(): Promise<void> {
    const existing = await db.select().from(burpSetup).limit(1);
    if (existing.length === 0) {
      await db.insert(burpSetup).values({
        jarUploaded: false,
        licenseUploaded: false,
        activationStatus: 'dormant',
      });
      console.log('[BurpActivation] Initialized burp_setup record');
    }
  }
}

// Singleton export
export const burpActivationService = new BurpActivationService();
