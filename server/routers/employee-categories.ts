/**
 * tRPC Router: Employee Categories & Coefficients
 *
 * Purpose: API endpoints for managing employee categories (A1-F) and coefficients
 *
 * Endpoints:
 * - getCategoriesByCountry: List all categories for dropdown/reference
 * - getEmployeeCategory: Get category for specific employee
 * - calculateNoticePeriod: Calculate termination notice period
 * - calculateMinimumWage: Calculate coefficient-based minimum wage
 * - calculateSeverancePay: Calculate termination severance
 * - validateCoefficient: Check if coefficient is valid
 */

import { z } from 'zod';
import { createTRPCRouter as router, publicProcedure } from '../api/trpc';
import {
  getCategoriesByCountry,
  getEmployeeCategory,
  calculateNoticePeriod,
  calculateMinimumWage,
  calculateSeverancePay,
  validateCoefficient,
} from '@/lib/compliance/employee-categories';
import {
  validateSalaryVsCoefficient,
  getEmployeeCategories,
  getMinimumSalaryForCategory,
} from '@/lib/compliance/salary-validation';

export const employeeCategoriesRouter = router({
  /**
   * Get all employee categories for a country
   *
   * Use case: Populate category reference table or dropdowns
   */
  getCategoriesByCountry: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2),
      })
    )
    .query(async ({ input }) => {
      return getCategoriesByCountry(input.countryCode);
    }),

  /**
   * Get employee's current category based on coefficient
   *
   * Use case: Display category badge in employee profile
   */
  getEmployeeCategory: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      return getEmployeeCategory(input.employeeId);
    }),

  /**
   * Calculate notice period for termination
   *
   * Use case: Termination workflow - show required notice period
   * Returns: { noticePeriodDays, workDays, searchDays, category }
   */
  calculateNoticePeriod: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const result = await calculateNoticePeriod(input.employeeId);
      if (!result) {
        throw new Error('Employee not found or category not assigned');
      }
      return result;
    }),

  /**
   * Calculate minimum wage based on coefficient
   *
   * Use case: Salary validation - prevent below-minimum wages
   * Formula: SMIG × (coefficient / 100)
   */
  calculateMinimumWage: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        countryMinimumWage: z.number().positive(),
      })
    )
    .query(async ({ input }) => {
      const minimumWage = await calculateMinimumWage(
        input.employeeId,
        input.countryMinimumWage
      );
      if (minimumWage === null) {
        throw new Error('Employee not found');
      }
      return { minimumWage };
    }),

  /**
   * Calculate severance pay for termination
   *
   * Use case: Termination workflow - show severance amount
   * Convention Collective rates: 30%/35%/40% based on seniority
   */
  calculateSeverancePay: publicProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        hireDate: z.date(),
        terminationDate: z.date(),
        countryMinimumWage: z.number().positive(),
      })
    )
    .query(async ({ input }) => {
      const result = await calculateSeverancePay(
        input.employeeId,
        input.hireDate,
        input.terminationDate,
        input.countryMinimumWage
      );
      if (!result) {
        throw new Error('Employee not found');
      }
      return result;
    }),

  /**
   * Validate coefficient and suggest category
   *
   * Use case: Employee form validation - show warning if coefficient orphaned
   */
  validateCoefficient: publicProcedure
    .input(
      z.object({
        coefficient: z.number().int().min(90).max(1000),
        countryCode: z.string().length(2),
      })
    )
    .query(async ({ input }) => {
      return validateCoefficient(input.coefficient, input.countryCode);
    }),

  /**
   * Validate salary against category coefficient
   *
   * NEW: Compliance Roadmap P0 Feature
   * Use case: Salary form validation - ensure salary meets legal minimum
   * Formula: salary >= SMIG × (minCoefficient / 100)
   *
   * @example
   * ```typescript
   * const result = await trpc.employeeCategories.validateSalary.query({
   *   countryCode: 'CI',
   *   categoryCode: 'B1',
   *   proposedSalary: 100000,
   * });
   * // {
   * //   valid: false,
   * //   minimumRequired: 112500,
   * //   error: "Salaire inférieur au minimum pour catégorie B1 (Employé) en Côte d'Ivoire (112,500 FCFA)"
   * // }
   * ```
   */
  validateSalary: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2),
        categoryCode: z.string(),
        proposedSalary: z.number().positive(),
      })
    )
    .query(async ({ input }) => {
      return validateSalaryVsCoefficient(
        input.countryCode,
        input.categoryCode,
        input.proposedSalary
      );
    }),

  /**
   * Get minimum salary for category
   *
   * NEW: Compliance Roadmap P0 Feature
   * Use case: Display minimum salary hint in salary input
   *
   * @example
   * ```typescript
   * const result = await trpc.employeeCategories.getMinimumSalary.query({
   *   countryCode: 'CI',
   *   categoryCode: 'B1',
   * });
   * // { minimumSalary: 112500 }
   * ```
   */
  getMinimumSalaryForCategory: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2),
        categoryCode: z.string(),
      })
    )
    .query(async ({ input }) => {
      const minimumSalary = await getMinimumSalaryForCategory(
        input.countryCode,
        input.categoryCode
      );

      if (minimumSalary === null) {
        throw new Error(
          `Impossible de calculer le salaire minimum pour la catégorie ${input.categoryCode}`
        );
      }

      return { minimumSalary };
    }),

  /**
   * Get all categories with detailed info
   *
   * NEW: Compliance Roadmap P0 Feature
   * Use case: Populate category dropdown in hire wizard with minimum salary hints
   *
   * @example
   * ```typescript
   * const categories = await trpc.employeeCategories.getAllCategories.query({
   *   countryCode: 'CI',
   * });
   * // [
   * //   { code: 'A1', labelFr: 'Ouvrier non qualifié', minCoefficient: 90, maxCoefficient: 115 },
   * //   { code: 'B1', labelFr: 'Employé', minCoefficient: 150, maxCoefficient: 180 },
   * //   ...
   * // ]
   * ```
   */
  getAllCategories: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2),
      })
    )
    .query(async ({ input }) => {
      return getEmployeeCategories(input.countryCode);
    }),
});
