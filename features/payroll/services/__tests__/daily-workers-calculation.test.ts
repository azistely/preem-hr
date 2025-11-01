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

      // Verify CDDTI components
      expect(result.gratification).toBeCloseTo(432, 0); // 3.33% of 12,981
      expect(result.congesPayes).toBeCloseTo(1_298, 0); // 10% of 12,981
      expect(result.indemnitPrecarite).toBeCloseTo(389, 0); // 3% of 12,981

      // Verify transport (500 × 3.75 days)
      expect(result.equivalentDays).toBe(3.75);
      expect(result.transportAllowance).toBe(1_875);

      // Verify total
      const expectedTotal = 12_981 + 432 + 1_298 + 389 + 1_875;
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

    it('calculates Saturday hours with 1.40× multiplier', () => {
      const input: DailyWorkersGrossInput = {
        categoricalSalary: 100_000,
        hoursWorked: 48,
        weeklyHoursRegime: '40h',
        contractType: 'CDDTI',
        dailyTransportRate: 500,
        saturdayHours: 8, // 8h on Saturday
      };

      const result = calculateDailyWorkersGross(input);

      const hourlyRate = 100_000 / 173.33;

      // Saturday premium
      expect(result.saturdayGross).toBeCloseTo(8 * hourlyRate * 1.40, 0);

      // Regular weekday hours (40h, not 48h)
      expect(result.overtimeBreakdown.regularHours).toBe(40);
    });

    it('calculates Sunday/holiday hours with 1.40× multiplier', () => {
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

      expect(result.sundayGross).toBeCloseTo(8 * hourlyRate * 1.40, 0);
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

      expect(result.gratification).toBeCloseTo(brutBase * 0.05, 0);
      expect(result.congesPayes).toBeCloseTo(brutBase * 0.12, 0);
      expect(result.indemnitPrecarite).toBeCloseTo(brutBase * 0.05, 0);
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

    it('does not prorate CMU (fixed monthly amount)', () => {
      const result = calculateProratedDeductions(
        12_981,
        3.75,
        0.0367,
        1_000
      );

      // CMU is fixed, not prorated (per HR clarification)
      expect(result.cmu).toBe(1_000);
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
        monthlyBrackets
      );

      // Verify it's in the expected range
      expect(its).toBeGreaterThanOrEqual(0);
      expect(its).toBeLessThan(1_000); // Should be small for this example
    });

    it('applies fiscal parts correctly', () => {
      const monthlyBrackets = [
        { min: 0, max: 50_000, rate: 0 },
        { min: 50_000, max: 130_000, rate: 0.10 },
        { min: 130_000, max: null, rate: 0.20 },
      ];

      const taxSingle = calculateDailyITS(100_000, 10, 1.0, monthlyBrackets);
      const taxMarried = calculateDailyITS(100_000, 10, 2.0, monthlyBrackets);

      // Married (2.0 parts) should pay less tax
      expect(taxMarried).toBeLessThan(taxSingle);
    });

    it('returns 0 for no days worked', () => {
      const monthlyBrackets = [
        { min: 0, max: 50_000, rate: 0 },
        { min: 50_000, max: null, rate: 0.10 },
      ];

      const its = calculateDailyITS(0, 0, 1.0, monthlyBrackets);
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
        monthlyBrackets
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

      const its = calculateDailyITS(
        gross.brutBase, // Use brutBase for ITS (before CDDTI components)
        gross.equivalentDays,
        1.0,
        monthlyBrackets
      );

      // Verify components exist
      expect(gross.components.length).toBeGreaterThan(0);
      expect(deductions.cnpsEmployee).toBeGreaterThan(0);
      expect(its).toBeGreaterThanOrEqual(0);
    });
  });
});
