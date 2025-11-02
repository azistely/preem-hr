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
import { ensureComponentsActivated } from '@/lib/salary-components/component-activation';
import { getBaseSalaryComponents } from '@/lib/salary-components/base-salary-loader';

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
    sourceType: 'standard' | 'custom' | 'template' | 'import';
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

  // Verify employee exists first (need rateType for validation)
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

  // Extract base salary from components (use database-driven approach)
  const { calculateBaseSalaryTotal } = await import('@/lib/salary-components/base-salary-loader');
  const baseSalary = await calculateBaseSalaryTotal(input.components, countryCode);

  // Get employee's active contract to check contract type
  const { employmentContracts } = await import('@/drizzle/schema');
  const [activeContract] = await db
    .select({ contractType: employmentContracts.contractType })
    .from(employmentContracts)
    .where(
      and(
        eq(employmentContracts.employeeId, input.employeeId),
        eq(employmentContracts.tenantId, input.tenantId),
        eq(employmentContracts.isActive, true)
      )
    )
    .limit(1);

  // Validate against country SMIG (rate-type aware)
  // CDDTI workers are always hourly, regardless of rateType field
  let rateType = (employee.rateType || 'MONTHLY') as string;
  if (activeContract?.contractType === 'CDDTI') {
    rateType = 'HOURLY';
  }

  // Get country-specific monthly minimum wage
  const monthlyMinimumWage = await getMinimumWage(countryCode);

  // Calculate minimum wage based on rate type
  let minimumWageForRateType: number;
  let minimumWageLabel: string;

  if (rateType === 'DAILY') {
    // Daily SMIG = Monthly SMIG / 30 days
    minimumWageForRateType = Math.round(monthlyMinimumWage / 30);
    minimumWageLabel = `${minimumWageForRateType} FCFA/jour`;
  } else if (rateType === 'HOURLY') {
    // Hourly SMIG = Monthly SMIG / 30 days / 8 hours
    minimumWageForRateType = Math.round(monthlyMinimumWage / 30 / 8);
    minimumWageLabel = `${minimumWageForRateType} FCFA/heure`;
  } else {
    // Monthly SMIG (default for 'MONTHLY' or null)
    minimumWageForRateType = monthlyMinimumWage;
    minimumWageLabel = `${minimumWageForRateType} FCFA/mois`;
  }

  if (baseSalary < minimumWageForRateType) {
    const [country] = await db
      .select({ name: countries.name })
      .from(countries)
      .where(eq(countries.code, countryCode))
      .limit(1);

    const countryName = (country?.name as any)?.fr || countryCode;

    throw new ValidationError(
      `Le salaire doit être >= SMIG du ${countryName} (${minimumWageLabel})`,
      { baseSalary, minimumWage: minimumWageForRateType, countryCode, rateType }
    );
  }

  // ========================================
  // PRE-TRANSACTION: Get base components (should NOT be in transaction)
  // ========================================
  // CRITICAL: getBaseSalaryComponents() hits the database and should NOT be called inside transaction
  // This prevents deadlocks and ensures we don't hold locks while loading metadata
  console.log('[changeSalary] Loading base components for country:', countryCode);
  const baseComponents = await getBaseSalaryComponents(countryCode);
  const baseCodes = new Set(baseComponents.map(c => c.code));
  console.log('[changeSalary] Base component codes:', Array.from(baseCodes));

  // Filter components before entering transaction
  const nonBaseComponents = input.components.filter(comp => !baseCodes.has(comp.code));
  console.log('[changeSalary] Non-base components to activate:', nonBaseComponents.length);

  return await db.transaction(async (tx) => {
    console.log('[changeSalary] Transaction started');

    // ========================================
    // AUTO-ACTIVATE COMPONENTS AT TENANT LEVEL
    // ========================================
    if (nonBaseComponents.length > 0) {
      console.log('[changeSalary] Activating components...');
      const activationInputs = nonBaseComponents.map(comp => ({
        code: comp.code,
        sourceType: comp.sourceType === 'custom' ? 'template' : comp.sourceType,
        tenantId: input.tenantId,
        countryCode: countryCode,
        userId: input.createdBy,
      }));

      await ensureComponentsActivated(activationInputs, tx);
      console.log('[changeSalary] Components activated');
    }

    // Get current salary record
    console.log('[changeSalary] Querying current salary...');
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
    console.log('[changeSalary] Current salary found:', !!currentSalary);

    if (currentSalary) {
      // Close current salary record
      console.log('[changeSalary] Closing current salary record...');
      const effectiveToDate = input.effectiveFrom.toISOString().split('T')[0];
      await tx
        .update(employeeSalaries)
        .set({
          effectiveTo: effectiveToDate as any,
        })
        .where(eq(employeeSalaries.id, currentSalary.id));
      console.log('[changeSalary] Current salary closed');
    }

    // Create new salary record
    console.log('[changeSalary] Creating new salary record...');
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
    console.log('[changeSalary] New salary created:', newSalary?.id);

    // Create audit log entry
    console.log('[changeSalary] Creating audit log...');
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
    console.log('[changeSalary] Audit log created');

    console.log('[changeSalary] Transaction completed successfully');
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
