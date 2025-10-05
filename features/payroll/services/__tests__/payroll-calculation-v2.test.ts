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
});
