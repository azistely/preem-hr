/**
 * PostgreSQL Roles for RLS Policies
 */

import { pgRole } from 'drizzle-orm/pg-core';

/**
 * Tenant User Role
 * Used for RLS policies to isolate data by tenant
 */
export const tenantUser = pgRole('tenant_user');

/**
 * Super Admin Role
 * Has access to all data across all tenants
 */
export const superAdmin = pgRole('super_admin');
