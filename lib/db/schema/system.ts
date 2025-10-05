import { pgTable, uuid, timestamp, text, jsonb, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { tenantUser } from './roles';

/**
 * Events - Immutable event store for event sourcing
 *
 * Triggers prevent UPDATE/DELETE to ensure immutability
 */
export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Event details
  eventType: text('event_type').notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  aggregateId: uuid('aggregate_id'),

  // Event data
  data: jsonb('data').notNull(),
  metadata: jsonb('metadata').notNull().default('{}'),

  // Event sourcing
  correlationId: uuid('correlation_id'),
  causationId: uuid('causation_id'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by'), // References users(id)
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
 * Audit Logs - Immutable change tracking
 *
 * Triggers prevent UPDATE/DELETE to ensure immutability
 */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id),

  // Action details
  action: text('action').notNull(), // created, updated, deleted
  tableName: text('table_name').notNull(),
  recordId: uuid('record_id').notNull(),

  // Change tracking
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  changedFields: text('changed_fields'), // JSONB array stored as text

  // Context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by'), // References users(id)
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
