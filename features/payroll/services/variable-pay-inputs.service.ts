/**
 * Variable Pay Inputs Service
 *
 * Manages monthly variable component values (commissions, production bonuses, etc.)
 * that change period-to-period for employees.
 *
 * Architecture:
 * - Fixed components → stored in employee_salaries.components
 * - Variable components → stored in variable_pay_inputs table
 * - Payroll calculation → merges both sources
 */

import { db } from '@/lib/db';
import { variablePayInputs } from '@/lib/db/schema/variable-pay-inputs';
import { employees } from '@/lib/db/schema/employees';
import { employeeSalaries } from '@/lib/db/schema/salaries';
import { salaryComponentDefinitions } from '@/lib/db/schema/payroll-config';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';

/**
 * Input for bulk upsert operation
 */
export interface VariablePayBulkInput {
  employeeId: string;
  componentCode: string;
  amount: number;
  entryDate: string; // YYYY-MM-DD format
  notes?: string;
}

/**
 * Variable pay input with employee details
 */
export interface VariablePayInputWithEmployee {
  id: string;
  employeeId: string;
  componentCode: string;
  entryDate: string; // YYYY-MM-DD
  amount: string;
  notes: string | null;
  employeeName: string;
  employeeNumber: string;
}

/**
 * Get all variable pay inputs for a specific period
 *
 * @param tenantId - Tenant ID
 * @param period - Period in YYYY-MM-01 format
 * @returns Variable pay inputs with employee details
 */
export async function getVariablePayInputsForPeriod(
  tenantId: string,
  period: string // YYYY-MM-01
): Promise<VariablePayInputWithEmployee[]> {
  const results = await db
    .select({
      id: variablePayInputs.id,
      employeeId: variablePayInputs.employeeId,
      componentCode: variablePayInputs.componentCode,
      entryDate: variablePayInputs.entryDate,
      amount: variablePayInputs.amount,
      notes: variablePayInputs.notes,
      // Join employee data
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      employeeNumber: employees.employeeNumber,
    })
    .from(variablePayInputs)
    .leftJoin(employees, eq(variablePayInputs.employeeId, employees.id))
    .where(
      and(
        eq(variablePayInputs.tenantId, tenantId),
        eq(variablePayInputs.period, period)
      )
    )
    .orderBy(employees.employeeNumber, variablePayInputs.entryDate)
    .execute();

  return results as VariablePayInputWithEmployee[];
}

/**
 * Bulk upsert variable pay inputs for a period
 *
 * Uses ON CONFLICT to update existing records or insert new ones.
 * Now supports entry_date for daily tracking.
 *
 * @param tenantId - Tenant ID
 * @param period - Period in YYYY-MM-01 format
 * @param inputs - Array of variable pay inputs (with entryDate)
 * @param userId - User ID for audit
 * @returns Created/updated variable pay inputs
 */
export async function bulkUpsertVariablePayInputs(
  tenantId: string,
  period: string,
  inputs: VariablePayBulkInput[],
  userId: string
) {
  const results: typeof variablePayInputs.$inferSelect[] = [];

  // Use transaction for atomicity
  await db.transaction(async (tx) => {
    for (const input of inputs) {
      const result = await tx
        .insert(variablePayInputs)
        .values({
          tenantId,
          employeeId: input.employeeId,
          componentCode: input.componentCode,
          period,
          entryDate: input.entryDate, // NEW: specific date for this entry
          amount: input.amount.toString(),
          notes: input.notes,
          createdBy: userId,
        })
        .onConflictDoUpdate({
          target: [
            variablePayInputs.tenantId,
            variablePayInputs.employeeId,
            variablePayInputs.componentCode,
            variablePayInputs.entryDate, // Changed from period to entryDate
          ],
          set: {
            amount: input.amount.toString(),
            notes: input.notes,
            updatedAt: sql`NOW()`,
          },
        })
        .returning();

      if (result[0]) {
        results.push(result[0]);
      }
    }
  });

  return results;
}

/**
 * Copy variable pay inputs from one period to another
 *
 * Useful for recurring monthly bonuses/commissions.
 * Adjusts entry_date to match the new period.
 *
 * @param tenantId - Tenant ID
 * @param fromPeriod - Source period (YYYY-MM-01)
 * @param toPeriod - Target period (YYYY-MM-01)
 * @param userId - User ID for audit
 * @returns Created variable pay inputs
 */
export async function copyVariablePayFromPreviousPeriod(
  tenantId: string,
  fromPeriod: string,
  toPeriod: string,
  userId: string
) {
  // Fetch inputs from previous period
  const previousInputs = await db
    .select()
    .from(variablePayInputs)
    .where(
      and(
        eq(variablePayInputs.tenantId, tenantId),
        eq(variablePayInputs.period, fromPeriod)
      )
    )
    .execute();

  if (previousInputs.length === 0) {
    return [];
  }

  // Calculate day offset between periods
  const fromDate = new Date(fromPeriod);
  const toDate = new Date(toPeriod);
  const dayOffset = Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));

  // Create new inputs for target period with adjusted entry dates
  const newInputs = previousInputs.map(input => {
    const originalEntryDate = new Date(input.entryDate);
    const newEntryDate = new Date(originalEntryDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);

    return {
      tenantId,
      employeeId: input.employeeId,
      componentCode: input.componentCode,
      period: toPeriod,
      entryDate: newEntryDate.toISOString().split('T')[0], // YYYY-MM-DD
      amount: input.amount,
      notes: `Copié de ${fromPeriod}`,
      createdBy: userId,
    };
  });

  return db
    .insert(variablePayInputs)
    .values(newInputs)
    .onConflictDoNothing() // Skip if already exists
    .returning()
    .execute();
}

/**
 * Get variable pay inputs for a specific employee and period
 *
 * Used by payroll calculation to merge with fixed components.
 * SUMS all entries per component (supports multiple daily entries).
 *
 * @param tenantId - Tenant ID
 * @param employeeId - Employee ID
 * @param period - Period in YYYY-MM-01 format
 * @returns Aggregated variable pay inputs (one row per component with summed amount)
 */
export async function getVariablePayInputsForEmployee(
  tenantId: string,
  employeeId: string,
  period: string
) {
  // SUM all entries per component for this period
  const results = await db
    .select({
      componentCode: variablePayInputs.componentCode,
      amount: sql<string>`SUM(${variablePayInputs.amount})`.as('total_amount'),
    })
    .from(variablePayInputs)
    .where(
      and(
        eq(variablePayInputs.tenantId, tenantId),
        eq(variablePayInputs.employeeId, employeeId),
        eq(variablePayInputs.period, period)
      )
    )
    .groupBy(variablePayInputs.componentCode)
    .execute();

  return results;
}

/**
 * Get variable pay inputs for a specific date range
 *
 * Used by multi-frequency payroll (daily, weekly, bi-weekly) to prevent
 * duplicating variables across multiple runs in the same period.
 *
 * Entry date determines which run gets the variable:
 * - Weekly run Oct 1-7 → Only includes variables with entry_date Oct 1-7
 * - Weekly run Oct 8-14 → Only includes variables with entry_date Oct 8-14
 *
 * @param tenantId - Tenant ID
 * @param employeeId - Employee ID
 * @param startDate - Start date of payroll run (inclusive) - YYYY-MM-DD
 * @param endDate - End date of payroll run (inclusive) - YYYY-MM-DD
 * @returns Aggregated variable pay inputs (one row per component with summed amount)
 */
export async function getVariablePayInputsForDateRange(
  tenantId: string,
  employeeId: string,
  startDate: Date | string,
  endDate: Date | string
) {
  // Convert Date objects to strings if needed
  const startDateStr = startDate instanceof Date
    ? startDate.toISOString().split('T')[0]
    : startDate;
  const endDateStr = endDate instanceof Date
    ? endDate.toISOString().split('T')[0]
    : endDate;

  // SUM all entries per component where entry_date is in range
  const results = await db
    .select({
      componentCode: variablePayInputs.componentCode,
      amount: sql<string>`SUM(${variablePayInputs.amount})`.as('total_amount'),
    })
    .from(variablePayInputs)
    .where(
      and(
        eq(variablePayInputs.tenantId, tenantId),
        eq(variablePayInputs.employeeId, employeeId),
        gte(variablePayInputs.entryDate, startDateStr),
        lte(variablePayInputs.entryDate, endDateStr)
      )
    )
    .groupBy(variablePayInputs.componentCode)
    .execute();

  return results;
}

/**
 * Delete variable pay input by ID
 *
 * @param tenantId - Tenant ID (for security)
 * @param inputId - Variable pay input ID
 */
export async function deleteVariablePayInput(
  tenantId: string,
  inputId: string
) {
  return db
    .delete(variablePayInputs)
    .where(
      and(
        eq(variablePayInputs.tenantId, tenantId),
        eq(variablePayInputs.id, inputId)
      )
    )
    .execute();
}

/**
 * Delete all variable pay inputs for a period
 *
 * Use with caution - typically for cleaning up test data.
 *
 * @param tenantId - Tenant ID
 * @param period - Period in YYYY-MM-01 format
 */
export async function deleteVariablePayInputsForPeriod(
  tenantId: string,
  period: string
) {
  return db
    .delete(variablePayInputs)
    .where(
      and(
        eq(variablePayInputs.tenantId, tenantId),
        eq(variablePayInputs.period, period)
      )
    )
    .execute();
}

/**
 * Employee variable component (from salary package)
 */
export interface EmployeeVariableComponent {
  code: string;
  name: string;
  currentAmount: number; // from variable_pay_inputs if exists
}

/**
 * Employee with variable inputs for a period
 */
export interface EmployeeWithVariableInputs {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  inputs: {
    id: string;
    componentCode: string;
    entryDate: string; // YYYY-MM-DD
    amount: number;
    notes: string | null;
  }[];
}

/**
 * Get employee's variable components (from their salary package)
 * with current amounts for the period (if any)
 *
 * @param tenantId - Tenant ID
 * @param employeeId - Employee ID
 * @param period - Period in YYYY-MM-01 format
 * @returns Variable components assigned to employee
 */
export async function getEmployeeVariableComponents(
  tenantId: string,
  employeeId: string,
  period: string
): Promise<EmployeeVariableComponent[]> {
  // Get employee's current salary with components
  const salaries = await db
    .select()
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.tenantId, tenantId),
        eq(employeeSalaries.employeeId, employeeId),
        sql`${employeeSalaries.effectiveTo} IS NULL OR ${employeeSalaries.effectiveTo} >= CURRENT_DATE`
      )
    )
    .orderBy(desc(employeeSalaries.effectiveFrom))
    .limit(1);

  if (salaries.length === 0) {
    return [];
  }

  const components = salaries[0].components as Array<{
    code: string;
    name: string;
    amount: number;
    metadata?: any;
  }>;

  if (!components || components.length === 0) {
    return [];
  }

  // Get variable component definitions to identify which are variable
  const variableDefinitions = await db
    .select()
    .from(salaryComponentDefinitions)
    .where(eq(salaryComponentDefinitions.componentType, 'variable'));

  const variableCodes = new Set(variableDefinitions.map((d) => d.code));

  // Filter to only variable components
  const variableComponents = components.filter((c) => variableCodes.has(c.code));

  // Get current amounts from variable_pay_inputs
  const currentInputs = await db
    .select()
    .from(variablePayInputs)
    .where(
      and(
        eq(variablePayInputs.tenantId, tenantId),
        eq(variablePayInputs.employeeId, employeeId),
        eq(variablePayInputs.period, period)
      )
    );

  // Map to response format
  return variableComponents.map((component) => {
    const input = currentInputs.find((i) => i.componentCode === component.code);
    return {
      code: component.code,
      name: component.name,
      currentAmount: input ? Number(input.amount) : 0,
    };
  });
}

/**
 * Get all active employees with their variable pay inputs for a period
 *
 * Returns all employees regardless of whether they have inputs or not.
 * This is useful for UI where we want to show all employees and allow
 * adding new variable inputs.
 *
 * @param tenantId - Tenant ID
 * @param period - Period in YYYY-MM-01 format
 * @returns All active employees with their variable inputs (if any)
 */
export async function getAllEmployeesWithVariableInputs(
  tenantId: string,
  period: string
): Promise<EmployeeWithVariableInputs[]> {
  // Get all active employees
  const activeEmployees = await db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      employeeNumber: employees.employeeNumber,
    })
    .from(employees)
    .where(
      and(
        eq(employees.tenantId, tenantId),
        eq(employees.status, 'active')
      )
    )
    .orderBy(employees.employeeNumber)
    .execute();

  // Get existing variable pay inputs for this period
  const existingInputs = await db
    .select()
    .from(variablePayInputs)
    .where(
      and(
        eq(variablePayInputs.tenantId, tenantId),
        eq(variablePayInputs.period, period)
      )
    )
    .execute();

  // Map employees to include their variable inputs (with entryDate)
  return activeEmployees.map(employee => {
    const inputs = existingInputs.filter(i => i.employeeId === employee.id);
    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeNumber: employee.employeeNumber,
      inputs: inputs.map(i => ({
        id: i.id,
        componentCode: i.componentCode,
        entryDate: i.entryDate, // Include entry date
        amount: Number(i.amount),
        notes: i.notes,
      })),
    };
  });
}

/**
 * Component from catalogue
 */
export interface CatalogueComponent {
  code: string;
  name: string;
  category: string;
  componentType: string;
  calculationMethod: string | null;
  currentAmount: number; // from variable_pay_inputs if exists for this employee
}

/**
 * Get ALL salary components from the catalogue for tenant's country
 *
 * Returns all components regardless of type (fixed, variable, etc.)
 * with current amounts from variable_pay_inputs if they exist.
 *
 * @param tenantId - Tenant ID
 * @param employeeId - Employee ID (to fetch current amounts)
 * @param period - Period in YYYY-MM-01 format
 * @returns All catalogue components with current amounts
 */
export async function getAllCatalogueComponents(
  tenantId: string,
  employeeId: string,
  period: string
): Promise<CatalogueComponent[]> {
  // Get tenant to determine country
  const { tenants } = await import('@/drizzle/schema');
  const tenantResult = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (tenantResult.length === 0) {
    return [];
  }

  const countryCode = tenantResult[0].countryCode || 'CI';

  // Get components where manual input makes sense (fixed/variable only)
  // NOT percentage or formula (those are auto-calculated)
  const catalogueComponents = await db
    .select()
    .from(salaryComponentDefinitions)
    .where(
      and(
        eq(salaryComponentDefinitions.countryCode, countryCode),
        // Only show components that can be manually entered
        sql`(${salaryComponentDefinitions.calculationMethod} IN ('fixed', 'variable') OR ${salaryComponentDefinitions.calculationMethod} IS NULL)`
      )
    )
    .orderBy(salaryComponentDefinitions.category, salaryComponentDefinitions.name);

  // Get current amounts from variable_pay_inputs for this employee
  const currentInputs = await db
    .select()
    .from(variablePayInputs)
    .where(
      and(
        eq(variablePayInputs.tenantId, tenantId),
        eq(variablePayInputs.employeeId, employeeId),
        eq(variablePayInputs.period, period)
      )
    );

  // Map to response format with current amounts
  return catalogueComponents.map((component) => {
    const input = currentInputs.find((i) => i.componentCode === component.code);

    // Extract French name from JSONB field
    const nameObj = component.name as { fr?: string } | null;
    const componentName = nameObj?.fr || component.code;

    return {
      code: component.code,
      name: componentName,
      category: component.category || 'Autre',
      componentType: component.componentType || 'fixed',
      calculationMethod: component.calculationMethod,
      currentAmount: input ? Number(input.amount) : 0,
    };
  });
}
