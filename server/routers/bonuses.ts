/**
 * Bonuses Router - Variable Pay Management
 *
 * Provides CRUD operations and workflows for employee bonuses/variable pay.
 * Integrates with payroll calculation engine.
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import { bonuses, BonusType, BonusStatus } from '@/lib/db/schema/bonuses';
import { employees } from '@/lib/db/schema/employees';
import { eq, and, gte, lte, inArray, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

/**
 * Zod schemas for input validation
 */
const createBonusSchema = z.object({
  employeeId: z.string().uuid(),
  bonusType: z.enum(['performance', 'holiday', 'project', 'sales_commission', 'attendance', 'retention', 'other']),
  amount: z.number().positive().multipleOf(0.01),
  period: z.string().regex(/^\d{4}-\d{2}-01$/), // YYYY-MM-01 format
  description: z.string().min(1).max(500).optional(),
  notes: z.string().max(1000).optional(),
  isTaxable: z.boolean().default(true),
  isSubjectToSocialSecurity: z.boolean().default(true),
});

const updateBonusSchema = z.object({
  id: z.string().uuid(),
  bonusType: z.enum(['performance', 'holiday', 'project', 'sales_commission', 'attendance', 'retention', 'other']).optional(),
  amount: z.number().positive().multipleOf(0.01).optional(),
  period: z.string().regex(/^\d{4}-\d{2}-01$/).optional(),
  description: z.string().min(1).max(500).optional(),
  notes: z.string().max(1000).optional(),
  isTaxable: z.boolean().optional(),
  isSubjectToSocialSecurity: z.boolean().optional(),
});

const approveBonusSchema = z.object({
  id: z.string().uuid(),
  approve: z.boolean(),
  rejectedReason: z.string().max(500).optional(),
});

const bulkCreateSchema = z.object({
  bonuses: z.array(z.object({
    employeeId: z.string().uuid(),
    bonusType: z.enum(['performance', 'holiday', 'project', 'sales_commission', 'attendance', 'retention', 'other']),
    amount: z.number().positive(),
    period: z.string().regex(/^\d{4}-\d{2}-01$/),
    description: z.string().optional(),
    isTaxable: z.boolean().default(true),
    isSubjectToSocialSecurity: z.boolean().default(true),
  })).min(1).max(100), // Max 100 bonuses per bulk operation
});

export const bonusesRouter = createTRPCRouter({
  /**
   * List bonuses with filtering
   */
  list: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid().optional(),
      period: z.string().regex(/^\d{4}-\d{2}-01$/).optional(),
      periodStart: z.string().regex(/^\d{4}-\d{2}-01$/).optional(),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-01$/).optional(),
      status: z.enum(['pending', 'approved', 'paid', 'cancelled']).optional(),
      bonusType: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(bonuses.tenantId, ctx.user.tenantId)];

      if (input.employeeId) {
        conditions.push(eq(bonuses.employeeId, input.employeeId));
      }

      if (input.period) {
        conditions.push(eq(bonuses.period, input.period));
      }

      if (input.periodStart && input.periodEnd) {
        conditions.push(gte(bonuses.period, input.periodStart));
        conditions.push(lte(bonuses.period, input.periodEnd));
      }

      if (input.status) {
        conditions.push(eq(bonuses.status, input.status));
      }

      if (input.bonusType) {
        conditions.push(eq(bonuses.bonusType, input.bonusType));
      }

      const [results, totalCount] = await Promise.all([
        db
          .select({
            id: bonuses.id,
            employeeId: bonuses.employeeId,
            employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
            employeeNumber: employees.employeeNumber,
            bonusType: bonuses.bonusType,
            amount: bonuses.amount,
            currency: bonuses.currency,
            period: bonuses.period,
            description: bonuses.description,
            isTaxable: bonuses.isTaxable,
            isSubjectToSocialSecurity: bonuses.isSubjectToSocialSecurity,
            status: bonuses.status,
            approvedBy: bonuses.approvedBy,
            approvedAt: bonuses.approvedAt,
            createdAt: bonuses.createdAt,
          })
          .from(bonuses)
          .innerJoin(employees, eq(bonuses.employeeId, employees.id))
          .where(and(...conditions))
          .orderBy(desc(bonuses.period), desc(bonuses.createdAt))
          .limit(input.limit)
          .offset(input.offset),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(bonuses)
          .where(and(...conditions))
          .then(rows => rows[0]?.count ?? 0),
      ]);

      return {
        bonuses: results,
        total: totalCount,
        hasMore: input.offset + results.length < totalCount,
      };
    }),

  /**
   * Get single bonus by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await db
        .select({
          id: bonuses.id,
          tenantId: bonuses.tenantId,
          employeeId: bonuses.employeeId,
          employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
          employeeNumber: employees.employeeNumber,
          bonusType: bonuses.bonusType,
          amount: bonuses.amount,
          currency: bonuses.currency,
          period: bonuses.period,
          description: bonuses.description,
          notes: bonuses.notes,
          isTaxable: bonuses.isTaxable,
          isSubjectToSocialSecurity: bonuses.isSubjectToSocialSecurity,
          status: bonuses.status,
          approvedBy: bonuses.approvedBy,
          approvedAt: bonuses.approvedAt,
          rejectedReason: bonuses.rejectedReason,
          includedInPayrollRunId: bonuses.includedInPayrollRunId,
          createdAt: bonuses.createdAt,
          updatedAt: bonuses.updatedAt,
          createdBy: bonuses.createdBy,
        })
        .from(bonuses)
        .innerJoin(employees, eq(bonuses.employeeId, employees.id))
        .where(and(
          eq(bonuses.id, input.id),
          eq(bonuses.tenantId, ctx.user.tenantId)
        ))
        .limit(1);

      if (!result[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Prime non trouvée',
        });
      }

      return result[0];
    }),

  /**
   * Create a new bonus
   */
  create: protectedProcedure
    .input(createBonusSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify employee belongs to tenant
      const employee = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(
          eq(employees.id, input.employeeId),
          eq(employees.tenantId, ctx.user.tenantId)
        ))
        .limit(1);

      if (!employee[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Employé non trouvé',
        });
      }

      // Insert bonus
      const result = await db
        .insert(bonuses)
        .values({
          tenantId: ctx.user.tenantId,
          employeeId: input.employeeId,
          bonusType: input.bonusType,
          amount: input.amount.toString(),
          period: input.period,
          description: input.description,
          notes: input.notes,
          isTaxable: input.isTaxable,
          isSubjectToSocialSecurity: input.isSubjectToSocialSecurity,
          status: 'pending',
          createdBy: ctx.user.id,
        })
        .returning();

      return result[0];
    }),

  /**
   * Update existing bonus
   */
  update: protectedProcedure
    .input(updateBonusSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify bonus exists and belongs to tenant
      const existing = await db
        .select({ id: bonuses.id, status: bonuses.status })
        .from(bonuses)
        .where(and(
          eq(bonuses.id, input.id),
          eq(bonuses.tenantId, ctx.user.tenantId)
        ))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Prime non trouvée',
        });
      }

      // Can't update paid bonuses
      if (existing[0].status === 'paid') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible de modifier une prime déjà payée',
        });
      }

      const { id, ...updateData } = input;
      const updateValues: any = {};

      if (updateData.bonusType) updateValues.bonusType = updateData.bonusType;
      if (updateData.amount) updateValues.amount = updateData.amount.toString();
      if (updateData.period) updateValues.period = updateData.period;
      if (updateData.description !== undefined) updateValues.description = updateData.description;
      if (updateData.notes !== undefined) updateValues.notes = updateData.notes;
      if (updateData.isTaxable !== undefined) updateValues.isTaxable = updateData.isTaxable;
      if (updateData.isSubjectToSocialSecurity !== undefined) {
        updateValues.isSubjectToSocialSecurity = updateData.isSubjectToSocialSecurity;
      }

      const result = await db
        .update(bonuses)
        .set(updateValues)
        .where(eq(bonuses.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Delete bonus
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify bonus exists and belongs to tenant
      const existing = await db
        .select({ id: bonuses.id, status: bonuses.status })
        .from(bonuses)
        .where(and(
          eq(bonuses.id, input.id),
          eq(bonuses.tenantId, ctx.user.tenantId)
        ))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Prime non trouvée',
        });
      }

      // Can't delete paid bonuses
      if (existing[0].status === 'paid') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible de supprimer une prime déjà payée',
        });
      }

      await db.delete(bonuses).where(eq(bonuses.id, input.id));

      return { success: true };
    }),

  /**
   * Approve or reject bonus
   */
  approve: protectedProcedure
    .input(approveBonusSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await db
        .select({ id: bonuses.id, status: bonuses.status })
        .from(bonuses)
        .where(and(
          eq(bonuses.id, input.id),
          eq(bonuses.tenantId, ctx.user.tenantId)
        ))
        .limit(1);

      if (!existing[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Prime non trouvée',
        });
      }

      if (existing[0].status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette prime a déjà été traitée',
        });
      }

      const updateValues: any = {
        approvedBy: ctx.user.id,
        approvedAt: new Date(),
      };

      if (input.approve) {
        updateValues.status = 'approved';
      } else {
        updateValues.status = 'cancelled';
        updateValues.rejectedReason = input.rejectedReason;
      }

      const result = await db
        .update(bonuses)
        .set(updateValues)
        .where(eq(bonuses.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Get bonuses for payroll calculation period
   */
  getForPayroll: protectedProcedure
    .input(z.object({
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      employeeIds: z.array(z.string().uuid()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(bonuses.tenantId, ctx.user.tenantId),
        eq(bonuses.status, 'approved'), // Only approved bonuses
        gte(bonuses.period, input.periodStart.substring(0, 8) + '01'), // Convert to YYYY-MM-01
        lte(bonuses.period, input.periodEnd.substring(0, 8) + '01'),
      ];

      if (input.employeeIds && input.employeeIds.length > 0) {
        conditions.push(inArray(bonuses.employeeId, input.employeeIds));
      }

      const results = await db
        .select({
          id: bonuses.id,
          employeeId: bonuses.employeeId,
          bonusType: bonuses.bonusType,
          amount: bonuses.amount,
          period: bonuses.period,
          description: bonuses.description,
          isTaxable: bonuses.isTaxable,
          isSubjectToSocialSecurity: bonuses.isSubjectToSocialSecurity,
        })
        .from(bonuses)
        .where(and(...conditions))
        .orderBy(bonuses.employeeId, bonuses.period);

      return results;
    }),

  /**
   * Bulk create bonuses (e.g., annual holiday bonus for all employees)
   */
  bulkCreate: protectedProcedure
    .input(bulkCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify all employees belong to tenant
      const employeeIds = input.bonuses.map(b => b.employeeId);
      const validEmployees = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(
          inArray(employees.id, employeeIds),
          eq(employees.tenantId, ctx.user.tenantId)
        ));

      if (validEmployees.length !== employeeIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Certains employés sont invalides',
        });
      }

      // Insert bonuses
      const bonusesToInsert = input.bonuses.map(bonus => ({
        tenantId: ctx.user.tenantId,
        employeeId: bonus.employeeId,
        bonusType: bonus.bonusType,
        amount: bonus.amount.toString(),
        period: bonus.period,
        description: bonus.description,
        isTaxable: bonus.isTaxable,
        isSubjectToSocialSecurity: bonus.isSubjectToSocialSecurity,
        status: 'pending' as const,
        createdBy: ctx.user.id,
      }));

      const results = await db.insert(bonuses).values(bonusesToInsert).returning();

      return {
        created: results.length,
        bonuses: results,
      };
    }),

  /**
   * Get bonus statistics by period
   */
  getStatistics: protectedProcedure
    .input(z.object({
      periodStart: z.string().regex(/^\d{4}-\d{2}-01$/),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-01$/),
    }))
    .query(async ({ ctx, input }) => {
      const stats = await db
        .select({
          bonusType: bonuses.bonusType,
          status: bonuses.status,
          count: sql<number>`count(*)::int`,
          totalAmount: sql<string>`sum(${bonuses.amount})`,
        })
        .from(bonuses)
        .where(and(
          eq(bonuses.tenantId, ctx.user.tenantId),
          gte(bonuses.period, input.periodStart),
          lte(bonuses.period, input.periodEnd)
        ))
        .groupBy(bonuses.bonusType, bonuses.status);

      return stats;
    }),
});
