/**
 * Salary Component Reader Utilities
 *
 * Reads employee salary components and converts them to payroll calculation format.
 * Single source of truth: components JSONB array only (no legacy column support).
 */

import type {
  SalaryComponentInstance,
  CIComponentMetadata,
} from '@/features/employees/types/salary-components';

export interface EmployeeSalaryData {
  components: SalaryComponentInstance[];
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
 * Read employee salary components (single source of truth: components array)
 *
 * @param salaryData Employee salary record with components array
 * @returns Components breakdown for payroll calculation
 */
export function getEmployeeSalaryComponents(
  salaryData: EmployeeSalaryData
): ComponentsBreakdown {
  if (!salaryData.components || !Array.isArray(salaryData.components)) {
    throw new Error('Components array is required. Legacy format is no longer supported.');
  }

  if (salaryData.components.length === 0) {
    throw new Error('Components array cannot be empty. Must contain at least base salary.');
  }

  return readFromComponents(salaryData.components);
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
