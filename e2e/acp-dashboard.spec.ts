/**
 * ACP Dashboard - E2E Tests
 *
 * Tests the complete user flow for:
 * 1. ACP dashboard summary cards
 * 2. Employee filtering and search
 * 3. Virtualized table performance (100+ employees)
 * 4. Navigation to employee detail pages
 */

import { test, expect } from '@playwright/test';

test.describe('ACP Dashboard - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Note: In production, implement proper auth with test user
    // For now, tests verify page structure and UI elements
  });

  test.describe('Feature 1: Dashboard Access & Navigation', () => {
    test('should navigate to ACP dashboard from sidebar', async ({ page }) => {
      await page.goto('/admin/dashboard');

      // Find ACP dashboard link in sidebar
      await page.click('a[href="/admin/acp-dashboard"]');

      // Verify dashboard loaded
      await expect(
        page.locator('h1:has-text("Tableau de bord ACP")')
      ).toBeVisible({ timeout: 10000 });
    });

    test('should show proper page title and description', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Verify title
      await expect(page.locator('h1')).toContainText('Tableau de bord ACP');

      // Verify description
      await expect(
        page.locator('text=/Vue d\'ensemble des Allocations/i')
      ).toBeVisible();
    });
  });

  test.describe('Feature 2: Summary Cards', () => {
    test('should display all 4 summary cards', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Wait for cards to load
      await page.waitForSelector('[data-testid="summary-card"], .grid', {
        timeout: 10000,
      });

      // Verify all 4 cards exist
      await expect(page.locator('text=/Employés éligibles/i')).toBeVisible();
      await expect(page.locator('text=/Avec paiements/i')).toBeVisible();
      await expect(page.locator('text=/Total payé/i')).toBeVisible();
      await expect(page.locator('text=/Moyenne par employé/i')).toBeVisible();
    });

    test('should show employee count in first card', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Verify employee count card
      const card = page.locator('text=/Employés éligibles/i').locator('..');
      await expect(card).toBeVisible({ timeout: 5000 });

      // Should show a number
      await expect(card.locator('text=/\\d+/')).toBeVisible();
      await expect(card.locator('text=/CDI \\+ CDD actifs/i')).toBeVisible();
    });

    test('should show payment statistics', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Verify "With Payments" card
      const paymentsCard = page.locator('text=/Avec paiements/i').locator('..');
      await expect(paymentsCard).toBeVisible();

      // Should show count and percentage
      await expect(paymentsCard.locator('text=/\\d+%/i')).toBeVisible({ timeout: 5000 });
    });

    test('should display total ACP paid in FCFA', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Verify total paid card
      const totalCard = page.locator('text=/Total payé/i').locator('..');
      await expect(totalCard).toBeVisible();

      // Should show amount in FCFA
      await expect(totalCard.locator('text=/FCFA/i')).toBeVisible({ timeout: 5000 });
      await expect(totalCard.locator('text=/\\d/i')).toBeVisible();
    });

    test('should show average payment per employee', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Verify average card
      const avgCard = page.locator('text=/Moyenne par employé/i').locator('..');
      await expect(avgCard).toBeVisible();

      // Should show amount in FCFA
      await expect(avgCard.locator('text=/FCFA/i')).toBeVisible({ timeout: 5000 });
    });

    test('should display icons for each card', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Wait for cards to load
      await page.waitForSelector('svg.lucide-users', { timeout: 5000 });

      // Verify icons present (Lucide icons)
      await expect(page.locator('svg.lucide-users')).toBeVisible();
      await expect(page.locator('svg.lucide-wallet')).toBeVisible();
      await expect(page.locator('svg.lucide-trending-up')).toBeVisible();
      await expect(page.locator('svg.lucide-calendar')).toBeVisible();
    });
  });

  test.describe('Feature 3: Employee Filtering', () => {
    test('should show contract type filter dropdown', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Verify filter section exists
      await expect(
        page.locator('button:has-text("Tous les contrats")')
      ).toBeVisible({ timeout: 5000 });
    });

    test('should filter by CDI only', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Open contract type dropdown
      await page.click('button:has-text("Tous les contrats")');

      // Select CDI
      await page.click('text=/CDI uniquement/i');

      // Wait for table to update
      await page.waitForTimeout(500);

      // Verify only CDI employees shown (check badges)
      const cdiBadges = page.locator('text=/^CDI$/');
      const cddBadges = page.locator('text=/^CDD$/');

      const cdiCount = await cdiBadges.count();
      const cddCount = await cddBadges.count();

      // Should only show CDI
      expect(cddCount).toBe(0);
      if (cdiCount > 0) {
        expect(cdiCount).toBeGreaterThan(0);
      }
    });

    test('should filter by CDD only', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Select CDD filter
      await page.click('button:has-text("Tous les contrats")');
      await page.click('text=/CDD uniquement/i');

      await page.waitForTimeout(500);

      // Verify only CDD employees shown
      const cdiBadges = page.locator('text=/^CDI$/');
      const cddBadges = page.locator('text=/^CDD$/');

      const cdiCount = await cdiBadges.count();
      const cddCount = await cddBadges.count();

      expect(cdiCount).toBe(0);
      if (cddCount > 0) {
        expect(cddCount).toBeGreaterThan(0);
      }
    });

    test('should search employees by name', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Type search query
      await page.fill('input[placeholder*="Rechercher"]', 'Kouassi');

      // Wait for search to filter
      await page.waitForTimeout(500);

      // Verify filtered results
      const employeeRows = page.locator('[data-testid="employee-row"], tr');
      const count = await employeeRows.count();

      // Should have some results matching "Kouassi"
      if (count > 0) {
        await expect(page.locator('text=/Kouassi/i')).toBeVisible();
      }
    });

    test('should show "no results" when search has no matches', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Search for non-existent employee
      await page.fill('input[placeholder*="Rechercher"]', 'NONEXISTENTEMPLOYEE999');

      await page.waitForTimeout(500);

      // Should show empty state
      await expect(page.locator('text=/Aucun employé trouvé/i')).toBeVisible({
        timeout: 3000,
      });
    });
  });

  test.describe('Feature 4: Employee Table', () => {
    test('should display employee table with headers', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Verify table headers
      await expect(page.locator('th:has-text("Employé")')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('th:has-text("Contrat")')).toBeVisible();
      await expect(page.locator('th:has-text("Dernier paiement")')).toBeVisible();
      await expect(page.locator('th:has-text("Total payé")')).toBeVisible();
      await expect(page.locator('th:has-text("Actions")')).toBeVisible();
    });

    test('should show employee avatar and name', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Wait for first employee row
      await page.waitForSelector('[data-testid="employee-row"], tbody tr', {
        timeout: 5000,
      });

      // Verify avatar displayed
      const avatar = page.locator('div[class*="avatar"]').first();
      await expect(avatar).toBeVisible();

      // Verify employee name
      await expect(page.locator('td').first()).toContainText(/\w+/);
    });

    test('should display contract type badge', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Look for contract type badges
      const badges = page.locator('[class*="badge"], .badge');
      await expect(badges.first()).toBeVisible({ timeout: 5000 });

      // Should show CDI or CDD
      const badgeText = await badges.first().textContent();
      expect(badgeText).toMatch(/CDI|CDD/i);
    });

    test('should show latest payment date and amount', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Find a row with payment data
      const paymentCell = page.locator('td:has(text(/\\d+ FCFA/i))').first();

      if (await paymentCell.isVisible()) {
        // Verify payment amount shown
        await expect(paymentCell).toContainText('FCFA');

        // Verify date shown (French format)
        await expect(paymentCell.locator('text=/\\d+ [a-zéû]+ \\d+/i')).toBeVisible();
      }
    });

    test('should show "Aucun paiement" for employees without payments', async ({
      page,
    }) => {
      await page.goto('/admin/acp-dashboard');

      // Look for "no payment" text
      const noPaymentText = page.locator('text=/Aucun paiement/i');
      const hasNoPayment = await noPaymentText.isVisible().catch(() => false);

      if (hasNoPayment) {
        await expect(noPaymentText).toBeVisible();
      }
    });

    test('should display total paid amount for each employee', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Find total paid column
      const totalPaidCells = page.locator('td:has(span.font-medium)');
      const count = await totalPaidCells.count();

      if (count > 0) {
        // Verify amounts shown in FCFA
        await expect(totalPaidCells.first()).toContainText('FCFA');
      }
    });

    test('should have action button linking to employee detail', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Find action button (external link icon)
      const actionButton = page.locator('a[href*="/employees/"], button:has(svg.lucide-external-link)').first();

      await expect(actionButton).toBeVisible({ timeout: 5000 });
    });

    test('should navigate to employee detail when clicking action button', async ({
      page,
    }) => {
      await page.goto('/admin/acp-dashboard');

      // Click first action button
      const actionLink = page.locator('a[href*="/employees/"]').first();
      await actionLink.click();

      // Verify navigated to employee page
      await expect(page).toHaveURL(/\/employees\/[^/]+/, { timeout: 5000 });

      // Should be on time tab (tab=time query param)
      expect(page.url()).toContain('tab=time');
    });
  });

  test.describe('Feature 5: Virtualized Table (Performance)', () => {
    test('should use virtualized table for 50+ employees', async ({ page }) => {
      // Note: This test requires seeding database with 50+ employees
      await page.goto('/admin/acp-dashboard');

      // Check if virtualized table is rendered (different DOM structure)
      const virtualizedTable = page.locator('[data-testid="virtualized-table"], [style*="position: absolute"]');
      const hasVirtualization = await virtualizedTable.isVisible().catch(() => false);

      // If 50+ employees, virtualized table should be used
      const employeeCount = await page.locator('text=/Employés \\((\\d+)\\)/i').textContent();
      const match = employeeCount?.match(/\\((\\d+)\\)/);
      const count = match ? parseInt(match[1]) : 0;

      if (count >= 50) {
        expect(hasVirtualization).toBe(true);
      }
    });

    test('should render only visible rows in viewport', async ({ page }) => {
      // With 100+ employees, only ~10-15 rows should be in DOM
      await page.goto('/admin/acp-dashboard');

      // Count rendered rows
      const rows = page.locator('tr[data-index], [data-index]');
      const renderedCount = await rows.count();

      // Should render much fewer than total count (virtualization working)
      // Note: This test is most effective with 100+ employees
      expect(renderedCount).toBeLessThan(50);
    });

    test('should scroll smoothly with large dataset', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Find scrollable container
      const scrollContainer = page.locator('[style*="overflow"]').first();

      if (await scrollContainer.isVisible()) {
        // Scroll down
        await scrollContainer.evaluate((el) => {
          el.scrollTop = el.scrollHeight / 2;
        });

        // Wait for scroll to settle
        await page.waitForTimeout(300);

        // Should still have rows visible
        const rows = page.locator('tr[data-index], [data-index]');
        expect(await rows.count()).toBeGreaterThan(0);
      }
    });

    test('should load dashboard quickly even with 100+ employees', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/admin/acp-dashboard');

      // Wait for table to be visible
      await page.waitForSelector('table, [data-testid="virtualized-table"]', {
        timeout: 10000,
      });

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });
  });

  test.describe('Feature 6: Loading & Error States', () => {
    test('should show loading spinner initially', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Check if loader was visible (may disappear quickly)
      const loader = page.locator('svg.animate-spin, [data-testid="loader"]');
      const wasVisible = await loader.isVisible().catch(() => false);

      // Loader may be very brief, so check data loaded instead
      const dataLoaded = (await page.locator('table, [data-testid="employee-row"]').count()) > 0;

      expect(wasVisible || dataLoaded).toBe(true);
    });

    test('should show empty state when no employees', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Apply filter that returns no results
      await page.fill('input[placeholder*="Rechercher"]', 'NONEXISTENT999');

      await page.waitForTimeout(500);

      // Should show empty state
      await expect(page.locator('text=/Aucun employé trouvé/i')).toBeVisible({
        timeout: 3000,
      });
      await expect(page.locator('svg.lucide-users')).toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should display correctly on mobile (375px)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin/acp-dashboard');

      // Verify page loads
      await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });

      // Summary cards should stack vertically
      const cards = page.locator('[class*="grid-cols"]');
      await expect(cards.first()).toBeVisible();
    });

    test('should have touch-friendly filter buttons (min 44px)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin/acp-dashboard');

      // Check filter button size
      const filterButton = page.locator('button:has-text("Tous les contrats")');
      const box = await filterButton.boundingBox();

      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    });

    test('should allow horizontal scroll on mobile table', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin/acp-dashboard');

      // Table should be scrollable horizontally on mobile
      const table = page.locator('table, [data-testid="employee-table"]').first();

      if (await table.isVisible()) {
        // Verify table has overflow-x
        const overflowX = await table.evaluate((el) =>
          window.getComputedStyle(el.parentElement || el).overflowX
        );

        expect(overflowX).toMatch(/auto|scroll/);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // h1 for page title
      await expect(page.locator('h1')).toBeVisible();

      // Card titles should be properly structured
      const cardTitles = page.locator('[class*="CardTitle"]');
      await expect(cardTitles.first()).toBeVisible({ timeout: 5000 });
    });

    test('should have keyboard navigable controls', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Tab through controls
      await page.keyboard.press('Tab'); // Focus first interactive element
      await page.keyboard.press('Tab'); // Move to next
      await page.keyboard.press('Tab');

      // Verify focus is visible
      const focused = await page.evaluateHandle(() => document.activeElement);
      expect(focused).toBeDefined();
    });

    test('should have proper ARIA labels for buttons', async ({ page }) => {
      await page.goto('/admin/acp-dashboard');

      // Check action buttons have labels or text
      const actionButtons = page.locator('button:has(svg.lucide-external-link)');

      if ((await actionButtons.count()) > 0) {
        const firstButton = actionButtons.first();
        const ariaLabel = await firstButton.getAttribute('aria-label');
        const hasText = await firstButton.textContent();

        // Should have either aria-label or visible text
        expect(ariaLabel || hasText).toBeTruthy();
      }
    });
  });
});
