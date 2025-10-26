/**
 * Salary Components tRPC Router
 *
 * Endpoints for managing salary components:
 * - Standard components (super admin seeded)
 * - Component templates (curated library)
 * - Sector configurations
 * - Custom components (tenant-specific)
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import {
  salaryComponentDefinitions,
  salaryComponentTemplates,
  sectorConfigurations,
  tenantSalaryComponentActivations,
  customSalaryComponents,
} from '@/drizzle/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import type {
  SalaryComponentDefinition,
  SalaryComponentTemplate,
  SectorConfiguration,
  CustomSalaryComponent,
  ComponentMetadata,
} from '@/features/employees/types/salary-components';
import { createFormulaVersion, getVersionHistory } from '@/lib/salary-components/formula-version-service';
import { complianceValidator } from '@/lib/compliance';
import { mergeTemplatesWithActivations, mergeTemplateWithOverrides } from '@/lib/salary-components/template-merger';
import type { TenantActivation, SalaryComponentTemplate as TemplateMergerTemplate } from '@/lib/salary-components/template-merger';
import { getBaseSalaryComponents } from '@/lib/salary-components/base-salary-loader';

// ============================================================================
// Input Schemas
// ============================================================================

const getStandardComponentsSchema = z.object({
  countryCode: z.string().length(2),
  category: z.enum(['base', 'allowance', 'bonus', 'deduction', 'benefit']).optional(),
});

const getComponentTemplatesSchema = z.object({
  countryCode: z.string().length(2),
  popularOnly: z.boolean().optional().default(false),
});

const getSectorConfigurationsSchema = z.object({
  countryCode: z.string().length(2),
});

const createCustomComponentSchema = z.object({
  // DEPRECATED: createCustomComponent removed - use addFromTemplate
});

const addFromTemplateSchema = z.object({
  templateCode: z.string(),
  customizations: z
    .object({
      name: z.string().optional(),
      amount: z.number().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
});

const updateCustomComponentSchema = z.object({
  componentId: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

const deleteCustomComponentSchema = z.object({
  componentId: z.string().uuid(),
});

const getFormulaHistorySchema = z.object({
  componentId: z.string().uuid(),
  limit: z.number().min(1).max(100).optional().default(50),
});

const getLegalRangeSchema = z.object({
  templateCode: z.string(),
  countryCode: z.string().length(2),
  field: z.string(),
});

const validateCustomizationSchema = z.object({
  templateCode: z.string(),
  countryCode: z.string().length(2),
  customizations: z
    .object({
      name: z.string().optional(),
      amount: z.number().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
});

const getBaseSalaryComponentsSchema = z.object({
  countryCode: z.string().length(2),
});

// ============================================================================
// Router Definition
// ============================================================================

export const salaryComponentsRouter = createTRPCRouter({
  /**
   * Get standard components for a country
   * These are super admin seeded (codes 11-41)
   */
  getStandardComponents: publicProcedure
    .input(getStandardComponentsSchema)
    .query(async ({ input }) => {
      const { countryCode, category } = input;

      const conditions = [eq(salaryComponentDefinitions.countryCode, countryCode)];
      if (category) {
        conditions.push(eq(salaryComponentDefinitions.category, category));
      }

      const components = await db
        .select()
        .from(salaryComponentDefinitions)
        .where(and(...conditions))
        .orderBy(salaryComponentDefinitions.displayOrder);

      return components as SalaryComponentDefinition[];
    }),

  /**
   * Get component templates (curated library)
   * Users can add from template with one click
   */
  getComponentTemplates: publicProcedure
    .input(getComponentTemplatesSchema)
    .query(async ({ input }) => {
      const { countryCode, popularOnly } = input;

      const conditions = [eq(salaryComponentTemplates.countryCode, countryCode)];
      if (popularOnly) {
        conditions.push(eq(salaryComponentTemplates.isPopular, true));
      }

      const templates = await db
        .select()
        .from(salaryComponentTemplates)
        .where(and(...conditions))
        .orderBy(salaryComponentTemplates.displayOrder);

      return templates as unknown as SalaryComponentTemplate[];
    }),

  /**
   * Get sector configurations for a country
   * Provides work accident rates and smart defaults
   */
  getSectorConfigurations: publicProcedure
    .input(getSectorConfigurationsSchema)
    .query(async ({ input }) => {
      const { countryCode } = input;

      const sectors = await db
        .select()
        .from(sectorConfigurations)
        .where(eq(sectorConfigurations.countryCode, countryCode))
        .orderBy(sectorConfigurations.name);

      return sectors as unknown as SectorConfiguration[];
    }),

  /**
   * Get active components for the current tenant (Option B)
   *
   * Fetches tenant activations + templates, then merges them.
   * Returns components with:
   * - Tax treatment from template (law)
   * - Customizations from activation (tenant choice)
   */
  getCustomComponents: publicProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user?.tenantId;

    if (!tenantId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Tenant ID requis',
      });
    }

    // 1. Fetch tenant activations
    const activations = await db
      .select()
      .from(tenantSalaryComponentActivations)
      .where(eq(tenantSalaryComponentActivations.tenantId, tenantId))
      .orderBy(
        tenantSalaryComponentActivations.displayOrder,
        desc(tenantSalaryComponentActivations.createdAt)
      );

    if (activations.length === 0) {
      return [];
    }

    // 2. Fetch all activated templates
    const templateCodes = activations.map((a) => a.templateCode);
    const templates = await db
      .select()
      .from(salaryComponentTemplates)
      .where(inArray(salaryComponentTemplates.code, templateCodes));

    // 3. Merge templates with activations
    const merged = mergeTemplatesWithActivations(
      templates as unknown as TemplateMergerTemplate[],
      activations as unknown as TenantActivation[]
    );

    return merged as unknown as CustomSalaryComponent[];
  }),

  // REMOVED: createCustomComponent
  // Reason: Option B architecture - all components must come from templates
  // Use addFromTemplate instead

  /**
   * Add component from template (Option B Architecture)
   *
   * Creates an activation (reference to template + customizations)
   * instead of copying full component.
   *
   * Validation:
   * - Ensures customizations only contain customizable fields
   * - Validates against compliance rules
   * - Prevents duplicate activations
   */
  addFromTemplate: publicProcedure
    .input(addFromTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user?.tenantId;
      const userId = ctx.user?.id;

      if (!tenantId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Tenant ID requis',
        });
      }

      const { templateCode, customizations } = input;

      // 1. Find the template
      const [template] = await db
        .select()
        .from(salaryComponentTemplates)
        .where(eq(salaryComponentTemplates.code, templateCode))
        .limit(1);

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template introuvable',
        });
      }

      // 2. Check if already activated
      const existing = await db
        .select()
        .from(tenantSalaryComponentActivations)
        .where(
          and(
            eq(tenantSalaryComponentActivations.tenantId, tenantId),
            eq(tenantSalaryComponentActivations.templateCode, templateCode)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ce composant est déjà activé pour votre organisation',
        });
      }

      // 3. Validate customizations against compliance rules
      const validationResult = await complianceValidator.validateComponent(
        templateCode,
        template.countryCode,
        customizations
      );

      if (!validationResult.valid) {
        const firstViolation = validationResult.violations[0];
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: firstViolation.error,
          cause: {
            violations: validationResult.violations,
            legalReference: firstViolation.legalReference,
          },
        });
      }

      // 4. Extract overrides (ONLY customizable fields)
      const overrides = customizations?.metadata || {};

      // 5. Create activation
      const [activation] = await db
        .insert(tenantSalaryComponentActivations)
        .values({
          tenantId,
          countryCode: template.countryCode,
          templateCode,
          overrides,
          customName: customizations?.name || null,
          isActive: true,
          displayOrder: 0,
          createdBy: userId,
        })
        .returning();

      // 6. Return merged component (for UI)
      const merged = mergeTemplateWithOverrides(
        template as unknown as TemplateMergerTemplate,
        activation as unknown as TenantActivation
      );

      return merged as unknown as CustomSalaryComponent;
    }),

  /**
   * Update a component activation (Option B Architecture)
   *
   * Updates activation.overrides instead of copying full metadata.
   * Validates that updates only modify customizable fields.
   *
   * Version tracking:
   * - Detects formula changes in overrides.calculationRule
   * - Creates version history entry if formula changed
   */
  updateCustomComponent: publicProcedure
    .input(updateCustomComponentSchema)
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user?.tenantId;
      const userId = ctx.user?.id;

      if (!tenantId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Tenant ID requis',
        });
      }

      const { componentId, ...updates } = input;

      // 1. Verify activation belongs to tenant
      const [existingActivation] = await db
        .select()
        .from(tenantSalaryComponentActivations)
        .where(
          and(
            eq(tenantSalaryComponentActivations.id, componentId),
            eq(tenantSalaryComponentActivations.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existingActivation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Composant introuvable',
        });
      }

      // 2. Fetch template to get compliance rules
      const [template] = await db
        .select()
        .from(salaryComponentTemplates)
        .where(eq(salaryComponentTemplates.code, existingActivation.templateCode))
        .limit(1);

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template introuvable',
        });
      }

      // 3. Validate that metadata updates only contain customizable fields
      if (updates.metadata) {
        const validationResult = await complianceValidator.validateComponent(
          existingActivation.templateCode,
          template.countryCode,
          { metadata: updates.metadata }
        );

        if (!validationResult.valid) {
          const firstViolation = validationResult.violations[0];
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: firstViolation.error,
            cause: {
              violations: validationResult.violations,
              legalReference: firstViolation.legalReference,
            },
          });
        }
      }

      // 4. Check if formula changed (for version tracking)
      const oldOverrides = existingActivation.overrides as Record<string, any>;
      const newOverrides = updates.metadata as Record<string, any> | undefined;

      const oldFormula = oldOverrides?.calculationRule;
      const newFormula = newOverrides?.calculationRule;

      const formulaChanged =
        newFormula &&
        JSON.stringify(oldFormula) !== JSON.stringify(newFormula);

      // 5. Update activation
      const [updatedActivation] = await db
        .update(tenantSalaryComponentActivations)
        .set({
          overrides: updates.metadata || existingActivation.overrides,
          customName: updates.name || existingActivation.customName,
          isActive: updates.isActive ?? existingActivation.isActive,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tenantSalaryComponentActivations.id, componentId))
        .returning();

      // 6. Create formula version if formula changed
      if (formulaChanged && newFormula && userId) {
        try {
          await createFormulaVersion({
            componentId,
            componentType: 'custom',
            calculationRule: newFormula,
            changedBy: userId,
            changeReason: `Mise à jour via l'interface d'administration`,
          });
        } catch (error) {
          console.error('Error creating formula version:', error);
        }
      }

      // 7. Return merged component (for UI)
      const merged = mergeTemplateWithOverrides(
        template as unknown as TemplateMergerTemplate,
        updatedActivation as unknown as TenantActivation
      );

      return merged as unknown as CustomSalaryComponent;
    }),

  /**
   * Delete (soft delete) a custom component
   */
  deleteCustomComponent: publicProcedure
    .input(deleteCustomComponentSchema)
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user?.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Tenant ID requis',
        });
      }

      const { componentId } = input;

      // Verify component belongs to tenant
      const [existing] = await db
        .select()
        .from(customSalaryComponents)
        .where(
          and(
            eq(customSalaryComponents.id, componentId),
            eq(customSalaryComponents.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Composant introuvable',
        });
      }

      // Soft delete by marking as inactive
      await db
        .update(customSalaryComponents)
        .set({
          isActive: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(customSalaryComponents.id, componentId));

      return { success: true };
    }),

  /**
   * Get formula version history for a custom component
   *
   * Returns timeline of all formula changes with audit trail
   */
  getFormulaHistory: publicProcedure
    .input(getFormulaHistorySchema)
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user?.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Tenant ID requis',
        });
      }

      const { componentId, limit } = input;

      // Verify component belongs to tenant
      const [existing] = await db
        .select()
        .from(customSalaryComponents)
        .where(
          and(
            eq(customSalaryComponents.id, componentId),
            eq(customSalaryComponents.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Composant introuvable',
        });
      }

      // Get version history
      const versions = await getVersionHistory({
        componentId,
        componentType: 'custom',
        limit,
      });

      return versions;
    }),

  /**
   * Get legal range for a configurable field
   *
   * Used by UI to display slider bounds and recommended values
   * Example: Housing allowance rate → { min: 0.20, max: 0.30, recommended: 0.25 }
   */
  getLegalRange: publicProcedure
    .input(getLegalRangeSchema)
    .query(async ({ input }) => {
      const { templateCode, countryCode, field } = input;

      const range = await complianceValidator.getLegalRange(
        templateCode,
        countryCode,
        field
      );

      return range;
    }),

  /**
   * Validate a customization before applying
   *
   * Used by UI to show real-time validation feedback
   * Returns violations and warnings without saving
   */
  validateCustomization: publicProcedure
    .input(validateCustomizationSchema)
    .query(async ({ input }) => {
      const { templateCode, countryCode, customizations } = input;

      const validationResult = await complianceValidator.validateComponent(
        templateCode,
        countryCode,
        customizations
      );

      return validationResult;
    }),

  /**
   * Get base salary components for a country
   *
   * Returns components marked with metadata.isBaseComponent = true
   * Used by forms to dynamically render base salary input fields
   *
   * For CI: Returns Code 11 (Salaire catégoriel) + Code 12 (Sursalaire)
   * For other countries: Returns configured base components
   */
  getBaseSalaryComponents: publicProcedure
    .input(getBaseSalaryComponentsSchema)
    .query(async ({ input }) => {
      const { countryCode } = input;
      return await getBaseSalaryComponents(countryCode);
    }),

  // ========================================================================
  // Tenant Override Endpoints (for database-driven architecture)
  // ========================================================================

  /**
   * Get a standard component definition by code
   */
  getStandardComponent: publicProcedure
    .input(z.object({
      code: z.string(),
      countryCode: z.string().length(2),
    }))
    .query(async ({ input }) => {
      const { code, countryCode } = input;

      const results = await db
        .select()
        .from(salaryComponentDefinitions)
        .where(
          and(
            eq(salaryComponentDefinitions.code, code),
            eq(salaryComponentDefinitions.countryCode, countryCode)
          )
        )
        .limit(1);

      if (results.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Component ${code} not found for country ${countryCode}`,
        });
      }

      return results[0];
    }),

  /**
   * Get tenant override for a component (if exists)
   */
  getTenantOverride: publicProcedure
    .input(z.object({
      code: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const { code } = input;
      const tenantId = ctx.user?.tenantId;

      if (!tenantId) {
        return null;
      }

      const results = await db
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

      return results.length > 0 ? results[0] : null;
    }),

  /**
   * Update or create tenant override for a standard component
   */
  updateTenantOverride: publicProcedure
    .input(z.object({
      code: z.string(),
      customName: z.string().optional(),
      overrides: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { code, customName, overrides } = input;
      const tenantId = ctx.user?.tenantId;
      const userId = ctx.user?.id;

      if (!tenantId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Tenant ID required',
        });
      }

      // Check if override already exists
      const existing = await db
        .select()
        .from(tenantSalaryComponentActivations)
        .where(
          and(
            eq(tenantSalaryComponentActivations.tenantId, tenantId),
            eq(tenantSalaryComponentActivations.templateCode, code)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(tenantSalaryComponentActivations)
          .set({
            customName: customName || null,
            overrides: overrides || {},
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tenantSalaryComponentActivations.id, existing[0].id));

        return { success: true, id: existing[0].id };
      } else {
        // Create new
        const [result] = await db
          .insert(tenantSalaryComponentActivations)
          .values({
            tenantId,
            countryCode: 'CI', // TODO: Get from tenant
            templateCode: code,
            customName: customName || null,
            overrides: overrides || {},
            isActive: true,
            displayOrder: 0,
            createdBy: userId || null,
          })
          .returning({ id: tenantSalaryComponentActivations.id });

        return { success: true, id: result.id };
      }
    }),
});
