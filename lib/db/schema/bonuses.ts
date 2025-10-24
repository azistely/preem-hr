/**
 * Bonuses Schema - Variable Pay Management
 *
 * Purpose: Track one-time and recurring bonuses/variable pay for employees
 * Use cases:
 * - Performance bonuses (annual, quarterly, monthly)
 * - Holiday bonuses (13th month, Christmas, Eid)
 * - Project completion bonuses
 * - Sales commissions
 * - Other incentive payments
 *
 * Integration:
 * - Bonuses flow into payroll_calculation_v2.ts
 * - Included in gross salary calculations
 * - Subject to tax and social security (configurable)
 * - Tracked in payslip line items
 */

import { pgTable, uuid, varchar, numeric, text, boolean, timestamp, date, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { users } from './users';
import { tenantUser } from './roles';

/**
 * Bonuses table
 */
export const bonuses = pgTable('bonuses', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Bonus classification
  bonusType: varchar('bonus_type', { length: 50 }).notNull(),
  // Types: 'performance', 'holiday', 'project', 'sales_commission', 'attendance', 'retention', 'other'

  // Financial details
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('XOF'),

  // Period this bonus applies to (month-level granularity)
  period: date('period').notNull(), // YYYY-MM-01 format (first day of month)

  // Description and notes
  description: text('description'), // e.g., "Q4 2025 Performance Bonus", "Christmas Bonus 2025"
  notes: text('notes'), // Internal notes

  // Tax and social security treatment
  isTaxable: boolean('is_taxable').notNull().default(true),
  isSubjectToSocialSecurity: boolean('is_subject_to_social_security').notNull().default(true),

  // Approval workflow
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // Status: 'pending' (draft), 'approved' (ready for payroll), 'paid' (included in payroll), 'cancelled'
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectedReason: text('rejected_reason'),

  // Payroll integration
  includedInPayrollRunId: uuid('included_in_payroll_run_id'), // References payroll_runs(id) after payment

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  // RLS Policy: Tenant Isolation
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * Type-safe inferred types
 */
export type Bonus = typeof bonuses.$inferSelect;
export type NewBonus = typeof bonuses.$inferInsert;

/**
 * Bonus Type Enum
 */
export const BonusType = {
  PERFORMANCE: 'performance' as const,
  HOLIDAY: 'holiday' as const,
  PROJECT: 'project' as const,
  SALES_COMMISSION: 'sales_commission' as const,
  ATTENDANCE: 'attendance' as const,
  RETENTION: 'retention' as const,
  OTHER: 'other' as const,
} as const;

export type BonusTypeValue = typeof BonusType[keyof typeof BonusType];

/**
 * Bonus Status Enum
 */
export const BonusStatus = {
  PENDING: 'pending' as const,
  APPROVED: 'approved' as const,
  PAID: 'paid' as const,
  CANCELLED: 'cancelled' as const,
} as const;

export type BonusStatusValue = typeof BonusStatus[keyof typeof BonusStatus];

/**
 * Bonus Type Display Names (French)
 */
export const BonusTypeLabels: Record<BonusTypeValue, string> = {
  performance: 'Prime de performance',
  holiday: 'Prime de fête',
  project: 'Prime de projet',
  sales_commission: 'Commission de vente',
  attendance: 'Prime d\'assiduité',
  retention: 'Prime de fidélité',
  other: 'Autre prime',
};

/**
 * Bonus Status Display Names (French)
 */
export const BonusStatusLabels: Record<BonusStatusValue, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  paid: 'Payée',
  cancelled: 'Annulée',
};
