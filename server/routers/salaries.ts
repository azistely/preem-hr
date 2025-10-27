/**
 * Salaries tRPC Router
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
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

const componentSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().min(0),
  metadata: z.any().optional(),
  sourceType: z.enum(['standard', 'custom', 'template']),
  sourceId: z.string().optional(),
});

const changeSalarySchema = z.object({
  employeeId: z.string().uuid(),
  components: z.array(componentSchema).min(1, 'Au moins un composant requis'),
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

const previewPayrollSchema = z.object({
  employeeId: z.string().uuid(),
  components: z.array(z.object({
    code: z.string(),
    name: z.string(),
    amount: z.number(),
    sourceType: z.string(),
  })),
  countryCode: z.string().length(2).optional(),
});

export const salariesRouter = createTRPCRouter({
  change: publicProcedure
    .input(changeSalarySchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Get old salary for event
        const oldSalary = await getCurrentSalary(input.employeeId);
        const oldAmount = calculateGrossSalary(oldSalary);

        const newSalary = await changeSalary({
          ...input,
          tenantId: ctx.user.tenantId,
          createdBy: ctx.user.id,
        });

        const newAmount = calculateGrossSalary(newSalary);

        // Emit event
        await eventBus.publish('salary.changed', {
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
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

  getCurrent: publicProcedure
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

  getHistory: publicProcedure
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

  getMinimumWage: publicProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      try {
        // Get tenant's country code first
        const countryCode = await getTenantCountryCode(ctx.user.tenantId);
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

  /**
   * Preview payroll calculation for new salary components
   * Returns: gross, deductions, net salary for preview purposes
   *
   * ✅ MULTI-COUNTRY: Uses database-driven base salary component extraction
   */
  previewPayroll: publicProcedure
    .input(previewPayrollSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { calculatePayrollV2 } = await import('@/features/payroll/services/payroll-calculation-v2');
        const { extractBaseSalaryAmounts, getSalaireCategoriel, calculateBaseSalaryTotal } = await import('@/lib/salary-components/base-salary-loader');
        const { db } = await import('@/lib/db');
        const { employees } = await import('@/drizzle/schema');
        const { eq, and } = await import('drizzle-orm');

        // Get employee data
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

        // Get tenant data for sector and country code
        const { tenants } = await import('@/drizzle/schema');
        const [tenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, ctx.user.tenantId))
          .limit(1);

        if (!tenant) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Entreprise non trouvée',
          });
        }

        // Get country code and sector from tenant
        const countryCode = input.countryCode || employee.countryCode || tenant.countryCode || await getTenantCountryCode(ctx.user.tenantId);
        const sectorCode = tenant.genericSectorCode || tenant.sectorCode;

        // Extract base salary components (database-driven)
        const baseAmounts = await extractBaseSalaryAmounts(input.components, countryCode);
        const totalBaseSalary = await calculateBaseSalaryTotal(input.components, countryCode);
        const salaireCategoriel = await getSalaireCategoriel(input.components, countryCode);

        // Fetch component metadata from database to understand component types
        const { salaryComponentDefinitions } = await import('@/drizzle/schema');
        const { inArray } = await import('drizzle-orm');

        const componentCodes = input.components.map(c => c.code);
        const definitions = await db
          .select()
          .from(salaryComponentDefinitions)
          .where(inArray(salaryComponentDefinitions.code, componentCodes));

        // Create a map of code -> metadata
        const metadataMap = new Map(definitions.map(d => [d.code, d]));

        // Helper function to convert monthly component amounts to employee's rate type
        // Components are stored in monthly amounts by convention
        const convertComponentAmount = (monthlyAmount: number): number => {
          const rateType = employee.rateType || 'MONTHLY';
          switch (rateType) {
            case 'DAILY':
              return Math.round(monthlyAmount / 30);
            case 'HOURLY':
              return Math.round(monthlyAmount / 30 / 8);
            case 'MONTHLY':
            default:
              return monthlyAmount;
          }
        };

        // Categorize non-base components by their type using database metadata
        let housingAllowance = 0;
        let transportAllowance = 0;
        let familyAllowance = 0;
        let mealAllowance = 0;
        let seniorityBonus = 0;
        let otherBonuses = 0;

        for (const component of input.components) {
          const metadata = metadataMap.get(component.code);
          if (!metadata) {
            // No metadata found - treat as other bonus
            // Convert from monthly to employee's rate type
            otherBonuses += convertComponentAmount(component.amount || 0);
            continue;
          }

          // Skip base components (already handled)
          const metadataObj = metadata.metadata as any || {};
          if (metadataObj.isBaseComponent) {
            continue;
          }

          // Convert component amount from monthly to employee's rate type
          const amount = convertComponentAmount(component.amount || 0);

          // Map by component_type (from database metadata)
          switch (metadata.componentType) {
            case 'housing':
              housingAllowance += amount;
              break;
            case 'transport':
              transportAllowance += amount;
              break;
            case 'family':
              familyAllowance += amount;
              break;
            case 'meal':
              mealAllowance += amount;
              break;
            case 'seniority':
              if (metadata.category === 'bonus') {
                seniorityBonus += amount;
              } else {
                otherBonuses += amount;
              }
              break;
            default:
              // All other types (performance, responsibility, etc.) go into bonuses
              if (metadata.category === 'bonus' || metadata.category === 'allowance') {
                otherBonuses += amount;
              }
              break;
          }
        }

        // Calculate payroll
        // For preview, use current month as period
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const result = await calculatePayrollV2({
          employeeId: input.employeeId,
          periodStart,
          periodEnd,
          baseSalary: totalBaseSalary, // Total of all base components
          salaireCategoriel, // Code 11 (or equivalent)
          sursalaire: baseAmounts['12'], // Code 12 for CI (if present)
          housingAllowance,
          transportAllowance,
          mealAllowance,
          familyAllowance,
          seniorityBonus,
          bonuses: otherBonuses,
          fiscalParts: employee.taxDependents || 1.0,
          countryCode,
          sectorCode, // Pass tenant's sector for work accident rate calculation
          tenantId: ctx.user.tenantId,
          // Dynamic CMU calculation (GAP-CMU-001)
          maritalStatus: employee.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | undefined,
          dependentChildren: employee.dependentChildren ?? undefined,
        });

        return {
          grossSalary: result.grossSalary,
          cnpsEmployee: result.cnpsEmployee,
          tax: result.its,
          netSalary: result.netSalary,
          breakdown: {
            baseSalary: totalBaseSalary,
            salaireCategoriel,
            housingAllowance,
            transportAllowance,
            taxableIncome: result.taxableIncome,
          },
        };
      } catch (error: any) {
        console.error('Payroll preview error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors du calcul de la paie',
        });
      }
    }),
});
