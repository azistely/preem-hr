/**
 * Time-Off Policy Seeding Service
 *
 * Automatically seeds time-off policies from templates when a new tenant is created.
 * This ensures every tenant starts with a complete set of legally-compliant leave types
 * for their country (paid annual leave, sick leave, unpaid leave, etc.)
 *
 * @module features/time-off/services/policy-seeding
 */

import { db } from '@/lib/db';
import { timeOffPolicies, timeOffPolicyTemplates } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Seed all time-off policy templates for a new tenant
 *
 * Copies all active templates for the tenant's country into tenant-specific policies.
 * This runs automatically when a tenant is created.
 *
 * @param tenantId - UUID of the newly created tenant
 * @param countryCode - ISO 2-letter country code (CI, SN, BF, etc.)
 * @param createdBy - UUID of the user creating the tenant (optional)
 *
 * @returns Number of policies created
 *
 * @example
 * ```typescript
 * // Called automatically in tenant creation
 * await seedTimeOffPoliciesForTenant(
 *   'tenant-uuid',
 *   'CI',
 *   'user-uuid'
 * );
 * // Creates ~15 policies (annual leave, sick leave, maternity, permissions, etc.)
 * ```
 */
export async function seedTimeOffPoliciesForTenant(
  tenantId: string,
  countryCode: string,
  createdBy?: string
): Promise<number> {
  // 1. Load all active templates for this country
  const templates = await db
    .select()
    .from(timeOffPolicyTemplates)
    .where(
      and(
        eq(timeOffPolicyTemplates.countryCode, countryCode),
        eq(timeOffPolicyTemplates.isActive, true)
      )
    )
    .orderBy(timeOffPolicyTemplates.displayOrder);

  if (templates.length === 0) {
    console.warn(
      `[Policy Seeding] No templates found for country ${countryCode}. Tenant ${tenantId} will have no default policies.`
    );
    return 0;
  }

  console.log(
    `[Policy Seeding] Found ${templates.length} templates for ${countryCode}. Seeding for tenant ${tenantId}...`
  );

  // 2. Transform templates into policies
  const policiesToInsert = templates.map((template) => ({
    tenantId,
    templateId: template.id,
    name: typeof template.name === 'object' && template.name !== null
      ? (template.name as Record<string, string>).fr || (template.name as Record<string, string>).en || 'Unknown'
      : String(template.name),
    policyType: template.policyType,
    accrualMethod: template.accrualMethod,
    accrualRate: template.defaultAccrualRate,
    maxBalance: template.defaultMaxBalance,
    requiresApproval: template.requiresApproval,
    advanceNoticeDays: template.advanceNoticeDays,
    minDaysPerRequest: template.minDaysPerRequest,
    maxDaysPerRequest: template.maxDaysPerRequest,
    blackoutPeriods: template.defaultBlackoutPeriods || [],
    isPaid: template.isPaid,
    effectiveFrom: new Date().toISOString().split('T')[0], // Today
    effectiveTo: null,
    createdBy: createdBy || null,
    // Copy metadata from template (includes permission_category, min_tenure_months for Article 25.12 compliance)
    metadata: template.metadata || null,
  }));

  // 3. Batch insert all policies
  const insertedPolicies = await db
    .insert(timeOffPolicies)
    .values(policiesToInsert)
    .returning({ id: timeOffPolicies.id });

  console.log(
    `[Policy Seeding] Successfully created ${insertedPolicies.length} policies for tenant ${tenantId}`
  );

  return insertedPolicies.length;
}

/**
 * Get seeded policies for a tenant
 *
 * Returns all policies that were created from templates.
 * Useful for verifying seeding was successful.
 *
 * @param tenantId - Tenant UUID
 * @returns Array of policies with template references
 */
export async function getSeededPolicies(tenantId: string) {
  const policies = await db
    .select({
      id: timeOffPolicies.id,
      name: timeOffPolicies.name,
      policyType: timeOffPolicies.policyType,
      isPaid: timeOffPolicies.isPaid,
      templateId: timeOffPolicies.templateId,
      effectiveFrom: timeOffPolicies.effectiveFrom,
    })
    .from(timeOffPolicies)
    .where(eq(timeOffPolicies.tenantId, tenantId))
    .orderBy(timeOffPolicies.name);

  return policies;
}

/**
 * Re-seed policies for an existing tenant
 *
 * USE WITH CAUTION: This will add any new templates that don't exist yet.
 * Does NOT delete or modify existing policies.
 *
 * @param tenantId - Tenant UUID
 * @param countryCode - Country code
 * @returns Number of NEW policies added
 */
export async function reseedTimeOffPolicies(
  tenantId: string,
  countryCode: string
): Promise<number> {
  // Get existing policy template IDs
  const existingPolicies = await db
    .select({ templateId: timeOffPolicies.templateId })
    .from(timeOffPolicies)
    .where(eq(timeOffPolicies.tenantId, tenantId));

  const existingTemplateIds = new Set(
    existingPolicies.map((p) => p.templateId).filter((id): id is string => id !== null)
  );

  // Get all templates for this country
  const allTemplates = await db
    .select()
    .from(timeOffPolicyTemplates)
    .where(
      and(
        eq(timeOffPolicyTemplates.countryCode, countryCode),
        eq(timeOffPolicyTemplates.isActive, true)
      )
    );

  // Filter out templates that already have policies
  const newTemplates = allTemplates.filter(
    (template) => !existingTemplateIds.has(template.id)
  );

  if (newTemplates.length === 0) {
    console.log(`[Policy Re-seeding] No new templates to add for tenant ${tenantId}`);
    return 0;
  }

  console.log(
    `[Policy Re-seeding] Adding ${newTemplates.length} new policies for tenant ${tenantId}`
  );

  // Insert new policies
  const policiesToInsert = newTemplates.map((template) => ({
    tenantId,
    templateId: template.id,
    name: typeof template.name === 'object' && template.name !== null
      ? (template.name as Record<string, string>).fr || (template.name as Record<string, string>).en || 'Unknown'
      : String(template.name),
    policyType: template.policyType,
    accrualMethod: template.accrualMethod,
    accrualRate: template.defaultAccrualRate,
    maxBalance: template.defaultMaxBalance,
    requiresApproval: template.requiresApproval,
    advanceNoticeDays: template.advanceNoticeDays,
    minDaysPerRequest: template.minDaysPerRequest,
    maxDaysPerRequest: template.maxDaysPerRequest,
    blackoutPeriods: template.defaultBlackoutPeriods || [],
    isPaid: template.isPaid,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: null,
    createdBy: null,
    // Copy metadata from template (includes permission_category, min_tenure_months for Article 25.12 compliance)
    metadata: template.metadata || null,
  }));

  const insertedPolicies = await db
    .insert(timeOffPolicies)
    .values(policiesToInsert)
    .returning({ id: timeOffPolicies.id });

  return insertedPolicies.length;
}
