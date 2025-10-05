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
} from '@/lib/db/schema';
import { and, eq, lte, gte, or, isNotNull, isNull } from 'drizzle-orm';
import { calculatePayroll } from './payroll-calculation';
import type { PayrollRunSummary } from '../types';

export interface CreatePayrollRunInput {
  tenantId: string;
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
): Promise<{ id: string; name: string; status: string }> {
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

  // Create run
  const [run] = await db
    .insert(payrollRuns)
    .values({
      tenantId: input.tenantId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      paymentDate: input.paymentDate,
      name:
        input.name ||
        `Paie ${input.periodStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
      status: 'draft',
      createdBy: input.createdBy,
    })
    .returning();

  return {
    id: run.id,
    name: run.name,
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
    // Get all active employees for this tenant
    // Include those hired before period end OR terminated after period start
    const activeEmployees = await db.query.employees.findMany({
      where: and(
        eq(employees.tenantId, run.tenantId),
        or(
          // Active employees
          and(
            eq(employees.status, 'active'),
            lte(employees.hireDate, run.periodEnd)
          ),
          // Terminated employees who worked during period
          and(
            eq(employees.status, 'terminated'),
            lte(employees.hireDate, run.periodEnd),
            isNotNull(employees.terminationDate),
            gte(employees.terminationDate, run.periodStart)
          )
        )
      ),
    });

    if (activeEmployees.length === 0) {
      throw new Error('Aucun employé trouvé pour cette période');
    }

    const lineItemsData = [];
    const errors: Array<{ employeeId: string; error: string }> = [];

    // Process each employee
    for (const employee of activeEmployees) {
      try {
        // Get current salary for this employee
        const currentSalary = await db.query.employeeSalaries.findFirst({
          where: and(
            eq(employeeSalaries.employeeId, employee.id),
            lte(employeeSalaries.effectiveFrom, run.periodEnd),
            or(
              isNull(employeeSalaries.effectiveTo),
              gte(employeeSalaries.effectiveTo, run.periodStart)
            )
          ),
          orderBy: (salaries, { desc }) => [desc(salaries.effectiveFrom)],
        });

        if (!currentSalary) {
          throw new Error('Aucun salaire trouvé pour cet employé');
        }

        // Get family status from custom fields
        const hasFamily = (employee.customFields as any)?.hasFamily || false;

        // Calculate payroll
        const calculation = calculatePayroll({
          employeeId: employee.id,
          periodStart: run.periodStart,
          periodEnd: run.periodEnd,
          baseSalary: Number(currentSalary.baseSalary),
          housingAllowance: Number(currentSalary.housingAllowance || 0),
          transportAllowance: Number(currentSalary.transportAllowance || 0),
          mealAllowance: Number(currentSalary.mealAllowance || 0),
          hasFamily,
          hireDate: employee.hireDate,
          terminationDate: employee.terminationDate || undefined,
        });

        // Prepare line item data
        lineItemsData.push({
          tenantId: run.tenantId,
          payrollRunId: run.id,
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeNumber: employee.employeeNumber,

          // Earnings
          baseSalary: String(calculation.baseSalary),
          overtimePay: String(calculation.overtimePay),
          bonuses: String(calculation.bonuses),
          allowances: String(calculation.allowances),
          grossSalary: String(calculation.grossSalary),

          // Deductions
          cnpsEmployee: String(calculation.cnpsEmployee),
          cmuEmployee: String(calculation.cmuEmployee),
          its: String(calculation.its),
          otherDeductions: '0',
          totalDeductions: String(calculation.totalDeductions),

          // Employer
          cnpsEmployer: String(calculation.cnpsEmployer),
          cmuEmployer: String(calculation.cmuEmployer),

          // Net
          netSalary: String(calculation.netSalary),
          employerCost: String(calculation.employerCost),

          // Details
          earningsDetails: calculation.earningsDetails,
          deductionsDetails: calculation.deductionsDetails,
          daysWorked: String(calculation.daysWorked),
        });
      } catch (error) {
        // Log error but continue with other employees
        errors.push({
          employeeId: employee.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Insert all line items
    if (lineItemsData.length > 0) {
      await db.insert(payrollLineItems).values(lineItemsData);
    }

    // Calculate totals
    const totals = lineItemsData.reduce(
      (acc, item) => ({
        totalGross: acc.totalGross + Number(item.grossSalary),
        totalNet: acc.totalNet + Number(item.netSalary),
        totalEmployerCost: acc.totalEmployerCost + Number(item.employerCost),
        totalCnpsEmployee: acc.totalCnpsEmployee + Number(item.cnpsEmployee),
        totalCnpsEmployer: acc.totalCnpsEmployer + Number(item.cnpsEmployer),
        totalIts: acc.totalIts + Number(item.its),
      }),
      {
        totalGross: 0,
        totalNet: 0,
        totalEmployerCost: 0,
        totalCnpsEmployee: 0,
        totalCnpsEmployer: 0,
        totalIts: 0,
      }
    );

    // Update run with totals
    await db
      .update(payrollRuns)
      .set({
        status: 'calculated',
        calculatedAt: new Date(),
        employeeCount: lineItemsData.length,
        totalGross: String(totals.totalGross),
        totalNet: String(totals.totalNet),
        totalEmployerCost: String(totals.totalEmployerCost),
        totalCnpsEmployee: String(totals.totalCnpsEmployee),
        totalCnpsEmployer: String(totals.totalCnpsEmployer),
        totalIts: String(totals.totalIts),
      })
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
