/**
 * Banking Convention tRPC Router (GAP-CONV-BANK-001)
 *
 * API endpoints for banking professional levels and seniority bonuses
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import {
  getAllBankingLevels,
  calculateBankingSeniorityBonus,
  validateBankingSalary,
  getBankingSeniorityRules,
} from '@/features/conventions/services/banking-convention.service';

export const bankingRouter = createTRPCRouter({
  // Get all banking professional levels
  getLevels: protectedProcedure
    .input(
      z.object({
        countryCode: z.string().default('CI'),
      })
    )
    .query(async ({ input }: { input: { countryCode: string } }) => {
      return await getAllBankingLevels(input.countryCode);
    }),

  // Calculate seniority bonus
  calculateSeniorityBonus: protectedProcedure
    .input(
      z.object({
        baseSalary: z.number(),
        hireDate: z.string().transform((val) => new Date(val)),
        countryCode: z.string().default('CI'),
      })
    )
    .query(async ({ input }: { input: { baseSalary: number; hireDate: Date; countryCode: string } }) => {
      return await calculateBankingSeniorityBonus(
        input.baseSalary,
        input.hireDate,
        input.countryCode
      );
    }),

  // Validate salary against banking level
  validateSalary: protectedProcedure
    .input(
      z.object({
        salary: z.number(),
        levelNumber: z.number().min(1).max(9),
        countryCode: z.string().default('CI'),
      })
    )
    .query(async ({ input }: { input: { salary: number; levelNumber: number; countryCode: string } }) => {
      return await validateBankingSalary(
        input.salary,
        input.levelNumber,
        input.countryCode
      );
    }),

  // Get seniority bonus rules
  getSeniorityRules: protectedProcedure
    .input(
      z.object({
        countryCode: z.string().default('CI'),
      })
    )
    .query(async ({ input }: { input: { countryCode: string } }) => {
      return await getBankingSeniorityRules(input.countryCode);
    }),
});
