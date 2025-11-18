/**
 * Time Entry Approval Validation Service
 *
 * Provides comprehensive validation and warnings for HR before approving time entries.
 * Aggregates all compliance checks:
 * - Daily overtime limits (3h/day)
 * - Weekly overtime limits (15h/week)
 * - Yearly overtime limits (75h/year with 80% warning)
 * - Employee protection restrictions (minors, pregnant women)
 *
 * Used by approval UI to show warnings/errors and employee status.
 */

import { db } from "@/lib/db";
import { timeEntries, employees } from "@/drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import {
  validateProtectedEmployeeRestrictions,
  getProtectionCategory,
  type ProtectedCategory
} from "./employee-protection.service";

/**
 * Validation message types
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation message
 */
export interface ValidationMessage {
  severity: ValidationSeverity;
  type: 'DAILY_OT_LIMIT' | 'WEEKLY_OT_LIMIT' | 'YEARLY_OT_LIMIT' | 'EMPLOYEE_PROTECTION' | 'GENERAL';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Overtime usage statistics
 */
export interface OvertimeUsage {
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  dailyPercentage: number;

  weeklyUsed: number;
  weeklyLimit: number;
  weeklyRemaining: number;
  weeklyPercentage: number;

  yearlyUsed: number;
  yearlyLimit: number;
  yearlyRemaining: number;
  yearlyPercentage: number;
}

/**
 * Employee protection status
 */
export interface EmployeeProtectionStatus {
  category: ProtectedCategory;
  age?: number;
  isPregnant: boolean;
  hasMedicalExemption: boolean;
  medicalExemptionExpiry?: Date | null;
  restrictions: string[];
}

/**
 * Complete approval validation result
 */
export interface ApprovalValidationResult {
  canApprove: boolean;
  messages: ValidationMessage[];
  overtimeUsage: OvertimeUsage;
  protectionStatus: EmployeeProtectionStatus;
  summary: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}

/**
 * Get overtime hours used in a date range
 */
async function getOvertimeHoursInRange(
  employeeId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const result = await db
    .select({
      total: sql<number>`
        COALESCE(SUM(
          COALESCE((overtime_breakdown->>'hours_41_to_46')::numeric, 0) +
          COALESCE((overtime_breakdown->>'hours_above_46')::numeric, 0)
        ), 0)
      `,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.employeeId, employeeId),
        eq(timeEntries.status, 'approved'),
        gte(timeEntries.clockIn, startDate.toISOString()),
        lte(timeEntries.clockIn, endDate.toISOString())
      )
    );

  return result[0]?.total || 0;
}

/**
 * Calculate overtime hours from a time entry's overtime breakdown
 */
function calculateOvertimeHours(entry: {
  overtimeBreakdown?: Record<string, unknown> | null;
}): number {
  if (!entry.overtimeBreakdown) return 0;

  const breakdown = entry.overtimeBreakdown as {
    hours_41_to_46?: number;
    hours_above_46?: number;
  };

  return (breakdown.hours_41_to_46 || 0) + (breakdown.hours_above_46 || 0);
}

/**
 * Validate time entry approval with comprehensive checks
 *
 * @param entryId - Time entry UUID
 * @param countryCode - Country code for limit configuration (default: 'CI')
 * @returns Complete validation result with warnings, errors, and employee status
 *
 * @example
 * ```ts
 * const validation = await validateTimeEntryApproval(entryId, 'CI');
 *
 * if (!validation.canApprove) {
 *   // Show errors to HR
 *   validation.messages
 *     .filter(m => m.severity === 'error')
 *     .forEach(m => console.error(m.message));
 * }
 *
 * if (validation.summary.warningCount > 0) {
 *   // Show warnings to HR
 *   validation.messages
 *     .filter(m => m.severity === 'warning')
 *     .forEach(m => console.warn(m.message));
 * }
 *
 * // Display employee status
 * console.log(`Heures sup. utilisées: ${validation.overtimeUsage.yearlyUsed}/${validation.overtimeUsage.yearlyLimit}`);
 * ```
 */
export async function validateTimeEntryApproval(
  entryId: string,
  countryCode: string = 'CI'
): Promise<ApprovalValidationResult> {
  const messages: ValidationMessage[] = [];

  // Fetch time entry
  const entry = await db.query.timeEntries.findFirst({
    where: eq(timeEntries.id, entryId),
  });

  if (!entry) {
    throw new Error(`Pointage introuvable: ${entryId}`);
  }

  if (!entry.clockOut) {
    throw new Error(`Impossible de valider un pointage non terminé`);
  }

  // Fetch employee data separately
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, entry.employeeId),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      isPregnant: true,
      medicalExemptionNightWork: true,
      medicalExemptionExpiryDate: true,
    },
  });

  if (!employee) {
    throw new Error(`Employé introuvable: ${entry.employeeId}`);
  }

  const clockIn = new Date(entry.clockIn);
  const clockOut = new Date(entry.clockOut);
  const overtimeHours = calculateOvertimeHours({
    overtimeBreakdown: entry.overtimeBreakdown as Record<string, unknown> | null,
  });
  const employeeFullName = `${employee.firstName} ${employee.lastName}`;

  // Country-specific limits (Côte d'Ivoire)
  const limits = countryCode === 'CI' ? {
    dailyLimit: 3,
    weeklyLimit: 15,
    yearlyLimit: 75,
    yearlyWarningThreshold: 0.8, // 80%
  } : {
    // Default for other countries
    dailyLimit: 3,
    weeklyLimit: 15,
    yearlyLimit: 75,
    yearlyWarningThreshold: 0.8,
  };

  // 1. Check Daily Overtime Limit
  const dayStart = startOfDay(clockIn);
  const dayEnd = endOfDay(clockIn);
  const dailyOvertimeUsed = await getOvertimeHoursInRange(
    entry.employeeId,
    dayStart,
    dayEnd
  );
  const dailyTotal = dailyOvertimeUsed + overtimeHours;
  const dailyRemaining = Math.max(0, limits.dailyLimit - dailyOvertimeUsed);
  const dailyPercentage = (dailyOvertimeUsed / limits.dailyLimit) * 100;

  if (dailyTotal > limits.dailyLimit) {
    messages.push({
      severity: 'error',
      type: 'DAILY_OT_LIMIT',
      message: `Limite journalière dépassée: ${dailyTotal.toFixed(1)}h sur ${limits.dailyLimit}h autorisées (Article 23 Convention Collective). ${employeeFullName} a déjà effectué ${dailyOvertimeUsed.toFixed(1)}h d'heures supplémentaires aujourd'hui.`,
      details: { dailyUsed: dailyOvertimeUsed, dailyLimit: limits.dailyLimit, dailyTotal },
    });
  } else if (dailyPercentage >= 80) {
    messages.push({
      severity: 'warning',
      type: 'DAILY_OT_LIMIT',
      message: `Proche de la limite journalière: ${dailyOvertimeUsed.toFixed(1)}h / ${limits.dailyLimit}h (${dailyPercentage.toFixed(0)}%). Il reste ${dailyRemaining.toFixed(1)}h disponibles pour aujourd'hui.`,
      details: { dailyUsed: dailyOvertimeUsed, dailyLimit: limits.dailyLimit, dailyRemaining },
    });
  }

  // 2. Check Weekly Overtime Limit
  const weekStart = startOfWeek(clockIn, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(clockIn, { weekStartsOn: 1 });
  const weeklyOvertimeUsed = await getOvertimeHoursInRange(
    entry.employeeId,
    weekStart,
    weekEnd
  );
  const weeklyTotal = weeklyOvertimeUsed + overtimeHours;
  const weeklyRemaining = Math.max(0, limits.weeklyLimit - weeklyOvertimeUsed);
  const weeklyPercentage = (weeklyOvertimeUsed / limits.weeklyLimit) * 100;

  if (weeklyTotal > limits.weeklyLimit) {
    messages.push({
      severity: 'error',
      type: 'WEEKLY_OT_LIMIT',
      message: `Limite hebdomadaire dépassée: ${weeklyTotal.toFixed(1)}h sur ${limits.weeklyLimit}h autorisées (Article 23). ${employeeFullName} a déjà effectué ${weeklyOvertimeUsed.toFixed(1)}h cette semaine.`,
      details: { weeklyUsed: weeklyOvertimeUsed, weeklyLimit: limits.weeklyLimit, weeklyTotal },
    });
  } else if (weeklyPercentage >= 80) {
    messages.push({
      severity: 'warning',
      type: 'WEEKLY_OT_LIMIT',
      message: `Proche de la limite hebdomadaire: ${weeklyOvertimeUsed.toFixed(1)}h / ${limits.weeklyLimit}h (${weeklyPercentage.toFixed(0)}%). Il reste ${weeklyRemaining.toFixed(1)}h disponibles cette semaine.`,
      details: { weeklyUsed: weeklyOvertimeUsed, weeklyLimit: limits.weeklyLimit, weeklyRemaining },
    });
  }

  // 3. Check Yearly Overtime Limit
  const yearStart = startOfYear(clockIn);
  const yearEnd = endOfYear(clockIn);
  const yearlyOvertimeUsed = await getOvertimeHoursInRange(
    entry.employeeId,
    yearStart,
    yearEnd
  );
  const yearlyTotal = yearlyOvertimeUsed + overtimeHours;
  const yearlyRemaining = Math.max(0, limits.yearlyLimit - yearlyOvertimeUsed);
  const yearlyPercentage = (yearlyOvertimeUsed / limits.yearlyLimit) * 100;

  if (yearlyTotal > limits.yearlyLimit) {
    messages.push({
      severity: 'error',
      type: 'YEARLY_OT_LIMIT',
      message: `Limite annuelle dépassée: ${yearlyTotal.toFixed(1)}h sur ${limits.yearlyLimit}h autorisées (Article 23). ${employeeFullName} a déjà effectué ${yearlyOvertimeUsed.toFixed(1)}h cette année.`,
      details: { yearlyUsed: yearlyOvertimeUsed, yearlyLimit: limits.yearlyLimit, yearlyTotal },
    });
  } else if (yearlyPercentage >= (limits.yearlyWarningThreshold * 100)) {
    messages.push({
      severity: 'warning',
      type: 'YEARLY_OT_LIMIT',
      message: `Proche de la limite annuelle: ${yearlyOvertimeUsed.toFixed(1)}h / ${limits.yearlyLimit}h (${yearlyPercentage.toFixed(0)}%). Il reste ${yearlyRemaining.toFixed(1)}h disponibles pour ${clockIn.getFullYear()}.`,
      details: { yearlyUsed: yearlyOvertimeUsed, yearlyLimit: limits.yearlyLimit, yearlyRemaining },
    });
  }

  // 4. Check Employee Protection Restrictions
  const protectionValidation = await validateProtectedEmployeeRestrictions(
    entry.employeeId,
    clockIn,
    clockOut
  );

  const protectionCategory = getProtectionCategory({
    birthDate: employee.birthDate,
    isPregnant: employee.isPregnant,
    medicalExemptionNightWork: employee.medicalExemptionNightWork,
    medicalExemptionExpiryDate: employee.medicalExemptionExpiryDate,
  });

  if (!protectionValidation.allowed) {
    messages.push({
      severity: 'error',
      type: 'EMPLOYEE_PROTECTION',
      message: protectionValidation.error!,
      details: { category: protectionValidation.category },
    });
  } else if (protectionValidation.warning) {
    messages.push({
      severity: 'warning',
      type: 'EMPLOYEE_PROTECTION',
      message: protectionValidation.warning,
      details: { category: protectionValidation.category },
    });
  }

  // Build protection status
  const age = employee.birthDate
    ? Math.floor((Date.now() - employee.birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : undefined;

  const restrictions: string[] = [];
  if (protectionCategory === 'MINOR') {
    restrictions.push('Travail de nuit interdit (21h-5h)');
    restrictions.push('Travaux dangereux interdits');
  }
  if (protectionCategory === 'PREGNANT') {
    restrictions.push('Travail de nuit interdit sans certificat médical');
    restrictions.push('Congé de maternité: 14 semaines');
  }
  if (protectionCategory === 'PREGNANT_WITH_EXEMPTION') {
    restrictions.push('Travail de nuit autorisé par certificat médical');
    restrictions.push('Congé de maternité: 14 semaines');
  }

  const protectionStatus: EmployeeProtectionStatus = {
    category: protectionCategory,
    age,
    isPregnant: employee.isPregnant,
    hasMedicalExemption: employee.medicalExemptionNightWork,
    medicalExemptionExpiry: employee.medicalExemptionExpiryDate,
    restrictions,
  };

  // Calculate summary
  const summary = {
    errorCount: messages.filter(m => m.severity === 'error').length,
    warningCount: messages.filter(m => m.severity === 'warning').length,
    infoCount: messages.filter(m => m.severity === 'info').length,
  };

  const canApprove = summary.errorCount === 0;

  return {
    canApprove,
    messages,
    overtimeUsage: {
      dailyUsed: dailyOvertimeUsed,
      dailyLimit: limits.dailyLimit,
      dailyRemaining,
      dailyPercentage,

      weeklyUsed: weeklyOvertimeUsed,
      weeklyLimit: limits.weeklyLimit,
      weeklyRemaining,
      weeklyPercentage,

      yearlyUsed: yearlyOvertimeUsed,
      yearlyLimit: limits.yearlyLimit,
      yearlyRemaining,
      yearlyPercentage,
    },
    protectionStatus,
    summary,
  };
}

/**
 * Get employees approaching overtime limits
 *
 * Useful for HR dashboard to monitor compliance
 *
 * @param tenantId - Tenant UUID
 * @param warningThreshold - Percentage threshold for warnings (default: 80%)
 * @returns List of employees with high overtime usage
 *
 * @example
 * ```ts
 * const atRiskEmployees = await getEmployeesApproachingLimits(tenantId, 0.8);
 * // Returns employees who have used ≥80% of their yearly OT limit
 * ```
 */
export async function getEmployeesApproachingLimits(
  tenantId: string,
  warningThreshold: number = 0.8,
  countryCode: string = 'CI'
) {
  const limits = countryCode === 'CI' ? {
    yearlyLimit: 75,
  } : {
    yearlyLimit: 75,
  };

  const yearStart = startOfYear(new Date());
  const yearEnd = endOfYear(new Date());

  // Get all employees in tenant
  const allEmployees = await db.query.employees.findMany({
    where: eq(employees.tenantId, tenantId),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      isPregnant: true,
    },
  });

  // Calculate overtime usage for each employee
  const employeesWithUsage = await Promise.all(
    allEmployees.map(async (employee) => {
      const yearlyUsed = await getOvertimeHoursInRange(
        employee.id,
        yearStart,
        yearEnd
      );

      const yearlyPercentage = (yearlyUsed / limits.yearlyLimit) * 100;

      return {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.firstName} ${employee.lastName}`,
        yearlyUsed,
        yearlyLimit: limits.yearlyLimit,
        yearlyRemaining: limits.yearlyLimit - yearlyUsed,
        yearlyPercentage,
        isAtRisk: yearlyPercentage >= (warningThreshold * 100),
        birthDate: employee.birthDate,
        isPregnant: employee.isPregnant,
      };
    })
  );

  type EmployeeWithUsage = Awaited<typeof employeesWithUsage[number]>;

  // Filter to only at-risk employees and sort by percentage descending
  return employeesWithUsage
    .filter((emp): emp is EmployeeWithUsage => emp.isAtRisk)
    .sort((a, b) => b.yearlyPercentage - a.yearlyPercentage);
}
