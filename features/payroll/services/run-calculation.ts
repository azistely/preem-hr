/**
 * Payroll Run Orchestration Service
 *
 * Handles bulk payroll processing for all employees in a tenant:
 * - Create payroll run
 * - Calculate payroll for all active employees
 * - Update run with totals
 * - Handle errors gracefully
 *
 * Stories 7.1 & 7.2: Payroll Run Creation and Calculation
 */

import { db } from '@/lib/db';
import {
  employees,
  employeeSalaries,
  payrollRuns,
  payrollLineItems,
  tenants,
  timeEntries,
} from '@/lib/db/schema';
import { employmentContracts } from '@/drizzle/schema';
import { and, eq, lte, gte, or, isNotNull, isNull, sql, desc } from 'drizzle-orm';
import { calculatePayrollV2 } from './payroll-calculation-v2';
import {
  calculateFiscalPartsFromDependents,
  getVerifiedDependentsCount
} from '@/features/employees/services/dependent-verification.service';
import type { PayrollRunSummary } from '../types';
import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';
import { aggregateTimeEntriesForPayroll } from './time-entries-aggregation.service';
import { buildCalculationContext } from '../types/calculation-context';

export interface CreatePayrollRunInput {
  tenantId: string;
  countryCode: string;
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  name?: string;
  createdBy: string;
  paymentFrequency?: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'DAILY';
  closureSequence?: number;
}

export interface CalculatePayrollRunInput {
  runId: string;
}

export interface RecalculateSingleEmployeeInput {
  runId: string;
  employeeId: string;
  tenantId: string;
}

export interface RecalculateSingleEmployeeResult {
  success: boolean;
  before: { netSalary: number };
  after: { netSalary: number };
}

/**
 * Create a new payroll run
 *
 * Story 7.1: Create Payroll Run
 *
 * @param input - Payroll run creation parameters
 * @returns Created payroll run
 *
 * @throws Error if run already exists for period
 * @throws Error if no active employees found
 */
export async function createPayrollRun(
  input: CreatePayrollRunInput
): Promise<{ id: string; runNumber: string; status: string }> {
  // Validate period
  if (input.periodStart >= input.periodEnd) {
    throw new Error('La date de fin doit être postérieure à la date de début');
  }

  // Check if run already exists for this period (exact match or overlapping)
  // Only check for conflicts with the same payment frequency
  const periodStartStr = input.periodStart.toISOString().split('T')[0];
  const periodEndStr = input.periodEnd.toISOString().split('T')[0];

  const existing = await db.query.payrollRuns.findFirst({
    where: and(
      eq(payrollRuns.tenantId, input.tenantId),
      // Only check same payment frequency (MONTHLY runs don't conflict with WEEKLY runs)
      input.paymentFrequency ? eq(payrollRuns.paymentFrequency, input.paymentFrequency) : undefined,
      or(
        // Exact match
        and(
          eq(payrollRuns.periodStart, periodStartStr),
          eq(payrollRuns.periodEnd, periodEndStr)
        ),
        // Overlapping periods (new period starts during existing period)
        and(
          lte(payrollRuns.periodStart, periodStartStr),
          gte(payrollRuns.periodEnd, periodStartStr)
        ),
        // Overlapping periods (new period ends during existing period)
        and(
          lte(payrollRuns.periodStart, periodEndStr),
          gte(payrollRuns.periodEnd, periodEndStr)
        ),
        // Overlapping periods (new period contains existing period)
        and(
          gte(payrollRuns.periodStart, periodStartStr),
          lte(payrollRuns.periodEnd, periodEndStr)
        )
      )
    ),
  });

  if (existing) {
    // Return helpful error with link to existing payroll
    throw new Error(
      `Une paie existe déjà pour cette période (${existing.runNumber}). ` +
      `Consultez-la sur /payroll/runs/${existing.id} pour la recalculer ou la modifier.`
    );
  }

  // Count active employees
  const activeEmployees = await db.query.employees.findMany({
    where: and(
      eq(employees.tenantId, input.tenantId),
      eq(employees.status, 'active')
    ),
  });

  if (activeEmployees.length === 0) {
    throw new Error('Aucun employé actif trouvé pour ce tenant');
  }

  // Generate run number with payment frequency to avoid conflicts
  // Format: PAY-YYYY-MM for MONTHLY, PAY-YYYY-MM-W1/W2/W3/W4 for WEEKLY, PAY-YYYY-MM-Q1/Q2 for BIWEEKLY
  let runNumber = `PAY-${input.periodStart.getFullYear()}-${String(input.periodStart.getMonth() + 1).padStart(2, '0')}`;

  if (input.paymentFrequency === 'WEEKLY' && input.closureSequence) {
    runNumber += `-W${input.closureSequence}`;
  } else if (input.paymentFrequency === 'BIWEEKLY' && input.closureSequence) {
    runNumber += `-Q${input.closureSequence}`;
  } else if (input.paymentFrequency === 'DAILY') {
    // For daily, use the specific date
    runNumber = `PAY-${input.periodStart.toISOString().split('T')[0]}`;
  }
  // For MONTHLY, keep the simple format: PAY-YYYY-MM

  // Validate country has payroll config
  const { ruleLoader } = await import('./rule-loader');
  try {
    await ruleLoader.getCountryConfig(input.countryCode);
  } catch (error) {
    throw new Error(`Pays ${input.countryCode} n'a pas de configuration de paie valide`);
  }

  // Create run (convert dates to ISO strings for Drizzle date fields)
  const [run] = await db
    .insert(payrollRuns)
    .values({
      tenantId: input.tenantId,
      runNumber,
      periodStart: input.periodStart.toISOString().split('T')[0],
      periodEnd: input.periodEnd.toISOString().split('T')[0],
      payDate: input.paymentDate.toISOString().split('T')[0],
      countryCode: input.countryCode,
      status: 'draft',
      createdBy: input.createdBy,
      paymentFrequency: input.paymentFrequency || 'MONTHLY',
      closureSequence: input.closureSequence ?? null,
    } as any) // Type assertion needed due to Drizzle date field typing
    .returning();

  return {
    id: run.id,
    runNumber: run.runNumber,
    status: run.status,
  };
}

/**
 * Calculate payroll for all employees in a run
 *
 * Story 7.2: Calculate Payroll Run
 *
 * Process:
 * 1. Update run status to 'calculating'
 * 2. Get all active employees with current salaries
 * 3. Calculate payroll for each employee
 * 4. Create line items
 * 5. Update run with totals
 * 6. Set status to 'calculated'
 *
 * @param input - Calculation parameters
 * @returns Summary of calculated payroll run
 */
export async function calculatePayrollRun(
  input: CalculatePayrollRunInput
): Promise<PayrollRunSummary> {
  // Get the run
  const run = await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.id, input.runId),
  });

  if (!run) {
    throw new Error('Payroll run not found');
  }

  // Allow recalculation of draft and calculated runs (before approval)
  if (run.status !== 'draft' && run.status !== 'calculated') {
    throw new Error('La paie a déjà été approuvée et ne peut plus être recalculée');
  }

  // Update status to calculating
  await db
    .update(payrollRuns)
    .set({ status: 'calculating' })
    .where(eq(payrollRuns.id, input.runId));

  try {
    // Delete existing line items if recalculating
    // This allows users to recalculate runs with 'calculated' status
    await db
      .delete(payrollLineItems)
      .where(eq(payrollLineItems.payrollRunId, input.runId));

    // Get tenant with sector information and work accident rate
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, run.tenantId),
      columns: {
        countryCode: true,
        sectorCode: true,
        workAccidentRate: true,
      },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // DEBUG: Log the date values to understand what Drizzle returns
    console.log('[PAYROLL DEBUG] run.periodStart:', run.periodStart, 'type:', typeof run.periodStart);
    console.log('[PAYROLL DEBUG] run.periodEnd:', run.periodEnd, 'type:', typeof run.periodEnd);

    // FIX: Use sql operator for direct SQL date comparison instead of Drizzle's lte()
    // Drizzle's relational query API has issues with date comparisons when dates are returned as strings
    // CRITICAL: Filter employees by payment frequency to match the payroll run type
    // For MONTHLY runs (or NULL which defaults to MONTHLY): include employees with MONTHLY frequency OR NULL
    // For other frequencies: exact match only
    const paymentFrequencyFilter = (!run.paymentFrequency || run.paymentFrequency === 'MONTHLY')
      ? or(
          eq(employees.paymentFrequency, 'MONTHLY'),
          isNull(employees.paymentFrequency)
        )
      : eq(employees.paymentFrequency, run.paymentFrequency as string); // Type assertion safe here as we know it's not null

    const activeEmployees = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, run.tenantId),
          paymentFrequencyFilter, // FILTER BY PAYMENT FREQUENCY
          or(
            // Active employees hired before period end
            and(
              eq(employees.status, 'active'),
              sql`${employees.hireDate} <= ${run.periodEnd}`
            ),
            // Terminated employees who worked during period
            and(
              eq(employees.status, 'terminated'),
              sql`${employees.hireDate} <= ${run.periodEnd}`,
              isNotNull(employees.terminationDate),
              sql`${employees.terminationDate} >= ${run.periodStart}`
            )
          )
        )
      );

    console.log('[PAYROLL DEBUG] activeEmployees.length:', activeEmployees.length);
    if (activeEmployees.length > 0) {
      console.log('[PAYROLL DEBUG] First employee hireDate:', activeEmployees[0].hireDate, 'type:', typeof activeEmployees[0].hireDate);
    }

    if (activeEmployees.length === 0) {
      throw new Error('Aucun employé trouvé pour cette période');
    }

    const lineItemsData = [];
    const errors: Array<{ employeeId: string; error: string }> = [];

    // Process each employee
    for (const employee of activeEmployees) {
      console.log(`[PAYROLL DEBUG] Starting processing for employee ${employee.id} (${employee.firstName} ${employee.lastName})`);
      try {
        // FIX: Get current salary using sql operator for date comparisons
        // Drizzle's lte()/gte() have issues with date strings
        const salaries = await db
          .select()
          .from(employeeSalaries)
          .where(
            and(
              eq(employeeSalaries.employeeId, employee.id),
              sql`${employeeSalaries.effectiveFrom} <= ${run.periodEnd}`,
              or(
                isNull(employeeSalaries.effectiveTo),
                sql`${employeeSalaries.effectiveTo} >= ${run.periodStart}`
              )
            )
          )
          .orderBy(desc(employeeSalaries.effectiveFrom)); // Order by most recent first

        const currentSalary = salaries[0]; // Get most recent (first in descending order)

        console.log(`[PAYROLL DEBUG] Employee ${employee.id}: Found ${salaries.length} salaries, currentSalary:`, currentSalary ? 'YES' : 'NO');

        if (!currentSalary) {
          throw new Error('Aucun salaire trouvé pour cet employé');
        }

        // Get current employment contract to check contract type
        const currentContract = await db.query.employmentContracts.findFirst({
          where: and(
            eq(employmentContracts.employeeId, employee.id),
            or(
              isNull(employmentContracts.endDate),
              sql`${employmentContracts.endDate} >= ${run.periodStart}`
            )
          ),
          orderBy: desc(employmentContracts.startDate),
        });

        const contractType = currentContract?.contractType as 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | undefined;

        // Calculate fiscal parts from marital status and verified dependents table
        // This ensures consistent "personnes à charge" data source across ITS and CMU calculations
        //
        // Data sources (in priority order):
        // 1. customFields.fiscalParts (manual override for special cases)
        // 2. calculateFiscalPartsFromDependents() which queries:
        //    - employees.marital_status (to determine base: 2.0 married, 1.5 single w/kids, 1.0 single)
        //    - employee_dependents table (to count verified children eligible_for_fiscal_parts = true)
        //
        // Formula:
        //   - Married: 2.0 base + 0.5 per verified child (max 4)
        //   - Single with children: 1.5 base + 0.5 per verified child (max 4)
        //   - Single without children: 1.0
        //
        // This replaces the previous approach which used employee.dependent_children (simple number field)
        const hasFamily = (employee.customFields as any)?.hasFamily || false;
        const fiscalParts = (employee.customFields as any)?.fiscalParts ||
          await calculateFiscalPartsFromDependents(
            employee.id,
            run.tenantId,
            new Date(run.periodEnd) // Calculate as of period end date
          );

        // Get verified dependents count for CMU calculation
        // CMU uses the same dependents table source as fiscal parts for consistency
        // This counts all verified dependents (children only, spouse added separately by marital status)
        const verifiedCmuDependents = await getVerifiedDependentsCount(
          employee.id,
          run.tenantId,
          'cmu',
          new Date(run.periodEnd)
        );

        // Get components with variable inputs merged (date-range mode for multi-frequency payroll)
        const { getEmployeeSalaryComponentsForPeriod } = await import('@/lib/salary-components/component-reader');
        const breakdown = await getEmployeeSalaryComponentsForPeriod(
          currentSalary as any,
          employee.id,
          run.periodStart, // Start date (YYYY-MM-DD)
          run.tenantId,
          run.periodEnd    // End date (YYYY-MM-DD) - prevents variable duplication for multi-frequency
        );

        // Extract base salary components (database-driven, multi-country)
        const { extractBaseSalaryAmounts, getSalaireCategoriel, calculateBaseSalaryTotal } = await import('@/lib/salary-components/base-salary-loader');

        const salaryComponents = (currentSalary.components || []) as SalaryComponentInstance[];
        const baseAmounts = await extractBaseSalaryAmounts(salaryComponents, tenant.countryCode);
        const totalBaseSalary = await calculateBaseSalaryTotal(salaryComponents, tenant.countryCode);
        const salaireCategoriel = await getSalaireCategoriel(salaryComponents, tenant.countryCode);

        // Auto-calculate Prime d'ancienneté if not already in stored components
        // This ensures employees receive seniority bonus even if component wasn't explicitly added
        // IMPORTANT: Contract type eligibility is checked in the calculator (CI: CDI/CDD only, no CDDTI/INTERIM/STAGE)
        let effectiveSeniorityBonus = breakdown.seniorityBonus;

        if (effectiveSeniorityBonus === 0 && salaireCategoriel > 0) {
          // Calculate seniority bonus based on hire date and salaire catégoriel
          const { calculateSeniorityBonus } = await import('@/lib/salary-components/component-calculator');

          const seniorityCalc = await calculateSeniorityBonus({
            baseSalary: salaireCategoriel,
            hireDate: new Date(employee.hireDate),
            currentDate: new Date(run.periodEnd),
            tenantId: run.tenantId,
            countryCode: tenant.countryCode,
            contractType, // Pass contract type for eligibility checks
          });

          effectiveSeniorityBonus = seniorityCalc.amount;

          if (effectiveSeniorityBonus > 0) {
            console.log(`[PAYROLL AUTO-CALC] Employee ${employee.id} (${employee.firstName} ${employee.lastName}): Auto-calculated Prime d'ancienneté = ${effectiveSeniorityBonus} FCFA (${seniorityCalc.yearsOfService} years, ${(seniorityCalc.rate * 100).toFixed(0)}%)`);
          } else if (seniorityCalc.yearsOfService >= 2 && contractType && ['CDDTI', 'INTERIM', 'STAGE'].includes(contractType)) {
            console.log(`[PAYROLL AUTO-CALC] Employee ${employee.id} (${employee.firstName} ${employee.lastName}): Seniority bonus excluded for contract type ${contractType} (${seniorityCalc.yearsOfService} years of service)`);
          }
        }

        // Get employee rate type and calculate days/hours worked for daily/hourly workers
        const rateType = (employee.rateType || 'MONTHLY') as 'MONTHLY' | 'DAILY' | 'HOURLY';
        let daysWorkedThisMonth: number | undefined = undefined;
        let hoursWorkedThisMonth: number | undefined = undefined;

        if (rateType === 'DAILY') {
          // Query approved time entries for this employee in the payroll period
          const entries = await db
            .select()
            .from(timeEntries)
            .where(
              and(
                eq(timeEntries.employeeId, employee.id),
                eq(timeEntries.tenantId, run.tenantId),
                eq(timeEntries.status, 'approved'), // Only count approved entries
                sql`${timeEntries.clockIn} >= ${run.periodStart}`,
                sql`${timeEntries.clockIn} < ${run.periodEnd}`
              )
            );

          // Count unique work days (not total hours)
          // A worker might have multiple entries in one day, but should only be counted once
          const uniqueDays = new Set(
            entries.map(entry => {
              const date = new Date(entry.clockIn);
              return date.toISOString().split('T')[0]; // Get YYYY-MM-DD
            })
          );
          daysWorkedThisMonth = uniqueDays.size;

          console.log(`[PAYROLL DEBUG] Daily worker ${employee.id} (${employee.firstName} ${employee.lastName}): ${daysWorkedThisMonth} days worked, ${entries.length} time entries`);

          // Skip daily workers with 0 days worked (no salary to pay)
          if (daysWorkedThisMonth === 0) {
            console.log(`[PAYROLL DEBUG] Skipping daily worker ${employee.id} (${employee.firstName} ${employee.lastName}): 0 days worked`);
            continue; // Skip to next employee
          }
        }

        // CDDTI workers: Load total hours and special hours breakdown from time entries
        let saturdayHours = 0;
        let sundayHours = 0;
        let nightHours = 0;

        if (contractType === 'CDDTI') {
          // Use aggregation service to extract hours breakdown from time entries
          const aggregatedHours = await aggregateTimeEntriesForPayroll(
            employee.id,
            run.tenantId,
            run.periodStart, // Already in YYYY-MM-DD format
            run.periodEnd    // Already in YYYY-MM-DD format
          );

          // Set hours from aggregated data
          hoursWorkedThisMonth = aggregatedHours.totalHours;
          saturdayHours = aggregatedHours.saturdayHours;
          sundayHours = aggregatedHours.sundayHours;
          nightHours = aggregatedHours.nightHours;

          // ✅ IMPORTANT: Use presence days for transport allowance
          // Per user feedback (2025-11-03): Transport is based on presence days, NOT hours
          // Rule: 1 day on site = 1 full transport allowance, even if only 1 hour worked
          daysWorkedThisMonth = aggregatedHours.daysWorked;

          console.log(`[PAYROLL DEBUG] CDDTI worker ${employee.id} (${employee.firstName} ${employee.lastName}): ${hoursWorkedThisMonth} hours worked (${saturdayHours} Sat, ${sundayHours} Sun, ${nightHours} night), ${daysWorkedThisMonth} days present, ${aggregatedHours.entryCount} time entries`);

          // Skip CDDTI workers with 0 hours worked (no salary to pay)
          if (hoursWorkedThisMonth === 0) {
            console.log(`[PAYROLL DEBUG] Skipping CDDTI worker ${employee.id} (${employee.firstName} ${employee.lastName}): 0 hours worked`);
            continue; // Skip to next employee
          }
        }

        // Calculate payroll using V2 (database-driven, multi-country)
        // IMPORTANT: For CDDTI workers with component-based salary, pass baseSalary: 0
        // to trigger component-based calculation path (not legacy field-based path)
        // Component-based path correctly multiplies hourly rates by hours worked
        const useComponentBasedCalculation = contractType === 'CDDTI' && salaryComponents.length > 0;

        const calculation = await calculatePayrollV2({
          employeeId: employee.id,
          tenantId: run.tenantId, // CRITICAL: Pass tenantId for template component lookup
          countryCode: tenant.countryCode,
          sectorCode: tenant.sectorCode || 'SERVICES', // Fallback to SERVICES if not set
          workAccidentRate: tenant.workAccidentRate ? Number(tenant.workAccidentRate) : undefined, // CNPS-provided rate
          periodStart: new Date(run.periodStart),
          periodEnd: new Date(run.periodEnd),
          baseSalary: useComponentBasedCalculation ? 0 : totalBaseSalary, // Use 0 for CDDTI to trigger component-based path
          salaireCategoriel, // Code 11 (or equivalent)
          sursalaire: baseAmounts['12'], // Code 12 for CI (if present)
          // For component-based calculation (CDDTI), set field-based allowances to 0 to avoid duplication
          housingAllowance: useComponentBasedCalculation ? 0 : breakdown.housingAllowance,
          transportAllowance: useComponentBasedCalculation ? 0 : breakdown.transportAllowance,
          mealAllowance: useComponentBasedCalculation ? 0 : breakdown.mealAllowance,
          seniorityBonus: useComponentBasedCalculation ? 0 : effectiveSeniorityBonus, // Use auto-calculated value
          familyAllowance: useComponentBasedCalculation ? 0 : breakdown.familyAllowance,
          otherAllowances: useComponentBasedCalculation ? [] : breakdown.otherAllowances, // Include template components (TPT_*, PHONE, PERFORMANCE, etc.)
          // For CDDTI: Pass ALL salary components (not just custom) so they can be multiplied by hours
          customComponents: useComponentBasedCalculation
            ? salaryComponents.map(c => ({ ...c, name: c.name || 'Component', sourceType: 'standard' as const }))
            : breakdown.customComponents,
          fiscalParts,
          hasFamily,
          hireDate: new Date(employee.hireDate),
          terminationDate: employee.terminationDate ? new Date(employee.terminationDate) : undefined,
          rateType, // CRITICAL: Pass rate type to calculation engine
          contractType, // CRITICAL: Pass contract type for CDDTI detection
          daysWorkedThisMonth, // CRITICAL: Pass actual days worked for daily workers
          hoursWorkedThisMonth, // CRITICAL: Pass actual hours worked for CDDTI workers
          paymentFrequency: employee.paymentFrequency as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | undefined,
          weeklyHoursRegime: employee.weeklyHoursRegime as '40h' | '44h' | '48h' | '52h' | '56h' | undefined,
          // Special hours from time entries (Saturday, Sunday, Night) - automatically extracted
          saturdayHours, // Hours worked on Saturday (1.40× multiplier)
          sundayHours, // Hours worked on Sunday/holiday (1.40× multiplier)
          nightHours, // Hours worked at night 21h-5h (1.75× multiplier)
          // Dynamic CMU calculation using verified dependents from employee_dependents table
          // This ensures consistency with fiscal parts calculation (same "personnes à charge" source)
          maritalStatus: employee.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | undefined,
          dependentChildren: verifiedCmuDependents, // Use verified dependents count from table
        });

        // Prepare line item data (using new schema structure)
        lineItemsData.push({
          tenantId: run.tenantId,
          payrollRunId: run.id,
          employeeId: employee.id,

          // Denormalized employee info (for historical accuracy and exports)
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeNumber: employee.employeeNumber,
          positionTitle: employee.jobTitle || null,

          // Salary information
          baseSalary: String(calculation.baseSalary),
          allowances: {
            housing: breakdown.housingAllowance,
            transport: breakdown.transportAllowance,
            meal: breakdown.mealAllowance,
            seniority: effectiveSeniorityBonus, // Use auto-calculated value
            family: breakdown.familyAllowance,
          },

          // Time tracking
          daysWorked: String(calculation.daysWorked),
          daysAbsent: '0',
          hoursWorked: hoursWorkedThisMonth ? String(hoursWorkedThisMonth) : '0',
          overtimeHours: {},

          // Gross calculation
          grossSalary: String(calculation.grossSalary),
          brutImposable: String(calculation.brutImposable),

          // Detailed breakdowns (for CDDTI components like gratification, congés payés, précarité)
          earningsDetails: calculation.earningsDetails || [],
          deductionsDetails: calculation.deductionsDetails || [],

          // Deductions (both JSONB and dedicated columns for exports)
          taxDeductions: { its: calculation.its },
          employeeContributions: {
            cnps: calculation.cnpsEmployee,
            cmu: calculation.cmuEmployee,
          },
          otherDeductions: {},

          // Individual deduction columns (for easy export access)
          cnpsEmployee: String(calculation.cnpsEmployee),
          cmuEmployee: String(calculation.cmuEmployee),
          its: String(calculation.its),

          // Net calculation
          totalDeductions: String(calculation.totalDeductions),
          netSalary: String(calculation.netSalary),

          // Employer costs (both JSONB and dedicated columns)
          employerContributions: {
            cnps: calculation.cnpsEmployer,
            cmu: calculation.cmuEmployer,
          },
          cnpsEmployer: String(calculation.cnpsEmployer),
          cmuEmployer: String(calculation.cmuEmployer),
          totalEmployerCost: String(calculation.employerCost),

          // Other taxes
          totalOtherTaxes: String(calculation.otherTaxesEmployer || 0),
          otherTaxesDetails: calculation.otherTaxesDetails || [],

          // Contribution details (Pension, AT, PF breakdown for UI display)
          contributionDetails: calculation.contributionDetails || [],

          // Calculation context (for auditability and exact reproduction)
          calculationContext: buildCalculationContext({
            // Employee context
            fiscalParts,
            maritalStatus: employee.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | undefined,
            dependentChildren: verifiedCmuDependents,
            hasFamily,

            // Employment context
            rateType,
            contractType,
            weeklyHoursRegime: employee.weeklyHoursRegime as '40h' | '44h' | '48h' | '52h' | '56h' | undefined,
            paymentFrequency: employee.paymentFrequency as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | undefined,
            sectorCode: tenant.sectorCode || 'SERVICES',

            // Salary context
            salaireCategoriel,
            sursalaire: baseAmounts['12'],
            components: salaryComponents,
            allowances: {
              housing: breakdown.housingAllowance,
              transport: breakdown.transportAllowance,
              meal: breakdown.mealAllowance,
              seniority: breakdown.seniorityBonus,
              family: breakdown.familyAllowance,
            },

            // Time context
            hireDate: new Date(employee.hireDate),
            terminationDate: employee.terminationDate ? new Date(employee.terminationDate) : undefined,
            periodStart: new Date(run.periodStart),
            periodEnd: new Date(run.periodEnd),
            daysWorkedThisMonth,
            hoursWorkedThisMonth,

            // Calculation meta
            countryCode: tenant.countryCode,
          }),

          // Payment details
          paymentMethod: 'bank_transfer',
          bankAccount: employee.bankAccount,
          status: 'pending',
        });
      } catch (error) {
        // Log error but continue with other employees
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`[PAYROLL ERROR] Employee ${employee.id} (${employee.firstName} ${employee.lastName}):`, errorMsg);
        console.error(`[PAYROLL ERROR] Stack trace:`, errorStack);
        errors.push({
          employeeId: employee.id,
          error: errorMsg,
        });
      }
    }

    console.log(`[PAYROLL DEBUG] Processing complete: ${lineItemsData.length} line items created, ${errors.length} errors`);
    if (errors.length > 0) {
      console.error('[PAYROLL ERROR] Errors during processing:', errors);
    }

    // Insert all line items
    if (lineItemsData.length > 0) {
      await db.insert(payrollLineItems).values(lineItemsData);
    }

    // Calculate totals (using new schema structure)
    const totals = lineItemsData.reduce(
      (acc, item) => {
        const empContribs = item.employeeContributions as any;
        const taxDeds = item.taxDeductions as any;
        const emplContribs = item.employerContributions as any;

        return {
          totalGross: acc.totalGross + Number(item.grossSalary),
          totalNet: acc.totalNet + Number(item.netSalary),
          totalEmployerCost: acc.totalEmployerCost + Number(item.totalEmployerCost),
          totalEmployeeContributions: acc.totalEmployeeContributions + Number(empContribs.cnps || 0) + Number(empContribs.cmu || 0),
          totalEmployerContributions: acc.totalEmployerContributions + Number(emplContribs.cnps || 0) + Number(emplContribs.cmu || 0),
          totalTax: acc.totalTax + Number(taxDeds.its || 0),
        };
      },
      {
        totalGross: 0,
        totalNet: 0,
        totalEmployerCost: 0,
        totalEmployeeContributions: 0,
        totalEmployerContributions: 0,
        totalTax: 0,
      }
    );

    // Update run with totals (using new schema structure)
    await db
      .update(payrollRuns)
      .set({
        status: 'calculated',
        processedAt: new Date(),
        totalGross: String(totals.totalGross),
        totalNet: String(totals.totalNet),
        totalTax: String(totals.totalTax),
        totalEmployeeContributions: String(totals.totalEmployeeContributions),
        totalEmployerContributions: String(totals.totalEmployerContributions),
      } as any)
      .where(eq(payrollRuns.id, input.runId));

    return {
      runId: run.id,
      employeeCount: lineItemsData.length,
      ...totals,
    };
  } catch (error) {
    // Rollback to draft on error
    await db
      .update(payrollRuns)
      .set({ status: 'failed' })
      .where(eq(payrollRuns.id, input.runId));

    throw error;
  }
}

/**
 * Recalculate payroll for a single employee
 *
 * Reuses the same logic as bulk calculation to ensure consistency.
 * This is called by the per-employee "Recalculer" button in the review screen.
 *
 * @param input - Recalculation parameters
 * @returns Before/after net salary comparison
 */
export async function recalculateSingleEmployee(
  input: RecalculateSingleEmployeeInput
): Promise<RecalculateSingleEmployeeResult> {
  // Get the run
  const run = await db.query.payrollRuns.findFirst({
    where: and(
      eq(payrollRuns.id, input.runId),
      eq(payrollRuns.tenantId, input.tenantId)
    ),
  });

  if (!run) {
    throw new Error('Payroll run not found');
  }

  // Get tenant
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, input.tenantId),
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Get employee
  const employee = await db.query.employees.findFirst({
    where: and(
      eq(employees.id, input.employeeId),
      eq(employees.tenantId, input.tenantId)
    ),
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  // Get current line item
  const [currentLineItem] = await db
    .select()
    .from(payrollLineItems)
    .where(
      and(
        eq(payrollLineItems.payrollRunId, input.runId),
        eq(payrollLineItems.employeeId, input.employeeId)
      )
    )
    .limit(1);

  if (!currentLineItem) {
    throw new Error('Line item not found');
  }

  const beforeNetSalary = Number(currentLineItem.netSalary);

  // Get current employment contract
  const currentContract = await db.query.employmentContracts.findFirst({
    where: and(
      eq(employmentContracts.employeeId, employee.id),
      or(
        isNull(employmentContracts.endDate),
        sql`${employmentContracts.endDate} >= ${run.periodStart}`
      )
    ),
    orderBy: desc(employmentContracts.startDate),
  });

  const contractType = currentContract?.contractType as 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | undefined;

  // Get current salary
  const salaries = await db
    .select()
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.employeeId, employee.id),
        sql`${employeeSalaries.effectiveFrom} <= ${run.periodEnd}`,
        or(
          isNull(employeeSalaries.effectiveTo),
          sql`${employeeSalaries.effectiveTo} >= ${run.periodStart}`
        )
      )
    )
    .orderBy(desc(employeeSalaries.effectiveFrom));

  const currentSalary = salaries[0];

  if (!currentSalary) {
    throw new Error('No salary found for employee');
  }

  // Get family status (using verified dependents for consistency)
  const hasFamily = (employee.customFields as any)?.hasFamily || false;
  const fiscalParts = (employee.customFields as any)?.fiscalParts ||
    await calculateFiscalPartsFromDependents(
      employee.id,
      run.tenantId,
      new Date(run.periodEnd)
    );

  // Get verified dependents count for CMU calculation
  const verifiedCmuDependents = await getVerifiedDependentsCount(
    employee.id,
    run.tenantId,
    'cmu',
    new Date(run.periodEnd)
  );

  // Get components breakdown (date-range mode for multi-frequency payroll)
  const { getEmployeeSalaryComponentsForPeriod } = await import('@/lib/salary-components/component-reader');
  const breakdown = await getEmployeeSalaryComponentsForPeriod(
    currentSalary as any,
    employee.id,
    run.periodStart, // Start date (YYYY-MM-DD)
    run.tenantId,
    run.periodEnd    // End date (YYYY-MM-DD) - prevents variable duplication for multi-frequency
  );

  // Extract base salary components
  const { extractBaseSalaryAmounts, getSalaireCategoriel, calculateBaseSalaryTotal } = await import('@/lib/salary-components/base-salary-loader');
  const salaryComponents = (currentSalary.components || []) as SalaryComponentInstance[];
  const baseAmounts = await extractBaseSalaryAmounts(salaryComponents, tenant.countryCode);
  const totalBaseSalary = await calculateBaseSalaryTotal(salaryComponents, tenant.countryCode);
  const salaireCategoriel = await getSalaireCategoriel(salaryComponents, tenant.countryCode);

  // Get rate type and load hours/days
  const rateType = (employee.rateType || 'MONTHLY') as 'MONTHLY' | 'DAILY' | 'HOURLY';
  let daysWorkedThisMonth: number | undefined = undefined;
  let hoursWorkedThisMonth: number | undefined = undefined;

  if (rateType === 'DAILY') {
    const entries = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.employeeId, employee.id),
          eq(timeEntries.tenantId, input.tenantId),
          eq(timeEntries.status, 'approved'),
          sql`${timeEntries.clockIn} >= ${run.periodStart}`,
          sql`${timeEntries.clockIn} < ${run.periodEnd}`
        )
      );

    const uniqueDays = new Set(
      entries.map(entry => {
        const date = new Date(entry.clockIn);
        return date.toISOString().split('T')[0];
      })
    );
    daysWorkedThisMonth = uniqueDays.size;
  }

  if (contractType === 'CDDTI') {
    const entries = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.employeeId, employee.id),
          eq(timeEntries.tenantId, input.tenantId),
          eq(timeEntries.status, 'approved'),
          sql`${timeEntries.clockIn} >= ${run.periodStart}`,
          sql`${timeEntries.clockIn} < ${run.periodEnd}`
        )
      );

    hoursWorkedThisMonth = entries.reduce((total, entry) => {
      const hours = entry.totalHours ? parseFloat(String(entry.totalHours)) : 0;
      return total + hours;
    }, 0);

    // ✅ IMPORTANT: Calculate presence days for transport allowance
    // Per user feedback (2025-11-03): Transport is based on presence days, NOT hours
    // Rule: 1 day on site = 1 full transport allowance, even if only 1 hour worked
    const uniqueDays = new Set(
      entries.map(entry => {
        const date = new Date(entry.clockIn);
        return date.toISOString().split('T')[0]; // Get YYYY-MM-DD
      })
    );
    daysWorkedThisMonth = uniqueDays.size;
  }

  // Calculate payroll
  // IMPORTANT: For CDDTI workers with component-based salary, pass baseSalary: 0
  // to trigger component-based calculation path (not legacy field-based path)
  // Component-based path correctly multiplies hourly rates by hours worked
  const useComponentBasedCalculation = contractType === 'CDDTI' && salaryComponents.length > 0;

  console.log('[RECALCULATE DEBUG] CDDTI detection:', {
    contractType,
    salaryComponentsCount: salaryComponents.length,
    useComponentBasedCalculation,
    hoursWorkedThisMonth,
    components: salaryComponents,
  });

  const calculation = await calculatePayrollV2({
    employeeId: employee.id,
    tenantId: run.tenantId,
    countryCode: tenant.countryCode,
    sectorCode: tenant.genericSectorCode || tenant.sectorCode || 'SERVICES',
    workAccidentRate: tenant.workAccidentRate ? Number(tenant.workAccidentRate) : undefined, // CNPS-provided rate
    periodStart: new Date(run.periodStart),
    periodEnd: new Date(run.periodEnd),
    baseSalary: useComponentBasedCalculation ? 0 : totalBaseSalary, // Use 0 for CDDTI to trigger component-based path
    salaireCategoriel,
    sursalaire: baseAmounts['12'],
    // For component-based calculation (CDDTI), set field-based allowances to 0 to avoid duplication
    housingAllowance: useComponentBasedCalculation ? 0 : breakdown.housingAllowance,
    transportAllowance: useComponentBasedCalculation ? 0 : breakdown.transportAllowance,
    mealAllowance: useComponentBasedCalculation ? 0 : breakdown.mealAllowance,
    seniorityBonus: useComponentBasedCalculation ? 0 : breakdown.seniorityBonus,
    familyAllowance: useComponentBasedCalculation ? 0 : breakdown.familyAllowance,
    otherAllowances: useComponentBasedCalculation ? [] : breakdown.otherAllowances,
    // For CDDTI: Pass ALL salary components (not just custom) so they can be multiplied by hours
    customComponents: useComponentBasedCalculation
      ? salaryComponents.map(c => ({ ...c, name: c.name || 'Component', sourceType: 'standard' as const }))
      : breakdown.customComponents,
    fiscalParts,
    hasFamily,
    hireDate: new Date(employee.hireDate),
    terminationDate: employee.terminationDate ? new Date(employee.terminationDate) : undefined,
    rateType,
    contractType,
    daysWorkedThisMonth,
    hoursWorkedThisMonth,
    paymentFrequency: employee.paymentFrequency as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | undefined,
    weeklyHoursRegime: employee.weeklyHoursRegime as '40h' | '44h' | '48h' | '52h' | '56h' | undefined,
    maritalStatus: employee.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | undefined,
    dependentChildren: verifiedCmuDependents, // Use verified dependents from table
  });

  // Update line item
  await db
    .update(payrollLineItems)
    .set({
      baseSalary: String(calculation.baseSalary),
      daysWorked: String(calculation.daysWorked),
      hoursWorked: hoursWorkedThisMonth ? String(hoursWorkedThisMonth) : '0',
      grossSalary: String(calculation.grossSalary),
      netSalary: String(calculation.netSalary),
      totalDeductions: String(calculation.totalDeductions),
      totalEmployerCost: String(calculation.employerCost),
      employerCost: String(calculation.employerCost),
      cnpsEmployee: String(calculation.cnpsEmployee),
      cmuEmployee: String(calculation.cmuEmployee),
      its: String(calculation.its),
      cnpsEmployer: String(calculation.cnpsEmployer),
      cmuEmployer: String(calculation.cmuEmployer),
      earningsDetails: calculation.earningsDetails || [],
      deductionsDetails: calculation.deductionsDetails || [],
      calculationContext: buildCalculationContext({
        // Employee context
        fiscalParts,
        maritalStatus: employee.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | undefined,
        dependentChildren: verifiedCmuDependents,
        hasFamily,

        // Employment context
        rateType,
        contractType,
        weeklyHoursRegime: employee.weeklyHoursRegime as '40h' | '44h' | '48h' | '52h' | '56h' | undefined,
        paymentFrequency: employee.paymentFrequency as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | undefined,
        sectorCode: tenant.genericSectorCode || tenant.sectorCode || 'SERVICES',

        // Salary context
        salaireCategoriel,
        sursalaire: baseAmounts['12'],
        components: salaryComponents,
        allowances: {
          housing: breakdown.housingAllowance,
          transport: breakdown.transportAllowance,
          meal: breakdown.mealAllowance,
          seniority: breakdown.seniorityBonus,
          family: breakdown.familyAllowance,
        },

        // Time context
        hireDate: new Date(employee.hireDate),
        terminationDate: employee.terminationDate ? new Date(employee.terminationDate) : undefined,
        periodStart: new Date(run.periodStart),
        periodEnd: new Date(run.periodEnd),
        daysWorkedThisMonth,
        hoursWorkedThisMonth,

        // Calculation meta
        countryCode: tenant.countryCode,
      }),
      updatedAt: new Date(),
    })
    .where(eq(payrollLineItems.id, currentLineItem.id));

  return {
    success: true,
    before: { netSalary: beforeNetSalary },
    after: { netSalary: calculation.netSalary },
  };
}
