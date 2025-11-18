/**
 * Salary Advances Schema - Short-term Employee Cash Advance Management
 *
 * Purpose: Track salary advance requests, approvals, and automated repayment
 * Use cases:
 * - Emergency employee cash advances (≤ 30% of net salary)
 * - Short-term repayment (1-3 months via payroll deduction)
 * - Policy enforcement (country-specific rules)
 * - Compliance tracking (CI labor law requirements)
 *
 * Integration:
 * - Advances disbursed through payroll_runs
 * - Automatic deductions from monthly payroll
 * - Policy-based validation before approval
 * - Complete audit trail for labor inspections
 *
 * Business Rules (Côte d'Ivoire):
 * - Max advance: 30% of net monthly salary
 * - Interest-free (per labor law Article 31.4)
 * - Repayment period: 1-3 months
 * - Cannot reduce salary below SMIG (75,000 FCFA)
 * - Written employee consent required (digital request)
 */

import { pgTable, uuid, varchar, numeric, integer, text, boolean, timestamp, date, pgPolicy, index, check, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { users } from './users';
import { tenantUser } from './roles';

/**
 * ============================================================================
 * Table: salary_advances
 * Main table tracking all salary advance requests and their lifecycle
 * ============================================================================
 */
export const salaryAdvances = pgTable('salary_advances', {
  // Primary & Relationships
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Financial Details
  requestedAmount: numeric('requested_amount', { precision: 15, scale: 2 }).notNull(),
  approvedAmount: numeric('approved_amount', { precision: 15, scale: 2 }),
  currency: varchar('currency', { length: 3 }).notNull().default('XOF'),

  // Repayment Configuration
  repaymentMonths: integer('repayment_months').notNull().default(1),
  monthlyDeduction: numeric('monthly_deduction', { precision: 15, scale: 2 }),
  totalRepaid: numeric('total_repaid', { precision: 15, scale: 2 }).notNull().default('0'),
  remainingBalance: numeric('remaining_balance', { precision: 15, scale: 2 }),

  // Request Details
  requestDate: timestamp('request_date').notNull().defaultNow(),
  requestReason: text('request_reason').notNull(),
  requestNotes: text('request_notes'),

  // Approval Workflow
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // Status: 'pending', 'approved', 'disbursed', 'active', 'completed', 'rejected', 'cancelled'
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectedBy: uuid('rejected_by').references(() => users.id),
  rejectedAt: timestamp('rejected_at'),
  rejectedReason: text('rejected_reason'),

  // Payroll Integration
  firstDeductionMonth: date('first_deduction_month'), // YYYY-MM-01 format
  disbursementDate: timestamp('disbursement_date'),
  disbursementPayrollRunId: uuid('disbursement_payroll_run_id'), // FK to payroll_runs

  // Employee Snapshot (for audit trail)
  employeeNetSalaryAtRequest: numeric('employee_net_salary_at_request', { precision: 15, scale: 2 }),
  employeeName: varchar('employee_name', { length: 255 }),
  employeeNumber: varchar('employee_number', { length: 50 }),

  // Audit Trail
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  // Indexes for performance
  index('idx_salary_advances_tenant_employee').on(table.tenantId, table.employeeId),
  index('idx_salary_advances_status').on(table.tenantId, table.status),
  index('idx_salary_advances_deduction_month').on(table.firstDeductionMonth),
  index('idx_salary_advances_created_at').on(table.createdAt.desc()),

  // Constraints
  check('valid_amount', sql`${table.requestedAmount} > 0`),
  check('valid_repayment_months', sql`${table.repaymentMonths} BETWEEN 1 AND 12`),

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
 * ============================================================================
 * Table: salary_advance_repayments
 * Individual repayment installments for each advance
 * ============================================================================
 */
export const salaryAdvanceRepayments = pgTable('salary_advance_repayments', {
  // Primary & Relationships
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  salaryAdvanceId: uuid('salary_advance_id').notNull().references(() => salaryAdvances.id, { onDelete: 'cascade' }),

  // Installment Details
  installmentNumber: integer('installment_number').notNull(),
  dueMonth: date('due_month').notNull(), // YYYY-MM-01 format
  plannedAmount: numeric('planned_amount', { precision: 15, scale: 2 }).notNull(),

  // Payment Tracking
  actualAmount: numeric('actual_amount', { precision: 15, scale: 2 }),
  paidDate: timestamp('paid_date'),
  payrollRunId: uuid('payroll_run_id'), // FK to payroll_runs
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // Status: 'pending', 'paid', 'partial', 'missed', 'waived'

  // Notes
  notes: text('notes'),

  // Audit Trail
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  // Indexes
  index('idx_advance_repayments_advance').on(table.salaryAdvanceId),
  index('idx_advance_repayments_due_month').on(table.dueMonth),
  index('idx_advance_repayments_payroll_run').on(table.payrollRunId),

  // Constraints
  check('valid_installment_number', sql`${table.installmentNumber} > 0`),
  check('valid_planned_amount', sql`${table.plannedAmount} > 0`),
  unique('unique_installment').on(table.salaryAdvanceId, table.installmentNumber),

  // RLS Policy: Tenant Isolation
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
  }),
]);

/**
 * ============================================================================
 * Table: salary_advance_policies
 * Country-specific and tenant-specific advance policies
 * ============================================================================
 */
export const salaryAdvancePolicies = pgTable('salary_advance_policies', {
  // Primary & Relationships
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  countryCode: varchar('country_code', { length: 2 }).notNull(),

  // Amount Limits
  maxPercentageOfNetSalary: numeric('max_percentage_of_net_salary', { precision: 5, scale: 2 }).notNull().default('30.00'),
  maxAbsoluteAmount: numeric('max_absolute_amount', { precision: 15, scale: 2 }),
  minAdvanceAmount: numeric('min_advance_amount', { precision: 15, scale: 2 }).default('10000'),

  // Request Limits
  maxOutstandingAdvances: integer('max_outstanding_advances').default(1),
  maxRequestsPerMonth: integer('max_requests_per_month').default(2),

  // Eligibility Rules
  minEmploymentMonths: integer('min_employment_months').default(3),
  allowedRepaymentMonths: integer('allowed_repayment_months').array().default([1, 2, 3]),

  // Workflow Configuration
  requiresManagerApproval: boolean('requires_manager_approval').default(true),
  requiresHrApproval: boolean('requires_hr_approval').default(true),
  autoApproveBelowAmount: numeric('auto_approve_below_amount', { precision: 15, scale: 2 }),

  // Status
  isActive: boolean('is_active').default(true),
  effectiveFrom: date('effective_from').defaultNow(),
  effectiveTo: date('effective_to'),

  // Audit Trail
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => [
  // Indexes
  index('idx_advance_policies_tenant').on(table.tenantId, table.isActive),
  index('idx_advance_policies_country').on(table.countryCode),

  // Constraints
  check('valid_percentage', sql`${table.maxPercentageOfNetSalary} BETWEEN 0 AND 100`),
  check('valid_employment_months', sql`${table.minEmploymentMonths} >= 0`),
  unique('unique_tenant_country_policy').on(table.tenantId, table.countryCode, table.effectiveFrom),

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
 * ============================================================================
 * Type-safe Inferred Types
 * ============================================================================
 */
export type SalaryAdvance = typeof salaryAdvances.$inferSelect;
export type NewSalaryAdvance = typeof salaryAdvances.$inferInsert;

export type SalaryAdvanceRepayment = typeof salaryAdvanceRepayments.$inferSelect;
export type NewSalaryAdvanceRepayment = typeof salaryAdvanceRepayments.$inferInsert;

export type SalaryAdvancePolicy = typeof salaryAdvancePolicies.$inferSelect;
export type NewSalaryAdvancePolicy = typeof salaryAdvancePolicies.$inferInsert;

/**
 * ============================================================================
 * Advance Status Enum
 * ============================================================================
 */
export const AdvanceStatus = {
  PENDING: 'pending' as const,      // Awaiting approval
  APPROVED: 'approved' as const,    // Approved, awaiting disbursement
  DISBURSED: 'disbursed' as const,  // Paid to employee in payroll
  ACTIVE: 'active' as const,        // Being repaid (first deduction processed)
  COMPLETED: 'completed' as const,  // Fully repaid
  REJECTED: 'rejected' as const,    // Request denied
  CANCELLED: 'cancelled' as const,  // Cancelled by employee before approval
} as const;

export type AdvanceStatusValue = typeof AdvanceStatus[keyof typeof AdvanceStatus];

/**
 * Advance Status Display Names (French)
 */
export const AdvanceStatusLabels: Record<AdvanceStatusValue, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  disbursed: 'Déboursée',
  active: 'En cours de remboursement',
  completed: 'Remboursée',
  rejected: 'Rejetée',
  cancelled: 'Annulée',
};

/**
 * ============================================================================
 * Repayment Status Enum
 * ============================================================================
 */
export const RepaymentStatus = {
  PENDING: 'pending' as const,   // Not yet deducted
  PAID: 'paid' as const,         // Fully deducted from payroll
  PARTIAL: 'partial' as const,   // Partially deducted (employee left mid-month)
  MISSED: 'missed' as const,     // No payroll run this month
  WAIVED: 'waived' as const,     // Manually waived by HR
} as const;

export type RepaymentStatusValue = typeof RepaymentStatus[keyof typeof RepaymentStatus];

/**
 * Repayment Status Display Names (French)
 */
export const RepaymentStatusLabels: Record<RepaymentStatusValue, string> = {
  pending: 'En attente',
  paid: 'Payée',
  partial: 'Partielle',
  missed: 'Manquée',
  waived: 'Exonérée',
};

/**
 * ============================================================================
 * Country-Specific Default Policies
 * ============================================================================
 */
export const DefaultAdvancePolicies: Record<string, Partial<NewSalaryAdvancePolicy>> = {
  // Côte d'Ivoire
  CI: {
    countryCode: 'CI',
    maxPercentageOfNetSalary: '30.00',
    minAdvanceAmount: '10000',
    maxOutstandingAdvances: 1,
    maxRequestsPerMonth: 2,
    minEmploymentMonths: 3,
    allowedRepaymentMonths: [1, 2, 3],
    requiresManagerApproval: true,
    requiresHrApproval: true,
  },
  // Sénégal
  SN: {
    countryCode: 'SN',
    maxPercentageOfNetSalary: '30.00',
    minAdvanceAmount: '10000',
    maxOutstandingAdvances: 1,
    maxRequestsPerMonth: 2,
    minEmploymentMonths: 3,
    allowedRepaymentMonths: [1, 2, 3],
    requiresManagerApproval: true,
    requiresHrApproval: true,
  },
  // Burkina Faso (more restrictive)
  BF: {
    countryCode: 'BF',
    maxPercentageOfNetSalary: '25.00',
    minAdvanceAmount: '5000',
    maxOutstandingAdvances: 1,
    maxRequestsPerMonth: 1,
    minEmploymentMonths: 6,
    allowedRepaymentMonths: [1, 2],
    requiresManagerApproval: true,
    requiresHrApproval: true,
  },
};
