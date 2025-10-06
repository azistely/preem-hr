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
   * Get custom components for the current tenant
   */
  getCustomComponents: protectedProcedure.query(async ({ ctx }) => {
    const { tenantId } = ctx;

    if (!tenantId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Tenant ID requis',
      });
    }

    const components = await db
      .select()
      .from(customSalaryComponents)
      .where(eq(customSalaryComponents.tenantId, tenantId))
      .orderBy(desc(customSalaryComponents.createdAt));

    return components as CustomSalaryComponent[];
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
   * Add component from template (one-click)
   * Creates a custom component with template metadata
   *
   * Now with compliance validation:
   * - Validates customizations against Convention Collective rules
   * - Prevents locked templates from being modified
   * - Enforces legal ranges for configurable templates (housing 20-30%, transport ≤30k)
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

      // Find the template
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

      // ✅ NEW: Validate customizations against compliance rules
      const validationResult = await complianceValidator.validateComponent(
        templateCode,
        template.countryCode,
        customizations
      );

      if (!validationResult.valid) {
        // Return first violation as user-friendly error
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

      // Generate unique code
      const existingComponents = await db
        .select({ code: customSalaryComponents.code })
        .from(customSalaryComponents)
        .where(
          and(
            eq(customSalaryComponents.tenantId, tenantId),
            eq(customSalaryComponents.countryCode, template.countryCode)
          )
        );

      const existingCodes = existingComponents.map((c) => c.code);
      let code = '';
      let counter = 1;

      do {
        code = `CUSTOM_${counter.toString().padStart(3, '0')}`;
        counter++;
      } while (existingCodes.includes(code));

      // Merge template metadata with customizations
      const metadata = {
        ...template.metadata,
        ...(customizations?.metadata || {}),
      };

      const name =
        customizations?.name || (template.name as Record<string, string>).fr || 'Sans nom';

      const [newComponent] = await db
        .insert(customSalaryComponents)
        .values({
          tenantId,
          countryCode: template.countryCode,
          code,
          name,
          description: template.description || null,
          templateCode,
          metadata: metadata as ComponentMetadata,
          isActive: true,
          displayOrder: 0,
          createdBy: userId,
        })
        .returning();

      return newComponent as CustomSalaryComponent;
    }),

  /**
   * Update a custom component
   *
   * Now with version tracking:
   * - Detects formula changes in metadata.calculationRule
   * - Creates version history entry if formula changed
   * - Records who changed it and why (if provided)
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

      // Check if formula changed (for version tracking)
      const oldMetadata = existing.metadata as ComponentMetadata | null;
      const newMetadata = updates.metadata as ComponentMetadata | undefined;

      const oldFormula = oldMetadata?.calculationRule;
      const newFormula = newMetadata?.calculationRule;

      const formulaChanged =
        newFormula &&
        JSON.stringify(oldFormula) !== JSON.stringify(newFormula);

      // Update the component
      const [updated] = await db
        .update(customSalaryComponents)
        .set({
          ...updates,
          metadata: updates.metadata as ComponentMetadata | undefined,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(customSalaryComponents.id, componentId))
        .returning();

      // Create formula version if formula changed
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
          // Don't fail the update if version creation fails (non-critical)
        }
      }

      return updated as CustomSalaryComponent;
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
