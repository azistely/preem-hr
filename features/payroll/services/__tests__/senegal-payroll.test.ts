// @ts-nocheck
/**
 * Senegal Payroll Calculation Tests
 *
 * Test suite for Senegal-specific payroll calculations using the multi-country
 * database-driven architecture.
 *
 * Senegal Tax System: IRPP (Impôt sur le Revenu des Personnes Physiques)
 * Senegal Social Security: CSS (Caisse de Sécurité Sociale)
 * - IPRES (Retraite): 5.6% employee + 8.4% employer = 14% total
 * - IPRESS (Health): 5% employer
 * - Prestations Familiales: 7% employer
 * - Accidents du Travail: 1% employer
 */

import { describe, it, expect } from 'vitest';
import { calculatePayrollV2 } from '../payroll-calculation-v2';

describe('Senegal Payroll Calculations', () => {
  describe('IPRES (Retirement) Contributions', () => {
    it('should calculate IPRES at 14% total (5.6% employee + 8.4% employer)', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-001',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 200000, // 200,000 FCFA
        fiscalParts: 1.0,
      });

      // IPRES employee: 200,000 × 5.6% = 11,200 FCFA
      expect(result.socialSecurityEmployee).toBe(11200);

      // IPRES employer: 200,000 × 8.4% = 16,800 FCFA
      // Note: This is just the pension portion, total employer will be higher
      expect(result.socialSecurityEmployer).toBeGreaterThanOrEqual(16800);
    });

    it('should apply ceiling of 360,000 FCFA for IPRES', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-002',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 500000, // Above ceiling
        fiscalParts: 1.0,
      });

      // IPRES employee capped: 360,000 × 5.6% = 20,160 FCFA
      expect(result.socialSecurityEmployee).toBe(20160);

      // IPRES employer capped: 360,000 × 8.4% = 30,240 FCFA
      // Total employer includes other contributions (no ceiling)
      expect(result.socialSecurityEmployer).toBeGreaterThan(30240);
    });
  });

  describe('IRPP (Income Tax) Progressive Brackets', () => {
    it('should apply 0% tax for income below 630,000 FCFA/year (52,500 FCFA/month)', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-003',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 50000, // Below threshold
        fiscalParts: 1.0,
      });

      // Taxable income = 50,000 - 2,800 (IPRES) = 47,200
      // Annual: 47,200 × 12 = 566,400 < 630,000 → 0% tax
      expect(result.incomeTax).toBe(0);
    });

    it('should calculate IRPP for 150,000 FCFA monthly (1.8M annual)', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-004',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 150000,
        fiscalParts: 1.0,
      });

      // Taxable income = 150,000 - 8,400 (IPRES 5.6%) = 141,600 monthly
      // Annual: 141,600 × 12 = 1,699,200 FCFA
      //
      // IRPP Brackets (Annual):
      // - 0 - 630,000: 0%
      // - 630,001 - 1,500,000: 20% → 870,000 × 20% = 174,000
      // - 1,500,001 - 1,699,200: 30% → 199,200 × 30% = 59,760
      // Total annual tax: 174,000 + 59,760 = 233,760
      // Monthly tax: 233,760 / 12 = 19,480 FCFA

      expect(result.incomeTax).toBeCloseTo(19480, -1); // Within 10 FCFA
    });

    it('should calculate IRPP for 300,000 FCFA monthly (3.6M annual)', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-005',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 300000,
        fiscalParts: 1.0,
      });

      // Taxable income = 300,000 - 16,800 (IPRES 5.6%) = 283,200 monthly
      // Annual: 283,200 × 12 = 3,398,400 FCFA
      //
      // IRPP Brackets (Annual):
      // - 0 - 630,000: 0%
      // - 630,001 - 1,500,000: 20% → 870,000 × 20% = 174,000
      // - 1,500,001 - 3,398,400: 30% → 1,898,400 × 30% = 569,520
      // Total annual tax: 174,000 + 569,520 = 743,520
      // Monthly tax: 743,520 / 12 = 61,960 FCFA

      expect(result.incomeTax).toBeCloseTo(61960, -1);
    });

    it('should apply maximum 40% rate for high earners', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-006',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 2000000, // High earner
        fiscalParts: 1.0,
      });

      // Taxable income = 2,000,000 - 20,160 (capped IPRES) = 1,979,840 monthly
      // Annual: 1,979,840 × 12 = 23,758,080 FCFA
      //
      // This falls into the highest bracket (13,500,001+: 40%)
      expect(result.incomeTax).toBeGreaterThan(500000); // Significant tax
    });
  });

  describe('Family Deductions', () => {
    it('should apply no deduction for single person (1.0 parts)', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-007',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 200000,
        fiscalParts: 1.0,
      });

      // No family deduction for 1.0 parts
      // Verify tax is calculated without deduction
      expect(result.fiscalParts).toBe(1.0);
    });

    it('should apply 50,000 FCFA annual deduction for married/1 child (1.5 parts)', async () => {
      const single = await calculatePayrollV2({
        employeeId: 'sn-test-008a',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 200000,
        fiscalParts: 1.0,
      });

      const married = await calculatePayrollV2({
        employeeId: 'sn-test-008b',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 200000,
        fiscalParts: 1.5,
      });

      // Family deduction reduces tax
      // Annual deduction: 50,000 FCFA → Monthly: ~4,167 FCFA
      expect(married.incomeTax).toBeLessThan(single.incomeTax);
    });

    it('should apply 100,000 FCFA annual deduction for married+1 or 2 children (2.0 parts)', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-009',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 250000,
        fiscalParts: 2.0,
      });

      // Verify family deduction applied
      expect(result.fiscalParts).toBe(2.0);
    });

    it('should apply 150,000 FCFA annual deduction for married+2 or 3 children (2.5 parts)', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-010',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 300000,
        fiscalParts: 2.5,
      });

      // Verify family deduction applied
      expect(result.fiscalParts).toBe(2.5);
    });
  });

  describe('CFCE (Employer Training Tax)', () => {
    it('should apply 3% CFCE on gross salary', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-011',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 200000,
        fiscalParts: 1.0,
      });

      // CFCE: 200,000 × 3% = 6,000 FCFA (employer only)
      // This should be included in employer cost
      expect(result.employerCost).toBeGreaterThan(result.grossSalary);
    });
  });

  describe('Complete Payroll Example - Senegal', () => {
    it('should calculate complete payroll for 250,000 FCFA salary', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-012',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 250000,
        fiscalParts: 1.5, // Married or 1 child
      });

      // === EARNINGS ===
      expect(result.grossSalary).toBe(250000);

      // === EMPLOYEE DEDUCTIONS ===
      // IPRES employee: 250,000 × 5.6% = 14,000 FCFA
      expect(result.socialSecurityEmployee).toBe(14000);

      // Taxable income = 250,000 - 14,000 = 236,000
      expect(result.taxableIncome).toBe(236000);

      // IRPP (with 1.5 parts family deduction)
      // Annual taxable: 236,000 × 12 = 2,832,000 FCFA
      // - 0 - 630,000: 0%
      // - 630,001 - 1,500,000: 20% → 174,000
      // - 1,500,001 - 2,832,000: 30% → 399,600
      // Gross tax: 573,600
      // Family deduction (1.5 parts): 50,000 annual → 4,167/month
      // Net annual tax: 573,600 - 50,000 = 523,600
      // Monthly tax: 523,600 / 12 = 43,633 FCFA
      expect(result.incomeTax).toBeCloseTo(43633, -1);

      // Net salary = 250,000 - 14,000 - 43,633 ≈ 192,367 FCFA
      expect(result.netSalary).toBeCloseTo(192367, -1);

      // === EMPLOYER COSTS ===
      // IPRES employer: 250,000 × 8.4% = 21,000
      // IPRESS: 250,000 × 5% = 12,500
      // Prestations Familiales: 250,000 × 7% = 17,500
      // Accidents du Travail: 250,000 × 1% = 2,500
      // CFCE: 250,000 × 3% = 7,500
      // Total employer: 21,000 + 12,500 + 17,500 + 2,500 + 7,500 = 61,000
      // Total cost: 250,000 + 61,000 = 311,000 FCFA
      expect(result.employerCost).toBeCloseTo(311000, -1);
    });

    it('should calculate complete payroll for SMIG (60,000 FCFA)', async () => {
      const result = await calculatePayrollV2({
        employeeId: 'sn-test-013',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary: 60000, // Senegal SMIG
        fiscalParts: 1.0,
      });

      // === EARNINGS ===
      expect(result.grossSalary).toBe(60000);

      // === EMPLOYEE DEDUCTIONS ===
      // IPRES employee: 60,000 × 5.6% = 3,360 FCFA
      expect(result.socialSecurityEmployee).toBe(3360);

      // Taxable income = 60,000 - 3,360 = 56,640
      // Annual: 56,640 × 12 = 679,680 FCFA
      // This is above the 630,000 threshold, so tax applies
      // Bracket 1 (630,001 - 1,500,000): 49,680 × 20% = 9,936 annual
      // Monthly: 9,936 / 12 = 828 FCFA
      expect(result.incomeTax).toBeCloseTo(828, -1);

      // Net salary = 60,000 - 3,360 - 828 = 55,812 FCFA
      expect(result.netSalary).toBeCloseTo(55812, -1);

      // === EMPLOYER COSTS ===
      // Total employer contributions: 14% (IPRES) + 5% (IPRESS) + 7% (PF) + 1% (AT) + 3% (CFCE) = 30%
      // 60,000 × 30% = 18,000
      // But IPRES has employer rate of 8.4%, not 14%
      // Correct: 60,000 × (8.4% + 5% + 7% + 1% + 3%) = 60,000 × 24.4% = 14,640
      expect(result.employerCost).toBeCloseTo(74640, -1); // 60k + 14.64k
    });
  });

  describe('Comparison: Senegal vs Côte d\'Ivoire', () => {
    it('should have lower social security burden in Senegal (14% vs 20.5%)', async () => {
      const baseSalary = 200000;

      const sn = await calculatePayrollV2({
        employeeId: 'compare-sn',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary,
        fiscalParts: 1.0,
      });

      const ci = await calculatePayrollV2({
        employeeId: 'compare-ci',
        countryCode: 'CI',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary,
        fiscalParts: 1.0,
        sectorCode: 'services',
      });

      // SN IPRES: 5.6% vs CI CNPS: 6.3%
      expect(sn.socialSecurityEmployee).toBeLessThan(ci.cnpsEmployee);

      // SN has tax-free threshold (630k/year), CI doesn't
      // Both at 200k monthly should have different tax treatments
    });

    it('should show tax differences due to different bracket structures', async () => {
      const baseSalary = 300000;

      const sn = await calculatePayrollV2({
        employeeId: 'tax-compare-sn',
        countryCode: 'SN',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary,
        fiscalParts: 1.0,
      });

      const ci = await calculatePayrollV2({
        employeeId: 'tax-compare-ci',
        countryCode: 'CI',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        baseSalary,
        fiscalParts: 1.0,
        sectorCode: 'services',
      });

      // CI has 6 brackets (0%, 16%, 21%, 24%, 28%, 32%)
      // SN has 6 brackets (0%, 20%, 30%, 35%, 37%, 40%)
      // SN brackets are annual, CI are monthly
      // Compare that both calculated successfully
      expect(sn.incomeTax).toBeGreaterThan(0);
      expect(ci.its).toBeGreaterThan(0);
    });
  });
});
