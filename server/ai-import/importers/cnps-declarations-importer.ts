/**
 * CNPS Declarations Importer
 *
 * Handles importing historical CNPS monthly contribution declarations from
 * external systems (SAGE/CIEL/Excel) into the cnps_declaration_edits table.
 *
 * **CRITICAL:** This importer preserves historical declaration data exactly
 * as it was filed. No recalculation is performed.
 *
 * Features:
 * - Preserves original CNPS declaration amounts (no recalculation)
 * - Validates period format (YYYY-MM)
 * - Supports both monthly and daily worker categorizations
 * - Validates contribution scheme amounts
 * - Checks for duplicate declarations (same period + country)
 * - Tenant isolation enforced
 * - Batch insertion for performance
 */

import {
  DataImporter,
  ImportContext,
  ImportResult,
  ImportError,
  ImportWarning,
  createSuccessResult,
  createFailureResult,
  createError,
  createWarning,
  batchInsert,
} from './base-importer';
import { db } from '@/lib/db';
import { cnpsDeclarationEdits } from '@/lib/db/schema/payroll';
import { and, eq } from 'drizzle-orm';

/**
 * CNPS Declaration Import Data Structure
 */
interface CNPSDeclarationImportData {
  // Required fields
  declarationPeriod: string; // 'YYYY-MM' format
  countryCode: string; // 'CI', 'SN', 'BF', etc.

  // Company information (optional - will use tenant defaults if not provided)
  companyName?: string;
  companyCNPS?: string;
  companyAddress?: string;
  companyPhone?: string;

  // Employee categorization (optional - at least one category should have data)
  dailyWorkers?: {
    category1?: {
      employeeCount?: number;
      totalGross?: number;
      contributionBase?: number;
    };
    category2?: {
      employeeCount?: number;
      totalGross?: number;
      contributionBase?: number;
    };
  };

  monthlyWorkers?: {
    category1?: {
      employeeCount?: number;
      totalGross?: number;
      contributionBase?: number;
    };
    category2?: {
      employeeCount?: number;
      totalGross?: number;
      contributionBase?: number;
    };
    category3?: {
      employeeCount?: number;
      totalGross?: number;
      contributionBase?: number;
    };
  };

  // Contribution schemes (optional - at least retirement should be present)
  contributions?: {
    retirement?: {
      employerAmount?: number;
      employeeAmount?: number;
      rate?: number;
      plafond?: number;
    };
    maternity?: {
      employerAmount?: number;
      rate?: number;
    };
    familyBenefits?: {
      employerAmount?: number;
      rate?: number;
    };
    workAccidents?: {
      employerAmount?: number;
      rate?: number;
    };
    cmu?: {
      employerAmount?: number;
      employeeAmount?: number;
      rate?: number;
    };
  };

  // Total amounts (required)
  totalEmployerContributions?: number;
  totalEmployeeContributions?: number;
  totalContributions?: number;
  totalEmployeeCount?: number;
  totalGrossSalary?: number;

  // Status tracking
  declarationStatus?: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedDate?: string; // ISO date string
  approvedDate?: string; // ISO date string

  // Amendments/corrections
  isAmendment?: boolean;
  amendmentReason?: string;
  originalDeclarationPeriod?: string; // If this is a correction

  // Source data (for audit - AI will preserve all original columns)
  sourceData?: Record<string, any>;

  // Migration tracking (optional - set by coordinator if part of migration)
  migrationId?: string;

  // Edit metadata
  editReason?: string;
  editedBy?: string; // User ID who imported this data
}

export class CNPSDeclarationsImporter implements DataImporter<CNPSDeclarationImportData> {
  /**
   * Validate CNPS declaration data before import
   */
  async validate(
    data: CNPSDeclarationImportData[],
    context: ImportContext
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.declarationPeriod?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Période de déclaration est requise',
            'MISSING_DECLARATION_PERIOD',
            'declarationPeriod'
          )
        );
      } else if (!this.isValidPeriod(row.declarationPeriod)) {
        errors.push(
          createError(
            rowNum,
            `Période de déclaration invalide: ${row.declarationPeriod} (format attendu: YYYY-MM, ex: 2024-03)`,
            'INVALID_DECLARATION_PERIOD',
            'declarationPeriod',
            row.declarationPeriod
          )
        );
      }

      if (!row.countryCode?.trim()) {
        errors.push(
          createError(
            rowNum,
            'Code pays est requis',
            'MISSING_COUNTRY_CODE',
            'countryCode'
          )
        );
      } else if (!this.isValidCountryCode(row.countryCode)) {
        errors.push(
          createError(
            rowNum,
            `Code pays invalide: ${row.countryCode} (attendu: CI, SN, BF, ML, TG, BJ, NE)`,
            'INVALID_COUNTRY_CODE',
            'countryCode',
            row.countryCode
          )
        );
      }

      // Validate at least some employee data is present
      const hasEmployeeData =
        (row.dailyWorkers?.category1?.employeeCount ?? 0) > 0 ||
        (row.dailyWorkers?.category2?.employeeCount ?? 0) > 0 ||
        (row.monthlyWorkers?.category1?.employeeCount ?? 0) > 0 ||
        (row.monthlyWorkers?.category2?.employeeCount ?? 0) > 0 ||
        (row.monthlyWorkers?.category3?.employeeCount ?? 0) > 0 ||
        (row.totalEmployeeCount ?? 0) > 0;

      if (!hasEmployeeData) {
        warnings.push(
          createWarning(
            rowNum,
            'Aucune donnée employé trouvée. Assurez-vous que les effectifs sont corrects.',
            'NO_EMPLOYEE_DATA',
            'totalEmployeeCount'
          )
        );
      }

      // Validate at least retirement contribution is present
      const hasContributionData =
        (row.contributions?.retirement?.employerAmount ?? 0) > 0 ||
        (row.contributions?.retirement?.employeeAmount ?? 0) > 0 ||
        (row.totalEmployerContributions ?? 0) > 0 ||
        (row.totalEmployeeContributions ?? 0) > 0;

      if (!hasContributionData) {
        warnings.push(
          createWarning(
            rowNum,
            'Aucune donnée de cotisation trouvée. Assurez-vous que les montants sont corrects.',
            'NO_CONTRIBUTION_DATA',
            'totalContributions'
          )
        );
      }

      // Validate contribution amounts if present
      if (
        row.contributions?.retirement?.employerAmount !== undefined &&
        row.contributions.retirement.employerAmount < 0
      ) {
        errors.push(
          createError(
            rowNum,
            `Montant employeur retraite invalide: ${row.contributions.retirement.employerAmount}`,
            'INVALID_RETIREMENT_EMPLOYER_AMOUNT',
            'contributions.retirement.employerAmount',
            row.contributions.retirement.employerAmount
          )
        );
      }

      if (
        row.contributions?.retirement?.employeeAmount !== undefined &&
        row.contributions.retirement.employeeAmount < 0
      ) {
        errors.push(
          createError(
            rowNum,
            `Montant employé retraite invalide: ${row.contributions.retirement.employeeAmount}`,
            'INVALID_RETIREMENT_EMPLOYEE_AMOUNT',
            'contributions.retirement.employeeAmount',
            row.contributions.retirement.employeeAmount
          )
        );
      }

      // Validate total amounts if present
      if (
        row.totalEmployerContributions !== undefined &&
        row.totalEmployerContributions < 0
      ) {
        errors.push(
          createError(
            rowNum,
            `Total cotisations employeur invalide: ${row.totalEmployerContributions}`,
            'INVALID_TOTAL_EMPLOYER_CONTRIBUTIONS',
            'totalEmployerContributions',
            row.totalEmployerContributions
          )
        );
      }

      if (
        row.totalEmployeeContributions !== undefined &&
        row.totalEmployeeContributions < 0
      ) {
        errors.push(
          createError(
            rowNum,
            `Total cotisations employé invalide: ${row.totalEmployeeContributions}`,
            'INVALID_TOTAL_EMPLOYEE_CONTRIBUTIONS',
            'totalEmployeeContributions',
            row.totalEmployeeContributions
          )
        );
      }

      // Validate employee count if present
      if (row.totalEmployeeCount !== undefined && row.totalEmployeeCount < 0) {
        errors.push(
          createError(
            rowNum,
            `Nombre total d'employés invalide: ${row.totalEmployeeCount}`,
            'INVALID_TOTAL_EMPLOYEE_COUNT',
            'totalEmployeeCount',
            row.totalEmployeeCount
          )
        );
      }

      // Validate dates if present
      if (row.submittedDate && !this.isValidDate(row.submittedDate)) {
        errors.push(
          createError(
            rowNum,
            `Date de soumission invalide: ${row.submittedDate}`,
            'INVALID_SUBMITTED_DATE',
            'submittedDate',
            row.submittedDate
          )
        );
      }

      if (row.approvedDate && !this.isValidDate(row.approvedDate)) {
        errors.push(
          createError(
            rowNum,
            `Date d'approbation invalide: ${row.approvedDate}`,
            'INVALID_APPROVED_DATE',
            'approvedDate',
            row.approvedDate
          )
        );
      }

      // Validate amendment fields
      if (row.isAmendment) {
        if (!row.amendmentReason?.trim()) {
          warnings.push(
            createWarning(
              rowNum,
              'Raison de l\'amendement manquante pour une déclaration rectificative',
              'MISSING_AMENDMENT_REASON',
              'amendmentReason'
            )
          );
        }

        if (row.originalDeclarationPeriod && !this.isValidPeriod(row.originalDeclarationPeriod)) {
          errors.push(
            createError(
              rowNum,
              `Période de déclaration originale invalide: ${row.originalDeclarationPeriod}`,
              'INVALID_ORIGINAL_PERIOD',
              'originalDeclarationPeriod',
              row.originalDeclarationPeriod
            )
          );
        }
      }
    }

    // Check for duplicate entries (same period + country)
    const entries = data.map((row) => `${row.declarationPeriod}-${row.countryCode}`);
    const duplicates = entries.filter((entry, index) => entries.indexOf(entry) !== index);

    if (duplicates.length > 0) {
      const uniqueDuplicates = [...new Set(duplicates)];
      for (const dup of uniqueDuplicates) {
        const [period, country] = dup.split('-');
        const indices = data
          .map((row, idx) =>
            row.declarationPeriod === period && row.countryCode === country ? idx + 1 : -1
          )
          .filter((idx) => idx > 0);
        errors.push(
          createError(
            indices[0],
            `Doublon détecté pour période ${period} pays ${country} (lignes ${indices.join(', ')})`,
            'DUPLICATE_CNPS_DECLARATION',
            'declarationPeriod',
            dup
          )
        );
      }
    }

    // Check for existing declarations in database (if not dry run)
    if (!context.dryRun) {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 1;

        if (!row.declarationPeriod || !row.countryCode) continue;

        const [year, month] = row.declarationPeriod.split('-').map(Number);

        const existingDeclarations = await db
          .select()
          .from(cnpsDeclarationEdits)
          .where(
            and(
              eq(cnpsDeclarationEdits.tenantId, context.tenantId),
              eq(cnpsDeclarationEdits.month, month),
              eq(cnpsDeclarationEdits.year, year),
              eq(cnpsDeclarationEdits.countryCode, row.countryCode)
            )
          )
          .limit(1);

        if (existingDeclarations.length > 0) {
          warnings.push(
            createWarning(
              rowNum,
              `Déclaration CNPS existe déjà pour ${row.declarationPeriod} (${row.countryCode}). ${row.isAmendment ? 'Sera ajoutée comme amendement.' : 'Les données seront ajoutées comme nouvelle version si l\'import continue.'}`,
              'CNPS_DECLARATION_EXISTS',
              'declarationPeriod',
              `${row.declarationPeriod}-${row.countryCode}`
            )
          );
        }
      }
    }

    return errors;
  }

  /**
   * Import CNPS declaration data into database
   */
  async import(
    data: CNPSDeclarationImportData[],
    context: ImportContext
  ): Promise<ImportResult> {
    // Step 1: Validate data
    const validationErrors = await this.validate(data, context);
    if (validationErrors.length > 0) {
      return createFailureResult(validationErrors);
    }

    // Step 2: Transform data to match schema
    const declarationRecords = data.map((row) => {
      const [year, month] = row.declarationPeriod!.trim().split('-').map(Number);

      // Build originalData object (complete declaration structure)
      const originalData = {
        // Company information
        companyName: row.companyName || '',
        companyCNPS: row.companyCNPS || null,
        companyAddress: row.companyAddress || null,
        companyPhone: row.companyPhone || null,
        countryCode: row.countryCode!.trim(),

        // Period information
        month,
        year,
        periodStart: new Date(year, month - 1, 1),
        periodEnd: new Date(year, month, 0),

        // Aggregate statistics
        totalEmployeeCount: row.totalEmployeeCount || 0,
        totalGrossSalary: row.totalGrossSalary || 0,
        totalContributionBase: 0, // Will be calculated if needed

        // Employee categorization
        dailyWorkers: {
          category1: {
            category: 'Catégorie 1 (≤ 3,231 F/jour)',
            employeeCount: row.dailyWorkers?.category1?.employeeCount || 0,
            totalGross: row.dailyWorkers?.category1?.totalGross || 0,
            contributionBase: row.dailyWorkers?.category1?.contributionBase || 0,
          },
          category2: {
            category: 'Catégorie 2 (> 3,231 F/jour)',
            employeeCount: row.dailyWorkers?.category2?.employeeCount || 0,
            totalGross: row.dailyWorkers?.category2?.totalGross || 0,
            contributionBase: row.dailyWorkers?.category2?.contributionBase || 0,
          },
          total: {
            category: 'Total Journaliers',
            employeeCount:
              (row.dailyWorkers?.category1?.employeeCount || 0) +
              (row.dailyWorkers?.category2?.employeeCount || 0),
            totalGross:
              (row.dailyWorkers?.category1?.totalGross || 0) +
              (row.dailyWorkers?.category2?.totalGross || 0),
            contributionBase:
              (row.dailyWorkers?.category1?.contributionBase || 0) +
              (row.dailyWorkers?.category2?.contributionBase || 0),
          },
        },
        monthlyWorkers: {
          category1: {
            category: 'Catégorie 1 (< 70,000 F/mois)',
            employeeCount: row.monthlyWorkers?.category1?.employeeCount || 0,
            totalGross: row.monthlyWorkers?.category1?.totalGross || 0,
            contributionBase: row.monthlyWorkers?.category1?.contributionBase || 0,
          },
          category2: {
            category: 'Catégorie 2 (70,000 - 1,647,315 F/mois)',
            employeeCount: row.monthlyWorkers?.category2?.employeeCount || 0,
            totalGross: row.monthlyWorkers?.category2?.totalGross || 0,
            contributionBase: row.monthlyWorkers?.category2?.contributionBase || 0,
          },
          category3: {
            category: 'Catégorie 3 (> 1,647,315 F/mois)',
            employeeCount: row.monthlyWorkers?.category3?.employeeCount || 0,
            totalGross: row.monthlyWorkers?.category3?.totalGross || 0,
            contributionBase: row.monthlyWorkers?.category3?.contributionBase || 0,
          },
          total: {
            category: 'Total Mensuels',
            employeeCount:
              (row.monthlyWorkers?.category1?.employeeCount || 0) +
              (row.monthlyWorkers?.category2?.employeeCount || 0) +
              (row.monthlyWorkers?.category3?.employeeCount || 0),
            totalGross:
              (row.monthlyWorkers?.category1?.totalGross || 0) +
              (row.monthlyWorkers?.category2?.totalGross || 0) +
              (row.monthlyWorkers?.category3?.totalGross || 0),
            contributionBase:
              (row.monthlyWorkers?.category1?.contributionBase || 0) +
              (row.monthlyWorkers?.category2?.contributionBase || 0) +
              (row.monthlyWorkers?.category3?.contributionBase || 0),
          },
        },

        // Contribution schemes
        contributions: {
          retirement: {
            code: 'pension',
            name: 'Régime de Retraite',
            rate: row.contributions?.retirement?.rate || 0,
            plafond: row.contributions?.retirement?.plafond || null,
            employerAmount: row.contributions?.retirement?.employerAmount || 0,
            employeeAmount: row.contributions?.retirement?.employeeAmount || 0,
            totalAmount:
              (row.contributions?.retirement?.employerAmount || 0) +
              (row.contributions?.retirement?.employeeAmount || 0),
          },
          maternity: {
            code: 'maternity',
            name: 'Assurance Maternité',
            rate: row.contributions?.maternity?.rate || 0,
            plafond: null,
            employerAmount: row.contributions?.maternity?.employerAmount || 0,
            employeeAmount: 0,
            totalAmount: row.contributions?.maternity?.employerAmount || 0,
          },
          familyBenefits: {
            code: 'family_benefits',
            name: 'Prestations Familiales',
            rate: row.contributions?.familyBenefits?.rate || 0,
            plafond: null,
            employerAmount: row.contributions?.familyBenefits?.employerAmount || 0,
            employeeAmount: 0,
            totalAmount: row.contributions?.familyBenefits?.employerAmount || 0,
          },
          workAccidents: {
            code: 'work_accidents',
            name: 'Accidents du Travail',
            rate: row.contributions?.workAccidents?.rate || 0,
            plafond: null,
            employerAmount: row.contributions?.workAccidents?.employerAmount || 0,
            employeeAmount: 0,
            totalAmount: row.contributions?.workAccidents?.employerAmount || 0,
          },
          ...(row.contributions?.cmu && {
            cmu: {
              code: 'cmu',
              name: 'Couverture Maladie Universelle',
              rate: row.contributions.cmu.rate || 0,
              plafond: null,
              employerAmount: row.contributions.cmu.employerAmount || 0,
              employeeAmount: row.contributions.cmu.employeeAmount || 0,
              totalAmount:
                (row.contributions.cmu.employerAmount || 0) +
                (row.contributions.cmu.employeeAmount || 0),
            },
          }),
        },

        // Total amounts
        totalEmployerContributions: row.totalEmployerContributions || 0,
        totalEmployeeContributions: row.totalEmployeeContributions || 0,
        totalContributions: row.totalContributions || 0,

        // Metadata
        generatedAt: new Date(),
        payrollRunIds: [], // Historical import - no linked payroll runs

        // Additional metadata from import
        declarationStatus: row.declarationStatus || 'submitted',
        submittedDate: row.submittedDate || null,
        approvedDate: row.approvedDate || null,
        isAmendment: row.isAmendment || false,
        amendmentReason: row.amendmentReason || null,
        originalDeclarationPeriod: row.originalDeclarationPeriod || null,
        sourceData: row.sourceData || {},
      };

      // Build edits object (track what was imported vs calculated)
      const edits = {
        importedData: true,
        importSource: 'AI_IMPORT',
        ...(row.isAmendment && {
          isAmendment: true,
          amendmentReason: row.amendmentReason,
          originalDeclarationPeriod: row.originalDeclarationPeriod,
        }),
        customAdjustments: [
          {
            field: 'complete_declaration',
            reason: row.editReason || 'Données historiques importées depuis système externe',
          },
        ],
      };

      return {
        // Tenant isolation (CRITICAL)
        tenantId: context.tenantId,

        // Declaration identifier
        month,
        year,
        countryCode: row.countryCode!.trim().toUpperCase(),

        // Original data (complete declaration structure)
        originalData,

        // Edits (tracks import metadata)
        edits,

        // Edit metadata
        editReason: row.editReason || 'Import de données historiques',
        editedBy: context.userId || null,
      };
    });

    // Step 3: Dry run check
    if (context.dryRun) {
      return createSuccessResult(0, {
        message: 'Validation réussie (mode test)',
        wouldInsert: declarationRecords.length,
      });
    }

    // Step 4: Batch insert into database
    // Note: We don't delete existing records - CNPS edits table supports multiple versions
    try {
      const recordsInserted = await batchInsert(
        cnpsDeclarationEdits,
        declarationRecords,
        50 // Smaller batch size for JSONB-heavy records
      );

      // Calculate totals for metadata
      const totalEmployerContributions = declarationRecords.reduce(
        (sum, r) => sum + ((r.originalData as any).totalEmployerContributions || 0),
        0
      );
      const totalEmployeeContributions = declarationRecords.reduce(
        (sum, r) => sum + ((r.originalData as any).totalEmployeeContributions || 0),
        0
      );
      const totalEmployees = declarationRecords.reduce(
        (sum, r) => sum + ((r.originalData as any).totalEmployeeCount || 0),
        0
      );

      return createSuccessResult(recordsInserted, {
        totalRecords: recordsInserted,
        periods: [...new Set(declarationRecords.map((r) => `${r.year}-${String(r.month).padStart(2, '0')}`))],
        countries: [...new Set(declarationRecords.map((r) => r.countryCode))],
        totalEmployees: Math.round(totalEmployees),
        totalEmployerContributions: Math.round(totalEmployerContributions),
        totalEmployeeContributions: Math.round(totalEmployeeContributions),
        totalContributions: Math.round(totalEmployerContributions + totalEmployeeContributions),
        amendments: declarationRecords.filter((r) => (r.edits as any).isAmendment).length,
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
   * Helper: Validate declaration period format (YYYY-MM)
   */
  private isValidPeriod(period: string): boolean {
    const periodRegex = /^\d{4}-\d{2}$/;
    if (!periodRegex.test(period)) {
      return false;
    }

    const [year, month] = period.split('-').map(Number);
    return year >= 1900 && year <= 2100 && month >= 1 && month <= 12;
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
   * Helper: Validate country code (West African countries)
   */
  private isValidCountryCode(code: string): boolean {
    const validCodes = ['CI', 'SN', 'BF', 'ML', 'TG', 'BJ', 'NE', 'GN'];
    return validCodes.includes(code.toUpperCase());
  }
}

// Export singleton instance
export const cnpsDeclarationsImporter = new CNPSDeclarationsImporter();
