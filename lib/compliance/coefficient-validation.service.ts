/**
 * Coefficient-Based Minimum Wage Validation Service (GAP-COEF-001)
 *
 * Validates that employee salary meets the minimum wage for their category.
 * Formula: base_salary >= (coefficient × SMIG) ÷ 100
 *
 * Categories and coefficients are defined in employee_category_coefficients table.
 */

import { db } from '@/lib/db';
import { employeeCategoryCoefficients, countries } from '@/drizzle/schema';
import { eq, and, lte, gte } from 'drizzle-orm';

export interface CategoryInfo {
  category: string;
  labelFr: string;
  minCoefficient: number;
  maxCoefficient: number;
  minimumWage: number; // Calculated minimum wage for this coefficient
}

export interface ValidationResult {
  isValid: boolean;
  minimumWage: number; // Required minimum wage
  currentSalary: number;
  category: string | null;
  categoryLabel: string | null;
  errorMessage: string | null;
}

/**
 * Get category info for a given coefficient and country
 *
 * @param coefficient - Employee's coefficient (90-1000)
 * @param countryCode - Country code (e.g., 'CI')
 * @returns Category information including minimum wage
 */
export async function getCategoryForCoefficient(
  coefficient: number,
  countryCode: string
): Promise<CategoryInfo | null> {
  // Load SMIG for country
  const [country] = await db
    .select({
      smig: countries.minimumWage,
    })
    .from(countries)
    .where(eq(countries.code, countryCode))
    .limit(1);

  if (!country || !country.smig) {
    throw new Error(`SMIG introuvable pour le pays ${countryCode}`);
  }

  const smig = Number(country.smig);

  // Find category matching this coefficient
  const [category] = await db
    .select({
      category: employeeCategoryCoefficients.category,
      labelFr: employeeCategoryCoefficients.labelFr,
      minCoefficient: employeeCategoryCoefficients.minCoefficient,
      maxCoefficient: employeeCategoryCoefficients.maxCoefficient,
    })
    .from(employeeCategoryCoefficients)
    .where(
      and(
        eq(employeeCategoryCoefficients.countryCode, countryCode),
        lte(employeeCategoryCoefficients.minCoefficient, coefficient),
        gte(employeeCategoryCoefficients.maxCoefficient, coefficient)
      )
    )
    .limit(1);

  if (!category) {
    return null;
  }

  // Calculate minimum wage: (coefficient × SMIG) ÷ 100
  const minimumWage = Math.round((coefficient * smig) / 100);

  return {
    category: category.category,
    labelFr: category.labelFr,
    minCoefficient: category.minCoefficient,
    maxCoefficient: category.maxCoefficient,
    minimumWage,
  };
}

/**
 * Validate employee salary against coefficient-based minimum wage
 *
 * @param baseSalary - Employee's base salary
 * @param coefficient - Employee's coefficient
 * @param countryCode - Country code (e.g., 'CI')
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const result = await validateCoefficientBasedSalary(67500, 90, 'CI');
 * if (!result.isValid) {
 *   throw new Error(result.errorMessage);
 * }
 * ```
 */
export async function validateCoefficientBasedSalary(
  baseSalary: number,
  coefficient: number,
  countryCode: string
): Promise<ValidationResult> {
  // Get category info
  const categoryInfo = await getCategoryForCoefficient(coefficient, countryCode);

  if (!categoryInfo) {
    // No category found - coefficient might be invalid
    return {
      isValid: false,
      minimumWage: 0,
      currentSalary: baseSalary,
      category: null,
      categoryLabel: null,
      errorMessage: `Coefficient ${coefficient} invalide pour ${countryCode}. Vérifiez la catégorie de l'employé.`,
    };
  }

  // Check if salary meets minimum
  const isValid = baseSalary >= categoryInfo.minimumWage;

  return {
    isValid,
    minimumWage: categoryInfo.minimumWage,
    currentSalary: baseSalary,
    category: categoryInfo.category,
    categoryLabel: categoryInfo.labelFr,
    errorMessage: isValid
      ? null
      : `Salaire inférieur au minimum pour catégorie ${categoryInfo.labelFr} (${categoryInfo.minimumWage.toLocaleString('fr-FR')} FCFA). Salaire actuel: ${baseSalary.toLocaleString('fr-FR')} FCFA.`,
  };
}

/**
 * Get minimum wage helper text for UI
 *
 * Returns friendly message showing the minimum wage for a given coefficient.
 * Used to guide users when entering salary.
 *
 * @param coefficient - Employee's coefficient
 * @param countryCode - Country code
 * @returns Helper text in French or null if coefficient invalid
 *
 * @example
 * ```typescript
 * const helper = await getMinimumWageHelper(100, 'CI');
 * // "Minimum: 75,000 FCFA (Catégorie A1)"
 * ```
 */
export async function getMinimumWageHelper(
  coefficient: number,
  countryCode: string
): Promise<string | null> {
  const categoryInfo = await getCategoryForCoefficient(coefficient, countryCode);

  if (!categoryInfo) {
    return null;
  }

  return `Minimum: ${categoryInfo.minimumWage.toLocaleString('fr-FR')} FCFA (Catégorie ${categoryInfo.labelFr})`;
}
