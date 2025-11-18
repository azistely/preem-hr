/**
 * Net Salary Calculator for Salary Advances
 *
 * Purpose: Calculate employee's current net salary using the payroll engine
 * Integration: Uses calculatePayrollV2 to get accurate net salary for advance validation
 *
 * Note: This replaces the approximation `baseSalary * 0.85` with actual payroll calculation
 */

import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema/employees';
import { employeeSalaries } from '@/lib/db/schema/salaries';
import { tenants } from '@/lib/db/schema/tenants';
import { and, eq, desc } from 'drizzle-orm';
import { calculatePayrollV2 } from '@/features/payroll/services/payroll-calculation-v2';
import type { PayrollCalculationInputV2 } from '@/features/payroll/services/payroll-calculation-v2';

/**
 * Calculate employee's current net salary
 *
 * @param employeeId - Employee ID
 * @param tenantId - Tenant ID
 * @returns Net salary amount in FCFA
 */
export async function calculateEmployeeNetSalary(
  employeeId: string,
  tenantId: string
): Promise<number> {
  // 1. Get employee data
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
    .limit(1);

  if (!employee) {
    throw new Error('Employee not found');
  }

  // 2. Get tenant for country code
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant || !tenant.countryCode) {
    throw new Error('Tenant country code not configured');
  }

  // 3. Get employee's current salary
  const [salary] = await db
    .select()
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.employeeId, employeeId),
        eq(employeeSalaries.tenantId, tenantId)
      )
    )
    .orderBy(desc(employeeSalaries.effectiveFrom))
    .limit(1);

  if (!salary || !salary.baseSalary) {
    throw new Error('Employee salary not found');
  }

  // 4. Build payroll calculation input
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const payrollInput: PayrollCalculationInputV2 = {
    employeeId,
    tenantId,
    countryCode: tenant.countryCode,
    periodStart,
    periodEnd,
    baseSalary: Number(salary.baseSalary),
    // Family situation (for tax calculation) - optional fields
    maritalStatus: (employee.maritalStatus as
      | 'single'
      | 'married'
      | 'divorced'
      | 'widowed'
      | undefined),
    // Work info - use MONTHLY as default
    rateType: 'MONTHLY',
  };

  // 5. Calculate payroll
  const result = await calculatePayrollV2(payrollInput);

  // 6. Return net salary
  return result.netSalary;
}

/**
 * Calculate employee's net salary with fallback to approximation
 *
 * Tries to use payroll engine, falls back to approximation if needed
 *
 * @param employeeId - Employee ID
 * @param tenantId - Tenant ID
 * @returns Net salary amount in FCFA
 */
export async function calculateEmployeeNetSalaryWithFallback(
  employeeId: string,
  tenantId: string
): Promise<number> {
  try {
    return await calculateEmployeeNetSalary(employeeId, tenantId);
  } catch (error) {
    console.warn(
      `[SALARY ADVANCE] Failed to calculate net salary for employee ${employeeId}, using approximation:`,
      error
    );

    // Fallback: Use approximation
    const [salary] = await db
      .select()
      .from(employeeSalaries)
      .where(
        and(
          eq(employeeSalaries.employeeId, employeeId),
          eq(employeeSalaries.tenantId, tenantId)
        )
      )
      .orderBy(desc(employeeSalaries.effectiveFrom))
      .limit(1);

    if (!salary || !salary.baseSalary) {
      return 0;
    }

    // Approximate: 85% of base salary
    return Number(salary.baseSalary) * 0.85;
  }
}
