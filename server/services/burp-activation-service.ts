/**
 * BurpSuite Activation Service
 * 
 * Manages the dual-file upload and activation workflow for BurpSuite Professional.
 * Keeps the rtpi-burp-agent container and BurpSuite Orchestrator Agent in dormant
 * state until both JAR and license files are uploaded and activation is triggered.
 */

import { db } from '../db';
import { burpSetup } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

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
  mcpHealthy?: boolean;
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

const BURP_SETUP_DIR = process.env.BURP_SETUP_DIR || '/opt/burp-setup';
const BURP_MCP_URL = process.env.BURP_MCP_URL || 'http://rtpi-burp-agent:9876';

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
      status.mcpHealthy = setup.mcpHealthCheckPassed;
    }

    if (setup.errorMessage) {
      status.errorMessage = setup.errorMessage;
    }

    return status;
  }

  /**
   * Upload BurpSuite Pro JAR file
   */
  async uploadJar(
    fileBuffer: Buffer,
    filename: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate file
      if (!filename.toLowerCase().endsWith('.jar')) {
        return { success: false, error: 'File must be a .jar file' };
      }

      // Check magic bytes (ZIP/JAR signature)
      const magicBytes = fileBuffer.slice(0, 4).toString('hex');
      if (magicBytes !== '504b0304') { // PK\x03\x04
        return { success: false, error: 'Invalid JAR file: incorrect magic bytes' };
      }

      // Check minimum size (Burp is large, > 100MB)
      if (fileBuffer.length < 100 * 1024 * 1024) {
        return { success: false, error: 'File too small to be BurpSuite Pro (minimum 100MB)' };
      }

      // Calculate SHA256 hash
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Ensure setup directory exists
      await fs.mkdir(BURP_SETUP_DIR, { recursive: true });

      // Write JAR file
      const jarPath = path.join(BURP_SETUP_DIR, 'burpsuite_pro.jar');
      await fs.writeFile(jarPath, fileBuffer);

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
            jarFileSize: fileBuffer.length,
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
          jarFileSize: fileBuffer.length,
          jarFileHash: hash,
          jarUploadedAt: new Date(),
          jarUploadedBy: userId,
        });
      }

      console.log(`[BurpActivation] JAR uploaded: ${filename} (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
      return { success: true };
    } catch (error) {
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
    fileBuffer: Buffer,
    filename: string,
    userId: string
  ): Promise<{ success: boolean; validation?: LicenseValidationResult; error?: string }> {
    try {
      // Validate file
      if (!filename.toLowerCase().endsWith('.txt')) {
        return { success: false, error: 'License file must be a .txt file' };
      }

      // Parse and validate license
      const licenseContent = fileBuffer.toString('utf-8');
      const validation = this.validateLicense(licenseContent);

      if (!validation.valid) {
        return {
          success: false,
          validation,
          error: validation.error || 'Invalid license file',
        };
      }

      // Ensure setup directory exists
      await fs.mkdir(BURP_SETUP_DIR, { recursive: true });

      // Write license file
      const licensePath = path.join(BURP_SETUP_DIR, 'burpsuite.license');
      await fs.writeFile(licensePath, fileBuffer);

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
    // Basic validation: check for license markers
    const hasLicenseMarker = content.includes('license') || content.includes('License') || content.includes('LICENSE');
    const hasPortSwiggerMarker = content.includes('PortSwigger') || content.includes('Burp Suite') || content.includes('burp');

    if (!hasLicenseMarker && !hasPortSwiggerMarker) {
      return {
        valid: false,
        error: 'File does not appear to be a valid BurpSuite license',
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

      // Wait for container to restart and MCP server to start (polling)
      const maxWaitTime = 120000; // 2 minutes
      const pollInterval = 5000; // 5 seconds
      const startTime = Date.now();

      console.log('[BurpActivation] Waiting for MCP server to become healthy...');

      while (Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        // Check MCP server health
        const healthy = await this.checkMCPHealth();
        if (healthy) {
          // Activation successful!
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
            .where(eq(burpSetup.id, setup!.id));

          console.log('[BurpActivation] Activation successful!');

          return {
            success: true,
            status: 'active',
            message: 'BurpSuite activated successfully',
            mcpUrl: BURP_MCP_URL,
          };
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
        .where(eq(burpSetup.id, setup!.id));

      console.error(`[BurpActivation] ${errorMsg}`);

      return {
        success: false,
        status: 'error',
        message: errorMsg,
        error: 'Container did not start within 2 minutes. Check activation logs.',
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
   * Check MCP server health
   */
  async checkMCPHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${BURP_MCP_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      const healthy = response.ok;

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
