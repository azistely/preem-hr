/**
 * Employee Category & Coefficient Helper Functions
 *
 * Purpose: Lookup employee categories (A1-F) and calculate compliance-related values
 * based on Convention Collective Interprofessionnelle coefficients.
 *
 * Architecture:
 * - employee.coefficient (90-1000) → stored in database
 * - employee_category_coefficients table → defines category ranges and rules
 * - This module → provides helper functions for category resolution
 */

import { db } from '@/lib/db';
import { employees, employeeCategoryCoefficients } from '@/drizzle/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export interface EmployeeCategory {
  id: string; // UUID from database
  category: string; // A1, A2, B1, B2, C, D, E, F
  labelFr: string; // "Ouvrier non qualifié", "Cadre", etc.
  minCoefficient: number;
  maxCoefficient: number;
  noticePeriodDays: number; // 15, 30, or 90 days
  noticeReductionPercent: number; // 25% (2 hours/day for 8-hour workday)
  minimumWageBase: string; // 'SMIG' or 'SMAG'
  legalReference?: string;
  notes?: string;
}

export interface EmployeeWithCategory {
  employeeId: string;
  coefficient: number;
  category: EmployeeCategory;
}

/**
 * Get employee category based on coefficient
 *
 * Example:
 * - coefficient = 100 → Category A1 (Ouvrier non qualifié)
 * - coefficient = 450 → Category D (Cadre)
 * - coefficient = 950 → Category F (Directeur)
 */
export async function getEmployeeCategory(
  employeeId: string
): Promise<EmployeeWithCategory | null> {
  // Get employee with coefficient
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: {
      id: true,
      coefficient: true,
      countryCode: true,
    },
  });

  if (!employee) {
    return null;
  }

  // Find matching category based on coefficient range
  const category = await db.query.employeeCategoryCoefficients.findFirst({
    where: and(
      eq(employeeCategoryCoefficients.countryCode, employee.countryCode),
      lte(employeeCategoryCoefficients.minCoefficient, employee.coefficient),
      gte(employeeCategoryCoefficients.maxCoefficient, employee.coefficient)
    ),
  });

  if (!category) {
    console.warn(`No category found for employee ${employeeId} with coefficient ${employee.coefficient}`);
    return null;
  }

  return {
    employeeId: employee.id,
    coefficient: employee.coefficient,
    category: {
      id: category.id,
      category: category.category,
      labelFr: category.labelFr,
      minCoefficient: category.minCoefficient,
      maxCoefficient: category.maxCoefficient,
      noticePeriodDays: category.noticePeriodDays,
      noticeReductionPercent: category.noticeReductionPercent ?? 0,
      minimumWageBase: category.minimumWageBase,
      legalReference: category.legalReference ?? undefined,
      notes: category.notes ?? undefined,
    },
  };
}

/**
 * Calculate notice period for termination
 *
 * Convention Collective Article 21:
 * - A1-B1: 15 days
 * - B2-C: 30 days (1 month)
 * - D-F: 90 days (3 months)
 *
 * Also calculates work hours allocated for job search:
 * - 2 hours/day on 8-hour workday = 25% of notice period
 */
export async function calculateNoticePeriod(employeeId: string): Promise<{
  noticePeriodDays: number;
  category: {
    code: string;
    friendlyLabel: string;
  };
  workDays: number;
  searchDays: number;
} | null> {
  const employeeWithCategory = await getEmployeeCategory(employeeId);

  if (!employeeWithCategory) {
    return null;
  }

  const { category } = employeeWithCategory;

  // Calculate work vs search time during notice period
  const searchDays = Math.round(
    category.noticePeriodDays * (category.noticeReductionPercent / 100)
  );
  const workDays = category.noticePeriodDays - searchDays;

  return {
    noticePeriodDays: category.noticePeriodDays,
    category: {
      code: category.category,
      friendlyLabel: category.labelFr,
    },
    workDays,
    searchDays,
  };
}

/**
 * Calculate minimum wage based on coefficient
 *
 * Formula: SMIG × (coefficient / 100)
 *
 * Example:
 * - SMIG CI = 75,000 FCFA
 * - Coefficient = 450 (Cadre D)
 * - Minimum wage = 75,000 × (450/100) = 337,500 FCFA
 */
export async function calculateMinimumWage(
  employeeId: string,
  countryMinimumWage: number // SMIG from countries table
): Promise<number | null> {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: { coefficient: true },
  });

  if (!employee) {
    return null;
  }

  return countryMinimumWage * (employee.coefficient / 100);
}

/**
 * Get all categories for a country
 *
 * Useful for:
 * - Populating category dropdowns in employee forms
 * - Displaying category reference tables
 */
export async function getCategoriesByCountry(
  countryCode: string
): Promise<EmployeeCategory[]> {
  const categories = await db.query.employeeCategoryCoefficients.findMany({
    where: eq(employeeCategoryCoefficients.countryCode, countryCode),
    orderBy: (categories, { asc }) => [asc(categories.minCoefficient)],
  });

  return categories.map((cat) => ({
    id: cat.id,
    category: cat.category,
    labelFr: cat.labelFr,
    minCoefficient: cat.minCoefficient,
    maxCoefficient: cat.maxCoefficient,
    noticePeriodDays: cat.noticePeriodDays,
    noticeReductionPercent: cat.noticeReductionPercent ?? 0,
    minimumWageBase: cat.minimumWageBase,
    legalReference: cat.legalReference ?? undefined,
    notes: cat.notes ?? undefined,
  }));
}

/**
 * Validate coefficient is within valid range for country
 *
 * Returns:
 * - true if coefficient matches a category
 * - false if coefficient is orphaned (no matching category)
 */
export async function validateCoefficient(
  coefficient: number,
  countryCode: string
): Promise<{ valid: boolean; suggestedCategory?: string }> {
  const category = await db.query.employeeCategoryCoefficients.findFirst({
    where: and(
      eq(employeeCategoryCoefficients.countryCode, countryCode),
      lte(employeeCategoryCoefficients.minCoefficient, coefficient),
      gte(employeeCategoryCoefficients.maxCoefficient, coefficient)
    ),
  });

  if (category) {
    return { valid: true, suggestedCategory: category.category };
  }

  // Find nearest category
  const allCategories = await getCategoriesByCountry(countryCode);
  const nearest = allCategories.reduce((prev, curr) => {
    const prevDiff = Math.abs(prev.minCoefficient - coefficient);
    const currDiff = Math.abs(curr.minCoefficient - coefficient);
    return currDiff < prevDiff ? curr : prev;
  });

  return {
    valid: false,
    suggestedCategory: nearest?.category,
  };
}

/**
 * Calculate severance pay based on coefficient and seniority
 *
 * Convention Collective rules:
 * - < 1 year: 0
 * - 1-5 years: 30% of monthly salary per year
 * - 5-10 years: 35% of monthly salary per year
 * - > 10 years: 40% of monthly salary per year
 *
 * Monthly salary = SMIG × (coefficient / 100)
 */
export async function calculateSeverancePay(
  employeeId: string,
  hireDate: Date,
  terminationDate: Date,
  countryMinimumWage: number
): Promise<{
  severancePay: number;
  totalAmount: number;
  averageSalary: number;
  rate: number;
  yearsOfService: number;
} | null> {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: { coefficient: true },
  });

  if (!employee) {
    return null;
  }

  // Calculate years of service
  const yearsOfService = (terminationDate.getTime() - hireDate.getTime())
    / (1000 * 60 * 60 * 24 * 365.25);

  if (yearsOfService < 1) {
    return {
      severancePay: 0,
      totalAmount: 0,
      averageSalary: 0,
      rate: 0,
      yearsOfService,
    };
  }

  // Calculate monthly salary
  const monthlySalary = countryMinimumWage * (employee.coefficient / 100);

  // Determine severance rate
  let rate = 0.30; // 30% for 1-5 years
  if (yearsOfService > 10) {
    rate = 0.40; // 40% for > 10 years
  } else if (yearsOfService > 5) {
    rate = 0.35; // 35% for 5-10 years
  }

  const severancePay = monthlySalary * rate * yearsOfService;

  return {
    severancePay,
    totalAmount: severancePay,
    averageSalary: monthlySalary,
    rate: rate * 100, // Convert to percentage
    yearsOfService,
  };
}
