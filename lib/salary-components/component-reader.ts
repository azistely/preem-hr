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
import {
  getVariablePayInputsForEmployee,
  getVariablePayInputsForDateRange
} from '@/features/payroll/services/variable-pay-inputs.service';

export interface EmployeeSalaryData {
  components: SalaryComponentInstance[];
  baseSalary?: string | number; // Fallback: base_salary column
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
  otherAllowances: Array<{ code: string; name: string; amount: number; taxable: boolean }>;
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

  // Allow empty components array if we have base_salary column (for backward compatibility)
  // This handles cases where salary was created before components migration
  const breakdown = readFromComponents(salaryData.components);

  // FALLBACK: If base salary not found in components (code '11'), use base_salary column
  if (breakdown.baseSalary === 0 && salaryData.baseSalary) {
    const baseSalaryValue = typeof salaryData.baseSalary === 'string'
      ? parseFloat(salaryData.baseSalary)
      : salaryData.baseSalary;

    if (!isNaN(baseSalaryValue) && baseSalaryValue > 0) {
      breakdown.baseSalary = baseSalaryValue;
    }
  }

  // Validate that we have a base salary from somewhere
  if (breakdown.baseSalary === 0) {
    throw new Error('Base salary is required (either in components array with code "11" or in baseSalary column).');
  }

  return breakdown;
}

// ============================================================================
// LEGACY: Component Reader (Backward Compatibility Only)
// ============================================================================
//
// ⚠️ WARNING: This section contains legacy code for backward compatibility.
//
// **DO NOT USE THIS FOR NEW CODE**
//
// For metadata-driven component processing, use:
//   - ComponentProcessor.processComponents() in lib/salary-components/
//
// This legacy code exists only to support:
//   1. Old code that directly calls getEmployeeSalaryComponents()
//   2. Simple breakdown conversion (components → structured breakdown)
//
// Migration path:
//   - Old: getEmployeeSalaryComponents(salary) → ComponentsBreakdown
//   - New: ComponentProcessor.processComponents(components, context) → ProcessedComponent[]
//
// ============================================================================

/**
 * Read from new component-based system (LEGACY)
 *
 * ⚠️ This function uses hardcoded logic for backward compatibility.
 * For metadata-driven processing, use ComponentProcessor instead.
 *
 * @param components Salary component instances
 * @returns Breakdown for calculation
 * @deprecated Use ComponentProcessor for new code
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

  // LEGACY SWITCH: Maps component codes to breakdown fields
  // For metadata-driven processing, see ComponentProcessor.processComponent()
  for (const component of components) {
    switch (component.code) {
      case '11': // Salaire catégoriel (categorical/minimum salary)
      case '12': // Sursalaire (premium above minimum) - part of base salary in CI
        // ✅ FIX: Both code 11 and 12 are base salary components
        // Base salary = Salaire catégoriel (11) + Sursalaire (12)
        breakdown.baseSalary += component.amount;
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

      // Non-taxable allowances (codes 33-38)
      case '33': // Prime de salissure (Dirtiness allowance)
      case '34': // Prime de représentation (Representation allowance)
      case '35': // Prime de déplacement (Travel allowance)
      case '36': // Prime de tenue (Uniform allowance)
      case '37': // Prime de caisse (Cashier allowance)
      case '38': // Prime de panier (Meal basket allowance)
      case 'responsibility': // Indemnité de responsabilité (Responsibility allowance)
        // These are non-taxable allowances - add to otherAllowances
        breakdown.otherAllowances.push({
          code: component.code,
          name: component.name,
          amount: component.amount,
          taxable: false, // Explicitly non-taxable
        });
        break;

      default:
        // Custom component (CUSTOM_XXX codes)
        if (component.code.startsWith('CUSTOM_')) {
          breakdown.customComponents.push(component);
        } else {
          // Other standard components → add to otherAllowances
          breakdown.otherAllowances.push({
            code: component.code,
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
 * Check if component is taxable based on metadata (LEGACY)
 *
 * ⚠️ DEPRECATED: This is a legacy helper for backward compatibility.
 * New code should use ComponentProcessor for metadata-driven processing.
 *
 * @param component Salary component instance
 * @returns true if taxable
 * @deprecated Use ComponentProcessor.processComponent() for tax treatment
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
// END OF LEGACY SECTION
// ============================================================================
//
// Everything above this line is legacy code. For new features:
//   1. Use ComponentProcessor.processComponents() for metadata-driven processing
//   2. Use the helpers below for tax treatment queries (already metadata-aware)
//
// Migration path documented in:
//   - docs/DATABASE-DRIVEN-COMPONENT-ARCHITECTURE.md
//   - lib/salary-components/component-processor.ts
//
// ============================================================================

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

// ============================================================================
// Variable Pay Integration (Async)
// ============================================================================

/**
 * Get employee salary components for a specific period or date range (async version)
 *
 * Merges fixed components from employee_salaries.components with
 * variable pay inputs for the period or date range.
 *
 * Architecture:
 * - Fixed components (housing, transport) → employee_salaries.components
 * - Variable components (commissions, bonuses) → variable_pay_inputs table
 * - Payroll calculation → uses this merged result
 *
 * Multi-frequency payroll support:
 * - Monthly: Pass period only (YYYY-MM-01)
 * - Weekly/Bi-weekly/Daily: Pass period start and end dates to prevent duplication
 *
 * @param salaryData Employee salary record with fixed components
 * @param employeeId Employee ID
 * @param periodOrStartDate Period (YYYY-MM-01) OR start date (YYYY-MM-DD) for date-range filtering
 * @param tenantId Tenant ID for security
 * @param endDate Optional end date (YYYY-MM-DD) for date-range filtering (multi-frequency payroll)
 * @returns Components breakdown with variable inputs merged
 */
export async function getEmployeeSalaryComponentsForPeriod(
  salaryData: EmployeeSalaryData,
  employeeId: string,
  periodOrStartDate: string, // YYYY-MM-01 or YYYY-MM-DD
  tenantId: string,
  endDate?: string // Optional: YYYY-MM-DD for date-range filtering
): Promise<ComponentsBreakdown> {
  // Start with fixed components
  const fixedComponents = salaryData.components as SalaryComponentInstance[];

  // Fetch variable inputs (date range mode for multi-frequency, period mode for monthly)
  let variableInputs;
  if (endDate) {
    // Date range mode (weekly/bi-weekly/daily payroll)
    // Only includes variables where entry_date is in [periodOrStartDate, endDate]
    variableInputs = await getVariablePayInputsForDateRange(
      tenantId,
      employeeId,
      periodOrStartDate,
      endDate
    );
  } else {
    // Period mode (monthly payroll - backward compatible)
    variableInputs = await getVariablePayInputsForEmployee(
      tenantId,
      employeeId,
      periodOrStartDate
    );
  }

  // Merge: If a component has a variable input, use that amount instead
  const mergedComponents = fixedComponents.map((component) => {
    const variableInput = variableInputs.find(
      (v) => v.componentCode === component.code
    );

    if (variableInput) {
      // Use variable amount instead of fixed amount
      return {
        ...component,
        amount: Number(variableInput.amount),
      };
    }

    return component;
  });

  // Add variable-only components (not in fixed components)
  for (const variableInput of variableInputs) {
    const existsInFixed = fixedComponents.some(
      (c) => c.code === variableInput.componentCode
    );

    if (!existsInFixed) {
      // This is a variable-only component, add it to the merged list
      mergedComponents.push({
        code: variableInput.componentCode,
        name: variableInput.componentCode, // Will be enriched by component definition lookup
        amount: Number(variableInput.amount),
        sourceType: 'custom', // Variable inputs are treated as custom components
      });
    }
  }

  // Convert to breakdown format
  return readFromComponents(mergedComponents);
}
