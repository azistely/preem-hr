/**
 * Component Activation Service
 *
 * Handles automatic tenant-level activation when components are added to employees.
 *
 * Flow:
 * 1. User adds component to employee (onboarding, salary edit, etc.)
 * 2. System checks if component is activated at tenant level
 * 3. If not activated: Auto-activate at tenant level
 * 4. Then add to employee_salaries.components
 */

import { db } from '@/lib/db';
import {
  salaryComponentDefinitions,
  salaryComponentTemplates,
  tenantSalaryComponentActivations
} from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

export interface ComponentActivationInput {
  code: string;
  sourceType: 'standard' | 'template';
  tenantId: string;
  countryCode: string;
  userId?: string;
}

export interface ComponentActivationResult {
  isNewActivation: boolean;
  activationId: string;
  componentCode: string;
}

/**
 * Ensure a component is activated at tenant level
 *
 * This function is idempotent - it will:
 * - Return existing activation if already active
 * - Create new activation if not yet active
 *
 * @param input - Component activation details
 * @param tx - Optional transaction (if called within a transaction)
 * @returns Activation result with flag indicating if new activation was created
 */
export async function ensureComponentActivated(
  input: ComponentActivationInput,
  tx?: any
): Promise<ComponentActivationResult> {
  const dbConn = tx || db;

  const { code, sourceType, tenantId, countryCode, userId } = input;

  // Step 1: Check if already activated
  const [existingActivation] = await dbConn
    .select()
    .from(tenantSalaryComponentActivations)
    .where(
      and(
        eq(tenantSalaryComponentActivations.tenantId, tenantId),
        eq(tenantSalaryComponentActivations.templateCode, code),
        eq(tenantSalaryComponentActivations.isActive, true)
      )
    )
    .limit(1);

  if (existingActivation) {
    // Already activated - return existing
    return {
      isNewActivation: false,
      activationId: existingActivation.id,
      componentCode: code,
    };
  }

  // Step 2: Component not activated - need to activate
  // Verify component exists in definitions or templates
  if (sourceType === 'standard') {
    // Check salary_component_definitions
    const [definition] = await dbConn
      .select()
      .from(salaryComponentDefinitions)
      .where(
        and(
          eq(salaryComponentDefinitions.code, code),
          eq(salaryComponentDefinitions.countryCode, countryCode)
        )
      )
      .limit(1);

    if (!definition) {
      throw new Error(`Standard component ${code} not found for country ${countryCode}`);
    }

    // Create activation for standard component
    const [newActivation] = await dbConn
      .insert(tenantSalaryComponentActivations)
      .values({
        tenantId,
        countryCode,
        templateCode: code,
        overrides: {}, // No overrides initially
        customName: null,
        isActive: true,
        displayOrder: 0,
        createdBy: userId || null,
      })
      .returning();

    return {
      isNewActivation: true,
      activationId: newActivation.id,
      componentCode: code,
    };
  } else {
    // sourceType === 'template'
    // Check salary_component_templates first
    const [template] = await dbConn
      .select()
      .from(salaryComponentTemplates)
      .where(eq(salaryComponentTemplates.code, code))
      .limit(1);

    if (!template) {
      // Template not found - check if it's a standard component code instead
      // This handles cases where component definition codes (e.g., 'transport')
      // are used with sourceType='template'
      const [definition] = await dbConn
        .select()
        .from(salaryComponentDefinitions)
        .where(
          and(
            eq(salaryComponentDefinitions.code, code),
            eq(salaryComponentDefinitions.countryCode, countryCode)
          )
        )
        .limit(1);

      if (definition) {
        // Create activation using the standard component definition
        const [newActivation] = await dbConn
          .insert(tenantSalaryComponentActivations)
          .values({
            tenantId,
            countryCode,
            templateCode: code,
            overrides: {}, // No overrides initially
            customName: null,
            isActive: true,
            displayOrder: 0,
            createdBy: userId || null,
          })
          .returning();

        return {
          isNewActivation: true,
          activationId: newActivation.id,
          componentCode: code,
        };
      }

      throw new Error(`Template component ${code} not found in templates or definitions`);
    }

    // Create activation for template component
    const [newActivation] = await dbConn
      .insert(tenantSalaryComponentActivations)
      .values({
        tenantId,
        countryCode: template.countryCode,
        templateCode: code,
        overrides: {}, // No overrides initially
        customName: null,
        isActive: true,
        displayOrder: 0,
        createdBy: userId || null,
      })
      .returning();

    return {
      isNewActivation: true,
      activationId: newActivation.id,
      componentCode: code,
    };
  }
}

/**
 * Ensure multiple components are activated at tenant level
 *
 * Batch version of ensureComponentActivated for better performance
 * when activating multiple components at once.
 *
 * @param components - Array of component activation inputs
 * @param tx - Optional transaction (if called within a transaction)
 * @returns Array of activation results
 */
export async function ensureComponentsActivated(
  components: ComponentActivationInput[],
  tx?: any
): Promise<ComponentActivationResult[]> {
  const results: ComponentActivationResult[] = [];

  for (const component of components) {
    const result = await ensureComponentActivated(component, tx);
    results.push(result);
  }

  return results;
}

/**
 * Check if a component is activated for a tenant
 *
 * @param tenantId - Tenant ID
 * @param componentCode - Component code to check
 * @param tx - Optional transaction
 * @returns true if activated, false otherwise
 */
export async function isComponentActivated(
  tenantId: string,
  componentCode: string,
  tx?: any
): Promise<boolean> {
  const dbConn = tx || db;

  const [activation] = await dbConn
    .select()
    .from(tenantSalaryComponentActivations)
    .where(
      and(
        eq(tenantSalaryComponentActivations.tenantId, tenantId),
        eq(tenantSalaryComponentActivations.templateCode, componentCode),
        eq(tenantSalaryComponentActivations.isActive, true)
      )
    )
    .limit(1);

  return !!activation;
}
