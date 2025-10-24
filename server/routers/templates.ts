/**
 * Templates tRPC Router (GAP-DOC-002)
 *
 * API endpoints for managing payslip templates
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import { payslipTemplates } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const createTemplateSchema = z.object({
  templateName: z.string().min(1),
  layoutType: z.enum(['STANDARD', 'COMPACT', 'DETAILED']).default('STANDARD'),
  logoUrl: z.string().optional(),
  companyNameOverride: z.string().optional(),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
  fontFamily: z.string().default('Helvetica'),
  primaryColor: z.string().default('#000000'),
  showEmployerContributions: z.boolean().default(true),
  showYearToDate: z.boolean().default(true),
  showLeaveBalance: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

type ContextType = { user: { tenantId: string } };

export const templatesRouter = createTRPCRouter({
  // List all templates for tenant
  list: protectedProcedure.query(async ({ ctx }: { ctx: ContextType }) => {
    return await db
      .select()
      .from(payslipTemplates)
      .where(eq(payslipTemplates.tenantId, ctx.user.tenantId))
      .orderBy(payslipTemplates.isDefault, payslipTemplates.templateName);
  }),

  // Get single template
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }: { ctx: ContextType; input: { id: string } }) => {
      const [template] = await db
        .select()
        .from(payslipTemplates)
        .where(
          and(
            eq(payslipTemplates.id, input.id),
            eq(payslipTemplates.tenantId, ctx.user.tenantId)
          )
        );

      return template;
    }),

  // Create template
  create: protectedProcedure
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }: { ctx: ContextType; input: z.infer<typeof createTemplateSchema> }) => {
      // If isDefault is true, unset other defaults
      if (input.isDefault) {
        await db
          .update(payslipTemplates)
          .set({ isDefault: false })
          .where(eq(payslipTemplates.tenantId, ctx.user.tenantId));
      }

      const [template] = await db
        .insert(payslipTemplates)
        .values({
          tenantId: ctx.user.tenantId,
          ...input,
        })
        .returning();

      return template;
    }),

  // Update template
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }).merge(createTemplateSchema.partial())
    )
    .mutation(async ({ ctx, input }: { ctx: ContextType; input: { id: string } & Partial<z.infer<typeof createTemplateSchema>> }) => {
      const { id, ...data } = input;

      // If isDefault is true, unset other defaults
      if (data.isDefault) {
        await db
          .update(payslipTemplates)
          .set({ isDefault: false })
          .where(eq(payslipTemplates.tenantId, ctx.user.tenantId));
      }

      const [template] = await db
        .update(payslipTemplates)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(payslipTemplates.id, id),
            eq(payslipTemplates.tenantId, ctx.user.tenantId)
          )
        )
        .returning();

      return template;
    }),

  // Delete template
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }: { ctx: ContextType; input: { id: string } }) => {
      await db
        .delete(payslipTemplates)
        .where(
          and(
            eq(payslipTemplates.id, input.id),
            eq(payslipTemplates.tenantId, ctx.user.tenantId)
          )
        );

      return { success: true };
    }),
});
