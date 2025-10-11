/**
 * Salary Service
 *
 * Manages employee salaries with effective dating (no history loss).
 * All salary changes create new records with effective_from/effective_to dates.
 */

import { db } from '@/lib/db';
import { employeeSalaries, employees, countries, tenants, auditLogs } from '@/drizzle/schema';
import { eq, and, or, isNull, lte, gt, desc } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '@/lib/errors';

// Country configuration cache
const countryConfigCache = new Map<string, { minimumWage: number }>();

/**
 * Get minimum wage for a country
 */
export async function getMinimumWage(countryCode: string): Promise<number> {
  // Check cache
  if (countryConfigCache.has(countryCode)) {
    return countryConfigCache.get(countryCode)!.minimumWage;
  }

  // Query database
  const [country] = await db
    .select({ minimumWage: countries.minimumWage })
    .from(countries)
    .where(eq(countries.code, countryCode))
    .limit(1);

  if (!country || !country.minimumWage) {
    throw new ValidationError(
      `Configuration pays introuvable pour ${countryCode}`,
      { countryCode }
    );
  }

  const minimumWage = parseFloat(country.minimumWage);

  // Cache it
  countryConfigCache.set(countryCode, { minimumWage });

  return minimumWage;
}

/**
 * Get country code from tenant
 */
export async function getTenantCountryCode(tenantId: string): Promise<string> {
  const [tenant] = await db
    .select({ countryCode: tenants.countryCode })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return tenant?.countryCode || 'CI';
}

export interface ChangeSalaryInput {
  employeeId: string;
  tenantId: string;
  components: Array<{
    code: string;
    name: string;
    amount: number;
    metadata?: any;
    sourceType: 'standard' | 'custom' | 'template';
    sourceId?: string;
  }>;
  effectiveFrom: Date;
  changeReason: string;
  notes?: string;
  createdBy: string;
}

/**
 * Change employee salary (effective-dated)
 *
 * Creates a new salary record and closes the previous one.
 * Preserves complete salary history.
 */
export async function changeSalary(input: ChangeSalaryInput) {
  // Get tenant's country code
  const countryCode = await getTenantCountryCode(input.tenantId);

  // Get country-specific minimum wage
  const minimumWage = await getMinimumWage(countryCode);

  // Extract base salary from components
  const baseComponent = input.components.find(c =>
    c.code === '01' || c.name.toLowerCase().includes('base') || c.name.toLowerCase().includes('salaire de base')
  );
  const baseSalary = baseComponent?.amount || 0;

  // Validate against country SMIG
  if (baseSalary < minimumWage) {
    const [country] = await db
      .select({ name: countries.name })
      .from(countries)
      .where(eq(countries.code, countryCode))
      .limit(1);

    const countryName = (country?.name as any)?.fr || countryCode;

    throw new ValidationError(
      `Le salaire doit être >= SMIG du ${countryName} (${minimumWage} FCFA)`,
      { baseSalary, minimumWage, countryCode }
    );
  }

  // Verify employee exists
  const [employee] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, input.employeeId),
        eq(employees.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!employee) {
    throw new NotFoundError('Employé', input.employeeId);
  }

  return await db.transaction(async (tx) => {
    // Get current salary record
    const [currentSalary] = await tx
      .select()
      .from(employeeSalaries)
      .where(
        and(
          eq(employeeSalaries.employeeId, input.employeeId),
          isNull(employeeSalaries.effectiveTo)
        )
      )
      .limit(1);

    if (currentSalary) {
      // Close current salary record
      // Convert Date to string format that matches PostgreSQL date type
      const effectiveToDate = input.effectiveFrom.toISOString().split('T')[0];
      await tx
        .update(employeeSalaries)
        .set({
          effectiveTo: effectiveToDate as any,
        })
        .where(eq(employeeSalaries.id, currentSalary.id));
    }

    // Create new salary record
    const valuesToInsert = {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      baseSalary: baseSalary.toString(),
      currency: 'XOF',
      components: input.components, // New components architecture
      allowances: {}, // Legacy field (kept empty for backward compatibility)
      effectiveFrom: input.effectiveFrom.toISOString().split('T')[0],
      effectiveTo: null,
      changeReason: input.changeReason,
      notes: input.notes,
      createdBy: input.createdBy,
    } as any;

    const [newSalary] = await tx
      .insert(employeeSalaries)
      .values(valuesToInsert)
      .returning();

    // Create audit log entry
    await tx.insert(auditLogs).values({
      tenantId: input.tenantId,
      userId: input.createdBy,
      userEmail: 'system', // TODO: Get from user context
      action: 'update',
      entityType: 'employee_salary',
      entityId: input.employeeId,
      oldValues: currentSalary ? {
        baseSalary: currentSalary.baseSalary,
        components: currentSalary.components,
      } : null,
      newValues: {
        baseSalary: newSalary.baseSalary,
        components: newSalary.components,
        effectiveFrom: newSalary.effectiveFrom,
        reason: input.changeReason,
      },
    });

    return newSalary!;
  });
}

/**
 * Get current salary for an employee (as of a specific date)
 *
 * @param employeeId - Employee UUID
 * @param asOfDate - Date to query (defaults to today)
 * @returns Current salary record
 */
export async function getCurrentSalary(
  employeeId: string,
  asOfDate?: Date
) {
  const queryDate = asOfDate || new Date();
  const dateStr = queryDate.toISOString().split('T')[0];

  const [salary] = await db
    .select()
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.employeeId, employeeId),
        lte(employeeSalaries.effectiveFrom, dateStr),
        or(
          isNull(employeeSalaries.effectiveTo),
          gt(employeeSalaries.effectiveTo, dateStr)
        )
      )
    )
    .orderBy(desc(employeeSalaries.effectiveFrom))
    .limit(1);

  if (!salary) {
    throw new NotFoundError('Salaire', employeeId);
  }

  return salary;
}

/**
 * Get complete salary history for an employee
 *
 * @param employeeId - Employee UUID
 * @returns All salary records ordered by effective date (desc)
 */
export async function getSalaryHistory(employeeId: string) {
  return await db
    .select()
    .from(employeeSalaries)
    .where(eq(employeeSalaries.employeeId, employeeId))
    .orderBy(desc(employeeSalaries.effectiveFrom));
}

/**
 * Get total gross salary (base + allowances)
 *
 * @param salaryRecord - Salary record
 * @returns Total gross amount
 */
export function calculateGrossSalary(salaryRecord: typeof employeeSalaries.$inferSelect): number {
  // New components architecture (preferred)
  const componentsData = salaryRecord.components as any;
  if (Array.isArray(componentsData) && componentsData.length > 0) {
    return componentsData.reduce((sum: number, component: any) => {
      return sum + (component.amount || 0);
    }, 0);
  }

  // Fallback to old allowances architecture for backward compatibility
  const base = parseFloat(salaryRecord.baseSalary);
  const allowancesData = salaryRecord.allowances as any || {};
  const housing = allowancesData.housing || 0;
  const transport = allowancesData.transport || 0;
  const meal = allowancesData.meal || 0;

  let otherTotal = 0;
  if (Array.isArray(allowancesData.other)) {
    otherTotal = allowancesData.other.reduce(
      (sum: number, allowance: any) => sum + (allowance.amount || 0),
      0
    );
  }

  return base + housing + transport + meal + otherTotal;
}
