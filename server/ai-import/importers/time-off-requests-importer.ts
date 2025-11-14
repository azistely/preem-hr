/**
 * Time Off Requests Importer
 *
 * Handles importing time-off/leave request records into the time_off_requests table.
 * Validates leave requests, checks for overlaps, and ensures data integrity.
 *
 * Features:
 * - Validates employee and policy references
 * - Checks date formats and date range validity
 * - Validates days requested is positive
 * - Checks for overlapping leave requests per employee
 * - Tenant isolation enforced
 * - Batch insertion for performance
 * - Supports approval workflow statuses
 * - Handles ACP (paid leave allowance) tracking
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
import { timeOffRequests } from '@/lib/db/schema/time-tracking';
import { employees } from '@/lib/db/schema/employees';
import { timeOffPolicies } from '@/lib/db/schema/time-tracking';
import { eq, and, or, between, sql } from 'drizzle-orm';

interface TimeOffRequestImportData {
  // Required fields
  employeeId: string; // UUID or employee number (we'll resolve)
  leaveType: string; // Policy name or policy ID
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string; // ISO date string (YYYY-MM-DD)
  daysRequested: number; // Total days (can be decimal for half days)

  // Optional fields
  reason?: string;
  notes?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  submittedAt?: string; // ISO timestamp
  reviewNotes?: string;
  isDeductibleForAcp?: boolean;
  acpAmount?: number;
}

export class TimeOffRequestsImporter implements DataImporter<TimeOffRequestImportData> {
  /**
   * Validate time-off request data before import
   */
  async validate(
    data: TimeOffRequestImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    // Step 1: Load reference data for validation
    const [employeeRecords, policyRecords] = await Promise.all([
      db
        .select({
          id: employees.id,
          employeeNumber: employees.employeeNumber,
        })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, context.tenantId),
            eq(employees.status, 'active')
          )
        ),
      db
        .select({
          id: timeOffPolicies.id,
          name: timeOffPolicies.name,
          policyType: timeOffPolicies.policyType,
        })
        .from(timeOffPolicies)
        .where(eq(timeOffPolicies.tenantId, context.tenantId)),
    ]);

    // Create lookup maps
    const employeeByNumber = new Map(
      employeeRecords.map((e) => [e.employeeNumber, e.id])
    );
    const employeeById = new Map(employeeRecords.map((e) => [e.id, e.id]));
    const policyByName = new Map(policyRecords.map((p) => [p.name.toLowerCase(), p.id]));
    const policyByType = new Map(
      policyRecords.map((p) => [p.policyType.toLowerCase(), p.id])
    );
    const policyById = new Map(policyRecords.map((p) => [p.id, p.id]));

    // Step 2: Validate each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.employeeId?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Identifiant employé est requis',
            'MISSING_EMPLOYEE_ID',
            'employeeId'
          )
        );
      }

      if (!row.leaveType?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Type de congé est requis',
            'MISSING_LEAVE_TYPE',
            'leaveType'
          )
        );
      }

      if (!row.startDate) {
        errors.push(
          createError(
            rowNum,
            'Date de début est requise',
            'MISSING_START_DATE',
            'startDate'
          )
        );
      } else if (!this.isValidDate(row.startDate)) {
        errors.push(
          createError(
            rowNum,
            `Date de début invalide: ${row.startDate}`,
            'INVALID_START_DATE',
            'startDate',
            row.startDate
          )
        );
      }

      if (!row.endDate) {
        errors.push(
          createError(rowNum, 'Date de fin est requise', 'MISSING_END_DATE', 'endDate')
        );
      } else if (!this.isValidDate(row.endDate)) {
        errors.push(
          createError(
            rowNum,
            `Date de fin invalide: ${row.endDate}`,
            'INVALID_END_DATE',
            'endDate',
            row.endDate
          )
        );
      }

      if (row.daysRequested === undefined || row.daysRequested === null) {
        errors.push(
          createError(
            rowNum,
            'Nombre de jours est requis',
            'MISSING_DAYS_REQUESTED',
            'daysRequested'
          )
        );
      } else if (row.daysRequested <= 0) {
        errors.push(
          createError(
            rowNum,
            `Nombre de jours doit être positif: ${row.daysRequested}`,
            'INVALID_DAYS_REQUESTED',
            'daysRequested',
            row.daysRequested
          )
        );
      }

      // Validate date range
      if (row.startDate && row.endDate && this.isValidDate(row.startDate) && this.isValidDate(row.endDate)) {
        const startDate = new Date(row.startDate);
        const endDate = new Date(row.endDate);

        if (endDate < startDate) {
          errors.push(
            createError(
              rowNum,
              `Date de fin (${row.endDate}) doit être postérieure ou égale à la date de début (${row.startDate})`,
              'INVALID_DATE_RANGE',
              'endDate'
            )
          );
        }
      }

      // Validate employee reference
      if (row.employeeId?.trim()) {
        const empId = row.employeeId.trim();
        const isUuid = this.isValidUuid(empId);
        const employeeExists = isUuid
          ? employeeById.has(empId)
          : employeeByNumber.has(empId);

        if (!employeeExists) {
          errors.push(
            createError(
              rowNum,
              `Employé introuvable: ${empId}`,
              'EMPLOYEE_NOT_FOUND',
              'employeeId',
              empId
            )
          );
        }
      }

      // Validate policy reference
      if (row.leaveType?.trim()) {
        const leaveType = row.leaveType.trim();
        const isUuid = this.isValidUuid(leaveType);
        const policyExists =
          isUuid
            ? policyById.has(leaveType)
            : policyByName.has(leaveType.toLowerCase()) ||
              policyByType.has(leaveType.toLowerCase());

        if (!policyExists) {
          errors.push(
            createError(
              rowNum,
              `Type de congé introuvable: ${leaveType}`,
              'POLICY_NOT_FOUND',
              'leaveType',
              leaveType
            )
          );
        }
      }

      // Validate status if provided
      if (row.status) {
        const validStatuses = ['pending', 'approved', 'rejected', 'cancelled'];
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

      // Validate submitted date if provided
      if (row.submittedAt && !this.isValidTimestamp(row.submittedAt)) {
        errors.push(
          createError(
            rowNum,
            `Date de soumission invalide: ${row.submittedAt}`,
            'INVALID_SUBMITTED_AT',
            'submittedAt',
            row.submittedAt
          )
        );
      }

      // Validate ACP amount if provided
      if (row.acpAmount !== undefined && row.acpAmount !== null && row.acpAmount < 0) {
        errors.push(
          createError(
            rowNum,
            `Montant ACP ne peut pas être négatif: ${row.acpAmount}`,
            'INVALID_ACP_AMOUNT',
            'acpAmount',
            row.acpAmount
          )
        );
      }
    }

    // Step 3: Check for overlapping requests (only if no critical errors)
    if (errors.length === 0 && !context.dryRun) {
      await this.checkForOverlaps(data, context, errors, employeeByNumber, employeeById);
    }

    return errors;
  }

  /**
   * Import time-off request data into database
   */
  async import(
    data: TimeOffRequestImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Load reference data for ID resolution
    const [employeeRecords, policyRecords] = await Promise.all([
      db
        .select({
          id: employees.id,
          employeeNumber: employees.employeeNumber,
        })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, context.tenantId),
            eq(employees.status, 'active')
          )
        ),
      db
        .select({
          id: timeOffPolicies.id,
          name: timeOffPolicies.name,
          policyType: timeOffPolicies.policyType,
        })
        .from(timeOffPolicies)
        .where(eq(timeOffPolicies.tenantId, context.tenantId)),
    ]);

    // Create lookup maps
    const employeeByNumber = new Map(
      employeeRecords.map((e) => [e.employeeNumber, e.id])
    );
    const employeeById = new Map(employeeRecords.map((e) => [e.id, e.id]));
    const policyByName = new Map(policyRecords.map((p) => [p.name.toLowerCase(), p.id]));
    const policyByType = new Map(
      policyRecords.map((p) => [p.policyType.toLowerCase(), p.id])
    );
    const policyById = new Map(policyRecords.map((p) => [p.id, p.id]));

    // Step 3: Transform data to match schema
    const requestRecords = data.map((row) => {
      // Resolve employee ID
      const empIdRaw = row.employeeId.trim();
      const employeeId = this.isValidUuid(empIdRaw)
        ? empIdRaw
        : employeeByNumber.get(empIdRaw)!;

      // Resolve policy ID
      const leaveTypeRaw = row.leaveType.trim();
      const policyId = this.isValidUuid(leaveTypeRaw)
        ? leaveTypeRaw
        : policyByName.get(leaveTypeRaw.toLowerCase()) ||
          policyByType.get(leaveTypeRaw.toLowerCase())!;

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Required fields
        employeeId,
        policyId,
        startDate: row.startDate, // Already in YYYY-MM-DD format
        endDate: row.endDate, // Already in YYYY-MM-DD format
        totalDays: String(row.daysRequested), // Convert to numeric string

        // Optional fields
        ...(row.reason && { reason: row.reason }),
        ...(row.notes && { notes: row.notes }),
        status: row.status ?? 'pending',
        ...(row.submittedAt && { submittedAt: row.submittedAt }),
        ...(row.reviewNotes && { reviewNotes: row.reviewNotes }),

        // ACP tracking
        isDeductibleForAcp: row.isDeductibleForAcp ?? true,
        ...(row.acpAmount !== undefined && { acpAmount: String(row.acpAmount) }),

        // Defaults
        // reviewedBy, reviewedAt, acpPaidInPayrollRunId, acpPaidAt will be null by default
      };
    });

    // Step 4: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: requestRecords.length,
      });
    }

    // Step 5: Batch insert into database
    try {
      const recordsInserted = await batchInsert(timeOffRequests, requestRecords, 100);

      return createSuccessResult(recordsInserted, {
        totalRequests: recordsInserted,
        byStatus: this.groupByStatus(requestRecords),
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
   * Check for overlapping leave requests
   */
  private async checkForOverlaps(
    data: TimeOffRequestImportData[],
    context: ImportContext,
    errors: ImportError[],
    employeeByNumber: Map<string, string>,
    employeeById: Map<string, string>
  ): Promise<void> {
    // Group requests by employee
    const requestsByEmployee = new Map<string, TimeOffRequestImportData[]>();

    for (const row of data) {
      const empIdRaw = row.employeeId?.trim();
      if (!empIdRaw) continue;

      const employeeId = this.isValidUuid(empIdRaw)
        ? empIdRaw
        : employeeByNumber.get(empIdRaw);

      if (!employeeId) continue;

      if (!requestsByEmployee.has(employeeId)) {
        requestsByEmployee.set(employeeId, []);
      }
      requestsByEmployee.get(employeeId)!.push(row);
    }

    // Check each employee's requests
    for (const [employeeId, requests] of requestsByEmployee) {
      // Fetch existing approved/pending requests for this employee
      const existingRequests = await db
        .select({
          startDate: timeOffRequests.startDate,
          endDate: timeOffRequests.endDate,
        })
        .from(timeOffRequests)
        .where(
          and(
            eq(timeOffRequests.tenantId, context.tenantId),
            eq(timeOffRequests.employeeId, employeeId),
            or(
              eq(timeOffRequests.status, 'pending'),
              eq(timeOffRequests.status, 'approved')
            )
          )
        );

      // Check for overlaps
      for (let i = 0; i < requests.length; i++) {
        const row = requests[i];
        const rowNum = data.indexOf(row) + 1;

        if (!row.startDate || !row.endDate) continue;
        if (!this.isValidDate(row.startDate) || !this.isValidDate(row.endDate)) continue;

        const newStart = new Date(row.startDate);
        const newEnd = new Date(row.endDate);

        // Check against existing requests
        for (const existing of existingRequests) {
          const existingStart = new Date(existing.startDate);
          const existingEnd = new Date(existing.endDate);

          if (this.dateRangesOverlap(newStart, newEnd, existingStart, existingEnd)) {
            errors.push(
              createError(
                rowNum,
                `Chevauchement détecté avec une demande existante (${existing.startDate} à ${existing.endDate})`,
                'OVERLAPPING_REQUEST',
                'startDate'
              )
            );
            break;
          }
        }

        // Check against other requests in same import
        for (let j = i + 1; j < requests.length; j++) {
          const otherRow = requests[j];
          if (!otherRow.startDate || !otherRow.endDate) continue;
          if (!this.isValidDate(otherRow.startDate) || !this.isValidDate(otherRow.endDate)) continue;

          const otherStart = new Date(otherRow.startDate);
          const otherEnd = new Date(otherRow.endDate);

          if (this.dateRangesOverlap(newStart, newEnd, otherStart, otherEnd)) {
            const otherRowNum = data.indexOf(otherRow) + 1;
            errors.push(
              createError(
                rowNum,
                `Chevauchement détecté avec une autre demande dans le fichier (ligne ${otherRowNum})`,
                'OVERLAPPING_REQUEST_IN_FILE',
                'startDate'
              )
            );
            break;
          }
        }
      }
    }
  }

  /**
   * Helper: Check if two date ranges overlap
   */
  private dateRangesOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    // Ranges overlap if: start1 <= end2 AND start2 <= end1
    return start1 <= end2 && start2 <= end1;
  }

  /**
   * Helper: Group records by status
   */
  private groupByStatus(records: any[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const record of records) {
      const status = record.status || 'pending';
      groups[status] = (groups[status] || 0) + 1;
    }
    return groups;
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
   * Helper: Validate timestamp format (ISO 8601)
   */
  private isValidTimestamp(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }

  /**
   * Helper: Check if string is a valid UUID
   */
  private isValidUuid(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }
}

// Export singleton instance
export const timeOffRequestsImporter = new TimeOffRequestsImporter();
