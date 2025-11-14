/**
 * Departments (Organizational Units) Importer
 *
 * Handles importing department/organizational unit records into the departments table.
 * Departments represent the organizational structure of a company.
 *
 * Features:
 * - Validates unique department codes per tenant
 * - Handles optional parent department hierarchy
 * - Auto-generates UUIDs for department IDs
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
import { departments } from '@/lib/db/schema/departments';
import { eq, and } from 'drizzle-orm';

interface DepartmentImportData {
  // Required fields
  name: string;
  code: string;

  // Optional fields
  description?: string;
  parentDepartmentCode?: string; // Reference to another department's code (resolved during import)
  status?: 'active' | 'inactive';
}

export class DepartmentsImporter implements DataImporter<DepartmentImportData> {
  /**
   * Validate department data before import
   */
  async validate(
    data: DepartmentImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.name?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Nom du département est requis',
            'MISSING_DEPARTMENT_NAME',
            'name'
          )
        );
      }

      if (!row.code?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Code du département est requis',
            'MISSING_DEPARTMENT_CODE',
            'code'
          )
        );
      }

      // Validate status if provided
      if (row.status && !['active', 'inactive'].includes(row.status)) {
        errors.push(
          createError(
            rowNum,
            `Statut invalide: ${row.status}. Doit être 'active' ou 'inactive'`,
            'INVALID_STATUS',
            'status',
            row.status
          )
        );
      }
    }

    // Check for duplicate department codes within the import
    const departmentCodes = data.map((row) => row.code?.trim()).filter(Boolean);
    const duplicates = departmentCodes.filter(
      (code, index) => departmentCodes.indexOf(code) !== index
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
            `Code département dupliqué dans le fichier: ${dupCode} (lignes ${indices.join(', ')})`,
            'DUPLICATE_DEPARTMENT_CODE',
            'code',
            dupCode
          )
        );
      }
    }

    // Check for existing department codes in database
    if (!context.dryRun) {
      const existingDepartments = await db
        .select({ code: departments.code })
        .from(departments)
        .where(
          and(
            eq(departments.tenantId, context.tenantId),
            eq(departments.status, 'active')
          )
        );

      const existingCodes = new Set(
        existingDepartments.map((d) => d.code).filter(Boolean)
      );

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 1;

        if (row.code && existingCodes.has(row.code.trim())) {
          errors.push(
            createError(
              rowNum,
              `Code département existe déjà: ${row.code}`,
              'DEPARTMENT_CODE_EXISTS',
              'code',
              row.code
            )
          );
        }
      }
    }

    // Validate parent department references
    const allCodes = new Set(departmentCodes);
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      if (row.parentDepartmentCode?.trim()) {
        // Check if parent exists in the import batch
        const parentInBatch = allCodes.has(row.parentDepartmentCode.trim());

        // If not in batch and not dry run, we'll check database during import
        // For now, just validate it's not self-referencing
        if (row.parentDepartmentCode.trim() === row.code?.trim()) {
          errors.push(
            createError(
              rowNum,
              `Un département ne peut pas être son propre parent: ${row.code}`,
              'SELF_REFERENCE_PARENT',
              'parentDepartmentCode',
              row.parentDepartmentCode
            )
          );
        }
      }
    }

    return errors;
  }

  /**
   * Import department data into database
   */
  async import(
    data: DepartmentImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Build code-to-ID mapping for parent references
    // We need to import in two passes if there are parent references
    const codeToId = new Map<string, string>();
    const warnings: ImportError[] = [];

    // Step 2a: Get existing department codes from database (for parent lookups)
    if (!context.dryRun) {
      const existingDepartments = await db
        .select({ id: departments.id, code: departments.code })
        .from(departments)
        .where(eq(departments.tenantId, context.tenantId));

      for (const dept of existingDepartments) {
        if (dept.code) {
          codeToId.set(dept.code, dept.id);
        }
      }
    }

    // Step 3: Transform data to match schema
    // First pass: create departments without parent references
    const departmentRecordsPass1 = data.map((row) => {
      const cleanedRow = {
        ...row,
        name: row.name?.trim(),
        code: row.code?.trim(),
      };

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Required fields
        name: cleanedRow.name!,
        code: cleanedRow.code!,

        // Optional fields
        ...(cleanedRow.description && { description: cleanedRow.description }),

        // Status
        status: cleanedRow.status ?? 'active',

        // Audit (context provides user info)
        ...(context.userId && { createdBy: context.userId }),
        ...(context.userId && { updatedBy: context.userId }),

        // Parent reference will be set in second pass
        parentDepartmentId: null,
      };
    });

    // Step 4: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: departmentRecordsPass1.length,
      });
    }

    // Step 5: Batch insert into database (first pass - no parents)
    try {
      const recordsInserted = await batchInsert(
        departments,
        departmentRecordsPass1,
        100
      );

      // Step 6: Update code-to-ID mapping with newly inserted departments
      const insertedDepartments = await db
        .select({ id: departments.id, code: departments.code })
        .from(departments)
        .where(eq(departments.tenantId, context.tenantId));

      for (const dept of insertedDepartments) {
        if (dept.code) {
          codeToId.set(dept.code, dept.id);
        }
      }

      // Step 7: Second pass - update parent references
      const updatePromises = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const code = row.code?.trim();
        const parentCode = row.parentDepartmentCode?.trim();

        if (code && parentCode) {
          const parentId = codeToId.get(parentCode);

          if (parentId) {
            const deptId = codeToId.get(code);
            if (deptId) {
              updatePromises.push(
                db
                  .update(departments)
                  .set({ parentDepartmentId: parentId })
                  .where(
                    and(
                      eq(departments.id, deptId),
                      eq(departments.tenantId, context.tenantId)
                    )
                  )
              );
            }
          } else {
            // Parent not found - add warning
            warnings.push(
              createError(
                i + 1,
                `Département parent introuvable: ${parentCode} (pour ${code})`,
                'PARENT_DEPARTMENT_NOT_FOUND',
                'parentDepartmentCode',
                parentCode
              )
            );
          }
        }
      }

      // Execute all parent updates
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
          departmentCodes: departmentRecordsPass1.map((d) => d.code),
          totalDepartments: recordsInserted,
          hierarchyUpdates: updatePromises.length,
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
export const departmentsImporter = new DepartmentsImporter();
