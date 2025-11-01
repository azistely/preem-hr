/**
 * Tests for Daily Workers (Journaliers) Utility Functions
 *
 * Based on DAILY-WORKERS-ARCHITECTURE-V2.md v3.0 and
 * guide_paie_journaliers_cote_ivoire.md official examples
 */

import { describe, it, expect } from 'vitest';
import {
  calculateHourlyDivisor,
  calculateHourlyRate,
  calculateContributionEmployeur,
  getContributionEmployeurRate,
  getOvertimeThreshold,
  classifyOvertime,
  calculateEquivalentDays,
  suggestWeeklyHoursForSector,
  getClosuresPerMonth,
  isJournalier,
  formatPaymentFrequency,
  type WeeklyHoursRegime,
  type EmployeeType,
  type PaymentFrequency,
} from '../daily-workers-utils';

describe('Daily Workers Utilities', () => {
  describe('calculateHourlyDivisor', () => {
    it('calculates correct divisor for 40h regime (standard)', () => {
      expect(calculateHourlyDivisor('40h')).toBeCloseTo(173.33, 2);
    });

    it('calculates correct divisor for 48h regime (agriculture)', () => {
      expect(calculateHourlyDivisor('48h')).toBe(208);
    });

    it('calculates correct divisor for 56h regime (security)', () => {
      expect(calculateHourlyDivisor('56h')).toBeCloseTo(242.67, 2);
    });

    it('calculates correct divisor for 44h regime (commerce)', () => {
      expect(calculateHourlyDivisor('44h')).toBeCloseTo(190.67, 2);
    });

    it('calculates correct divisor for 52h regime (seasonal)', () => {
      expect(calculateHourlyDivisor('52h')).toBeCloseTo(225.33, 2);
    });
  });

  describe('calculateHourlyRate', () => {
    it('calculates hourly rate for standard 40h worker', () => {
      const hourlyRate = calculateHourlyRate(100_000, '40h');
      expect(hourlyRate).toBeCloseTo(577.0, 0);
    });

    it('calculates hourly rate for agricultural 48h worker', () => {
      const hourlyRate = calculateHourlyRate(100_000, '48h');
      expect(hourlyRate).toBeCloseTo(480.8, 0);
    });

    it('calculates hourly rate for security 56h worker', () => {
      const hourlyRate = calculateHourlyRate(100_000, '56h');
      expect(hourlyRate).toBeCloseTo(412.1, 0);
    });

    it('matches official guide example (75,000 FCFA minimum wage)', () => {
      // Guide example: 75,000 / 173.33 = 432.7 FCFA/hour
      const hourlyRate = calculateHourlyRate(75_000, '40h');
      expect(hourlyRate).toBeCloseTo(432.7, 0);
    });
  });

  describe('calculateContributionEmployeur', () => {
    it('calculates 2.8% for LOCAL employees', () => {
      const contribution = calculateContributionEmployeur(100_000, 'LOCAL');
      expect(contribution).toBe(2_800);
    });

    it('calculates 2.8% for DETACHE employees', () => {
      const contribution = calculateContributionEmployeur(100_000, 'DETACHE');
      expect(contribution).toBe(2_800);
    });

    it('calculates 2.8% for STAGIAIRE', () => {
      const contribution = calculateContributionEmployeur(100_000, 'STAGIAIRE');
      expect(contribution).toBe(2_800);
    });

    it('calculates 12% for EXPAT employees', () => {
      const contribution = calculateContributionEmployeur(100_000, 'EXPAT');
      expect(contribution).toBe(12_000);
    });

    it('handles decimal amounts correctly', () => {
      const contribution = calculateContributionEmployeur(12_300, 'LOCAL');
      expect(contribution).toBeCloseTo(344.4, 1);
    });
  });

  describe('getContributionEmployeurRate', () => {
    it('returns 0.028 for LOCAL', () => {
      expect(getContributionEmployeurRate('LOCAL')).toBe(0.028);
    });

    it('returns 0.028 for DETACHE', () => {
      expect(getContributionEmployeurRate('DETACHE')).toBe(0.028);
    });

    it('returns 0.028 for STAGIAIRE', () => {
      expect(getContributionEmployeurRate('STAGIAIRE')).toBe(0.028);
    });

    it('returns 0.12 for EXPAT', () => {
      expect(getContributionEmployeurRate('EXPAT')).toBe(0.12);
    });
  });

  describe('getOvertimeThreshold', () => {
    it('returns 40 for standard 40h regime', () => {
      expect(getOvertimeThreshold('40h')).toBe(40);
    });

    it('returns 48 for agricultural 48h regime', () => {
      expect(getOvertimeThreshold('48h')).toBe(48);
    });

    it('returns 56 for security 56h regime', () => {
      expect(getOvertimeThreshold('56h')).toBe(56);
    });
  });

  describe('classifyOvertime', () => {
    it('classifies no overtime for 40h worker working exactly 40h', () => {
      const breakdown = classifyOvertime(40, '40h');
      expect(breakdown).toEqual({
        regularHours: 40,
        hours_threshold_to_plus8: 0,
        hours_above_plus8: 0,
      });
    });

    it('classifies 4 hours of overtime (within first 8)', () => {
      const breakdown = classifyOvertime(44, '40h');
      expect(breakdown).toEqual({
        regularHours: 40,
        hours_threshold_to_plus8: 4,
        hours_above_plus8: 0,
      });
    });

    it('classifies 12 hours of overtime (8 hours at 1.15×, 4 hours at 1.50×)', () => {
      const breakdown = classifyOvertime(52, '40h');
      expect(breakdown).toEqual({
        regularHours: 40,
        hours_threshold_to_plus8: 8,
        hours_above_plus8: 4,
      });
    });

    it('classifies overtime for agricultural worker (48h threshold)', () => {
      const breakdown = classifyOvertime(52, '48h');
      expect(breakdown).toEqual({
        regularHours: 48,
        hours_threshold_to_plus8: 4,
        hours_above_plus8: 0,
      });
    });

    it('classifies overtime for security worker (56h threshold)', () => {
      const breakdown = classifyOvertime(60, '56h');
      expect(breakdown).toEqual({
        regularHours: 56,
        hours_threshold_to_plus8: 4,
        hours_above_plus8: 0,
      });
    });

    it('handles worker who worked less than threshold', () => {
      const breakdown = classifyOvertime(35, '40h');
      expect(breakdown).toEqual({
        regularHours: 35,
        hours_threshold_to_plus8: 0,
        hours_above_plus8: 0,
      });
    });
  });

  describe('calculateEquivalentDays', () => {
    it('calculates equivalent days for 30 hours (matches guide example)', () => {
      expect(calculateEquivalentDays(30)).toBe(3.75);
    });

    it('calculates equivalent days for 40 hours (5 days)', () => {
      expect(calculateEquivalentDays(40)).toBe(5);
    });

    it('calculates equivalent days for 8 hours (1 day)', () => {
      expect(calculateEquivalentDays(8)).toBe(1);
    });

    it('handles partial days correctly', () => {
      expect(calculateEquivalentDays(12)).toBe(1.5);
    });
  });

  describe('suggestWeeklyHoursForSector', () => {
    it('suggests 40h for services sector', () => {
      expect(suggestWeeklyHoursForSector('services')).toBe('40h');
    });

    it('suggests 48h for agriculture sector', () => {
      expect(suggestWeeklyHoursForSector('agriculture')).toBe('48h');
      expect(suggestWeeklyHoursForSector('élevage')).toBe('48h');
      expect(suggestWeeklyHoursForSector('pêche')).toBe('48h');
    });

    it('suggests 56h for security sector', () => {
      expect(suggestWeeklyHoursForSector('sécurité')).toBe('56h');
      expect(suggestWeeklyHoursForSector('gardiennage')).toBe('56h');
      expect(suggestWeeklyHoursForSector('domestique')).toBe('56h');
    });

    it('suggests 44h for commerce sector', () => {
      expect(suggestWeeklyHoursForSector('commerce')).toBe('44h');
      expect(suggestWeeklyHoursForSector('retail')).toBe('44h');
    });

    it('suggests 52h for seasonal sector', () => {
      expect(suggestWeeklyHoursForSector('saisonnier')).toBe('52h');
    });

    it('defaults to 40h for unknown sector', () => {
      expect(suggestWeeklyHoursForSector('unknown')).toBe('40h');
      expect(suggestWeeklyHoursForSector(null)).toBe('40h');
      expect(suggestWeeklyHoursForSector(undefined)).toBe('40h');
    });

    it('is case-insensitive', () => {
      expect(suggestWeeklyHoursForSector('AGRICULTURE')).toBe('48h');
      expect(suggestWeeklyHoursForSector('Agriculture')).toBe('48h');
    });
  });

  describe('getClosuresPerMonth', () => {
    it('returns 1 for MONTHLY payment', () => {
      expect(getClosuresPerMonth('MONTHLY')).toBe(1);
    });

    it('returns 2 for BIWEEKLY payment (quinzaines)', () => {
      expect(getClosuresPerMonth('BIWEEKLY')).toBe(2);
    });

    it('returns 4 for WEEKLY payment (semaines)', () => {
      expect(getClosuresPerMonth('WEEKLY')).toBe(4);
    });

    it('returns 30 for DAILY payment (approximate)', () => {
      expect(getClosuresPerMonth('DAILY')).toBe(30);
    });
  });

  describe('isJournalier', () => {
    it('returns false for MONTHLY payment frequency', () => {
      expect(isJournalier('MONTHLY')).toBe(false);
    });

    it('returns true for WEEKLY payment frequency', () => {
      expect(isJournalier('WEEKLY')).toBe(true);
    });

    it('returns true for BIWEEKLY payment frequency', () => {
      expect(isJournalier('BIWEEKLY')).toBe(true);
    });

    it('returns true for DAILY payment frequency', () => {
      expect(isJournalier('DAILY')).toBe(true);
    });
  });

  describe('formatPaymentFrequency', () => {
    it('formats MONTHLY as Mensuel', () => {
      expect(formatPaymentFrequency('MONTHLY')).toBe('Mensuel');
    });

    it('formats BIWEEKLY as Quinzaine', () => {
      expect(formatPaymentFrequency('BIWEEKLY')).toBe('Quinzaine');
    });

    it('formats WEEKLY as Hebdomadaire', () => {
      expect(formatPaymentFrequency('WEEKLY')).toBe('Hebdomadaire');
    });

    it('formats DAILY as Journalier', () => {
      expect(formatPaymentFrequency('DAILY')).toBe('Journalier');
    });
  });

  describe('Integration: Official Guide Example', () => {
    /**
     * From guide_paie_journaliers_cote_ivoire.md:
     * - Categorical salary: 75,000 FCFA
     * - Hours worked: 30h
     * - Hourly rate: 75,000 / 173.33 = 432.7 FCFA/hour
     * - Total brut: 30 × 432.7 = 12,981 FCFA
     * - Equivalent days: 30 / 8 = 3.75 days
     */
    it('matches official guide calculation', () => {
      const categoricalSalary = 75_000;
      const hoursWorked = 30;

      // Step 1: Calculate hourly rate
      const hourlyRate = calculateHourlyRate(categoricalSalary, '40h');
      expect(hourlyRate).toBeCloseTo(432.7, 0);

      // Step 2: Calculate total brut
      const totalBrut = hourlyRate * hoursWorked;
      expect(totalBrut).toBeCloseTo(12_981, 0);

      // Step 3: Calculate equivalent days for ITS
      const equivalentDays = calculateEquivalentDays(hoursWorked);
      expect(equivalentDays).toBe(3.75);

      // Step 4: Calculate contribution employeur (LOCAL)
      const contributionEmployeur = calculateContributionEmployeur(totalBrut, 'LOCAL');
      expect(contributionEmployeur).toBeCloseTo(363.5, 0);
    });
  });
});
