/**
 * Time Entries Importer
 *
 * Handles importing daily work hours/time tracking records into the time_entries table.
 * Supports both manual time entry and clock in/out tracking.
 *
 * Features:
 * - Validates employee references exist in tenant
 * - Checks for duplicate entries (same employee + date)
 * - Validates work hours within reasonable range (0-24)
 * - Handles different entry types (regular, overtime, night shift, weekend)
 * - Validates date formats
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
import { timeEntries } from '@/lib/db/schema/time-tracking';
import { employees } from '@/lib/db/schema/employees';
import { eq, and } from 'drizzle-orm';

interface TimeEntryImportData {
  // Required fields
  employeeId: string; // UUID or employee number - will be resolved
  workDate: string; // ISO date string (YYYY-MM-DD) from AI cleaning
  hoursWorked: number; // Total hours for the day

  // Optional time details
  clockIn?: string; // ISO datetime string (for clock_in_out entries)
  clockOut?: string; // ISO datetime string
  breakMinutes?: number; // Break time in minutes

  // Optional entry metadata
  entryType?: 'regular' | 'overtime' | 'on_call' | 'night' | 'weekend';
  entrySource?: 'manual' | 'clock_in_out'; // Default: 'manual'
  notes?: string;
  status?: 'pending' | 'approved' | 'rejected';

  // Optional location tracking (for clock_in_out entries)
  locationId?: string; // UUID
  geofenceVerified?: boolean;

  // Optional approval info
  approvedBy?: string; // User ID
  approvedAt?: string; // ISO datetime string
  rejectionReason?: string;
}

export class TimeEntriesImporter implements DataImporter<TimeEntryImportData> {
  /**
   * Validate time entry data before import
   */
  async validate(
    data: TimeEntryImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    // Step 1: Load all employees for reference validation
    const tenantEmployees = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
      .from(employees)
      .where(eq(employees.tenantId, context.tenantId));

    const employeeMap = new Map<string, string>();
    tenantEmployees.forEach((emp) => {
      employeeMap.set(emp.id, emp.id); // UUID -> UUID
      employeeMap.set(emp.employeeNumber, emp.id); // Employee number -> UUID
    });

    // Step 2: Load existing time entries to check for duplicates
    const existingEntries = await db
      .select({
        employeeId: timeEntries.employeeId,
        clockIn: timeEntries.clockIn,
      })
      .from(timeEntries)
      .where(eq(timeEntries.tenantId, context.tenantId));

    // Create set of existing employee+date combinations
    const existingEntriesSet = new Set<string>();
    existingEntries.forEach((entry) => {
      const date = entry.clockIn.toISOString().split('T')[0];
      existingEntriesSet.add(`${entry.employeeId}:${date}`);
    });

    // Step 3: Validate each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Validate required: employeeId
      if (!row.employeeId?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Identifiant employé est requis',
            'MISSING_EMPLOYEE_ID',
            'employeeId'
          )
        );
        continue; // Skip further validation for this row
      }

      // Validate employee exists
      const resolvedEmployeeId = employeeMap.get(row.employeeId.trim());
      if (!resolvedEmployeeId) {
        errors.push(
          createError(
            rowNum,
            `Employé introuvable: ${row.employeeId}`,
            'EMPLOYEE_NOT_FOUND',
            'employeeId',
            row.employeeId
          )
        );
        continue;
      }

      // Validate required: workDate
      if (!row.workDate) {
        errors.push(
          createError(
            rowNum,
            'Date de travail est requise',
            'MISSING_WORK_DATE',
            'workDate'
          )
        );
      } else if (!this.isValidDate(row.workDate)) {
        errors.push(
          createError(
            rowNum,
            `Date de travail invalide: ${row.workDate}`,
            'INVALID_WORK_DATE',
            'workDate',
            row.workDate
          )
        );
      } else {
        // Check for duplicate (same employee + date)
        const entryKey = `${resolvedEmployeeId}:${row.workDate}`;
        if (existingEntriesSet.has(entryKey)) {
          errors.push(
            createError(
              rowNum,
              `Entrée existe déjà pour cet employé à cette date: ${row.workDate}`,
              'DUPLICATE_TIME_ENTRY',
              'workDate',
              row.workDate
            )
          );
        }
      }

      // Validate required: hoursWorked
      if (row.hoursWorked === undefined || row.hoursWorked === null) {
        errors.push(
          createError(
            rowNum,
            'Heures travaillées est requis',
            'MISSING_HOURS_WORKED',
            'hoursWorked'
          )
        );
      } else if (typeof row.hoursWorked !== 'number') {
        errors.push(
          createError(
            rowNum,
            `Heures travaillées doit être un nombre: ${row.hoursWorked}`,
            'INVALID_HOURS_WORKED_TYPE',
            'hoursWorked',
            row.hoursWorked
          )
        );
      } else if (row.hoursWorked < 0) {
        errors.push(
          createError(
            rowNum,
            `Heures travaillées ne peut pas être négatif: ${row.hoursWorked}`,
            'NEGATIVE_HOURS_WORKED',
            'hoursWorked',
            row.hoursWorked
          )
        );
      } else if (row.hoursWorked > 24) {
        errors.push(
          createError(
            rowNum,
            `Heures travaillées ne peut pas dépasser 24 heures par jour: ${row.hoursWorked}`,
            'EXCESSIVE_HOURS_WORKED',
            'hoursWorked',
            row.hoursWorked
          )
        );
      }

      // Validate optional: clockIn/clockOut datetime formats
      if (row.clockIn && !this.isValidDateTime(row.clockIn)) {
        errors.push(
          createError(
            rowNum,
            `Heure d'arrivée invalide: ${row.clockIn}`,
            'INVALID_CLOCK_IN',
            'clockIn',
            row.clockIn
          )
        );
      }

      if (row.clockOut && !this.isValidDateTime(row.clockOut)) {
        errors.push(
          createError(
            rowNum,
            `Heure de départ invalide: ${row.clockOut}`,
            'INVALID_CLOCK_OUT',
            'clockOut',
            row.clockOut
          )
        );
      }

      // Validate clockOut is after clockIn
      if (row.clockIn && row.clockOut) {
        const clockInDate = new Date(row.clockIn);
        const clockOutDate = new Date(row.clockOut);
        if (clockOutDate <= clockInDate) {
          errors.push(
            createError(
              rowNum,
              "Heure de départ doit être après l'heure d'arrivée",
              'CLOCK_OUT_BEFORE_CLOCK_IN',
              'clockOut'
            )
          );
        }
      }

      // Validate optional: breakMinutes
      if (row.breakMinutes !== undefined && row.breakMinutes !== null) {
        if (typeof row.breakMinutes !== 'number') {
          errors.push(
            createError(
              rowNum,
              `Minutes de pause doit être un nombre: ${row.breakMinutes}`,
              'INVALID_BREAK_MINUTES_TYPE',
              'breakMinutes',
              row.breakMinutes
            )
          );
        } else if (row.breakMinutes < 0) {
          errors.push(
            createError(
              rowNum,
              `Minutes de pause ne peut pas être négatif: ${row.breakMinutes}`,
              'NEGATIVE_BREAK_MINUTES',
              'breakMinutes',
              row.breakMinutes
            )
          );
        } else if (row.breakMinutes > row.hoursWorked * 60) {
          errors.push(
            createError(
              rowNum,
              'Minutes de pause ne peut pas dépasser les heures travaillées',
              'EXCESSIVE_BREAK_MINUTES',
              'breakMinutes',
              row.breakMinutes
            )
          );
        }
      }

      // Validate optional: entryType enum
      if (row.entryType) {
        const validEntryTypes = ['regular', 'overtime', 'on_call', 'night', 'weekend'];
        if (!validEntryTypes.includes(row.entryType)) {
          errors.push(
            createError(
              rowNum,
              `Type d'entrée invalide: ${row.entryType}. Doit être: ${validEntryTypes.join(', ')}`,
              'INVALID_ENTRY_TYPE',
              'entryType',
              row.entryType
            )
          );
        }
      }

      // Validate optional: status enum
      if (row.status) {
        const validStatuses = ['pending', 'approved', 'rejected'];
        if (!validStatuses.includes(row.status)) {
          errors.push(
            createError(
              rowNum,
              `Statut invalide: ${row.status}. Doit être: ${validStatuses.join(', ')}`,
              'INVALID_STATUS',
              'status',
              row.status
            )
          );
        }
      }

      // Validate optional: approvedAt datetime
      if (row.approvedAt && !this.isValidDateTime(row.approvedAt)) {
        errors.push(
          createError(
            rowNum,
            `Date d'approbation invalide: ${row.approvedAt}`,
            'INVALID_APPROVED_AT',
            'approvedAt',
            row.approvedAt
          )
        );
      }
    }

    // Step 4: Check for duplicates within the import batch
    const importEntriesMap = new Map<string, number[]>();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row.employeeId || !row.workDate) continue;

      const resolvedEmployeeId = employeeMap.get(row.employeeId.trim());
      if (!resolvedEmployeeId) continue;

      const entryKey = `${resolvedEmployeeId}:${row.workDate}`;
      if (!importEntriesMap.has(entryKey)) {
        importEntriesMap.set(entryKey, []);
      }
      importEntriesMap.get(entryKey)!.push(i + 1);
    }

    // Report duplicates within import
    for (const [entryKey, rowNumbers] of importEntriesMap.entries()) {
      if (rowNumbers.length > 1) {
        errors.push(
          createError(
            rowNumbers[0],
            `Entrée dupliquée dans le fichier pour le même employé et date (lignes ${rowNumbers.join(', ')})`,
            'DUPLICATE_IN_IMPORT',
            'workDate'
          )
        );
      }
    }

    return errors;
  }

  /**
   * Import time entry data into database
   */
  async import(
    data: TimeEntryImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Load employee mapping (again, for transformation)
    const tenantEmployees = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
      })
      .from(employees)
      .where(eq(employees.tenantId, context.tenantId));

    const employeeMap = new Map<string, string>();
    tenantEmployees.forEach((emp) => {
      employeeMap.set(emp.id, emp.id);
      employeeMap.set(emp.employeeNumber, emp.id);
    });

    // Step 3: Transform data to match schema
    const timeEntryRecords = data.map((row) => {
      const resolvedEmployeeId = employeeMap.get(row.employeeId.trim())!;

      // Determine clock in/out times
      let clockIn: Date;
      let clockOut: Date | null = null;

      if (row.clockIn && row.clockOut) {
        // Use provided clock times
        clockIn = new Date(row.clockIn);
        clockOut = new Date(row.clockOut);
      } else {
        // Generate clock times from workDate + hoursWorked
        // Default: 8:00 AM start time
        clockIn = new Date(`${row.workDate}T08:00:00Z`);
        const clockOutTime = new Date(clockIn);
        clockOutTime.setHours(clockOutTime.getHours() + row.hoursWorked);
        clockOut = clockOutTime;
      }

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Required fields
        employeeId: resolvedEmployeeId,
        clockIn,
        clockOut,
        totalHours: String(row.hoursWorked), // numeric stored as string

        // Entry metadata
        entrySource: row.entrySource ?? 'manual',
        entryType: row.entryType ?? 'regular',
        status: row.status ?? 'pending',

        // Optional location
        ...(row.locationId && { locationId: row.locationId }),
        ...(row.geofenceVerified !== undefined && {
          geofenceVerified: row.geofenceVerified,
        }),

        // Optional approval
        ...(row.approvedBy && { approvedBy: row.approvedBy }),
        ...(row.approvedAt && { approvedAt: new Date(row.approvedAt) }),
        ...(row.rejectionReason && { rejectionReason: row.rejectionReason }),

        // Optional notes
        ...(row.notes && { notes: row.notes }),

        // Defaults for fields not in import
        geofenceVerified: row.geofenceVerified ?? false,

        // Audit (context provides user info)
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    // Step 4: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: timeEntryRecords.length,
      });
    }

    // Step 5: Batch insert into database
    try {
      const recordsInserted = await batchInsert(timeEntries, timeEntryRecords, 100);

      return createSuccessResult(recordsInserted, {
        totalTimeEntries: recordsInserted,
        totalHours: timeEntryRecords.reduce(
          (sum, entry) => sum + parseFloat(entry.totalHours),
          0
        ),
        dateRange: {
          earliest: data[0]?.workDate,
          latest: data[data.length - 1]?.workDate,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      return createFailureResult([
        createError(
          0,
          `Erreur lors de l'insertion: ${errorMessage}`,
          'DATABASE_INSERT_ERROR'
        ),
      ]);
    }
  }

  /**
   * Helper: Validate date format (YYYY-MM-DD)
   */
  private isValidDate(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Helper: Validate datetime format (ISO 8601)
   */
  private isValidDateTime(dateTimeString: string): boolean {
    const dateTime = new Date(dateTimeString);
    return !isNaN(dateTime.getTime());
  }
}

// Export singleton instance
export const timeEntriesImporter = new TimeEntriesImporter();
