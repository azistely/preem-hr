/**
 * Benefit Enrollments Importer
 *
 * Handles importing employee benefit enrollment records into the employee_benefit_enrollments table.
 * Links employees to benefit plans with enrollment details, coverage information, and beneficiaries.
 *
 * Features:
 * - Validates employee and benefit plan existence
 * - Checks for duplicate enrollments (same employee + plan + overlapping dates)
 * - Validates enrollment and effective dates
 * - Handles coverage levels and status transitions
 * - Supports optional beneficiary information
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
import { employeeBenefitEnrollments, employees, benefitPlans } from '@/drizzle/schema';
import { eq, and, or, gte, isNull } from 'drizzle-orm';

interface BeneficiaryDesignation {
  name: string;
  relationship: string;
  percentage?: number;
  dateOfBirth?: string;
  contactInfo?: string;
}

interface CoveredDependent {
  name: string;
  relationship: string;
  dateOfBirth?: string;
}

interface BenefitEnrollmentImportData {
  // Required fields
  employeeId: string; // UUID or employee number
  benefitPlanId: string; // UUID or plan code
  enrollmentDate: string; // ISO date string from AI cleaning
  effectiveDate: string; // ISO date string from AI cleaning

  // Optional enrollment details
  terminationDate?: string; // ISO date string
  enrollmentNumber?: string;
  policyNumber?: string;
  coverageLevel?: string; // 'employee', 'employee+spouse', 'employee+children', 'family'

  // Optional cost overrides
  employeeCostOverride?: number;
  employerCostOverride?: number;

  // Optional status and reason
  enrollmentStatus?: 'active' | 'pending' | 'terminated' | 'suspended';
  terminationReason?: string;

  // Optional dependents and beneficiaries
  coveredDependents?: CoveredDependent[];
  beneficiaryDesignation?: BeneficiaryDesignation[];

  // Optional metadata
  enrollmentDocumentUrl?: string;
  notes?: string;
  customFields?: Record<string, any>;
}

export class BenefitEnrollmentsImporter implements DataImporter<BenefitEnrollmentImportData> {
  /**
   * Validate benefit enrollment data before import
   */
  async validate(
    data: BenefitEnrollmentImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    // Step 1: Validate required fields and formats
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.employeeId?.trim()) {
        errors.push(
          createError(
            rowNum,
            "Identifiant employé est requis",
            'MISSING_EMPLOYEE_ID',
            'employeeId'
          )
        );
      }

      if (!row.benefitPlanId?.trim()) {
        errors.push(
          createError(
            rowNum,
            "Identifiant plan d'avantages est requis",
            'MISSING_BENEFIT_PLAN_ID',
            'benefitPlanId'
          )
        );
      }

      if (!row.enrollmentDate) {
        errors.push(
          createError(
            rowNum,
            "Date d'inscription est requise",
            'MISSING_ENROLLMENT_DATE',
            'enrollmentDate'
          )
        );
      } else if (!this.isValidDate(row.enrollmentDate)) {
        errors.push(
          createError(
            rowNum,
            `Date d'inscription invalide: ${row.enrollmentDate}`,
            'INVALID_ENROLLMENT_DATE',
            'enrollmentDate',
            row.enrollmentDate
          )
        );
      }

      if (!row.effectiveDate) {
        errors.push(
          createError(
            rowNum,
            "Date d'effet est requise",
            'MISSING_EFFECTIVE_DATE',
            'effectiveDate'
          )
        );
      } else if (!this.isValidDate(row.effectiveDate)) {
        errors.push(
          createError(
            rowNum,
            `Date d'effet invalide: ${row.effectiveDate}`,
            'INVALID_EFFECTIVE_DATE',
            'effectiveDate',
            row.effectiveDate
          )
        );
      }

      // Validate date logic
      if (row.enrollmentDate && row.effectiveDate &&
          this.isValidDate(row.enrollmentDate) && this.isValidDate(row.effectiveDate)) {
        const enrollDate = new Date(row.enrollmentDate);
        const effectDate = new Date(row.effectiveDate);

        if (effectDate < enrollDate) {
          errors.push(
            createError(
              rowNum,
              `La date d'effet ne peut pas être antérieure à la date d'inscription`,
              'INVALID_DATE_SEQUENCE',
              'effectiveDate'
            )
          );
        }
      }

      // Validate termination date if provided
      if (row.terminationDate) {
        if (!this.isValidDate(row.terminationDate)) {
          errors.push(
            createError(
              rowNum,
              `Date de résiliation invalide: ${row.terminationDate}`,
              'INVALID_TERMINATION_DATE',
              'terminationDate',
              row.terminationDate
            )
          );
        } else if (row.effectiveDate && this.isValidDate(row.effectiveDate)) {
          const termDate = new Date(row.terminationDate);
          const effectDate = new Date(row.effectiveDate);

          if (termDate < effectDate) {
            errors.push(
              createError(
                rowNum,
                `La date de résiliation ne peut pas être antérieure à la date d'effet`,
                'INVALID_TERMINATION_DATE_SEQUENCE',
                'terminationDate'
              )
            );
          }
        }
      }

      // Validate enrollment status
      if (row.enrollmentStatus) {
        const validStatuses = ['active', 'pending', 'terminated', 'suspended'];
        if (!validStatuses.includes(row.enrollmentStatus)) {
          errors.push(
            createError(
              rowNum,
              `Statut d'inscription invalide: ${row.enrollmentStatus}. Valeurs autorisées: ${validStatuses.join(', ')}`,
              'INVALID_ENROLLMENT_STATUS',
              'enrollmentStatus',
              row.enrollmentStatus
            )
          );
        }
      }

      // Validate cost overrides if provided
      if (row.employeeCostOverride !== undefined && row.employeeCostOverride < 0) {
        errors.push(
          createError(
            rowNum,
            `Le coût employé ne peut pas être négatif: ${row.employeeCostOverride}`,
            'INVALID_EMPLOYEE_COST',
            'employeeCostOverride',
            row.employeeCostOverride
          )
        );
      }

      if (row.employerCostOverride !== undefined && row.employerCostOverride < 0) {
        errors.push(
          createError(
            rowNum,
            `Le coût employeur ne peut pas être négatif: ${row.employerCostOverride}`,
            'INVALID_EMPLOYER_COST',
            'employerCostOverride',
            row.employerCostOverride
          )
        );
      }
    }

    // Step 2: Check foreign key references (employees and benefit plans)
    if (!context.dryRun) {
      const employeeIds = [...new Set(data.map(row => row.employeeId?.trim()).filter(Boolean))];
      const benefitPlanIds = [...new Set(data.map(row => row.benefitPlanId?.trim()).filter(Boolean))];

      // Check if employees exist (by ID or employee number)
      const employeeIdMap = new Map<string, string>(); // Maps input ID/number to actual UUID

      for (const empId of employeeIds) {
        // Try to find by UUID first
        const isUuid = this.isValidUuid(empId);

        let employee;
        if (isUuid) {
          employee = await db.query.employees.findFirst({
            where: and(
              eq(employees.id, empId),
              eq(employees.tenantId, context.tenantId)
            ),
          });
        } else {
          // Try by employee number
          employee = await db.query.employees.findFirst({
            where: and(
              eq(employees.employeeNumber, empId),
              eq(employees.tenantId, context.tenantId)
            ),
          });
        }

        if (employee) {
          employeeIdMap.set(empId, employee.id);
        }
      }

      // Check if benefit plans exist (by ID or plan code)
      const planIdMap = new Map<string, string>(); // Maps input ID/code to actual UUID

      for (const planId of benefitPlanIds) {
        // Try to find by UUID first
        const isUuid = this.isValidUuid(planId);

        let plan;
        if (isUuid) {
          plan = await db.query.benefitPlans.findFirst({
            where: and(
              eq(benefitPlans.id, planId),
              eq(benefitPlans.tenantId, context.tenantId)
            ),
          });
        } else {
          // Try by plan code
          plan = await db.query.benefitPlans.findFirst({
            where: and(
              eq(benefitPlans.planCode, planId),
              eq(benefitPlans.tenantId, context.tenantId)
            ),
          });
        }

        if (plan) {
          planIdMap.set(planId, plan.id);
        }
      }

      // Validate each row has valid employee and plan references
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

        if (row.benefitPlanId && !planIdMap.has(row.benefitPlanId.trim())) {
          errors.push(
            createError(
              rowNum,
              `Plan d'avantages introuvable: ${row.benefitPlanId}`,
              'BENEFIT_PLAN_NOT_FOUND',
              'benefitPlanId',
              row.benefitPlanId
            )
          );
        }
      }

      // Step 3: Check for duplicate enrollments (same employee + plan + overlapping dates)
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 1;

        if (!row.employeeId || !row.benefitPlanId || !row.effectiveDate) {
          continue; // Skip if required fields missing (already flagged in validation)
        }

        const employeeUuid = employeeIdMap.get(row.employeeId.trim());
        const planUuid = planIdMap.get(row.benefitPlanId.trim());

        if (!employeeUuid || !planUuid) {
          continue; // Skip if employee or plan not found (already flagged)
        }

        // Check for existing active enrollments with overlapping dates
        const existingEnrollments = await db.query.employeeBenefitEnrollments.findMany({
          where: and(
            eq(employeeBenefitEnrollments.tenantId, context.tenantId),
            eq(employeeBenefitEnrollments.employeeId, employeeUuid),
            eq(employeeBenefitEnrollments.benefitPlanId, planUuid),
            or(
              // Either no termination date (active enrollment)
              isNull(employeeBenefitEnrollments.terminationDate),
              // Or termination date is after the new effective date
              gte(employeeBenefitEnrollments.terminationDate, row.effectiveDate)
            )
          ),
        });

        if (existingEnrollments.length > 0) {
          const enrollment = existingEnrollments[0];
          errors.push(
            createError(
              rowNum,
              `Inscription existante trouvée pour cet employé et ce plan (${enrollment.enrollmentNumber || enrollment.id})`,
              'DUPLICATE_ENROLLMENT',
              'employeeId'
            )
          );
        }
      }
    }

    return errors;
  }

  /**
   * Import benefit enrollment data into database
   */
  async import(
    data: BenefitEnrollmentImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Resolve employee and plan IDs
    const employeeIdMap = new Map<string, string>();
    const planIdMap = new Map<string, string>();

    const employeeIds = [...new Set(data.map(row => row.employeeId?.trim()).filter(Boolean))];
    const benefitPlanIds = [...new Set(data.map(row => row.benefitPlanId?.trim()).filter(Boolean))];

    // Resolve employee IDs
    for (const empId of employeeIds) {
      const isUuid = this.isValidUuid(empId);

      let employee;
      if (isUuid) {
        employee = await db.query.employees.findFirst({
          where: and(
            eq(employees.id, empId),
            eq(employees.tenantId, context.tenantId)
          ),
        });
      } else {
        employee = await db.query.employees.findFirst({
          where: and(
            eq(employees.employeeNumber, empId),
            eq(employees.tenantId, context.tenantId)
          ),
        });
      }

      if (employee) {
        employeeIdMap.set(empId, employee.id);
      }
    }

    // Resolve benefit plan IDs
    for (const planId of benefitPlanIds) {
      const isUuid = this.isValidUuid(planId);

      let plan;
      if (isUuid) {
        plan = await db.query.benefitPlans.findFirst({
          where: and(
            eq(benefitPlans.id, planId),
            eq(benefitPlans.tenantId, context.tenantId)
          ),
        });
      } else {
        plan = await db.query.benefitPlans.findFirst({
          where: and(
            eq(benefitPlans.planCode, planId),
            eq(benefitPlans.tenantId, context.tenantId)
          ),
        });
      }

      if (plan) {
        planIdMap.set(planId, plan.id);
      }
    }

    // Step 3: Transform data to match schema
    const enrollmentRecords = data.map((row) => {
      const employeeUuid = employeeIdMap.get(row.employeeId.trim())!;
      const planUuid = planIdMap.get(row.benefitPlanId.trim())!;

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Required foreign keys
        employeeId: employeeUuid,
        benefitPlanId: planUuid,

        // Required dates
        enrollmentDate: row.enrollmentDate!,
        effectiveDate: row.effectiveDate!,

        // Optional enrollment details
        ...(row.terminationDate && { terminationDate: row.terminationDate }),
        ...(row.enrollmentNumber && { enrollmentNumber: row.enrollmentNumber }),
        ...(row.policyNumber && { policyNumber: row.policyNumber }),
        ...(row.coverageLevel && { coverageLevel: row.coverageLevel }),

        // Optional cost overrides
        ...(row.employeeCostOverride !== undefined && {
          employeeCostOverride: String(row.employeeCostOverride),
        }),
        ...(row.employerCostOverride !== undefined && {
          employerCostOverride: String(row.employerCostOverride),
        }),

        // Optional status and reason
        enrollmentStatus: row.enrollmentStatus ?? 'active',
        ...(row.terminationReason && { terminationReason: row.terminationReason }),

        // Optional dependents and beneficiaries (as JSONB)
        coveredDependents: row.coveredDependents ?? [],
        beneficiaryDesignation: row.beneficiaryDesignation ?? null,

        // Optional metadata
        ...(row.enrollmentDocumentUrl && {
          enrollmentDocumentUrl: row.enrollmentDocumentUrl,
        }),
        ...(row.notes && { notes: row.notes }),
        customFields: row.customFields ?? {},

        // Audit (context provides user info)
        ...(context.userId && { createdBy: context.userId }),
        ...(context.userId && { updatedBy: context.userId }),
      };
    });

    // Step 4: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: enrollmentRecords.length,
      });
    }

    // Step 5: Batch insert into database
    try {
      const recordsInserted = await batchInsert(
        employeeBenefitEnrollments,
        enrollmentRecords,
        100
      );

      return createSuccessResult(recordsInserted, {
        enrollments: enrollmentRecords.map((e) => ({
          employeeId: e.employeeId,
          benefitPlanId: e.benefitPlanId,
          enrollmentDate: e.enrollmentDate,
        })),
        totalEnrollments: recordsInserted,
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
   * Helper: Validate UUID format
   */
  private isValidUuid(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }
}

// Export singleton instance
export const benefitEnrollmentsImporter = new BenefitEnrollmentsImporter();
