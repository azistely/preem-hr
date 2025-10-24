/**
 * Test Suite: Rate Type Payroll Calculation
 *
 * Tests for GAP-JOUR-003: Daily/Hourly Rate Configuration
 *
 * Validates that payroll calculations correctly handle:
 * - MONTHLY workers (existing behavior)
 * - DAILY workers (new)
 * - HOURLY workers (new)
 */

import { describe, it, expect, vi } from 'vitest';
import { calculatePayrollV2, type PayrollCalculationInputV2 } from '../payroll-calculation-v2';

// Mock loadPayrollConfig (in real tests, use actual database data)
vi.mock('@/features/payroll-config', () => ({
  loadPayrollConfig: vi.fn().mockResolvedValue({
    taxBrackets: [],
    familyDeductions: [],
    contributions: [],
    sectorOverrides: [],
    otherTaxes: [],
    taxSystem: {
      taxCalculationBase: 'gross_before_ss',
      retirementContributionLabel: { fr: 'CNPS' },
      healthContributionLabel: { fr: 'CMU' },
      incomeTaxLabel: { fr: 'ITS' },
    },
    socialSecurityScheme: {
      defaultSectorCode: 'services',
    },
  }),
  ProgressiveMonthlyTaxStrategy: class {
    constructor() {}
    calculate() {
      return {
        grossSalary: 0,
        taxableIncome: 0,
        annualTaxableIncome: 0,
        annualTax: 0,
        monthlyTax: 0,
        effectiveRate: 0,
        bracketDetails: [],
      };
    }
  },
}));

describe('Rate Type Payroll Calculation', () => {
  const baseInput: Partial<PayrollCalculationInputV2> = {
    employeeId: 'test-employee-id',
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-01-31'),
    countryCode: 'CI',
  };

  describe('MONTHLY workers (existing behavior)', () => {
    it('should use base salary as-is for monthly workers', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 300000,
        rateType: 'MONTHLY',
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // For monthly workers, gross salary = base salary (no multiplication)
      expect(result.baseSalary).toBe(300000);
      expect(result.grossSalary).toBeGreaterThanOrEqual(300000);
    });

    it('should default to MONTHLY if rateType is not specified', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 250000,
        // rateType omitted
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // Should behave as MONTHLY
      expect(result.baseSalary).toBe(250000);
    });
  });

  describe('DAILY workers (new)', () => {
    it('should calculate salary based on days worked', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 5000, // 5,000 FCFA per day
        rateType: 'DAILY',
        daysWorkedThisMonth: 22, // 22 working days
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // Effective base salary = 5000 * 22 = 110,000 FCFA
      const expectedEffectiveSalary = 5000 * 22;
      expect(result.grossSalary).toBeGreaterThanOrEqual(expectedEffectiveSalary);
    });

    it('should handle partial month for daily workers', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 6000, // 6,000 FCFA per day
        rateType: 'DAILY',
        daysWorkedThisMonth: 10, // Only worked 10 days
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // Effective base salary = 6000 * 10 = 60,000 FCFA
      const expectedEffectiveSalary = 6000 * 10;
      expect(result.grossSalary).toBeGreaterThanOrEqual(expectedEffectiveSalary);
    });

    it('should handle zero days worked', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 5000,
        rateType: 'DAILY',
        daysWorkedThisMonth: 0, // No days worked
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // Effective base salary = 5000 * 0 = 0 FCFA
      expect(result.grossSalary).toBe(0);
    });
  });

  describe('HOURLY workers (new)', () => {
    it('should calculate salary based on hours worked', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 625, // 625 FCFA per hour
        rateType: 'HOURLY',
        hoursWorkedThisMonth: 173.33, // Standard monthly hours
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // Effective base salary = 625 * 173.33 ≈ 108,331 FCFA
      const expectedEffectiveSalary = Math.round(625 * 173.33);
      expect(result.grossSalary).toBeGreaterThanOrEqual(expectedEffectiveSalary - 100);
      expect(result.grossSalary).toBeLessThanOrEqual(expectedEffectiveSalary + 100);
    });

    it('should handle part-time hourly workers', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 800, // 800 FCFA per hour
        rateType: 'HOURLY',
        hoursWorkedThisMonth: 80, // Part-time: 80 hours
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // Effective base salary = 800 * 80 = 64,000 FCFA
      const expectedEffectiveSalary = 800 * 80;
      expect(result.grossSalary).toBeGreaterThanOrEqual(expectedEffectiveSalary);
    });

    it('should handle zero hours worked', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 700,
        rateType: 'HOURLY',
        hoursWorkedThisMonth: 0, // No hours worked
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // Effective base salary = 700 * 0 = 0 FCFA
      expect(result.grossSalary).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing days for DAILY worker (defaults to 0)', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 5000,
        rateType: 'DAILY',
        // daysWorkedThisMonth omitted
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // Should default to 0 days
      expect(result.grossSalary).toBe(0);
    });

    it('should handle missing hours for HOURLY worker (defaults to 0)', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 625,
        rateType: 'HOURLY',
        // hoursWorkedThisMonth omitted
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // Should default to 0 hours
      expect(result.grossSalary).toBe(0);
    });
  });

  describe('Allowances with rate types', () => {
    it('should add allowances to daily worker salary', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 5000,
        rateType: 'DAILY',
        daysWorkedThisMonth: 20,
        transportAllowance: 10000, // Fixed transport allowance
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // Gross = (5000 * 20) + 10000 = 110,000 FCFA
      const expectedGross = 5000 * 20 + 10000;
      expect(result.grossSalary).toBeGreaterThanOrEqual(expectedGross);
    });

    it('should add allowances to hourly worker salary', async () => {
      const input: PayrollCalculationInputV2 = {
        ...baseInput,
        baseSalary: 700,
        rateType: 'HOURLY',
        hoursWorkedThisMonth: 100,
        mealAllowance: 15000, // Fixed meal allowance
      } as PayrollCalculationInputV2;

      const result = await calculatePayrollV2(input);

      // Gross = (700 * 100) + 15000 = 85,000 FCFA
      const expectedGross = 700 * 100 + 15000;
      expect(result.grossSalary).toBeGreaterThanOrEqual(expectedGross);
    });
  });
});

/**
 * Usage Examples:
 *
 * 1. Monthly Worker (Existing):
 *    - baseSalary: 300,000 FCFA
 *    - rateType: 'MONTHLY'
 *    - Result: 300,000 FCFA (unchanged)
 *
 * 2. Daily Worker (New):
 *    - baseSalary: 5,000 FCFA (per day)
 *    - rateType: 'DAILY'
 *    - daysWorkedThisMonth: 22
 *    - Result: 110,000 FCFA (5000 × 22)
 *
 * 3. Hourly Worker (New):
 *    - baseSalary: 625 FCFA (per hour)
 *    - rateType: 'HOURLY'
 *    - hoursWorkedThisMonth: 173.33
 *    - Result: 108,331 FCFA (625 × 173.33)
 */
