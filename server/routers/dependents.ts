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
  calculateMaritalStatusFromDependents,
} from '@/features/employees/services/dependent-verification.service';

// ========================================
// Helper Functions
// ========================================

/**
 * Calculate if a dependent is verified based on relationship and document data
 *
 * Rules:
 * - Spouse: Requires document type, document number, and valid expiry date
 * - Child under 21: Auto-verified (no document needed)
 * - Child 21+: Requires document type, document number, and valid expiry date
 * - Other: Requires document type, document number, and valid expiry date
 */
function calculateIsVerified(
  relationship: 'child' | 'spouse' | 'other',
  dateOfBirth: string,
  documentType: string | null | undefined,
  documentNumber: string | null | undefined,
  documentExpiryDate: string | null | undefined
): boolean {
  // Calculate age
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  // CHILD UNDER 21: Auto-verified
  if (relationship === 'child' && age < 21) {
    return true;
  }

  // SPOUSE, CHILD 21+, OTHER: Requires document
  // Check if document type and number are provided
  const hasDocumentType = !!documentType && documentType.trim() !== '';
  const hasDocumentNumber = !!documentNumber && documentNumber.trim() !== '';

  // For spouse/other/child21+, we need both document type and number
  // Expiry date is optional (some documents don't expire)
  return hasDocumentType && hasDocumentNumber;
}

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

        // Auto-calculate isVerified based on relationship and document data
        const isVerified = calculateIsVerified(
          input.relationship,
          input.dateOfBirth,
          input.documentType,
          input.documentNumber,
          input.documentExpiryDate
        );

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
            isVerified,
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

        // Recalculate fiscal parts, dependent count, and marital status for employee
        const fiscalParts = await calculateFiscalPartsFromDependents(
          input.employeeId,
          input.tenantId
        );

        const dependentCounts = await getDependentCounts(
          input.employeeId,
          input.tenantId
        );

        const maritalStatus = await calculateMaritalStatusFromDependents(
          input.employeeId,
          input.tenantId
        );

        // Update employee record with fiscal parts, dependent count, and marital status
        await db
          .update(employees)
          .set({
            fiscalParts: fiscalParts.toString(),
            dependentChildren: dependentCounts.totalDependents,
            maritalStatus: maritalStatus,
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

        // Merge updated data with existing data
        const mergedData = {
          relationship: input.relationship || existing.relationship,
          dateOfBirth: input.dateOfBirth || existing.dateOfBirth,
          documentType: input.documentType !== undefined ? input.documentType : existing.documentType,
          documentNumber: input.documentNumber !== undefined ? input.documentNumber : existing.documentNumber,
          documentExpiryDate: input.documentExpiryDate !== undefined ? input.documentExpiryDate : existing.documentExpiryDate,
        };

        // Auto-calculate isVerified based on relationship and document data
        const isVerified = calculateIsVerified(
          mergedData.relationship as 'child' | 'spouse' | 'other',
          mergedData.dateOfBirth,
          mergedData.documentType,
          mergedData.documentNumber,
          mergedData.documentExpiryDate
        );

        // Update dependent
        const { id, ...updateData } = input;
        const [updated] = await db
          .update(employeeDependents)
          .set({
            ...updateData,
            isVerified,
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(employeeDependents.id, input.id))
          .returning();

        // Recalculate fiscal parts, dependent count, and marital status for employee
        const fiscalParts = await calculateFiscalPartsFromDependents(
          existing.employeeId,
          existing.tenantId
        );

        const dependentCounts = await getDependentCounts(
          existing.employeeId,
          existing.tenantId
        );

        const maritalStatus = await calculateMaritalStatusFromDependents(
          existing.employeeId,
          existing.tenantId
        );

        // Update employee record with fiscal parts, dependent count, and marital status
        await db
          .update(employees)
          .set({
            fiscalParts: fiscalParts.toString(),
            dependentChildren: dependentCounts.totalDependents,
            maritalStatus: maritalStatus,
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

        // Recalculate fiscal parts, dependent count, and marital status for employee
        const fiscalParts = await calculateFiscalPartsFromDependents(
          existing.employeeId,
          existing.tenantId
        );

        const dependentCounts = await getDependentCounts(
          existing.employeeId,
          existing.tenantId
        );

        const maritalStatus = await calculateMaritalStatusFromDependents(
          existing.employeeId,
          existing.tenantId
        );

        // Update employee record with fiscal parts, dependent count, and marital status
        await db
          .update(employees)
          .set({
            fiscalParts: fiscalParts.toString(),
            dependentChildren: dependentCounts.totalDependents,
            maritalStatus: maritalStatus,
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
