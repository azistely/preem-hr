/**
 * Employee Protection Service
 *
 * Enforces labor law protections for vulnerable employees:
 * - Minors (<18 years): Cannot work nights (21h-5h)
 * - Pregnant women: Cannot work nights unless medical exemption granted
 *
 * Legal basis:
 * - Code du Travail de Côte d'Ivoire (Articles on night work)
 * - Convention Collective Interprofessionnelle 2021
 */

import { db } from "@/lib/db";
import { employees } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { differenceInYears, isBefore } from "date-fns";

/**
 * Protected employee category
 */
export type ProtectedCategory = 'MINOR' | 'PREGNANT' | 'PREGNANT_WITH_EXEMPTION' | 'NONE';

/**
 * Protection validation result
 */
export interface ProtectionValidationResult {
  allowed: boolean;
  category: ProtectedCategory;
  error?: string;
  warning?: string;
}

/**
 * Calculate if time range includes night hours (21h-5h)
 *
 * @param clockIn - Shift start time
 * @param clockOut - Shift end time
 * @returns True if any part of shift overlaps with night hours
 */
function hasNightHours(clockIn: Date, clockOut: Date): boolean {
  const startHour = clockIn.getHours();
  const endHour = clockOut.getHours();

  // Night is 21:00-05:00 (9pm-5am)
  // Case 1: Shift starts in night period (21:00-23:59)
  if (startHour >= 21) return true;

  // Case 2: Shift ends in night period (00:00-05:00)
  if (endHour < 5) return true;

  // Case 3: Shift spans midnight and includes night hours
  // (e.g., 20:00-06:00 crosses night period)
  if (startHour < endHour) {
    // Normal shift (doesn't cross midnight)
    return false;
  } else {
    // Crosses midnight - definitely includes night hours
    return true;
  }
}

/**
 * Calculate employee age from birth date
 *
 * @param birthDate - Employee's date of birth
 * @returns Age in years
 */
function calculateAge(birthDate: Date): number {
  return differenceInYears(new Date(), birthDate);
}

/**
 * Check if employee is a minor (under 18 years)
 *
 * @param birthDate - Employee's date of birth
 * @returns True if employee is under 18
 */
export function isMinor(birthDate: Date | null | undefined): boolean {
  if (!birthDate) return false;
  return calculateAge(birthDate) < 18;
}

/**
 * Check if medical exemption for night work is valid
 *
 * @param hasExemption - Whether employee has exemption
 * @param expiryDate - Exemption expiry date
 * @returns True if exemption exists and is not expired
 */
export function hasValidMedicalExemption(
  hasExemption: boolean,
  expiryDate: Date | null | undefined
): boolean {
  if (!hasExemption) return false;
  if (!expiryDate) return false;

  // Check if exemption has expired
  return !isBefore(expiryDate, new Date());
}

/**
 * Determine employee's protection category
 *
 * @param employee - Employee data from database
 * @returns Protection category
 */
export function getProtectionCategory(employee: {
  birthDate: Date | null;
  isPregnant: boolean;
  medicalExemptionNightWork: boolean;
  medicalExemptionExpiryDate: Date | null;
}): ProtectedCategory {
  // Check if minor first (highest priority)
  if (employee.birthDate && isMinor(employee.birthDate)) {
    return 'MINOR';
  }

  // Check if pregnant
  if (employee.isPregnant) {
    // Check if has valid medical exemption
    if (
      hasValidMedicalExemption(
        employee.medicalExemptionNightWork,
        employee.medicalExemptionExpiryDate
      )
    ) {
      return 'PREGNANT_WITH_EXEMPTION';
    }
    return 'PREGNANT';
  }

  return 'NONE';
}

/**
 * Validate that protected employees are not working prohibited night hours
 *
 * Throws error if validation fails (prevents time entry creation/approval)
 *
 * @param employeeId - Employee UUID
 * @param clockIn - Shift start time
 * @param clockOut - Shift end time
 * @returns Validation result
 *
 * @throws Error if protected employee cannot work these hours
 *
 * @example
 * ```ts
 * // Before approving time entry
 * await validateProtectedEmployeeRestrictions(
 *   employeeId,
 *   new Date('2025-01-15T22:00:00'),
 *   new Date('2025-01-16T06:00:00')
 * );
 * // Throws if minor or pregnant woman without exemption
 * ```
 */
export async function validateProtectedEmployeeRestrictions(
  employeeId: string,
  clockIn: Date,
  clockOut: Date
): Promise<ProtectionValidationResult> {
  // Fetch employee protection data
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: {
      firstName: true,
      lastName: true,
      birthDate: true,
      isPregnant: true,
      medicalExemptionNightWork: true,
      medicalExemptionExpiryDate: true,
    },
  });

  if (!employee) {
    throw new Error(`Employé introuvable: ${employeeId}`);
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;

  // Check if shift includes night hours
  const isNightShift = hasNightHours(clockIn, clockOut);

  // If not a night shift, no restrictions apply
  if (!isNightShift) {
    return {
      allowed: true,
      category: 'NONE',
    };
  }

  // Determine protection category
  const category = getProtectionCategory({
    birthDate: employee.birthDate,
    isPregnant: employee.isPregnant,
    medicalExemptionNightWork: employee.medicalExemptionNightWork,
    medicalExemptionExpiryDate: employee.medicalExemptionExpiryDate,
  });

  // Handle each protection category
  switch (category) {
    case 'MINOR': {
      const age = employee.birthDate ? calculateAge(employee.birthDate) : 0;
      return {
        allowed: false,
        category: 'MINOR',
        error: `Travail de nuit interdit pour ${fullName} (${age} ans). Les mineurs (<18 ans) ne peuvent pas travailler entre 21h et 5h selon le Code du Travail.`,
      };
    }

    case 'PREGNANT': {
      return {
        allowed: false,
        category: 'PREGNANT',
        error: `Travail de nuit interdit pour ${fullName} (enceinte). Les femmes enceintes ne peuvent pas travailler entre 21h et 5h sans certificat médical d'exemption.`,
      };
    }

    case 'PREGNANT_WITH_EXEMPTION': {
      const expiryDate = employee.medicalExemptionExpiryDate;
      const expiryFormatted = expiryDate
        ? new Intl.DateTimeFormat('fr-FR').format(expiryDate)
        : 'inconnue';

      return {
        allowed: true,
        category: 'PREGNANT_WITH_EXEMPTION',
        warning: `${fullName} est enceinte mais dispose d'un certificat médical autorisant le travail de nuit (valide jusqu'au ${expiryFormatted}).`,
      };
    }

    case 'NONE':
    default:
      return {
        allowed: true,
        category: 'NONE',
      };
  }
}

/**
 * Get all employees requiring protection (for HR dashboard)
 *
 * @param tenantId - Tenant UUID
 * @returns List of protected employees with their categories
 *
 * @example
 * ```ts
 * const protectedEmployees = await getProtectedEmployees(tenantId);
 * // [
 * //   { id: '...', name: 'Marie Kouassi', category: 'PREGNANT', ... },
 * //   { id: '...', name: 'Jean Traoré', category: 'MINOR', ... }
 * // ]
 * ```
 */
export async function getProtectedEmployees(tenantId: string) {
  const allEmployees = await db.query.employees.findMany({
    where: eq(employees.tenantId, tenantId),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      isPregnant: true,
      pregnancyStartDate: true,
      expectedDeliveryDate: true,
      medicalExemptionNightWork: true,
      medicalExemptionExpiryDate: true,
    },
  });

  // Filter to only protected employees and add category
  type Employee = typeof allEmployees[number];

  const mappedEmployees = allEmployees
    .map((emp: Employee) => {
      const category = getProtectionCategory({
        birthDate: emp.birthDate,
        isPregnant: emp.isPregnant,
        medicalExemptionNightWork: emp.medicalExemptionNightWork,
        medicalExemptionExpiryDate: emp.medicalExemptionExpiryDate,
      });

      if (category === 'NONE') return null;

      return {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName: `${emp.firstName} ${emp.lastName}`,
        category,
        birthDate: emp.birthDate,
        age: emp.birthDate ? calculateAge(emp.birthDate) : null,
        isPregnant: emp.isPregnant,
        pregnancyStartDate: emp.pregnancyStartDate,
        expectedDeliveryDate: emp.expectedDeliveryDate,
        medicalExemptionNightWork: emp.medicalExemptionNightWork,
        medicalExemptionExpiryDate: emp.medicalExemptionExpiryDate,
      };
    });

  type MappedEmployee = typeof mappedEmployees[number];

  const protectedEmployees = mappedEmployees
    .filter((emp: MappedEmployee): emp is NonNullable<MappedEmployee> => emp !== null);

  return protectedEmployees;
}
