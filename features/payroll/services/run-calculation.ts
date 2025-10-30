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
import { and, eq, lte, gte, or, isNotNull, isNull, sql, desc } from 'drizzle-orm';
import { calculatePayrollV2 } from './payroll-calculation-v2';
import type { PayrollRunSummary } from '../types';

export interface CreatePayrollRunInput {
  tenantId: string;
  countryCode: string;
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  name?: string;
  createdBy: string;
}

export interface CalculatePayrollRunInput {
  runId: string;
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

  // Check if run already exists for this period
  const existing = await db.query.payrollRuns.findFirst({
    where: and(
      eq(payrollRuns.tenantId, input.tenantId),
      eq(payrollRuns.periodStart, input.periodStart.toISOString()),
      eq(payrollRuns.periodEnd, input.periodEnd.toISOString())
    ),
  });

  if (existing) {
    throw new Error('Une paie existe déjà pour cette période');
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

  // Generate run number with sequential counter
  // Get the count of existing runs for this tenant in this month
  const monthStart = new Date(input.periodStart.getFullYear(), input.periodStart.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(input.periodStart.getFullYear(), input.periodStart.getMonth() + 1, 0).toISOString().split('T')[0];

  const existingRuns = await db.query.payrollRuns.findMany({
    where: and(
      eq(payrollRuns.tenantId, input.tenantId),
      gte(payrollRuns.periodStart, monthStart),
      lte(payrollRuns.periodStart, monthEnd)
    ),
  });

  const counter = existingRuns.length + 1;
  const runNumber = counter === 1
    ? `PAY-${input.periodStart.getFullYear()}-${String(input.periodStart.getMonth() + 1).padStart(2, '0')}`
    : `PAY-${input.periodStart.getFullYear()}-${String(input.periodStart.getMonth() + 1).padStart(2, '0')}-${counter}`;

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

  if (run.status !== 'draft') {
    throw new Error('La paie a déjà été calculée ou est en cours de traitement');
  }

  // Update status to calculating
  await db
    .update(payrollRuns)
    .set({ status: 'calculating' })
    .where(eq(payrollRuns.id, input.runId));

  try {
    // Get tenant with sector information
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, run.tenantId),
      columns: {
        countryCode: true,
        sectorCode: true,
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
    const activeEmployees = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, run.tenantId),
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

        // Get family status from custom fields
        const hasFamily = (employee.customFields as any)?.hasFamily || false;
        const fiscalParts = (employee.customFields as any)?.fiscalParts || 1.0;

        // Convert period to YYYY-MM-01 format
        const periodDate = new Date(run.periodStart);
        const periodKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}-01`;

        // Get components with variable inputs merged
        const { getEmployeeSalaryComponentsForPeriod } = await import('@/lib/salary-components/component-reader');
        const breakdown = await getEmployeeSalaryComponentsForPeriod(
          currentSalary as any,
          employee.id,
          periodKey,
          run.tenantId
        );

        // Extract base salary components (database-driven, multi-country)
        const { extractBaseSalaryAmounts, getSalaireCategoriel, calculateBaseSalaryTotal } = await import('@/lib/salary-components/base-salary-loader');

        const salaryComponents = currentSalary.components as Array<{ code: string; amount: number }> || [];
        const baseAmounts = await extractBaseSalaryAmounts(salaryComponents, tenant.countryCode);
        const totalBaseSalary = await calculateBaseSalaryTotal(salaryComponents, tenant.countryCode);
        const salaireCategoriel = await getSalaireCategoriel(salaryComponents, tenant.countryCode);

        // Get employee rate type and calculate days worked for daily workers
        const rateType = (employee.rateType || 'MONTHLY') as 'MONTHLY' | 'DAILY' | 'HOURLY';
        let daysWorkedThisMonth: number | undefined = undefined;

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

        // Calculate payroll using V2 (database-driven, multi-country)
        const calculation = await calculatePayrollV2({
          employeeId: employee.id,
          tenantId: run.tenantId, // CRITICAL: Pass tenantId for template component lookup
          countryCode: tenant.countryCode,
          sectorCode: tenant.sectorCode || 'SERVICES', // Fallback to SERVICES if not set
          periodStart: new Date(run.periodStart),
          periodEnd: new Date(run.periodEnd),
          baseSalary: totalBaseSalary, // Total of all base components
          salaireCategoriel, // Code 11 (or equivalent)
          sursalaire: baseAmounts['12'], // Code 12 for CI (if present)
          housingAllowance: breakdown.housingAllowance,
          transportAllowance: breakdown.transportAllowance,
          mealAllowance: breakdown.mealAllowance,
          seniorityBonus: breakdown.seniorityBonus,
          familyAllowance: breakdown.familyAllowance,
          otherAllowances: breakdown.otherAllowances, // Include template components (TPT_*, PHONE, PERFORMANCE, etc.)
          customComponents: breakdown.customComponents,
          fiscalParts,
          hasFamily,
          hireDate: new Date(employee.hireDate),
          terminationDate: employee.terminationDate ? new Date(employee.terminationDate) : undefined,
          rateType, // CRITICAL: Pass rate type to calculation engine
          daysWorkedThisMonth, // CRITICAL: Pass actual days worked for daily workers
          // Dynamic CMU calculation (GAP-CMU-001)
          maritalStatus: employee.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | undefined,
          dependentChildren: employee.dependentChildren ?? undefined,
        });

        // Prepare line item data (using new schema structure)
        lineItemsData.push({
          tenantId: run.tenantId,
          payrollRunId: run.id,
          employeeId: employee.id,

          // Denormalized employee info (for historical accuracy and exports)
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeNumber: employee.employeeNumber,
          positionTitle: null, // Position is tracked separately in job_details table

          // Salary information
          baseSalary: String(calculation.baseSalary),
          allowances: {
            housing: breakdown.housingAllowance,
            transport: breakdown.transportAllowance,
            meal: breakdown.mealAllowance,
            seniority: breakdown.seniorityBonus,
            family: breakdown.familyAllowance,
          },

          // Time tracking
          daysWorked: String(calculation.daysWorked),
          daysAbsent: '0',
          overtimeHours: {},

          // Gross calculation
          grossSalary: String(calculation.grossSalary),

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
