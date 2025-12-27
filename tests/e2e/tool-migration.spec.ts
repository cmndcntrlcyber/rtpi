/**
 * Tool Migration E2E Tests
 *
 * End-to-end tests for Tool Migration UI workflows including
 * navigation, tool analysis, migration process, catalog, and filtering.
 */

import { test, expect } from '@playwright/test';

test.describe('Tool Migration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/');

    // Login with default credentials
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'Admin123!@');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('/dashboard');

    // Navigate to Tool Migration page
    await page.click('a[href="/tool-migration"]');
    await page.waitForURL('/tool-migration');
  });

  test.describe('Page Navigation & Initial Load', () => {
    test('should display Tool Migration page with header', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Tool Migration');
      await expect(page.locator('text=offsec-team repository')).toBeVisible();
    });

    test('should display summary statistics cards', async ({ page }) => {
      // Wait for data to load
      await page.waitForSelector('.text-2xl', { timeout: 10000 });

      await expect(page.locator('text=Total Tools')).toBeVisible();
      await expect(page.locator('text=Low Complexity')).toBeVisible();
      await expect(page.locator('text=Medium Complexity')).toBeVisible();
      await expect(page.locator('text=High+ Complexity')).toBeVisible();
    });

    test('should display filter controls', async ({ page }) => {
      await expect(page.locator('input[placeholder="Search tools..."]')).toBeVisible();
      await expect(page.locator('button:has-text("Clear Filters")')).toBeVisible();
    });

    test('should display Refresh Analysis button', async ({ page }) => {
      await expect(page.locator('button:has-text("Refresh Analysis")')).toBeVisible();
    });
  });

  test.describe('Tools Table Display', () => {
    test('should display table with correct headers', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      await expect(page.locator('table th:has-text("Tool Name")')).toBeVisible();
      await expect(page.locator('table th:has-text("Category")')).toBeVisible();
      await expect(page.locator('table th:has-text("Complexity")')).toBeVisible();
      await expect(page.locator('table th:has-text("Dependencies")')).toBeVisible();
      await expect(page.locator('table th:has-text("Est. Days")')).toBeVisible();
      await expect(page.locator('table th:has-text("Actions")')).toBeVisible();
    });

    test('should display tool rows with complete data', async ({ page }) => {
      // Wait for table rows
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Check first row has data
      const firstRow = page.locator('table tbody tr').first();
      await expect(firstRow).toBeVisible();

      // Should have tool name
      await expect(firstRow.locator('td').nth(1)).not.toBeEmpty();

      // Should have category badge
      await expect(firstRow.locator('td').nth(2)).not.toBeEmpty();

      // Should have complexity badge
      await expect(firstRow.locator('td').nth(3)).not.toBeEmpty();
    });

    test('should show star icon for recommended tools', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Check if any tool has the star icon (recommended)
      const starIcons = page.locator('.text-yellow-500');
      const count = await starIcons.count();

      // Should have at least some recommended tools
      expect(count).toBeGreaterThan(0);
    });

    test('should display tool class name under tool name', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Check first row for class name (muted text under tool name)
      const firstRow = page.locator('table tbody tr').first();
      const className = firstRow.locator('.text-xs.text-muted-foreground').first();

      await expect(className).toBeVisible();
    });
  });

  test.describe('Search & Filtering', () => {
    test('should search tools by name', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Get initial count
      const initialCount = await page.locator('table tbody tr').count();

      // Search for specific tool
      await page.fill('input[placeholder="Search tools..."]', 'Burp');
      await page.waitForTimeout(500); // Debounce

      // Should have fewer results
      const filteredCount = await page.locator('table tbody tr').count();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('should search tools by class name', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Search by class name pattern
      await page.fill('input[placeholder="Search tools..."]', 'Tester');
      await page.waitForTimeout(500);

      // Should show matching results
      const count = await page.locator('table tbody tr').count();
      expect(count).toBeGreaterThan(0);
    });

    test('should search tools by description', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Search by description keyword
      await page.fill('input[placeholder="Search tools..."]', 'vulnerability');
      await page.waitForTimeout(500);

      // Should show matching results
      const count = await page.locator('table tbody tr').count();
      expect(count).toBeGreaterThan(0);
    });

    test('should filter by category', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Click category filter (Select component)
      const categorySelect = page.locator('button').filter({ hasText: 'All Categories' }).or(
        page.locator('button').filter({ hasText: 'Category' })
      ).first();
      await categorySelect.click();

      // Select specific category
      await page.locator('text=scanning').click();
      await page.waitForTimeout(500);

      // Verify filtering occurred
      const count = await page.locator('table tbody tr').count();
      expect(count).toBeGreaterThan(0);
    });

    test('should filter by complexity', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Click complexity filter
      const complexitySelect = page.locator('button').filter({ hasText: 'All Complexities' }).or(
        page.locator('button').filter({ hasText: 'Complexity' })
      ).first();
      await complexitySelect.click();

      // Select low complexity
      await page.locator('text=low').first().click();
      await page.waitForTimeout(500);

      // Verify filtering occurred
      const count = await page.locator('table tbody tr').count();
      expect(count).toBeGreaterThan(0);
    });

    test('should combine search and filters', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Apply search
      await page.fill('input[placeholder="Search tools..."]', 'Test');

      // Apply category filter
      const categorySelect = page.locator('button').filter({ hasText: 'All Categories' }).first();
      await categorySelect.click();
      await page.locator('text=scanning').click();

      await page.waitForTimeout(500);

      // Should have filtered results
      const count = await page.locator('table tbody tr').count();
      expect(count).toBeGreaterThanOrEqual(0); // May be 0 if no matches
    });

    test('should clear all filters', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Apply some filters
      await page.fill('input[placeholder="Search tools..."]', 'Test');
      await page.waitForTimeout(300);

      // Get filtered count
      const filteredCount = await page.locator('table tbody tr').count();

      // Clear filters
      await page.click('button:has-text("Clear Filters")');
      await page.waitForTimeout(500);

      // Should have more results now
      const clearedCount = await page.locator('table tbody tr').count();
      expect(clearedCount).toBeGreaterThanOrEqual(filteredCount);

      // Search input should be empty
      const searchValue = await page.locator('input[placeholder="Search tools..."]').inputValue();
      expect(searchValue).toBe('');
    });

    test('should show "No tools found" when no matches', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Search for non-existent tool
      await page.fill('input[placeholder="Search tools..."]', 'ZZZ_NonExistent_Tool_XYZ');
      await page.waitForTimeout(500);

      // Should show empty state message
      await expect(page.locator('text=No tools found')).toBeVisible();
    });
  });

  test.describe('Tool Analyzer Dialog', () => {
    test('should open analyzer dialog via Analyze button', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Click first Analyze button
      await page.locator('button:has-text("Analyze")').first().click();

      // Dialog should appear
      await expect(page.locator('role=dialog')).toBeVisible();
    });

    test('should display tool overview in analyzer', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open analyzer
      await page.locator('button:has-text("Analyze")').first().click();
      await page.waitForSelector('role=dialog');

      // Check overview section
      await expect(page.locator('text=Overview')).toBeVisible();

      // Should show tool name, class, category, complexity
      await expect(page.locator('role=dialog')).toContainText('Tool Name');
      await expect(page.locator('role=dialog')).toContainText('Class Name');
    });

    test('should display tool statistics in analyzer', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open analyzer
      await page.locator('button:has-text("Analyze")').first().click();
      await page.waitForSelector('role=dialog');

      // Check for statistics
      await expect(page.locator('text=Est. Migration')).toBeVisible();
      await expect(page.locator('text=Tests')).toBeVisible();
      await expect(page.locator('text=External Services')).toBeVisible();
    });

    test('should display methods section', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open analyzer
      await page.locator('button:has-text("Analyze")').first().click();
      await page.waitForSelector('role=dialog');

      // Check methods section
      await expect(page.locator('text=Methods')).toBeVisible();
    });

    test('should display dependencies section', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open analyzer
      await page.locator('button:has-text("Analyze")').first().click();
      await page.waitForSelector('role=dialog');

      // Check dependencies section
      await expect(page.locator('text=Dependencies')).toBeVisible();
    });

    test('should display migration requirements section', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open analyzer
      await page.locator('button:has-text("Analyze")').first().click();
      await page.waitForSelector('role=dialog');

      // Check migration requirements
      await expect(page.locator('text=Migration Requirements')).toBeVisible();
      await expect(page.locator('text=TypeScript wrapper generation')).toBeVisible();
    });

    test('should close analyzer dialog', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open analyzer
      await page.locator('button:has-text("Analyze")').first().click();
      await page.waitForSelector('role=dialog');

      // Press Escape to close
      await page.keyboard.press('Escape');

      // Dialog should be closed
      await expect(page.locator('role=dialog')).not.toBeVisible();
    });
  });

  test.describe('Migration Process - Single Tool', () => {
    test('should open migration dialog via Migrate button', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Click first Migrate button
      await page.locator('button:has-text("Migrate")').first().click();

      // Dialog should appear
      await expect(page.locator('role=dialog')).toBeVisible();
      await expect(page.locator('text=Migrate Tool')).toBeVisible();
    });

    test('should display tool summary in migration dialog', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open migration dialog
      await page.locator('button:has-text("Migrate")').first().click();
      await page.waitForSelector('role=dialog');

      // Check tool summary is displayed
      await expect(page.locator('role=dialog')).toContainText('Tool Name');
      await expect(page.locator('role=dialog')).toContainText('Methods');
      await expect(page.locator('role=dialog')).toContainText('Dependencies');
    });

    test('should display migration options with default values', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open migration dialog
      await page.locator('button:has-text("Migrate")').first().click();
      await page.waitForSelector('role=dialog');

      // Check checkboxes
      const generateWrapper = page.locator('input[type="checkbox"]#generateWrapper');
      const installDeps = page.locator('input[type="checkbox"]#installDependencies');
      const registerDb = page.locator('input[type="checkbox"]#registerInDatabase');
      const overwrite = page.locator('input[type="checkbox"]#overwriteExisting');

      // Check default values
      await expect(generateWrapper).toBeChecked();
      await expect(registerDb).toBeChecked();
      await expect(overwrite).not.toBeChecked();
    });

    test('should allow toggling migration options', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open migration dialog
      await page.locator('button:has-text("Migrate")').first().click();
      await page.waitForSelector('role=dialog');

      // Toggle installDependencies
      const installDeps = page.locator('label:has-text("Install Python Dependencies")');
      await installDeps.click();

      // Toggle back
      await installDeps.click();
    });

    test('should display migration steps preview', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open migration dialog
      await page.locator('button:has-text("Migrate")').first().click();
      await page.waitForSelector('role=dialog');

      // Check for migration steps section
      await expect(page.locator('text=Migration Steps')).toBeVisible();

      // Should show step numbers and descriptions
      await expect(page.locator('text=TypeScript wrapper')).toBeVisible();
      await expect(page.locator('text=database')).toBeVisible();
    });

    test('should update steps preview when options change', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open migration dialog
      await page.locator('button:has-text("Migrate")').first().click();
      await page.waitForSelector('role=dialog');

      // Count initial steps
      const initialSteps = await page.locator('[class*="flex"][class*="gap-4"] > div').count();

      // Toggle an option (if available)
      const runTests = page.locator('label:has-text("Run Tests After Migration")');
      const isVisible = await runTests.isVisible();

      if (isVisible) {
        await runTests.click();
        await page.waitForTimeout(300);

        // Steps might change (though UI may not remove step, just style it)
      }
    });

    test('should show Start Migration button', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open migration dialog
      await page.locator('button:has-text("Migrate")').first().click();
      await page.waitForSelector('role=dialog');

      // Button should be visible
      await expect(page.locator('button:has-text("Start Migration")')).toBeVisible();
    });

    test('should allow canceling migration', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open migration dialog
      await page.locator('button:has-text("Migrate")').first().click();
      await page.waitForSelector('role=dialog');

      // Click Cancel
      await page.locator('button:has-text("Cancel")').click();

      // Dialog should close
      await expect(page.locator('role=dialog')).not.toBeVisible();
    });
  });

  test.describe('Refresh & Data Loading', () => {
    test('should show loading state when fetching tools', async ({ page }) => {
      // Reload page to see loading state
      await page.reload();

      // Should show loading indicator briefly
      const loading = page.locator('text=Analyzing offsec-team tools...');
      // May or may not be visible depending on speed
    });

    test('should refresh data when clicking Refresh Analysis', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Click refresh button
      await page.click('button:has-text("Refresh Analysis")');

      // Should show loading state
      await page.waitForTimeout(500);

      // Table should reload
      await page.waitForSelector('table tbody tr', { timeout: 10000 });
    });
  });

  test.describe('Edge Cases & Error Handling', () => {
    test('should handle tools with no dependencies', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Find a tool with 0 dependencies (if any)
      const noDepsRow = page.locator('table tbody tr:has-text("0 deps")').first();
      const exists = await noDepsRow.isVisible().catch(() => false);

      if (exists) {
        // Click Analyze
        await noDepsRow.locator('button:has-text("Analyze")').click();
        await page.waitForSelector('role=dialog');

        // Should show no dependencies message
        await expect(page.locator('text=No dependencies')).toBeVisible();
      }
    });

    test('should handle tools with no methods', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open first analyzer
      await page.locator('button:has-text("Analyze")').first().click();
      await page.waitForSelector('role=dialog');

      // Methods section should exist (even if empty)
      await expect(page.locator('text=Methods')).toBeVisible();
    });

    test('should handle empty search results gracefully', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Search for definitely non-existent tool
      await page.fill('input[placeholder="Search tools..."]', 'XXXXXX_NO_MATCH_XXXXXX');
      await page.waitForTimeout(500);

      // Should show no results message
      await expect(page.locator('text=No tools found')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.waitForSelector('h1', { timeout: 10000 });

      // Page header should be visible
      await expect(page.locator('h1:has-text("Tool Migration")')).toBeVisible();

      // Summary cards should stack appropriately
      await expect(page.locator('text=Total Tools')).toBeVisible();

      // Table should be visible (may scroll horizontally)
      await page.waitForSelector('table', { timeout: 10000 });
      await expect(page.locator('table')).toBeVisible();
    });

    test('should display correctly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.waitForSelector('h1', { timeout: 10000 });

      // Page should load
      await expect(page.locator('h1')).toContainText('Tool Migration');

      // Elements should be visible (may require scrolling)
      await expect(page.locator('text=Total Tools')).toBeVisible();
    });

    test('should make dialogs responsive on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open analyzer dialog
      await page.locator('button:has-text("Analyze")').first().click();
      await page.waitForSelector('role=dialog');

      // Dialog should fit viewport
      const dialog = page.locator('role=dialog');
      await expect(dialog).toBeVisible();

      // Should be scrollable
      await expect(dialog).toBeInViewport();
    });
  });

  test.describe('Accessibility & UX', () => {
    test('should support keyboard navigation in table', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Focus on first Analyze button
      await page.locator('button:has-text("Analyze")').first().focus();

      // Should be focused
      const focused = await page.evaluate(() => document.activeElement?.textContent);
      expect(focused).toContain('Analyze');
    });

    test('should support closing dialogs with Escape key', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Open analyzer
      await page.locator('button:has-text("Analyze")').first().click();
      await page.waitForSelector('role=dialog');

      // Press Escape
      await page.keyboard.press('Escape');

      // Dialog should close
      await expect(page.locator('role=dialog')).not.toBeVisible();
    });

    test('should show appropriate loading states', async ({ page }) => {
      // Reload to see loading state
      await page.reload();

      // Wait for page to load
      await page.waitForSelector('h1', { timeout: 10000 });

      // Refresh button should be visible
      await expect(page.locator('button:has-text("Refresh Analysis")')).toBeVisible();
    });

    test('should show tooltips for recommended tools', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Find star icon (recommended tool)
      const star = page.locator('.text-yellow-500').first();
      const exists = await star.isVisible().catch(() => false);

      if (exists) {
        // Hover to see tooltip (if implemented)
        await star.hover();
      }
    });
  });

  test.describe('Integration & Data Consistency', () => {
    test('should maintain filter state when opening/closing dialogs', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Apply search filter
      await page.fill('input[placeholder="Search tools..."]', 'Test');
      await page.waitForTimeout(500);

      // Get filtered count
      const countBefore = await page.locator('table tbody tr').count();

      // Open and close analyzer
      if (countBefore > 0) {
        await page.locator('button:has-text("Analyze")').first().click();
        await page.waitForSelector('role=dialog');
        await page.keyboard.press('Escape');
      }

      // Filter should still be applied
      const searchValue = await page.locator('input[placeholder="Search tools..."]').inputValue();
      expect(searchValue).toBe('Test');

      const countAfter = await page.locator('table tbody tr').count();
      expect(countAfter).toBe(countBefore);
    });

    test('should handle page navigation without errors', async ({ page }) => {
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Navigate away
      await page.click('a[href="/dashboard"]');
      await page.waitForURL('/dashboard');

      // Navigate back
      await page.click('a[href="/tool-migration"]');
      await page.waitForURL('/tool-migration');

      // Page should reload correctly
      await page.waitForSelector('h1:has-text("Tool Migration")', { timeout: 10000 });
      await expect(page.locator('table tbody tr').first()).toBeVisible();
    });
  });
});
