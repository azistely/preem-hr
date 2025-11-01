/**
 * Contracts tRPC Router
 *
 * Handles contract-related operations including updating contract details.
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import { employmentContracts, employees } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const contractsRouter = createTRPCRouter({
  /**
   * Update existing contract
   * Allows updating key contract fields (not the type)
   */
  updateContract: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        contractNumber: z.string().nullable().optional(),
        startDate: z.string(),
        endDate: z.string().nullable().optional(),
        cddReason: z.string().nullable().optional(),
        cddtiTaskDescription: z.string().nullable().optional(),
        signedDate: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      // Get the contract to verify ownership and existence
      const [existingContract] = await db
        .select()
        .from(employmentContracts)
        .where(
          and(
            eq(employmentContracts.id, input.id),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (!existingContract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contrat non trouvé',
        });
      }

      // Verify user has permission (must be from same tenant)
      if (existingContract.tenantId !== user.tenantId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Accès refusé',
        });
      }

      // Update the contract
      const [updated] = await db
        .update(employmentContracts)
        .set({
          contractNumber: input.contractNumber !== undefined ? input.contractNumber : existingContract.contractNumber,
          startDate: input.startDate,
          endDate: input.endDate !== undefined ? input.endDate : existingContract.endDate,
          cddReason: input.cddReason !== undefined ? input.cddReason : existingContract.cddReason,
          cddtiTaskDescription: input.cddtiTaskDescription !== undefined
            ? input.cddtiTaskDescription
            : existingContract.cddtiTaskDescription,
          signedDate: input.signedDate !== undefined ? input.signedDate : existingContract.signedDate,
          notes: input.notes !== undefined ? input.notes : existingContract.notes,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(employmentContracts.id, input.id),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .returning();

      return updated;
    }),

  /**
   * Change contract type
   * Terminates the old contract and creates a new one with the new type
   */
  changeContractType: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        oldContractId: z.string().uuid(),
        newContractType: z.enum(['CDI', 'CDD', 'CDDTI', 'STAGE', 'INTERIM']),
        startDate: z.string(),
        endDate: z.string().nullable().optional(),
        contractNumber: z.string().nullable().optional(),
        cddReason: z.string().nullable().optional(),
        cddtiTaskDescription: z.string().nullable().optional(),
        terminationReason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      // Get the old contract to verify ownership
      const [oldContract] = await db
        .select()
        .from(employmentContracts)
        .where(
          and(
            eq(employmentContracts.id, input.oldContractId),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (!oldContract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contrat actuel non trouvé',
        });
      }

      // Verify user has permission
      if (oldContract.tenantId !== user.tenantId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Accès refusé',
        });
      }

      const terminationDate = input.startDate;

      // Terminate the old contract
      await db
        .update(employmentContracts)
        .set({
          isActive: false,
          terminationDate,
          terminationReason: input.terminationReason,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(employmentContracts.id, input.oldContractId));

      // Create the new contract
      const [newContract] = await db
        .insert(employmentContracts)
        .values({
          tenantId: user.tenantId,
          employeeId: input.employeeId,
          contractType: input.newContractType,
          contractNumber: input.contractNumber || null,
          startDate: input.startDate,
          endDate: input.endDate || undefined,
          cddReason: input.cddReason || undefined,
          // CDDTI requires task description (cddti_task_recommended constraint)
          cddtiTaskDescription: input.newContractType === 'CDDTI'
            ? (input.cddtiTaskDescription || 'Tâches générales')
            : (input.cddtiTaskDescription || undefined),
          renewalCount: 0,
          isActive: true,
          replacesContractId: input.oldContractId,
          createdBy: user.id,
        })
        .returning();

      // Update employee's currentContractId
      await db
        .update(employees)
        .set({
          currentContractId: newContract.id,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(employees.id, input.employeeId),
            eq(employees.tenantId, user.tenantId)
          )
        );

      return newContract;
    }),
});
