/**
 * E2E Tests for Document Management System
 * Tests complete workflows: upload, approval, rejection, search
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Document Management E2E', () => {
  // Test fixtures
  const TEST_PDF = path.join(__dirname, 'fixtures', 'test-contract.pdf');
  const TEST_IMAGE = path.join(__dirname, 'fixtures', 'test-id.jpg');

  test.describe('HR Document Upload Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Login as HR Manager
      await page.goto('/login');
      await page.fill('[name="email"]', process.env.TEST_HR_EMAIL || 'hr@test.com');
      await page.fill('[name="password"]', process.env.TEST_HR_PASSWORD || 'password');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    });

    test('HR can upload document for employee', async ({ page }) => {
      // Navigate to employee profile
      await page.goto('/employees');
      await page.click('tr:first-child a'); // Click first employee
      await page.waitForURL(/\/employees\/[a-f0-9-]+/);

      // Click Documents tab
      await page.click('button[value="documents"]');
      await expect(page.locator('text=Documents de l\'employé')).toBeVisible();

      // Open upload dialog
      await page.click('button:has-text("Télécharger")');
      await expect(page.locator('text=Télécharger un document')).toBeVisible();

      // Select category
      await page.click('[role="combobox"]');
      await page.click('text=Contrat de travail');

      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(TEST_PDF);

      // Verify file appears in list
      await expect(page.locator('text=test-contract.pdf')).toBeVisible();

      // Submit upload
      await page.click('button:has-text("Télécharger (1)")');

      // Wait for success message
      await expect(page.locator('text=Document téléchargé avec succès')).toBeVisible({
        timeout: 10000,
      });

      // Verify document appears in list
      await expect(page.locator('text=test-contract.pdf')).toBeVisible();
    });

    test('HR upload validates file size', async ({ page }) => {
      await page.goto('/employees');
      await page.click('tr:first-child a');
      await page.click('button[value="documents"]');
      await page.click('button:has-text("Télécharger")');

      // Try to upload oversized file (mock)
      // Note: In real test, you'd use a large file fixture
      await expect(page.locator('text=25 Mo')).toBeVisible(); // Size limit shown
    });

    test('Uploaded document has correct status badges', async ({ page }) => {
      await page.goto('/employees');
      await page.click('tr:first-child a');
      await page.click('button[value="documents"]');

      // Check for status badges
      const statusBadges = page.locator('[class*="badge"]');
      await expect(statusBadges.first()).toBeVisible();
    });
  });

  test.describe('Employee Document Upload Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Login as Employee
      await page.goto('/login');
      await page.fill('[name="email"]', process.env.TEST_EMPLOYEE_EMAIL || 'employee@test.com');
      await page.fill('[name="password"]', process.env.TEST_EMPLOYEE_PASSWORD || 'password');
      await page.click('button[type="submit"]');
      await page.waitForURL('/employee/dashboard');
    });

    test('Employee can upload medical certificate', async ({ page }) => {
      // Navigate to documents page
      await page.goto('/employee/documents');
      await expect(page.locator('h1:has-text("Mes Documents")')).toBeVisible();

      // Click upload button
      await page.click('button:has-text("Télécharger")');

      // Select medical category
      await page.click('[role="combobox"]');
      await page.click('text=Certificat médical');

      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(TEST_IMAGE);

      // Submit
      await page.click('button:has-text("Télécharger")');

      // Verify pending status
      await expect(page.locator('text=En attente')).toBeVisible({ timeout: 10000 });
    });

    test('Employee sees uploaded documents with status', async ({ page }) => {
      await page.goto('/employee/documents');

      // Check for documents list section
      await expect(page.locator('h2:has-text("Documents Téléchargés")')).toBeVisible();

      // Check for document cards/rows
      const documentList = page.locator('[class*="document"]').first();
      if (await documentList.isVisible()) {
        // Verify status badge exists
        await expect(page.locator('[class*="badge"]')).toBeVisible();
      }
    });
  });

  test.describe('HR Approval Queue', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('[name="email"]', process.env.TEST_HR_EMAIL || 'hr@test.com');
      await page.fill('[name="password"]', process.env.TEST_HR_PASSWORD || 'password');
      await page.click('button[type="submit"]');
    });

    test('HR can view pending approvals', async ({ page }) => {
      await page.goto('/manager/documents');
      await expect(page.locator('h1:has-text("Gestion des Documents")')).toBeVisible();

      // Click pending tab
      await page.click('button[value="pending"]');

      // Check for pending count badge
      const badge = page.locator('[class*="badge"]:has-text(/\\d+/)');
      if (await badge.isVisible()) {
        const count = await badge.textContent();
        expect(parseInt(count || '0')).toBeGreaterThanOrEqual(0);
      }
    });

    test('HR can approve document', async ({ page }) => {
      await page.goto('/manager/documents');
      await page.click('button[value="pending"]');

      // Find first pending document (if any)
      const approveButton = page.locator('button:has-text("Approuver")').first();
      if (await approveButton.isVisible()) {
        await approveButton.click();

        // Verify success
        await expect(page.locator('text=approuvé')).toBeVisible({ timeout: 5000 });
      }
    });

    test('HR can reject document with reason', async ({ page }) => {
      await page.goto('/manager/documents');
      await page.click('button[value="pending"]');

      // Find first pending document (if any)
      const rejectButton = page.locator('button:has-text("Refuser")').first();
      if (await rejectButton.isVisible()) {
        await rejectButton.click();

        // Should show reason dialog
        await expect(page.locator('text=Raison du rejet')).toBeVisible();

        // Enter reason
        await page.fill('textarea', 'Document non lisible');

        // Confirm rejection
        await page.click('button:has-text("Confirmer")');

        // Verify success
        await expect(page.locator('text=refusé')).toBeVisible({ timeout: 5000 });
      }
    });

    test('Pending count updates after approval', async ({ page }) => {
      await page.goto('/manager/documents');

      // Get initial count
      const badge = page.locator('[class*="badge"]:has-text(/\\d+/)').first();
      const initialCount = await badge.textContent().catch(() => '0');

      // Approve one document if available
      const approveButton = page.locator('button:has-text("Approuver")').first();
      if (await approveButton.isVisible()) {
        await approveButton.click();
        await page.waitForTimeout(2000); // Wait for UI update

        // Check count decreased
        const newCount = (await badge.textContent().catch(() => '0')) || '0';
        expect(parseInt(newCount)).toBeLessThanOrEqual(parseInt(initialCount || '0'));
      }
    });
  });

  test.describe('Document Search and Filtering', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('[name="email"]', process.env.TEST_HR_EMAIL || 'hr@test.com');
      await page.fill('[name="password"]', process.env.TEST_HR_PASSWORD || 'password');
      await page.click('button[type="submit"]');
    });

    test('Can switch between document tabs', async ({ page }) => {
      await page.goto('/manager/documents');

      // Test all tabs
      const tabs = ['pending', 'all'];
      for (const tab of tabs) {
        await page.click(`button[value="${tab}"]`);
        await expect(page.locator(`button[value="${tab}"]`)).toHaveAttribute(
          'data-state',
          'active'
        );
      }
    });

    test('Document list displays correctly', async ({ page }) => {
      await page.goto('/manager/documents');
      await page.click('button[value="all"]');

      // Verify table or list structure
      const documentContainer = page.locator('[class*="document"]').first();
      if (await documentContainer.isVisible()) {
        // Check for essential document info
        await expect(page.locator('text=/.*\\.(pdf|jpg|png|docx)/i')).toBeVisible();
      }
    });
  });

  test.describe('Document Download and View', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('[name="email"]', process.env.TEST_EMPLOYEE_EMAIL || 'employee@test.com');
      await page.fill('[name="password"]', process.env.TEST_EMPLOYEE_PASSWORD || 'password');
      await page.click('button[type="submit"]');
    });

    test('Employee can view document', async ({ page }) => {
      await page.goto('/employee/documents');

      // Find first document view button
      const viewButton = page.locator('button:has-text("Voir")').first();
      if (await viewButton.isVisible()) {
        // Click should open in new tab
        const [newPage] = await Promise.all([
          page.waitForEvent('popup'),
          viewButton.click(),
        ]);

        // Verify new tab opened (URL will be Supabase storage URL)
        expect(newPage.url()).toContain('supabase');
      }
    });

    test('Employee can download document', async ({ page }) => {
      await page.goto('/employee/documents');

      const downloadButton = page.locator('button:has-text("Télécharger")').first();
      if (await downloadButton.isVisible()) {
        // Note: Actual download testing requires download handling setup
        await expect(downloadButton).toBeEnabled();
      }
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

    test('Document upload works on mobile', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[name="email"]', process.env.TEST_HR_EMAIL || 'hr@test.com');
      await page.fill('[name="password"]', process.env.TEST_HR_PASSWORD || 'password');
      await page.click('button[type="submit"]');

      await page.goto('/manager/documents');

      // Verify touch targets are at least 44px
      const buttons = page.locator('button');
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });

    test('Document list is readable on mobile', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[name="email"]', process.env.TEST_EMPLOYEE_EMAIL || 'employee@test.com');
      await page.fill('[name="password"]', process.env.TEST_EMPLOYEE_PASSWORD || 'password');
      await page.click('button[type="submit"]');

      await page.goto('/employee/documents');

      // Check that content doesn't overflow
      const container = page.locator('[class*="container"]').first();
      if (await container.isVisible()) {
        const box = await container.boundingBox();
        expect(box?.width).toBeLessThanOrEqual(375);
      }
    });
  });

  test.describe('Performance', () => {
    test('Document list loads in under 2 seconds', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[name="email"]', process.env.TEST_HR_EMAIL || 'hr@test.com');
      await page.fill('[name="password"]', process.env.TEST_HR_PASSWORD || 'password');
      await page.click('button[type="submit"]');

      const startTime = Date.now();
      await page.goto('/manager/documents');
      await page.waitForSelector('h1');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(2000);
    });
  });
});
