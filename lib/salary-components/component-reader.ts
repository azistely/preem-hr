/**
 * Salary Component Reader Utilities
 *
 * Reads employee salary components and converts them to payroll calculation format
 * Provides backward compatibility with old salary format
 */

import type {
  SalaryComponentInstance,
  CIComponentMetadata,
} from '@/features/employees/types/salary-components';

export interface EmployeeSalaryData {
  baseSalary: string | number | null;
  housingAllowance?: string | number | null;
  transportAllowance?: string | number | null;
  mealAllowance?: string | number | null;
  otherAllowances?: Array<{ name: string; amount: number; taxable: boolean }> | unknown;
  components?: SalaryComponentInstance[] | unknown;
  // Allow additional properties for database compatibility
  [key: string]: string | number | boolean | null | undefined | unknown;
}

export interface ComponentsBreakdown {
  baseSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  mealAllowance: number;
  seniorityBonus: number;
  familyAllowance: number;
  otherAllowances: Array<{ name: string; amount: number; taxable: boolean }>;
  customComponents: SalaryComponentInstance[];
}

/**
 * Read employee salary components with fallback to old format
 *
 * @param salaryData Employee salary record
 * @returns Components breakdown for payroll calculation
 */
export function getEmployeeSalaryComponents(
  salaryData: EmployeeSalaryData
): ComponentsBreakdown {
  // If components array exists and has items, use component-based system
  if (
    salaryData.components &&
    Array.isArray(salaryData.components) &&
    salaryData.components.length > 0
  ) {
    return readFromComponents(salaryData.components as SalaryComponentInstance[]);
  }

  // Otherwise, fallback to old format (backward compatibility)
  return readFromOldFormat(salaryData);
}

/**
 * Read from new component-based system
 *
 * @param components Salary component instances
 * @returns Breakdown for calculation
 */
function readFromComponents(
  components: SalaryComponentInstance[]
): ComponentsBreakdown {
  const breakdown: ComponentsBreakdown = {
    baseSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    mealAllowance: 0,
    seniorityBonus: 0,
    familyAllowance: 0,
    otherAllowances: [],
    customComponents: [],
  };

  for (const component of components) {
    switch (component.code) {
      case '11': // Base salary
        breakdown.baseSalary = component.amount;
        break;

      case '21': // Seniority bonus
        breakdown.seniorityBonus = component.amount;
        break;

      case '22': // Transport allowance
        breakdown.transportAllowance = component.amount;
        break;

      case '23': // Housing allowance
        breakdown.housingAllowance = component.amount;
        break;

      case '24': // Meal allowance
        breakdown.mealAllowance = component.amount;
        break;

      case '41': // Family allowance
        breakdown.familyAllowance = component.amount;
        break;

      default:
        // Custom component (CUSTOM_XXX codes)
        if (component.code.startsWith('CUSTOM_')) {
          breakdown.customComponents.push(component);
        } else {
          // Other standard components → add to otherAllowances
          breakdown.otherAllowances.push({
            name: component.name,
            amount: component.amount,
            taxable: isComponentTaxable(component),
          });
        }
    }
  }

  return breakdown;
}

/**
 * Read from old format (backward compatibility)
 *
 * @param salaryData Old salary format
 * @returns Breakdown for calculation
 */
function readFromOldFormat(salaryData: EmployeeSalaryData): ComponentsBreakdown {
  return {
    baseSalary: parseAmount(salaryData.baseSalary),
    housingAllowance: parseAmount(salaryData.housingAllowance || 0),
    transportAllowance: parseAmount(salaryData.transportAllowance || 0),
    mealAllowance: parseAmount(salaryData.mealAllowance || 0),
    seniorityBonus: 0, // Not in old format (calculated separately)
    familyAllowance: 0, // Not in old format (calculated separately)
    otherAllowances: Array.isArray(salaryData.otherAllowances) ? salaryData.otherAllowances : [],
    customComponents: [],
  };
}

/**
 * Parse amount (handles string, number, and null)
 */
function parseAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return parseFloat(value) || 0;
}

/**
 * Check if component is taxable based on metadata
 *
 * @param component Salary component instance
 * @returns true if taxable
 */
function isComponentTaxable(component: SalaryComponentInstance): boolean {
  if (!component.metadata) return true; // Default: taxable

  const metadata = component.metadata as CIComponentMetadata;

  // For CI metadata
  if ('taxTreatment' in metadata) {
    return metadata.taxTreatment.isTaxable;
  }

  // Generic fallback
  return true;
}

// ============================================================================
// Tax Treatment Helpers (for Payroll Calculation)
// ============================================================================

/**
 * Get components that should be included in Brut Imposable (CI)
 *
 * @param components Salary components
 * @returns Sum of amounts included in brut imposable
 */
export function getBrutImposableComponents(
  components: SalaryComponentInstance[]
): number {
  return components
    .filter((c) => {
      const metadata = c.metadata as CIComponentMetadata;
      return metadata?.taxTreatment?.includeInBrutImposable ?? true;
    })
    .reduce((sum, c) => sum + c.amount, 0);
}

/**
 * Get components that should be included in Salaire Catégoriel (CI)
 *
 * @param components Salary components
 * @returns Sum of amounts included in salaire catégoriel
 */
export function getSalaireCategorielComponents(
  components: SalaryComponentInstance[]
): number {
  return components
    .filter((c) => {
      const metadata = c.metadata as CIComponentMetadata;
      return metadata?.taxTreatment?.includeInSalaireCategoriel ?? false;
    })
    .reduce((sum, c) => sum + c.amount, 0);
}

/**
 * Get components that should be included in CNPS base (CI)
 *
 * @param components Salary components
 * @returns Sum of amounts included in CNPS base
 */
export function getCnpsBaseComponents(
  components: SalaryComponentInstance[]
): number {
  return components
    .filter((c) => {
      const metadata = c.metadata as CIComponentMetadata;
      return metadata?.socialSecurityTreatment?.includeInCnpsBase ?? true;
    })
    .reduce((sum, c) => sum + c.amount, 0);
}

/**
 * Get total gross salary from components
 *
 * @param components Salary components
 * @returns Total gross salary (sum of all earnings)
 */
export function getTotalGrossFromComponents(
  components: SalaryComponentInstance[]
): number {
  return components.reduce((sum, c) => sum + c.amount, 0);
}
