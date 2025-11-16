/**
 * Import historical payroll data into the database
 */

import { db } from '@/lib/db';
import { employees, payrollRuns, payrollLineItems } from '@/drizzle/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import type { ParsedPayrollRun, ImportResult, ImportWarning, ValidationError } from './types';

/**
 * Validate that all employees in the import exist in the database
 * Returns validation errors if any employees are missing
 */
export async function validateEmployeesExist(
  parsedRuns: ParsedPayrollRun[],
  tenantId: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  try {
    // Collect all unique employee numbers from all runs
    const allEmployeeNumbers = new Set<string>();
    for (const run of parsedRuns) {
      for (const item of run.lineItems) {
        allEmployeeNumbers.add(item.employeeNumber);
      }
    }

    const employeeNumbersArray = Array.from(allEmployeeNumbers);

    if (employeeNumbersArray.length === 0) {
      return errors;
    }

    // Fetch all active employees with these employee numbers
    const existingEmployees = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        firstName: employees.firstName,
        lastName: employees.lastName,
        status: employees.status,
      })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, tenantId),
          inArray(employees.employeeNumber, employeeNumbersArray)
        )
      );

    // Build map of existing employee numbers (only active ones)
    const existingActiveNumbers = new Set<string>();
    const existingInactiveNumbers = new Set<string>();

    for (const emp of existingEmployees) {
      if (emp.employeeNumber) {
        if (emp.status === 'active') {
          existingActiveNumbers.add(emp.employeeNumber);
        } else {
          existingInactiveNumbers.add(emp.employeeNumber);
        }
      }
    }

    // Find missing employees
    const missingEmployees: string[] = [];
    const inactiveEmployees: string[] = [];

    for (const empNum of employeeNumbersArray) {
      if (!existingActiveNumbers.has(empNum)) {
        if (existingInactiveNumbers.has(empNum)) {
          inactiveEmployees.push(empNum);
        } else {
          missingEmployees.push(empNum);
        }
      }
    }

    // Add error for missing employees
    if (missingEmployees.length > 0) {
      errors.push({
        type: 'missing_employees',
        message: `${missingEmployees.length} employé(s) introuvable(s) dans votre base de données`,
        details: missingEmployees.sort(),
      });
    }

    // Add error for inactive employees
    if (inactiveEmployees.length > 0) {
      errors.push({
        type: 'missing_employees',
        message: `${inactiveEmployees.length} employé(s) inactif(s) - réactivez-les avant d'importer`,
        details: inactiveEmployees.sort(),
      });
    }

    return errors;
  } catch (error) {
    console.error('[PAYROLL-IMPORT] Validation failed:', error);
    errors.push({
      type: 'invalid_data',
      message: 'Erreur lors de la validation des employés',
    });
    return errors;
  }
}

/**
 * Import historical payroll runs and line items
 * Creates payroll runs with status 'approved' and payment_status 'paid'
 */
export async function importHistoricalPayroll(
  parsedRuns: ParsedPayrollRun[],
  tenantId: string,
  userId: string
): Promise<ImportResult> {
  const errors: string[] = [];
  const runIds: string[] = [];
  let totalEmployees = 0;

  try {
    // Import all runs in a transaction (all or nothing)
    await db.transaction(async (tx) => {
      for (const parsedRun of parsedRuns) {
        console.log(`[PAYROLL-IMPORT] Importing run: ${parsedRun.runNumber}`);

        // Step 1: Resolve employee IDs from matricules
        const employeeMap = await resolveEmployeeIds(tx, tenantId, parsedRun.lineItems.map((item) => item.employeeNumber));

        // Validate all employees exist
        const missingEmployees: string[] = [];
        for (const item of parsedRun.lineItems) {
          if (!employeeMap.has(item.employeeNumber)) {
            missingEmployees.push(item.employeeNumber);
          }
        }

        if (missingEmployees.length > 0) {
          throw new Error(`Employés introuvables: ${missingEmployees.join(', ')}`);
        }

        // Step 2: Create payroll run
        const [createdRun] = await tx
          .insert(payrollRuns)
          .values({
            tenantId,
            runNumber: parsedRun.runNumber,
            periodStart: formatDate(parsedRun.periodStart),
            periodEnd: formatDate(parsedRun.periodEnd),
            payDate: formatDate(parsedRun.payDate),
            paymentFrequency: parsedRun.paymentFrequency,
            name: parsedRun.name ?? `Paie ${parsedRun.runNumber}`,
            description: parsedRun.description ?? 'Importation historique',
            countryCode: parsedRun.countryCode,
            closureSequence: parsedRun.closureSequence,
            status: 'approved', // Historical data is already approved
            paymentMethod: 'bank_transfer',
            createdBy: userId,
            updatedBy: userId,
            approvedAt: formatDate(parsedRun.payDate), // Approved on pay date
            approvedBy: userId,
            paidAt: formatDate(parsedRun.payDate), // Already paid
          })
          .returning();

        if (!createdRun) {
          throw new Error(`Échec de création du run: ${parsedRun.runNumber}`);
        }

        console.log(`[PAYROLL-IMPORT] Created run: ${createdRun.id}`);

        // Step 3: Create line items
        let totalGross = 0;
        let totalNet = 0;
        let totalTax = 0;
        let totalEmployeeContributions = 0;
        let totalEmployerContributions = 0;

        for (const item of parsedRun.lineItems) {
          const employeeId = employeeMap.get(item.employeeNumber)!;

          // Convert data to database format
          const allowances = JSON.stringify({
            housing: item.allowances.housing ?? 0,
            transport: item.allowances.transport ?? 0,
            meal: item.allowances.meal ?? 0,
            other: item.allowances.other ?? 0,
          });

          const overtimeHours = JSON.stringify({
            regular25: item.overtimeHours.regular25 ?? 0,
            regular50: item.overtimeHours.regular50 ?? 0,
            night75: item.overtimeHours.night75 ?? 0,
            sunday100: item.overtimeHours.sunday100 ?? 0,
          });

          const taxDeductions = JSON.stringify({
            its: item.its,
          });

          const employeeContributions = JSON.stringify({
            cnps: item.cnpsEmployee,
            cmu: item.cmuEmployee ?? 0,
          });

          const employerContributions = JSON.stringify({
            cnps: item.cnpsEmployer,
            cmu: item.cmuEmployer ?? 0,
          });

          const earningsDetails = JSON.stringify([
            { type: 'base_salary', amount: item.baseSalary, label: 'Salaire de Base' },
            ...(item.allowances.housing ? [{ type: 'housing', amount: item.allowances.housing, label: 'Logement' }] : []),
            ...(item.allowances.transport ? [{ type: 'transport', amount: item.allowances.transport, label: 'Transport' }] : []),
            ...(item.allowances.meal ? [{ type: 'meal', amount: item.allowances.meal, label: 'Repas' }] : []),
            ...(item.overtimePay ? [{ type: 'overtime', amount: item.overtimePay, label: 'Heures Supplémentaires' }] : []),
            ...(item.bonuses ? [{ type: 'bonus', amount: item.bonuses, label: 'Primes' }] : []),
          ]);

          const deductionsDetails = JSON.stringify([
            { type: 'cnps_employee', amount: item.cnpsEmployee, label: 'CNPS Employé' },
            ...(item.cmuEmployee ? [{ type: 'cmu_employee', amount: item.cmuEmployee, label: 'CMU Employé' }] : []),
            { type: 'its', amount: item.its, label: 'ITS' },
            ...Object.entries(item.otherDeductions).map(([key, value]) => ({
              type: key,
              amount: value,
              label: key,
            })),
          ]);

          const contributionDetails = JSON.stringify([
            { type: 'cnps_employer', amount: item.cnpsEmployer, label: 'CNPS Employeur' },
            ...(item.cmuEmployer ? [{ type: 'cmu_employer', amount: item.cmuEmployer, label: 'CMU Employeur' }] : []),
          ]);

          // Insert line item
          await tx.insert(payrollLineItems).values({
            tenantId,
            payrollRunId: createdRun.id,
            employeeId,
            employeeName: item.employeeName,
            employeeNumber: item.employeeNumber,
            positionTitle: item.positionTitle,

            baseSalary: item.baseSalary.toString(),
            allowances,
            daysWorked: item.daysWorked.toString(),
            daysAbsent: item.daysAbsent.toString(),
            hoursWorked: item.hoursWorked?.toString(),
            overtimeHours,
            overtimePay: item.overtimePay?.toString(),
            bonuses: item.bonuses?.toString(),

            grossSalary: item.grossSalary.toString(),
            brutImposable: item.brutImposable?.toString(),
            earningsDetails,

            cnpsEmployee: item.cnpsEmployee.toString(),
            cmuEmployee: item.cmuEmployee?.toString(),
            its: item.its.toString(),
            taxDeductions,
            employeeContributions,
            otherDeductions: JSON.stringify(item.otherDeductions),
            deductionsDetails,
            totalDeductions: item.totalDeductions.toString(),
            netSalary: item.netSalary.toString(),

            cnpsEmployer: item.cnpsEmployer.toString(),
            cmuEmployer: item.cmuEmployer?.toString(),
            employerContributions,
            contributionDetails,
            totalOtherTaxes: item.totalOtherTaxes?.toString() ?? '0',
            otherTaxesDetails: JSON.stringify([]),
            totalEmployerCost: item.totalEmployerCost.toString(),

            paymentMethod: item.paymentMethod,
            bankAccount: item.bankAccount,
            paymentReference: item.paymentReference,
            status: 'approved', // Historical data is approved
            paymentStatus: 'paid', // Already paid
            paidAt: formatDate(parsedRun.payDate),
            notes: item.notes,
          });

          // Accumulate totals
          totalGross += item.grossSalary;
          totalNet += item.netSalary;
          totalTax += item.its;
          totalEmployeeContributions += item.cnpsEmployee + (item.cmuEmployee ?? 0);
          totalEmployerContributions += item.cnpsEmployer + (item.cmuEmployer ?? 0);
          totalEmployees++;
        }

        // Step 4: Update run totals
        await tx
          .update(payrollRuns)
          .set({
            employeeCount: parsedRun.lineItems.length,
            totalGross: totalGross.toString(),
            totalNet: totalNet.toString(),
            totalTax: totalTax.toString(),
            totalEmployeeContributions: totalEmployeeContributions.toString(),
            totalEmployerContributions: totalEmployerContributions.toString(),
          })
          .where(eq(payrollRuns.id, createdRun.id));

        console.log(`[PAYROLL-IMPORT] Completed run: ${createdRun.id} with ${parsedRun.lineItems.length} employees`);

        runIds.push(createdRun.id);
      }
    });

    return {
      success: true,
      runIds,
      employeeCount: totalEmployees,
      message: `Importation réussie: ${parsedRuns.length} runs de paie, ${totalEmployees} employés`,
    };
  } catch (error) {
    console.error('[PAYROLL-IMPORT] Import failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    errors.push(errorMessage);

    return {
      success: false,
      runIds: [],
      employeeCount: 0,
      message: 'Échec de l\'importation',
      errors,
    };
  }
}

/**
 * Resolve employee IDs from employee numbers (matricules)
 */
async function resolveEmployeeIds(
  tx: any,
  tenantId: string,
  employeeNumbers: string[]
): Promise<Map<string, string>> {
  const employeeMap = new Map<string, string>();

  // Fetch all employees in one query
  const employeeRecords = await tx
    .select({
      id: employees.id,
      employeeNumber: employees.employeeNumber,
    })
    .from(employees)
    .where(and(eq(employees.tenantId, tenantId), eq(employees.status, 'active')));

  // Build map: employeeNumber → employeeId
  for (const emp of employeeRecords) {
    if (emp.employeeNumber) {
      employeeMap.set(emp.employeeNumber, emp.id);
    }
  }

  return employeeMap;
}

/**
 * Format date for database (ISO string)
 */
function formatDate(date: Date): string {
  if (!(date instanceof Date)) {
    return new Date().toISOString();
  }
  return date.toISOString();
}
