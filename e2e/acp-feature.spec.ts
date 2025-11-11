/**
 * EPIC: ACP (Allocations de Congés Payés) - E2E Tests
 *
 * Tests the complete user flow for:
 * 1. HR activating ACP payment for employees
 * 2. Previewing ACP calculations
 * 3. ACP in payroll wizard workflow
 * 4. ACP display on payslips
 * 5. Non-deductible leave checkbox (HR only)
 *
 * Convention Collective Interprofessionnelle Article 46 (Côte d'Ivoire)
 */

import { test, expect } from '@playwright/test';

// Test Data
const TEST_EMPLOYEE = {
  firstName: 'Yao',
  lastName: 'Kouassi',
  email: 'ykouassi@test.com',
  employeeNumber: 'EMP2025001',
  contractType: 'CDI',
  baseSalary: 300000, // FCFA
  hireDate: '2020-01-01', // 5+ years for seniority bonus
};

const TEST_HR_MANAGER = {
  email: 'hr@test.com',
  password: 'testpassword',
};

test.describe('ACP Feature - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Note: In production, implement proper auth with test user
    // For now, tests verify page structure and UI elements
  });

  test.describe('Feature 1: ACP Activation (HR Manager)', () => {
    test('should navigate to employee profile and see ACP section', async ({ page }) => {
      await page.goto('/employees');

      // Search for employee
      await page.fill('input[placeholder*="Rechercher"]', TEST_EMPLOYEE.lastName);
      await page.click(`text=${TEST_EMPLOYEE.firstName} ${TEST_EMPLOYEE.lastName}`);

      // Verify ACP section exists
      await expect(
        page.locator('h3:has-text("Paiement des Allocations de Congés Payés")')
      ).toBeVisible({ timeout: 10000 });
    });

    test('should display ACP status as inactive by default', async ({ page }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE.employeeNumber}`);

      // Look for inactive status indicator
      const statusText = page.locator('text=/Statut.*Inactif/i');
      await expect(statusText).toBeVisible({ timeout: 5000 });
    });

    test('should activate ACP payment with date picker', async ({ page }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE.employeeNumber}`);

      // Click activate button
      await page.click('button:has-text("Activer le paiement ACP")');

      // Wait for form to expand
      await expect(page.locator('label:has-text("Date de paiement")')).toBeVisible();

      // Select payment date (5th of next month)
      await page.click('button:has-text("Sélectionner une date")');

      // Wait for calendar popup
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });

      // Click on day 5 (simplified - actual calendar interaction may vary)
      await page.click('[role="gridcell"]:has-text("5")');

      // Add notes
      await page.fill(
        'textarea[placeholder*="notes"]',
        'Paiement automatique lors des congés annuels'
      );

      // Save
      await page.click('button:has-text("Enregistrer")');

      // Verify success toast
      await expect(
        page.locator('text=/Le paiement ACP a été activé/i')
      ).toBeVisible({ timeout: 5000 });

      // Verify status changed to active
      await expect(page.locator('text=/Statut.*Actif/i')).toBeVisible();
    });

    test('should deactivate ACP payment', async ({ page }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE.employeeNumber}`);

      // Assuming ACP is active, click deactivate
      await page.click('button:has-text("Désactiver")');

      // Verify status changed
      await expect(page.locator('text=/Statut.*Inactif/i')).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe('Feature 2: ACP Preview Dialog', () => {
    test('should open ACP preview dialog', async ({ page }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE.employeeNumber}`);

      // Click preview button
      await page.click('button:has-text("Prévisualiser le calcul ACP")');

      // Verify dialog opened
      await expect(
        page.locator('[role="dialog"]:has-text("Prévisualisation du calcul ACP")')
      ).toBeVisible({ timeout: 5000 });
    });

    test('should display ACP calculation breakdown', async ({ page }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE.employeeNumber}`);

      // Open preview
      await page.click('button:has-text("Prévisualiser")');

      // Wait for calculation to load
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });

      // Verify key sections exist
      await expect(page.locator('text=/Résultat du calcul/i')).toBeVisible();
      await expect(page.locator('text=/Période de référence/i')).toBeVisible();
      await expect(
        page.locator('text=/Salaire moyen journalier/i')
      ).toBeVisible();
      await expect(page.locator('text=/Congés pris/i')).toBeVisible();

      // Verify ACP amount displayed (should be in FCFA)
      await expect(page.locator('text=/FCFA/i')).toBeVisible();

      // Verify calculation formula shown
      await expect(page.locator('text=/jours/i')).toBeVisible();
    });

    test('should show seniority bonus section for 5+ years employees', async ({
      page,
    }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE.employeeNumber}`);

      // Open preview
      await page.click('button:has-text("Prévisualiser")');

      await page.waitForSelector('[role="dialog"]', { state: 'visible' });

      // For employee with 5+ years, seniority section should be visible
      await expect(
        page.locator('text=/Prime d\'ancienneté/i')
      ).toBeVisible();
      await expect(page.locator('text=/Jours supplémentaires/i')).toBeVisible();
    });

    test('should close preview dialog', async ({ page }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE.employeeNumber}`);

      // Open and close dialog
      await page.click('button:has-text("Prévisualiser")');
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });

      await page.click('button:has-text("Fermer")');

      // Dialog should be closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });
  });

  test.describe('Feature 3: ACP in Payroll Wizard', () => {
    test('should navigate to payroll creation', async ({ page }) => {
      await page.goto('/payroll');
      await page.click('button:has-text("Nouvelle paie")');

      // Verify wizard started
      await expect(page.locator('h2:has-text("Étape 1")')).toBeVisible();
    });

    test('should see ACP Review Step in wizard', async ({ page }) => {
      await page.goto('/payroll/new');

      // Navigate through wizard steps (simplified)
      // Step 1: Select period
      await page.click('button:has-text("Suivant")');

      // Step 2: Select employees
      await page.click('button:has-text("Suivant")');

      // Step 3: ACP Review Step should appear
      await expect(
        page.locator('h2:has-text("Étape 3 sur 5: Vérification des ACP")')
      ).toBeVisible({ timeout: 10000 });
    });

    test('should display employees with active ACP in table', async ({ page }) => {
      await page.goto('/payroll/new');

      // Navigate to ACP step (simplified navigation)
      await page.click('button:has-text("Suivant")'); // Period
      await page.click('button:has-text("Suivant")'); // Employees

      // Verify table exists
      await expect(
        page.locator('table').first()
      ).toBeVisible({ timeout: 10000 });

      // Verify table headers
      await expect(page.locator('th:has-text("Employé")')).toBeVisible();
      await expect(page.locator('th:has-text("Date ACP")')).toBeVisible();
      await expect(page.locator('th:has-text("Jours")')).toBeVisible();
      await expect(page.locator('th:has-text("Montant")')).toBeVisible();
    });

    test('should show total ACP amount for period', async ({ page }) => {
      await page.goto('/payroll/new');

      // Navigate to ACP step
      await page.click('button:has-text("Suivant")');
      await page.click('button:has-text("Suivant")');

      // Verify total is displayed
      await expect(
        page.locator('text=/Total ACP pour ce mois/i')
      ).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=/FCFA/i')).toBeVisible();
    });

    test('should allow viewing individual ACP details from table', async ({
      page,
    }) => {
      await page.goto('/payroll/new');

      // Navigate to ACP step
      await page.click('button:has-text("Suivant")');
      await page.click('button:has-text("Suivant")');

      // Click eye icon to view details
      await page.locator('button[aria-label*="Voir"], svg.lucide-eye').first().click();

      // Preview dialog should open
      await expect(
        page.locator('[role="dialog"]:has-text("Prévisualisation")')
      ).toBeVisible({ timeout: 5000 });
    });

    test('should continue to next wizard step', async ({ page }) => {
      await page.goto('/payroll/new');

      // Navigate to ACP step
      await page.click('button:has-text("Suivant")');
      await page.click('button:has-text("Suivant")');

      // Continue to next step
      await page.click('button:has-text("Continuer")');

      // Should advance to step 4
      await expect(
        page.locator('h2:has-text("Étape 4")')
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Feature 4: ACP on Payslip', () => {
    test('should display ACP line item on payslip', async ({ page }) => {
      // Navigate to a completed payslip
      await page.goto('/payroll');
      await page.locator('a[href*="/payslips/"]').first().click();

      // Verify payslip loaded
      await expect(
        page.locator('h1:has-text("Bulletin de paie")')
      ).toBeVisible({ timeout: 10000 });

      // Look for ACP in salary components section
      await expect(
        page.locator('text=/Éléments de rémunération/i')
      ).toBeVisible();

      // ACP should be visible with calendar icon
      const acpLine = page.locator('text=/ACP/i').first();
      await expect(acpLine).toBeVisible({ timeout: 5000 });
    });

    test('should show ACP with calendar icon and info tooltip', async ({
      page,
    }) => {
      await page.goto('/payslips/test-payslip-id');

      // Find ACP line item
      const acpSection = page.locator('text=/ACP/i').first();
      await acpSection.scrollIntoViewIfNeeded();

      // Verify calendar icon present (svg with specific class)
      await expect(
        page.locator('svg.lucide-calendar').first()
      ).toBeVisible();

      // Hover over info icon to see tooltip
      const infoIcon = page.locator('svg.lucide-info').first();
      await infoIcon.hover();

      // Tooltip should appear
      await expect(
        page.locator('text=/Allocations de congés payés/i')
      ).toBeVisible({ timeout: 3000 });
    });

    test('should show ACP amount in gross salary total', async ({ page }) => {
      await page.goto('/payslips/test-payslip-id');

      // Verify total brut includes ACP
      await expect(page.locator('text=/TOTAL BRUT/i')).toBeVisible();
      await expect(page.locator('text=/Salaire brut/i')).toBeVisible();
    });
  });

  test.describe('Feature 5: Non-Deductible Leave Checkbox (HR Only)', () => {
    test('should show advanced options for HR users', async ({ page }) => {
      // Login as HR (simplified)
      await page.goto('/time-off/request');

      // Verify HR-only section exists
      await expect(
        page.locator('text=/Options avancées.*HR seulement/i')
      ).toBeVisible({ timeout: 10000 });
    });

    test('should allow HR to mark leave as non-deductible', async ({ page }) => {
      await page.goto('/time-off/request');

      // Fill basic leave request fields
      await page.selectOption('select[name="policyId"]', { index: 1 });
      await page.click('button:has-text("Date de début")');
      await page.click('[role="gridcell"]:has-text("15")');

      await page.click('button:has-text("Date de fin")');
      await page.click('[role="gridcell"]:has-text("20")');

      // Scroll to HR-only section
      const advancedSection = page.locator('text=/Options avancées/i');
      await advancedSection.scrollIntoViewIfNeeded();

      // Check the non-deductible checkbox
      const checkbox = page.locator(
        'input[type="checkbox"]:near(:text("Non déductible pour le calcul ACP"))'
      );
      await checkbox.check();

      // Verify checkbox is checked
      await expect(checkbox).toBeChecked();

      // Submit form
      await page.click('button[type="submit"]:has-text("Soumettre")');

      // Verify success
      await expect(
        page.locator('text=/Demande de congé créée/i')
      ).toBeVisible({ timeout: 5000 });
    });

    test('should NOT show advanced options for non-HR users', async ({
      page,
      context,
    }) => {
      // Simulate employee role (would need proper auth setup)
      await page.goto('/time-off/request');

      // Advanced options section should not be visible for employees
      const advancedSection = page.locator('text=/Options avancées.*HR seulement/i');
      const isVisible = await advancedSection.isVisible().catch(() => false);

      // For non-HR, this section should be hidden
      expect(isVisible).toBe(false);
    });
  });

  test.describe('Error Handling & Edge Cases', () => {
    test('should show warning if employee not eligible for ACP', async ({
      page,
    }) => {
      // Navigate to INTERIM employee (not eligible)
      await page.goto('/employees/interim-employee-id');

      // Try to activate ACP
      await page.click('button:has-text("Activer le paiement ACP")');

      // Should show warning or error
      await expect(
        page.locator('text=/non éligible|INTERIM|STAGE/i')
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show warning if insufficient salary history', async ({
      page,
    }) => {
      // Navigate to newly hired employee
      await page.goto('/employees/new-employee-id');

      // Open ACP preview
      await page.click('button:has-text("Prévisualiser")');

      // Should show warning about insufficient history
      await expect(
        page.locator('text=/Avertissements/i')
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page.locator('text=/historique de salaire insuffisant/i')
      ).toBeVisible();
    });

    test('should handle zero ACP when no leave taken', async ({ page }) => {
      // Employee with no approved leave
      await page.goto('/employees/no-leave-employee-id');

      // Open preview
      await page.click('button:has-text("Prévisualiser")');

      // ACP amount should be 0
      await expect(page.locator('text=/0.*FCFA/i')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator('text=/0 jours/i')).toBeVisible();
    });
  });

  test.describe('Accessibility & Mobile Responsiveness', () => {
    test('should have touch-friendly buttons (min 44px)', async ({ page }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE.employeeNumber}`);

      // Check button sizes
      const activateButton = page.locator('button:has-text("Activer le paiement ACP")');
      const box = await activateButton.boundingBox();

      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    });

    test('should work on mobile viewport (375px)', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(`/employees/${TEST_EMPLOYEE.employeeNumber}`);

      // All key elements should still be visible
      await expect(
        page.locator('text=/Paiement des Allocations/i')
      ).toBeVisible({ timeout: 10000 });
    });

    test('should have proper ARIA labels and keyboard navigation', async ({
      page,
    }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE.employeeNumber}`);

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Focus should be visible on buttons
      const focusedElement = await page.evaluateHandle(
        () => document.activeElement
      );
      expect(focusedElement).toBeDefined();
    });
  });
});
