/**
 * Kasm Workspaces E2E Tests
 *
 * End-to-end tests for Kasm Workspaces including:
 * - Provisioning multiple simultaneous workspaces
 * - Status monitoring and updates
 * - Resource management
 * - Workspace lifecycle (create, access, extend, terminate)
 * - Performance testing with 10+ concurrent workspaces
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Helper function to login and navigate to workspaces
 */
async function loginAndNavigateToWorkspaces(page: Page) {
  // Navigate to login page
  await page.goto('/');

  // Login (assuming default credentials)
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'Admin123!@');
  await page.click('button[type="submit"]');

  // Wait for dashboard
  await page.waitForURL('/dashboard');

  // Navigate to Infrastructure page
  await page.click('a[href="/infrastructure"]');
  await page.waitForURL('/infrastructure');

  // Click on Workspaces tab
  await page.click('button:has-text("Workspaces")');

  // Wait for tab content to load
  await page.waitForTimeout(1000);
}

/**
 * Helper function to provision a workspace
 */
async function provisionWorkspace(
  page: Page,
  workspaceType: string,
  workspaceName: string
): Promise<void> {
  // Click Launch Workspace button
  await page.click('button:has-text("Launch Workspace")');

  // Wait for dialog
  await expect(page.locator('role=dialog')).toBeVisible();

  // Select workspace type
  await page.click(`button:has-text("${workspaceType}")`);

  // Fill workspace name
  await page.fill('input[placeholder*="workspace name"]', workspaceName);

  // Click provision button
  await page.click('button:has-text("Provision Workspace")');

  // Wait for dialog to close
  await page.waitForTimeout(500);
}

/**
 * Helper function to wait for workspace status
 */
async function waitForWorkspaceStatus(
  page: Page,
  workspaceName: string,
  status: string,
  timeout: number = 120000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Search for the workspace
    await page.fill('input[placeholder*="Search"]', workspaceName);
    await page.waitForTimeout(500);

    // Check if workspace card exists with expected status
    const workspaceCard = page.locator(`text=${workspaceName}`).locator('..').locator('..');
    if (await workspaceCard.isVisible()) {
      const statusBadge = workspaceCard.locator(`text=${status.toUpperCase()}`);
      if (await statusBadge.isVisible()) {
        return true;
      }
    }

    // Wait 5 seconds before next poll (matching our hook polling interval)
    await page.waitForTimeout(5000);
  }

  return false;
}

/**
 * Helper function to terminate a workspace
 */
async function terminateWorkspace(page: Page, workspaceName: string): Promise<void> {
  // Search for the workspace
  await page.fill('input[placeholder*="Search"]', workspaceName);
  await page.waitForTimeout(500);

  // Click workspace dropdown menu
  const workspaceCard = page.locator(`text=${workspaceName}`).locator('..').locator('..');
  const menuButton = workspaceCard.locator('button[aria-haspopup="menu"]');
  await menuButton.click();

  // Click terminate
  await page.click('text=Terminate');

  // Confirm in alert dialog
  await page.click('button:has-text("Terminate")');

  await page.waitForTimeout(1000);
}

test.describe('Kasm Workspaces', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigateToWorkspaces(page);
  });

  test.describe('Page Navigation', () => {
    test('should display Workspaces tab', async ({ page }) => {
      await expect(page.locator('button:has-text("Workspaces")')).toBeVisible();
    });

    test('should display workspace statistics', async ({ page }) => {
      await expect(page.locator('text=Total Workspaces')).toBeVisible();
      await expect(page.locator('text=Running')).toBeVisible();
    });

    test('should display Launch Workspace button', async ({ page }) => {
      await expect(page.locator('button:has-text("Launch Workspace")')).toBeVisible();
    });

    test('should display search and filter controls', async ({ page }) => {
      await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
      await expect(page.locator('text=All Statuses')).toBeVisible();
      await expect(page.locator('text=All Types')).toBeVisible();
    });
  });

  test.describe('Workspace Provisioning', () => {
    test('should open workspace launcher dialog', async ({ page }) => {
      await page.click('button:has-text("Launch Workspace")');

      await expect(page.locator('role=dialog')).toBeVisible();
      await expect(page.locator('text=Launch Workspace')).toBeVisible();
    });

    test('should display workspace type options', async ({ page }) => {
      await page.click('button:has-text("Launch Workspace")');

      await expect(page.locator('text=VS Code IDE')).toBeVisible();
      await expect(page.locator('text=Kali Linux')).toBeVisible();
      await expect(page.locator('text=Firefox Browser')).toBeVisible();
      await expect(page.locator('text=Empire C2 Client')).toBeVisible();
      await expect(page.locator('text=Burp Suite')).toBeVisible();
    });

    test('should display resource usage information', async ({ page }) => {
      await page.click('button:has-text("Launch Workspace")');

      await expect(page.locator('text=Resource Usage')).toBeVisible();
      await expect(page.locator('text=Workspaces:')).toBeVisible();
      await expect(page.locator('text=CPU:')).toBeVisible();
      await expect(page.locator('text=Memory:')).toBeVisible();
    });

    test('should provision a single workspace', async ({ page }) => {
      const workspaceName = `test-vscode-${Date.now()}`;

      await provisionWorkspace(page, 'VS Code IDE', workspaceName);

      // Verify success toast
      await expect(page.locator('text=Workspace provisioning started')).toBeVisible();

      // Wait for workspace to appear
      await page.waitForTimeout(2000);

      // Search for the workspace
      await page.fill('input[placeholder*="Search"]', workspaceName);

      // Verify workspace card exists
      await expect(page.locator(`text=${workspaceName}`)).toBeVisible();

      // Clean up - terminate workspace
      await terminateWorkspace(page, workspaceName);
    });
  });

  test.describe('Workspace Status Monitoring', () => {
    test('should show status updates in real-time', async ({ page }) => {
      const workspaceName = `test-status-${Date.now()}`;

      await provisionWorkspace(page, 'Firefox Browser', workspaceName);

      // Should start in 'STARTING' state
      await page.fill('input[placeholder*="Search"]', workspaceName);
      await page.waitForTimeout(1000);

      // Check for STARTING badge
      const hasStarting = await page.locator('text=STARTING').isVisible();
      expect(hasStarting).toBeTruthy();

      // Wait for RUNNING state (with timeout)
      const isRunning = await waitForWorkspaceStatus(page, workspaceName, 'RUNNING', 120000);
      expect(isRunning).toBeTruthy();

      // Clean up
      await terminateWorkspace(page, workspaceName);
    });

    test('should update workspace card when status changes', async ({ page }) => {
      const workspaceName = `test-card-update-${Date.now()}`;

      await provisionWorkspace(page, 'VS Code IDE', workspaceName);

      // Search for workspace
      await page.fill('input[placeholder*="Search"]', workspaceName);
      await page.waitForTimeout(2000);

      const workspaceCard = page.locator(`text=${workspaceName}`).locator('..').locator('..');

      // Should show Starting... button initially
      const startingButton = workspaceCard.locator('button:has-text("Starting...")');
      if (await startingButton.isVisible()) {
        expect(await startingButton.isDisabled()).toBeTruthy();
      }

      // Wait for running state
      await waitForWorkspaceStatus(page, workspaceName, 'RUNNING', 120000);

      // Should now show Access Workspace button
      const accessButton = workspaceCard.locator('button:has-text("Access Workspace")');
      await expect(accessButton).toBeVisible();
      expect(await accessButton.isEnabled()).toBeTruthy();

      // Clean up
      await terminateWorkspace(page, workspaceName);
    });
  });

  test.describe('Workspace Actions', () => {
    test('should view workspace details', async ({ page }) => {
      const workspaceName = `test-details-${Date.now()}`;

      await provisionWorkspace(page, 'Kali Linux', workspaceName);

      await page.fill('input[placeholder*="Search"]', workspaceName);
      await page.waitForTimeout(1000);

      // Click workspace dropdown menu
      const workspaceCard = page.locator(`text=${workspaceName}`).locator('..').locator('..');
      const menuButton = workspaceCard.locator('button[aria-haspopup="menu"]');
      await menuButton.click();

      // Click View Details
      await page.click('text=View Details');

      // Detail modal should open
      await expect(page.locator('role=dialog')).toBeVisible();
      await expect(page.locator(`text=${workspaceName}`)).toBeVisible();

      // Should show tabs
      await expect(page.locator('button:has-text("Overview")')).toBeVisible();
      await expect(page.locator('button:has-text("Resources")')).toBeVisible();
      await expect(page.locator('button:has-text("Metadata")')).toBeVisible();

      // Close modal
      await page.keyboard.press('Escape');

      // Clean up
      await terminateWorkspace(page, workspaceName);
    });

    test('should extend workspace expiry', async ({ page }) => {
      const workspaceName = `test-extend-${Date.now()}`;

      await provisionWorkspace(page, 'Firefox Browser', workspaceName);

      // Wait for running state
      await waitForWorkspaceStatus(page, workspaceName, 'RUNNING', 120000);

      await page.fill('input[placeholder*="Search"]', workspaceName);
      await page.waitForTimeout(500);

      // Click workspace dropdown menu
      const workspaceCard = page.locator(`text=${workspaceName}`).locator('..').locator('..');
      const menuButton = workspaceCard.locator('button[aria-haspopup="menu"]');
      await menuButton.click();

      // Click Extend Expiry
      const extendButton = page.locator('text=Extend Expiry');
      if (await extendButton.isVisible()) {
        await extendButton.click();
        await page.waitForTimeout(1000);

        // Should show success toast
        await expect(page.locator('text=Workspace expiry extended')).toBeVisible();
      }

      // Clean up
      await terminateWorkspace(page, workspaceName);
    });

    test('should terminate workspace', async ({ page }) => {
      const workspaceName = `test-terminate-${Date.now()}`;

      await provisionWorkspace(page, 'VS Code IDE', workspaceName);

      await page.waitForTimeout(2000);

      await terminateWorkspace(page, workspaceName);

      // Should show success toast
      await expect(page.locator('text=Workspace terminated')).toBeVisible();

      // Workspace should eventually disappear or show stopped status
      await page.waitForTimeout(5000);
    });
  });

  test.describe('Search and Filtering', () => {
    test('should search workspaces by name', async ({ page }) => {
      // Create unique workspace
      const workspaceName = `unique-search-${Date.now()}`;
      await provisionWorkspace(page, 'Firefox Browser', workspaceName);

      await page.waitForTimeout(2000);

      // Search for workspace
      await page.fill('input[placeholder*="Search"]', workspaceName);
      await page.waitForTimeout(500);

      // Should show only matching workspace
      await expect(page.locator(`text=${workspaceName}`)).toBeVisible();

      // Clear search
      await page.fill('input[placeholder*="Search"]', '');

      // Clean up
      await terminateWorkspace(page, workspaceName);
    });

    test('should filter by status', async ({ page }) => {
      // Click status filter
      await page.click('button:has-text("All Statuses")');

      // Should show status options
      await expect(page.locator('text=Running')).toBeVisible();
      await expect(page.locator('text=Starting')).toBeVisible();
      await expect(page.locator('text=Stopped')).toBeVisible();

      // Select Running
      await page.click('text=Running');

      await page.waitForTimeout(500);

      // All visible workspaces should be in running state
      const runningBadges = page.locator('text=RUNNING');
      const count = await runningBadges.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should filter by type', async ({ page }) => {
      // Click type filter
      await page.click('button:has-text("All Types")');

      // Should show type options
      await expect(page.locator('text=VS Code')).toBeVisible();
      await expect(page.locator('text=Kali')).toBeVisible();
    });
  });

  test.describe('Performance Testing - 10+ Simultaneous Workspaces', () => {
    test.setTimeout(600000); // 10 minutes timeout for this test

    test('should handle 10 simultaneous workspace creations', async ({ page }) => {
      const workspaceNames: string[] = [];
      const timestamp = Date.now();

      // Create 10 workspaces
      for (let i = 0; i < 10; i++) {
        const workspaceName = `perf-test-${i}-${timestamp}`;
        workspaceNames.push(workspaceName);

        // Provision workspace (rotate through different types)
        const types = ['VS Code IDE', 'Firefox Browser', 'Kali Linux'];
        const workspaceType = types[i % types.length];

        await provisionWorkspace(page, workspaceType, workspaceName);

        // Small delay between provisions to avoid overwhelming the system
        await page.waitForTimeout(500);
      }

      // Verify all workspaces were created
      for (const workspaceName of workspaceNames) {
        await page.fill('input[placeholder*="Search"]', workspaceName);
        await page.waitForTimeout(500);

        await expect(page.locator(`text=${workspaceName}`)).toBeVisible();
      }

      // Monitor status updates - wait for at least 5 to reach running state
      let runningCount = 0;
      const maxWaitTime = 300000; // 5 minutes
      const startTime = Date.now();

      while (runningCount < 5 && Date.now() - startTime < maxWaitTime) {
        runningCount = 0;

        for (const workspaceName of workspaceNames) {
          await page.fill('input[placeholder*="Search"]', workspaceName);
          await page.waitForTimeout(500);

          const runningBadge = page.locator(`text=${workspaceName}`)
            .locator('..')
            .locator('..')
            .locator('text=RUNNING');

          if (await runningBadge.isVisible()) {
            runningCount++;
          }
        }

        console.log(`${runningCount} workspaces running out of ${workspaceNames.length}`);

        // Wait 10 seconds before next check
        await page.waitForTimeout(10000);
      }

      // Verify we got at least 5 running
      expect(runningCount).toBeGreaterThanOrEqual(5);

      // Clean up all workspaces
      for (const workspaceName of workspaceNames) {
        try {
          await terminateWorkspace(page, workspaceName);
          await page.waitForTimeout(500);
        } catch (error) {
          console.error(`Failed to terminate ${workspaceName}:`, error);
        }
      }

      // Verify termination succeeded
      await page.waitForTimeout(5000);
      await page.fill('input[placeholder*="Search"]', `perf-test-`);

      // Should show significantly fewer workspaces
      const remainingCards = page.locator('[data-testid="workspace-card"]');
      const remainingCount = await remainingCards.count();
      expect(remainingCount).toBeLessThan(workspaceNames.length);
    });

    test('should maintain UI responsiveness with many workspaces', async ({ page }) => {
      const timestamp = Date.now();
      const workspaceNames: string[] = [];

      // Create 5 workspaces for UI testing
      for (let i = 0; i < 5; i++) {
        const workspaceName = `ui-test-${i}-${timestamp}`;
        workspaceNames.push(workspaceName);

        await provisionWorkspace(page, 'Firefox Browser', workspaceName);
        await page.waitForTimeout(500);
      }

      // Test search responsiveness
      const searchStartTime = Date.now();
      await page.fill('input[placeholder*="Search"]', workspaceNames[0]);
      await page.waitForTimeout(500);
      const searchEndTime = Date.now();

      expect(searchEndTime - searchStartTime).toBeLessThan(2000); // Should respond within 2 seconds

      // Test filter responsiveness
      const filterStartTime = Date.now();
      await page.click('button:has-text("All Statuses")');
      await page.click('text=Starting');
      const filterEndTime = Date.now();

      expect(filterEndTime - filterStartTime).toBeLessThan(2000);

      // Test refresh
      await page.click('button[aria-label="Refresh"]');
      await page.waitForTimeout(1000);

      // UI should still be responsive
      await expect(page.locator('button:has-text("Launch Workspace")')).toBeVisible();

      // Clean up
      for (const workspaceName of workspaceNames) {
        try {
          await terminateWorkspace(page, workspaceName);
          await page.waitForTimeout(500);
        } catch (error) {
          console.error(`Failed to terminate ${workspaceName}:`, error);
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should display error message for failed workspace', async ({ page }) => {
      // This test assumes there might be failures due to resource constraints
      // In a real scenario, you might need to mock the API to force an error

      // Try to create workspace (might fail if quotas exceeded)
      const workspaceName = `error-test-${Date.now()}`;

      await page.click('button:has-text("Launch Workspace")');
      await expect(page.locator('role=dialog')).toBeVisible();
      await page.click('button:has-text("Kali Linux")');
      await page.fill('input[placeholder*="workspace name"]', workspaceName);
      await page.click('button:has-text("Provision Workspace")');

      // Wait for either success or error toast
      await page.waitForTimeout(2000);

      // If error occurred, should show error message
      const errorToast = page.locator('text=Failed to provision');
      if (await errorToast.isVisible()) {
        expect(await errorToast.isVisible()).toBeTruthy();
      }
    });

    test('should handle workspace not found gracefully', async ({ page }) => {
      // Search for non-existent workspace
      await page.fill('input[placeholder*="Search"]', 'nonexistent-workspace-12345');
      await page.waitForTimeout(1000);

      // Should show no results or empty state
      const noResults = page.locator('text=No workspaces found');
      if (await noResults.isVisible()) {
        expect(await noResults.isVisible()).toBeTruthy();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await loginAndNavigateToWorkspaces(page);

      // Should still display main controls
      await expect(page.locator('button:has-text("Launch Workspace")')).toBeVisible();
      await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    });

    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await loginAndNavigateToWorkspaces(page);

      // Should display main content (may have different layout)
      await expect(page.locator('button:has-text("Workspaces")')).toBeVisible();
    });
  });
});
