/**
 * BurpSuite Activation System Integration Tests
 * 
 * Tests the complete BurpSuite activation workflow including:
 * - File uploads (JAR and license)
 * - Activation/deactivation
 * - MCP health checks
 * - Status tracking
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../server/db';
import { burpSetup } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id';

describe('BurpSuite Activation System', () => {
  let authCookie: string;

  beforeAll(async () => {
    // Setup: Login and get session cookie
    // In a real test, you would authenticate here
    authCookie = 'connect.sid=test-session';
  });

  afterAll(async () => {
    // Cleanup: Remove test data
    await db.delete(burpSetup).execute();
  });

  beforeEach(async () => {
    // Reset burpSetup table before each test
    await db.delete(burpSetup).execute();
  });

  describe('Status Check', () => {
    it('should return dormant status initially', async () => {
      const response = await fetch(`${API_BASE}/api/v1/burp-activation/status`, {
        headers: { Cookie: authCookie },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toMatchObject({
        activationStatus: 'dormant',
        jarUploaded: false,
        licenseUploaded: false,
        mcpHealthCheckPassed: false,
      });
    });

    it('should handle unauthorized requests', async () => {
      const response = await fetch(`${API_BASE}/api/v1/burp-activation/status`);
      expect(response.status).toBe(401);
    });
  });

  describe('JAR Upload', () => {
    it('should upload valid JAR file', async () => {
      // Create a mock JAR file
      const mockJarContent = Buffer.from('PK\x03\x04'); // JAR magic bytes
      const formData = new FormData();
      const blob = new Blob([mockJarContent], { type: 'application/java-archive' });
      formData.append('jarFile', blob, 'burpsuite_pro_test.jar');

      const response = await fetch(`${API_BASE}/api/v1/burp-activation/upload-jar`, {
        method: 'POST',
        headers: { Cookie: authCookie },
        body: formData,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.message).toContain('uploaded successfully');
      expect(data.status.jarUploaded).toBe(true);
      expect(data.status.jarFilename).toBeTruthy();
      expect(data.status.jarFileHash).toBeTruthy();
    });

    it('should reject non-JAR files', async () => {
      const mockTextContent = Buffer.from('This is not a JAR file');
      const formData = new FormData();
      const blob = new Blob([mockTextContent], { type: 'text/plain' });
      formData.append('jarFile', blob, 'fake.jar');

      const response = await fetch(`${API_BASE}/api/v1/burp-activation/upload-jar`, {
        method: 'POST',
        headers: { Cookie: authCookie },
        body: formData,
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid file');
    });

    it('should reject oversized JAR files', async () => {
      // Create a mock file > 750MB (actual size will be smaller for test)
      const largeContent = Buffer.alloc(751 * 1024 * 1024); // 751MB
      const formData = new FormData();
      const blob = new Blob([largeContent], { type: 'application/java-archive' });
      formData.append('jarFile', blob, 'huge.jar');

      const response = await fetch(`${API_BASE}/api/v1/burp-activation/upload-jar`, {
        method: 'POST',
        headers: { Cookie: authCookie },
        body: formData,
      });

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toContain('too large');
    });
  });

  describe('License Upload', () => {
    it('should upload valid license file', async () => {
      const mockLicense = `# Burp Suite Professional License
# License Type: pro
# Expiry: 2027-12-31
# Serial: TEST-1234-5678
ValidLicenseData`;

      const formData = new FormData();
      const blob = new Blob([mockLicense], { type: 'text/plain' });
      formData.append('licenseFile', blob, 'license.txt');

      const response = await fetch(`${API_BASE}/api/v1/burp-activation/upload-license`, {
        method: 'POST',
        headers: { Cookie: authCookie },
        body: formData,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.message).toContain('uploaded successfully');
      expect(data.status.licenseUploaded).toBe(true);
      expect(data.status.licenseType).toBeTruthy();
    });

    it('should reject oversized license files', async () => {
      const largeLicense = 'x'.repeat(11 * 1024); // 11KB
      const formData = new FormData();
      const blob = new Blob([largeLicense], { type: 'text/plain' });
      formData.append('licenseFile', blob, 'huge_license.txt');

      const response = await fetch(`${API_BASE}/api/v1/burp-activation/upload-license`, {
        method: 'POST',
        headers: { Cookie: authCookie },
        body: formData,
      });

      expect(response.status).toBe(413);
    });
  });

  describe('Activation Flow', () => {
    beforeEach(async () => {
      // Setup: Upload both JAR and license
      await db.insert(burpSetup).values({
        jarUploaded: true,
        jarFilename: 'test.jar',
        jarFileSize: 1024,
        jarFileHash: 'test-hash',
        licenseUploaded: true,
        licenseFilename: 'license.txt',
        licenseType: 'pro',
        activationStatus: 'dormant',
      }).execute();
    });

    it('should activate BurpSuite when both files are uploaded', async () => {
      const response = await fetch(`${API_BASE}/api/v1/burp-activation/activate`, {
        method: 'POST',
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.status.activationStatus).toMatch(/activating|active/);
    });

    it('should fail activation without both files', async () => {
      // Remove license
      await db.update(burpSetup)
        .set({ licenseUploaded: false })
        .execute();

      const response = await fetch(`${API_BASE}/api/v1/burp-activation/activate`, {
        method: 'POST',
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Deactivation', () => {
    beforeEach(async () => {
      // Setup: Set status to active
      await db.insert(burpSetup).values({
        jarUploaded: true,
        licenseUploaded: true,
        activationStatus: 'active',
        mcpServerUrl: 'http://rtpi-burp-agent:9876',
        mcpHealthCheckPassed: true,
      }).execute();
    });

    it('should deactivate BurpSuite', async () => {
      const response = await fetch(`${API_BASE}/api/v1/burp-activation/deactivate`, {
        method: 'POST',
        headers: { 
          Cookie: authCookie,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.status.activationStatus).toBe('dormant');
      expect(data.status.mcpHealthCheckPassed).toBe(false);
    });
  });

  describe('File Removal', () => {
    beforeEach(async () => {
      await db.insert(burpSetup).values({
        jarUploaded: true,
        jarFilename: 'test.jar',
        licenseUploaded: true,
        licenseFilename: 'license.txt',
        activationStatus: 'dormant',
      }).execute();
    });

    it('should remove JAR file', async () => {
      const response = await fetch(`${API_BASE}/api/v1/burp-activation/jar`, {
        method: 'DELETE',
        headers: { Cookie: authCookie },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status.jarUploaded).toBe(false);
    });

    it('should remove license file', async () => {
      const response = await fetch(`${API_BASE}/api/v1/burp-activation/license`, {
        method: 'DELETE',
        headers: { Cookie: authCookie },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status.licenseUploaded).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should perform health check on active system', async () => {
      // Setup: Set status to active
      await db.insert(burpSetup).values({
        activationStatus: 'active',
        mcpServerUrl: 'http://rtpi-burp-agent:9876',
      }).execute();

      const response = await fetch(`${API_BASE}/api/v1/burp-activation/health`, {
        headers: { Cookie: authCookie },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('healthy');
      expect(data).toHaveProperty('lastCheck');
      expect(data).toHaveProperty('activationStatus');
    });

    it('should report unhealthy on dormant system', async () => {
      await db.insert(burpSetup).values({
        activationStatus: 'dormant',
      }).execute();

      const response = await fetch(`${API_BASE}/api/v1/burp-activation/health`, {
        headers: { Cookie: authCookie },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.healthy).toBe(false);
    });
  });
});
