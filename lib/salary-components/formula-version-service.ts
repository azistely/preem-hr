/**
 * Formula Version Service
 *
 * Manages formula version tracking for salary components.
 * Provides API for creating, retrieving, and managing formula versions.
 *
 * Use cases:
 * - Track formula changes over time (audit compliance)
 * - "What formula was used on date X?" (historical payroll)
 * - Compare formula versions
 * - Rollback to previous formula version
 */

import { db } from '@/lib/db';
import { salaryComponentFormulaVersions } from '@/drizzle/schema';
import { eq, and, lte, gte, or, isNull, desc, sql } from 'drizzle-orm';
import type { CalculationRule, ComponentMetadata } from '@/features/employees/types/salary-components';

// ============================================================================
// Types
// ============================================================================

export type ComponentType = 'standard' | 'custom';

export interface FormulaVersion {
  id: string;
  componentId: string;
  componentType: ComponentType;
  versionNumber: number;
  calculationRule: CalculationRule | null | undefined;
  effectiveFrom: string; // ISO date
  effectiveTo: string | null;
  changedBy: string | null;
  changeReason: string | null;
  createdAt: string;
}

export interface CreateFormulaVersionInput {
  componentId: string;
  componentType: ComponentType;
  calculationRule: CalculationRule | null | undefined;
  changedBy: string;
  changeReason?: string;
  effectiveFrom?: string; // ISO date, defaults to today
}

export interface GetActiveFormulaInput {
  componentId: string;
  componentType: ComponentType;
  asOfDate?: string; // ISO date, defaults to today
}

export interface GetVersionHistoryInput {
  componentId: string;
  componentType: ComponentType;
  limit?: number;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get the active formula version for a component at a specific date
 *
 * @example
 * const formula = await getActiveFormulaVersion({
 *   componentId: 'uuid',
 *   componentType: 'custom',
 *   asOfDate: '2025-01-15'
 * });
 */
export async function getActiveFormulaVersion(
  input: GetActiveFormulaInput
): Promise<FormulaVersion | null> {
  const { componentId, componentType, asOfDate } = input;
  const targetDate = asOfDate || new Date().toISOString().split('T')[0];

  const versions = await db
    .select()
    .from(salaryComponentFormulaVersions)
    .where(
      and(
        eq(salaryComponentFormulaVersions.componentId, componentId),
        eq(salaryComponentFormulaVersions.componentType, componentType),
        lte(salaryComponentFormulaVersions.effectiveFrom, targetDate),
        or(
          isNull(salaryComponentFormulaVersions.effectiveTo),
          gte(salaryComponentFormulaVersions.effectiveTo, targetDate)
        )
      )
    )
    .orderBy(desc(salaryComponentFormulaVersions.versionNumber))
    .limit(1);

  if (versions.length === 0) return null;

  const version = versions[0];
  return {
    id: version.id,
    componentId: version.componentId,
    componentType: version.componentType as ComponentType,
    versionNumber: version.versionNumber,
    calculationRule: version.calculationRule as CalculationRule | null | undefined,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    changedBy: version.changedBy,
    changeReason: version.changeReason,
    createdAt: version.createdAt,
  };
}

/**
 * Create a new formula version
 *
 * This function:
 * 1. Calculates next version number
 * 2. Closes previous active version (sets effectiveTo)
 * 3. Inserts new version
 *
 * @example
 * await createFormulaVersion({
 *   componentId: 'uuid',
 *   componentType: 'custom',
 *   calculationRule: { type: 'percentage', rate: 0.15 },
 *   changedBy: 'user-uuid',
 *   changeReason: 'Increased from 10% to 15% per HR policy update'
 * });
 */
export async function createFormulaVersion(
  input: CreateFormulaVersionInput
): Promise<FormulaVersion> {
  const {
    componentId,
    componentType,
    calculationRule,
    changedBy,
    changeReason,
    effectiveFrom,
  } = input;

  const effectiveDate = effectiveFrom || new Date().toISOString().split('T')[0];

  return await db.transaction(async (tx) => {
    // 1. Get next version number
    const existingVersions = await tx
      .select({ versionNumber: salaryComponentFormulaVersions.versionNumber })
      .from(salaryComponentFormulaVersions)
      .where(
        and(
          eq(salaryComponentFormulaVersions.componentId, componentId),
          eq(salaryComponentFormulaVersions.componentType, componentType)
        )
      )
      .orderBy(desc(salaryComponentFormulaVersions.versionNumber))
      .limit(1);

    const nextVersionNumber =
      existingVersions.length > 0 ? existingVersions[0].versionNumber + 1 : 1;

    // 2. Close previous active version (if any)
    // Set effectiveTo to the day before the new version's effectiveFrom
    const previousDayDate = new Date(effectiveDate);
    previousDayDate.setDate(previousDayDate.getDate() - 1);
    const previousDay = previousDayDate.toISOString().split('T')[0];

    await tx
      .update(salaryComponentFormulaVersions)
      .set({ effectiveTo: previousDay })
      .where(
        and(
          eq(salaryComponentFormulaVersions.componentId, componentId),
          eq(salaryComponentFormulaVersions.componentType, componentType),
          isNull(salaryComponentFormulaVersions.effectiveTo),
          sql`${salaryComponentFormulaVersions.effectiveFrom} < ${effectiveDate}`
        )
      );

    // 3. Insert new version
    const newVersions = await tx
      .insert(salaryComponentFormulaVersions)
      .values({
        componentId,
        componentType,
        versionNumber: nextVersionNumber,
        calculationRule: calculationRule as any,
        effectiveFrom: effectiveDate,
        effectiveTo: null,
        changedBy,
        changeReason: changeReason || null,
      })
      .returning();

    const newVersion = newVersions[0];

    return {
      id: newVersion.id,
      componentId: newVersion.componentId,
      componentType: newVersion.componentType as ComponentType,
      versionNumber: newVersion.versionNumber,
      calculationRule: newVersion.calculationRule as CalculationRule | null | undefined,
      effectiveFrom: newVersion.effectiveFrom,
      effectiveTo: newVersion.effectiveTo,
      changedBy: newVersion.changedBy,
      changeReason: newVersion.changeReason,
      createdAt: newVersion.createdAt,
    };
  });
}

/**
 * Get version history for a component
 *
 * Returns all versions sorted by version number (newest first)
 *
 * @example
 * const history = await getVersionHistory({
 *   componentId: 'uuid',
 *   componentType: 'custom',
 *   limit: 10
 * });
 */
export async function getVersionHistory(
  input: GetVersionHistoryInput
): Promise<FormulaVersion[]> {
  const { componentId, componentType, limit = 50 } = input;

  const versions = await db
    .select()
    .from(salaryComponentFormulaVersions)
    .where(
      and(
        eq(salaryComponentFormulaVersions.componentId, componentId),
        eq(salaryComponentFormulaVersions.componentType, componentType)
      )
    )
    .orderBy(desc(salaryComponentFormulaVersions.versionNumber))
    .limit(limit);

  return versions.map((v) => ({
    id: v.id,
    componentId: v.componentId,
    componentType: v.componentType as ComponentType,
    versionNumber: v.versionNumber,
    calculationRule: v.calculationRule as CalculationRule | null | undefined,
    effectiveFrom: v.effectiveFrom,
    effectiveTo: v.effectiveTo,
    changedBy: v.changedBy,
    changeReason: v.changeReason,
    createdAt: v.createdAt,
  }));
}

/**
 * Get specific version by version number
 *
 * @example
 * const version = await getVersionByNumber({
 *   componentId: 'uuid',
 *   componentType: 'custom',
 *   versionNumber: 3
 * });
 */
export async function getVersionByNumber(input: {
  componentId: string;
  componentType: ComponentType;
  versionNumber: number;
}): Promise<FormulaVersion | null> {
  const { componentId, componentType, versionNumber } = input;

  const versions = await db
    .select()
    .from(salaryComponentFormulaVersions)
    .where(
      and(
        eq(salaryComponentFormulaVersions.componentId, componentId),
        eq(salaryComponentFormulaVersions.componentType, componentType),
        eq(salaryComponentFormulaVersions.versionNumber, versionNumber)
      )
    )
    .limit(1);

  if (versions.length === 0) return null;

  const version = versions[0];
  return {
    id: version.id,
    componentId: version.componentId,
    componentType: version.componentType as ComponentType,
    versionNumber: version.versionNumber,
    calculationRule: version.calculationRule as CalculationRule | null | undefined,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    changedBy: version.changedBy,
    changeReason: version.changeReason,
    createdAt: version.createdAt,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a component has version history
 *
 * @example
 * const hasHistory = await hasVersionHistory({
 *   componentId: 'uuid',
 *   componentType: 'custom'
 * });
 */
export async function hasVersionHistory(input: {
  componentId: string;
  componentType: ComponentType;
}): Promise<boolean> {
  const { componentId, componentType } = input;

  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(salaryComponentFormulaVersions)
    .where(
      and(
        eq(salaryComponentFormulaVersions.componentId, componentId),
        eq(salaryComponentFormulaVersions.componentType, componentType)
      )
    );

  return count[0]?.count > 0;
}

/**
 * Compare two formula versions
 *
 * Returns a comparison object showing differences
 *
 * @example
 * const comparison = compareVersions(version1, version2);
 */
export function compareVersions(
  version1: FormulaVersion,
  version2: FormulaVersion
): {
  type: { changed: boolean; from: string; to: string };
  rate?: { changed: boolean; from: number; to: number };
  cap?: { changed: boolean; from: number; to: number };
  baseAmount?: { changed: boolean; from: number; to: number };
} {
  const rule1 = version1.calculationRule;
  const rule2 = version2.calculationRule;

  const comparison: any = {
    type: {
      changed: rule1?.type !== rule2?.type,
      from: rule1?.type || 'none',
      to: rule2?.type || 'none',
    },
  };

  if (rule1?.type === 'percentage' && rule2?.type === 'percentage') {
    comparison.rate = {
      changed: rule1.rate !== rule2.rate,
      from: rule1.rate || 0,
      to: rule2.rate || 0,
    };
  }

  if (rule1?.type === 'auto-calculated' && rule2?.type === 'auto-calculated') {
    comparison.rate = {
      changed: rule1.rate !== rule2.rate,
      from: rule1.rate || 0,
      to: rule2.rate || 0,
    };
    comparison.cap = {
      changed: rule1.cap !== rule2.cap,
      from: rule1.cap || 0,
      to: rule2.cap || 0,
    };
  }

  if (rule1?.type === 'fixed' && rule2?.type === 'fixed') {
    comparison.baseAmount = {
      changed: rule1.baseAmount !== rule2.baseAmount,
      from: rule1.baseAmount || 0,
      to: rule2.baseAmount || 0,
    };
  }

  return comparison;
}
