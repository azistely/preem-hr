import { pgTable, uuid, text, timestamp, jsonb, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { tenantUser } from './roles';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // References auth.users(id)
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  activeTenantId: uuid('active_tenant_id').references(() => tenants.id), // Currently selected tenant
  employeeId: uuid('employee_id'), // References employees(id), added later via ALTER

  // User info
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  avatarUrl: text('avatar_url'),

  // Locale & preferences
  locale: text('locale').notNull().default('fr'),

  // Access control
  role: text('role').notNull().default('employee'),
  permissions: jsonb('permissions').notNull().default([]),

  // Login tracking
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: text('last_login_ip'),

  // Status
  status: text('status').notNull().default('active'),

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
 * Many-to-Many Junction Table: Users <-> Tenants
 * Allows users to belong to multiple tenants with different roles per tenant
 */
export const userTenants = pgTable('user_tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('hr_manager'), // Role specific to this tenant
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Audit Log: User Tenant Switches
 * Tracks when users switch between tenants for security monitoring
 */
export const userTenantSwitches = pgTable('user_tenant_switches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fromTenantId: uuid('from_tenant_id').references(() => tenants.id),
  toTenantId: uuid('to_tenant_id').notNull().references(() => tenants.id),
  switchedAt: timestamp('switched_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});
