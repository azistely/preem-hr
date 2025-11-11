/**
 * Tests for Seniority Bonus Service
 *
 * Tests Convention Collective Art. 25.2 seniority ladder implementation
 */

import { describe, it, expect } from 'vitest'
import {
  calculateSeniorityBonusDays,
  calculateYearsOfService,
  getSeniorityTierDescription,
  getNextSeniorityMilestone,
} from '../seniority-bonus.service'

describe('seniority-bonus.service', () => {
  describe('calculateYearsOfService', () => {
    it('should calculate full years correctly', () => {
      const hireDate = new Date('2020-01-01')
      const asOfDate = new Date('2025-01-01')

      const years = calculateYearsOfService(hireDate, asOfDate)
      expect(years).toBe(5)
    })

    it('should return floor of years (not round)', () => {
      const hireDate = new Date('2020-01-01')
      const asOfDate = new Date('2025-11-30') // 5 years 11 months

      const years = calculateYearsOfService(hireDate, asOfDate)
      expect(years).toBe(5) // Not 6
    })

    it('should handle leap years correctly', () => {
      const hireDate = new Date('2020-02-29') // Leap year
      const asOfDate = new Date('2025-02-28')

      const years = calculateYearsOfService(hireDate, asOfDate)
      expect(years).toBe(4) // Not quite 5 yet
    })

    it('should return 0 for same date', () => {
      const date = new Date('2025-01-01')
      const years = calculateYearsOfService(date, date)
      expect(years).toBe(0)
    })

    it('should throw error if asOfDate is before hireDate', () => {
      const hireDate = new Date('2025-01-01')
      const asOfDate = new Date('2020-01-01')

      expect(() => calculateYearsOfService(hireDate, asOfDate)).toThrow(
        'As-of date cannot be before hire date'
      )
    })

    it('should throw error for invalid hire date', () => {
      expect(() =>
        calculateYearsOfService(new Date('invalid'), new Date())
      ).toThrow('Invalid hire date')
    })

    it('should throw error for invalid as-of date', () => {
      expect(() =>
        calculateYearsOfService(new Date(), new Date('invalid'))
      ).toThrow('Invalid as-of date')
    })
  })

  describe('calculateSeniorityBonusDays - Côte d\'Ivoire', () => {
    const asOfDate = new Date(2025, 9, 1) // Oct 1, 2025 (month is 0-indexed)

    it('should return 0 bonus for 0-4 years', () => {
      const testCases = [
        { years: 0, hireDate: new Date(2025, 9, 1), expected: 0 },
        { years: 1, hireDate: new Date(2024, 9, 1), expected: 0 },
        { years: 2, hireDate: new Date(2023, 9, 1), expected: 0 },
        { years: 3, hireDate: new Date(2022, 9, 1), expected: 0 },
        { years: 4, hireDate: new Date(2021, 9, 1), expected: 0 },
      ]

      testCases.forEach(({ years, hireDate, expected }) => {
        const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

        expect(result.bonusDays).toBe(expected)
        expect(result.tier).toBe('0-4')
        expect(result.yearsOfService).toBe(years)
      })
    })

    it('should return 1 bonus day for 5-9 years', () => {
      const testCases = [
        { years: 5, hireDate: new Date(2020, 9, 1) },
        { years: 6, hireDate: new Date(2019, 9, 1) },
        { years: 7, hireDate: new Date(2018, 9, 1) },
        { years: 8, hireDate: new Date(2017, 9, 1) },
        { years: 9, hireDate: new Date(2016, 9, 1) },
      ]

      testCases.forEach(({ years, hireDate }) => {
        const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

        expect(result.bonusDays).toBe(1)
        expect(result.tier).toBe('5-9')
        expect(result.yearsOfService).toBe(years)
      })
    })

    it('should return 2 bonus days for 10-14 years', () => {
      const testCases = [
        { years: 10, hireDate: new Date(2015, 9, 1) },
        { years: 11, hireDate: new Date(2014, 9, 1) },
        { years: 12, hireDate: new Date(2013, 9, 1) },
        { years: 13, hireDate: new Date(2012, 9, 1) },
        { years: 14, hireDate: new Date(2011, 9, 1) },
      ]

      testCases.forEach(({ years, hireDate }) => {
        const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

        expect(result.bonusDays).toBe(2)
        expect(result.tier).toBe('10-14')
        expect(result.yearsOfService).toBe(years)
      })
    })

    it('should return 3 bonus days for 15-19 years', () => {
      const testCases = [
        { years: 15, hireDate: new Date(2010, 9, 1) },
        { years: 16, hireDate: new Date(2009, 9, 1) },
        { years: 17, hireDate: new Date(2008, 9, 1) },
        { years: 18, hireDate: new Date(2007, 9, 1) },
        { years: 19, hireDate: new Date(2006, 9, 1) },
      ]

      testCases.forEach(({ years, hireDate }) => {
        const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

        expect(result.bonusDays).toBe(3)
        expect(result.tier).toBe('15-19')
        expect(result.yearsOfService).toBe(years)
      })
    })

    it('should return 5 bonus days for 20-24 years', () => {
      const testCases = [
        { years: 20, hireDate: new Date(2005, 9, 1) },
        { years: 21, hireDate: new Date(2004, 9, 1) },
        { years: 22, hireDate: new Date(2003, 9, 1) },
        { years: 23, hireDate: new Date(2002, 9, 1) },
        { years: 24, hireDate: new Date(2001, 9, 1) },
      ]

      testCases.forEach(({ years, hireDate }) => {
        const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

        expect(result.bonusDays).toBe(5)
        expect(result.tier).toBe('20-24')
        expect(result.yearsOfService).toBe(years)
      })
    })

    it('should return 7 bonus days for 25-29 years', () => {
      const testCases = [
        { years: 25, hireDate: new Date(2000, 9, 1) },
        { years: 26, hireDate: new Date(1999, 9, 1) },
        { years: 27, hireDate: new Date(1998, 9, 1) },
        { years: 28, hireDate: new Date(1997, 9, 1) },
        { years: 29, hireDate: new Date(1996, 9, 1) },
      ]

      testCases.forEach(({ years, hireDate }) => {
        const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

        expect(result.bonusDays).toBe(7)
        expect(result.tier).toBe('25-29')
        expect(result.yearsOfService).toBe(years)
      })
    })

    it('should return 8 bonus days for 30+ years', () => {
      const testCases = [
        { years: 30, hireDate: new Date(1995, 9, 1) },
        { years: 35, hireDate: new Date(1990, 9, 1) },
        { years: 40, hireDate: new Date(1985, 9, 1) },
        { years: 45, hireDate: new Date(1980, 9, 1) },
        { years: 50, hireDate: new Date(1975, 9, 1) },
      ]

      testCases.forEach(({ years, hireDate }) => {
        const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

        expect(result.bonusDays).toBe(8)
        expect(result.tier).toBe('30+')
        expect(result.yearsOfService).toBe(years)
      })
    })

    it('should handle exact threshold dates (5 years exactly)', () => {
      const hireDate = new Date(2020, 9, 1)
      const asOfDate = new Date(2025, 9, 1) // Exactly 5 years

      const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

      expect(result.yearsOfService).toBe(5)
      expect(result.bonusDays).toBe(1)
      expect(result.tier).toBe('5-9')
    })

    it('should handle one day before threshold (4 years 364 days)', () => {
      const hireDate = new Date(2020, 9, 2)
      const asOfDate = new Date(2025, 9, 1) // 1 day before 5 years

      const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

      expect(result.yearsOfService).toBe(4)
      expect(result.bonusDays).toBe(0)
      expect(result.tier).toBe('0-4')
    })
  })

  describe('calculateSeniorityBonusDays - Error Handling', () => {
    it('should throw error for unsupported country', () => {
      const hireDate = new Date('2020-01-01')
      const asOfDate = new Date('2025-01-01')

      expect(() =>
        calculateSeniorityBonusDays(hireDate, asOfDate, 'US')
      ).toThrow('Seniority bonus not configured for country: US')
    })

    it('should use default country (CI) when not specified', () => {
      const hireDate = new Date('2010-01-01')
      const asOfDate = new Date('2025-01-01')

      const result = calculateSeniorityBonusDays(hireDate, asOfDate)

      expect(result.bonusDays).toBe(3) // 15 years = tier 15-19
      expect(result.tier).toBe('15-19')
    })

    it('should use current date when asOfDate not specified', () => {
      const hireDate = new Date()
      hireDate.setFullYear(hireDate.getFullYear() - 10) // 10 years ago

      const result = calculateSeniorityBonusDays(hireDate)

      expect(result.yearsOfService).toBe(10)
      expect(result.bonusDays).toBe(2)
    })
  })

  describe('getSeniorityTierDescription', () => {
    it('should return French description for 0-4 years', () => {
      const description = getSeniorityTierDescription(3, 'CI')
      expect(description).toBe('0-4 ans (aucun jour supplémentaire)')
    })

    it('should return French description for 5-9 years (singular)', () => {
      const description = getSeniorityTierDescription(7, 'CI')
      expect(description).toBe('5-9 ans (1 jour supplémentaire)')
    })

    it('should return French description for 10-14 years (plural)', () => {
      const description = getSeniorityTierDescription(12, 'CI')
      expect(description).toBe('10-14 ans (2 jours supplémentaires)')
    })

    it('should return French description for 15-19 years', () => {
      const description = getSeniorityTierDescription(17, 'CI')
      expect(description).toBe('15-19 ans (3 jours supplémentaires)')
    })

    it('should return French description for 30+ years', () => {
      const description = getSeniorityTierDescription(35, 'CI')
      expect(description).toBe('30+ ans (8 jours supplémentaires)')
    })
  })

  describe('getNextSeniorityMilestone', () => {
    const asOfDate = new Date(2025, 9, 1) // Oct 1, 2025

    it('should return next milestone for employee with 3 years', () => {
      const hireDate = new Date(2022, 9, 1)
      const milestone = getNextSeniorityMilestone(hireDate, asOfDate, 'CI')

      expect(milestone).toEqual({
        currentTier: '0-4',
        currentBonus: 0,
        nextMilestoneYears: 5,
        nextBonus: 1,
        yearsUntilNext: 2,
      })
    })

    it('should return next milestone for employee with 7 years', () => {
      const hireDate = new Date(2018, 9, 1)
      const milestone = getNextSeniorityMilestone(hireDate, asOfDate, 'CI')

      expect(milestone).toEqual({
        currentTier: '5-9',
        currentBonus: 1,
        nextMilestoneYears: 10,
        nextBonus: 2,
        yearsUntilNext: 3,
      })
    })

    it('should return next milestone for employee with 16 years', () => {
      const hireDate = new Date(2009, 9, 1)
      const milestone = getNextSeniorityMilestone(hireDate, asOfDate, 'CI')

      expect(milestone).toEqual({
        currentTier: '15-19',
        currentBonus: 3,
        nextMilestoneYears: 20,
        nextBonus: 5,
        yearsUntilNext: 4,
      })
    })

    it('should return null next milestone for employee with 35 years (max tier)', () => {
      const hireDate = new Date(1990, 9, 1)
      const milestone = getNextSeniorityMilestone(hireDate, asOfDate, 'CI')

      expect(milestone).toEqual({
        currentTier: '30+',
        currentBonus: 8,
        nextMilestoneYears: null,
        nextBonus: null,
        yearsUntilNext: null,
      })
    })

    it('should handle employee exactly at milestone', () => {
      const hireDate = new Date(2015, 9, 1) // Exactly 10 years
      const milestone = getNextSeniorityMilestone(hireDate, asOfDate, 'CI')

      expect(milestone).toEqual({
        currentTier: '10-14',
        currentBonus: 2,
        nextMilestoneYears: 15,
        nextBonus: 3,
        yearsUntilNext: 5,
      })
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle Marie Kouassi example from documentation (15 years)', () => {
      const hireDate = new Date(2010, 4, 1) // May 1, 2010
      const asOfDate = new Date(2025, 9, 1) // Oct 1, 2025

      const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

      expect(result.yearsOfService).toBe(15)
      expect(result.bonusDays).toBe(3)
      expect(result.tier).toBe('15-19')
    })

    it('should calculate correctly for employee hired mid-year', () => {
      const hireDate = new Date(2010, 5, 15) // June 15, 2010
      const asOfDate = new Date(2025, 10, 30) // Nov 30, 2025

      const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

      expect(result.yearsOfService).toBe(15)
      expect(result.bonusDays).toBe(3)
    })

    it('should handle employee about to cross threshold', () => {
      const hireDate = new Date(2016, 0, 1) // Jan 1, 2016
      const asOfDate = new Date(2025, 11, 31) // Dec 31, 2025 - 9 years 364 days

      const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

      expect(result.yearsOfService).toBe(9)
      expect(result.bonusDays).toBe(1)
      expect(result.tier).toBe('5-9')
    })

    it('should handle very long service (50 years)', () => {
      const hireDate = new Date(1975, 0, 1) // Jan 1, 1975
      const asOfDate = new Date(2025, 0, 1) // Jan 1, 2025

      const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

      expect(result.yearsOfService).toBe(50)
      expect(result.bonusDays).toBe(8) // Max tier
      expect(result.tier).toBe('30+')
    })
  })
})
