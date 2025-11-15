/**
 * Load Existing Employees - Critical LLM Resource
 *
 * This tool loads existing employees from the database to provide
 * COMPREHENSIVE CONTEXT to the AI for:
 * - Duplicate detection
 * - Employee matching
 * - Entity linking
 *
 * WHY THIS IS CRITICAL:
 * "Un LLM depend enormement de la qualité de son input"
 *
 * By providing complete employee context, the AI can make intelligent decisions about:
 * - "Jean Kouassi" vs "KOUASSI Jean" → Same person
 * - "EMP001" found in Excel → Matches database employee #1234
 * - Payslip for "Marie Traoré" → Links to existing employee
 *
 * @see docs/AI-IMPORT-DUPLICATE-DETECTION.md
 * @see docs/AI-IMPORT-EMPLOYEE-LINKING.md
 */

import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema/employees';
import { eq } from 'drizzle-orm';
import type { ImportContext } from '../types';

/**
 * Load all existing employees for a tenant
 *
 * This is the CRITICAL RESOURCE that enables intelligent AI decisions.
 *
 * What we load:
 * - Identity fields: employeeNumber, firstName, lastName, email, CNPS
 * - Matching fields: phoneNumber (for fuzzy matching)
 * - Context fields: position, department, hireDate (for validation)
 * - Status: active/inactive (to warn if reactivating inactive employee)
 *
 * @param tenantId - The tenant to load employees for
 * @returns Array of existing employees with all fields needed for AI matching
 */
export async function loadExistingEmployees(params: {
  tenantId: string;
}): Promise<NonNullable<ImportContext['existingEmployees']>> {
  const { tenantId } = params;

  // Load ALL employees for this tenant
  // We don't filter by status because:
  // - Inactive employees can be reactivated
  // - AI needs to warn: "Jean Kouassi existe déjà (inactif depuis 2023)"
  const existingEmployees = await db.query.employees.findMany({
    where: eq(employees.tenantId, tenantId),
    columns: {
      // Identity fields (PRIMARY matching)
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      cnpsNumber: true,

      // Secondary matching fields
      phoneNumber: true,

      // Context fields (for AI validation)
      hireDate: true,
      position: true,
      department: true,

      // Status (to warn if inactive)
      status: true,
    },
  });

  return existingEmployees;
}

/**
 * Format existing employees for AI context
 *
 * This creates a RICH, HUMAN-READABLE summary for AI prompts.
 *
 * Example output:
 * ```
 * Employés existants dans la base de données (50):
 *
 * 1. EMP001 - Jean KOUASSI
 *    Email: jean.kouassi@company.ci
 *    CNPS: 1234567890
 *    Position: Développeur Senior
 *    Statut: Actif
 *
 * 2. EMP002 - Marie TRAORÉ
 *    Email: marie.traore@company.ci
 *    CNPS: 0987654321
 *    Position: Chef Comptable
 *    Statut: Actif
 *
 * ...
 * ```
 *
 * This gives the AI MAXIMUM CONTEXT to make intelligent decisions.
 */
export function formatExistingEmployeesForAI(
  employees: NonNullable<ImportContext['existingEmployees']>,
  options?: {
    /** Include only first N employees (for very large datasets) */
    maxEmployees?: number;
    /** Include detailed context fields */
    includeDetails?: boolean;
  }
): string {
  const maxEmployees = options?.maxEmployees ?? 100; // Limit to prevent token overflow
  const includeDetails = options?.includeDetails ?? true;

  const employeesToShow = employees.slice(0, maxEmployees);
  const hasMore = employees.length > maxEmployees;

  let summary = `Employés existants dans la base de données (${employees.length}):\n\n`;

  employeesToShow.forEach((emp, idx) => {
    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();

    summary += `${idx + 1}. ${emp.employeeNumber || 'N/A'} - ${fullName}\n`;

    if (includeDetails) {
      if (emp.email) {
        summary += `   Email: ${emp.email}\n`;
      }
      if (emp.cnpsNumber) {
        summary += `   CNPS: ${emp.cnpsNumber}\n`;
      }
      if (emp.position) {
        summary += `   Position: ${emp.position}\n`;
      }
      if (emp.department) {
        summary += `   Département: ${emp.department}\n`;
      }
      if (emp.hireDate) {
        summary += `   Date d'embauche: ${emp.hireDate.toISOString().split('T')[0]}\n`;
      }
      summary += `   Statut: ${emp.status === 'active' ? 'Actif' : 'Inactif'}\n`;
    }

    summary += '\n';
  });

  if (hasMore) {
    summary += `... et ${employees.length - maxEmployees} employé(s) supplémentaire(s)\n\n`;
    summary += `Pour les autres employés, vous pouvez les chercher par:\n`;
    summary += `- Numéro d'employé (employeeNumber)\n`;
    summary += `- Email\n`;
    summary += `- Numéro CNPS\n`;
    summary += `- Nom complet (firstName + lastName)\n\n`;
  }

  // Add summary statistics for AI context
  const activeCount = employees.filter((e) => e.status === 'active').length;
  const inactiveCount = employees.length - activeCount;

  summary += `Statistiques:\n`;
  summary += `- Total: ${employees.length} employés\n`;
  summary += `- Actifs: ${activeCount}\n`;
  summary += `- Inactifs: ${inactiveCount}\n\n`;

  // Count employees with key identifiers
  const withEmail = employees.filter((e) => e.email).length;
  const withCNPS = employees.filter((e) => e.cnpsNumber).length;
  const withEmployeeNumber = employees.filter((e) => e.employeeNumber).length;

  summary += `Identifiants disponibles:\n`;
  summary += `- Avec numéro d'employé: ${withEmployeeNumber} (${Math.round((withEmployeeNumber / employees.length) * 100)}%)\n`;
  summary += `- Avec email: ${withEmail} (${Math.round((withEmail / employees.length) * 100)}%)\n`;
  summary += `- Avec CNPS: ${withCNPS} (${Math.round((withCNPS / employees.length) * 100)}%)\n`;

  return summary;
}

/**
 * Create a searchable index of existing employees
 *
 * This enables FAST lookups during matching (O(1) instead of O(n))
 *
 * Indexes by:
 * - employeeNumber
 * - email (lowercase)
 * - cnpsNumber
 * - phoneNumber
 *
 * This is used by matching algorithms to quickly find employees.
 */
export function indexExistingEmployees(
  employees: NonNullable<ImportContext['existingEmployees']>
): Map<string, NonNullable<ImportContext['existingEmployees']>[0]> {
  const index = new Map<string, NonNullable<ImportContext['existingEmployees']>[0]>();

  for (const emp of employees) {
    // Index by employee number
    if (emp.employeeNumber) {
      index.set(`num:${emp.employeeNumber}`, emp);
    }

    // Index by email (case-insensitive)
    if (emp.email) {
      index.set(`email:${emp.email.toLowerCase()}`, emp);
    }

    // Index by CNPS number
    if (emp.cnpsNumber) {
      index.set(`cnps:${emp.cnpsNumber}`, emp);
    }

    // Index by phone number (normalized)
    if (emp.phoneNumber) {
      const normalized = emp.phoneNumber.replace(/[\s\-\(\)]/g, '');
      index.set(`phone:${normalized}`, emp);
    }
  }

  return index;
}
