/**
 * Dependents tRPC Router
 *
 * API endpoints for managing employee dependents with document verification.
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import { employeeDependents, employees } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  getVerifiedDependents,
  getAllDependents,
  getDependentCounts,
  calculateFiscalPartsFromDependents,
} from '@/features/employees/services/dependent-verification.service';

// ========================================
// Input Schemas
// ========================================

const listSchema = z.object({
  employeeId: z.string().uuid(),
});

const createSchema = z.object({
  employeeId: z.string().uuid(),
  tenantId: z.string().uuid(),
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  dateOfBirth: z.string().min(1, 'La date de naissance est requise'),
  relationship: z.enum(['child', 'spouse', 'other']),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  documentIssueDate: z.string().optional(),
  documentExpiryDate: z.string().optional(),
  documentUrl: z.string().optional(),
  notes: z.string().optional(),
  eligibleForFiscalParts: z.boolean().default(true),
  eligibleForCmu: z.boolean().default(true),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional(),
  relationship: z.enum(['child', 'spouse', 'other']).optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  documentIssueDate: z.string().optional(),
  documentExpiryDate: z.string().optional(),
  documentUrl: z.string().optional(),
  notes: z.string().optional(),
  eligibleForFiscalParts: z.boolean().optional(),
  eligibleForCmu: z.boolean().optional(),
  status: z.enum(['active', 'inactive', 'expired']).optional(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

const getStatsSchema = z.object({
  employeeId: z.string().uuid(),
});

// ========================================
// Router
// ========================================

export const dependentsRouter = createTRPCRouter({
  /**
   * List all dependents for an employee
   */
  list: publicProcedure
    .input(listSchema)
    .query(async ({ input, ctx }) => {
      try {
        const allDependents = await getAllDependents(
          input.employeeId,
          ctx.user.tenantId
        );

        return allDependents;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des personnes à charge',
        });
      }
    }),

  /**
   * Get verified dependents only
   */
  listVerified: publicProcedure
    .input(listSchema)
    .query(async ({ input, ctx }) => {
      try {
        const verified = await getVerifiedDependents(
          input.employeeId,
          ctx.user.tenantId
        );

        return verified;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des personnes vérifiées',
        });
      }
    }),

  /**
   * Get dependent statistics
   */
  getStats: publicProcedure
    .input(getStatsSchema)
    .query(async ({ input, ctx }) => {
      try {
        const stats = await getDependentCounts(
          input.employeeId,
          ctx.user.tenantId
        );

        return stats;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors du calcul des statistiques',
        });
      }
    }),

  /**
   * Create a new dependent
   */
  create: publicProcedure
    .input(createSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify employee belongs to tenant
        const [employee] = await db
          .select()
          .from(employees)
          .where(
            and(
              eq(employees.id, input.employeeId),
              eq(employees.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!employee) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Employé non trouvé',
          });
        }

        // Create dependent
        const [dependent] = await db
          .insert(employeeDependents)
          .values({
            employeeId: input.employeeId,
            tenantId: input.tenantId,
            firstName: input.firstName,
            lastName: input.lastName,
            dateOfBirth: input.dateOfBirth,
            relationship: input.relationship,
            documentType: input.documentType || null,
            documentNumber: input.documentNumber || null,
            documentIssueDate: input.documentIssueDate || null,
            documentExpiryDate: input.documentExpiryDate || null,
            documentUrl: input.documentUrl || null,
            notes: input.notes || null,
            eligibleForFiscalParts: input.eligibleForFiscalParts,
            eligibleForCmu: input.eligibleForCmu,
            createdBy: ctx.user.id,
            updatedBy: ctx.user.id,
          })
          .returning();

        // Recalculate fiscal parts for employee
        const fiscalParts = await calculateFiscalPartsFromDependents(
          input.employeeId,
          input.tenantId
        );

        // Update employee record
        await db
          .update(employees)
          .set({
            fiscalParts: fiscalParts.toString(),
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(employees.id, input.employeeId));

        return dependent;
      } catch (error: any) {
        console.error('Error creating dependent:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la création',
        });
      }
    }),

  /**
   * Update an existing dependent
   */
  update: publicProcedure
    .input(updateSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Get existing dependent
        const [existing] = await db
          .select()
          .from(employeeDependents)
          .where(
            and(
              eq(employeeDependents.id, input.id),
              eq(employeeDependents.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Personne à charge non trouvée',
          });
        }

        // Update dependent
        const { id, ...updateData } = input;
        const [updated] = await db
          .update(employeeDependents)
          .set({
            ...updateData,
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(employeeDependents.id, input.id))
          .returning();

        // Recalculate fiscal parts for employee
        const fiscalParts = await calculateFiscalPartsFromDependents(
          existing.employeeId,
          existing.tenantId
        );

        // Update employee record
        await db
          .update(employees)
          .set({
            fiscalParts: fiscalParts.toString(),
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(employees.id, existing.employeeId));

        return updated;
      } catch (error: any) {
        console.error('Error updating dependent:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la mise à jour',
        });
      }
    }),

  /**
   * Delete a dependent (soft delete - set status to inactive)
   */
  delete: publicProcedure
    .input(deleteSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Get existing dependent
        const [existing] = await db
          .select()
          .from(employeeDependents)
          .where(
            and(
              eq(employeeDependents.id, input.id),
              eq(employeeDependents.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Personne à charge non trouvée',
          });
        }

        // Soft delete (set status to inactive)
        await db
          .update(employeeDependents)
          .set({
            status: 'inactive',
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(employeeDependents.id, input.id));

        // Recalculate fiscal parts for employee
        const fiscalParts = await calculateFiscalPartsFromDependents(
          existing.employeeId,
          existing.tenantId
        );

        // Update employee record
        await db
          .update(employees)
          .set({
            fiscalParts: fiscalParts.toString(),
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(employees.id, existing.employeeId));

        return { success: true };
      } catch (error: any) {
        console.error('Error deleting dependent:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la suppression',
        });
      }
    }),
});
