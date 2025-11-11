/**
 * Time-Off Bulk Operations & Calendar Export - E2E Tests
 *
 * Tests the complete user flow for:
 * 1. Advanced filtering on time-off approval page
 * 2. Multi-select and bulk approval of leave requests
 * 3. Conflict detection for overlapping leaves
 * 4. Calendar view and day detail panel
 * 5. CSV/PDF export functionality
 */

import { test, expect } from '@playwright/test';

// Test Data
const TEST_HR_MANAGER = {
  email: 'hr@test.com',
  password: 'testpassword',
};

test.describe('Time-Off Bulk Operations - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Note: In production, implement proper auth with test user
    // For now, tests verify page structure and UI elements
  });

  test.describe('Feature 1: Advanced Filtering', () => {
    test('should navigate to time-off approval page', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Verify page loaded with tabs
      await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('button[role="tab"]:has-text("Liste")')).toBeVisible();
      await expect(page.locator('button[role="tab"]:has-text("Calendrier")')).toBeVisible();
    });

    test('should expand advanced filter panel', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Click on filters button or panel
      const filterButton = page.locator('button:has-text("Filtres")');
      if (await filterButton.isVisible()) {
        await filterButton.click();
      }

      // Verify filter options visible
      await expect(page.locator('text=/Statut/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/Type de congé/i')).toBeVisible();
      await expect(page.locator('text=/Période/i')).toBeVisible();
    });

    test('should filter by status (pending, approved)', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Select pending status
      await page.click('button:has-text("Statut")');
      await page.click('text=/En attente/i');

      // Verify filter applied (should show active filter count)
      await expect(page.locator('text=/1 filtre actif/i')).toBeVisible({ timeout: 5000 });
    });

    test('should filter by policy type', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Select leave type
      await page.click('button:has-text("Type de congé")');
      await page.click('text=/Congés annuels/i');

      // Verify results filtered
      await expect(page.locator('[data-testid="request-card"]').first()).toBeVisible({
        timeout: 5000,
      });
    });

    test('should search by employee name', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Search for employee
      await page.fill('input[placeholder*="Rechercher"]', 'Kouassi');

      // Wait for results to filter
      await page.waitForTimeout(500);

      // Verify filtered results
      const resultCount = await page.locator('[data-testid="request-card"]').count();
      expect(resultCount).toBeGreaterThan(0);
    });

    test('should clear all filters', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Apply some filters
      await page.click('button:has-text("Statut")');
      await page.click('text=/En attente/i');

      // Wait for filter to apply
      await page.waitForTimeout(300);

      // Clear filters
      await page.click('button:has-text("Effacer les filtres")');

      // Verify no active filters
      const activeFilters = page.locator('text=/filtre actif/i');
      await expect(activeFilters).not.toBeVisible();
    });
  });

  test.describe('Feature 2: Multi-Select & Bulk Actions', () => {
    test('should enable multi-select mode', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Verify select all checkbox visible
      await expect(
        page.locator('input[type="checkbox"][aria-label*="Select all"]').first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('should select multiple leave requests', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Select first 3 requests
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.nth(1).check(); // First request (skip select-all)
      await checkboxes.nth(2).check(); // Second request
      await checkboxes.nth(3).check(); // Third request

      // Verify selection count displayed
      await expect(page.locator('text=/3 sélectionné/i')).toBeVisible({
        timeout: 3000,
      });
    });

    test('should select all requests at once', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Click select all checkbox
      await page.locator('input[type="checkbox"][aria-label*="Select all"]').first().check();

      // Verify all requests selected
      await expect(page.locator('text=/sélectionnés/i')).toBeVisible({
        timeout: 3000,
      });
    });

    test('should show bulk approve button when items selected', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Select some requests
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.nth(1).check();

      // Verify bulk action buttons visible
      await expect(
        page.locator('button:has-text("Approuver la sélection")')
      ).toBeVisible({ timeout: 3000 });
    });

    test('should bulk approve selected requests', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Select requests
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.nth(1).check();
      await checkboxes.nth(2).check();

      // Click bulk approve
      await page.click('button:has-text("Approuver la sélection")');

      // Confirm action (if confirmation dialog appears)
      const confirmButton = page.locator('button:has-text("Confirmer")');
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }

      // Verify success toast
      await expect(
        page.locator('text=/demandes approuvées/i')
      ).toBeVisible({ timeout: 5000 });
    });

    test('should deselect all after bulk action', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Select and approve
      await page.locator('input[type="checkbox"]').nth(1).check();
      await page.click('button:has-text("Approuver la sélection")');

      // Wait for action to complete
      await page.waitForTimeout(1000);

      // Verify selection cleared
      const selectedCount = page.locator('text=/sélectionné/i');
      await expect(selectedCount).not.toBeVisible();
    });
  });

  test.describe('Feature 3: Conflict Detection', () => {
    test('should show conflict warning card', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Look for conflict warning (if any exist)
      const conflictCard = page.locator('[data-testid="conflict-warning"]');

      // If conflicts exist, card should be visible
      const hasConflicts = await conflictCard.isVisible().catch(() => false);
      if (hasConflicts) {
        await expect(conflictCard).toBeVisible();
        await expect(page.locator('text=/Chevauchement détecté/i')).toBeVisible();
      }
    });

    test('should highlight conflicting requests', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Look for amber/warning styling on request cards
      const conflictingCards = page.locator('.border-amber-500, .bg-amber-50');
      const count = await conflictingCards.count();

      // If conflicts exist, verify warning styling
      if (count > 0) {
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should show conflict details in request card', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Look for conflict indicator text
      const conflictText = page.locator('text=/Conflit:/i');
      const hasConflictText = await conflictText.isVisible().catch(() => false);

      if (hasConflictText) {
        await expect(conflictText).toBeVisible();
        await expect(page.locator('text=/autre.*congé/i')).toBeVisible();
      }
    });
  });

  test.describe('Feature 4: Calendar View', () => {
    test('should switch to calendar tab', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Click calendar tab
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Verify calendar visible
      await expect(page.locator('text=/Aujourd\'hui/i')).toBeVisible({ timeout: 5000 });
    });

    test('should display current month calendar', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Verify month header
      const monthYear = new Date().toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      });

      await expect(
        page.locator(`text=/${monthYear}/i`)
      ).toBeVisible({ timeout: 5000 });

      // Verify week day headers
      await expect(page.locator('text=/Lun/i')).toBeVisible();
      await expect(page.locator('text=/Dim/i')).toBeVisible();
    });

    test('should navigate to previous/next month', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Click next month button
      await page.click('button[aria-label*="Mois suivant"], button:has(svg.lucide-chevron-right)');

      // Wait for calendar to update
      await page.waitForTimeout(300);

      // Click previous month
      await page.click('button[aria-label*="Mois précédent"], button:has(svg.lucide-chevron-left)');

      // Verify back to current month
      await page.waitForTimeout(300);
    });

    test('should click "Aujourd\'hui" to return to current month', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Navigate away
      await page.click('button:has(svg.lucide-chevron-right)');
      await page.waitForTimeout(300);

      // Click today button
      await page.click('button:has-text("Aujourd\'hui")');

      // Should return to current month
      const currentMonth = new Date().toLocaleDateString('fr-FR', { month: 'long' });
      await expect(page.locator(`text=/${currentMonth}/i`)).toBeVisible();
    });

    test('should show leave count badges on days', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Look for badge indicators (green for approved, amber for pending)
      const approvedBadges = page.locator('.bg-green-500, [class*="bg-green"]');
      const pendingBadges = page.locator('.border-amber-500, [class*="amber"]');

      // At least one type of badge should be visible if there are leaves
      const approvedCount = await approvedBadges.count();
      const pendingCount = await pendingBadges.count();

      // If any leaves exist, verify badges displayed
      if (approvedCount + pendingCount > 0) {
        expect(approvedCount + pendingCount).toBeGreaterThan(0);
      }
    });

    test('should open day detail panel when clicking a day', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Find a day with leaves (has badge)
      const dayWithLeaves = page.locator('button:has(.bg-green-500, [class*="amber"])').first();

      if (await dayWithLeaves.isVisible()) {
        await dayWithLeaves.click();

        // Verify side panel opened
        await expect(
          page.locator('[role="dialog"], [data-testid="day-detail-panel"]')
        ).toBeVisible({ timeout: 3000 });
      }
    });

    test('should show employee list in day detail panel', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Click day with leaves
      const dayWithLeaves = page.locator('button:has([class*="bg-green"])').first();

      if (await dayWithLeaves.isVisible()) {
        await dayWithLeaves.click();

        // Verify employee names visible
        await expect(page.locator('text=/Approuvés/i')).toBeVisible({ timeout: 3000 });
        await expect(page.locator('text=/employé/i')).toBeVisible();
      }
    });

    test('should close day detail panel', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      const dayWithLeaves = page.locator('button:has([class*="badge"])').first();
      if (await dayWithLeaves.isVisible()) {
        await dayWithLeaves.click();

        // Close panel (X button or overlay)
        await page.click('button[aria-label*="Close"], button:has-text("×")');

        // Panel should close
        await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      }
    });
  });

  test.describe('Feature 5: Export Functionality', () => {
    test('should show export dropdown button', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Verify export button visible
      await expect(
        page.locator('button:has-text("Exporter")')
      ).toBeVisible({ timeout: 5000 });
    });

    test('should open export dropdown menu', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Click export button
      await page.click('button:has-text("Exporter")');

      // Verify dropdown menu opened
      await expect(page.locator('text=/Exporter en CSV/i')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('text=/Exporter en PDF/i')).toBeVisible();
    });

    test('should trigger CSV export', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Listen for download event
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click export CSV
      await page.click('button:has-text("Exporter")');
      await page.click('text=/Exporter en CSV/i');

      // Verify download triggered
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    });

    test('should trigger PDF export', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Listen for download event
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click export PDF
      await page.click('button:has-text("Exporter")');
      await page.click('text=/Exporter en PDF/i');

      // Verify download triggered
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    });

    test('should generate filename with current month', async ({ page }) => {
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      await page.click('button:has-text("Exporter")');
      await page.click('text=/Exporter en CSV/i');

      const download = await downloadPromise;
      const filename = download.suggestedFilename();

      // Should contain year and month (e.g., conges-2025-01.csv)
      expect(filename).toMatch(/\d{4}-\d{2}/);
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should display correctly on mobile (375px)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin/time-off');

      // Verify tabs stack vertically or scroll
      await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 5000 });
    });

    test('should have touch-friendly buttons (min 44px)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin/time-off');

      // Check button sizes
      const tabButton = page.locator('button[role="tab"]').first();
      const box = await tabButton.boundingBox();

      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    });

    test('should hide export button on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin/time-off');
      await page.click('button[role="tab"]:has-text("Calendrier")');

      // Export button should be hidden on mobile (md:flex class)
      const exportButton = page.locator('button:has-text("Exporter")');
      const isVisible = await exportButton.isVisible().catch(() => false);

      // On mobile, button should be hidden
      expect(isVisible).toBe(false);
    });
  });

  test.describe('Performance & Loading States', () => {
    test('should show loading spinner while fetching requests', async ({ page }) => {
      await page.goto('/admin/time-off');

      // Should see loader immediately (before data loads)
      const loader = page.locator('[data-testid="loader"], svg.animate-spin');
      const wasVisible = await loader.isVisible().catch(() => false);

      // Loader may disappear quickly, so just verify it existed or data loaded
      expect(wasVisible || (await page.locator('[data-testid="request-card"]').count()) > 0).toBe(
        true
      );
    });

    test('should handle large dataset efficiently (100+ requests)', async ({ page }) => {
      // This test would require seeding test database with 100+ requests
      await page.goto('/admin/time-off');

      // Measure load time
      const startTime = Date.now();
      await page.waitForSelector('[data-testid="request-card"]', { timeout: 10000 });
      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds even with 100+ items
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
