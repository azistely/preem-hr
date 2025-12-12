/**
 * HR Forms Router
 *
 * Manages dynamic form templates and submissions.
 * Used by Performance (evaluations) and Training (assessments) modules.
 *
 * Endpoints:
 * - templates: CRUD for form templates
 * - submissions: CRUD for form submissions
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, hrManagerProcedure, superAdminProcedure } from '@/server/api/trpc';
import { hrFormTemplates, hrFormSubmissions } from '@/lib/db/schema/hr-forms';
import { eq, and, desc, ilike, or, sql } from 'drizzle-orm';
import type {
  FormDefinition,
  FormFieldDefinition,
  FormScoringConfig,
  ComputedScores,
  RatingScaleConfig,
} from '@/lib/db/schema/hr-forms';
import { nanoid } from 'nanoid';
import { DEFAULT_EVALUATION_TEMPLATES } from '@/lib/db/seeds/evaluation-templates';

// =============================================================================
// ROUTER
// =============================================================================

export const hrFormsRouter = createTRPCRouter({
  // ===========================================================================
  // TEMPLATES
  // ===========================================================================
  templates: createTRPCRouter({
    /**
     * List all form templates
     */
    list: protectedProcedure
      .input(z.object({
        category: z.string().optional(),
        module: z.enum(['performance', 'training', 'shared']).optional(),
        search: z.string().optional(),
        isActive: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [
          or(
            eq(hrFormTemplates.tenantId, tenantId),
            eq(hrFormTemplates.isSystem, true)
          )!,
        ];

        if (input.category) {
          conditions.push(eq(hrFormTemplates.category, input.category));
        }

        if (input.module) {
          conditions.push(eq(hrFormTemplates.module, input.module));
        }

        if (input.isActive !== undefined) {
          conditions.push(eq(hrFormTemplates.isActive, input.isActive));
        }

        if (input.search) {
          conditions.push(
            or(
              ilike(hrFormTemplates.name, `%${input.search}%`),
              ilike(hrFormTemplates.description, `%${input.search}%`)
            )!
          );
        }

        const templates = await ctx.db
          .select()
          .from(hrFormTemplates)
          .where(and(...conditions))
          .orderBy(desc(hrFormTemplates.updatedAt))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(hrFormTemplates)
          .where(and(...conditions));

        return {
          data: templates,
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    /**
     * Get a single template by ID
     */
    getById: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [template] = await ctx.db
          .select()
          .from(hrFormTemplates)
          .where(and(
            eq(hrFormTemplates.id, input.id),
            or(
              eq(hrFormTemplates.tenantId, tenantId),
              eq(hrFormTemplates.isSystem, true)
            )
          ))
          .limit(1);

        return template ?? null;
      }),

    /**
     * Create a new form template (HR only)
     */
    create: hrManagerProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        module: z.enum(['performance', 'training', 'shared']),
        category: z.string(),
        definition: z.any(), // FormDefinition
        scoringEnabled: z.boolean().default(false),
        scoringConfig: z.any().optional(), // FormScoringConfig
        defaultRatingScale: z.any().optional(), // RatingScaleConfig
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const slug = `${input.name.toLowerCase().replace(/\s+/g, '-')}-${nanoid(6)}`;

        const [created] = await ctx.db
          .insert(hrFormTemplates)
          .values({
            tenantId,
            name: input.name,
            slug,
            description: input.description ?? null,
            module: input.module,
            category: input.category,
            definition: input.definition as FormDefinition,
            scoringEnabled: input.scoringEnabled,
            scoringConfig: input.scoringConfig as FormScoringConfig ?? null,
            defaultRatingScale: input.defaultRatingScale ?? null,
            isActive: input.isActive,
            isSystem: false,
            version: 1,
            createdBy: ctx.user.id,
          })
          .returning();

        return created;
      }),

    /**
     * Update a form template (HR only)
     */
    update: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        definition: z.any().optional(), // FormDefinition
        scoringEnabled: z.boolean().optional(),
        scoringConfig: z.any().optional(), // FormScoringConfig
        defaultRatingScale: z.any().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Get current version
        const [current] = await ctx.db
          .select({ version: hrFormTemplates.version, isSystem: hrFormTemplates.isSystem })
          .from(hrFormTemplates)
          .where(and(
            eq(hrFormTemplates.id, input.id),
            eq(hrFormTemplates.tenantId, tenantId)
          ))
          .limit(1);

        if (!current) {
          throw new Error('Template not found');
        }

        if (current.isSystem) {
          throw new Error('Cannot modify system templates');
        }

        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.scoringEnabled !== undefined) updateData.scoringEnabled = input.scoringEnabled;
        if (input.scoringConfig !== undefined) updateData.scoringConfig = input.scoringConfig;
        if (input.defaultRatingScale !== undefined) updateData.defaultRatingScale = input.defaultRatingScale;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;
        if (input.definition !== undefined) {
          updateData.definition = input.definition;
          updateData.version = current.version + 1;
        }

        const [updated] = await ctx.db
          .update(hrFormTemplates)
          .set(updateData)
          .where(and(
            eq(hrFormTemplates.id, input.id),
            eq(hrFormTemplates.tenantId, tenantId)
          ))
          .returning();

        return updated;
      }),

    /**
     * Clone a template (HR only)
     */
    clone: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        newName: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Get original
        const [original] = await ctx.db
          .select()
          .from(hrFormTemplates)
          .where(and(
            eq(hrFormTemplates.id, input.id),
            or(
              eq(hrFormTemplates.tenantId, tenantId),
              eq(hrFormTemplates.isSystem, true)
            )
          ))
          .limit(1);

        if (!original) {
          throw new Error('Template not found');
        }

        const slug = `${input.newName.toLowerCase().replace(/\s+/g, '-')}-${nanoid(6)}`;

        // Create clone
        const [cloned] = await ctx.db
          .insert(hrFormTemplates)
          .values({
            tenantId,
            name: input.newName,
            slug,
            description: original.description,
            module: original.module,
            category: original.category,
            definition: original.definition,
            scoringEnabled: original.scoringEnabled,
            scoringConfig: original.scoringConfig,
            defaultRatingScale: original.defaultRatingScale,
            isActive: false, // Start as inactive
            isSystem: false,
            version: 1,
            createdBy: ctx.user.id,
          })
          .returning();

        return cloned;
      }),

    /**
     * Delete a template (soft delete via isActive) (HR only)
     */
    delete: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Check if system template
        const [template] = await ctx.db
          .select({ isSystem: hrFormTemplates.isSystem })
          .from(hrFormTemplates)
          .where(and(
            eq(hrFormTemplates.id, input.id),
            eq(hrFormTemplates.tenantId, tenantId)
          ))
          .limit(1);

        if (!template) {
          throw new Error('Template not found');
        }

        if (template.isSystem) {
          throw new Error('Cannot delete system templates');
        }

        await ctx.db
          .update(hrFormTemplates)
          .set({
            isActive: false,
            updatedAt: new Date(),
          })
          .where(and(
            eq(hrFormTemplates.id, input.id),
            eq(hrFormTemplates.tenantId, tenantId)
          ));

        return { success: true };
      }),

    /**
     * Seed system templates (Super Admin only)
     * Creates default evaluation templates for all tenants
     */
    seedSystemTemplates: superAdminProcedure
      .mutation(async ({ ctx }) => {
        const tenantId = ctx.user.tenantId;
        const results: { name: string; status: 'created' | 'exists' | 'error'; error?: string }[] = [];

        for (const template of DEFAULT_EVALUATION_TEMPLATES) {
          try {
            // Check if template already exists by slug
            const [existing] = await ctx.db
              .select({ id: hrFormTemplates.id })
              .from(hrFormTemplates)
              .where(and(
                eq(hrFormTemplates.slug, template.slug),
                eq(hrFormTemplates.isSystem, true)
              ))
              .limit(1);

            if (existing) {
              results.push({ name: template.name, status: 'exists' });
              continue;
            }

            // Create the template
            await ctx.db
              .insert(hrFormTemplates)
              .values({
                tenantId,
                name: template.name,
                slug: template.slug,
                description: template.description,
                module: template.module,
                category: template.category,
                definition: template.definition as FormDefinition,
                scoringEnabled: template.scoringEnabled,
                scoringConfig: template.scoringConfig as FormScoringConfig | null,
                defaultRatingScale: template.defaultRatingScale as RatingScaleConfig,
                isSystem: true,
                isActive: true,
                version: 1,
                createdBy: ctx.user.id,
              });

            results.push({ name: template.name, status: 'created' });
          } catch (error) {
            results.push({
              name: template.name,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        const created = results.filter(r => r.status === 'created').length;
        const exists = results.filter(r => r.status === 'exists').length;
        const errors = results.filter(r => r.status === 'error').length;

        return {
          success: errors === 0,
          message: `${created} templates créés, ${exists} existants, ${errors} erreurs`,
          results,
        };
      }),
  }),

  // ===========================================================================
  // SUBMISSIONS
  // ===========================================================================
  submissions: createTRPCRouter({
    /**
     * List submissions
     */
    list: protectedProcedure
      .input(z.object({
        templateId: z.string().uuid().optional(),
        respondentEmployeeId: z.string().uuid().optional(),
        subjectEmployeeId: z.string().uuid().optional(),
        status: z.enum(['draft', 'submitted', 'reviewed']).optional(),
        sourceType: z.string().optional(),
        sourceId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(hrFormSubmissions.tenantId, tenantId)];

        // Non-HR can only see their own submissions
        const isHr = ctx.user.role === 'super_admin' || ctx.user.role === 'tenant_admin';
        if (!isHr && ctx.user.employeeId) {
          conditions.push(
            or(
              eq(hrFormSubmissions.respondentEmployeeId, ctx.user.employeeId),
              eq(hrFormSubmissions.subjectEmployeeId, ctx.user.employeeId)
            )!
          );
        }

        if (input.templateId) {
          conditions.push(eq(hrFormSubmissions.templateId, input.templateId));
        }

        if (input.respondentEmployeeId) {
          conditions.push(eq(hrFormSubmissions.respondentEmployeeId, input.respondentEmployeeId));
        }

        if (input.subjectEmployeeId) {
          conditions.push(eq(hrFormSubmissions.subjectEmployeeId, input.subjectEmployeeId));
        }

        if (input.status) {
          conditions.push(eq(hrFormSubmissions.status, input.status));
        }

        if (input.sourceType) {
          conditions.push(eq(hrFormSubmissions.sourceType, input.sourceType));
        }

        if (input.sourceId) {
          conditions.push(eq(hrFormSubmissions.sourceId, input.sourceId));
        }

        const submissions = await ctx.db
          .select()
          .from(hrFormSubmissions)
          .where(and(...conditions))
          .orderBy(desc(hrFormSubmissions.updatedAt))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(hrFormSubmissions)
          .where(and(...conditions));

        return {
          data: submissions,
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    /**
     * Get a single submission by ID
     */
    getById: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [submission] = await ctx.db
          .select()
          .from(hrFormSubmissions)
          .where(and(
            eq(hrFormSubmissions.id, input.id),
            eq(hrFormSubmissions.tenantId, tenantId)
          ))
          .limit(1);

        // Check access
        const isHr = ctx.user.role === 'super_admin' || ctx.user.role === 'tenant_admin';
        if (!isHr && ctx.user.employeeId) {
          if (submission?.respondentEmployeeId !== ctx.user.employeeId &&
              submission?.subjectEmployeeId !== ctx.user.employeeId) {
            throw new Error('Access denied');
          }
        }

        return submission ?? null;
      }),

    /**
     * Create or update a submission (draft or submit)
     */
    save: protectedProcedure
      .input(z.object({
        id: z.string().uuid().optional(), // If provided, update existing
        templateId: z.string().uuid(),
        sourceType: z.string(), // e.g., 'performance_evaluation', 'training_session'
        sourceId: z.string().uuid(),
        respondentEmployeeId: z.string().uuid().optional(),
        subjectEmployeeId: z.string().uuid().optional(),
        respondentRole: z.string().optional(),
        data: z.record(z.string(), z.any()),
        status: z.enum(['draft', 'submitted']).default('draft'),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Calculate score if submitting
        let scores: ComputedScores | null = null;
        let totalScore: string | null = null;
        let maxPossibleScore: string | null = null;

        if (input.status === 'submitted') {
          // Get template to calculate score
          const [template] = await ctx.db
            .select({
              definition: hrFormTemplates.definition,
              scoringEnabled: hrFormTemplates.scoringEnabled,
              scoringConfig: hrFormTemplates.scoringConfig,
            })
            .from(hrFormTemplates)
            .where(eq(hrFormTemplates.id, input.templateId))
            .limit(1);

          if (template?.scoringEnabled && template.scoringConfig && template.definition) {
            const definition = template.definition as FormDefinition;
            const config = template.scoringConfig as FormScoringConfig;

            // Calculate scores
            const byField: Record<string, number> = {};
            const bySection: Record<string, number> = {};

            const scorableFields = definition.fields.filter((f: FormFieldDefinition) =>
              f.type === 'rating' || f.type === 'slider' || f.type === 'number'
            );

            for (const field of scorableFields) {
              const value = Number(input.data[field.id]) || 0;
              byField[field.id] = value;
            }

            for (const section of definition.sections) {
              const sectionFields = scorableFields.filter((f: FormFieldDefinition) => f.section === section.id);
              if (sectionFields.length === 0) continue;
              const sectionValues = sectionFields.map((f: FormFieldDefinition) => byField[f.id] || 0);
              bySection[section.id] = sectionValues.reduce((a: number, b: number) => a + b, 0) / sectionValues.length;
            }

            const maxPerField = scorableFields.reduce((sum: number, f: FormFieldDefinition) => sum + (f.max || 5), 0);

            let total: number;
            switch (config.method) {
              case 'sum':
                total = Object.values(byField).reduce((a, b) => a + b, 0);
                break;
              case 'average':
                total = scorableFields.length > 0
                  ? Object.values(byField).reduce((a, b) => a + b, 0) / scorableFields.length
                  : 0;
                break;
              case 'weighted':
                if (!config.fieldWeights) {
                  total = scorableFields.length > 0
                    ? Object.values(byField).reduce((a, b) => a + b, 0) / scorableFields.length
                    : 0;
                } else {
                  const totalWeight = Object.values(config.fieldWeights).reduce((a, b) => a + b, 0);
                  total = scorableFields.reduce((sum: number, f: FormFieldDefinition) => {
                    const weight = config.fieldWeights![f.id] || 1;
                    return sum + (byField[f.id] || 0) * weight;
                  }, 0) / (totalWeight || 1);
                }
                break;
              default:
                total = scorableFields.length > 0
                  ? Object.values(byField).reduce((a, b) => a + b, 0) / scorableFields.length
                  : 0;
            }

            const percentage = scorableFields.length > 0
              ? (total / (maxPerField / scorableFields.length)) * 100
              : 0;

            let category: string | undefined;
            if (config.thresholds) {
              for (const threshold of config.thresholds) {
                if (percentage >= threshold.min && percentage <= threshold.max) {
                  category = threshold.label;
                  break;
                }
              }
            }

            scores = {
              byField,
              bySection,
              total: Math.round(total * 100) / 100,
              percentage: Math.round(percentage * 100) / 100,
              category,
            };

            totalScore = scores.total.toString();
            maxPossibleScore = (maxPerField / scorableFields.length).toString();
          }
        }

        if (input.id) {
          // Update existing
          const [updated] = await ctx.db
            .update(hrFormSubmissions)
            .set({
              data: input.data,
              status: input.status,
              scores: scores,
              totalScore: totalScore,
              maxPossibleScore: maxPossibleScore,
              submittedAt: input.status === 'submitted' ? new Date() : undefined,
              lastSavedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(and(
              eq(hrFormSubmissions.id, input.id),
              eq(hrFormSubmissions.tenantId, tenantId)
            ))
            .returning();

          return updated;
        } else {
          // Create new
          const [created] = await ctx.db
            .insert(hrFormSubmissions)
            .values({
              tenantId,
              templateId: input.templateId,
              sourceType: input.sourceType,
              sourceId: input.sourceId,
              respondentEmployeeId: input.respondentEmployeeId ?? null,
              respondentUserId: ctx.user.id,
              respondentRole: input.respondentRole ?? null,
              subjectEmployeeId: input.subjectEmployeeId ?? null,
              data: input.data,
              status: input.status,
              scores: scores,
              totalScore: totalScore,
              maxPossibleScore: maxPossibleScore,
              startedAt: new Date(),
              submittedAt: input.status === 'submitted' ? new Date() : null,
              lastSavedAt: new Date(),
            })
            .returning();

          return created;
        }
      }),

    /**
     * Update submission status (HR only for reviewed)
     */
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        status: z.enum(['draft', 'submitted', 'reviewed']),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Only HR can mark as reviewed
        if (input.status === 'reviewed') {
          const isHr = ctx.user.role === 'super_admin' || ctx.user.role === 'tenant_admin';
          if (!isHr) {
            throw new Error('Only HR can mark submissions as reviewed');
          }
        }

        const [updated] = await ctx.db
          .update(hrFormSubmissions)
          .set({
            status: input.status,
            submittedAt: input.status === 'submitted' ? new Date() : undefined,
            updatedAt: new Date(),
          })
          .where(and(
            eq(hrFormSubmissions.id, input.id),
            eq(hrFormSubmissions.tenantId, tenantId)
          ))
          .returning();

        return updated;
      }),
  }),
});

export default hrFormsRouter;
