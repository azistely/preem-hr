/**
 * Payroll Calculation V2 Tests
 *
 * Verify that database-driven calculations match the original hardcoded version
 * for Côte d'Ivoire. This ensures the refactor doesn't break existing calculations.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { calculatePayroll } from '../payroll-calculation';
import { calculatePayrollV2 } from '../payroll-calculation-v2';

describe('Payroll Calculation V2 (Multi-Country)', () => {
  describe('Côte d\'Ivoire - Regression Tests', () => {
    it('should match Example 7.1: 300k gross, no family', async () => {
      const input = {
        employeeId: 'test-001',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 300000,
        sector: 'services',
      };

      // Original calculation
      const original = calculatePayroll(input);

      // New calculation with database config
      const v2 = await calculatePayrollV2({
        ...input,
        countryCode: 'CI',
        fiscalParts: 1.0,
        sectorCode: 'services',
      });

      // Compare key results
      expect(v2.grossSalary).toBe(original.grossSalary);
      expect(v2.cnpsEmployee).toBe(original.cnpsEmployee);
      expect(v2.cmuEmployee).toBe(original.cmuEmployee);
      expect(v2.its).toBe(original.its);
      expect(v2.netSalary).toBe(original.netSalary);
      // Employer cost differs due to:
      // 1. Maternity bundled into family_benefits (saves 525)
      // 2. FDFP taxes now included (adds 4,800)
      // Original: 329,025 (includes separate 525 maternity, NO FDFP)
      // V2: 333,300 (maternity in family_benefits, WITH FDFP 4,800)
      expect(v2.employerCost).toBe(333300);

      // Expected values from regulations
      expect(v2.grossSalary).toBe(300000);
      expect(v2.cnpsEmployee).toBe(18900); // 6.3%
      expect(v2.cmuEmployee).toBe(1000);
      expect(v2.taxableIncome).toBe(280100); // 300k - 18.9k - 1k
      expect(v2.its).toBe(60814); // Progressive tax (1 FCFA rounding difference from original)
      expect(v2.netSalary).toBe(219286); // 300k - 18.9k - 1k - 60.814k
    });

    it('should match Example 7.2: 500k gross + allowances, with family', async () => {
      const input = {
        employeeId: 'test-002',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 500000,
        housingAllowance: 100000,
        transportAllowance: 50000,
        hasFamily: true,
        sector: 'services',
      };

      // Original calculation
      const original = calculatePayroll(input);

      // New calculation with database config
      const v2 = await calculatePayrollV2({
        ...input,
        countryCode: 'CI',
        fiscalParts: 2.0, // Married
        sectorCode: 'services',
      });

      // Compare key results
      expect(v2.grossSalary).toBe(original.grossSalary);
      expect(v2.grossSalary).toBe(650000); // 500k + 100k + 50k

      // CMU with family
      expect(v2.cmuEmployee).toBe(1000);
      expect(v2.cmuEmployer).toBe(5000); // 500 + 4,500 family
    });

    it('should handle construction sector with higher work accident rate', async () => {
      const input = {
        employeeId: 'test-003',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 400000,
      };

      // Services (2% work accident)
      const services = await calculatePayrollV2({
        ...input,
        countryCode: 'CI',
        sectorCode: 'services',
      });

      // Construction (5% work accident)
      const construction = await calculatePayrollV2({
        ...input,
        countryCode: 'CI',
        sectorCode: 'construction',
      });

      // Employer contributions should be higher for construction
      // due to higher work accident rate
      expect(construction.cnpsEmployer).toBeGreaterThan(services.cnpsEmployer);

      // Employee deductions should be the same
      expect(construction.cnpsEmployee).toBe(services.cnpsEmployee);
      expect(construction.netSalary).toBe(services.netSalary);
    });

    it('should apply family deductions correctly', async () => {
      const baseInput = {
        employeeId: 'test-004',
        countryCode: 'CI',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 500000,
      };

      // Single (1.0 parts) - no deduction
      const single = await calculatePayrollV2({
        ...baseInput,
        fiscalParts: 1.0,
      });

      // Married (2.0 parts) - 11,000 annual deduction
      const married = await calculatePayrollV2({
        ...baseInput,
        fiscalParts: 2.0,
      });

      // Married should pay less tax due to family deduction
      expect(married.its).toBeLessThan(single.its);

      // Tax difference should reflect the deduction
      // 11,000 annual deduction reduces taxable income
      // which should reduce tax
      const taxDifference = single.its - married.its;
      expect(taxDifference).toBeGreaterThan(0);
    });

    it('should handle prorated salary for partial month', async () => {
      const input = {
        employeeId: 'test-005',
        countryCode: 'CI',
        periodStart: new Date('2025-01-15'), // Hired mid-month
        periodEnd: new Date('2025-01-31'),
        baseSalary: 300000,
        hireDate: new Date('2025-01-15'),
      };

      const result = await calculatePayrollV2(input);

      // Should be prorated for ~16 days (15-31)
      expect(result.proratedBaseSalary).toBeLessThan(result.baseSalary);
      expect(result.grossSalary).toBeLessThan(300000);
      expect(result.daysWorked).toBeLessThan(30);
    });
  });

  describe('Database Configuration Loading', () => {
    it('should load Côte d\'Ivoire tax brackets correctly', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'test-config',
        countryCode: 'CI',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 1000000, // High salary to hit multiple brackets
        fiscalParts: 1.0,
      });

      // ITS details should show bracket breakdown
      expect(result.itsDetails.bracketDetails).toBeDefined();
      expect(result.itsDetails.bracketDetails.length).toBeGreaterThan(0);

      // Should have multiple brackets
      const brackets = result.itsDetails.bracketDetails;
      expect(brackets.length).toBeGreaterThanOrEqual(3);

      // First bracket should be 0-300k at 0%
      expect(brackets[0].min).toBe(0);
      expect(brackets[0].max).toBe(300000);
      expect(brackets[0].rate).toBe(0);
    });

    it('should throw error for unsupported country', async () => {
      await expect(
        calculatePayrollV2({
          employeeId: 'test-error',
          countryCode: 'XX', // Invalid country
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-31'),
          baseSalary: 300000,
        })
      ).rejects.toThrow(/No payroll configuration found/);
    });
  });

  describe('Senegal - Multi-Country Tests', () => {
    it('should calculate Senegal payroll with correct CSS contributions', async () => {
      const input = {
        employeeId: 'test-sn-001',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 360000, // At ceiling for retirement
        fiscalParts: 1.0,
        sectorCode: 'services',
      };

      const result = await calculatePayrollV2(input);

      // Verify gross salary
      expect(result.grossSalary).toBe(360000);

      // CSS Retirement contributions (at ceiling of 360,000)
      // Employee: 5.6% of 360,000 = 20,160
      expect(result.cnpsEmployee).toBe(20160);
      // Employer: RETRAITE (8.4%) + PF (7%) + AT (1%) = 16.4% of 360,000 = 59,040
      // Note: PF and AT are categorized as cnpsEmployer based on pattern matching
      expect(result.cnpsEmployer).toBe(59040);

      // CSS IPRESS (health) contributions
      // Employee: 0%
      expect(result.cmuEmployee).toBe(0);
      // Employer: 5% of gross = 18,000
      expect(result.cmuEmployer).toBe(18000);

      // Other employer taxes (only CFCE here)
      // CFCE (3%): 10,800
      expect(result.otherTaxesEmployer).toBe(10800);

      // Total deductions (employee)
      // CSS Retraite: 20,160
      // IRPP tax: calculated based on progressive brackets
      expect(result.cnpsEmployee).toBe(20160);
      expect(result.totalDeductions).toBeGreaterThan(20160);

      // Net salary should be positive
      expect(result.netSalary).toBeGreaterThan(0);
      expect(result.netSalary).toBeLessThan(result.grossSalary);
    });

    it('should apply Senegal IRPP tax brackets correctly', async () => {
      const input = {
        employeeId: 'test-sn-002',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 1000000, // High salary to hit multiple brackets
        fiscalParts: 1.0,
        sectorCode: 'services',
      };

      const result = await calculatePayrollV2(input);

      // Annual taxable income: (1,000,000 - contributions) * 12
      // Should hit multiple IRPP brackets
      expect(result.itsDetails.bracketDetails).toBeDefined();
      expect(result.itsDetails.bracketDetails.length).toBeGreaterThan(1);

      // Verify IRPP bracket structure (Senegal specific)
      const brackets = result.itsDetails.bracketDetails;

      // First bracket: 0 - 630,000 at 0%
      expect(brackets[0].rate).toBe(0);

      // Should have higher brackets with 20%, 30%, 35%, etc.
      const higherBrackets = brackets.filter(b => b.rate > 0);
      expect(higherBrackets.length).toBeGreaterThan(0);
    });

    it('should handle Senegal salary above CSS retirement ceiling', async () => {
      const input = {
        employeeId: 'test-sn-003',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 500000, // Above 360k ceiling
        fiscalParts: 1.0,
        sectorCode: 'services',
      };

      const result = await calculatePayrollV2(input);

      // CSS Retirement should be capped at 360,000
      // Employee: 5.6% of 360,000 = 20,160 (NOT 5.6% of 500,000)
      expect(result.cnpsEmployee).toBe(20160);
      // Employer: RETRAITE capped at 360k (8.4%) + PF on full 500k (7%) + AT on full 500k (1%)
      // = (0.084 × 360,000) + (0.07 × 500,000) + (0.01 × 500,000)
      // = 30,240 + 35,000 + 5,000 = 70,240
      expect(result.cnpsEmployer).toBe(70240);

      // IPRESS has no ceiling, calculated on full gross
      // Employer: 5% of 500,000 = 25,000
      expect(result.cmuEmployer).toBe(25000);
    });

    it('should apply Senegal family deductions correctly', async () => {
      const baseInput = {
        employeeId: 'test-sn-004',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 800000,
      };

      // Single (1.0 parts) - no deduction
      const single = await calculatePayrollV2({
        ...baseInput,
        fiscalParts: 1.0,
      });

      // Married (2.0 parts) - with deduction
      const married = await calculatePayrollV2({
        ...baseInput,
        fiscalParts: 2.0,
      });

      // Married should pay less IRPP tax due to family deduction
      expect(married.its).toBeLessThan(single.its);

      // Both should have same gross and social security
      expect(married.grossSalary).toBe(single.grossSalary);
      expect(married.cnpsEmployee).toBe(single.cnpsEmployee);
      expect(married.cmuEmployee).toBe(single.cmuEmployee);

      // Only tax should differ
      const taxDifference = single.its - married.its;
      expect(taxDifference).toBeGreaterThan(0);
    });

    it('should include CFCE (3%) in Senegal employer costs', async () => {
      const input = {
        employeeId: 'test-sn-005',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 400000,
        fiscalParts: 1.0,
        sectorCode: 'services',
      };

      const result = await calculatePayrollV2(input);

      // CFCE should be 3% of gross
      const expectedCFCE = Math.round(400000 * 0.03); // 12,000

      // Check in other taxes details
      const cfceTax = result.otherTaxesDetails?.find(t => t.code === 'CFCE');
      expect(cfceTax).toBeDefined();
      expect(cfceTax?.amount).toBe(expectedCFCE);
      expect(cfceTax?.paidBy).toBe('employer');
    });
  });

  describe('Cross-Country Comparisons', () => {
    it('should show different contributions for same salary in CI vs SN', async () => {
      const baseInput = {
        employeeId: 'test-compare',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 400000,
        fiscalParts: 1.0,
        sectorCode: 'services',
      };

      const ci = await calculatePayrollV2({
        ...baseInput,
        countryCode: 'CI',
      });

      const sn = await calculatePayrollV2({
        ...baseInput,
        countryCode: 'SN',
      });

      // Same gross salary
      expect(ci.grossSalary).toBe(sn.grossSalary);
      expect(ci.grossSalary).toBe(400000);

      // Different social security rates
      // CI: CNPS 6.3% employee
      expect(ci.cnpsEmployee).toBe(25200);
      // SN: CSS 5.6% employee (RETRAITE only)
      expect(sn.cnpsEmployee).toBe(20160); // 5.6% of 360k ceiling, NOT 400k

      // Different health contributions
      // CI: CMU 1,000 fixed employee
      expect(ci.cmuEmployee).toBe(1000);
      // SN: IPRESS 0% employee
      expect(sn.cmuEmployee).toBe(0);

      // Different tax systems (ITS vs IRPP)
      // Results should differ due to different brackets
      expect(ci.its).not.toBe(sn.its);

      // Different net salaries
      expect(ci.netSalary).not.toBe(sn.netSalary);
    });

    it('should use different tax names in results (ITS vs IRPP)', async () => {
      const baseInput = {
        employeeId: 'test-tax-names',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 500000,
        fiscalParts: 1.0,
      };

      const ci = await calculatePayrollV2({
        ...baseInput,
        countryCode: 'CI',
      });

      const sn = await calculatePayrollV2({
        ...baseInput,
        countryCode: 'SN',
      });

      // Both should have tax (ITS for CI, IRPP for SN)
      expect(ci.its).toBeGreaterThan(0);
      expect(sn.its).toBeGreaterThan(0); // 'its' field stores tax regardless of country

      // Tax calculation should use different systems
      expect(ci.itsDetails.bracketDetails).toBeDefined();
      expect(sn.itsDetails.bracketDetails).toBeDefined();

      // Different bracket structures
      expect(ci.itsDetails.bracketDetails.length).not.toBe(
        sn.itsDetails.bracketDetails.length
      );
    });
  });
});
