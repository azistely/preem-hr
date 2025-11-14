/**
 * Position Assignments Importer
 *
 * Handles importing position assignment records into the assignments table.
 * Links employees to positions over time with effective dating.
 *
 * Features:
 * - Validates employee and position references exist
 * - Checks for overlapping assignments (same employee, overlapping dates)
 * - Ensures only one active assignment per employee
 * - Handles assignment history with start/end dates
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
import { assignments } from '@/lib/db/schema/assignments';
import { employees } from '@/lib/db/schema/employees';
import { positions } from '@/lib/db/schema/positions';
import { eq, and, gte, lte, or, isNull, sql } from 'drizzle-orm';

interface PositionAssignmentImportData {
  // Required fields
  employeeId: string; // UUID or employee number
  positionId: string; // UUID or position code
  effectiveFrom: string; // ISO date string (YYYY-MM-DD)

  // Optional fields
  effectiveTo?: string; // ISO date string (YYYY-MM-DD) - null means current assignment
  assignmentType?: 'primary' | 'secondary' | 'temporary' | 'acting';
  assignmentReason?: string;
  notes?: string;
}

export class PositionAssignmentImporter
  implements DataImporter<PositionAssignmentImportData>
{
  /**
   * Validate position assignment data before import
   */
  async validate(
    data: PositionAssignmentImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    // Step 1: Validate required fields and date formats
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.employeeId?.trim()) {
        errors.push(
          createError(
            rowNum,
            'ID employé est requis',
            'MISSING_EMPLOYEE_ID',
            'employeeId'
          )
        );
      }

      if (!row.positionId?.trim()) {
        errors.push(
          createError(
            rowNum,
            'ID poste est requis',
            'MISSING_POSITION_ID',
            'positionId'
          )
        );
      }

      if (!row.effectiveFrom) {
        errors.push(
          createError(
            rowNum,
            "Date de début d'affectation est requise",
            'MISSING_EFFECTIVE_FROM',
            'effectiveFrom'
          )
        );
      } else if (!this.isValidDate(row.effectiveFrom)) {
        errors.push(
          createError(
            rowNum,
            `Date de début invalide: ${row.effectiveFrom}`,
            'INVALID_EFFECTIVE_FROM',
            'effectiveFrom',
            row.effectiveFrom
          )
        );
      }

      // Validate effectiveTo if provided
      if (row.effectiveTo && !this.isValidDate(row.effectiveTo)) {
        errors.push(
          createError(
            rowNum,
            `Date de fin invalide: ${row.effectiveTo}`,
            'INVALID_EFFECTIVE_TO',
            'effectiveTo',
            row.effectiveTo
          )
        );
      }

      // Validate date range (effectiveTo must be after effectiveFrom)
      if (row.effectiveFrom && row.effectiveTo) {
        const fromDate = new Date(row.effectiveFrom);
        const toDate = new Date(row.effectiveTo);

        if (toDate <= fromDate) {
          errors.push(
            createError(
              rowNum,
              `La date de fin (${row.effectiveTo}) doit être après la date de début (${row.effectiveFrom})`,
              'INVALID_DATE_RANGE',
              'effectiveTo'
            )
          );
        }
      }
    }

    // If basic validation failed, return early
    if (errors.length > 0) {
      return errors;
    }

    // Step 2: Resolve employee and position IDs
    const { employeeIdMap, positionIdMap } = await this.resolveReferences(
      data,
      context
    );

    // Step 3: Check for missing references
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      if (row.employeeId && !employeeIdMap.has(row.employeeId.trim())) {
        errors.push(
          createError(
            rowNum,
            `Employé introuvable: ${row.employeeId}`,
            'EMPLOYEE_NOT_FOUND',
            'employeeId',
            row.employeeId
          )
        );
      }

      if (row.positionId && !positionIdMap.has(row.positionId.trim())) {
        errors.push(
          createError(
            rowNum,
            `Poste introuvable: ${row.positionId}`,
            'POSITION_NOT_FOUND',
            'positionId',
            row.positionId
          )
        );
      }
    }

    // If references not found, return early
    if (errors.length > 0) {
      return errors;
    }

    // Step 4: Check for overlapping assignments
    const overlappingErrors = await this.checkOverlappingAssignments(
      data,
      employeeIdMap,
      context
    );
    errors.push(...overlappingErrors);

    // Step 5: Check for multiple active assignments per employee
    const activeAssignmentErrors = this.checkMultipleActiveAssignments(
      data,
      employeeIdMap
    );
    errors.push(...activeAssignmentErrors);

    return errors;
  }

  /**
   * Import position assignment data into database
   */
  async import(
    data: PositionAssignmentImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Resolve employee and position IDs
    const { employeeIdMap, positionIdMap } = await this.resolveReferences(
      data,
      context
    );

    // Step 3: Transform data to match schema
    const assignmentRecords = data.map((row) => {
      const cleanedRow = {
        ...row,
        employeeId: row.employeeId?.trim(),
        positionId: row.positionId?.trim(),
      };

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Foreign key references (resolved UUIDs)
        employeeId: employeeIdMap.get(cleanedRow.employeeId!)!,
        positionId: positionIdMap.get(cleanedRow.positionId!)!,

        // Required fields
        effectiveFrom: cleanedRow.effectiveFrom!, // YYYY-MM-DD format

        // Optional fields
        ...(cleanedRow.effectiveTo && { effectiveTo: cleanedRow.effectiveTo }),
        assignmentType: cleanedRow.assignmentType ?? 'primary',
        ...(cleanedRow.assignmentReason && {
          assignmentReason: cleanedRow.assignmentReason,
        }),
        ...(cleanedRow.notes && { notes: cleanedRow.notes }),

        // Audit (context provides user info)
        ...(context.userId && { createdBy: context.userId }),
      };
    });

    // Step 4: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: assignmentRecords.length,
      });
    }

    // Step 5: Batch insert into database
    try {
      const recordsInserted = await batchInsert(assignments, assignmentRecords, 100);

      return createSuccessResult(recordsInserted, {
        totalAssignments: recordsInserted,
        activeAssignments: assignmentRecords.filter((a) => !a.effectiveTo).length,
        historicalAssignments: assignmentRecords.filter((a) => a.effectiveTo).length,
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

  /**
   * Resolve employee and position IDs from employee numbers/position codes to UUIDs
   */
  private async resolveReferences(
    data: PositionAssignmentImportData[],
    context: ImportContext
  ): Promise<{
    employeeIdMap: Map<string, string>;
    positionIdMap: Map<string, string>;
  }> {
    // Extract unique employee and position identifiers
    const employeeIdentifiers = [
      ...new Set(data.map((row) => row.employeeId?.trim()).filter(Boolean)),
    ];
    const positionIdentifiers = [
      ...new Set(data.map((row) => row.positionId?.trim()).filter(Boolean)),
    ];

    // Fetch employees (support both UUID and employee number)
    const employeeRecords = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
      })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, context.tenantId),
          or(
            sql`${employees.id}::text = ANY(${employeeIdentifiers})`,
            sql`${employees.employeeNumber} = ANY(${employeeIdentifiers})`
          )
        )
      );

    // Fetch positions (support both UUID and position code)
    const positionRecords = await db
      .select({
        id: positions.id,
        code: positions.code,
      })
      .from(positions)
      .where(
        and(
          eq(positions.tenantId, context.tenantId),
          or(
            sql`${positions.id}::text = ANY(${positionIdentifiers})`,
            sql`${positions.code} = ANY(${positionIdentifiers})`
          )
        )
      );

    // Build lookup maps (support both UUID and natural key)
    const employeeIdMap = new Map<string, string>();
    for (const emp of employeeRecords) {
      employeeIdMap.set(emp.id, emp.id); // UUID -> UUID
      if (emp.employeeNumber) {
        employeeIdMap.set(emp.employeeNumber, emp.id); // Employee number -> UUID
      }
    }

    const positionIdMap = new Map<string, string>();
    for (const pos of positionRecords) {
      positionIdMap.set(pos.id, pos.id); // UUID -> UUID
      if (pos.code) {
        positionIdMap.set(pos.code, pos.id); // Position code -> UUID
      }
    }

    return { employeeIdMap, positionIdMap };
  }

  /**
   * Check for overlapping assignments (same employee, overlapping dates)
   */
  private async checkOverlappingAssignments(
    data: PositionAssignmentImportData[],
    employeeIdMap: Map<string, string>,
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    // Get all existing assignments for employees in this import
    const employeeUuids = Array.from(
      new Set(
        data
          .map((row) => employeeIdMap.get(row.employeeId?.trim() || ''))
          .filter(Boolean) as string[]
      )
    );

    if (employeeUuids.length === 0) {
      return errors;
    }

    const existingAssignments = await db
      .select({
        employeeId: assignments.employeeId,
        effectiveFrom: assignments.effectiveFrom,
        effectiveTo: assignments.effectiveTo,
      })
      .from(assignments)
      .where(
        and(
          eq(assignments.tenantId, context.tenantId),
          sql`${assignments.employeeId} = ANY(${employeeUuids})`
        )
      );

    // Build lookup by employee
    const existingByEmployee = new Map<string, typeof existingAssignments>();
    for (const assignment of existingAssignments) {
      const key = assignment.employeeId;
      if (!existingByEmployee.has(key)) {
        existingByEmployee.set(key, []);
      }
      existingByEmployee.get(key)!.push(assignment);
    }

    // Check each row for overlaps
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      const employeeUuid = employeeIdMap.get(row.employeeId?.trim() || '');
      if (!employeeUuid) continue;

      const newFrom = new Date(row.effectiveFrom);
      const newTo = row.effectiveTo ? new Date(row.effectiveTo) : null;

      const existing = existingByEmployee.get(employeeUuid) || [];

      for (const existingAssignment of existing) {
        const existingFrom = new Date(existingAssignment.effectiveFrom);
        const existingTo = existingAssignment.effectiveTo
          ? new Date(existingAssignment.effectiveTo)
          : null;

        // Check if date ranges overlap
        const overlaps = this.dateRangesOverlap(
          newFrom,
          newTo,
          existingFrom,
          existingTo
        );

        if (overlaps) {
          errors.push(
            createError(
              rowNum,
              `Affectation en conflit pour l'employé ${row.employeeId}: une affectation existe déjà du ${existingAssignment.effectiveFrom} au ${existingAssignment.effectiveTo || 'présent'}`,
              'OVERLAPPING_ASSIGNMENT',
              'effectiveFrom'
            )
          );
        }
      }
    }

    // Also check for overlaps within the import itself
    for (let i = 0; i < data.length; i++) {
      const row1 = data[i];
      const employeeId1 = row1.employeeId?.trim();

      for (let j = i + 1; j < data.length; j++) {
        const row2 = data[j];
        const employeeId2 = row2.employeeId?.trim();

        // Same employee?
        if (employeeId1 === employeeId2) {
          const from1 = new Date(row1.effectiveFrom);
          const to1 = row1.effectiveTo ? new Date(row1.effectiveTo) : null;
          const from2 = new Date(row2.effectiveFrom);
          const to2 = row2.effectiveTo ? new Date(row2.effectiveTo) : null;

          if (this.dateRangesOverlap(from1, to1, from2, to2)) {
            errors.push(
              createError(
                i + 1,
                `Affectations en conflit dans le fichier pour l'employé ${employeeId1}: lignes ${i + 1} et ${j + 1} se chevauchent`,
                'OVERLAPPING_ASSIGNMENT_IN_FILE',
                'effectiveFrom'
              )
            );
          }
        }
      }
    }

    return errors;
  }

  /**
   * Check for multiple active assignments per employee (effectiveTo is null)
   */
  private checkMultipleActiveAssignments(
    data: PositionAssignmentImportData[],
    employeeIdMap: Map<string, string>
  ): ImportError[] {
    const errors: ImportError[] = [];

    // Group by employee and check if multiple have null effectiveTo
    const activeByEmployee = new Map<string, number[]>();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const employeeKey = row.employeeId?.trim() || '';

      // If no effectiveTo, it's an active assignment
      if (!row.effectiveTo) {
        if (!activeByEmployee.has(employeeKey)) {
          activeByEmployee.set(employeeKey, []);
        }
        activeByEmployee.get(employeeKey)!.push(i + 1);
      }
    }

    // Check for employees with multiple active assignments
    for (const [employeeId, rowNumbers] of activeByEmployee.entries()) {
      if (rowNumbers.length > 1) {
        errors.push(
          createError(
            rowNumbers[0],
            `L'employé ${employeeId} a plusieurs affectations actives dans le fichier (lignes ${rowNumbers.join(', ')}). Une seule affectation active est permise.`,
            'MULTIPLE_ACTIVE_ASSIGNMENTS',
            'effectiveTo'
          )
        );
      }
    }

    return errors;
  }

  /**
   * Helper: Check if two date ranges overlap
   */
  private dateRangesOverlap(
    start1: Date,
    end1: Date | null,
    start2: Date,
    end2: Date | null
  ): boolean {
    // If either range is open-ended (null end), check if the start falls within the other range
    if (end1 === null && end2 === null) {
      // Both open-ended - always overlap
      return true;
    }

    if (end1 === null) {
      // First range is open-ended
      // Overlaps if start1 <= end2 (if end2 exists)
      return end2 === null || start1 <= end2;
    }

    if (end2 === null) {
      // Second range is open-ended
      // Overlaps if start2 <= end1
      return start2 <= end1;
    }

    // Both ranges have end dates
    // Overlaps if: start1 <= end2 AND start2 <= end1
    return start1 <= end2 && start2 <= end1;
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
}

// Export singleton instance
export const positionAssignmentImporter = new PositionAssignmentImporter();
