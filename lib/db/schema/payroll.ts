import { pgTable, uuid, date, timestamp, text, integer, numeric, jsonb, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { tenantUser } from './roles';

export const payrollRuns = pgTable('payroll_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Period
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  paymentDate: date('payment_date').notNull(),

  // Metadata
  name: text('name').notNull(),
  description: text('description'),

  // Processing
  status: text('status').notNull().default('draft'),
  calculatedAt: timestamp('calculated_at'),
  approvedAt: timestamp('approved_at'),
  approvedBy: uuid('approved_by'),
  paidAt: timestamp('paid_at'),

  // Totals (denormalized)
  employeeCount: integer('employee_count'),
  totalGross: numeric('total_gross', { precision: 15, scale: 2 }),
  totalNet: numeric('total_net', { precision: 15, scale: 2 }),
  totalEmployerCost: numeric('total_employer_cost', { precision: 15, scale: 2 }),
  totalCnpsEmployee: numeric('total_cnps_employee', { precision: 15, scale: 2 }),
  totalCnpsEmployer: numeric('total_cnps_employer', { precision: 15, scale: 2 }),
  totalIts: numeric('total_its', { precision: 15, scale: 2 }),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  // RLS Policy: Tenant Isolation for Payroll Runs
  pgPolicy('payroll_runs_tenant_isolation', {
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

  // Employee snapshot
  employeeName: text('employee_name').notNull(),
  employeeNumber: text('employee_number').notNull(),
  positionTitle: text('position_title'),

  // Earnings
  baseSalary: numeric('base_salary', { precision: 15, scale: 2 }).notNull(),
  overtimePay: numeric('overtime_pay', { precision: 15, scale: 2 }).default('0'),
  bonuses: numeric('bonuses', { precision: 15, scale: 2 }).default('0'),
  allowances: numeric('allowances', { precision: 15, scale: 2 }).default('0'),
  grossSalary: numeric('gross_salary', { precision: 15, scale: 2 }).notNull(),

  // Deductions - Employee
  cnpsEmployee: numeric('cnps_employee', { precision: 15, scale: 2 }).notNull(),
  cmuEmployee: numeric('cmu_employee', { precision: 15, scale: 2 }).notNull(),
  its: numeric('its', { precision: 15, scale: 2 }).notNull(),
  otherDeductions: numeric('other_deductions', { precision: 15, scale: 2 }).default('0'),
  totalDeductions: numeric('total_deductions', { precision: 15, scale: 2 }).notNull(),

  // Employer Contributions
  cnpsEmployer: numeric('cnps_employer', { precision: 15, scale: 2 }).notNull(),
  cmuEmployer: numeric('cmu_employer', { precision: 15, scale: 2 }).notNull(),

  // Net Pay
  netSalary: numeric('net_salary', { precision: 15, scale: 2 }).notNull(),
  employerCost: numeric('employer_cost', { precision: 15, scale: 2 }).notNull(),

  // Detailed breakdown
  earningsDetails: jsonb('earnings_details').notNull().default([]),
  deductionsDetails: jsonb('deductions_details').notNull().default([]),

  // Days worked
  daysWorked: numeric('days_worked', { precision: 5, scale: 2 }).notNull().default('30'),
  daysAbsent: numeric('days_absent', { precision: 5, scale: 2 }).default('0'),

  // Payment
  paymentStatus: text('payment_status').notNull().default('pending'),
  paymentMethod: text('payment_method'),
  paymentReference: text('payment_reference'),
  paidAt: timestamp('paid_at'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  // RLS Policy: Tenant Isolation for Payroll Line Items
  pgPolicy('payroll_line_items_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);
