/**
 * Tests for Daily Workers Payroll Calculation
 *
 * Validates the complete payroll flow for daily/hourly workers including:
 * - Gross calculation with CDDTI components
 * - Prorated deductions
 * - Daily ITS calculation
 *
 * Based on guide_paie_journaliers_cote_ivoire.md official examples
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDailyWorkersGross,
  calculateProratedDeductions,
  calculateDailyITS,
  type DailyWorkersGrossInput,
} from '../daily-workers-calculation';

describe('Daily Workers Payroll Calculation', () => {
  describe('calculateDailyWorkersGross', () => {
    it('calculates gross for standard worker (matches official guide)', () => {
      // From guide_paie_journaliers_cote_ivoire.md example
      const input: DailyWorkersGrossInput = {
        categoricalSalary: 75_000,
        hoursWorked: 30,
        weeklyHoursRegime: '40h',
        contractType: 'CDDTI',
        dailyTransportRate: 500,
      };

      const result = calculateDailyWorkersGross(input);

      // Verify hourly rate calculation
      expect(result.hourlyRate).toBeCloseTo(432.7, 0);

      // Verify regular gross (30h × 432.7)
      expect(result.regularGross).toBeCloseTo(12_981, 0);

      // Verify no overtime (worked 30h < 40h threshold)
      expect(result.overtimeGross1).toBe(0);
      expect(result.overtimeGross2).toBe(0);

      // Verify CDDTI components (corrected rates from official doc)
      expect(result.gratification).toBeCloseTo(811, 0); // 6.25% of 12,981
      expect(result.congesPayes).toBeCloseTo(1_400, 0); // 10.15% of (12,981 + 811)
      expect(result.indemnitPrecarite).toBeCloseTo(456, 0); // 3% of (12,981 + 811 + 1,400)

      // Verify transport (500 × 3.75 days)
      expect(result.equivalentDays).toBe(3.75);
      expect(result.transportAllowance).toBe(1_875);

      // Verify total
      const expectedTotal = 12_981 + 811 + 1_400 + 456 + 1_875;
      expect(result.totalBrut).toBeCloseTo(expectedTotal, 0);
    });

    it('calculates gross with overtime (first 8 hours)', () => {
      const input: DailyWorkersGrossInput = {
        categoricalSalary: 100_000,
        hoursWorked: 44, // 4 hours overtime
        weeklyHoursRegime: '40h',
        contractType: 'CDDTI',
        dailyTransportRate: 500,
      };

      const result = calculateDailyWorkersGross(input);

      const hourlyRate = 100_000 / 173.33;

      // Regular hours (40h)
      expect(result.regularGross).toBeCloseTo(40 * hourlyRate, 0);

      // Overtime (4h × 1.15)
      expect(result.overtimeGross1).toBeCloseTo(4 * hourlyRate * 1.15, 0);

      // No second tier overtime
      expect(result.overtimeGross2).toBe(0);
    });

    it('calculates gross with overtime (beyond 8 hours)', () => {
      const input: DailyWorkersGrossInput = {
        categoricalSalary: 100_000,
        hoursWorked: 52, // 12 hours overtime
        weeklyHoursRegime: '40h',
        contractType: 'CDDTI',
        dailyTransportRate: 500,
      };

      const result = calculateDailyWorkersGross(input);

      const hourlyRate = 100_000 / 173.33;

      // Regular hours (40h)
      expect(result.regularGross).toBeCloseTo(40 * hourlyRate, 0);

      // First 8 OT hours (× 1.15)
      expect(result.overtimeGross1).toBeCloseTo(8 * hourlyRate * 1.15, 0);

      // Beyond 8 OT hours (4h × 1.50)
      expect(result.overtimeGross2).toBeCloseTo(4 * hourlyRate * 1.50, 0);
    });

    it('applies 48h threshold for agricultural workers', () => {
      const input: DailyWorkersGrossInput = {
        categoricalSalary: 100_000,
        hoursWorked: 52, // 4 hours overtime for 48h regime
        weeklyHoursRegime: '48h',
        contractType: 'CDDTI',
        dailyTransportRate: 500,
      };

      const result = calculateDailyWorkersGross(input);

      // Regular hours (48h)
      expect(result.overtimeBreakdown.regularHours).toBe(48);

      // Overtime (4h)
      expect(result.overtimeBreakdown.hours_threshold_to_plus8).toBe(4);
      expect(result.overtimeBreakdown.hours_above_plus8).toBe(0);
    });

    it('calculates Sunday/holiday hours with 1.75× multiplier', () => {
      const input: DailyWorkersGrossInput = {
        categoricalSalary: 100_000,
        hoursWorked: 48,
        weeklyHoursRegime: '40h',
        contractType: 'CDDTI',
        dailyTransportRate: 500,
        sundayHours: 8,
      };

      const result = calculateDailyWorkersGross(input);

      const hourlyRate = 100_000 / 173.33;

      expect(result.sundayGross).toBeCloseTo(8 * hourlyRate * 1.75, 0);
    });

    it('calculates night hours with 1.75× multiplier', () => {
      const input: DailyWorkersGrossInput = {
        categoricalSalary: 100_000,
        hoursWorked: 48,
        weeklyHoursRegime: '40h',
        contractType: 'CDDTI',
        dailyTransportRate: 500,
        nightHours: 8, // 21h-5h
      };

      const result = calculateDailyWorkersGross(input);

      const hourlyRate = 100_000 / 173.33;

      expect(result.nightGross).toBeCloseTo(8 * hourlyRate * 1.75, 0);
    });

    it('does not add indemnité de précarité for non-CDDTI contracts', () => {
      const input: DailyWorkersGrossInput = {
        categoricalSalary: 75_000,
        hoursWorked: 30,
        weeklyHoursRegime: '40h',
        contractType: 'CDD', // Not CDDTI
        dailyTransportRate: 500,
      };

      const result = calculateDailyWorkersGross(input);

      // CDDTI-specific component should be 0
      expect(result.indemnitPrecarite).toBe(0);

      // But gratification and congés payés should still apply
      expect(result.gratification).toBeGreaterThan(0);
      expect(result.congesPayes).toBeGreaterThan(0);
    });

    it('allows custom rates for CDDTI components', () => {
      const input: DailyWorkersGrossInput = {
        categoricalSalary: 100_000,
        hoursWorked: 40,
        weeklyHoursRegime: '40h',
        contractType: 'CDDTI',
        gratificationRate: 0.05, // Custom 5%
        congesPayesRate: 0.12, // Custom 12%
        indemnitePrecariteRate: 0.05, // Custom 5%
        dailyTransportRate: 1000,
      };

      const result = calculateDailyWorkersGross(input);

      const brutBase = result.brutBase;

      // Note: Calculations are compounded per official formulas
      // Gratification is calculated on brutBase
      expect(result.gratification).toBeCloseTo(brutBase * 0.05, 0);

      // Congés payés includes gratification in base
      const expectedConges = (brutBase + result.gratification) * 0.12;
      expect(result.congesPayes).toBeCloseTo(expectedConges, 0);

      // Précarité includes full subtotal (base + grat + congés)
      const expectedPrecarite = (brutBase + result.gratification + result.congesPayes) * 0.05;
      expect(result.indemnitPrecarite).toBeCloseTo(expectedPrecarite, 0);
    });

    it('generates correct component list', () => {
      const input: DailyWorkersGrossInput = {
        categoricalSalary: 75_000,
        hoursWorked: 30,
        weeklyHoursRegime: '40h',
        contractType: 'CDDTI',
        dailyTransportRate: 500,
      };

      const result = calculateDailyWorkersGross(input);

      // Should have all CDDTI components
      expect(result.components).toHaveLength(5); // Base, gratif, congés, précarité, transport

      // Verify component codes
      const codes = result.components.map(c => c.code);
      expect(codes).toContain('11'); // Base salary
      expect(codes).toContain('31'); // Gratification
      expect(codes).toContain('32'); // Congés payés
      expect(codes).toContain('33'); // Précarité
      expect(codes).toContain('22'); // Transport
    });
  });

  describe('calculateProratedDeductions', () => {
    it('prorates CNPS correctly', () => {
      const result = calculateProratedDeductions(
        12_981, // Total brut
        3.75,   // Equivalent days
        0.0367, // CNPS rate (3.67%)
        1_000   // CMU fixed amount
      );

      const prorata = 3.75 / 30;
      const expectedCNPS = Math.round(12_981 * 0.0367 * prorata);

      expect(result.cnpsEmployee).toBe(expectedCNPS);
      expect(result.prorata).toBeCloseTo(0.125, 3);
    });

    it('prorates CMU based on days worked', () => {
      const result = calculateProratedDeductions(
        12_981,
        3.75,
        0.0367,
        1_000
      );

      // CMU is prorated: 1,000 × (3.75 / 30) = 125 FCFA
      const expectedCMU = Math.round(1_000 * (3.75 / 30));
      expect(result.cmu).toBe(expectedCMU);
    });

    it('returns 0 CMU if no days worked', () => {
      const result = calculateProratedDeductions(
        0,
        0, // No days worked
        0.0367,
        1_000
      );

      expect(result.cmu).toBe(0);
      expect(result.cnpsEmployee).toBe(0);
    });

    it('handles partial days correctly', () => {
      const result = calculateProratedDeductions(
        20_000,
        7.5, // 7.5 days worked
        0.0367,
        1_000
      );

      const prorata = 7.5 / 30; // 0.25
      expect(result.prorata).toBe(0.25);
      expect(result.cnpsEmployee).toBeCloseTo(20_000 * 0.0367 * 0.25, 0);
    });
  });

  describe('calculateDailyITS', () => {
    /**
     * CRITICAL TEST: Verifies fix for GAP-ITS-JOUR-001
     * Tests the official guide example (guide_paie_journaliers_cote_ivoire.md lines 268-315)
     */
    it('matches official guide example with family deduction (GAP-ITS-JOUR-001)', () => {
      // Official Côte d'Ivoire 2024 tax brackets (guide lines 220-227)
      const monthlyBrackets = [
        { min: 0, max: 75_000, rate: 0.00 },
        { min: 75_000, max: 240_000, rate: 0.16 },
        { min: 240_000, max: 800_000, rate: 0.21 },
        { min: 800_000, max: 2_400_000, rate: 0.24 },
        { min: 2_400_000, max: 8_000_000, rate: 0.28 },
        { min: 8_000_000, max: null, rate: 0.32 },
      ];

      // Official family deductions (guide lines 248-259)
      const familyDeductions = [
        { fiscalParts: 1.0, deductionAmount: 0 },
        { fiscalParts: 1.5, deductionAmount: 5_500 },
        { fiscalParts: 2.0, deductionAmount: 11_000 },
        { fiscalParts: 2.5, deductionAmount: 16_500 },
        { fiscalParts: 3.0, deductionAmount: 22_000 },
        { fiscalParts: 3.5, deductionAmount: 27_500 },
        { fiscalParts: 4.0, deductionAmount: 33_000 },
        { fiscalParts: 4.5, deductionAmount: 38_500 },
        { fiscalParts: 5.0, deductionAmount: 44_000 },
      ];

      // Guide example (lines 268-315):
      // - M. TRAZIE, célibataire avec 3 enfants (3 parts)
      // - 10 days of work
      // - 10,000 FCFA/day
      const totalBrut = 100_000; // 10,000 × 10 days
      const equivalentDays = 10;
      const fiscalParts = 3.0;

      const its = calculateDailyITS(
        totalBrut,
        equivalentDays,
        fiscalParts,
        monthlyBrackets,
        familyDeductions
      );

      // Guide calculation (lines 272-315):
      // Step 1: Calculate daily tax
      // - Tranche 1 (0-2,500): 2,500 × 0% = 0
      // - Tranche 2 (2,501-8,000): (8,000 - 2,500) × 16% = 880 FCFA
      // - Tranche 3 (8,001-10,000): (10,000 - 8,000) × 21% = 420 FCFA
      // - Daily tax = 1,300 FCFA
      // - Gross tax for 10 days = 13,000 FCFA
      //
      // Step 2: Family deduction for 3 parts
      // - Monthly deduction: 22,000 FCFA
      // - Daily deduction: 22,000 ÷ 30 = 733 FCFA/day
      // - Total deduction: 733 × 10 = 7,330 FCFA
      //
      // Step 3: Net ITS
      // - 13,000 - 7,330 = 5,670 FCFA ✅

      expect(its).toBe(5_670); // EXACT match to guide
    });

    it('calculates daily ITS using daily brackets', () => {
      // Example monthly brackets (Côte d'Ivoire)
      const monthlyBrackets = [
        { min: 0, max: 50_000, rate: 0 },
        { min: 50_000, max: 130_000, rate: 0.10 },
        { min: 130_000, max: 200_000, rate: 0.15 },
        { min: 200_000, max: null, rate: 0.20 },
      ];

      // Example: 12,981 FCFA for 3.75 days
      // Daily gross = 12,981 / 3.75 = 3,462 FCFA/day
      // Daily bracket (50,000/30 = 1,667):
      // 0-1,667 = 0%, 1,667-3,462 = 10%
      // Daily tax = (3,462 - 1,667) × 10% = 179.5 FCFA/day
      // Total ITS = 179.5 × 3.75 = 673 FCFA

      const its = calculateDailyITS(
        12_981,
        3.75,
        1.0,
        monthlyBrackets,
        [] // No family deductions
      );

      // Verify it's in the expected range
      expect(its).toBeGreaterThanOrEqual(0);
      expect(its).toBeLessThan(1_000); // Should be small for this example
    });

    it('applies family deductions correctly (subtraction, not division)', () => {
      const monthlyBrackets = [
        { min: 0, max: 75_000, rate: 0 },
        { min: 75_000, max: 240_000, rate: 0.16 },
        { min: 240_000, max: null, rate: 0.21 },
      ];

      // Family deductions for testing
      const familyDeductions = [
        { fiscalParts: 1.0, deductionAmount: 0 },
        { fiscalParts: 2.0, deductionAmount: 11_000 },
      ];

      const taxSingle = calculateDailyITS(100_000, 10, 1.0, monthlyBrackets, familyDeductions);
      const taxMarried = calculateDailyITS(100_000, 10, 2.0, monthlyBrackets, familyDeductions);

      // Married (2.0 parts) should pay less tax
      // The difference should be close to (11,000 / 30) × 10 days = 3,667 FCFA
      expect(taxMarried).toBeLessThan(taxSingle);
      expect(taxSingle - taxMarried).toBeCloseTo(3_667, -2); // Within 100 FCFA
    });

    it('returns 0 for no days worked', () => {
      const monthlyBrackets = [
        { min: 0, max: 50_000, rate: 0 },
        { min: 50_000, max: null, rate: 0.10 },
      ];

      const its = calculateDailyITS(0, 0, 1.0, monthlyBrackets, []);
      expect(its).toBe(0);
    });

    it('handles high earners with multiple brackets', () => {
      const monthlyBrackets = [
        { min: 0, max: 50_000, rate: 0 },
        { min: 50_000, max: 130_000, rate: 0.10 },
        { min: 130_000, max: 200_000, rate: 0.15 },
        { min: 200_000, max: null, rate: 0.20 },
      ];

      // High daily rate worker
      const its = calculateDailyITS(
        300_000, // 300k for 10 days = 30k/day (high rate)
        10,
        1.0,
        monthlyBrackets,
        [] // No family deductions
      );

      expect(its).toBeGreaterThan(0);
      expect(its).toBeLessThan(300_000); // Tax should be less than gross
    });
  });

  describe('Integration: Complete Daily Workers Payroll', () => {
    it('matches official guide end-to-end example', () => {
      // From guide_paie_journaliers_cote_ivoire.md
      const categoricalSalary = 75_000;
      const hoursWorked = 30;

      // STEP 1: Calculate gross
      const gross = calculateDailyWorkersGross({
        categoricalSalary,
        hoursWorked,
        weeklyHoursRegime: '40h',
        contractType: 'CDDTI',
        dailyTransportRate: 500,
      });

      // Verify gross matches guide
      expect(gross.regularGross).toBeCloseTo(12_981, 0);
      expect(gross.equivalentDays).toBe(3.75);

      // STEP 2: Calculate deductions
      const deductions = calculateProratedDeductions(
        gross.totalBrut,
        gross.equivalentDays,
        0.0367, // CNPS 3.67%
        1_000   // CMU
      );

      // Verify prorata is correct
      expect(deductions.prorata).toBeCloseTo(0.125, 3);

      // STEP 3: Calculate ITS (would be done with real brackets)
      const monthlyBrackets = [
        { min: 0, max: 50_000, rate: 0 },
        { min: 50_000, max: 130_000, rate: 0.10 },
      ];

      const familyDeductions = [
        { fiscalParts: 1.0, deductionAmount: 0 },
      ];

      const its = calculateDailyITS(
        gross.brutBase, // Use brutBase for ITS (before CDDTI components)
        gross.equivalentDays,
        1.0,
        monthlyBrackets,
        familyDeductions
      );

      // Verify components exist
      expect(gross.components.length).toBeGreaterThan(0);
      expect(deductions.cnpsEmployee).toBeGreaterThan(0);
      expect(its).toBeGreaterThanOrEqual(0);
    });
  });
});
