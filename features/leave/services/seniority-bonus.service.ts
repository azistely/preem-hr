/**
 * Seniority Bonus Service
 *
 * Calculates additional leave days based on years of service according to
 * Convention Collective Interprofessionnelle (Côte d'Ivoire) Article 25.2
 *
 * @module features/leave/services/seniority-bonus
 */

export interface SeniorityBonusResult {
  yearsOfService: number
  bonusDays: number
  tier: string
}

/**
 * Calculate seniority bonus days based on Convention Collective Art. 25.2
 *
 * Côte d'Ivoire Seniority Ladder:
 * - 0-4 years: 0 additional days
 * - 5-9 years: +1 day
 * - 10-14 years: +2 days
 * - 15-19 years: +3 days
 * - 20-24 years: +5 days
 * - 25-29 years: +7 days
 * - 30+ years: +8 days
 *
 * @param hireDate - Employee's hire date
 * @param asOfDate - Date to calculate seniority as of (default: today)
 * @param countryCode - Country code for seniority rules (default: 'CI')
 * @returns Seniority bonus result with years, days, and tier
 *
 * @example
 * ```typescript
 * const result = calculateSeniorityBonusDays(
 *   new Date('2008-03-15'),
 *   new Date('2025-10-01')
 * )
 * // Result: { yearsOfService: 17, bonusDays: 3, tier: '15-19' }
 * ```
 */
export function calculateSeniorityBonusDays(
  hireDate: Date,
  asOfDate: Date = new Date(),
  countryCode: string = 'CI'
): SeniorityBonusResult {
  const yearsOfService = calculateYearsOfService(hireDate, asOfDate)

  // Côte d'Ivoire seniority ladder (Convention Collective Art. 25.2)
  if (countryCode === 'CI') {
    if (yearsOfService >= 30) {
      return { yearsOfService, bonusDays: 8, tier: '30+' }
    }
    if (yearsOfService >= 25) {
      return { yearsOfService, bonusDays: 7, tier: '25-29' }
    }
    if (yearsOfService >= 20) {
      return { yearsOfService, bonusDays: 5, tier: '20-24' }
    }
    if (yearsOfService >= 15) {
      return { yearsOfService, bonusDays: 3, tier: '15-19' }
    }
    if (yearsOfService >= 10) {
      return { yearsOfService, bonusDays: 2, tier: '10-14' }
    }
    if (yearsOfService >= 5) {
      return { yearsOfService, bonusDays: 1, tier: '5-9' }
    }
    return { yearsOfService, bonusDays: 0, tier: '0-4' }
  }

  // Add other countries as needed
  // Example: Senegal might have different thresholds
  // if (countryCode === 'SN') { ... }

  throw new Error(`Seniority bonus not configured for country: ${countryCode}`)
}

/**
 * Calculate full years of service between two dates
 *
 * @param hireDate - Employee's hire date
 * @param asOfDate - Date to calculate seniority as of
 * @returns Full years of service (floor)
 *
 * @example
 * ```typescript
 * calculateYearsOfService(
 *   new Date('2010-05-15'),
 *   new Date('2025-10-01')
 * )
 * // Returns: 15 (not 15.4)
 * ```
 */
export function calculateYearsOfService(hireDate: Date, asOfDate: Date): number {
  // Validate inputs
  if (!(hireDate instanceof Date) || isNaN(hireDate.getTime())) {
    throw new Error('Invalid hire date')
  }
  if (!(asOfDate instanceof Date) || isNaN(asOfDate.getTime())) {
    throw new Error('Invalid as-of date')
  }
  if (asOfDate < hireDate) {
    throw new Error('As-of date cannot be before hire date')
  }

  // Calculate years by comparing year, month, and day components
  // This is more accurate than millisecond division for exact year boundaries
  let years = asOfDate.getFullYear() - hireDate.getFullYear()

  // Check if birthday/anniversary has not yet occurred this year
  const monthDiff = asOfDate.getMonth() - hireDate.getMonth()
  const dayDiff = asOfDate.getDate() - hireDate.getDate()

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years--
  }

  return years
}

/**
 * Get human-readable seniority tier description
 *
 * @param yearsOfService - Years of service
 * @param countryCode - Country code (default: 'CI')
 * @returns Tier description in French
 *
 * @example
 * ```typescript
 * getSeniorityTierDescription(17, 'CI')
 * // Returns: "15-19 ans (3 jours supplémentaires)"
 * ```
 */
export function getSeniorityTierDescription(
  yearsOfService: number,
  countryCode: string = 'CI'
): string {
  const result = calculateSeniorityBonusDays(
    new Date(new Date().getFullYear() - yearsOfService, 0, 1),
    new Date(),
    countryCode
  )

  if (result.bonusDays === 0) {
    return `${result.tier} ans (aucun jour supplémentaire)`
  }

  const dayLabel = result.bonusDays === 1 ? 'jour supplémentaire' : 'jours supplémentaires'
  return `${result.tier} ans (${result.bonusDays} ${dayLabel})`
}

/**
 * Calculate next seniority milestone
 *
 * @param hireDate - Employee's hire date
 * @param asOfDate - Date to calculate from (default: today)
 * @param countryCode - Country code (default: 'CI')
 * @returns Next milestone info or null if at max tier
 *
 * @example
 * ```typescript
 * getNextSeniorityMilestone(new Date('2013-05-01'))
 * // Returns: {
 * //   currentTier: '10-14',
 * //   currentBonus: 2,
 * //   nextMilestoneYears: 15,
 * //   nextBonus: 3,
 * //   yearsUntilNext: 2
 * // }
 * ```
 */
export function getNextSeniorityMilestone(
  hireDate: Date,
  asOfDate: Date = new Date(),
  countryCode: string = 'CI'
): {
  currentTier: string
  currentBonus: number
  nextMilestoneYears: number | null
  nextBonus: number | null
  yearsUntilNext: number | null
} | null {
  const current = calculateSeniorityBonusDays(hireDate, asOfDate, countryCode)

  if (countryCode === 'CI') {
    const milestones = [
      { years: 5, bonus: 1 },
      { years: 10, bonus: 2 },
      { years: 15, bonus: 3 },
      { years: 20, bonus: 5 },
      { years: 25, bonus: 7 },
      { years: 30, bonus: 8 },
    ]

    // Find next milestone
    const nextMilestone = milestones.find(m => m.years > current.yearsOfService)

    if (!nextMilestone) {
      // Already at max tier
      return {
        currentTier: current.tier,
        currentBonus: current.bonusDays,
        nextMilestoneYears: null,
        nextBonus: null,
        yearsUntilNext: null,
      }
    }

    return {
      currentTier: current.tier,
      currentBonus: current.bonusDays,
      nextMilestoneYears: nextMilestone.years,
      nextBonus: nextMilestone.bonus,
      yearsUntilNext: nextMilestone.years - current.yearsOfService,
    }
  }

  throw new Error(`Seniority milestones not configured for country: ${countryCode}`)
}
