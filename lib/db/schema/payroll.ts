import { pgTable, uuid, date, timestamp, text, numeric, jsonb, pgPolicy, integer } from 'drizzle-orm/pg-core';
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
  overtimeHours: jsonb('overtime_hours').notNull().default({}),

  // Earnings
  overtimePay: numeric('overtime_pay', { precision: 15, scale: 2 }).default('0'),
  bonuses: numeric('bonuses', { precision: 15, scale: 2 }).default('0'),
  grossSalary: numeric('gross_salary', { precision: 15, scale: 2 }).notNull(),
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

  totalEmployerCost: numeric('total_employer_cost', { precision: 15, scale: 2 }).notNull(),
  employerCost: numeric('employer_cost', { precision: 15, scale: 2 }),

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
