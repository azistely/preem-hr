import { pgTable, uuid, date, timestamp, text, numeric, jsonb, pgPolicy, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { countries } from './countries';
import { tenantUser } from './roles';

export const payrollRuns = pgTable('payroll_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Run identification
  runNumber: text('run_number').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),

  // Payroll metadata
  name: text('name'), // "Paie Janvier 2025"
  description: text('description'),
  payDate: date('pay_date').notNull(),
  paymentMethod: text('payment_method').notNull().default('bank_transfer'),

  // Country for tax/contribution rules
  countryCode: text('country_code').notNull().references(() => countries.code),

  // Payment frequency and closure tracking (for daily/weekly/biweekly workers)
  paymentFrequency: text('payment_frequency').notNull().default('MONTHLY'), // DAILY, WEEKLY, BIWEEKLY, MONTHLY
  closureSequence: integer('closure_sequence'), // 1-4 for WEEKLY, 1-2 for BIWEEKLY, NULL for MONTHLY

  // Status tracking (draft, calculating, calculated, approved, paid, failed)
  status: text('status').notNull().default('draft'),

  // Processing metadata
  calculatedAt: timestamp('calculated_at'),
  approvedAt: timestamp('approved_at'),
  approvedBy: uuid('approved_by'), // References users(id)
  paidAt: timestamp('paid_at'),
  processedAt: timestamp('processed_at'),
  processedBy: uuid('processed_by'), // References users(id)

  // Totals (computed from line items)
  employeeCount: integer('employee_count'),
  totalGross: numeric('total_gross', { precision: 15, scale: 2 }),
  totalNet: numeric('total_net', { precision: 15, scale: 2 }),
  totalTax: numeric('total_tax', { precision: 15, scale: 2 }),
  totalEmployeeContributions: numeric('total_employee_contributions', { precision: 15, scale: 2 }),
  totalEmployerContributions: numeric('total_employer_contributions', { precision: 15, scale: 2 }),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'), // References users(id)
  updatedBy: uuid('updated_by'), // References users(id)
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

export const payrollLineItems = pgTable('payroll_line_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  payrollRunId: uuid('payroll_run_id').notNull().references(() => payrollRuns.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Denormalized employee info (for historical accuracy)
  employeeName: text('employee_name'),
  employeeNumber: text('employee_number'),
  positionTitle: text('position_title'),

  // Salary information
  baseSalary: numeric('base_salary', { precision: 15, scale: 2 }).notNull(),
  allowances: jsonb('allowances').notNull().default({}),

  // Time tracking
  daysWorked: numeric('days_worked', { precision: 5, scale: 2 }).notNull(),
  daysAbsent: numeric('days_absent', { precision: 5, scale: 2 }).notNull().default('0'),
  hoursWorked: numeric('hours_worked', { precision: 6, scale: 2 }).default('0'),
  overtimeHours: jsonb('overtime_hours').notNull().default({}),

  // Earnings
  overtimePay: numeric('overtime_pay', { precision: 15, scale: 2 }).default('0'),
  bonuses: numeric('bonuses', { precision: 15, scale: 2 }).default('0'),
  grossSalary: numeric('gross_salary', { precision: 15, scale: 2 }).notNull(),
  brutImposable: numeric('brut_imposable', { precision: 15, scale: 2 }), // Taxable gross (for cumulative AT/PF ceiling)
  earningsDetails: jsonb('earnings_details').notNull().default('[]'),

  // Deductions
  taxDeductions: jsonb('tax_deductions').notNull().default({}),
  employeeContributions: jsonb('employee_contributions').notNull().default({}),
  otherDeductions: jsonb('other_deductions').notNull().default({}),
  deductionsDetails: jsonb('deductions_details').notNull().default('[]'),

  // Individual contribution fields
  cnpsEmployee: numeric('cnps_employee', { precision: 15, scale: 2 }),
  cmuEmployee: numeric('cmu_employee', { precision: 15, scale: 2 }),
  its: numeric('its', { precision: 15, scale: 2 }),

  // Net calculation
  totalDeductions: numeric('total_deductions', { precision: 15, scale: 2 }).notNull(),
  netSalary: numeric('net_salary', { precision: 15, scale: 2 }).notNull(),

  // Employer costs
  employerContributions: jsonb('employer_contributions').notNull().default({}),
  cnpsEmployer: numeric('cnps_employer', { precision: 15, scale: 2 }),
  cmuEmployer: numeric('cmu_employer', { precision: 15, scale: 2 }),

  // Other taxes (country-agnostic: FDFP for CI, 3FPT for SN, etc.)
  totalOtherTaxes: numeric('total_other_taxes', { precision: 15, scale: 2 }).default('0'),
  otherTaxesDetails: jsonb('other_taxes_details').notNull().default('[]'),
  // Example: [{"code": "fdfp_tap", "name": "TAP (FDFP)", "amount": 526, "rate": 0.004}]

  // Contribution details (detailed breakdown of CNPS/CMU for UI display: Pension, AT, PF, etc.)
  contributionDetails: jsonb('contribution_details').notNull().default('[]'),
  // Example: [{"code": "pension", "name": "Retraite", "amount": 574, "paidBy": "employer", "rate": 0.077, "base": 7450}]

  totalEmployerCost: numeric('total_employer_cost', { precision: 15, scale: 2 }).notNull(),
  employerCost: numeric('employer_cost', { precision: 15, scale: 2 }),

  // Calculation context (for auditability and exact reproduction)
  calculationContext: jsonb('calculation_context').notNull().default('{}'),
  // Stores all input parameters: employeeContext, employmentContext, salaryContext, timeContext, calculationMeta

  // Payment details
  paymentMethod: text('payment_method').notNull().default('bank_transfer'),
  bankAccount: text('bank_account'),
  paymentReference: text('payment_reference'),
  paymentStatus: text('payment_status').notNull().default('pending'),

  // Status
  status: text('status').notNull().default('pending'), // pending, paid, failed
  paidAt: timestamp('paid_at'),

  // Notes
  notes: text('notes'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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
 * Payroll Run Progress Table
 *
 * Tracks progress of long-running payroll calculations for:
 * - Real-time UI progress display
 * - Resume capability after disconnection
 * - Error tracking and debugging
 *
 * Used by the streaming payroll processor for large tenants (500+ employees)
 */
export const payrollRunProgress = pgTable('payroll_run_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  payrollRunId: uuid('payroll_run_id').notNull().references(() => payrollRuns.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Progress tracking
  totalEmployees: integer('total_employees').notNull().default(0),
  processedCount: integer('processed_count').notNull().default(0),
  successCount: integer('success_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),

  // Cursor for resumability (keyset pagination)
  lastProcessedEmployeeId: uuid('last_processed_employee_id'),
  currentChunk: integer('current_chunk').notNull().default(0),
  totalChunks: integer('total_chunks'),
  chunkSize: integer('chunk_size').notNull().default(1000),

  // Status: pending, processing, completed, failed, paused
  status: text('status').notNull().default('pending'),

  // Error tracking (last 100 errors for debugging)
  errors: jsonb('errors').notNull().default('[]'),
  lastError: text('last_error'),

  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  estimatedCompletionAt: timestamp('estimated_completion_at'),

  // Inngest correlation
  inngestRunId: text('inngest_run_id'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  // Index for quick lookup by payroll run
  index('idx_payroll_run_progress_run_id').on(table.payrollRunId),
  // Index for finding in-progress runs by tenant
  index('idx_payroll_run_progress_tenant_status').on(table.tenantId, table.status),
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
 * CNPS Declaration Edits Table
 *
 * Stores manual edits made by users to CNPS monthly contribution declarations.
 * Allows tracking of changes from automatically calculated values for audit purposes.
 *
 * Each declaration can have multiple edits (users can revise their changes).
 * The most recent edit (by createdAt DESC) is used for PDF export.
 */
export const cnpsDeclarationEdits = pgTable('cnps_declaration_edits', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Declaration identifier (month + year + country)
  month: integer('month').notNull(), // 1-12
  year: integer('year').notNull(),
  countryCode: text('country_code').notNull().references(() => countries.code),

  // Original calculated data (for reference and revert)
  originalData: jsonb('original_data').notNull(),
  // Stores complete CNPSDeclarationData from calculator

  // User edits (only modified fields)
  edits: jsonb('edits').notNull(),
  // Example: {
  //   "monthlyWorkers.category1.employeeCount": 10,
  //   "contributions.retirement.employerAmount": 125000,
  //   "customAdjustments": [
  //     { "field": "totalEmployerContributions", "reason": "Manual correction for late employee" }
  //   ]
  // }

  // Edit metadata
  editReason: text('edit_reason'), // Optional reason for the edit
  editedBy: uuid('edited_by').notNull(), // References users(id)
  editedAt: timestamp('edited_at').notNull().defaultNow(),

  // Audit trail
  createdAt: timestamp('created_at').notNull().defaultNow(),
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
