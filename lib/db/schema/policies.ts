/**
 * Policy Configuration Schema
 *
 * Database schema for:
 * - Overtime rates (multi-country)
 * - Leave accrual rules (age-based, seniority-based)
 *
 * Following Convention Collective compliance with effective dating
 */

import {
  pgTable,
  uuid,
  varchar,
  numeric,
  date,
  timestamp,
  jsonb,
  text,
  integer,
  check,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { countries } from './countries';

// ============================================================================
// Overtime Rates
// ============================================================================

export const overtimeRates = pgTable(
  'overtime_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    countryCode: varchar('country_code', { length: 2 }).notNull(),

    // Period type (what triggers this rate)
    periodType: varchar('period_type', { length: 30 }).notNull(),

    // Rates
    rateMultiplier: numeric('rate_multiplier', { precision: 3, scale: 2 }).notNull(),
    legalMinimum: numeric('legal_minimum', { precision: 3, scale: 2 }).notNull(),

    // Effective dating
    effectiveFrom: date('effective_from').notNull().default(sql`CURRENT_DATE`),
    effectiveTo: date('effective_to'),

    // Metadata
    displayName: jsonb('display_name').notNull().default(sql`'{"fr": "", "en": ""}'::jsonb`),
    description: jsonb('description'),
    legalReference: text('legal_reference'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    countryFk: foreignKey({
      columns: [table.countryCode],
      foreignColumns: [countries.code],
      name: 'overtime_rates_country_code_fkey',
    }).onDelete('restrict'),

    // Indexes
    countryIdx: index('idx_overtime_rates_country').on(table.countryCode),
    effectiveIdx: index('idx_overtime_rates_effective').on(
      table.countryCode,
      table.effectiveFrom,
      table.effectiveTo
    ),

    // Constraints
    validMultiplier: check(
      'valid_multiplier',
      sql`${table.rateMultiplier} >= 1.00 AND ${table.rateMultiplier} <= 3.00`
    ),
    validMinimum: check(
      'valid_legal_minimum',
      sql`${table.legalMinimum} >= 1.00 AND ${table.legalMinimum} <= 3.00`
    ),
    validPeriodType: check(
      'valid_period_type',
      sql`${table.periodType} IN ('weekday_41_48', 'weekday_48_plus', 'saturday', 'sunday', 'holiday', 'night')`
    ),
    validEffectiveDates: check(
      'chk_effective_dates',
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} > ${table.effectiveFrom}`
    ),
  })
);

// ============================================================================
// Leave Accrual Rules
// ============================================================================

export const leaveAccrualRules = pgTable(
  'leave_accrual_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    countryCode: varchar('country_code', { length: 2 }).notNull(),

    // Rule triggers (NULL = applies to all)
    ageThreshold: integer('age_threshold'),
    seniorityYears: integer('seniority_years'),

    // Accrual amounts
    daysPerMonth: numeric('days_per_month', { precision: 3, scale: 1 }).notNull(),
    bonusDays: integer('bonus_days').default(0),

    // Effective dating
    effectiveFrom: date('effective_from').notNull().default(sql`CURRENT_DATE`),
    effectiveTo: date('effective_to'),

    // Metadata
    displayName: jsonb('display_name').default(sql`'{"fr": "", "en": ""}'::jsonb`),
    description: jsonb('description'),
    legalReference: text('legal_reference'),
    priority: integer('priority').default(0),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    countryFk: foreignKey({
      columns: [table.countryCode],
      foreignColumns: [countries.code],
      name: 'leave_accrual_rules_country_code_fkey',
    }).onDelete('restrict'),

    // Indexes
    countryIdx: index('idx_leave_accrual_country').on(table.countryCode),
    ageIdx: index('idx_leave_accrual_age').on(table.countryCode, table.ageThreshold),
    seniorityIdx: index('idx_leave_accrual_seniority').on(
      table.countryCode,
      table.seniorityYears
    ),
    effectiveIdx: index('idx_leave_accrual_effective').on(
      table.countryCode,
      table.effectiveFrom,
      table.effectiveTo
    ),

    // Constraints
    validAgeThreshold: check(
      'valid_age_threshold',
      sql`${table.ageThreshold} IS NULL OR ${table.ageThreshold} > 0`
    ),
    validSeniorityYears: check(
      'valid_seniority_years',
      sql`${table.seniorityYears} IS NULL OR ${table.seniorityYears} >= 0`
    ),
    validDaysPerMonth: check(
      'valid_days_per_month',
      sql`${table.daysPerMonth} >= 0 AND ${table.daysPerMonth} <= 5.0`
    ),
    validBonusDays: check('valid_bonus_days', sql`${table.bonusDays} >= 0`),
    validAccrualRule: check(
      'valid_accrual_rule',
      sql`${table.ageThreshold} IS NOT NULL OR ${table.seniorityYears} IS NOT NULL`
    ),
    validEffectiveDates: check(
      'chk_effective_dates',
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} > ${table.effectiveFrom}`
    ),
  })
);

// ============================================================================
// Types
// ============================================================================

export type OvertimeRate = typeof overtimeRates.$inferSelect;
export type NewOvertimeRate = typeof overtimeRates.$inferInsert;

export type LeaveAccrualRule = typeof leaveAccrualRules.$inferSelect;
export type NewLeaveAccrualRule = typeof leaveAccrualRules.$inferInsert;

// Period types (for type safety)
export const OVERTIME_PERIOD_TYPES = [
  'weekday_41_48',
  'weekday_48_plus',
  'saturday',
  'sunday',
  'holiday',
  'night',
] as const;

export type OvertimePeriodType = (typeof OVERTIME_PERIOD_TYPES)[number];
