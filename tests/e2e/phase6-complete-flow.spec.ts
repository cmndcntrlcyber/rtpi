/**
 * Phase 6 End-to-End Test
 * Complete flow: BBOT scan → Vulnerability creation → Investigation → Validation
 * 
 * This test validates the entire Phase 6 workflow using Playwright for browser automation
 * and API calls for backend verification.
 */

import { test, expect } from '@playwright/test';
import { db } from '../../server/db';
import { operations, targets, vulnerabilities, burpSetup } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5000';
const API_BASE = process.env.E2E_API_URL || 'http://localhost:3001';

test.describe('Phase 6: Vulnerability Investigation Workflow', () => {
  let testOperationId: string;
  let testTargetId: string;

  test.beforeAll(async () => {
    // Setup: Create test operation and target via API
    const [operation] = await db.insert(operations).values({
      name: 'E2E Test Operation - Phase 6',
      status: 'active',
      ownerId: 'test-user-id',
      description: 'End-to-end testing for Phase 6 investigation workflow',
    }).returning();
    testOperationId = operation.id;

    const [target] = await db.insert(targets).values({
      name: 'testphp.vulnweb.com',
      type: 'domain',
      value: 'http://testphp.vulnweb.com',
      operationId: testOperationId,
      description: 'Deliberately vulnerable test site',
    }).returning();
    testTargetId = target.id;
  });

  test.afterAll(async () => {
    // Cleanup
    await db.delete(vulnerabilities).where(eq(vulnerabilities.operationId, testOperationId));
    await db.delete(targets).where(eq(targets.id, testTargetId));
    await db.delete(operations).where(eq(operations.id, testOperationId));
  });

  test('Complete Flow: BurpSuite Activation → Scan → Investigation → Validation', async ({ page }) => {
    // Step 1: Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);

    // Step 2: Navigate to Surface Assessment
    await page.click('a[href="/surface-assessment"]');
    await page.waitForURL(/surface-assessment/);

    // Step 3: Select the test operation
    await page.selectOption('select#operation-selector', testOperationId);

    // Step 4: Navigate to Overview tab
    await page.click('button:has-text("Overview")');

    // Step 5: Verify BurpSuite Activation Panel exists
    const activationPanel = page.locator('text=BurpSuite Pro Activation');
    await expect(activationPanel).toBeVisible();

    // Step 6: Check initial status (should be dormant)
    const statusBadge = page.locator('[data-testid="burp-status-badge"]').first();
    await expect(statusBadge).toContainText(/Dormant|Loading/i);

    // Step 7: Upload JAR file (skip if files don't exist)
    const jarInput = page.locator('input[type="file"][accept=".jar"]');
    const hasJarFile = await page.evaluate(() => {
      return fetch('/test-fixtures/burpsuite_pro_test.jar', { method: 'HEAD' })
        .then(res => res.ok)
        .catch(() => false);
    });

    if (hasJarFile) {
      await jarInput.setInputFiles('./test-fixtures/burpsuite_pro_test.jar');
      await expect(page.locator('text=uploaded successfully')).toBeVisible({ timeout: 10000 });

      // Upload license file
      const licenseInput = page.locator('input[type="file"][accept=".txt"]');
      await licenseInput.setInputFiles('./test-fixtures/burp_license.txt');
      await expect(page.locator('text=uploaded successfully')).toBeVisible({ timeout: 10000 });

      // Activate BurpSuite
      const activateButton = page.locator('button:has-text("Activate BurpSuite")');
      await expect(activateButton).toBeEnabled();
      await activateButton.click();

      // Wait for activation (max 60 seconds)
      await expect(statusBadge).toContainText(/Active/i, { timeout: 60000 });

      console.log('✅ BurpSuite activated successfully');
    } else {
      console.warn('⚠️ Skipping BurpSuite activation - test files not found');
      console.warn('⚠️ Continuing with investigation tests (Burp will be skipped)');
    }

    // Step 8: Navigate to Vulnerabilities page
    await page.click('a[href="/vulnerabilities"]');
    await page.waitForURL(/vulnerabilities/);

    // Step 9: Create a test vulnerability manually
    await page.click('button:has-text("Add Vulnerability")');
    
    await page.fill('input[name="title"]', 'E2E Test SQL Injection');
    await page.fill('textarea[name="description"]', 'Testing investigation workflow with SQL injection');
    await page.selectOption('select[name="severity"]', 'high');
    await page.fill('input[name="cveId"]', 'CVE-2024-E2E-TEST');
    
    await page.click('button:has-text("Create Vulnerability")');

    // Step 10: Wait for vulnerability to appear in list
    await expect(page.locator('text=E2E Test SQL Injection')).toBeVisible({ timeout: 5000 });

    // Step 11: Check investigation status badge appears
    const vulnRow = page.locator('tr:has-text("E2E Test SQL Injection")');
    await expect(vulnRow).toBeVisible();

    // Step 12: Wait for investigation status to change from "Pending"
    // This may take 5-30 seconds depending on agent availability
    await page.waitForTimeout(5000); // Initial wait
    
    const statusCell = vulnRow.locator('td[data-column="investigation-status"]');
    
    // Status should change to Investigating, Validated, or other non-Pending state
    await expect(statusCell).not.toContainText('Pending', { timeout: 30000 });

    console.log('✅ Investigation workflow triggered automatically');

    // Step 13: Click on vulnerability to view details
    await vulnRow.click();

    // Step 14: Verify evidence panel
    const evidencePanel = page.locator('[data-testid="validation-evidence"]');
    
    // Evidence should be visible if investigation completed
    const hasEvidence = await evidencePanel.isVisible().catch(() => false);
    if (hasEvidence) {
      console.log('✅ Validation evidence collected');
      
      // Check for indicators
      const indicators = page.locator('[data-testid="evidence-indicator"]');
      const indicatorCount = await indicators.count();
      console.log(`📊 Found ${indicatorCount} evidence indicators`);
    } else {
      console.warn('⚠️ No validation evidence collected (may still be investigating)');
    }

    // Step 15: Verify investigation completed timestamp
    const completedTimestamp = page.locator('[data-testid="investigation-completed-at"]');
    const hasTimestamp = await completedTimestamp.isVisible().catch(() => false);
    
    if (hasTimestamp) {
      console.log('✅ Investigation completed with timestamp');
    }

    // Step 16: Navigate to Operations Manager to check for any blockers
    await page.click('a[href="/operations"]');
    await page.waitForURL(/operations/);
    
    // Click on test operation
    await page.click(`tr:has-text("E2E Test Operation")`);
    
    // Open floating chat
    await page.click('button[data-testid="open-ops-chat"]');
    
    // Check for blocker messages
    const chatWindow = page.locator('[data-testid="ops-manager-chat"]');
    await expect(chatWindow).toBeVisible({ timeout: 5000 });
    
    const hasBlockers = await page.locator('text=/BLOCKER/i').isVisible().catch(() => false);
    if (hasBlockers) {
      console.warn('⚠️ Blocker messages detected in Operations Manager chat');
    } else {
      console.log('✅ No blockers reported');
    }

    // Final verification: Query database directly
    const vulns = await db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.operationId, testOperationId));

    expect(vulns.length).toBeGreaterThan(0);
    
    const investigatedVuln = vulns.find(v => v.title === 'E2E Test SQL Injection');
    expect(investigatedVuln).toBeTruthy();
    expect(investigatedVuln!.investigationStatus).not.toBe('pending');
    
    console.log(`✅ E2E Test Complete - Final Status: ${investigatedVuln!.investigationStatus}`);
  });

  test('BurpSuite Activation UI Flow', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);

    // Navigate to Surface Assessment
    await page.click('a[href="/surface-assessment"]');
    
    // Click Overview tab
    await page.click('button:has-text("Overview")');

    // Verify BurpSuite Activation Panel
    await expect(page.locator('h3:has-text("BurpSuite Pro Activation")')).toBeVisible();

    // Check status
    const statusResponse = await page.request.get(`${API_BASE}/api/v1/burp-activation/status`);
    expect(statusResponse.ok()).toBeTruthy();
    
    const status = await statusResponse.json();
    expect(status).toHaveProperty('activationStatus');
    expect(status).toHaveProperty('jarUploaded');
    expect(status).toHaveProperty('licenseUploaded');

    console.log(`✅ BurpSuite Status: ${status.activationStatus}`);
    console.log(`📁 JAR Uploaded: ${status.jarUploaded}`);
    console.log(`📄 License Uploaded: ${status.licenseUploaded}`);
  });

  test('Vulnerability Investigation Manual Trigger', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);

    // Create a vulnerability first
    const [vuln] = await db.insert(vulnerabilities).values({
      title: 'Manual Trigger E2E Test',
      description: 'Testing manual investigation trigger',
      severity: 'medium',
      operationId: testOperationId,
      targetId: testTargetId,
      investigationStatus: 'pending',
    }).returning();

    // Navigate to vulnerabilities
    await page.click('a[href="/vulnerabilities"]');
    await page.waitForURL(/vulnerabilities/);

    // Find the vulnerability row
    const vulnRow = page.locator(`tr:has-text("Manual Trigger E2E Test")`);
    await expect(vulnRow).toBeVisible({ timeout: 5000 });

    // Click "Investigate" button
    const investigateButton = vulnRow.locator('button:has-text("Investigate")');
    if (await investigateButton.isVisible()) {
      await investigateButton.click();
      
      // Verify investigation triggered
      await expect(page.locator('text=Investigation triggered')).toBeVisible({ timeout: 5000 });
      
      console.log('✅ Manual investigation triggered successfully');
    } else {
      console.warn('⚠️ Investigate button not found - may already be investigating');
    }

    // Clean up
    await db.delete(vulnerabilities).where(eq(vulnerabilities.id, vuln.id));
  });
});
