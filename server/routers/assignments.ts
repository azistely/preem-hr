/**
 * Assignments tRPC Router
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import {
  createAssignment,
  transferEmployee,
  getCurrentAssignment,
} from '@/features/employees/services/assignment.service';
import { eventBus } from '@/lib/event-bus';
import { TRPCError } from '@trpc/server';

const createAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  positionId: z.string().uuid(),
  assignmentType: z.enum(['primary', 'secondary', 'temporary']).default('primary'),
  effectiveFrom: z.date(),
  effectiveTo: z.date().optional(),
  assignmentReason: z.string().optional(),
  notes: z.string().optional(),
});

const transferEmployeeSchema = z.object({
  employeeId: z.string().uuid(),
  newPositionId: z.string().uuid(),
  effectiveFrom: z.date(),
  reason: z.string().min(1, 'La raison est requise'),
  notes: z.string().optional(),
});

const getCurrentAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  assignmentType: z.enum(['primary', 'secondary', 'temporary']).default('primary'),
  asOfDate: z.date().optional(),
});

export const assignmentsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createAssignmentSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const assignment = await createAssignment({
          ...input,
          tenantId: ctx.tenantId,
          createdBy: ctx.user.id,
        });

        // Emit event
        await eventBus.publish('employee.assigned', {
          employeeId: assignment.employeeId,
          tenantId: assignment.tenantId,
          positionId: assignment.positionId,
          assignmentType: assignment.assignmentType as any,
          effectiveDate: new Date(assignment.effectiveFrom),
        });

        return assignment;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la création de l\'affectation',
        });
      }
    }),

  transfer: protectedProcedure
    .input(transferEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const assignment = await transferEmployee({
          ...input,
          tenantId: ctx.tenantId,
          createdBy: ctx.user.id,
        });

        // Emit event
        await eventBus.publish('employee.transferred', {
          employeeId: assignment.employeeId,
          tenantId: assignment.tenantId,
          fromPositionId: '', // Would need to track this
          toPositionId: assignment.positionId,
          effectiveDate: new Date(assignment.effectiveFrom),
          reason: input.reason,
        });

        return assignment;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors du transfert',
        });
      }
    }),

  getCurrent: protectedProcedure
    .input(getCurrentAssignmentSchema)
    .query(async ({ input }) => {
      try {
        return await getCurrentAssignment(
          input.employeeId,
          input.assignmentType,
          input.asOfDate
        );
      } catch (error: any) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error.message || 'Affectation non trouvée',
        });
      }
    }),
});
