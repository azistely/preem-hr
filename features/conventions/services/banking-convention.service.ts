/**
 * Banking Convention Service (GAP-CONV-BANK-001)
 *
 * Handles banking sector professional levels and seniority bonuses
 */

import 'server-only';
import { db } from '@/lib/db';
import {
  conventionCollectives,
  bankingProfessionalLevels,
  bankingSeniorityBonuses,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { differenceInYears } from 'date-fns';

/**
 * Get banking professional level details
 */
export async function getBankingProfessionalLevel(
  levelNumber: number,
  countryCode: string = 'CI'
) {
  // Get banking convention
  const [convention] = await db
    .select()
    .from(conventionCollectives)
    .where(
      and(
        eq(conventionCollectives.countryCode, countryCode),
        eq(conventionCollectives.conventionCode, 'BANKING'),
        eq(conventionCollectives.isActive, true)
      )
    )
    .limit(1);

  if (!convention) {
    throw new Error(`Banking convention not found for country: ${countryCode}`);
  }

  // Get professional level
  const [level] = await db
    .select()
    .from(bankingProfessionalLevels)
    .where(
      and(
        eq(bankingProfessionalLevels.conventionId, convention.id),
        eq(bankingProfessionalLevels.levelNumber, levelNumber)
      )
    )
    .limit(1);

  if (!level) {
    throw new Error(
      `Banking professional level ${levelNumber} not found for ${countryCode}`
    );
  }

  return {
    conventionId: convention.id,
    levelNumber: level.levelNumber,
    levelName: level.levelName,
    minimumSalary: Number(level.minimumSalary),
    typicalPositions: level.typicalPositions || [],
  };
}

/**
 * Get all banking professional levels for a country
 */
export async function getAllBankingLevels(countryCode: string = 'CI') {
  // Get banking convention
  const [convention] = await db
    .select()
    .from(conventionCollectives)
    .where(
      and(
        eq(conventionCollectives.countryCode, countryCode),
        eq(conventionCollectives.conventionCode, 'BANKING'),
        eq(conventionCollectives.isActive, true)
      )
    )
    .limit(1);

  if (!convention) {
    return [];
  }

  // Get all levels
  const levels = await db
    .select()
    .from(bankingProfessionalLevels)
    .where(eq(bankingProfessionalLevels.conventionId, convention.id))
    .orderBy(bankingProfessionalLevels.levelNumber);

  return levels.map(level => ({
    levelNumber: level.levelNumber,
    levelName: level.levelName,
    minimumSalary: Number(level.minimumSalary),
    typicalPositions: level.typicalPositions || [],
  }));
}

/**
 * Calculate seniority bonus for banking sector employee
 *
 * Banking sector has automatic seniority bonuses:
 * - 3% after 3 years
 * - 6% after 6 years
 * - 9% after 9 years
 * - 12% after 12 years
 * - 15% after 15 years (maximum)
 *
 * @param baseSalary - Employee's base salary
 * @param hireDate - Employee's hire date
 * @param countryCode - Country code (default: CI)
 * @returns Seniority bonus amount
 */
export async function calculateBankingSeniorityBonus(
  baseSalary: number,
  hireDate: Date,
  countryCode: string = 'CI'
): Promise<{
  bonusAmount: number;
  bonusPercentage: number;
  yearsOfService: number;
}> {
  // Calculate years of service
  const yearsOfService = differenceInYears(new Date(), hireDate);

  if (yearsOfService < 3) {
    return {
      bonusAmount: 0,
      bonusPercentage: 0,
      yearsOfService,
    };
  }

  // Get banking convention
  const [convention] = await db
    .select()
    .from(conventionCollectives)
    .where(
      and(
        eq(conventionCollectives.countryCode, countryCode),
        eq(conventionCollectives.conventionCode, 'BANKING'),
        eq(conventionCollectives.isActive, true)
      )
    )
    .limit(1);

  if (!convention) {
    // No banking convention found, return 0
    return {
      bonusAmount: 0,
      bonusPercentage: 0,
      yearsOfService,
    };
  }

  // Get all seniority bonus rules
  const bonusRules = await db
    .select()
    .from(bankingSeniorityBonuses)
    .where(eq(bankingSeniorityBonuses.conventionId, convention.id))
    .orderBy(bankingSeniorityBonuses.yearsOfService);

  // Find the highest applicable bonus
  let applicableBonus = bonusRules
    .filter(rule => yearsOfService >= rule.yearsOfService)
    .sort((a, b) => b.yearsOfService - a.yearsOfService)[0];

  if (!applicableBonus) {
    return {
      bonusAmount: 0,
      bonusPercentage: 0,
      yearsOfService,
    };
  }

  const bonusPercentage = Number(applicableBonus.bonusPercentage);
  const bonusAmount = Math.round(baseSalary * (bonusPercentage / 100));

  return {
    bonusAmount,
    bonusPercentage,
    yearsOfService,
  };
}

/**
 * Validate employee salary against banking level minimum
 *
 * @param salary - Proposed salary
 * @param levelNumber - Professional level (1-9)
 * @param countryCode - Country code
 * @returns Validation result with error message if invalid
 */
export async function validateBankingSalary(
  salary: number,
  levelNumber: number,
  countryCode: string = 'CI'
): Promise<{
  isValid: boolean;
  minimumSalary?: number;
  errorMessage?: string;
}> {
  try {
    const level = await getBankingProfessionalLevel(levelNumber, countryCode);

    if (salary < level.minimumSalary) {
      return {
        isValid: false,
        minimumSalary: level.minimumSalary,
        errorMessage: `Le salaire doit être au moins ${level.minimumSalary.toLocaleString('fr-FR')} FCFA pour le niveau ${level.levelName}`,
      };
    }

    return {
      isValid: true,
      minimumSalary: level.minimumSalary,
    };
  } catch (error) {
    return {
      isValid: false,
      errorMessage: error instanceof Error ? error.message : 'Erreur de validation',
    };
  }
}

/**
 * Get seniority bonus rules for a country
 */
export async function getBankingSeniorityRules(countryCode: string = 'CI') {
  // Get banking convention
  const [convention] = await db
    .select()
    .from(conventionCollectives)
    .where(
      and(
        eq(conventionCollectives.countryCode, countryCode),
        eq(conventionCollectives.conventionCode, 'BANKING'),
        eq(conventionCollectives.isActive, true)
      )
    )
    .limit(1);

  if (!convention) {
    return [];
  }

  // Get all seniority bonus rules
  const rules = await db
    .select()
    .from(bankingSeniorityBonuses)
    .where(eq(bankingSeniorityBonuses.conventionId, convention.id))
    .orderBy(bankingSeniorityBonuses.yearsOfService);

  return rules.map(rule => ({
    yearsOfService: rule.yearsOfService,
    bonusPercentage: Number(rule.bonusPercentage),
  }));
}
