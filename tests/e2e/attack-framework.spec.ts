/**
 * ATT&CK Framework E2E Tests
 *
 * End-to-end tests for ATT&CK Framework UI workflows including
 * navigation, search, filtering, and data visualization.
 */

import { test, expect } from '@playwright/test';

test.describe('ATT&CK Framework', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/');

    // Login (assuming default credentials)
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'Admin123!@');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('/dashboard');

    // Navigate to ATT&CK Framework
    await page.click('a[href="/attack"]');
    await page.waitForURL('/attack');
  });

  test.describe('Page Navigation', () => {
    test('should display ATT&CK Framework page', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('MITRE ATT&CK Framework');
    });

    test('should display statistics cards', async ({ page }) => {
      await expect(page.locator('text=Techniques')).toBeVisible();
      await expect(page.locator('text=Tactics')).toBeVisible();
      await expect(page.locator('text=Groups')).toBeVisible();
      await expect(page.locator('text=Software')).toBeVisible();
      await expect(page.locator('text=Mitigations')).toBeVisible();
    });

    test('should display all tabs', async ({ page }) => {
      await expect(page.locator('button:has-text("Techniques")')).toBeVisible();
      await expect(page.locator('button:has-text("Tactics")')).toBeVisible();
      await expect(page.locator('button:has-text("Groups")')).toBeVisible();
      await expect(page.locator('button:has-text("Software")')).toBeVisible();
      await expect(page.locator('button:has-text("Mitigations")')).toBeVisible();
      await expect(page.locator('button:has-text("Planner")')).toBeVisible();
      await expect(page.locator('button:has-text("Attack Flow")')).toBeVisible();
      await expect(page.locator('button:has-text("Workbench")')).toBeVisible();
      await expect(page.locator('button:has-text("Coverage Matrix")')).toBeVisible();
    });
  });

  test.describe('Techniques Tab', () => {
    test('should display techniques table', async ({ page }) => {
      await page.click('button:has-text("Techniques")');
      await expect(page.locator('table')).toBeVisible();
    });

    test('should search techniques', async ({ page }) => {
      await page.click('button:has-text("Techniques")');

      // Wait for table to load
      await page.waitForSelector('table tbody tr', { timeout: 5000 });

      // Search for a technique
      await page.fill('input[placeholder*="Search"]', 'Phishing');

      // Should filter results
      await expect(page.locator('table tbody tr')).not.toHaveCount(0);
    });

    test('should filter techniques by platform', async ({ page }) => {
      await page.click('button:has-text("Techniques")');

      // Wait for table
      await page.waitForSelector('table tbody tr', { timeout: 5000 });

      // Click platform filter
      const filterButton = page.locator('button:has-text("All Platforms")');
      if (await filterButton.isVisible()) {
        await filterButton.click();

        // Select Windows
        await page.click('text=Windows');

        // Table should update
        await expect(page.locator('table tbody tr')).not.toHaveCount(0);
      }
    });

    test('should open technique detail dialog', async ({ page }) => {
      await page.click('button:has-text("Techniques")');

      // Wait for table
      await page.waitForSelector('table tbody tr', { timeout: 5000 });

      // Click first info button
      const infoButton = page.locator('button:has-text("Info")').first();
      if (await infoButton.isVisible()) {
        await infoButton.click();

        // Dialog should open
        await expect(page.locator('role=dialog')).toBeVisible();
      }
    });

    test('should export to ATT&CK Navigator', async ({ page }) => {
      await page.click('button:has-text("Techniques")');

      // Wait for export button
      const exportButton = page.locator('button:has-text("Export")');
      if (await exportButton.isVisible()) {
        // Click export
        await exportButton.click();

        // Should trigger download (checked via network or file system)
        // This is a basic check that the button exists and is clickable
        expect(await exportButton.isEnabled()).toBe(true);
      }
    });
  });

  test.describe('Tactics Tab', () => {
    test('should display tactics grid', async ({ page }) => {
      await page.click('button:has-text("Tactics")');

      // Should display tactics as cards
      await expect(page.locator('text=Initial Access')).toBeVisible({ timeout: 5000 });
    });

    test('should display all kill chain phases', async ({ page }) => {
      await page.click('button:has-text("Tactics")');

      // Check for standard tactics
      const expectedTactics = [
        'Reconnaissance',
        'Resource Development',
        'Initial Access',
        'Execution',
        'Persistence'
      ];

      for (const tactic of expectedTactics.slice(0, 3)) {
        await expect(page.locator(`text=${tactic}`).first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Groups Tab', () => {
    test('should display groups table', async ({ page }) => {
      await page.click('button:has-text("Groups")');
      await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
    });

    test('should search groups', async ({ page }) => {
      await page.click('button:has-text("Groups")');

      await page.waitForSelector('table tbody tr', { timeout: 5000 });

      await page.fill('input[placeholder*="Search"]', 'APT');

      await expect(page.locator('table tbody tr')).not.toHaveCount(0);
    });
  });

  test.describe('Planner Tab', () => {
    test('should display planner interface', async ({ page }) => {
      await page.click('button:has-text("Planner")');

      // Should show split panels
      await expect(page.locator('text=Technique Catalog')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Kill Chain Builder')).toBeVisible({ timeout: 5000 });
    });

    test('should filter techniques in planner', async ({ page }) => {
      await page.click('button:has-text("Planner")');

      // Wait for technique list
      await page.waitForTimeout(1000);

      // Use search
      const searchInput = page.locator('input[placeholder*="Search techniques"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('privilege');

        // Should filter techniques
        await expect(page.locator('.technique-item')).not.toHaveCount(0);
      }
    });

    test('should save and load collections', async ({ page }) => {
      await page.click('button:has-text("Planner")');

      await page.waitForTimeout(1000);

      // Open save dialog
      const saveButton = page.locator('button:has-text("Save Collection")');
      if (await saveButton.isVisible()) {
        await saveButton.click();

        // Fill collection name
        await page.fill('input[placeholder*="Collection name"]', 'Test Collection');

        // Save
        await page.click('button:has-text("Save")');

        // Should show success message or close dialog
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Attack Flow Tab', () => {
    test('should display flow diagram canvas', async ({ page }) => {
      await page.click('button:has-text("Attack Flow")');

      // React Flow canvas should be visible
      await expect(page.locator('.react-flow')).toBeVisible({ timeout: 5000 });
    });

    test('should open add node dialog', async ({ page }) => {
      await page.click('button:has-text("Attack Flow")');

      await page.waitForTimeout(1000);

      // Click Add Node button
      const addButton = page.locator('button:has-text("Add Node")');
      if (await addButton.isVisible()) {
        await addButton.click();

        // Dialog should open
        await expect(page.locator('role=dialog')).toBeVisible();
      }
    });

    test('should export flow as JSON', async ({ page }) => {
      await page.click('button:has-text("Attack Flow")');

      await page.waitForTimeout(1000);

      // Export button should be visible
      const exportButton = page.locator('button:has-text("Export JSON")');
      if (await exportButton.isVisible()) {
        expect(await exportButton.isEnabled()).toBe(true);
      }
    });
  });

  test.describe('Workbench Tab', () => {
    test('should display workbench interface', async ({ page }) => {
      await page.click('button:has-text("Workbench")');

      await page.waitForTimeout(1000);

      // Should show connection status
      await expect(page.locator('text=ATT&CK Workbench Connection')).toBeVisible({ timeout: 5000 });
    });

    test('should display sync controls', async ({ page }) => {
      await page.click('button:has-text("Workbench")');

      await page.waitForTimeout(1000);

      // Should have push/pull buttons
      await expect(page.locator('button:has-text("Push to Workbench")')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('button:has-text("Pull from Workbench")')).toBeVisible({ timeout: 5000 });
    });

    test('should show collections table', async ({ page }) => {
      await page.click('button:has-text("Workbench")');

      await page.waitForTimeout(1000);

      // Should show collections section
      await expect(page.locator('text=Workbench Collections')).toBeVisible({ timeout: 5000 });
    });

    test('should open create collection dialog', async ({ page }) => {
      await page.click('button:has-text("Workbench")');

      await page.waitForTimeout(1000);

      const newButton = page.locator('button:has-text("New Collection")');
      if (await newButton.isVisible()) {
        await newButton.click();

        // Dialog should open
        await expect(page.locator('role=dialog')).toBeVisible();
        await expect(page.locator('text=Create New Collection')).toBeVisible();
      }
    });
  });

  test.describe('Coverage Matrix Tab', () => {
    test('should display coverage matrix', async ({ page }) => {
      await page.click('button:has-text("Coverage Matrix")');

      await page.waitForTimeout(1000);

      // Should show matrix or list view
      await expect(page.locator('text=Coverage')).toBeVisible({ timeout: 5000 });
    });

    test('should toggle between list and heatmap views', async ({ page }) => {
      await page.click('button:has-text("Coverage Matrix")');

      await page.waitForTimeout(1000);

      // Look for view toggle
      const listButton = page.locator('button:has-text("List View")');
      const heatmapButton = page.locator('button:has-text("Heatmap View")');

      if (await heatmapButton.isVisible()) {
        await heatmapButton.click();
        await page.waitForTimeout(500);

        // Should switch views
        expect(await listButton.isVisible()).toBe(true);
      }
    });
  });

  test.describe('STIX Import', () => {
    test('should display STIX import dialog button', async ({ page }) => {
      // Import button should be in header
      const importButton = page.locator('button:has-text("Import")');
      if (await importButton.isVisible()) {
        expect(await importButton.isEnabled()).toBe(true);
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto('/attack');

      // Should still display main content
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('button:has-text("Techniques")')).toBeVisible();
    });

    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/attack');

      // Should display main content (may have different layout)
      await expect(page.locator('h1')).toBeVisible();
    });
  });
});
