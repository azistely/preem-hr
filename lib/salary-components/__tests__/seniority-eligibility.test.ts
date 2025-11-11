/**
 * Tests for seniority bonus contract type eligibility
 *
 * Verifies that CDDTI, INTERIM, and STAGE contracts do NOT receive
 * prime d'ancienneté in Côte d'Ivoire, while CDI and CDD contracts do.
 */

import { describe, it, expect } from 'vitest';
import { calculateSeniorityBonus } from '../component-calculator';

describe('Seniority Bonus Contract Type Eligibility (Côte d\'Ivoire)', () => {
  const baseSalary = 500000; // FCFA
  const hireDate = new Date('2020-01-01'); // 5+ years of service
  const currentDate = new Date('2025-11-10');

  describe('Eligible Contract Types (CDI, CDD)', () => {
    it('should calculate seniority bonus for CDI contracts in CI', async () => {
      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate,
        currentDate,
        countryCode: 'CI',
        contractType: 'CDI',
      });

      expect(result.yearsOfService).toBe(5);
      expect(result.amount).toBeGreaterThan(0);
      expect(result.rate).toBeGreaterThan(0);
    });

    it('should calculate seniority bonus for CDD contracts in CI', async () => {
      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate,
        currentDate,
        countryCode: 'CI',
        contractType: 'CDD',
      });

      expect(result.yearsOfService).toBe(5);
      expect(result.amount).toBeGreaterThan(0);
      expect(result.rate).toBeGreaterThan(0);
    });
  });

  describe('Ineligible Contract Types (CDDTI, INTERIM, STAGE)', () => {
    it('should NOT calculate seniority bonus for CDDTI contracts in CI', async () => {
      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate,
        currentDate,
        countryCode: 'CI',
        contractType: 'CDDTI',
      });

      expect(result.yearsOfService).toBe(5); // Years of service still calculated
      expect(result.amount).toBe(0); // But amount is zero
      expect(result.rate).toBe(0); // And rate is zero
      expect(result.isCapped).toBe(false);
    });

    it('should NOT calculate seniority bonus for INTERIM contracts in CI', async () => {
      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate,
        currentDate,
        countryCode: 'CI',
        contractType: 'INTERIM',
      });

      expect(result.yearsOfService).toBe(5);
      expect(result.amount).toBe(0);
      expect(result.rate).toBe(0);
    });

    it('should NOT calculate seniority bonus for STAGE contracts in CI', async () => {
      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate,
        currentDate,
        countryCode: 'CI',
        contractType: 'STAGE',
      });

      expect(result.yearsOfService).toBe(5);
      expect(result.amount).toBe(0);
      expect(result.rate).toBe(0);
    });
  });

  describe('Other Countries (No Contract Type Restriction)', () => {
    it('should calculate seniority bonus for CDDTI in Senegal (SN)', async () => {
      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate,
        currentDate,
        countryCode: 'SN',
        contractType: 'CDDTI',
      });

      expect(result.yearsOfService).toBe(5);
      expect(result.amount).toBeGreaterThan(0); // Should calculate in SN
      expect(result.rate).toBeGreaterThan(0);
    });

    it('should calculate seniority bonus for INTERIM in Burkina Faso (BF)', async () => {
      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate,
        currentDate,
        countryCode: 'BF',
        contractType: 'INTERIM',
      });

      expect(result.yearsOfService).toBe(5);
      expect(result.amount).toBeGreaterThan(0); // Should calculate in BF
      expect(result.rate).toBeGreaterThan(0);
    });

    it('should calculate seniority bonus for all contract types when countryCode is not CI', async () => {
      const contractTypes: Array<'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE'> = [
        'CDI',
        'CDD',
        'CDDTI',
        'INTERIM',
        'STAGE',
      ];

      for (const contractType of contractTypes) {
        const result = await calculateSeniorityBonus({
          baseSalary,
          hireDate,
          currentDate,
          countryCode: 'ML', // Mali
          contractType,
        });

        expect(result.amount).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing contractType (allow seniority for backward compatibility)', async () => {
      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate,
        currentDate,
        countryCode: 'CI',
        // contractType not provided
      });

      expect(result.yearsOfService).toBe(5);
      expect(result.amount).toBeGreaterThan(0); // Should calculate when type is unknown
    });

    it('should respect minimum years requirement even for eligible contract types', async () => {
      const recentHireDate = new Date('2024-01-01'); // Only 1 year

      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate: recentHireDate,
        currentDate,
        countryCode: 'CI',
        contractType: 'CDI',
      });

      expect(result.yearsOfService).toBe(1);
      expect(result.amount).toBe(0); // Not enough years of service
    });

    it('should exclude CDDTI even with 10+ years of service in CI', async () => {
      const longAgoHireDate = new Date('2010-01-01'); // 15+ years

      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate: longAgoHireDate,
        currentDate,
        countryCode: 'CI',
        contractType: 'CDDTI',
      });

      expect(result.yearsOfService).toBe(15);
      expect(result.amount).toBe(0); // Still zero despite long service
      expect(result.rate).toBe(0);
    });
  });

  describe('Calculation Accuracy for Eligible Types', () => {
    it('should calculate correct rate for 2 years (CDI)', async () => {
      const twoYearsDate = new Date('2023-01-01');

      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate: twoYearsDate,
        currentDate,
        countryCode: 'CI',
        contractType: 'CDI',
      });

      expect(result.yearsOfService).toBe(2);
      expect(result.rate).toBe(0.02); // 2% for 2 years
      expect(result.amount).toBe(Math.round(baseSalary * 0.02));
    });

    it('should calculate correct rate for 5 years (CDD)', async () => {
      const fiveYearsDate = new Date('2020-01-01');

      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate: fiveYearsDate,
        currentDate,
        countryCode: 'CI',
        contractType: 'CDD',
      });

      expect(result.yearsOfService).toBe(5);
      // Base 2% + (5-2) * 1% = 2% + 3% = 5%
      expect(result.rate).toBe(0.05);
      expect(result.amount).toBe(Math.round(baseSalary * 0.05));
    });

    it('should cap rate at 25% for CDI even with 30+ years', async () => {
      const thirtyYearsDate = new Date('1990-01-01');

      const result = await calculateSeniorityBonus({
        baseSalary,
        hireDate: thirtyYearsDate,
        currentDate,
        countryCode: 'CI',
        contractType: 'CDI',
      });

      expect(result.yearsOfService).toBeGreaterThanOrEqual(30);
      expect(result.rate).toBe(0.25); // Capped at 25%
      expect(result.isCapped).toBe(true);
      expect(result.amount).toBe(Math.round(baseSalary * 0.25));
    });
  });
});
