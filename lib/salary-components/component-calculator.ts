/**
 * Salary Component Calculators
 *
 * Auto-calculated components (e.g., seniority bonus)
 * Reads metadata and applies calculation rules
 *
 * Updated to load formulas from database via formula-loader service
 */

import type {
  SalaryComponentInstance,
  CIComponentMetadata,
} from '@/features/employees/types/salary-components';
import { loadFormulaMetadata } from './formula-loader';

// ============================================================================
// Seniority Bonus Calculator (Auto-Calculated)
// ============================================================================

export interface SeniorityCalculationInput {
  baseSalary: number;
  hireDate: Date;
  currentDate?: Date;
  metadata?: CIComponentMetadata;
  // New: For DB formula loading
  tenantId?: string;
  countryCode?: string;
}

export interface SeniorityCalculationResult {
  yearsOfService: number;
  rate: number; // Applied rate (e.g., 0.10 for 10%)
  amount: number;
  isCapped: boolean;
}

/**
 * Calculate seniority bonus (Prime d'ancienneté)
 *
 * Rules (CI):
 * - 2% of base salary per year of service (configurable via DB metadata)
 * - Maximum 25% (configurable via DB metadata)
 *
 * @param input Calculation parameters
 * @returns Calculation result with amount and details
 */
export async function calculateSeniorityBonus(
  input: SeniorityCalculationInput
): Promise<SeniorityCalculationResult> {
  const { baseSalary, hireDate, currentDate = new Date(), metadata, tenantId, countryCode } = input;

  // Load formula from database if tenantId provided
  let effectiveMetadata = metadata;
  if (tenantId && !metadata) {
    const loaded = await loadFormulaMetadata({
      componentCode: '21',
      tenantId,
      countryCode,
    });
    effectiveMetadata = loaded.metadata as CIComponentMetadata;
  }

  // Extract calculation rules from metadata (with fallback defaults)
  const ratePerYear = (effectiveMetadata?.calculationRule?.rate ?? 0.02); // Default 2%
  const maxRate = (effectiveMetadata?.calculationRule?.cap ?? 0.25); // Default 25%

  // Calculate years of service
  const millisecondsPerYear = 1000 * 60 * 60 * 24 * 365.25;
  const yearsOfService = Math.floor(
    (currentDate.getTime() - hireDate.getTime()) / millisecondsPerYear
  );

  // Calculate rate (uncapped)
  const calculatedRate = yearsOfService * ratePerYear;

  // Apply cap
  const rate = Math.min(calculatedRate, maxRate);
  const isCapped = calculatedRate > maxRate;

  // Calculate amount
  const amount = Math.round(baseSalary * rate);

  return {
    yearsOfService,
    rate,
    amount,
    isCapped,
  };
}

/**
 * Create seniority component instance
 *
 * @param baseSalary Employee's base salary
 * @param hireDate Employee's hire date
 * @param metadata Component metadata (optional)
 * @param tenantId Tenant ID for formula loading (optional)
 * @param countryCode Country code for formula loading (optional)
 * @returns Salary component instance
 */
export async function createSeniorityComponent(
  baseSalary: number,
  hireDate: Date,
  metadata?: CIComponentMetadata,
  tenantId?: string,
  countryCode?: string
): Promise<SalaryComponentInstance> {
  const calculation = await calculateSeniorityBonus({
    baseSalary,
    hireDate,
    metadata,
    tenantId,
    countryCode,
  });

  return {
    code: '21', // Standard code for seniority
    name: "Prime d'ancienneté",
    amount: calculation.amount,
    metadata,
    sourceType: 'standard',
  };
}

// ============================================================================
// Family Allowance Calculator (Auto-Calculated)
// ============================================================================

export interface FamilyAllowanceInput {
  numberOfDependents: number;
  countryCode: string;
  baseSalary?: number; // Some countries base it on salary
}

/**
 * Calculate family allowance (Allocations familiales)
 *
 * Rules vary by country:
 * - CI: Fixed amount per dependent (loaded from family_deduction_rules)
 * - This is simplified - actual calculation should read from DB
 *
 * @param input Calculation parameters
 * @returns Amount
 */
export function calculateFamilyAllowance(input: FamilyAllowanceInput): number {
  const { numberOfDependents } = input;

  // Simplified: In production, this should read from family_deduction_rules table
  // For now, use CI standard rate: 4,200 FCFA per dependent (up to 6)
  const ratePerDependent = 4200;
  const maxDependents = 6;

  const allowedDependents = Math.min(numberOfDependents, maxDependents);
  return allowedDependents * ratePerDependent;
}

/**
 * Create family allowance component instance
 *
 * @param numberOfDependents Number of tax dependents
 * @param countryCode Country code
 * @param metadata Component metadata (optional)
 * @returns Salary component instance
 */
export function createFamilyAllowanceComponent(
  numberOfDependents: number,
  countryCode: string,
  metadata?: CIComponentMetadata
): SalaryComponentInstance {
  const amount = calculateFamilyAllowance({ numberOfDependents, countryCode });

  return {
    code: '41',
    name: 'Allocations familiales',
    amount,
    metadata,
    sourceType: 'standard',
  };
}

// ============================================================================
// Component Auto-Injection (Smart Defaults)
// ============================================================================

export interface AutoInjectOptions {
  baseSalary: number;
  hireDate: Date;
  numberOfDependents?: number;
  countryCode: string;
  tenantId?: string; // For DB formula loading
  enableSeniority?: boolean;
  enableFamilyAllowance?: boolean;
}

/**
 * Auto-inject calculated components for an employee
 *
 * @param options Auto-injection options
 * @returns Array of component instances
 */
export async function autoInjectCalculatedComponents(
  options: AutoInjectOptions
): Promise<SalaryComponentInstance[]> {
  console.time('[Component Calculator] Total auto-inject time');
  const autoInjectStart = Date.now();

  const {
    baseSalary,
    hireDate,
    numberOfDependents = 0,
    countryCode,
    tenantId,
    enableSeniority = true,
    enableFamilyAllowance = true,
  } = options;

  const components: SalaryComponentInstance[] = [];

  // Auto-inject seniority bonus (if eligible)
  if (enableSeniority) {
    console.time('[Component Calculator] Seniority calculation');
    const seniorityStart = Date.now();
    const seniorityCalc = await calculateSeniorityBonus({
      baseSalary,
      hireDate,
      tenantId,
      countryCode,
    });
    console.timeEnd('[Component Calculator] Seniority calculation');
    console.log(`[Component Calculator] Seniority calculated in ${Date.now() - seniorityStart}ms`);

    // Only inject if employee has been there >= 1 year
    if (seniorityCalc.yearsOfService >= 1) {
      console.time('[Component Calculator] Create seniority component');
      const createStart = Date.now();
      const seniorityComponent = await createSeniorityComponent(
        baseSalary,
        hireDate,
        undefined,
        tenantId,
        countryCode
      );
      console.timeEnd('[Component Calculator] Create seniority component');
      console.log(`[Component Calculator] Component created in ${Date.now() - createStart}ms`);
      components.push(seniorityComponent);
    }
  }

  // Auto-inject family allowance (if has dependents)
  if (enableFamilyAllowance && numberOfDependents > 0) {
    console.time('[Component Calculator] Family allowance');
    const familyStart = Date.now();
    components.push(createFamilyAllowanceComponent(numberOfDependents, countryCode));
    console.timeEnd('[Component Calculator] Family allowance');
    console.log(`[Component Calculator] Family allowance created in ${Date.now() - familyStart}ms`);
  }

  console.timeEnd('[Component Calculator] Total auto-inject time');
  console.log(`[Component Calculator] TOTAL AUTO-INJECT: ${Date.now() - autoInjectStart}ms`);

  return components;
}

// ============================================================================
// Check Eligibility for Auto-Enable Rules
// ============================================================================

export interface EligibilityCheck {
  componentCode: string;
  componentName: string;
  isEligible: boolean;
  reason?: string; // Human-readable explanation
  suggestedAmount?: number;
}

/**
 * Check which components an employee is eligible for
 *
 * @param options Auto-injection options
 * @returns Array of eligibility checks
 */
export async function checkComponentEligibility(
  options: AutoInjectOptions
): Promise<EligibilityCheck[]> {
  const { baseSalary, hireDate, numberOfDependents = 0, tenantId, countryCode } = options;
  const checks: EligibilityCheck[] = [];

  // Check seniority eligibility
  const seniorityCalc = await calculateSeniorityBonus({
    baseSalary,
    hireDate,
    tenantId,
    countryCode,
  });
  checks.push({
    componentCode: '21',
    componentName: "Prime d'ancienneté",
    isEligible: seniorityCalc.yearsOfService >= 1,
    reason:
      seniorityCalc.yearsOfService >= 1
        ? `${seniorityCalc.yearsOfService} années de service (${(seniorityCalc.rate * 100).toFixed(0)}%)`
        : "Moins d'1 an de service",
    suggestedAmount: seniorityCalc.yearsOfService >= 1 ? seniorityCalc.amount : 0,
  });

  // Check family allowance eligibility
  checks.push({
    componentCode: '41',
    componentName: 'Allocations familiales',
    isEligible: numberOfDependents > 0,
    reason:
      numberOfDependents > 0
        ? `${numberOfDependents} personne(s) à charge`
        : 'Aucune personne à charge',
    suggestedAmount:
      numberOfDependents > 0
        ? calculateFamilyAllowance({ numberOfDependents, countryCode })
        : 0,
  });

  return checks;
}
