/**
 * Salary Validation with Employee Category Coefficients
 *
 * Purpose: Validate that proposed salaries meet legal minimum requirements
 * based on employee category coefficients and country minimum wage.
 *
 * Legal Basis (Côte d'Ivoire):
 * - Convention Collective Interprofessionnelle 1977
 * - SMIG (Salaire Minimum Interprofessionnel Garanti) = 75,000 FCFA/month
 * - Each category has a coefficient (90-1000)
 * - Minimum salary = SMIG × (coefficient / 100)
 *
 * Example (Category B1):
 * - Coefficient: 150
 * - Minimum salary = 75,000 × (150 / 100) = 112,500 FCFA
 *
 * Multi-Country Support:
 * - Loads minimum wage from countries table
 * - Loads coefficients from employee_category_coefficients table
 * - Returns country-specific error messages
 */

import { db } from '@/lib/db';
import { employeeCategoryCoefficients, countries } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';

export interface SalaryValidationResult {
  valid: boolean;
  minimumRequired: number;
  error?: string;
  category?: {
    code: string;
    labelFr: string;
    minCoefficient: number;
    maxCoefficient: number;
  };
}

/**
 * Validate salary against employee category coefficient
 *
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'CI', 'SN')
 * @param categoryCode - Employee category code (e.g., 'A1', 'B1', 'C', 'D')
 * @param proposedSalary - Proposed monthly salary in local currency
 * @returns Validation result with minimum required salary
 *
 * @example
 * ```typescript
 * // Category B1 in Côte d'Ivoire (coefficient 150)
 * const result = await validateSalaryVsCoefficient('CI', 'B1', 100000);
 * // result.valid = false
 * // result.minimumRequired = 112,500
 * // result.error = "Salaire inférieur au minimum pour catégorie B1 (Employé) en Côte d'Ivoire (112,500 FCFA)"
 *
 * const result2 = await validateSalaryVsCoefficient('CI', 'B1', 150000);
 * // result2.valid = true
 * // result2.minimumRequired = 112,500
 * ```
 */
export async function validateSalaryVsCoefficient(
  countryCode: string,
  categoryCode: string,
  proposedSalary: number
): Promise<SalaryValidationResult> {
  // 1. Load employee category coefficient
  const categoryData = await db.query.employeeCategoryCoefficients.findFirst({
    where: and(
      eq(employeeCategoryCoefficients.countryCode, countryCode),
      eq(employeeCategoryCoefficients.category, categoryCode)
    ),
  });

  if (!categoryData) {
    return {
      valid: false,
      minimumRequired: 0,
      error: `Catégorie ${categoryCode} non trouvée pour le pays ${countryCode}`,
    };
  }

  // 2. Load country minimum wage
  const countryData = await db.query.countries.findFirst({
    where: eq(countries.code, countryCode),
  });

  if (!countryData || !countryData.minimumWage) {
    return {
      valid: false,
      minimumRequired: 0,
      error: `Salaire minimum non configuré pour le pays ${countryCode}`,
    };
  }

  // 3. Calculate minimum required salary
  // Formula: SMIG × (minCoefficient / 100)
  const minimumWage = parseFloat(countryData.minimumWage);
  const coefficient = categoryData.minCoefficient; // Use min coefficient as the baseline
  const minimumRequired = Math.round(minimumWage * (coefficient / 100));

  // 4. Validate proposed salary
  const valid = proposedSalary >= minimumRequired;

  // 5. Build country-specific error message
  const error = valid
    ? undefined
    : `Salaire inférieur au minimum pour catégorie ${categoryCode} (${categoryData.labelFr}) en ${getCountryName(countryCode)} (${minimumRequired.toLocaleString('fr-FR')} ${getCurrencySymbol(countryCode)})`;

  return {
    valid,
    minimumRequired,
    error,
    category: {
      code: categoryCode,
      labelFr: categoryData.labelFr,
      minCoefficient: categoryData.minCoefficient,
      maxCoefficient: categoryData.maxCoefficient || categoryData.minCoefficient,
    },
  };
}

/**
 * Get all employee categories for a country
 *
 * Useful for populating category dropdowns in hire wizard.
 *
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns Array of category codes with labels and coefficients
 *
 * @example
 * ```typescript
 * const categories = await getEmployeeCategories('CI');
 * // [
 * //   { code: 'A1', labelFr: 'Ouvrier non qualifié', minCoefficient: 90, maxCoefficient: 115 },
 * //   { code: 'A2', labelFr: 'Ouvrier qualifié / Ouvrier spécialisé', minCoefficient: 120, maxCoefficient: 145 },
 * //   ...
 * // ]
 * ```
 */
export async function getEmployeeCategories(countryCode: string) {
  const categories = await db.query.employeeCategoryCoefficients.findMany({
    where: eq(employeeCategoryCoefficients.countryCode, countryCode),
    orderBy: (categories, { asc }) => [asc(categories.minCoefficient)],
  });

  return categories.map((cat) => ({
    code: cat.category,
    labelFr: cat.labelFr,
    minCoefficient: cat.minCoefficient,
    maxCoefficient: cat.maxCoefficient || cat.minCoefficient,
    legalReference: cat.legalReference || undefined,
  }));
}

/**
 * Calculate minimum salary for a category
 *
 * Quick helper to get the minimum salary without full validation.
 *
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @param categoryCode - Employee category code
 * @returns Minimum required salary or null if not found
 */
export async function getMinimumSalaryForCategory(
  countryCode: string,
  categoryCode: string
): Promise<number | null> {
  const result = await validateSalaryVsCoefficient(countryCode, categoryCode, 0);
  return result.valid === false && result.minimumRequired > 0
    ? result.minimumRequired
    : null;
}

/**
 * Get country name in French (for error messages)
 */
function getCountryName(countryCode: string): string {
  const names: Record<string, string> = {
    CI: 'Côte d\'Ivoire',
    SN: 'Sénégal',
    BF: 'Burkina Faso',
    ML: 'Mali',
    BJ: 'Bénin',
    TG: 'Togo',
  };
  return names[countryCode] || countryCode;
}

/**
 * Get currency symbol (for error messages)
 */
function getCurrencySymbol(countryCode: string): string {
  // All West African CFA countries use FCFA
  const cfaCountries = ['CI', 'SN', 'BF', 'ML', 'BJ', 'TG', 'NE'];
  return cfaCountries.includes(countryCode) ? 'FCFA' : '';
}
