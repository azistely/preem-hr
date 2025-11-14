/**
 * Time Off Balances Importer
 *
 * Handles importing employee time-off/leave balances into the time_off_balances table.
 * This allows HR to set initial leave balances for employees during onboarding or migration.
 *
 * Features:
 * - Validates employee and policy references
 * - Ensures balance amounts are non-negative
 * - Checks for duplicate entries (same employee + policy + year)
 * - Auto-calculates available balance
 * - Tenant isolation enforced
 * - Batch insertion for performance
 */

import {
  DataImporter,
  ImportContext,
  ImportResult,
  ImportError,
  createSuccessResult,
  createFailureResult,
  createError,
  createWarning,
  batchInsert,
} from './base-importer';
import { db } from '@/lib/db';
import { timeOffBalances } from '@/lib/db/schema/time-tracking';
import { employees } from '@/lib/db/schema/employees';
import { timeOffPolicies } from '@/lib/db/schema/time-tracking';
import { eq, and } from 'drizzle-orm';

interface TimeOffBalanceImportData {
  // Required fields
  employeeId: string; // UUID from employees table
  policyId: string; // UUID from time_off_policies table
  year: number; // Calendar year (e.g., 2025)

  // Balance fields (in days)
  allocated: number; // Total days allocated for the year
  used?: number; // Days already used (default: 0)
  pending?: number; // Days in pending requests (default: 0)
  carriedOver?: number; // Days carried over from previous year (default: 0)

  // Optional identifier fields (for easier imports - will be resolved to UUIDs)
  employeeNumber?: string; // Alternative to employeeId
  policyName?: string; // Alternative to policyId (e.g., "Congés annuels")
}

export class TimeOffBalancesImporter implements DataImporter<TimeOffBalanceImportData> {
  /**
   * Validate time-off balance data before import
   */
  async validate(
    data: TimeOffBalanceImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    // Pre-fetch all employees and policies for validation
    const allEmployees = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
      })
      .from(employees)
      .where(eq(employees.tenantId, context.tenantId));

    const allPolicies = await db
      .select({
        id: timeOffPolicies.id,
        name: timeOffPolicies.name,
      })
      .from(timeOffPolicies)
      .where(eq(timeOffPolicies.tenantId, context.tenantId));

    const employeeMap = new Map(allEmployees.map((e) => [e.id, e]));
    const employeeNumberMap = new Map(allEmployees.map((e) => [e.employeeNumber, e.id]));
    const policyMap = new Map(allPolicies.map((p) => [p.id, p]));
    const policyNameMap = new Map(allPolicies.map((p) => [p.name.toLowerCase(), p.id]));

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Validate employee reference
      let employeeId = row.employeeId;

      // Try to resolve employee from employeeNumber if provided
      if (!employeeId && row.employeeNumber) {
        const resolvedId = employeeNumberMap.get(row.employeeNumber);
        if (resolvedId) {
          employeeId = resolvedId;
          // Update the row for later use
          row.employeeId = resolvedId;
        }
      }

      if (!employeeId) {
        errors.push(
          createError(
            rowNum,
            "Identifiant employé (employeeId ou employeeNumber) est requis",
            'MISSING_EMPLOYEE_ID',
            'employeeId'
          )
        );
      } else if (!employeeMap.has(employeeId)) {
        errors.push(
          createError(
            rowNum,
            `Employé introuvable: ${employeeId}`,
            'EMPLOYEE_NOT_FOUND',
            'employeeId',
            employeeId
          )
        );
      }

      // Validate policy reference
      let policyId = row.policyId;

      // Try to resolve policy from policyName if provided
      if (!policyId && row.policyName) {
        const resolvedId = policyNameMap.get(row.policyName.toLowerCase());
        if (resolvedId) {
          policyId = resolvedId;
          // Update the row for later use
          row.policyId = resolvedId;
        }
      }

      if (!policyId) {
        errors.push(
          createError(
            rowNum,
            "Identifiant politique de congés (policyId ou policyName) est requis",
            'MISSING_POLICY_ID',
            'policyId'
          )
        );
      } else if (!policyMap.has(policyId)) {
        errors.push(
          createError(
            rowNum,
            `Politique de congés introuvable: ${policyId}`,
            'POLICY_NOT_FOUND',
            'policyId',
            policyId
          )
        );
      }

      // Validate year
      if (!row.year) {
        errors.push(
          createError(rowNum, 'Année est requise', 'MISSING_YEAR', 'year')
        );
      } else if (!Number.isInteger(row.year)) {
        errors.push(
          createError(
            rowNum,
            `Année doit être un nombre entier: ${row.year}`,
            'INVALID_YEAR',
            'year',
            row.year
          )
        );
      } else if (row.year < 2000 || row.year > 2100) {
        errors.push(
          createError(
            rowNum,
            `Année hors limites raisonnables (2000-2100): ${row.year}`,
            'YEAR_OUT_OF_RANGE',
            'year',
            row.year
          )
        );
      }

      // Validate allocated (required)
      if (row.allocated === undefined || row.allocated === null) {
        errors.push(
          createError(
            rowNum,
            'Jours alloués (allocated) est requis',
            'MISSING_ALLOCATED',
            'allocated'
          )
        );
      } else if (typeof row.allocated !== 'number' || row.allocated < 0) {
        errors.push(
          createError(
            rowNum,
            `Jours alloués doit être un nombre positif ou zéro: ${row.allocated}`,
            'INVALID_ALLOCATED',
            'allocated',
            row.allocated
          )
        );
      } else if (row.allocated > 100) {
        errors.push(
          createError(
            rowNum,
            `Jours alloués semble trop élevé (max recommandé: 100 jours): ${row.allocated}`,
            'ALLOCATED_TOO_HIGH',
            'allocated',
            row.allocated
          )
        );
      }

      // Validate used (optional, defaults to 0)
      if (row.used !== undefined && row.used !== null) {
        if (typeof row.used !== 'number' || row.used < 0) {
          errors.push(
            createError(
              rowNum,
              `Jours utilisés doit être un nombre positif ou zéro: ${row.used}`,
              'INVALID_USED',
              'used',
              row.used
            )
          );
        }
      }

      // Validate pending (optional, defaults to 0)
      if (row.pending !== undefined && row.pending !== null) {
        if (typeof row.pending !== 'number' || row.pending < 0) {
          errors.push(
            createError(
              rowNum,
              `Jours en attente doit être un nombre positif ou zéro: ${row.pending}`,
              'INVALID_PENDING',
              'pending',
              row.pending
            )
          );
        }
      }

      // Validate carriedOver (optional, defaults to 0)
      if (row.carriedOver !== undefined && row.carriedOver !== null) {
        if (typeof row.carriedOver !== 'number' || row.carriedOver < 0) {
          errors.push(
            createError(
              rowNum,
              `Jours reportés doit être un nombre positif ou zéro: ${row.carriedOver}`,
              'INVALID_CARRIED_OVER',
              'carriedOver',
              row.carriedOver
            )
          );
        }
      }

      // Logical validation: used + pending should not exceed allocated + carriedOver
      if (
        row.allocated !== undefined &&
        row.used !== undefined &&
        row.pending !== undefined &&
        row.carriedOver !== undefined
      ) {
        const totalAvailable = row.allocated + (row.carriedOver ?? 0);
        const totalConsumed = (row.used ?? 0) + (row.pending ?? 0);

        if (totalConsumed > totalAvailable) {
          errors.push(
            createError(
              rowNum,
              `Jours utilisés + en attente (${totalConsumed}) dépasse les jours disponibles (${totalAvailable})`,
              'BALANCE_EXCEEDS_AVAILABLE',
              'used'
            )
          );
        }
      }
    }

    // Check for duplicate entries (same employee + policy + year) within import
    const balanceKeys = data
      .map((row, idx) => ({
        key: `${row.employeeId}_${row.policyId}_${row.year}`,
        row: idx + 1,
      }))
      .filter((item) => item.key !== 'undefined_undefined_undefined');

    const keyMap = new Map<string, number[]>();
    for (const item of balanceKeys) {
      if (!keyMap.has(item.key)) {
        keyMap.set(item.key, []);
      }
      keyMap.get(item.key)!.push(item.row);
    }

    for (const [key, rows] of keyMap.entries()) {
      if (rows.length > 1) {
        errors.push(
          createError(
            rows[0],
            `Solde de congés dupliqué dans le fichier (employé + politique + année): lignes ${rows.join(', ')}`,
            'DUPLICATE_BALANCE',
            'employeeId'
          )
        );
      }
    }

    // Check for existing balances in database
    if (!context.dryRun && data.length > 0) {
      const existingBalances = await db
        .select({
          employeeId: timeOffBalances.employeeId,
          policyId: timeOffBalances.policyId,
          year: timeOffBalances.year,
        })
        .from(timeOffBalances)
        .where(eq(timeOffBalances.tenantId, context.tenantId));

      const existingKeys = new Set(
        existingBalances.map(
          (b) => `${b.employeeId}_${b.policyId}_${b.year}`
        )
      );

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 1;
        const key = `${row.employeeId}_${row.policyId}_${row.year}`;

        if (existingKeys.has(key)) {
          errors.push(
            createError(
              rowNum,
              `Solde de congés existe déjà pour cet employé, politique et année`,
              'BALANCE_EXISTS',
              'employeeId'
            )
          );
        }
      }
    }

    return errors;
  }

  /**
   * Import time-off balance data into database
   */
  async import(
    data: TimeOffBalanceImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Transform data to match schema
    const balanceRecords = data.map((row) => {
      const allocated = Number(row.allocated);
      const used = Number(row.used ?? 0);
      const pending = Number(row.pending ?? 0);
      const carriedOver = Number(row.carriedOver ?? 0);

      // Calculate available: allocated + carriedOver - used - pending
      const available = allocated + carriedOver - used - pending;

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Required fields
        employeeId: row.employeeId,
        policyId: row.policyId,
        year: row.year,

        // Balance amounts (convert to string for numeric type)
        allocated: String(allocated),
        used: String(used),
        pending: String(pending),
        carriedOver: String(carriedOver),
        available: String(available),
      };
    });

    // Step 3: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: balanceRecords.length,
      });
    }

    // Step 4: Batch insert into database
    try {
      const recordsInserted = await batchInsert(timeOffBalances, balanceRecords, 100);

      return createSuccessResult(recordsInserted, {
        totalBalances: recordsInserted,
        years: [...new Set(data.map((d) => d.year))],
        employees: [...new Set(data.map((d) => d.employeeId))],
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      return createFailureResult([
        createError(
          0,
          `Erreur lors de l'insertion: ${errorMessage}`,
          'DATABASE_INSERT_ERROR'
        ),
      ]);
    }
  }
}

// Export singleton instance
export const timeOffBalancesImporter = new TimeOffBalancesImporter();
