import { pgTable, uuid, text, timestamp, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { employees } from './employees';

/**
 * User Invitations Table
 * Tracks invitations sent to users to join a tenant
 */
export const userInvitations = pgTable('user_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Invitation details
  // Email is optional - can be null for link-only invitations
  email: text('email'),
  role: text('role').notNull().default('employee'), // employee, manager, hr_manager, tenant_admin
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'set null' }),

  // Token (URL-safe base64, 43 chars)
  token: text('token').notNull().unique(),

  // Lifecycle
  status: text('status').notNull().default('pending'), // pending, accepted, expired, revoked
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  // Tracking - who invited
  invitedBy: uuid('invited_by').notNull().references(() => users.id),

  // Tracking - acceptance
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id),

  // Tracking - revocation
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by').references(() => users.id),

  // Email tracking
  emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
  emailResentCount: integer('email_resent_count').notNull().default(0),
  lastEmailSentAt: timestamp('last_email_sent_at', { withTimezone: true }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Performance indexes
  index('idx_user_invitations_tenant').on(table.tenantId),
  index('idx_user_invitations_email_tenant').on(table.email, table.tenantId),
  index('idx_user_invitations_token').on(table.token),
  index('idx_user_invitations_status').on(table.status),
  // Unique constraint: only one pending invitation per email per tenant
  // NOTE: NULL emails are allowed (link-only invites) and won't conflict
  uniqueIndex('idx_user_invitations_pending_unique')
    .on(table.email, table.tenantId)
    .where(sql`${table.status} = 'pending' AND ${table.email} IS NOT NULL`),
]);

// Type exports
export type UserInvitation = typeof userInvitations.$inferSelect;
export type NewUserInvitation = typeof userInvitations.$inferInsert;
