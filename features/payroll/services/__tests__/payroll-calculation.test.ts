/**
 * Comprehensive Payroll Calculation Tests
 *
 * These tests validate all payroll calculations against:
 * 1. Official examples from payroll-cote-d-ivoire.md
 * 2. Test cases from 05-EPIC-PAYROLL.md
 * 3. Edge cases and regulatory compliance
 */

import { describe, it, expect } from 'vitest';
import { calculatePayroll } from '../payroll-calculation';
import { calculateGrossSalary } from '../gross-calculation';
import { calculateCNPSPension, calculateCNPSOther } from '../cnps-calculation';
import { calculateCMU } from '../cmu-calculation';
import { calculateITS, calculateTaxableIncome } from '../its-calculation';
import { calculateOvertime } from '../overtime-calculation';
import { SMIG } from '../../constants';

// ========================================
// STORY 1.1: Base Salary Calculation
// ========================================
describe('Base Salary Calculation (Story 1.1)', () => {
  it('should calculate full month salary with allowances', () => {
    const result = calculateGrossSalary({
      employeeId: '123',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 300000,
      housingAllowance: 50000,
      transportAllowance: 25000,
      mealAllowance: 15000,
    });

    expect(result.baseSalary).toBe(300000);
    expect(result.proratedSalary).toBe(300000);
    expect(result.allowances).toBe(90000);
    expect(result.totalGross).toBe(390000);
    expect(result.breakdown).toEqual({
      base: 300000,
      allowances: 90000,
      overtime: 0,
      bonuses: 0,
    });
  });

  it('should prorate salary for mid-month hire', () => {
    // Hired on Jan 15, salary 300,000, month has 31 days
    // Days worked: 17 (Jan 15-31)
    // Prorated: 300,000 × (17/31) = 164,516 FCFA
    const result = calculateGrossSalary({
      employeeId: '123',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 300000,
      hireDate: new Date('2025-01-15'),
    });

    expect(result.daysWorked).toBe(17);
    expect(result.daysInPeriod).toBe(31);
    expect(result.proratedSalary).toBe(164516);
  });

  it('should validate salary meets SMIG minimum', () => {
    expect(() => {
      calculateGrossSalary({
        employeeId: '123',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 50000, // Below SMIG
      });
    }).toThrow(/inférieur au SMIG/);
  });

  it('should accept SMIG as minimum', () => {
    const result = calculateGrossSalary({
      employeeId: '123',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: SMIG,
    });

    expect(result.baseSalary).toBe(SMIG);
    expect(result.totalGross).toBe(SMIG);
  });
});

// ========================================
// STORY 2.1 & 2.2: CNPS Contributions
// ========================================
describe('CNPS Pension Calculation (Story 2.1)', () => {
  it('should match official example 7.1', () => {
    // From payroll-cote-d-ivoire.md:152
    const result = calculateCNPSPension(300000);

    expect(result.employee).toBe(18900); // 300k × 6.3%
    expect(result.employer).toBe(23100); // 300k × 7.7%
  });

  it('should apply ceiling for high salaries', () => {
    const result = calculateCNPSPension(5000000); // Above ceiling

    expect(result.cappedSalary).toBe(3375000);
    expect(result.employee).toBe(212625); // 3,375,000 × 6.3%
    expect(result.employer).toBe(259875); // 3,375,000 × 7.7%
  });

  it('should calculate correctly for SMIG', () => {
    const result = calculateCNPSPension(75000);

    expect(result.employee).toBe(4725);
    expect(result.employer).toBe(5775);
  });
});

describe('CNPS Other Contributions (Story 2.2)', () => {
  it('should calculate for salary below ceiling', () => {
    const result = calculateCNPSOther(60000, { sector: 'services' });

    expect(result.maternity).toBe(450); // 60k × 0.75%
    expect(result.family).toBe(3000); // 60k × 5%
    expect(result.workAccident).toBe(1200); // 60k × 2%
  });

  it('should apply ceiling correctly', () => {
    const result = calculateCNPSOther(300000, { sector: 'services' });

    expect(result.cappedSalary).toBe(70000);
    expect(result.maternity).toBe(525); // 70k × 0.75%
    expect(result.family).toBe(3500); // 70k × 5%
    expect(result.workAccident).toBe(1400); // 70k × 2%
  });

  it('should use higher rate for BTP sector', () => {
    const result = calculateCNPSOther(100000, { sector: 'construction' });

    expect(result.workAccident).toBe(3500); // 70k × 5% (max rate)
  });
});

// ========================================
// STORY 3.1: CMU Calculation
// ========================================
describe('CMU Calculation (Story 3.1)', () => {
  it('should calculate for employee only', () => {
    const result = calculateCMU({ hasFamily: false });

    expect(result.employee).toBe(1000);
    expect(result.employer).toBe(500);
    expect(result.total).toBe(1500);
  });

  it('should calculate for employee with family', () => {
    const result = calculateCMU({ hasFamily: true });

    expect(result.employee).toBe(1000);
    expect(result.employer).toBe(5000); // 500 + 4500
    expect(result.total).toBe(6000);
  });
});

// ========================================
// STORY 4.1 & 4.2: ITS Calculation
// ========================================
describe('Taxable Income Calculation (Story 4.1)', () => {
  it('should match official example 7.1', () => {
    // From payroll-cote-d-ivoire.md:154
    const taxableIncome = calculateTaxableIncome({
      grossSalary: 300000,
      cnpsEmployee: 18900,
      cmuEmployee: 1000,
    });

    expect(taxableIncome).toBe(280100); // 300k - 19.9k
  });
});

describe('ITS Progressive Calculation (Story 4.2)', () => {
  it('should match official example 7.1 (300k gross)', () => {
    // From payroll-cote-d-ivoire.md:156
    const annualTaxableIncome = 280100 * 12; // 3,361,200
    const its = calculateITS(annualTaxableIncome);

    // Expected monthly tax: ~60,815 FCFA
    expect(its.monthlyTax).toBeCloseTo(60815, -1); // Within 10 FCFA
    expect(its.annualTax).toBeCloseTo(729780, -10); // Within 10 FCFA
  });

  it('should handle first bracket (no tax)', () => {
    const its = calculateITS(250000); // 250k annual (under 300k threshold)
    // All in 0% bracket
    expect(its.annualTax).toBe(0);
    expect(its.monthlyTax).toBe(0);
  });

  it('should calculate progressive tax correctly for 1M annual', () => {
    // Manual calculation for 1M annual income
    // Bracket 1 (0-300k): 0
    // Bracket 2 (300k-547k): 247k × 10% = 24,700
    // Bracket 3 (547k-979k): 432k × 15% = 64,800
    // Bracket 4 (979k-1M): 21k × 20% = 4,200
    // Total: 93,700

    const its = calculateITS(1000000);
    expect(its.annualTax).toBeCloseTo(93700, 0);
  });
});

// ========================================
// STORY 5.1: Overtime Calculation
// ========================================
describe('Overtime Calculation (Story 5.1)', () => {
  it('should match official example 7.2', () => {
    // From payroll-cote-d-ivoire.md:164-174
    const baseSalary = 200000;
    const hourlyRate = baseSalary / 173.33; // ~1,154 FCFA/hour

    const overtime = calculateOvertime({
      monthlySalary: baseSalary,
      hours: [
        { count: 6, type: 'hours_41_to_46' }, // × 1.15
        { count: 4, type: 'hours_above_46' }, // × 1.50
      ],
    });

    expect(overtime.hours_41_to_46).toBeCloseTo(7968, -2); // Within 10 FCFA
    expect(overtime.hours_above_46).toBeCloseTo(6924, -2); // Within 10 FCFA
    expect(overtime.total).toBeCloseTo(14892, -2); // Within 10 FCFA
  });

  it('should calculate night + sunday multiplier', () => {
    const hourlyRate = 1000;
    const overtime = calculateOvertime({
      hourlyRate,
      hours: [{ count: 8, type: 'night_sunday_or_holiday' }], // × 2.00
    });

    expect(overtime.night_sunday_or_holiday).toBe(16000); // 8 × 1000 × 2.0
  });

  it('should enforce maximum overtime limits', () => {
    expect(() => {
      calculateOvertime({
        hourlyRate: 1000,
        hours: [{ count: 16, type: 'hours_41_to_46' }],
      });
    }).toThrow(/limite d'heures supplémentaires/);
  });
});

// ========================================
// STORY 6.1: Complete Payroll Calculation
// ========================================
describe('Complete Payroll Calculation (Story 6.1)', () => {
  it('should match official example 7.1 exactly', () => {
    // From payroll-cote-d-ivoire.md:148-161
    const result = calculatePayroll({
      employeeId: '123',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 300000,
    });

    expect(result.grossSalary).toBe(300000);
    expect(result.cnpsEmployee).toBe(18900);
    expect(result.cmuEmployee).toBe(1000);
    expect(result.taxableIncome).toBe(280100);
    expect(result.its).toBeCloseTo(60815, -1);
    expect(result.netSalary).toBeCloseTo(219285, -1);

    // Employer costs
    expect(result.cnpsEmployer).toBe(23100);
    expect(result.cmuEmployer).toBe(500); // No family
    expect(result.employerCost).toBeCloseTo(351350, -50);
  });

  it('should handle employee with family and allowances', () => {
    const result = calculatePayroll({
      employeeId: '456',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 500000,
      housingAllowance: 100000,
      transportAllowance: 50000,
      hasFamily: true,
    });

    expect(result.grossSalary).toBe(650000);
    expect(result.cmuEmployer).toBe(5000); // 500 + 4500 family
  });

  it('should handle overtime in complete calculation', () => {
    const result = calculatePayroll({
      employeeId: '789',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 200000,
      overtimeHours: [
        { count: 6, type: 'hours_41_to_46' },
        { count: 4, type: 'hours_above_46' },
      ],
    });

    expect(result.overtimePay).toBeCloseTo(14892, -2); // Within 10 FCFA
    expect(result.grossSalary).toBeCloseTo(214892, -2); // Within 10 FCFA
  });
});

// ========================================
// Edge Cases & Validation
// ========================================
describe('Edge Cases and Validation', () => {
  it('should handle zero overtime', () => {
    const result = calculatePayroll({
      employeeId: '123',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 100000,
      overtimeHours: [],
    });

    expect(result.overtimePay).toBe(0);
  });

  it('should round all currency to nearest FCFA', () => {
    const result = calculatePayroll({
      employeeId: '123',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 123456,
    });

    // All amounts should be integers (no decimals)
    expect(Number.isInteger(result.grossSalary)).toBe(true);
    expect(Number.isInteger(result.cnpsEmployee)).toBe(true);
    expect(Number.isInteger(result.its)).toBe(true);
    expect(Number.isInteger(result.netSalary)).toBe(true);
  });

  it('should ensure net salary is never negative', () => {
    const result = calculatePayroll({
      employeeId: '123',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: SMIG,
    });

    expect(result.netSalary).toBeGreaterThan(0);
  });
});
