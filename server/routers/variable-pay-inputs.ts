/**
 * Variable Pay Inputs Router
 *
 * Manages monthly variable component values (commissions, production bonuses, etc.)
 * that change period-to-period for employees.
 *
 * Key Features:
 * - Bulk upsert for efficient data entry
 * - Copy from previous period for recurring bonuses
 * - Integration with payroll calculation
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import {
  getVariablePayInputsForPeriod,
  getAllEmployeesWithVariableInputs,
  getEmployeeVariableComponents,
  getAllCatalogueComponents,
  bulkUpsertVariablePayInputs,
  copyVariablePayFromPreviousPeriod,
  deleteVariablePayInput,
  deleteVariablePayInputsForPeriod,
} from '@/features/payroll/services/variable-pay-inputs.service';

/**
 * Zod schemas for input validation
 */
const periodSchema = z.string().regex(/^\d{4}-\d{2}-01$/, {
  message: 'La période doit être au format YYYY-MM-01',
});

const bulkUpsertInputSchema = z.object({
  employeeId: z.string().uuid({ message: 'ID employé invalide' }),
  componentCode: z.string().min(1, { message: 'Code composant requis' }),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide (format: YYYY-MM-DD)' }),
  amount: z.number().min(0, { message: 'Le montant doit être positif ou zéro' }),
  notes: z.string().max(500).optional(),
});

export const variablePayInputsRouter = createTRPCRouter({
  /**
   * Get all variable pay inputs for a specific period
   *
   * Returns inputs with employee details for display in UI.
   */
  getForPeriod: protectedProcedure
    .input(z.object({
      period: periodSchema,
    }))
    .query(async ({ ctx, input }) => {
      try {
        const inputs = await getVariablePayInputsForPeriod(
          ctx.user.tenantId,
          input.period
        );

        return {
          inputs,
          period: input.period,
          count: inputs.length,
        };
      } catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération des primes variables';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Get all employees with their variable pay inputs for a period
   *
   * Returns all active employees regardless of whether they have inputs.
   * This is useful for UI where we want to show all employees and allow
   * adding new variable inputs.
   */
  getAllEmployeesWithInputs: protectedProcedure
    .input(z.object({
      period: periodSchema,
    }))
    .query(async ({ ctx, input }) => {
      try {
        const employees = await getAllEmployeesWithVariableInputs(
          ctx.user.tenantId,
          input.period
        );

        return {
          employees,
          period: input.period,
          count: employees.length,
        };
      } catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération des employés';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Get employee's variable components from their salary package
   *
   * Returns variable components assigned to the employee with current amounts
   * from variable_pay_inputs if they exist.
   */
  getEmployeeVariableComponents: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      period: periodSchema,
    }))
    .query(async ({ ctx, input }) => {
      try {
        const components = await getEmployeeVariableComponents(
          ctx.user.tenantId,
          input.employeeId,
          input.period
        );

        return {
          components,
          employeeId: input.employeeId,
          period: input.period,
        };
      } catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération des composants variables';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Get ALL components from the catalogue for tenant's country
   *
   * Returns all salary components regardless of type (fixed, variable, etc.)
   * with current amounts from variable_pay_inputs if they exist.
   * Used in variable pay dialog to allow selecting any component.
   */
  getAllCatalogueComponents: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      period: periodSchema,
    }))
    .query(async ({ ctx, input }) => {
      try {
        const components = await getAllCatalogueComponents(
          ctx.user.tenantId,
          input.employeeId,
          input.period
        );

        return {
          components,
          employeeId: input.employeeId,
          period: input.period,
        };
      } catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération du catalogue de composants';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Bulk upsert variable pay inputs
   *
   * Inserts new inputs or updates existing ones for the period.
   * Uses ON CONFLICT to handle duplicates gracefully.
   */
  bulkUpsert: protectedProcedure
    .input(z.object({
      period: periodSchema,
      inputs: z.array(bulkUpsertInputSchema).min(1).max(500, {
        message: 'Maximum 500 entrées par opération',
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const results = await bulkUpsertVariablePayInputs(
          ctx.user.tenantId,
          input.period,
          input.inputs,
          ctx.user.id
        );

        return {
          success: true,
          count: results.length,
          period: input.period,
        };
      } catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : 'Erreur lors de la sauvegarde des primes variables';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Copy variable pay inputs from previous period
   *
   * Useful for recurring monthly bonuses/commissions.
   * Skips entries that already exist in target period.
   */
  copyFromPreviousPeriod: protectedProcedure
    .input(z.object({
      fromPeriod: periodSchema,
      toPeriod: periodSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate that toPeriod is after fromPeriod
      if (input.toPeriod <= input.fromPeriod) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La période cible doit être postérieure à la période source',
        });
      }

      try {
        const results = await copyVariablePayFromPreviousPeriod(
          ctx.user.tenantId,
          input.fromPeriod,
          input.toPeriod,
          ctx.user.id
        );

        return {
          success: true,
          count: results.length,
          fromPeriod: input.fromPeriod,
          toPeriod: input.toPeriod,
        };
      } catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : 'Erreur lors de la copie des primes variables';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Delete a single variable pay input by ID
   */
  delete: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteVariablePayInput(ctx.user.tenantId, input.id);

        return {
          success: true,
          id: input.id,
        };
      } catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : 'Erreur lors de la suppression de la prime variable';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Delete all variable pay inputs for a period
   *
   * Use with caution - typically for cleaning up incorrect data.
   */
  deleteForPeriod: protectedProcedure
    .input(z.object({
      period: periodSchema,
      confirm: z.literal(true, {
        errorMap: () => ({ message: 'La confirmation est requise pour supprimer toutes les entrées' }),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteVariablePayInputsForPeriod(ctx.user.tenantId, input.period);

        return {
          success: true,
          period: input.period,
        };
      } catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : 'Erreur lors de la suppression des primes variables';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),
});
