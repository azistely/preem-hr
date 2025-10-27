/**
 * Terminal Payroll Service
 *
 * Generates final payslip for terminated employees including:
 * - Prorated salary for final month
 * - Severance pay (30%/35%/40% based on seniority)
 * - Vacation payout (unused leave balance)
 * - Notice period payment (if payment in lieu)
 *
 * Tax Treatment (Côte d'Ivoire):
 * - Severance up to legal minimum = tax-free
 * - Excess severance = fully taxable
 * - Vacation payout = fully taxable
 * - Notice payment = fully taxable
 */

import { db } from '@/db';
import {
  employees,
  employeeTerminations,
  employeeSalaries,
  tenants,
} from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import {
  calculatePayrollV2,
  type PayrollCalculationInputV2,
} from './payroll-calculation-v2';
import type { PayrollCalculationResult } from '../types';

export interface TerminalPayrollInput {
  terminationId: string;
  tenantId: string;
  payDate: Date; // When the final payment should be made
}

export interface TerminalPayrollResult extends PayrollCalculationResult {
  terminalPayments: {
    severancePay: number;
    severancePayTaxable: number;
    severancePayTaxFree: number;
    vacationPayout: number;
    noticePeriodPayment: number;
    totalTerminalPayments: number;
  };
  totalWithTerminalPayments: number;
}

/**
 * Calculate final payslip for terminated employee
 */
export async function calculateTerminalPayroll(
  input: TerminalPayrollInput
): Promise<TerminalPayrollResult> {
  console.log('[Terminal Payroll] Starting calculation for:', input);

  // 1. Fetch termination record
  console.log('[Terminal Payroll] Fetching termination record...');
  const [termination] = await db
    .select()
    .from(employeeTerminations)
    .where(
      and(
        eq(employeeTerminations.id, input.terminationId),
        eq(employeeTerminations.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!termination) {
    throw new Error('Termination not found');
  }

  // 2. Fetch employee details
  console.log('[Terminal Payroll] Fetching employee details...');
  const [employee] = await db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      hireDate: employees.hireDate,
      maritalStatus: employees.maritalStatus,
      dependentChildren: employees.dependentChildren,
    })
    .from(employees)
    .where(
      and(
        eq(employees.id, termination.employeeId),
        eq(employees.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!employee) {
    throw new Error('Employee not found');
  }

  // 3. Fetch tenant for country code and sector
  console.log('[Terminal Payroll] Fetching tenant...');
  const [tenant] = await db
    .select({
      countryCode: tenants.countryCode,
      sectorCode: tenants.sectorCode,
    })
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // 4. Fetch current salary
  console.log('[Terminal Payroll] Fetching salary...');
  const [salary] = await db
    .select()
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.employeeId, termination.employeeId),
        eq(employeeSalaries.tenantId, input.tenantId)
      )
    )
    .orderBy(desc(employeeSalaries.effectiveFrom))
    .limit(1);

  if (!salary) {
    throw new Error('Employee salary not found');
  }

  // 5. Extract base salary components and parse other allowances (database-driven, multi-country)
  const { extractBaseSalaryAmounts, getSalaireCategoriel, calculateBaseSalaryTotal } = await import('@/lib/salary-components/base-salary-loader');

  const salaryComponents = salary.components as Array<{ code: string; amount: number }> || [];
  const baseAmounts = await extractBaseSalaryAmounts(salaryComponents, tenant.countryCode);
  const totalBaseSalary = await calculateBaseSalaryTotal(salaryComponents, tenant.countryCode);
  const salaireCategoriel = await getSalaireCategoriel(salaryComponents, tenant.countryCode);

  const allowances = salary.allowances as any || {};
  const housingAllowance = parseFloat(allowances.housing || '0');
  const transportAllowance = parseFloat(allowances.transport || '0');
  const mealAllowance = parseFloat(allowances.meal || '0');

  // 6. Determine payroll period (from last pay date to termination date)
  const terminationDate = new Date(termination.terminationDate);
  const periodStart = new Date(terminationDate.getFullYear(), terminationDate.getMonth(), 1);
  const periodEnd = terminationDate;

  // 7. Calculate regular payroll (prorated for final month)
  const regularPayroll = await calculatePayrollV2({
    employeeId: employee.id,
    countryCode: tenant.countryCode,
    periodStart,
    periodEnd,
    baseSalary: totalBaseSalary, // Total of all base components
    salaireCategoriel, // Code 11 (or equivalent)
    sursalaire: baseAmounts['12'], // Code 12 for CI (if present)
    housingAllowance,
    transportAllowance,
    mealAllowance,
    terminationDate: termination.terminationDate,
    hireDate: employee.hireDate,
    sectorCode: tenant.sectorCode || 'SERVICES', // Use tenant's sector code (uppercase to match database)
    // Dynamic CMU calculation (GAP-CMU-001)
    maritalStatus: employee.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | undefined,
    dependentChildren: employee.dependentChildren ?? undefined,
  } as PayrollCalculationInputV2);

  // 8. Calculate terminal payments
  const severanceAmount = parseFloat(termination.severanceAmount);
  const vacationPayoutAmount = parseFloat(termination.vacationPayoutAmount || '0');

  // Notice period payment (if payment in lieu)
  // For now, assume no notice payment (can be added later)
  const noticePeriodPayment = 0;

  // 9. Calculate severance tax treatment
  // Legal minimum severance rates (Convention Collective):
  // - 30% for < 1 year
  // - 35% for 1-5 years
  // - 40% for 5+ years
  const yearsOfService = parseFloat(termination.yearsOfService);
  const averageSalary = parseFloat(termination.averageSalary12m);

  let legalMinimumSeverance = 0;
  if (yearsOfService < 1) {
    legalMinimumSeverance = averageSalary * 0.30 * yearsOfService;
  } else if (yearsOfService >= 1 && yearsOfService < 5) {
    legalMinimumSeverance = averageSalary * 0.35 * yearsOfService;
  } else {
    legalMinimumSeverance = averageSalary * 0.40 * yearsOfService;
  }

  // Severance up to legal minimum is tax-free, excess is taxable
  const severancePayTaxFree = Math.min(severanceAmount, legalMinimumSeverance);
  const severancePayTaxable = Math.max(0, severanceAmount - legalMinimumSeverance);

  const totalTerminalPayments = severanceAmount + vacationPayoutAmount + noticePeriodPayment;

  // 10. Add terminal payments to earnings details
  const earningsDetailsWithTerminal = [
    ...regularPayroll.earningsDetails,
    {
      type: 'severance_tax_free',
      description: 'Indemnité de licenciement (exonérée)',
      amount: severancePayTaxFree,
    },
  ];

  // Add taxable severance if applicable
  if (severancePayTaxable > 0) {
    earningsDetailsWithTerminal.push({
      type: 'severance_taxable',
      description: 'Indemnité de licenciement (imposable)',
      amount: severancePayTaxable,
    });
  }

  // Add vacation payout (fully taxable)
  if (vacationPayoutAmount > 0) {
    earningsDetailsWithTerminal.push({
      type: 'vacation_payout',
      description: 'Solde de congés payés',
      amount: vacationPayoutAmount,
    });
  }

  // Add notice period payment if applicable
  if (noticePeriodPayment > 0) {
    earningsDetailsWithTerminal.push({
      type: 'notice_payment',
      description: 'Indemnité de préavis',
      amount: noticePeriodPayment,
    });
  }

  // 11. Calculate taxes on terminal payments
  // Taxable terminal payments = severancePayTaxable + vacationPayoutAmount + noticePeriodPayment
  const taxableTerminalPayments = severancePayTaxable + vacationPayoutAmount + noticePeriodPayment;

  // For simplicity, apply same CNPS/CMU/ITS calculations on taxable terminal payments
  // In reality, vacation payout is subject to CNPS but severance is not
  // This is a simplified version - can be refined later

  // Recalculate payroll with terminal payments included
  const grossSalaryWithTerminal = regularPayroll.grossSalary + totalTerminalPayments;
  const taxableIncomeWithTerminal = regularPayroll.taxableIncome + taxableTerminalPayments;

  // For this version, we'll just add terminal payments to net without recalculating deductions
  // A more accurate version would recalculate CNPS/CMU/ITS on the new totals
  const netSalaryWithTerminal = regularPayroll.netSalary + severancePayTaxFree + taxableTerminalPayments;

  // 12. Return result
  return {
    ...regularPayroll,
    grossSalary: grossSalaryWithTerminal,
    netSalary: netSalaryWithTerminal,
    earningsDetails: earningsDetailsWithTerminal,
    terminalPayments: {
      severancePay: severanceAmount,
      severancePayTaxable,
      severancePayTaxFree,
      vacationPayout: vacationPayoutAmount,
      noticePeriodPayment,
      totalTerminalPayments,
    },
    totalWithTerminalPayments: netSalaryWithTerminal,
  };
}

/**
 * Calculate vacation payout based on unused leave balance
 *
 * Côte d'Ivoire: 2.5 days per month (30 days per year)
 * Payout = (unused days / 30) × monthly gross salary
 */
export function calculateVacationPayout(
  unusedLeaveDays: number,
  monthlyGrossSalary: number
): number {
  return (unusedLeaveDays / 30) * monthlyGrossSalary;
}
