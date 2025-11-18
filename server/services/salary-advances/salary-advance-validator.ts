/**
 * Salary Advance Policy Validator Service
 *
 * Purpose: Validate advance requests against country-specific policies
 * Features:
 * - Employee eligibility validation (employment duration, outstanding advances)
 * - Amount limit validation (percentage of salary, absolute limits)
 * - SMIG protection (net salary after deduction must not fall below minimum wage)
 * - Repayment period validation (allowed months per policy)
 * - Request frequency validation (max requests per month)
 *
 * Business Rules (Côte d'Ivoire):
 * - Max advance: 30% of net monthly salary
 * - Min employment: 3 months
 * - Max outstanding advances: 1
 * - Repayment: 1-3 months
 * - Net salary after deduction ≥ SMIG (75,000 FCFA for CI)
 */

import { and, eq, gte, count, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  salaryAdvances,
  salaryAdvancePolicies,
  AdvanceStatus,
  type SalaryAdvancePolicy,
} from '@/lib/db/schema/salary-advances';
import { employees } from '@/lib/db/schema/employees';
import { employeeSalaries } from '@/lib/db/schema/salaries';
import { calculateEmployeeNetSalaryWithFallback } from './net-salary-calculator';
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  QuickValidationInput,
} from '@/features/salary-advances/types/salary-advance.types';
import { AdvanceErrorCodes } from '@/features/salary-advances/types/salary-advance.types';

/**
 * Country-specific minimum wages (SMIG)
 * Used for SMIG protection validation
 */
const COUNTRY_SMIG: Record<string, number> = {
  CI: 75000, // Côte d'Ivoire: 75,000 FCFA
  SN: 52500, // Sénégal: 52,500 FCFA
  BF: 34664, // Burkina Faso: 34,664 FCFA
  // Add more as needed
};

/**
 * Get country SMIG (minimum wage)
 * Falls back to 0 if country not configured (will skip SMIG check)
 */
function getCountrySMIG(countryCode: string): number {
  return COUNTRY_SMIG[countryCode] ?? 0;
}

/**
 * Validate salary advance request against policy rules
 *
 * @param tenantId - Tenant ID
 * @param employeeId - Employee requesting advance
 * @param requestedAmount - Amount requested
 * @param repaymentMonths - Repayment period in months
 * @returns Validation result with errors, warnings, and context
 */
export async function validateAdvanceRequest(
  tenantId: string,
  employeeId: string,
  requestedAmount: number,
  repaymentMonths: number
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Get employee data
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
    .limit(1);

  if (!employee) {
    return {
      isValid: false,
      errors: [
        {
          code: AdvanceErrorCodes.EMPLOYEE_NOT_FOUND,
          message: 'Employé introuvable',
          field: 'employeeId',
        },
      ],
      warnings: [],
      maxAllowedAmount: 0,
      employeeNetSalary: 0,
      outstandingAdvancesCount: 0,
      requestsThisMonth: 0,
    };
  }

  // 2. Calculate employee's current net salary using payroll engine
  let employeeNetSalary = 0;
  try {
    employeeNetSalary = await calculateEmployeeNetSalaryWithFallback(
      employeeId,
      tenantId
    );
  } catch (error) {
    errors.push({
      code: AdvanceErrorCodes.NO_ACTIVE_SALARY,
      message: 'Impossible de calculer le salaire net de l\'employé',
      field: 'employeeId',
    });
  }

  if (employeeNetSalary === 0) {
    errors.push({
      code: AdvanceErrorCodes.NO_ACTIVE_SALARY,
      message: 'Aucun salaire actif trouvé pour cet employé',
      field: 'employeeId',
    });
  }

  // 3. Get active policy for tenant's country
  const [policy] = await db
    .select()
    .from(salaryAdvancePolicies)
    .where(
      and(
        eq(salaryAdvancePolicies.tenantId, tenantId),
        eq(salaryAdvancePolicies.isActive, true)
      )
    )
    .limit(1);

  if (!policy) {
    errors.push({
      code: AdvanceErrorCodes.NO_POLICY,
      message: 'Aucune politique d\'avance configurée',
    });
  }

  // 4. Count outstanding advances (active or approved)
  const outstandingAdvancesResult = await db
    .select({ count: count() })
    .from(salaryAdvances)
    .where(
      and(
        eq(salaryAdvances.tenantId, tenantId),
        eq(salaryAdvances.employeeId, employeeId),
        eq(salaryAdvances.status, AdvanceStatus.ACTIVE)
      )
    );

  const outstandingAdvancesCount =
    outstandingAdvancesResult[0]?.count ?? 0;

  // 5. Count requests made this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const requestsThisMonthResult = await db
    .select({ count: count() })
    .from(salaryAdvances)
    .where(
      and(
        eq(salaryAdvances.tenantId, tenantId),
        eq(salaryAdvances.employeeId, employeeId),
        gte(salaryAdvances.requestDate, startOfMonth)
      )
    );

  const requestsThisMonth = requestsThisMonthResult[0]?.count ?? 0;

  // 6. Calculate employment duration
  const employmentStartDate = employee.hireDate
    ? new Date(employee.hireDate)
    : null;
  const employmentMonths = employmentStartDate
    ? Math.floor(
        (now.getTime() - employmentStartDate.getTime()) /
          (1000 * 60 * 60 * 24 * 30)
      )
    : 0;

  // If we have errors already, return early
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
      maxAllowedAmount: 0,
      employeeNetSalary,
      outstandingAdvancesCount,
      requestsThisMonth,
    };
  }

  // 7. Run policy validations (we know policy exists from earlier check)
  if (policy) {
    validateAgainstPolicy(
      policy,
      employee,
      employeeNetSalary,
      requestedAmount,
      repaymentMonths,
      employmentMonths,
      outstandingAdvancesCount,
      requestsThisMonth,
      errors,
      warnings
    );
  }

  // 8. Calculate max allowed amount
  const maxAllowedAmount = policy
    ? calculateMaxAllowedAmount(policy, employeeNetSalary)
    : 0;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    maxAllowedAmount,
    employeeNetSalary,
    outstandingAdvancesCount,
    requestsThisMonth,
  };
}

/**
 * Run all policy-based validations
 */
function validateAgainstPolicy(
  policy: SalaryAdvancePolicy,
  employee: any,
  employeeNetSalary: number,
  requestedAmount: number,
  repaymentMonths: number,
  employmentMonths: number,
  outstandingAdvancesCount: number,
  requestsThisMonth: number,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Validation 1: Minimum employment duration
  const minEmploymentMonths = policy.minEmploymentMonths ?? 3;
  if (employmentMonths < minEmploymentMonths) {
    errors.push({
      code: AdvanceErrorCodes.INSUFFICIENT_EMPLOYMENT,
      message: `L'employé doit avoir au moins ${minEmploymentMonths} mois d'ancienneté (actuellement: ${employmentMonths} mois)`,
      field: 'employeeId',
      value: employmentMonths,
    });
  }

  // Validation 2: Maximum outstanding advances
  const maxOutstanding = policy.maxOutstandingAdvances ?? 1;
  if (outstandingAdvancesCount >= maxOutstanding) {
    errors.push({
      code: AdvanceErrorCodes.TOO_MANY_OUTSTANDING,
      message: `L'employé a déjà ${outstandingAdvancesCount} avance(s) en cours (maximum autorisé: ${maxOutstanding})`,
      field: 'employeeId',
      value: outstandingAdvancesCount,
    });
  }

  // Validation 3: Maximum requests per month
  const maxRequestsPerMonth = policy.maxRequestsPerMonth ?? 2;
  if (requestsThisMonth >= maxRequestsPerMonth) {
    errors.push({
      code: AdvanceErrorCodes.TOO_MANY_REQUESTS,
      message: `L'employé a déjà fait ${requestsThisMonth} demande(s) ce mois (maximum: ${maxRequestsPerMonth})`,
      field: 'employeeId',
      value: requestsThisMonth,
    });
  }

  // Validation 4: Minimum advance amount
  const minAmount = policy.minAdvanceAmount
    ? Number(policy.minAdvanceAmount)
    : 0;
  if (requestedAmount < minAmount) {
    errors.push({
      code: AdvanceErrorCodes.AMOUNT_TOO_LOW,
      message: `Montant minimum: ${minAmount.toLocaleString('fr-FR')} FCFA`,
      field: 'requestedAmount',
      value: requestedAmount,
    });
  }

  // Validation 5: Maximum advance amount (percentage of net salary)
  const maxPercentage = Number(policy.maxPercentageOfNetSalary) / 100;
  const maxByPercentage = employeeNetSalary * maxPercentage;
  const maxAbsolute = policy.maxAbsoluteAmount
    ? Number(policy.maxAbsoluteAmount)
    : Infinity;
  const maxAllowed = Math.min(maxByPercentage, maxAbsolute);

  if (requestedAmount > maxAllowed) {
    errors.push({
      code: AdvanceErrorCodes.AMOUNT_TOO_HIGH,
      message: `Montant maximum autorisé: ${maxAllowed.toLocaleString('fr-FR')} FCFA (${Number(policy.maxPercentageOfNetSalary)}% du salaire net)`,
      field: 'requestedAmount',
      value: requestedAmount,
    });
  }

  // Validation 6: Repayment period must be in allowed list
  const allowedMonths = policy.allowedRepaymentMonths ?? [1, 2, 3];
  if (!allowedMonths.includes(repaymentMonths)) {
    errors.push({
      code: AdvanceErrorCodes.INVALID_REPAYMENT_PERIOD,
      message: `Périodes de remboursement autorisées: ${allowedMonths.join(', ')} mois`,
      field: 'repaymentMonths',
      value: repaymentMonths,
    });
  }

  // Validation 7: SMIG Protection (net salary after deduction ≥ SMIG)
  const countryCode = policy.countryCode;
  const smig = getCountrySMIG(countryCode);

  if (smig > 0) {
    const monthlyDeduction = Math.ceil(requestedAmount / repaymentMonths);
    const netAfterDeduction = employeeNetSalary - monthlyDeduction;

    if (netAfterDeduction < smig) {
      const maxSafeAmount = (employeeNetSalary - smig) * repaymentMonths;
      errors.push({
        code: AdvanceErrorCodes.SMIG_VIOLATION,
        message: `Le salaire net après déduction (${netAfterDeduction.toLocaleString('fr-FR')} FCFA) serait inférieur au SMIG de ${countryCode} (${smig.toLocaleString('fr-FR')} FCFA). Montant maximum autorisé: ${Math.max(0, maxSafeAmount).toLocaleString('fr-FR')} FCFA`,
        field: 'requestedAmount',
        value: requestedAmount,
      });
    }
  }

  // Warning: Request close to maximum allowed
  if (requestedAmount > maxAllowed * 0.9 && requestedAmount <= maxAllowed) {
    warnings.push({
      code: 'HIGH_AMOUNT',
      message: `Ce montant représente ${Math.round((requestedAmount / maxAllowed) * 100)}% de la limite maximale`,
    });
  }

  // Warning: Short repayment period with high amount
  if (repaymentMonths === 1 && requestedAmount > employeeNetSalary * 0.2) {
    warnings.push({
      code: 'SHORT_REPAYMENT_HIGH_AMOUNT',
      message: 'Remboursement en 1 mois avec montant élevé - impact significatif sur le salaire net',
    });
  }
}

/**
 * Calculate maximum allowed advance amount for an employee
 *
 * @param policy - Active salary advance policy
 * @param employeeNetSalary - Employee's current net salary
 * @returns Maximum amount employee can request
 */
export function calculateMaxAllowedAmount(
  policy: SalaryAdvancePolicy,
  employeeNetSalary: number
): number {
  // Calculate percentage-based limit
  const maxPercentage = Number(policy.maxPercentageOfNetSalary) / 100;
  const maxByPercentage = employeeNetSalary * maxPercentage;

  // Apply absolute limit if configured
  const maxAbsolute = policy.maxAbsoluteAmount
    ? Number(policy.maxAbsoluteAmount)
    : Infinity;

  // Return the lower of the two limits
  return Math.min(maxByPercentage, maxAbsolute);
}

/**
 * Calculate maximum allowed amount with SMIG protection
 *
 * Takes into account that net salary after deduction must not fall below SMIG
 *
 * @param policy - Active salary advance policy
 * @param employeeNetSalary - Employee's current net salary
 * @param repaymentMonths - Desired repayment period
 * @returns Maximum safe amount that respects SMIG protection
 */
export function calculateMaxAllowedWithSMIG(
  policy: SalaryAdvancePolicy,
  employeeNetSalary: number,
  repaymentMonths: number
): number {
  // Get basic max amount
  const basicMax = calculateMaxAllowedAmount(policy, employeeNetSalary);

  // Get SMIG for country
  const smig = getCountrySMIG(policy.countryCode);
  if (smig === 0) {
    return basicMax; // No SMIG constraint
  }

  // Calculate max amount that keeps salary above SMIG
  const maxMonthlyDeduction = employeeNetSalary - smig;
  const maxWithSMIG = maxMonthlyDeduction * repaymentMonths;

  // Return the more restrictive limit
  return Math.max(0, Math.min(basicMax, maxWithSMIG));
}

/**
 * Quick validation check (for UI feedback)
 *
 * Lighter version of full validation - only checks basic rules
 * Used for real-time form validation before submission
 *
 * @param input - Quick validation input
 * @param tenantId - Tenant ID
 * @returns Simplified validation result
 */
export async function quickValidateAmount(
  input: QuickValidationInput,
  tenantId: string
): Promise<{
  isValid: boolean;
  maxAllowed: number;
  message?: string;
}> {
  const { requestedAmount, repaymentMonths, employeeId } = input;

  // Get policy
  const [policy] = await db
    .select()
    .from(salaryAdvancePolicies)
    .where(
      and(
        eq(salaryAdvancePolicies.tenantId, tenantId),
        eq(salaryAdvancePolicies.isActive, true)
      )
    )
    .limit(1);

  if (!policy) {
    return {
      isValid: false,
      maxAllowed: 0,
      message: 'Aucune politique configurée',
    };
  }

  // Get employee salary (if employeeId provided)
  let employeeNetSalary = 0;
  if (employeeId) {
    employeeNetSalary = await calculateEmployeeNetSalaryWithFallback(
      employeeId,
      tenantId
    );
  }

  // Calculate max allowed
  const maxAllowed =
    employeeNetSalary > 0
      ? calculateMaxAllowedWithSMIG(policy, employeeNetSalary, repaymentMonths)
      : 0;

  // Quick checks
  const minAmount = policy.minAdvanceAmount
    ? Number(policy.minAdvanceAmount)
    : 0;

  if (requestedAmount < minAmount) {
    return {
      isValid: false,
      maxAllowed,
      message: `Montant minimum: ${minAmount.toLocaleString('fr-FR')} FCFA`,
    };
  }

  if (requestedAmount > maxAllowed) {
    return {
      isValid: false,
      maxAllowed,
      message: `Montant maximum: ${maxAllowed.toLocaleString('fr-FR')} FCFA`,
    };
  }

  return {
    isValid: true,
    maxAllowed,
  };
}

/**
 * Get active policy for a tenant
 *
 * @param tenantId - Tenant ID
 * @returns Active salary advance policy or null
 */
export async function getActivePolicy(
  tenantId: string
): Promise<SalaryAdvancePolicy | null> {
  const [policy] = await db
    .select()
    .from(salaryAdvancePolicies)
    .where(
      and(
        eq(salaryAdvancePolicies.tenantId, tenantId),
        eq(salaryAdvancePolicies.isActive, true)
      )
    )
    .limit(1);

  return policy ?? null;
}
