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

  // Generate run number
  const runNumber = `PAY-${input.periodStart.getFullYear()}-${String(input.periodStart.getMonth() + 1).padStart(2, '0')}`;

  // Create run (convert dates to ISO strings for Drizzle date fields)
  const [run] = await db
    .insert(payrollRuns)
    .values({
      tenantId: input.tenantId,
      runNumber,
      periodStart: input.periodStart.toISOString().split('T')[0],
      periodEnd: input.periodEnd.toISOString().split('T')[0],
      payDate: input.paymentDate.toISOString().split('T')[0],
      countryCode: 'CI',
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

        // Extract allowances from JSONB
        const allowances = (currentSalary.allowances as any) || {};
        const housingAllowance = Number(allowances.housing || 0);
        const transportAllowance = Number(allowances.transport || 0);
        const mealAllowance = Number(allowances.meal || 0);

        // Calculate payroll
        const calculation = calculatePayroll({
          employeeId: employee.id,
          periodStart: new Date(run.periodStart),
          periodEnd: new Date(run.periodEnd),
          baseSalary: Number(currentSalary.baseSalary),
          housingAllowance,
          transportAllowance,
          mealAllowance,
          hasFamily,
          hireDate: new Date(employee.hireDate),
          terminationDate: employee.terminationDate ? new Date(employee.terminationDate) : undefined,
        });

        // Prepare line item data (using new schema structure)
        lineItemsData.push({
          tenantId: run.tenantId,
          payrollRunId: run.id,
          employeeId: employee.id,

          // Salary information
          baseSalary: String(calculation.baseSalary),
          allowances: {
            housing: housingAllowance,
            transport: transportAllowance,
            meal: mealAllowance,
          },

          // Time tracking
          daysWorked: String(calculation.daysWorked),
          daysAbsent: '0',
          overtimeHours: {},

          // Gross calculation
          grossSalary: String(calculation.grossSalary),

          // Deductions
          taxDeductions: { its: calculation.its },
          employeeContributions: {
            cnps: calculation.cnpsEmployee,
            cmu: calculation.cmuEmployee,
          },
          otherDeductions: {},

          // Net calculation
          totalDeductions: String(calculation.totalDeductions),
          netSalary: String(calculation.netSalary),

          // Employer costs
          employerContributions: {
            cnps: calculation.cnpsEmployer,
            cmu: calculation.cmuEmployer,
          },
          totalEmployerCost: String(calculation.employerCost),

          // Payment details
          paymentMethod: 'bank_transfer',
          bankAccount: employee.bankAccount,
          status: 'pending',
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
        status: 'processing',
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
