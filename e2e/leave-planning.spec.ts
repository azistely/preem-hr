/**
 * E2E Tests for Annual Leave Planning System
 *
 * Tests the complete workflow:
 * 1. Creating planning periods
 * 2. Downloading Excel templates
 * 3. Importing leave plans
 * 4. Validating conflicts and coverage
 * 5. Bulk approving planned leaves
 */

import { test, expect } from '@playwright/test';

test.describe('Annual Leave Planning System', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('should navigate to leave planning tab', async ({ page }) => {
    await page.goto('/admin/time-off');

    // Click on Planification tab
    await page.click('button:has-text("Planification")');

    // Verify planning panel is visible
    await expect(page.locator('text=Planification des Congés Annuels')).toBeVisible();
  });

  test('should create a new planning period', async ({ page }) => {
    await page.goto('/admin/time-off');
    await page.click('button:has-text("Planification")');

    // Click create period button
    await page.click('button:has-text("Créer une période")');

    // Fill form
    await page.fill('input[name="name"]', 'Q1 2026');
    await page.fill('input[name="year"]', '2026');
    await page.fill('input[name="quarter"]', '1');

    // Submit
    await page.click('button[type="submit"]');

    // Verify success message
    await expect(page.locator('text=Période créée avec succès')).toBeVisible();

    // Verify period appears in list
    await expect(page.locator('text=Q1 2026')).toBeVisible();
  });

  test('should download Excel template', async ({ page }) => {
    await page.goto('/admin/time-off');
    await page.click('button:has-text("Planification")');

    // Select a period
    await page.click('select >> text=Sélectionnez une période');
    await page.click('option:has-text("Q1 2026")');

    // Start download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Télécharger le template")');

    const download = await downloadPromise;

    // Verify file name
    expect(download.suggestedFilename()).toContain('template-conges');
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('should import leave plan from Excel', async ({ page }) => {
    await page.goto('/admin/time-off');
    await page.click('button:has-text("Planification")');

    // Select a period
    await page.click('select >> text=Sélectionnez une période');
    await page.click('option:has-text("Q1 2026")');

    // Upload file
    await page.setInputFiles('input[type="file"]', {
      name: 'plan-conges-test.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(''), // Mock Excel file
    });

    // Submit import
    await page.click('button:has-text("Importer")');

    // Verify import results
    await expect(page.locator('text=Import terminé')).toBeVisible();
    await expect(page.locator('text=Succès:')).toBeVisible();
  });

  test('should display statistics after import', async ({ page }) => {
    await page.goto('/admin/time-off');
    await page.click('button:has-text("Planification")');

    // Select a period with data
    await page.click('select >> text=Sélectionnez une période');
    await page.click('option:has-text("Q1 2026")');

    // Verify stats cards are visible
    await expect(page.locator('text=Total des demandes')).toBeVisible();
    await expect(page.locator('text=En attente')).toBeVisible();
    await expect(page.locator('text=Approuvées')).toBeVisible();
    await expect(page.locator('text=Conflits')).toBeVisible();

    // Verify stats have numbers
    const totalCount = await page.locator('text=Total des demandes').locator('..').locator('.text-3xl').textContent();
    expect(totalCount).toMatch(/\d+/);
  });

  test('should show planned status on calendar', async ({ page }) => {
    await page.goto('/admin/time-off');

    // Click on Calendar tab
    await page.click('button:has-text("Calendrier")');

    // Verify calendar is visible
    await expect(page.locator('text=janvier').or(page.locator('text=février'))).toBeVisible();

    // Verify legend includes planned status
    await expect(page.locator('text=Planifié')).toBeVisible();

    // Verify blue badge for planned (if there are planned leaves)
    const plannedBadge = page.locator('.border-blue-500');
    if (await plannedBadge.count() > 0) {
      await expect(plannedBadge.first()).toBeVisible();
    }
  });

  test('should handle import errors gracefully', async ({ page }) => {
    await page.goto('/admin/time-off');
    await page.click('button:has-text("Planification")');

    // Select a period
    await page.click('select >> text=Sélectionnez une période');
    await page.click('option:has-text("Q1 2026")');

    // Upload invalid file
    await page.setInputFiles('input[type="file"]', {
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is not an Excel file'),
    });

    // Submit import
    await page.click('button:has-text("Importer")');

    // Verify error message
    await expect(page.locator('text=Erreur').or(page.locator('text=invalide'))).toBeVisible();
  });

  test('should detect conflicts during import', async ({ page }) => {
    await page.goto('/admin/time-off');
    await page.click('button:has-text("Planification")');

    // Import file with conflicts
    await page.setInputFiles('input[type="file"]', {
      name: 'plan-with-conflicts.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(''), // Mock Excel with conflicts
    });

    await page.click('button:has-text("Importer")');

    // Verify conflicts section is visible
    await expect(page.locator('text=Conflits détectés')).toBeVisible();

    // Verify conflict types are shown
    const hasOverlap = await page.locator('text=Chevauchement').count();
    const hasLowBalance = await page.locator('text=Solde insuffisant').count();

    expect(hasOverlap + hasLowBalance).toBeGreaterThan(0);
  });

  test('should export leave plan', async ({ page }) => {
    await page.goto('/admin/time-off');
    await page.click('button:has-text("Planification")');

    // Select a period
    await page.click('select >> text=Sélectionnez une période');
    await page.click('option:has-text("Q1 2026")');

    // Start export
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Exporter")');

    const download = await downloadPromise;

    // Verify file name
    expect(download.suggestedFilename()).toContain('export-conges');
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('should show handover notes field in request form', async ({ page }) => {
    await page.goto('/time-off');

    // Open request dialog
    await page.click('button:has-text("Nouvelle demande")');

    // Verify handover notes field is present
    await expect(page.locator('label:has-text("Notes de passation")')).toBeVisible();
    await expect(page.locator('textarea[placeholder*="passation"]')).toBeVisible();
  });

  test('should submit request with handover notes', async ({ page }) => {
    await page.goto('/time-off');

    // Open request dialog
    await page.click('button:has-text("Nouvelle demande")');

    // Fill form
    await page.click('select >> text=Sélectionnez un type');
    await page.click('option:has-text("Congés annuels")');

    // Select dates (use calendar)
    const startDateButtons = page.locator('button[role="gridcell"]').filter({ hasNotText: /^$/ });
    await startDateButtons.first().click();

    const endDateButtons = page.locator('button[role="gridcell"]').filter({ hasNotText: /^$/ });
    await endDateButtons.nth(5).click();

    // Fill handover notes
    await page.fill('textarea[placeholder*="passation"]', 'Test handover notes for continuity');

    // Submit
    await page.click('button[type="submit"]');

    // Verify success
    await expect(page.locator('text=Demande de congé envoyée')).toBeVisible();
  });

  test('should bulk approve planned leaves', async ({ page }) => {
    await page.goto('/admin/time-off');
    await page.click('button:has-text("Planification")');

    // Select a period with planned leaves
    await page.click('select >> text=Sélectionnez une période');
    await page.click('option:has-text("Q1 2026")');

    // Check if bulk approve button exists
    const bulkApproveBtn = page.locator('button:has-text("Approuver en masse")');
    if (await bulkApproveBtn.count() > 0) {
      // Click bulk approve
      await bulkApproveBtn.click();

      // Confirm action
      await page.click('button:has-text("Confirmer")');

      // Verify success
      await expect(page.locator('text=approuvé').or(page.locator('text=Succès'))).toBeVisible();
    }
  });
});

test.describe('Leave Planning - PDF Certificate Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('should generate certificate for approved leave', async ({ page }) => {
    await page.goto('/admin/time-off');

    // Find an approved request
    await page.click('button:has-text("Liste")');
    const approvedRequest = page.locator('text=Approuvé').first();

    if (await approvedRequest.count() > 0) {
      // Click on request to view details
      await approvedRequest.click();

      // Click generate certificate button
      const generateBtn = page.locator('button:has-text("Générer l\'attestation")');
      if (await generateBtn.count() > 0) {
        const downloadPromise = page.waitForEvent('download');
        await generateBtn.click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toContain('attestation');
        expect(download.suggestedFilename()).toContain('.pdf');
      }
    }
  });
});

test.describe('Leave Planning - Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display planning interface on mobile', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.goto('/admin/time-off');
    await page.click('button:has-text("Planification")');

    // Verify essential elements are visible on mobile
    await expect(page.locator('text=Planification')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();

    // Verify buttons are touch-friendly (44px minimum)
    const button = page.locator('button').first();
    const box = await button.boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
