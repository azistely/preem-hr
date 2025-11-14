/**
 * Benefit Plans Importer
 *
 * Handles importing benefit plan records into the benefit_plans table.
 * This importer creates benefit plans (health insurance, retirement, CMU, etc.)
 * that can be enrolled by employees.
 *
 * Features:
 * - Validates unique plan codes per tenant
 * - Handles optional fields gracefully
 * - Validates plan types and cost amounts
 * - Auto-generates UUIDs for plan IDs
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
import { benefitPlans } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

interface BenefitPlanImportData {
  // Required fields
  planName: string;
  planCode: string;
  benefitType: 'health' | 'dental' | 'vision' | 'life_insurance' | 'retirement' | 'disability' | 'transport' | 'meal' | 'other';
  effectiveFrom: string; // ISO date string from AI cleaning

  // Optional fields
  description?: string;
  providerName?: string;
  coverageLevel?: 'individual' | 'family' | 'employee_spouse' | 'employee_children';
  employeeCost?: number;
  employerCost?: number;
  totalCost?: number;
  currency?: string;
  costFrequency?: 'monthly' | 'annual' | 'per_payroll';
  eligibleEmployeeTypes?: ('LOCAL' | 'EXPAT' | 'DETACHE' | 'STAGIAIRE')[];
  waitingPeriodDays?: number;
  requiresDependentVerification?: boolean;
  isActive?: boolean;
  effectiveTo?: string;
  linksToSalaryComponentId?: string;
  customFields?: Record<string, any>;
}

export class BenefitPlansImporter implements DataImporter<BenefitPlanImportData> {
  /**
   * Validate benefit plan data before import
   */
  async validate(
    data: BenefitPlanImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.planName?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Le nom du plan est requis',
            'MISSING_PLAN_NAME',
            'planName'
          )
        );
      }

      if (!row.planCode?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Le code du plan est requis',
            'MISSING_PLAN_CODE',
            'planCode'
          )
        );
      }

      if (!row.benefitType) {
        errors.push(
          createError(
            rowNum,
            'Le type de plan est requis',
            'MISSING_BENEFIT_TYPE',
            'benefitType'
          )
        );
      } else {
        // Validate benefit type enum
        const validTypes = ['health', 'dental', 'vision', 'life_insurance', 'retirement', 'disability', 'transport', 'meal', 'other'];
        if (!validTypes.includes(row.benefitType)) {
          errors.push(
            createError(
              rowNum,
              `Type de plan invalide: ${row.benefitType}. Types valides: ${validTypes.join(', ')}`,
              'INVALID_BENEFIT_TYPE',
              'benefitType',
              row.benefitType
            )
          );
        }
      }

      if (!row.effectiveFrom) {
        errors.push(
          createError(
            rowNum,
            'La date de début est requise',
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

      // Validate optional date fields
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

      // Validate cost amounts if present
      if (row.employeeCost !== undefined && row.employeeCost < 0) {
        errors.push(
          createError(
            rowNum,
            `Coût employé doit être positif: ${row.employeeCost}`,
            'INVALID_EMPLOYEE_COST',
            'employeeCost',
            row.employeeCost
          )
        );
      }

      if (row.employerCost !== undefined && row.employerCost < 0) {
        errors.push(
          createError(
            rowNum,
            `Coût employeur doit être positif: ${row.employerCost}`,
            'INVALID_EMPLOYER_COST',
            'employerCost',
            row.employerCost
          )
        );
      }

      if (row.totalCost !== undefined && row.totalCost < 0) {
        errors.push(
          createError(
            rowNum,
            `Coût total doit être positif: ${row.totalCost}`,
            'INVALID_TOTAL_COST',
            'totalCost',
            row.totalCost
          )
        );
      }

      // Validate coverage level enum if present
      if (row.coverageLevel) {
        const validLevels = ['individual', 'family', 'employee_spouse', 'employee_children'];
        if (!validLevels.includes(row.coverageLevel)) {
          errors.push(
            createError(
              rowNum,
              `Niveau de couverture invalide: ${row.coverageLevel}. Valeurs valides: ${validLevels.join(', ')}`,
              'INVALID_COVERAGE_LEVEL',
              'coverageLevel',
              row.coverageLevel
            )
          );
        }
      }

      // Validate cost frequency enum if present
      if (row.costFrequency) {
        const validFrequencies = ['monthly', 'annual', 'per_payroll'];
        if (!validFrequencies.includes(row.costFrequency)) {
          errors.push(
            createError(
              rowNum,
              `Fréquence de coût invalide: ${row.costFrequency}. Valeurs valides: ${validFrequencies.join(', ')}`,
              'INVALID_COST_FREQUENCY',
              'costFrequency',
              row.costFrequency
            )
          );
        }
      }

      // Validate waiting period
      if (row.waitingPeriodDays !== undefined && row.waitingPeriodDays < 0) {
        errors.push(
          createError(
            rowNum,
            `Période d'attente doit être positive: ${row.waitingPeriodDays}`,
            'INVALID_WAITING_PERIOD',
            'waitingPeriodDays',
            row.waitingPeriodDays
          )
        );
      }
    }

    // Check for duplicate plan codes within the import
    const planCodes = data.map((row) => row.planCode?.trim()).filter(Boolean);
    const duplicates = planCodes.filter(
      (code, index) => planCodes.indexOf(code) !== index
    );

    if (duplicates.length > 0) {
      const uniqueDuplicates = [...new Set(duplicates)];
      for (const dupCode of uniqueDuplicates) {
        const indices = data
          .map((row, idx) => (row.planCode?.trim() === dupCode ? idx + 1 : -1))
          .filter((idx) => idx > 0);
        errors.push(
          createError(
            indices[0],
            `Code du plan dupliqué dans le fichier: ${dupCode} (lignes ${indices.join(', ')})`,
            'DUPLICATE_PLAN_CODE',
            'planCode',
            dupCode
          )
        );
      }
    }

    // Check for existing plan codes in database (tenant-scoped)
    if (!context.dryRun) {
      const existingPlans = await db
        .select({ planCode: benefitPlans.planCode })
        .from(benefitPlans)
        .where(eq(benefitPlans.tenantId, context.tenantId));

      const existingCodes = new Set(existingPlans.map((p) => p.planCode));

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 1;

        if (row.planCode && existingCodes.has(row.planCode.trim())) {
          errors.push(
            createError(
              rowNum,
              `Code du plan existe déjà: ${row.planCode}`,
              'PLAN_CODE_EXISTS',
              'planCode',
              row.planCode
            )
          );
        }
      }
    }

    return errors;
  }

  /**
   * Import benefit plan data into database
   */
  async import(
    data: BenefitPlanImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Transform data to match schema
    const planRecords = data.map((row) => {
      // Remove any whitespace from required fields
      const cleanedRow = {
        ...row,
        planName: row.planName?.trim(),
        planCode: row.planCode?.trim(),
      };

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Required fields
        planName: cleanedRow.planName!,
        planCode: cleanedRow.planCode!,
        benefitType: cleanedRow.benefitType!,
        effectiveFrom: cleanedRow.effectiveFrom!, // Already in YYYY-MM-DD format from AI cleaning

        // Optional fields
        ...(cleanedRow.description && { description: cleanedRow.description }),
        ...(cleanedRow.providerName && { providerName: cleanedRow.providerName }),
        ...(cleanedRow.coverageLevel && { coverageLevel: cleanedRow.coverageLevel }),
        ...(cleanedRow.employeeCost !== undefined && {
          employeeCost: String(cleanedRow.employeeCost),
        }),
        ...(cleanedRow.employerCost !== undefined && {
          employerCost: String(cleanedRow.employerCost),
        }),
        ...(cleanedRow.totalCost !== undefined && {
          totalCost: String(cleanedRow.totalCost),
        }),
        currency: cleanedRow.currency || 'XOF',
        costFrequency: cleanedRow.costFrequency || 'monthly',
        ...(cleanedRow.eligibleEmployeeTypes && {
          eligibleEmployeeTypes: cleanedRow.eligibleEmployeeTypes,
        }),
        waitingPeriodDays: cleanedRow.waitingPeriodDays ?? 0,
        requiresDependentVerification: cleanedRow.requiresDependentVerification ?? false,
        isActive: cleanedRow.isActive ?? true,
        ...(cleanedRow.effectiveTo && { effectiveTo: cleanedRow.effectiveTo }),
        ...(cleanedRow.linksToSalaryComponentId && {
          linksToSalaryComponentId: cleanedRow.linksToSalaryComponentId,
        }),
        customFields: cleanedRow.customFields || {},

        // Audit (context provides user info)
        ...(context.userId && { createdBy: context.userId }),
        ...(context.userId && { updatedBy: context.userId }),
      };
    });

    // Step 3: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: planRecords.length,
      });
    }

    // Step 4: Batch insert into database
    try {
      const recordsInserted = await batchInsert(benefitPlans, planRecords, 100);

      return createSuccessResult(recordsInserted, {
        planCodes: planRecords.map((p) => p.planCode),
        totalPlans: recordsInserted,
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
export const benefitPlansImporter = new BenefitPlansImporter();
