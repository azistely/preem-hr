/**
 * ACP (Allocations de Congés Payés) Schema
 * Vacation pay calculation and tracking tables
 */

import { pgTable, uuid, varchar, numeric, integer, boolean, date, timestamp, jsonb, index, foreignKey, unique, uniqueIndex, pgPolicy, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { countries } from './countries';
import { tenants } from './tenants';
import { employees } from './employees';
import { users } from './users';
import { payrollRuns } from './payroll';

/**
 * ACP Configuration Table
 * Country-specific configuration for ACP calculation parameters
 */
export const acpConfiguration = pgTable('acp_configuration', {
  id: uuid('id').defaultRandom().primaryKey(),
  countryCode: varchar('country_code', { length: 2 }).notNull().references(() => countries.code, { onUpdate: 'cascade', onDelete: 'restrict' }),
  daysPerMonthFactor: numeric('days_per_month_factor', { precision: 3, scale: 1 }).default('2.2').notNull(),
  calendarDayMultiplier: numeric('calendar_day_multiplier', { precision: 3, scale: 2 }).default('1.25').notNull(),
  defaultPaidDaysPerMonth: integer('default_paid_days_per_month').default(30).notNull(),
  includesBaseSalary: boolean('includes_base_salary').default(true).notNull(),
  includesTaxableAllowances: boolean('includes_taxable_allowances').default(true).notNull(),
  includesNonTaxableAllowances: boolean('includes_non_taxable_allowances').default(false).notNull(),
  includesBonuses: boolean('includes_bonuses').default(false).notNull(),
  includesOvertime: boolean('includes_overtime').default(false).notNull(),
  referencePeriodType: varchar('reference_period_type', { length: 20 }).default('since_last_leave').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => ({
  countryIdx: index('idx_acp_config_country').on(table.countryCode),
  effectiveIdx: index('idx_acp_config_effective').on(table.countryCode, table.effectiveFrom),
  uniqueCountryEffective: unique('acp_configuration_country_code_effective_from_key').on(table.countryCode, table.effectiveFrom),
  validMultiplierCheck: check('acp_config_valid_multiplier', sql`(${table.calendarDayMultiplier} >= 1.0) AND (${table.calendarDayMultiplier} <= 2.0)`),
  validDaysFactorCheck: check('acp_config_valid_days_factor', sql`(${table.daysPerMonthFactor} >= 0) AND (${table.daysPerMonthFactor} <= 5.0)`),
  validReferencePeriodCheck: check('acp_config_valid_reference_period', sql`${table.referencePeriodType} = ANY (ARRAY['since_last_leave'::text, 'calendar_year'::text, 'rolling_12_months'::text])`),
}));

/**
 * ACP Payment History Table
 * Complete audit trail of all ACP payments with calculation breakdown
 */
export const acpPaymentHistory = pgTable('acp_payment_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  payrollRunId: uuid('payroll_run_id').notNull().references(() => payrollRuns.id, { onDelete: 'cascade' }),
  referencePeriodStart: date('reference_period_start').notNull(),
  referencePeriodEnd: date('reference_period_end').notNull(),
  numberOfMonths: numeric('number_of_months', { precision: 5, scale: 2 }).notNull(),
  totalGrossTaxableSalary: numeric('total_gross_taxable_salary', { precision: 15, scale: 2 }).notNull(),
  totalPaidDays: integer('total_paid_days').notNull(),
  nonDeductibleAbsenceDays: integer('non_deductible_absence_days').default(0).notNull(),
  dailyAverageSalary: numeric('daily_average_salary', { precision: 15, scale: 2 }).notNull(),
  leaveDaysAccruedBase: numeric('leave_days_accrued_base', { precision: 5, scale: 2 }).notNull(),
  seniorityBonusDays: integer('seniority_bonus_days').default(0).notNull(),
  leaveDaysAccruedTotal: numeric('leave_days_accrued_total', { precision: 5, scale: 2 }).notNull(),
  leaveDaysTakenCalendar: numeric('leave_days_taken_calendar', { precision: 5, scale: 2 }).notNull(),
  acpAmount: numeric('acp_amount', { precision: 15, scale: 2 }).notNull(),
  acpConfigurationId: uuid('acp_configuration_id').references(() => acpConfiguration.id),
  calculationMetadata: jsonb('calculation_metadata').default({}).notNull(),
  warnings: jsonb('warnings').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => ({
  tenantIdx: index('idx_acp_history_tenant').on(table.tenantId),
  employeeIdx: index('idx_acp_history_employee').on(table.employeeId),
  payrollRunIdx: index('idx_acp_history_payroll_run').on(table.payrollRunId),
  createdIdx: index('idx_acp_history_created').on(table.createdAt),
  referencePeriodIdx: index('idx_acp_history_reference_period').on(table.referencePeriodStart, table.referencePeriodEnd),
  uniquePaymentIdx: uniqueIndex('idx_acp_history_unique_payment').on(table.employeeId, table.payrollRunId),
  tenantIsolationPolicy: pgPolicy('acp_history_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: ['public'],
    using: sql`(((${table.tenantId})::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`,
    withCheck: sql`(((${table.tenantId})::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`,
  }),
  acpAmountCheck: check('chk_acp_amount_non_negative', sql`${table.acpAmount} >= 0`),
  dailySalaryCheck: check('chk_daily_salary_positive', sql`${table.dailyAverageSalary} > 0`),
  monthsCheck: check('chk_months_positive', sql`${table.numberOfMonths} > 0`),
  referencePeriodCheck: check('chk_reference_period_valid', sql`${table.referencePeriodEnd} >= ${table.referencePeriodStart}`),
}));
