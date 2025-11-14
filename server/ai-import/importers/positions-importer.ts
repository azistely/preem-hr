/**
 * Positions (Job Positions) Importer
 *
 * Handles importing job position records into the positions table.
 * Positions represent job roles within an organization's structure.
 *
 * Features:
 * - Validates unique position codes per tenant
 * - Handles optional department references
 * - Handles optional reporting relationships (position hierarchy)
 * - Supports salary ranges with currency
 * - Auto-generates UUIDs for position IDs
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
import { positions } from '@/lib/db/schema/positions';
import { departments } from '@/lib/db/schema/departments';
import { eq, and } from 'drizzle-orm';

interface PositionImportData {
  // Required fields
  title: string;
  code: string;

  // Optional fields
  description?: string;
  departmentCode?: string; // Reference to department's code (resolved during import)
  reportsToPositionCode?: string; // Reference to another position's code (resolved during import)

  // Compensation
  minSalary?: number | string;
  maxSalary?: number | string;
  currency?: string;

  // Job details
  jobLevel?: string;
  employmentType?: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'intern';
  weeklyHours?: number | string;

  // Status
  status?: 'active' | 'inactive' | 'filled' | 'vacant';
  headcount?: number | string;

  // Effective dating
  effectiveFrom?: string; // ISO date string
  effectiveTo?: string; // ISO date string
}

export class PositionsImporter implements DataImporter<PositionImportData> {
  /**
   * Validate position data before import
   */
  async validate(
    data: PositionImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.title?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Titre du poste est requis',
            'MISSING_POSITION_TITLE',
            'title'
          )
        );
      }

      if (!row.code?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Code du poste est requis',
            'MISSING_POSITION_CODE',
            'code'
          )
        );
      }

      // Validate status if provided
      const validStatuses = ['active', 'inactive', 'filled', 'vacant'];
      if (row.status && !validStatuses.includes(row.status)) {
        errors.push(
          createError(
            rowNum,
            `Statut invalide: ${row.status}. Doit être 'active', 'inactive', 'filled' ou 'vacant'`,
            'INVALID_STATUS',
            'status',
            row.status
          )
        );
      }

      // Validate employment type if provided
      const validEmploymentTypes = ['full_time', 'part_time', 'contract', 'temporary', 'intern'];
      if (row.employmentType && !validEmploymentTypes.includes(row.employmentType)) {
        errors.push(
          createError(
            rowNum,
            `Type d'emploi invalide: ${row.employmentType}. Doit être 'full_time', 'part_time', 'contract', 'temporary' ou 'intern'`,
            'INVALID_EMPLOYMENT_TYPE',
            'employmentType',
            row.employmentType
          )
        );
      }

      // Validate salary range if provided
      if (row.minSalary !== undefined && row.maxSalary !== undefined) {
        const minSal = typeof row.minSalary === 'string' ? parseFloat(row.minSalary) : row.minSalary;
        const maxSal = typeof row.maxSalary === 'string' ? parseFloat(row.maxSalary) : row.maxSalary;

        if (isNaN(minSal)) {
          errors.push(
            createError(
              rowNum,
              `Salaire minimum invalide: ${row.minSalary}`,
              'INVALID_MIN_SALARY',
              'minSalary',
              row.minSalary
            )
          );
        }

        if (isNaN(maxSal)) {
          errors.push(
            createError(
              rowNum,
              `Salaire maximum invalide: ${row.maxSalary}`,
              'INVALID_MAX_SALARY',
              'maxSalary',
              row.maxSalary
            )
          );
        }

        if (!isNaN(minSal) && !isNaN(maxSal) && minSal > maxSal) {
          errors.push(
            createError(
              rowNum,
              `Le salaire minimum (${minSal}) ne peut pas être supérieur au salaire maximum (${maxSal})`,
              'MIN_SALARY_EXCEEDS_MAX',
              'minSalary',
              minSal
            )
          );
        }

        if (!isNaN(minSal) && minSal < 0) {
          errors.push(
            createError(
              rowNum,
              `Le salaire minimum ne peut pas être négatif: ${minSal}`,
              'NEGATIVE_MIN_SALARY',
              'minSalary',
              minSal
            )
          );
        }

        if (!isNaN(maxSal) && maxSal < 0) {
          errors.push(
            createError(
              rowNum,
              `Le salaire maximum ne peut pas être négatif: ${maxSal}`,
              'NEGATIVE_MAX_SALARY',
              'maxSalary',
              maxSal
            )
          );
        }
      }

      // Validate weekly hours if provided
      if (row.weeklyHours !== undefined) {
        const hours = typeof row.weeklyHours === 'string' ? parseFloat(row.weeklyHours) : row.weeklyHours;
        if (isNaN(hours) || hours < 0 || hours > 168) {
          errors.push(
            createError(
              rowNum,
              `Heures hebdomadaires invalides: ${row.weeklyHours}. Doit être entre 0 et 168`,
              'INVALID_WEEKLY_HOURS',
              'weeklyHours',
              row.weeklyHours
            )
          );
        }
      }

      // Validate headcount if provided
      if (row.headcount !== undefined) {
        const hc = typeof row.headcount === 'string' ? parseInt(row.headcount) : row.headcount;
        if (isNaN(hc) || hc < 0) {
          errors.push(
            createError(
              rowNum,
              `Effectif invalide: ${row.headcount}. Doit être un nombre positif`,
              'INVALID_HEADCOUNT',
              'headcount',
              row.headcount
            )
          );
        }
      }

      // Validate effective dates if provided
      if (row.effectiveFrom) {
        const fromDate = new Date(row.effectiveFrom);
        if (isNaN(fromDate.getTime())) {
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
      }

      if (row.effectiveTo) {
        const toDate = new Date(row.effectiveTo);
        if (isNaN(toDate.getTime())) {
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

        // Check date range
        if (row.effectiveFrom) {
          const fromDate = new Date(row.effectiveFrom);
          if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime()) && fromDate > toDate) {
            errors.push(
              createError(
                rowNum,
                `La date de début (${row.effectiveFrom}) ne peut pas être après la date de fin (${row.effectiveTo})`,
                'INVALID_DATE_RANGE',
                'effectiveFrom'
              )
            );
          }
        }
      }
    }

    // Check for duplicate position codes within the import
    const positionCodes = data.map((row) => row.code?.trim()).filter(Boolean);
    const duplicates = positionCodes.filter(
      (code, index) => positionCodes.indexOf(code) !== index
    );

    if (duplicates.length > 0) {
      const uniqueDuplicates = [...new Set(duplicates)];
      for (const dupCode of uniqueDuplicates) {
        const indices = data
          .map((row, idx) => (row.code?.trim() === dupCode ? idx + 1 : -1))
          .filter((idx) => idx > 0);
        errors.push(
          createError(
            indices[0],
            `Code poste dupliqué dans le fichier: ${dupCode} (lignes ${indices.join(', ')})`,
            'DUPLICATE_POSITION_CODE',
            'code',
            dupCode
          )
        );
      }
    }

    // Check for existing position codes in database
    if (!context.dryRun) {
      const existingPositions = await db
        .select({ code: positions.code })
        .from(positions)
        .where(
          and(
            eq(positions.tenantId, context.tenantId),
            eq(positions.status, 'active')
          )
        );

      const existingCodes = new Set(
        existingPositions.map((p) => p.code).filter(Boolean)
      );

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 1;

        if (row.code && existingCodes.has(row.code.trim())) {
          errors.push(
            createError(
              rowNum,
              `Code poste existe déjà: ${row.code}`,
              'POSITION_CODE_EXISTS',
              'code',
              row.code
            )
          );
        }
      }
    }

    // Validate self-referencing reports-to relationships
    const allCodes = new Set(positionCodes);
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      if (row.reportsToPositionCode?.trim()) {
        // Check if it's not self-referencing
        if (row.reportsToPositionCode.trim() === row.code?.trim()) {
          errors.push(
            createError(
              rowNum,
              `Un poste ne peut pas se rapporter à lui-même: ${row.code}`,
              'SELF_REFERENCE_REPORTING',
              'reportsToPositionCode',
              row.reportsToPositionCode
            )
          );
        }
      }
    }

    return errors;
  }

  /**
   * Import position data into database
   */
  async import(
    data: PositionImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Build code-to-ID mappings
    const codeToId = new Map<string, string>();
    const departmentCodeToId = new Map<string, string>();
    const warnings: ImportError[] = [];

    // Step 2a: Get existing positions from database (for reporting-to lookups)
    if (!context.dryRun) {
      const existingPositions = await db
        .select({ id: positions.id, code: positions.code })
        .from(positions)
        .where(eq(positions.tenantId, context.tenantId));

      for (const pos of existingPositions) {
        if (pos.code) {
          codeToId.set(pos.code, pos.id);
        }
      }

      // Get existing departments from database (for department lookups)
      const existingDepartments = await db
        .select({ id: departments.id, code: departments.code })
        .from(departments)
        .where(eq(departments.tenantId, context.tenantId));

      for (const dept of existingDepartments) {
        if (dept.code) {
          departmentCodeToId.set(dept.code, dept.id);
        }
      }
    }

    // Step 3: Transform data to match schema
    // First pass: create positions without reporting relationships
    const positionRecordsPass1 = data.map((row) => {
      const cleanedRow = {
        ...row,
        title: row.title?.trim(),
        code: row.code?.trim(),
      };

      // Parse numeric fields
      const minSalary = cleanedRow.minSalary !== undefined
        ? (typeof cleanedRow.minSalary === 'string' ? parseFloat(cleanedRow.minSalary) : cleanedRow.minSalary)
        : undefined;
      const maxSalary = cleanedRow.maxSalary !== undefined
        ? (typeof cleanedRow.maxSalary === 'string' ? parseFloat(cleanedRow.maxSalary) : cleanedRow.maxSalary)
        : undefined;
      const weeklyHours = cleanedRow.weeklyHours !== undefined
        ? (typeof cleanedRow.weeklyHours === 'string' ? parseFloat(cleanedRow.weeklyHours) : cleanedRow.weeklyHours)
        : undefined;
      const headcount = cleanedRow.headcount !== undefined
        ? (typeof cleanedRow.headcount === 'string' ? parseInt(cleanedRow.headcount) : cleanedRow.headcount)
        : undefined;

      // Resolve department reference
      const departmentId = cleanedRow.departmentCode?.trim()
        ? departmentCodeToId.get(cleanedRow.departmentCode.trim())
        : undefined;

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Required fields
        title: cleanedRow.title!,
        code: cleanedRow.code!,

        // Optional fields
        ...(cleanedRow.description && { description: cleanedRow.description }),

        // Department reference
        ...(departmentId && { departmentId }),

        // Compensation
        ...(minSalary !== undefined && !isNaN(minSalary) && { minSalary: minSalary.toString() }),
        ...(maxSalary !== undefined && !isNaN(maxSalary) && { maxSalary: maxSalary.toString() }),
        ...(cleanedRow.currency && { currency: cleanedRow.currency }),

        // Job details
        ...(cleanedRow.jobLevel && { jobLevel: cleanedRow.jobLevel }),
        ...(cleanedRow.employmentType && { employmentType: cleanedRow.employmentType }),
        ...(weeklyHours !== undefined && !isNaN(weeklyHours) && { weeklyHours: weeklyHours.toString() }),

        // Status
        status: cleanedRow.status ?? 'active',
        ...(headcount !== undefined && !isNaN(headcount) && { headcount }),

        // Effective dating
        ...(cleanedRow.effectiveFrom && { effectiveFrom: cleanedRow.effectiveFrom }),
        ...(cleanedRow.effectiveTo && { effectiveTo: cleanedRow.effectiveTo }),

        // Audit (context provides user info)
        ...(context.userId && { createdBy: context.userId }),
        ...(context.userId && { updatedBy: context.userId }),

        // Reporting relationship will be set in second pass
        reportsToPositionId: null,
      };
    });

    // Step 4: Track missing department references for warnings
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const departmentCode = row.departmentCode?.trim();

      if (departmentCode && !departmentCodeToId.has(departmentCode)) {
        warnings.push(
          createError(
            i + 1,
            `Département introuvable: ${departmentCode} (pour poste ${row.code})`,
            'DEPARTMENT_NOT_FOUND',
            'departmentCode',
            departmentCode
          )
        );
      }
    }

    // Step 5: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: positionRecordsPass1.length,
      });
    }

    // Step 6: Batch insert into database (first pass - no reporting relationships)
    try {
      const recordsInserted = await batchInsert(
        positions,
        positionRecordsPass1,
        100
      );

      // Step 7: Update code-to-ID mapping with newly inserted positions
      const insertedPositions = await db
        .select({ id: positions.id, code: positions.code })
        .from(positions)
        .where(eq(positions.tenantId, context.tenantId));

      for (const pos of insertedPositions) {
        if (pos.code) {
          codeToId.set(pos.code, pos.id);
        }
      }

      // Step 8: Second pass - update reporting relationships
      const updatePromises = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const code = row.code?.trim();
        const reportsToCode = row.reportsToPositionCode?.trim();

        if (code && reportsToCode) {
          const reportsToId = codeToId.get(reportsToCode);

          if (reportsToId) {
            const posId = codeToId.get(code);
            if (posId) {
              updatePromises.push(
                db
                  .update(positions)
                  .set({ reportsToPositionId: reportsToId })
                  .where(
                    and(
                      eq(positions.id, posId),
                      eq(positions.tenantId, context.tenantId)
                    )
                  )
              );
            }
          } else {
            // Reporting position not found - add warning
            warnings.push(
              createError(
                i + 1,
                `Poste de rapport introuvable: ${reportsToCode} (pour ${code})`,
                'REPORTS_TO_POSITION_NOT_FOUND',
                'reportsToPositionCode',
                reportsToCode
              )
            );
          }
        }
      }

      // Execute all reporting relationship updates
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      return {
        success: true,
        recordsInserted,
        recordsUpdated: updatePromises.length,
        recordsSkipped: 0,
        errors: [],
        warnings,
        metadata: {
          positionCodes: positionRecordsPass1.map((p) => p.code),
          totalPositions: recordsInserted,
          hierarchyUpdates: updatePromises.length,
          missingDepartments: warnings.filter(w => w.code === 'DEPARTMENT_NOT_FOUND').length,
        },
      };
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
export const positionsImporter = new PositionsImporter();
