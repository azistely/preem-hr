/**
 * Salaries tRPC Router
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import {
  changeSalary,
  getCurrentSalary,
  getSalaryHistory,
  calculateGrossSalary,
  getMinimumWage,
  getTenantCountryCode,
} from '@/features/employees/services/salary.service';
import { eventBus } from '@/lib/event-bus';
import { TRPCError } from '@trpc/server';

const allowanceSchema = z.object({
  name: z.string().min(1),
  amount: z.number().min(0),
  taxable: z.boolean().default(true),
});

const changeSalarySchema = z.object({
  employeeId: z.string().uuid(),
  newBaseSalary: z.number().min(75000, 'Salaire >= 75000 FCFA (SMIG)'),
  housingAllowance: z.number().min(0).optional(),
  transportAllowance: z.number().min(0).optional(),
  mealAllowance: z.number().min(0).optional(),
  otherAllowances: z.array(allowanceSchema).optional(),
  effectiveFrom: z.date(),
  changeReason: z.string().min(1, 'La raison est requise'),
  notes: z.string().optional(),
});

const getCurrentSalarySchema = z.object({
  employeeId: z.string().uuid(),
  asOfDate: z.date().optional(),
});

const getSalaryHistorySchema = z.object({
  employeeId: z.string().uuid(),
});

export const salariesRouter = createTRPCRouter({
  change: protectedProcedure
    .input(changeSalarySchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Get old salary for event
        const oldSalary = await getCurrentSalary(input.employeeId);
        const oldAmount = calculateGrossSalary(oldSalary);

        const newSalary = await changeSalary({
          ...input,
          tenantId: ctx.tenantId,
          createdBy: ctx.user.id,
        });

        const newAmount = calculateGrossSalary(newSalary);

        // Emit event
        await eventBus.publish('salary.changed', {
          employeeId: input.employeeId,
          tenantId: ctx.tenantId,
          oldSalary: oldAmount,
          newSalary: newAmount,
          effectiveDate: input.effectiveFrom,
          reason: input.changeReason,
        });

        return newSalary;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors du changement de salaire',
        });
      }
    }),

  getCurrent: protectedProcedure
    .input(getCurrentSalarySchema)
    .query(async ({ input }) => {
      try {
        const salary = await getCurrentSalary(input.employeeId, input.asOfDate);
        const grossSalary = calculateGrossSalary(salary);

        return {
          ...salary,
          grossSalary,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error.message || 'Salaire non trouvé',
        });
      }
    }),

  getHistory: protectedProcedure
    .input(getSalaryHistorySchema)
    .query(async ({ input }) => {
      try {
        const history = await getSalaryHistory(input.employeeId);

        return history.map((salary) => ({
          ...salary,
          grossSalary: calculateGrossSalary(salary),
        }));
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération de l\'historique',
        });
      }
    }),

  getMinimumWage: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      try {
        // Get tenant's country code first
        const countryCode = await getTenantCountryCode(ctx.tenantId);
        const minimumWage = await getMinimumWage(countryCode);

        // Get country name for display
        const countryNames: Record<string, string> = {
          'CI': 'Côte d\'Ivoire',
          'SN': 'Sénégal',
          'BF': 'Burkina Faso',
          'ML': 'Mali',
          'BJ': 'Bénin',
          'TG': 'Togo',
          'NE': 'Niger',
        };

        return {
          minimumWage,
          countryCode,
          countryName: countryNames[countryCode] || countryCode,
        };
      } catch (error: any) {
        // Return default values if tenant/country not found (for development)
        console.error('Error getting minimum wage:', error.message);
        return {
          minimumWage: 75000, // Default CI SMIG
          countryCode: 'CI',
          countryName: 'Côte d\'Ivoire',
        };
      }
    }),
});
