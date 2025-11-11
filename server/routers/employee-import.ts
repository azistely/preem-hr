/**
 * Employee Import tRPC Router
 *
 * Handles employee import from Excel/CSV files:
 * - Upload file to Supabase Storage
 * - Validate file and return preview
 * - Execute import to create employees
 *
 * This router uses Supabase Storage to handle file uploads (not File objects over HTTP)
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { TRPCError } from '@trpc/server';
import { parseEmployeeFile, detectDuplicates, type ParseError } from '@/lib/employee-import/parser';
import { db } from '@/lib/db';
import { employees, employeeSalaries, positions, assignments } from '@/lib/db/schema';
import { timeOffBalances, timeOffPolicies, benefitPlans, employeeBenefitEnrollments, employmentContracts } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import {
  createPlaceholderDependents,
  normalizeMaritalStatus,
  validateDependentChildrenCount,
} from '@/features/employees/services/auto-dependent-creation.service';

// ============================================================================
// Supabase Storage Client
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKET = 'employee-imports';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map French employment classification to English employment type
 * Template uses: "Temps plein", "Temps partiel", "Occasionnel"
 * Database expects: "full_time", "part_time", "contract"
 */
function mapEmploymentType(frenchValue: string | null | undefined): 'full_time' | 'part_time' | 'contract' {
  if (!frenchValue) return 'full_time';

  const normalized = frenchValue.toLowerCase().trim();

  if (normalized.includes('temps plein') || normalized.includes('plein')) {
    return 'full_time';
  }
  if (normalized.includes('temps partiel') || normalized.includes('partiel')) {
    return 'part_time';
  }
  if (normalized.includes('occasionnel') || normalized.includes('contract')) {
    return 'contract';
  }

  // Default to full_time if unknown
  return 'full_time';
}

/**
 * Map French marital status to English values
 * Template uses: "Célibataire", "Marié(e)", "Divorcé(e)", "Veuf(ve)"
 * Database expects: "single", "married", "divorced", "widowed"
 */
function mapMaritalStatus(frenchValue: string | null | undefined): 'single' | 'married' | 'divorced' | 'widowed' | null {
  if (!frenchValue) return null;

  const normalized = frenchValue.toLowerCase().trim();

  if (normalized.includes('célibataire') || normalized === 'celibataire') {
    return 'single';
  }
  if (normalized.includes('marié') || normalized.includes('marie')) {
    return 'married';
  }
  if (normalized.includes('divorcé') || normalized.includes('divorce')) {
    return 'divorced';
  }
  if (normalized.includes('veuf') || normalized.includes('veuve')) {
    return 'widowed';
  }

  // Default to null if unknown
  return null;
}

/**
 * Safely parse date values from Excel template
 * Returns ISO date string (YYYY-MM-DD) or current date if invalid
 *
 * Supports multiple date formats:
 * - DD/MM/YYYY (European format from Excel)
 * - MM/DD/YYYY (US format)
 * - YYYY-MM-DD (ISO format)
 * - Date objects
 */
function parseDateSafely(dateValue: string | Date | null | undefined, fieldName: string = 'date'): string {
  if (!dateValue) {
    console.log(`[IMPORT] No ${fieldName} provided, using current date`);
    return new Date().toISOString().split('T')[0];
  }

  // If it's already a Date object
  if (dateValue instanceof Date) {
    const isoDate = dateValue.toISOString().split('T')[0];
    console.log(`[IMPORT] Parsed ${fieldName}: Date object -> "${isoDate}"`);
    return isoDate;
  }

  const dateStr = String(dateValue).trim();

  // Try to parse DD/MM/YYYY format (European/French format)
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [first, second, third] = parts;

      // Try DD/MM/YYYY first (European format)
      if (parseInt(first) <= 31 && parseInt(second) <= 12) {
        const isoDate = `${third.padStart(4, '0')}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
        const testDate = new Date(isoDate);
        if (!isNaN(testDate.getTime())) {
          console.log(`[IMPORT] Parsed ${fieldName}: "${dateValue}" (DD/MM/YYYY) -> "${isoDate}"`);
          return isoDate;
        }
      }
    }
  }

  // Try standard Date parsing (handles ISO, MM/DD/YYYY, etc.)
  const parsed = new Date(dateValue);

  // Check if the date is valid
  if (isNaN(parsed.getTime())) {
    console.warn(`[IMPORT] Invalid ${fieldName} value: "${dateValue}" - using current date as fallback`);
    return new Date().toISOString().split('T')[0];
  }

  const isoDate = parsed.toISOString().split('T')[0];
  console.log(`[IMPORT] Parsed ${fieldName}: "${dateValue}" -> "${isoDate}"`);
  return isoDate;
}

/**
 * Safely parse date values that can be null
 * Returns ISO date string (YYYY-MM-DD) or null if invalid/missing
 */
function parseDateSafelyOrNull(dateValue: string | null | undefined, fieldName: string = 'date'): string | null {
  if (!dateValue) {
    return null;
  }

  const parsed = new Date(dateValue);

  if (isNaN(parsed.getTime())) {
    console.warn(`[IMPORT] Invalid ${fieldName} value: "${dateValue}" - returning null`);
    return null;
  }

  const isoDate = parsed.toISOString().split('T')[0];
  console.log(`[IMPORT] Parsed ${fieldName}: "${dateValue}" -> "${isoDate}"`);
  return isoDate;
}

// ============================================================================
// Zod Schemas
// ============================================================================

const uploadFileSchema = z.object({
  fileName: z.string().min(1, 'Nom de fichier requis'),
  fileData: z.string(), // Base64 encoded file data
  fileType: z.string(),
});

const validateFileSchema = z.object({
  fileId: z.string().min(1, 'ID de fichier requis'),
});

const executeImportSchema = z.object({
  fileId: z.string().min(1, 'ID de fichier requis'),
  skipErrors: z.boolean().default(false), // Skip rows with errors, import only valid rows
});

// ============================================================================
// Router
// ============================================================================

export const employeeImportRouter = createTRPCRouter({
  /**
   * Upload file to Supabase Storage
   * Returns file ID for validation
   */
  uploadFile: protectedProcedure
    .input(uploadFileSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.user.tenantId;
        const userId = ctx.user.id;

        // Validate file extension
        const validExtensions = ['.csv', '.xlsx', '.xls'];
        const extension = input.fileName.split('.').pop()?.toLowerCase();
        if (!extension || !validExtensions.includes(`.${extension}`)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Format de fichier invalide. Utilisez .xlsx ou .csv',
          });
        }

        // Decode base64 file data
        const fileBuffer = Buffer.from(input.fileData, 'base64');

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (fileBuffer.length > maxSize) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Fichier trop volumineux (max 10 MB)',
          });
        }

        // Generate unique file ID
        const fileId = `${tenantId}/${userId}/${Date.now()}-${input.fileName}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileId, fileBuffer, {
            contentType: input.fileType,
            upsert: false,
          });

        if (error) {
          console.error('Supabase upload error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur lors du téléchargement du fichier',
          });
        }

        return {
          fileId,
          fileName: input.fileName,
          uploadedAt: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Upload error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors du téléchargement du fichier',
        });
      }
    }),

  /**
   * Validate uploaded file
   * Returns validation results and preview data
   */
  validateFile: protectedProcedure
    .input(validateFileSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.user.tenantId;

        // Verify file belongs to this tenant (security check)
        if (!input.fileId.startsWith(tenantId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Accès non autorisé à ce fichier',
          });
        }

        // Download file from Supabase Storage
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .download(input.fileId);

        if (error || !data) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Fichier introuvable',
          });
        }

        // Convert Blob to Buffer
        const arrayBuffer = await data.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        // Extract fileName from fileId
        const fileName = input.fileId.split('/').pop() || 'file.xlsx';

        // Parse file
        const parseResult = await parseEmployeeFile(fileBuffer, fileName);

        // Check for duplicate employee numbers
        const duplicateErrors = detectDuplicates(parseResult.rows);
        const allErrors = [...parseResult.errors, ...duplicateErrors];

        // Check for duplicate employee numbers in existing database
        const existingDuplicates = await checkExistingEmployeeNumbers(
          tenantId,
          parseResult.rows.map(r => r.employeeNumber).filter(Boolean)
        );

        const allWarnings = [...parseResult.warnings];

        // Add warnings for employee numbers that already exist in DB
        for (const existing of existingDuplicates) {
          const rowIndex = parseResult.rows.findIndex(
            r => r.employeeNumber === existing.employeeNumber
          );
          if (rowIndex >= 0) {
            allErrors.push({
              row: rowIndex + 1,
              field: 'Matricule',
              message: `Matricule déjà existant: ${existing.employeeNumber} (${existing.firstName} ${existing.lastName})`,
              severity: 'error',
            });
          }
        }

        // Get preview rows (first 10 valid rows)
        const previewRows = parseResult.rows.slice(0, 10).map((row, index) => ({
          ...row,
          _rowIndex: index + 1,
          _hasErrors: allErrors.some(e => e.row === index + 1),
          _errors: allErrors.filter(e => e.row === index + 1).map(e => e.message),
        }));

        const validRows = parseResult.rows.filter((_, i) => {
          const rowIndex = i + 1;
          return !allErrors.some(e => e.row === rowIndex);
        }).length;

        return {
          success: allErrors.length === 0,
          totalRows: parseResult.totalRows,
          validRows,
          invalidRows: parseResult.totalRows - validRows,
          errors: allErrors,
          warnings: allWarnings,
          preview: previewRows,
          fieldMapping: parseResult.fieldMapping,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Validation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la validation du fichier',
        });
      }
    }),

  /**
   * Execute import
   * Creates employees in database
   */
  executeImport: protectedProcedure
    .input(executeImportSchema)
    .mutation(async ({ ctx, input }) => {
      console.log('[IMPORT START] ==========================================');
      console.log('[IMPORT] Input:', JSON.stringify(input, null, 2));
      console.log('[IMPORT] User:', { id: ctx.user.id, tenantId: ctx.user.tenantId, role: ctx.user.role });

      try {
        const tenantId = ctx.user.tenantId;
        const userId = ctx.user.id;

        // Verify file belongs to this tenant (security check)
        console.log('[IMPORT] Security check - fileId:', input.fileId, 'tenantId:', tenantId, 'starts with?:', input.fileId.startsWith(tenantId));
        if (!input.fileId.startsWith(tenantId)) {
          console.error('[IMPORT] SECURITY CHECK FAILED - fileId does not start with tenantId');
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Accès non autorisé à ce fichier',
          });
        }
        console.log('[IMPORT] Security check passed');

        // Download file from Supabase Storage
        console.log('[IMPORT] Downloading file from Supabase Storage...');
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .download(input.fileId);

        if (error || !data) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Fichier introuvable',
          });
        }

        // Convert Blob to Buffer
        const arrayBuffer = await data.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        // Extract fileName from fileId
        const fileName = input.fileId.split('/').pop() || 'file.xlsx';

        // Parse file
        const parseResult = await parseEmployeeFile(fileBuffer, fileName);

        // Check for duplicates
        const duplicateErrors = detectDuplicates(parseResult.rows);
        const allErrors = [...parseResult.errors, ...duplicateErrors];

        // Check existing employee numbers
        const existingDuplicates = await checkExistingEmployeeNumbers(
          tenantId,
          parseResult.rows.map(r => r.employeeNumber).filter(Boolean)
        );

        for (const existing of existingDuplicates) {
          const rowIndex = parseResult.rows.findIndex(
            r => r.employeeNumber === existing.employeeNumber
          );
          if (rowIndex >= 0) {
            allErrors.push({
              row: rowIndex + 1,
              field: 'Matricule',
              message: `Matricule déjà existant: ${existing.employeeNumber}`,
              severity: 'error',
            });
          }
        }

        // Filter out rows with errors (if skipErrors is true)
        let rowsToImport = parseResult.rows;
        if (input.skipErrors) {
          rowsToImport = parseResult.rows.filter((_, i) => {
            const rowIndex = i + 1;
            return !allErrors.some(e => e.row === rowIndex);
          });
        } else if (allErrors.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${allErrors.length} erreur(s) trouvée(s). Corrigez les erreurs ou utilisez "Importer uniquement les lignes valides"`,
          });
        }

        if (rowsToImport.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Aucune ligne valide à importer',
          });
        }

        // Resolve manager references (matricule → ID)
        await resolveManagerReferences(tenantId, rowsToImport);

        // Import employees in transaction
        console.log('[IMPORT] Starting transaction to import', rowsToImport.length, 'employees');
        const importedEmployees = await db.transaction(async (tx) => {
          const created: typeof employees.$inferInsert[] = [];

          for (let i = 0; i < rowsToImport.length; i++) {
            const row = rowsToImport[i];
            console.log(`[IMPORT] Processing employee ${i + 1}/${rowsToImport.length}: ${row.firstName} ${row.lastName} (${row.employeeNumber})`);

            // Create or find position if job title is provided
            let positionId: string | null = null;
            if (row.jobTitle) {
              // Try to find existing position with same title
              const existingPosition = await tx.query.positions.findFirst({
                where: and(
                  eq(positions.tenantId, tenantId),
                  eq(positions.title, row.jobTitle)
                ),
              });

              if (existingPosition) {
                positionId = existingPosition.id;
              } else {
                // Create new position
                const [newPosition] = await tx.insert(positions).values({
                  tenantId,
                  title: row.jobTitle,
                  description: row.profession || null, // "Métier" (profession/trade) as description
                  employmentType: mapEmploymentType(row.employmentClassification),
                  status: 'active',
                  headcount: 1,
                  effectiveFrom: parseDateSafely(row.hireDate, 'hireDate (position effectiveFrom)'),
                  createdBy: userId,
                }).returning();
                positionId = newPosition.id;
              }
            }

            // Build employee object (WITHOUT positionId - we'll use assignments table)
            const employeeData: typeof employees.$inferInsert = {
              tenantId,
              employeeNumber: row.employeeNumber,
              firstName: row.firstName,
              lastName: row.lastName,
              preferredName: row.preferredName || null,
              email: row.email || `${row.employeeNumber}@temp.preem.hr`, // Temp email if not provided
              phone: row.phone,
              dateOfBirth: parseDateSafelyOrNull(row.dateOfBirth, 'dateOfBirth'),
              gender: row.gender || null,
              nationality: row.nationality || null,
              placeOfBirth: row.placeOfBirth || null,
              nationalityZone: row.nationalityZone || null,
              employeeType: row.employeeType || null,
              fatherName: row.fatherName || null,
              motherName: row.motherName || null,
              emergencyContactName: row.emergencyContactName || null,
              emergencyContactPhone: row.emergencyContactPhone || null,
              nationalId: row.nationalId || null,
              addressLine1: row.addressLine1 || null,
              maritalStatus: mapMaritalStatus(row.maritalStatus) || 'single',
              dependentChildren: row.dependentChildren || 0,
              fiscalParts: row.fiscalParts || null,
              hireDate: parseDateSafely(row.hireDate, 'hireDate (employee)'),
              terminationDate: parseDateSafelyOrNull(row.terminationDate, 'terminationDate'),
              terminationReason: row.terminationReason || null,
              contractType: row.contractType || null,
              jobTitle: row.jobTitle || null,
              profession: row.profession || null,
              qualification: row.qualification || null,
              employmentClassification: row.employmentClassification || null,
              salaryRegime: row.salaryRegime || null,
              establishment: row.establishment || null,
              division: row.division || null,
              service: row.service || null,
              section: row.section || null,
              workSite: row.workSite || null,
              reportingManagerId: row.reportingManagerId || null,
              cnpsNumber: row.cnpsNumber || null,
              cmuNumber: row.cmuNumber || null,
              bankName: row.bankName || null,
              bankAccount: row.bankAccount || null,
              categoryCode: row.categoryCode || null,
              categoricalSalary: row.categoricalSalary || null,
              salaryPremium: row.salaryPremium || null,
              initialLeaveBalance: row.initialLeaveBalance || null,
              paymentFrequency: row.paymentFrequency || 'MONTHLY', // NEW: Payment frequency from import
              countryCode: 'CI', // Default to Côte d'Ivoire
              status: 'active',
              createdBy: userId,
              updatedBy: userId,
            };

            const [employee] = await tx.insert(employees).values(employeeData).returning();
            created.push(employee);

            // ===================================================================
            // Auto-create placeholder dependents (spouse + children)
            // ===================================================================
            const normalizedMaritalStatus = normalizeMaritalStatus(row.maritalStatus);
            const validatedChildrenCount = validateDependentChildrenCount(
              row.dependentChildren?.toString()
            );

            if (normalizedMaritalStatus && validatedChildrenCount !== null) {
              console.log(
                `[IMPORT] Creating placeholder dependents for ${employee.employeeNumber}: ` +
                `maritalStatus=${normalizedMaritalStatus}, children=${validatedChildrenCount}`
              );

              await createPlaceholderDependents({
                employeeId: employee.id,
                tenantId,
                maritalStatus: normalizedMaritalStatus,
                dependentChildrenCount: validatedChildrenCount,
              });
            }

            // ===================================================================
            // Create employment contract record (NORMALIZED ARCHITECTURE)
            // ===================================================================
            console.log(`[IMPORT] Creating employment contract for ${employee.employeeNumber}`);

            const contractType = row.contractType || 'CDI';
            const contractData: typeof employmentContracts.$inferInsert = {
              tenantId,
              employeeId: employee.id,
              contractType: contractType,
              contractNumber: `${row.employeeNumber}-001`, // Auto-generate contract number
              startDate: parseDateSafely(row.hireDate, 'hireDate (contract start)'),
              endDate: null, // Will set below for CDD/INTERIM/STAGE
              renewalCount: 0,
              isActive: true,
              signedDate: parseDateSafely(row.hireDate, 'hireDate (contract signed)'),
              notes: `Imported from ${input.fileId.split('/').pop()}`,
              createdBy: userId,
            };

            // Set end date for fixed-term contracts
            if (['CDD', 'INTERIM', 'STAGE'].includes(contractType)) {
              if (row.terminationDate) {
                contractData.endDate = parseDateSafelyOrNull(row.terminationDate, 'terminationDate (contract end)');
              } else {
                // Default to 12 months from hire date if not provided
                const hireDate = new Date(parseDateSafely(row.hireDate, 'hireDate'));
                hireDate.setFullYear(hireDate.getFullYear() + 1);
                contractData.endDate = hireDate.toISOString().split('T')[0];
                console.warn(`[IMPORT] ${contractType} contract missing end date - using hire_date + 12 months: ${contractData.endDate}`);
              }
            }

            // Set CDD reason if applicable
            if (contractType === 'CDD') {
              contractData.cddReason = row.cddReason || 'Imported from legacy system - reason not specified';
            }

            // Set CDDTI task description if applicable (required by DB constraint)
            if (contractType === 'CDDTI') {
              // Use employee's job details (Fonction + Métier) as task description
              const jobDetails = [
                row.jobTitle && `Fonction: ${row.jobTitle}`,
                row.profession && `Métier: ${row.profession}`,
                row.establishment && `Établissement: ${row.establishment}`,
                row.service && `Service: ${row.service}`,
              ].filter(Boolean).join(' | ');

              contractData.cddtiTaskDescription = row.cddtiTaskDescription || jobDetails || 'Tâche non spécifiée - voir fonction et métier de l\'employé';
            }

            const [contract] = await tx.insert(employmentContracts).values(contractData).returning();
            console.log(`[IMPORT] Created contract ${contract.id} for employee ${employee.employeeNumber}`);

            // Update employee with current_contract_id FK
            await tx.update(employees)
              .set({ currentContractId: contract.id })
              .where(eq(employees.id, employee.id));

            console.log(`[IMPORT] Set current_contract_id for employee ${employee.employeeNumber}`);

            // Create assignment record if position was created/found
            if (positionId) {
              const assignmentData = {
                tenantId,
                employeeId: employee.id,
                positionId: positionId,
                assignmentType: 'primary' as const,
                effectiveFrom: parseDateSafely(row.hireDate, 'hireDate (assignment effectiveFrom)'),
                assignmentReason: 'hire' as const, // Valid values: 'hire', 'promotion', 'transfer', 'demotion', 'other', or NULL
                createdBy: userId,
              };
              console.log('[DEBUG] Assignment data:', JSON.stringify(assignmentData, null, 2));
              await tx.insert(assignments).values(assignmentData);
            }

            // Create benefit enrollment if health coverage provided
            if (row.healthCoverage && row.healthCoverage.trim().toLowerCase() !== 'aucune') {
              const coverageType = row.healthCoverage.trim();
              const normalized = coverageType.toLowerCase();

              // Determine plan details based on coverage type
              let planName: string;
              let planCode: string;
              let providerName: string | null = null;

              if (normalized === 'cmu') {
                planName = 'CMU - Couverture Maladie Universelle';
                planCode = 'CMU-001';
                providerName = 'État de Côte d\'Ivoire';
              } else if (normalized === 'assurance privée' || normalized === 'assurance privee') {
                planName = 'Assurance Santé Privée';
                planCode = 'PRIV-001';
              } else {
                // Specific provider name (e.g., "NSIA Assurances", "SAHAM Assurance")
                planName = coverageType;
                planCode = `HEALTH-${coverageType.substring(0, 3).toUpperCase()}`;
                providerName = coverageType;
              }

              // Try to find existing benefit plan
              const existingPlan = await tx.query.benefitPlans.findFirst({
                where: and(
                  eq(benefitPlans.tenantId, tenantId),
                  eq(benefitPlans.planName, planName)
                ),
              });

              let benefitPlanId: string;

              if (existingPlan) {
                benefitPlanId = existingPlan.id;
              } else {
                // Create new benefit plan
                const [newPlan] = await tx.insert(benefitPlans).values({
                  tenantId,
                  planName,
                  planCode,
                  benefitType: 'health',
                  providerName,
                  isActive: true,
                  effectiveFrom: parseDateSafely(row.hireDate, 'hireDate (benefit plan effectiveFrom)'),
                  createdBy: userId,
                }).returning();
                benefitPlanId = newPlan.id;
              }

              // Create enrollment
              const enrollmentDate = parseDateSafely(row.hireDate, 'hireDate (enrollment date)');
              const effectiveDate = row.healthCoverageStartDate
                ? parseDateSafely(row.healthCoverageStartDate, 'healthCoverageStartDate')
                : enrollmentDate;

              await tx.insert(employeeBenefitEnrollments).values({
                tenantId,
                employeeId: employee.id,
                benefitPlanId,
                enrollmentDate,
                effectiveDate,
                enrollmentNumber: normalized === 'cmu' ? row.cmuNumber : null,
                enrollmentStatus: 'active',
                createdBy: userId,
              });
            }

            // Create salary record if salary data provided
            if (row.categoricalSalary || row.salaryPremium) {
              const baseSalary = Number(row.categoricalSalary) || 0;
              const premium = Number(row.salaryPremium) || 0;
              const totalSalary = baseSalary + premium;

              // Build salary components array
              const components = [];

              // Base salary component (code '11' for categorical salary)
              if (baseSalary > 0) {
                components.push({
                  code: '11',
                  name: 'Salaire Catégoriel',
                  amount: baseSalary,
                  sourceType: 'import',
                  metadata: { importDate: new Date().toISOString() },
                });
              }

              // Salary premium component (if exists)
              if (premium > 0) {
                components.push({
                  code: '12',
                  name: 'Sursalaire',
                  amount: premium,
                  sourceType: 'import',
                  metadata: { importDate: new Date().toISOString() },
                });
              }

              // Transport allowance component (code '22')
              // Determine minimum based on city (Abidjan: 30k, Bouaké: 24k, Others: 20k)
              const city = row.city?.toLowerCase() || '';
              let cityMinimum = 20000; // Default minimum for other cities

              if (city.includes('abidjan')) {
                cityMinimum = 30000;
              } else if (city.includes('bouaké') || city.includes('bouake')) {
                cityMinimum = 24000;
              }

              // Use imported amount if provided, otherwise use city minimum
              // Note: Companies can pay MORE than the minimum (minimums are legal floors, not ceilings)
              const customTransport = row.transportAllowance ? Number(row.transportAllowance) : null;
              const transportAmount = customTransport && customTransport >= cityMinimum
                ? customTransport
                : cityMinimum;

              components.push({
                code: '22',
                name: 'Prime de transport',
                amount: transportAmount,
                sourceType: 'import',
                metadata: {
                  importDate: new Date().toISOString(),
                  city: row.city || 'Non spécifiée',
                  cityMinimum: cityMinimum,
                  isMinimum: true,
                  legalReference: 'Arrêté du 30 janvier 2020 - Minimums légaux',
                  taxTreatment: {
                    isTaxable: false,
                    exemptionCap: 30000,
                    includeInBrutImposable: false,
                    includeInSalaireCategoriel: false,
                  },
                  socialSecurityTreatment: {
                    includeInCnpsBase: false,
                  },
                },
              });

              // Create salary record
              await tx.insert(employeeSalaries).values({
                tenantId,
                employeeId: employee.id,
                baseSalary: totalSalary.toString(),
                currency: 'XOF',
                payFrequency: (row.paymentFrequency || 'MONTHLY').toLowerCase(), // Use imported payment frequency
                components: components as any, // JSONB array
                effectiveFrom: parseDateSafely(row.hireDate, 'hireDate (salary effectiveFrom)'),
                effectiveTo: parseDateSafelyOrNull(row.terminationDate, 'terminationDate (salary effectiveTo)'),
                changeReason: 'Initial import',
                notes: `Imported from ${input.fileId.split('/').pop()}`,
                createdBy: userId,
              });
            }

            // Create leave balance if initial balance provided
            if (row.initialLeaveBalance && Number(row.initialLeaveBalance) > 0) {
              const leaveBalance = Number(row.initialLeaveBalance);
              const currentYear = new Date().getFullYear();
              const periodStart = `${currentYear}-01-01`;
              const periodEnd = `${currentYear}-12-31`;

              // Find or create default "Congé Annuel" policy
              let annualLeavePolicy = await tx.query.timeOffPolicies.findFirst({
                where: and(
                  eq(timeOffPolicies.tenantId, tenantId),
                  eq(timeOffPolicies.policyType, 'annual_leave')
                ),
              });

              // If no annual leave policy exists, create one
              if (!annualLeavePolicy) {
                const [policy] = await tx.insert(timeOffPolicies).values({
                  tenantId,
                  name: 'Congé Annuel',
                  policyType: 'annual_leave',
                  accrualMethod: 'fixed', // Fixed annual allocation
                  accrualRate: '30', // 30 days per year for West Africa
                  maxBalance: '60', // Max balance
                  requiresApproval: true,
                  advanceNoticeDays: 7,
                  minDaysPerRequest: '0.5',
                  maxDaysPerRequest: '30',
                  blackoutPeriods: [],
                  isPaid: true,
                  effectiveFrom: periodStart,
                  createdBy: userId,
                }).returning();
                annualLeavePolicy = policy;
              }

              // Create leave balance for current year
              await tx.insert(timeOffBalances).values({
                tenantId,
                employeeId: employee.id,
                policyId: annualLeavePolicy.id,
                balance: leaveBalance.toString(),
                used: '0',
                pending: '0',
                periodStart,
                periodEnd,
                metadata: { source: 'import', importDate: new Date().toISOString() },
              });
            }
          }

          return created;
        });

        // Clean up file from storage (optional - comment out if you want to keep files)
        // await supabase.storage.from(STORAGE_BUCKET).remove([input.fileId]);

        return {
          success: true,
          importedCount: importedEmployees.length,
          skippedCount: parseResult.totalRows - rowsToImport.length,
          employees: importedEmployees.map(e => ({
            id: e.id,
            employeeNumber: e.employeeNumber,
            firstName: e.firstName,
            lastName: e.lastName,
          })),
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          console.error('[IMPORT] TRPCError caught:', error);
          throw error;
        }

        console.error('[IMPORT] Unexpected error:', error);
        console.error('[IMPORT] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'importation des employés',
        });
      }
    }),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if employee numbers already exist in database
 */
async function checkExistingEmployeeNumbers(
  tenantId: string,
  employeeNumbers: string[]
): Promise<Array<{ employeeNumber: string; firstName: string; lastName: string }>> {
  if (employeeNumbers.length === 0) return [];

  const existing = await db
    .select({
      employeeNumber: employees.employeeNumber,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(employees)
    .where(eq(employees.tenantId, tenantId));

  const existingNumbers = new Set(existing.map(e => e.employeeNumber.toUpperCase()));

  return employeeNumbers
    .filter(num => existingNumbers.has(num.toUpperCase()))
    .map(num => {
      const match = existing.find(e => e.employeeNumber.toUpperCase() === num.toUpperCase());
      return match || { employeeNumber: num, firstName: '', lastName: '' };
    });
}

/**
 * Resolve manager matricule references to employee IDs
 */
async function resolveManagerReferences(
  tenantId: string,
  rows: Array<Record<string, any>>
): Promise<void> {
  // Collect all manager matricules
  const managerMatricules = rows
    .map(r => r.reportingManagerId)
    .filter((m): m is string => typeof m === 'string' && m.trim() !== '');

  if (managerMatricules.length === 0) return;

  // Fetch existing employees with these matricules
  const managers = await db
    .select({
      id: employees.id,
      employeeNumber: employees.employeeNumber,
    })
    .from(employees)
    .where(eq(employees.tenantId, tenantId));

  // Build lookup map
  const managerMap = new Map<string, string>();
  for (const manager of managers) {
    managerMap.set(manager.employeeNumber.toUpperCase(), manager.id);
  }

  // Resolve references
  for (const row of rows) {
    if (row.reportingManagerId && typeof row.reportingManagerId === 'string') {
      const matricule = row.reportingManagerId.trim().toUpperCase();
      const managerId = managerMap.get(matricule);

      if (managerId) {
        row.reportingManagerId = managerId;
      } else {
        // Manager not found - set to null and it will be ignored
        row.reportingManagerId = null;
      }
    }
  }
}
