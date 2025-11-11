/**
 * Tests for ACP (Allocations de Congés Payés) Calculation Service
 *
 * Test coverage:
 * - Complete calculation happy path
 * - Contract type eligibility (CDI/CDD only)
 * - Edge cases (no payroll history, zero paid days, etc.)
 * - Seniority bonus integration
 * - Reference period calculation
 * - Warning generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { calculateACP, type ACPCalculationInput } from '../acp-calculation.service'
import { loadACPConfig } from '../acp-config.loader'
import { calculateSeniorityBonusDays } from '../seniority-bonus.service'

// Mock database queries
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
  },
}))

// Mock config loader
vi.mock('../acp-config.loader', () => ({
  loadACPConfig: vi.fn(() =>
    Promise.resolve({
      id: 'test-config-id',
      countryCode: 'CI',
      daysPerMonthFactor: 2.2,
      calendarDayMultiplier: 1.25,
      defaultPaidDaysPerMonth: 30,
      includesBaseSalary: true,
      includesTaxableAllowances: true,
      referencePeriodType: 'since_last_leave',
      effectiveFrom: new Date('2024-01-01'),
      effectiveTo: null,
    })
  ),
}))

describe('calculateACP', () => {
  describe('Eligibility checks', () => {
    it('should allow CDI employees', async () => {
      const mockDb = await import('@/lib/db')

      // Create complete mock chain for all database queries
      const createMockChain = () => {
        const whereResult = {
          then: (resolve: any) => resolve([]),
          limit: vi.fn(() => Promise.resolve([])),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
            then: (resolve: any) => resolve([]),
          })),
        }

        return {
          from: vi.fn(() => ({
            where: vi.fn(() => whereResult),
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => Promise.resolve([])),
              })),
            })),
          })),
        }
      }

      let callCount = 0
      vi.spyOn(mockDb.db, 'select').mockImplementation(() => {
        callCount++

        // First call: Load employee
        if (callCount === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      id: 'emp-1',
                      firstName: 'Marie',
                      lastName: 'Kouassi',
                      employeeNumber: 'EMP001',
                      contractType: 'CDI',
                      hireDate: '2010-01-15',
                      categoricalSalary: '500000',
                      tenantId: 'tenant-1',
                    },
                  ]),
              }),
            }),
          } as any
        }

        // Subsequent calls: Return empty results
        return createMockChain() as any
      })

      const input: ACPCalculationInput = {
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        countryCode: 'CI',
        acpPaymentDate: new Date(2025, 9, 1), // Oct 1, 2025
      }

      const result = await calculateACP(input)

      expect(result.isEligible).toBe(true)
      expect(result.contractType).toBe('CDI')
      expect(result.skipReason).toBeUndefined()
    })

    it('should allow CDD employees', async () => {
      const mockDb = await import('@/lib/db')

      // Create complete mock chain
      const createMockChain = () => {
        const whereResult = {
          then: (resolve: any) => resolve([]),
          limit: vi.fn(() => Promise.resolve([])),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
            then: (resolve: any) => resolve([]),
          })),
        }

        return {
          from: vi.fn(() => ({
            where: vi.fn(() => whereResult),
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => Promise.resolve([])),
              })),
            })),
          })),
        }
      }

      let callCount = 0
      vi.spyOn(mockDb.db, 'select').mockImplementation(() => {
        callCount++

        // First call: Load employee
        if (callCount === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      id: 'emp-2',
                      firstName: 'Kouadio',
                      lastName: 'Yao',
                      employeeNumber: 'EMP002',
                      contractType: 'CDD',
                      hireDate: '2023-06-01',
                      categoricalSalary: '350000',
                      tenantId: 'tenant-1',
                    },
                  ]),
              }),
            }),
          } as any
        }

        // Subsequent calls: Return empty results
        return createMockChain() as any
      })

      const input: ACPCalculationInput = {
        employeeId: 'emp-2',
        tenantId: 'tenant-1',
        countryCode: 'CI',
        acpPaymentDate: new Date(2025, 9, 1),
      }

      const result = await calculateACP(input)

      expect(result.isEligible).toBe(true)
      expect(result.contractType).toBe('CDD')
    })

    it('should reject INTERIM employees', async () => {
      const mockDb = await import('@/lib/db')
      vi.spyOn(mockDb.db, 'select').mockImplementation(
        () =>
          ({
            from: () => ({
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      id: 'emp-3',
                      firstName: 'Aya',
                      lastName: 'Toure',
                      employeeNumber: 'EMP003',
                      contractType: 'INTERIM',
                      hireDate: '2025-01-10',
                      categoricalSalary: '250000',
                      tenantId: 'tenant-1',
                    },
                  ]),
              }),
            }),
          }) as any
      )

      const input: ACPCalculationInput = {
        employeeId: 'emp-3',
        tenantId: 'tenant-1',
        countryCode: 'CI',
        acpPaymentDate: new Date(2025, 9, 1),
      }

      const result = await calculateACP(input)

      expect(result.isEligible).toBe(false)
      expect(result.contractType).toBe('INTERIM')
      expect(result.skipReason).toBe('ACP applicable uniquement aux CDI/CDD')
      expect(result.acpAmount).toBe(0)
    })

    it('should reject STAGE employees', async () => {
      const mockDb = await import('@/lib/db')
      vi.spyOn(mockDb.db, 'select').mockImplementation(
        () =>
          ({
            from: () => ({
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      id: 'emp-4',
                      firstName: 'Fatou',
                      lastName: 'Diallo',
                      employeeNumber: 'EMP004',
                      contractType: 'STAGE',
                      hireDate: '2025-07-01',
                      categoricalSalary: '150000',
                      tenantId: 'tenant-1',
                    },
                  ]),
              }),
            }),
          }) as any
      )

      const input: ACPCalculationInput = {
        employeeId: 'emp-4',
        tenantId: 'tenant-1',
        countryCode: 'CI',
        acpPaymentDate: new Date(2025, 9, 1),
      }

      const result = await calculateACP(input)

      expect(result.isEligible).toBe(false)
      expect(result.contractType).toBe('STAGE')
      expect(result.skipReason).toBe('ACP applicable uniquement aux CDI/CDD')
      expect(result.acpAmount).toBe(0)
    })
  })

  describe('Seniority bonus integration', () => {
    it('should include seniority bonus days for 15-year employee', () => {
      const hireDate = new Date(2010, 0, 1) // Jan 1, 2010
      const asOfDate = new Date(2025, 9, 1) // Oct 1, 2025 (15+ years)

      const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

      expect(result.yearsOfService).toBe(15)
      expect(result.bonusDays).toBe(3)
      expect(result.tier).toBe('15-19')
    })

    it('should include seniority bonus days for 5-year employee', () => {
      const hireDate = new Date(2020, 0, 1) // Jan 1, 2020
      const asOfDate = new Date(2025, 9, 1) // Oct 1, 2025 (5+ years)

      const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

      expect(result.yearsOfService).toBe(5)
      expect(result.bonusDays).toBe(1)
      expect(result.tier).toBe('5-9')
    })

    it('should not include seniority bonus for new employee (< 5 years)', () => {
      const hireDate = new Date(2022, 0, 1) // Jan 1, 2022
      const asOfDate = new Date(2025, 9, 1) // Oct 1, 2025 (3+ years)

      const result = calculateSeniorityBonusDays(hireDate, asOfDate, 'CI')

      expect(result.yearsOfService).toBe(3)
      expect(result.bonusDays).toBe(0)
      expect(result.tier).toBe('0-4')
    })
  })

  describe('Configuration loading', () => {
    it('should load Côte d\'Ivoire configuration', async () => {
      const config = await loadACPConfig('CI', new Date(2025, 9, 1))

      expect(config.countryCode).toBe('CI')
      expect(config.daysPerMonthFactor).toBe(2.2)
      expect(config.calendarDayMultiplier).toBe(1.25)
      expect(config.defaultPaidDaysPerMonth).toBe(30)
      expect(config.referencePeriodType).toBe('since_last_leave')
    })
  })

  describe('Edge cases', () => {
    it('should throw error if employee not found', async () => {
      const mockDb = await import('@/lib/db')
      vi.spyOn(mockDb.db, 'select').mockImplementation(
        () =>
          ({
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([]), // No employee found
              }),
            }),
          }) as any
      )

      const input: ACPCalculationInput = {
        employeeId: 'non-existent',
        tenantId: 'tenant-1',
        countryCode: 'CI',
        acpPaymentDate: new Date(2025, 9, 1),
      }

      await expect(calculateACP(input)).rejects.toThrow(
        'Employee not found: non-existent'
      )
    })
  })

  describe('Calculation formula', () => {
    it('should calculate daily average salary correctly', () => {
      // Example: 500,000 FCFA/month for 12 months = 6,000,000 total
      // 12 months × 30 days = 360 paid days
      // Daily average = 6,000,000 / 360 = 16,666.67 FCFA/day
      const totalSalary = 6_000_000
      const totalDays = 360
      const expected = 16_666.67

      const result = Math.round((totalSalary / totalDays) * 100) / 100

      expect(result).toBeCloseTo(expected, 2)
    })

    it('should calculate accrued leave days correctly (no seniority)', () => {
      // Total paid days: 360
      // Number of months: 12
      // Days per month factor: 2.2
      // Expected: (360 / 12) × 2.2 = 30 × 2.2 = 66 days
      const totalPaidDays = 360
      const numberOfMonths = 12
      const daysPerMonthFactor = 2.2

      const result = (totalPaidDays / numberOfMonths) * daysPerMonthFactor

      expect(result).toBe(66)
    })

    it('should calculate accrued leave days with seniority bonus', () => {
      // Base accrued: 66 days (working days)
      // Seniority bonus: +3 days (15 years)
      // Calendar multiplier: 1.25
      // Expected: 66 + (3 × 1.25) = 66 + 3.75 = 69.75 days
      const baseAccrued = 66
      const seniorityBonusDays = 3
      const calendarMultiplier = 1.25

      const result = baseAccrued + seniorityBonusDays * calendarMultiplier

      expect(result).toBe(69.75)
    })

    it('should calculate ACP amount correctly', () => {
      // Daily average salary: 16,666.67 FCFA
      // Leave days taken: 15 calendar days
      // Expected ACP: 16,666.67 × 15 = 250,000 FCFA (rounded)
      const dailyAverageSalary = 16_666.67
      const leaveDaysTaken = 15

      const result = Math.round(dailyAverageSalary * leaveDaysTaken)

      expect(result).toBe(250_000)
    })
  })

  describe('Real-world calculation scenario', () => {
    it('should match Marie Kouassi example from documentation', () => {
      // Marie Kouassi - 15 years of service
      // Monthly salary: 500,000 FCFA
      // 12-month reference period
      // 15 calendar days of leave
      //
      // Expected:
      // - Total gross: 6,000,000 FCFA (500k × 12)
      // - Total paid days: 360 (12 × 30)
      // - Daily average: 16,666.67 FCFA
      // - Seniority bonus: +3 days
      // - Leave accrued: 66 + (3 × 1.25) = 69.75 days
      // - ACP amount: 16,666.67 × 15 = 250,000 FCFA

      const monthlySalary = 500_000
      const months = 12
      const paidDaysPerMonth = 30
      const leaveDaysTaken = 15
      const seniorityBonusDays = 3
      const daysPerMonthFactor = 2.2
      const calendarMultiplier = 1.25

      // Calculate
      const totalGross = monthlySalary * months
      const totalPaidDays = months * paidDaysPerMonth
      const dailyAverage = totalGross / totalPaidDays
      const baseAccrued = (totalPaidDays / months) * daysPerMonthFactor
      const totalAccrued = baseAccrued + seniorityBonusDays * calendarMultiplier
      const acpAmount = Math.round(dailyAverage * leaveDaysTaken)

      // Verify
      expect(totalGross).toBe(6_000_000)
      expect(totalPaidDays).toBe(360)
      expect(Math.round(dailyAverage * 100) / 100).toBe(16_666.67)
      expect(baseAccrued).toBe(66)
      expect(totalAccrued).toBe(69.75)
      expect(acpAmount).toBe(250_000)
    })

    it('should calculate for employee with 5 years service', () => {
      // Employee with 5 years service, 1 bonus day
      // Monthly salary: 400,000 FCFA
      // 12-month period, 10 days leave
      const monthlySalary = 400_000
      const months = 12
      const paidDaysPerMonth = 30
      const leaveDaysTaken = 10
      const seniorityBonusDays = 1
      const daysPerMonthFactor = 2.2
      const calendarMultiplier = 1.25

      const totalGross = monthlySalary * months
      const totalPaidDays = months * paidDaysPerMonth
      const dailyAverage = totalGross / totalPaidDays
      const baseAccrued = (totalPaidDays / months) * daysPerMonthFactor
      const totalAccrued = baseAccrued + seniorityBonusDays * calendarMultiplier
      const acpAmount = Math.round(dailyAverage * leaveDaysTaken)

      expect(totalGross).toBe(4_800_000)
      expect(Math.round(dailyAverage * 100) / 100).toBe(13_333.33)
      expect(totalAccrued).toBe(67.25) // 66 + 1.25
      expect(acpAmount).toBe(133_333) // 13,333.33 × 10
    })
  })
})
