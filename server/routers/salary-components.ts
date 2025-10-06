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
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import {
  salaryComponentDefinitions,
  salaryComponentTemplates,
  sectorConfigurations,
  customSalaryComponents,
  tenantSalaryComponentActivations,
} from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
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
  countryCode: z.string().length(2),
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.enum(['allowance', 'bonus', 'deduction', 'benefit']),
  metadata: z.record(z.unknown()),
  templateCode: z.string().optional(),
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

// ============================================================================
// Router Definition
// ============================================================================

export const salaryComponentsRouter = createTRPCRouter({
  /**
   * Get standard components for a country
   * These are super admin seeded (codes 11-41)
   */
  getStandardComponents: protectedProcedure
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
  getComponentTemplates: protectedProcedure
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

      return templates as SalaryComponentTemplate[];
    }),

  /**
   * Get sector configurations for a country
   * Provides work accident rates and smart defaults
   */
  getSectorConfigurations: protectedProcedure
    .input(getSectorConfigurationsSchema)
    .query(async ({ input }) => {
      const { countryCode } = input;

      const sectors = await db
        .select()
        .from(sectorConfigurations)
        .where(eq(sectorConfigurations.countryCode, countryCode))
        .orderBy(sectorConfigurations.name);

      return sectors as SectorConfiguration[];
    }),

  /**
   * Get active components for the current tenant (Option B)
   *
   * Fetches tenant activations + templates, then merges them.
   * Returns components with:
   * - Tax treatment from template (law)
   * - Customizations from activation (tenant choice)
   */
  getCustomComponents: protectedProcedure.query(async ({ ctx }) => {
    const { tenantId } = ctx;

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
      .where(
        and(
          // @ts-ignore - Drizzle typing issue with array
          salaryComponentTemplates.code.in(templateCodes)
        )
      );

    // 3. Merge templates with activations
    const merged = mergeTemplatesWithActivations(
      templates as unknown as TemplateMergerTemplate[],
      activations as unknown as TenantActivation[]
    );

    return merged as unknown as CustomSalaryComponent[];
  }),

  /**
   * Create a custom component for the tenant
   */
  createCustomComponent: protectedProcedure
    .input(createCustomComponentSchema)
    .mutation(async ({ input, ctx }) => {
      const { tenantId, userId } = ctx;

      if (!tenantId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Tenant ID requis',
        });
      }

      const { countryCode, name, description, category, metadata, templateCode } = input;

      // Generate unique code (CUSTOM_XXX format)
      const existingComponents = await db
        .select({ code: customSalaryComponents.code })
        .from(customSalaryComponents)
        .where(
          and(
            eq(customSalaryComponents.tenantId, tenantId),
            eq(customSalaryComponents.countryCode, countryCode)
          )
        );

      const existingCodes = existingComponents.map((c) => c.code);
      let code = '';
      let counter = 1;

      // Find next available CUSTOM_XXX code
      do {
        code = `CUSTOM_${counter.toString().padStart(3, '0')}`;
        counter++;
      } while (existingCodes.includes(code));

      const [newComponent] = await db
        .insert(customSalaryComponents)
        .values({
          tenantId,
          countryCode,
          code,
          name,
          description: description || null,
          templateCode: templateCode || null,
          metadata: metadata as ComponentMetadata,
          isActive: true,
          displayOrder: 0,
          createdBy: userId,
        })
        .returning();

      return newComponent as CustomSalaryComponent;
    }),

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
  addFromTemplate: protectedProcedure
    .input(addFromTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const { tenantId, userId } = ctx;

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
  updateCustomComponent: protectedProcedure
    .input(updateCustomComponentSchema)
    .mutation(async ({ input, ctx }) => {
      const { tenantId, userId } = ctx;

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
  deleteCustomComponent: protectedProcedure
    .input(deleteCustomComponentSchema)
    .mutation(async ({ input, ctx }) => {
      const { tenantId } = ctx;

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
  getFormulaHistory: protectedProcedure
    .input(getFormulaHistorySchema)
    .query(async ({ input, ctx }) => {
      const { tenantId } = ctx;

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
  getLegalRange: protectedProcedure
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
  validateCustomization: protectedProcedure
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
});
