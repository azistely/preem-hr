import { pgTable, uuid, varchar, text, date, time, timestamp, numeric, boolean, integer, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { tenantUser } from './roles';

/**
 * Locations/Sites - Master table for company locations
 * Supports: headquarters, branches, construction sites, client sites
 */
export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Location identifiers
  locationCode: varchar('location_code', { length: 20 }).notNull(),
  locationName: varchar('location_name', { length: 255 }).notNull(),
  locationType: varchar('location_type', { length: 50 }).notNull(),

  // Address information
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: varchar('city', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  countryCode: varchar('country_code', { length: 2 }).default('CI'),

  // GPS coordinates (for geofencing)
  latitude: numeric('latitude', { precision: 10, scale: 8 }),
  longitude: numeric('longitude', { precision: 11, scale: 8 }),
  geofenceRadiusMeters: integer('geofence_radius_meters').default(100),

  // Location-specific allowances (in local currency - FCFA)
  transportAllowance: numeric('transport_allowance', { precision: 15, scale: 2 }).default('0'),
  mealAllowance: numeric('meal_allowance', { precision: 15, scale: 2 }).default('0'),
  sitePremium: numeric('site_premium', { precision: 15, scale: 2 }).default('0'),
  hazardPayRate: numeric('hazard_pay_rate', { precision: 6, scale: 4 }).default('0'),

  // Status
  isActive: boolean('is_active').default(true),

  // Metadata
  notes: text('notes'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => [
  // RLS Policy: Tenant Isolation
  pgPolicy('locations_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId}::text = (auth.jwt() ->> 'tenant_id') OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId}::text = (auth.jwt() ->> 'tenant_id')`,
  }),
]);

/**
 * Employee Site Assignments - Daily tracking of employee locations
 * Links employees to locations for a specific date
 */
export const employeeSiteAssignments = pgTable('employee_site_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  assignmentDate: date('assignment_date').notNull(),

  // Optional: time tracking integration
  startTime: time('start_time'),
  endTime: time('end_time'),
  hoursWorked: numeric('hours_worked', { precision: 5, scale: 2 }),

  // Flags
  isPrimarySite: boolean('is_primary_site').default(false),
  isOvertimeEligible: boolean('is_overtime_eligible').default(true),

  // Notes
  notes: text('notes'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
}, (table) => [
  // RLS Policy: Tenant isolation via employee
  pgPolicy('site_assignments_tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = ${table.employeeId}
      AND (
        employees.tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
      )
    )`,
    withCheck: sql`EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = ${table.employeeId}
      AND employees.tenant_id::text = (auth.jwt() ->> 'tenant_id')
    )`,
  }),
]);

// Export types for use in application
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type SiteAssignment = typeof employeeSiteAssignments.$inferSelect;
export type NewSiteAssignment = typeof employeeSiteAssignments.$inferInsert;

// Location type constants
export const LOCATION_TYPES = {
  HEADQUARTERS: 'headquarters',
  BRANCH: 'branch',
  CONSTRUCTION_SITE: 'construction_site',
  CLIENT_SITE: 'client_site',
} as const;

export type LocationType = typeof LOCATION_TYPES[keyof typeof LOCATION_TYPES];
