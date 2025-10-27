/**
 * Onboarding tRPC Router
 *
 * API endpoints for questionnaire-based discovery and adaptive onboarding
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import {
  getOnboardingState,
  answerQuestion,
  getPathPreview,
  startOnboarding,
  completeStep,
  completeOnboarding,
  resetQuestionnaire,
  getOnboardingSummary,
  selectCountry,
  setCompanyInfo,
  createFirstEmployee,
  addEmployeeToOnboarding,
  validateEmployeeImport,
  importEmployeesFromCSV,
  getEmployeeImportTemplate,
  createDepartments,
} from '@/features/onboarding/services/onboarding.service';
import {
  setCompanyInfoV2,
  createFirstEmployeeV2,
  createFirstPayrollRun,
  completeOnboardingV2,
} from '@/features/onboarding/services/onboarding-v2.service';
import { TRPCError } from '@trpc/server';
import type { SalaryComponentInstance, ComponentMetadata } from '@/features/employees/types/salary-components';

// Input validation schemas
const answerQuestionSchema = z.object({
  questionId: z.enum([
    'company_size',
    'has_departments',
    'contract_types',
    'compensation',
    'time_tracking',
    'time_off',
    'payroll_frequency',
  ]),
  answer: z.union([
    z.enum(['solo', 'small_team', 'medium', 'large']),
    z.boolean(),
    z.enum(['full_time_only', 'multiple']),
    z.enum(['fixed_salary', 'with_allowances', 'with_commissions', 'full']),
    z.enum(['none', 'basic', 'geofencing', 'overtime']),
    z.enum(['none', 'legal_only', 'custom_policies']),
    z.enum(['monthly', 'bi_weekly']),
  ]),
});

const completeStepSchema = z.object({
  stepId: z.string().min(1),
});

export const onboardingRouter = createTRPCRouter({
  /**
   * Get questionnaire state
   */
  getQuestionnaireState: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const state = await getOnboardingState(ctx.user.tenantId);

        // Count how many questions answered
        const answers = state.questionnaire_answers;
        const answeredCount = Object.keys(answers).length;

        return {
          answers,
          currentQuestionIndex: answeredCount,
          isComplete: state.questionnaire_complete,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Impossible de récupérer l\'état du questionnaire',
        });
      }
    }),

  /**
   * Answer a questionnaire question
   */
  answerQuestion: publicProcedure
    .input(answerQuestionSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const state = await answerQuestion(
          ctx.user.tenantId,
          input.questionId,
          input.answer
        );

        return {
          success: true,
          state,
          questionnaireComplete: state.questionnaire_complete,
          path: state.path,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible d\'enregistrer la réponse',
        });
      }
    }),

  /**
   * Get adaptive path preview
   */
  getPathPreview: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const preview = await getPathPreview(ctx.user.tenantId);

        return preview;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de générer l\'aperçu du parcours',
        });
      }
    }),

  /**
   * Start onboarding (after questionnaire complete)
   */
  startOnboarding: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        const state = await startOnboarding(ctx.user.tenantId);

        return {
          success: true,
          state,
          currentStep: state.current_step,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de démarrer le parcours d\'intégration',
        });
      }
    }),

  /**
   * Get current onboarding state
   */
  getState: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const state = await getOnboardingState(ctx.user.tenantId);

        return state;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Impossible de récupérer l\'état',
        });
      }
    }),

  /**
   * Complete a step
   */
  completeStep: publicProcedure
    .input(completeStepSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const state = await completeStep(ctx.user.tenantId, input.stepId);

        return {
          success: true,
          state,
          nextStep: state.current_step,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de compléter l\'étape',
        });
      }
    }),

  /**
   * Complete onboarding
   */
  complete: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        const state = await completeOnboarding(ctx.user.tenantId);

        return {
          success: true,
          state,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de finaliser l\'intégration',
        });
      }
    }),

  /**
   * Reset questionnaire (allow re-answering)
   */
  resetQuestionnaire: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        const state = await resetQuestionnaire(ctx.user.tenantId);

        return {
          success: true,
          state,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de réinitialiser le questionnaire',
        });
      }
    }),

  /**
   * Get onboarding summary (for completion screen)
   */
  getSummary: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const summary = await getOnboardingSummary(ctx.user.tenantId);

        return summary;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Impossible de récupérer le résumé',
        });
      }
    }),

  /**
   * Select country
   */
  selectCountry: publicProcedure
    .input(z.object({
      countryCode: z.string().length(2),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const tenant = await selectCountry({
          tenantId: ctx.user.tenantId,
          countryCode: input.countryCode,
        });

        return {
          success: true,
          tenant,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de sélectionner le pays',
        });
      }
    }),

  /**
   * Set company information
   */
  setCompanyInfo: publicProcedure
    .input(z.object({
      legalName: z.string().optional(),
      industry: z.string().optional(),
      taxId: z.string().optional(),
      addresses: z.array(z.string()).optional(),
      phone: z.string().optional(),
      email: z.union([z.string().email(), z.literal('')]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const tenant = await setCompanyInfo({
          tenantId: ctx.user.tenantId,
          ...input,
        });

        return {
          success: true,
          tenant,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible d\'enregistrer les informations',
        });
      }
    }),

  /**
   * Create first employee (solo path)
   */
  createFirstEmployee: publicProcedure
    .input(z.object({
      firstName: z.string().min(1, 'Le prénom est requis'),
      lastName: z.string().min(1, 'Le nom est requis'),
      email: z.union([z.string().email(), z.literal('')]).optional(),
      phone: z.string().min(1, 'Le numéro de téléphone est requis'),
      positionTitle: z.string().min(1, 'Le poste est requis'),
      baseSalary: z.number().min(1, 'Le salaire doit être supérieur à 0'),
      hireDate: z.date(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await createFirstEmployee({
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
          ...input,
          email: input.email || '',
        });

        return {
          success: true,
          employee: result.employee,
          position: result.position,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de créer l\'employé',
        });
      }
    }),

  /**
   * Add employee (small team path)
   */
  addEmployee: publicProcedure
    .input(z.object({
      firstName: z.string().min(1, 'Le prénom est requis'),
      lastName: z.string().min(1, 'Le nom est requis'),
      email: z.union([z.string().email(), z.literal('')]).optional(),
      phone: z.string().min(1, 'Le numéro de téléphone est requis'),
      positionTitle: z.string().min(1, 'Le poste est requis'),
      baseSalary: z.number().min(1, 'Le salaire doit être supérieur à 0'),
      hireDate: z.date(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await addEmployeeToOnboarding({
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
          ...input,
          email: input.email || '',
        });

        return {
          success: true,
          employee: result.employee,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible d\'ajouter l\'employé',
        });
      }
    }),

  /**
   * Download employee import template
   */
  downloadEmployeeTemplate: publicProcedure
    .mutation(async () => {
      try {
        const result = getEmployeeImportTemplate();

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Impossible de générer le modèle',
        });
      }
    }),

  /**
   * Validate employee CSV import
   */
  validateEmployeeImport: publicProcedure
    .input(z.object({
      csvContent: z.string().min(1, 'Le contenu CSV est requis'),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = validateEmployeeImport(input.csvContent);

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de valider le fichier',
        });
      }
    }),

  /**
   * Import employees from CSV
   */
  importEmployees: publicProcedure
    .input(z.object({
      csvContent: z.string().min(1, 'Le contenu CSV est requis'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await importEmployeesFromCSV({
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
          csvContent: input.csvContent,
        });

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible d\'importer les employés',
        });
      }
    }),

  /**
   * Create departments
   */
  createDepartments: publicProcedure
    .input(z.object({
      departments: z.array(z.object({
        name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
        description: z.string().optional(),
      })).min(2, 'Au moins 2 départements requis'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await createDepartments({
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
          departments: input.departments,
        });

        return {
          success: true,
          departments: result.departments,
          count: result.count,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de créer les départements',
        });
      }
    }),

  // ========================================
  // V2 ENDPOINTS - Task-First Onboarding
  // ========================================

  /**
   * Set company information with CGECI sector (V2)
   * ✅ OPTIMIZATION: Now includes countryCode to eliminate separate selectCountry call
   * ✅ CGECI INTEGRATION: Accepts cgeciSectorCode and auto-derives genericSectorCode
   */
  setCompanyInfoV2: publicProcedure
    .input(z.object({
      countryCode: z.string().length(2, 'Code pays invalide'),
      legalName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
      industry: z.string().min(2, 'Le type d\'activité est requis'),
      cgeciSectorCode: z.string().min(1, 'Sélectionnez votre secteur d\'activité'),
      taxId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const tenant = await setCompanyInfoV2({
          tenantId: ctx.user.tenantId,
          ...input,
        });

        return {
          success: true,
          tenant,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible d\'enregistrer les informations',
        });
      }
    }),

  /**
   * Create first employee with family status (V2)
   */
  createFirstEmployeeV2: publicProcedure
    .input(z.object({
      firstName: z.string().min(1, 'Le prénom est requis'),
      lastName: z.string().min(1, 'Le nom est requis'),
      email: z.union([z.string().email(), z.literal('')]).optional(),
      phone: z.string().min(1, 'Le numéro de téléphone est requis'),
      positionTitle: z.string().min(1, 'Le poste est requis'),
      // Base salary components (NEW - replaces baseSalary)
      baseComponents: z.record(z.string(), z.number()).optional(),
      // DEPRECATED: baseSalary - kept for backward compatibility
      baseSalary: z.number().min(1, 'Le salaire de base est requis').optional(),
      hireDate: z.date({ required_error: 'La date d\'embauche est requise' }),
      // CRITICAL: Family status
      maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']),
      dependentChildren: z.number().min(0).max(10),
      // NEW: Employment configuration
      contractType: z.enum(['CDI', 'CDD', 'STAGE']),
      contractEndDate: z.date().optional(),
      cddReason: z.enum(['REMPLACEMENT', 'SURCROIT_ACTIVITE', 'SAISONNIER', 'PROJET', 'AUTRE']).optional(),
      // Dynamic category (CGECI: "1B", "2B", etc. or Banking: "A1", "A2", etc.)
      category: z.string().min(1, 'La catégorie professionnelle est requise'),
      departmentId: z.string().optional(),
      primaryLocationId: z.string().optional(),
      rateType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).optional(),
      dailyRate: z.number().optional(),
      hourlyRate: z.number().optional(),
      // NEW: Components array (replaces individual allowance fields)
      components: z.array(z.object({
        code: z.string(),
        name: z.string(),
        amount: z.number(),
        sourceType: z.enum(['standard', 'template']),
      })).optional(),
      // DEPRECATED (kept for backward compatibility)
      transportAllowance: z.number().optional(),
      housingAllowance: z.number().optional(),
      mealAllowance: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await createFirstEmployeeV2({
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
          ...input,
        });

        return {
          success: true,
          employee: result.employee,
          position: result.position,
          payslipPreview: result.payslipPreview,
        };
      } catch (error: any) {
        console.error('[Onboarding] createFirstEmployeeV2 error:', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de créer l\'employé',
        });
      }
    }),

  /**
   * Create first payroll run with frequency (V2)
   */
  createFirstPayrollRun: publicProcedure
    .input(z.object({
      frequency: z.enum(['monthly', 'bi_weekly']),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await createFirstPayrollRun({
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
          frequency: input.frequency,
        });

        return {
          success: true,
          ...result,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de créer la configuration de paie',
        });
      }
    }),

  /**
   * Calculate payslip preview WITHOUT creating employee (V2)
   * Used during onboarding to show preview before confirming
   *
   * ✅ MULTI-COUNTRY: Uses database-driven base salary component structure
   * ✅ PREVIEW MODE: Uses 'preview' employee ID to skip database queries
   */
  calculatePayslipPreview: publicProcedure
    .input(z.object({
      // NEW: Base components as object (e.g., { "11": 75000, "12": 0 } for CI)
      baseComponents: z.record(z.string(), z.number()).optional(),
      // DEPRECATED: baseSalary - kept for backward compatibility
      baseSalary: z.number().min(1, 'Le salaire de base est requis').optional(),
      rateType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).optional(),
      hireDate: z.date(),
      maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']),
      dependentChildren: z.number().min(0).max(10),
      components: z.array(z.object({
        code: z.string(),
        name: z.string(),
        amount: z.number(),
        sourceType: z.enum(['standard', 'template']),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { calculatePayrollV2 } = await import('@/features/payroll/services/payroll-calculation-v2');
        const { buildBaseSalaryComponents, getSalaireCategoriel, calculateBaseSalaryTotal } = await import('@/lib/salary-components/base-salary-loader');
        const { db } = await import('@/lib/db');
        const { tenants } = await import('@/drizzle/schema');
        const { eq } = await import('drizzle-orm');

        // Get tenant info for countryCode and sectorCode
        const [tenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, ctx.user.tenantId))
          .limit(1);

        if (!tenant) {
          throw new Error('Entreprise non trouvée');
        }

        const countryCode = tenant.countryCode || 'CI';

        // Build base salary components from inputs (database-driven)
        let baseSalaryComponentsList: SalaryComponentInstance[];
        let totalBaseSalary = 0;

        if (input.baseComponents) {
          // NEW: Use base components structure
          baseSalaryComponentsList = await buildBaseSalaryComponents(input.baseComponents, countryCode) as SalaryComponentInstance[];
          totalBaseSalary = await calculateBaseSalaryTotal(baseSalaryComponentsList, countryCode);
        } else if (input.baseSalary) {
          // FALLBACK: Use legacy baseSalary (create Code 11 component automatically)
          baseSalaryComponentsList = await buildBaseSalaryComponents(
            { '11': input.baseSalary }, // Map to Code 11 for CI
            countryCode
          ) as SalaryComponentInstance[];
          totalBaseSalary = input.baseSalary;
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Le salaire de base est requis',
          });
        }

        // Get salaireCategoriel (Code 11 for CI, or equivalent for other countries)
        const salaireCategoriel = await getSalaireCategoriel(baseSalaryComponentsList, countryCode);

        // SMIG validation: Check GROSS salary (base + all components) dynamically based on country
        const monthlyMinimumWages: Record<string, number> = {
          CI: 75000,  // Côte d'Ivoire
          SN: 52500,  // Sénégal
          BF: 34664,  // Burkina Faso
          ML: 40000,  // Mali
          BJ: 40000,  // Bénin
          TG: 35000,  // Togo
        };
        const monthlyMinimumWage = monthlyMinimumWages[countryCode] || 75000;

        // Convert minimum wage based on rate type
        const rateType = input.rateType || 'MONTHLY';
        let applicableMinimumWage = monthlyMinimumWage;
        let rateLabel = 'mensuel';

        if (rateType === 'DAILY') {
          applicableMinimumWage = Math.round(monthlyMinimumWage / 30);
          rateLabel = 'journalier';
        } else if (rateType === 'HOURLY') {
          applicableMinimumWage = Math.round(monthlyMinimumWage / (30 * 8));
          rateLabel = 'horaire';
        }

        const componentsTotal = input.components?.reduce((sum, c) => sum + c.amount, 0) || 0;
        const grossSalary = totalBaseSalary + componentsTotal;

        if (grossSalary < applicableMinimumWage) {
          const countryNames: Record<string, string> = {
            CI: 'Côte d\'Ivoire',
            SN: 'Sénégal',
            BF: 'Burkina Faso',
            ML: 'Mali',
            BJ: 'Bénin',
            TG: 'Togo',
          };
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Le salaire brut total ${rateLabel} (salaire de base + indemnités) doit être supérieur ou égal au SMIG de ${countryNames[countryCode] || countryCode} (${applicableMinimumWage.toLocaleString('fr-FR')} FCFA${rateType === 'MONTHLY' ? '' : rateType === 'DAILY' ? '/jour' : '/heure'})`,
          });
        }

        // Calculate fiscal parts
        let fiscalParts = 1.0;
        if (input.maritalStatus === 'married') {
          fiscalParts += 1.0;
        }
        const countedChildren = Math.min(input.dependentChildren, 4);
        fiscalParts += countedChildren * 0.5;

        // Calculate hasFamily flag (for CMU employer contribution)
        const hasFamily = input.maritalStatus === 'married' || input.dependentChildren > 0;

        // Pass user components as otherAllowances (template components like TPT_*, PHONE, etc.)
        const otherAllowances = input.components
          ? input.components.map(c => ({
              code: c.code,
              name: c.name,
              amount: c.amount,
              taxable: true, // All template components are taxable by default
            }))
          : [];

        // Calculate payroll preview for a FULL MONTH (no proration)
        // Use the hire month if it's current/future, otherwise use current month
        // This gives users a realistic view of typical monthly payroll
        const hireDate = input.hireDate;
        const today = new Date();
        const isHireDateInFutureOrCurrent = hireDate >= new Date(today.getFullYear(), today.getMonth(), 1);

        const previewDate = isHireDateInFutureOrCurrent ? hireDate : today;
        const periodStart = new Date(previewDate.getFullYear(), previewDate.getMonth(), 1);
        const periodEnd = new Date(previewDate.getFullYear(), previewDate.getMonth() + 1, 0);

        // Merge all components: base components (with metadata) + template components (from user)
        // Base components already have metadata from buildBaseSalaryComponents()
        // Template components need metadata fetched from database
        const { salaryComponentTemplates } = await import('@/drizzle/schema');
        const { and: andOp } = await import('drizzle-orm');

        // Enrich template components with metadata from database
        const enrichedTemplateComponents = await Promise.all(
          (input.components || []).map(async (comp) => {
            // Fetch template metadata
            const [template] = await db
              .select()
              .from(salaryComponentTemplates)
              .where(
                andOp(
                  eq(salaryComponentTemplates.code, comp.code),
                  eq(salaryComponentTemplates.countryCode, countryCode)
                )
              )
              .limit(1);

            if (template) {
              return {
                code: comp.code,
                name: typeof template.name === 'object' ? (template.name as any).fr || (template.name as any).en || comp.code : String(template.name),
                amount: comp.amount,
                sourceType: 'template' as const,
                metadata: template.metadata as ComponentMetadata | undefined,
              };
            }

            // If template not found, return as-is with defaults (will use safe defaults)
            return {
              code: comp.code,
              name: comp.code, // Use code as fallback name
              amount: comp.amount,
              sourceType: 'custom' as const,
            };
          })
        ) as SalaryComponentInstance[];

        const allComponentsWithMetadata: SalaryComponentInstance[] = [
          ...baseSalaryComponentsList, // These have proper metadata
          ...enrichedTemplateComponents, // Template components now with metadata
        ];

        // DEBUG LOGGING - BEFORE calculatePayrollV2
        console.log('============================================================');
        console.log('[ONBOARDING DEBUG] Input values to calculatePayrollV2:');
        console.log('- totalBaseSalary:', totalBaseSalary);
        console.log('- salaireCategoriel (Code 11):', salaireCategoriel);
        console.log('- allComponents:', JSON.stringify(allComponentsWithMetadata, null, 2));
        console.log('- hasFamily:', hasFamily);
        console.log('- fiscalParts:', fiscalParts);
        console.log('- countryCode:', tenant.countryCode || 'CI');
        console.log('- sectorCode:', tenant.genericSectorCode || tenant.sectorCode || 'SERVICES');
        console.log('- tenantId:', ctx.user.tenantId);
        console.log('============================================================');

        const payrollResult = await calculatePayrollV2({
          employeeId: 'preview', // Dummy ID for preview
          countryCode: tenant.countryCode || 'CI',
          tenantId: ctx.user.tenantId, // Required for template component lookup (TPT_*, etc.)
          periodStart,
          periodEnd,
          // DON'T pass baseSalary here - it's already in customComponents!
          // Passing both causes double-counting (GAP-Q2-001)
          baseSalary: 0, // Explicitly set to 0 to avoid double-counting
          // NEW APPROACH: Pass all components with metadata (not individual parameters)
          // This allows component processor to properly calculate bases using metadata
          customComponents: allComponentsWithMetadata,
          hireDate: periodStart, // Set hire date to period start for full month preview
          fiscalParts: fiscalParts,
          hasFamily: hasFamily, // For CMU employer contribution
          sectorCode: tenant.genericSectorCode || tenant.sectorCode || 'SERVICES',
          isPreview: true, // Use safe defaults for components not yet activated
          // Rate type support (GAP-JOUR-003)
          rateType: input.rateType || 'MONTHLY',
          daysWorkedThisMonth: input.rateType === 'DAILY' ? 30 : undefined, // Full month for preview
          hoursWorkedThisMonth: input.rateType === 'HOURLY' ? 30 * 8 : undefined, // Full month for preview
          // Dynamic CMU calculation (GAP-CMU-001)
          maritalStatus: input.maritalStatus,
          dependentChildren: input.dependentChildren,
        });

        // DEBUG LOGGING - AFTER calculatePayrollV2
        console.log('============================================================');
        console.log('[ONBOARDING DEBUG] Output from calculatePayrollV2:');
        console.log('- grossSalary:', payrollResult.grossSalary);
        console.log('- cnpsEmployee:', payrollResult.cnpsEmployee);
        console.log('- cnpsEmployer:', payrollResult.cnpsEmployer);
        console.log('- cmuEmployee:', payrollResult.cmuEmployee);
        console.log('- cmuEmployer:', payrollResult.cmuEmployer);
        console.log('- its (income tax):', payrollResult.its);
        console.log('- netSalary:', payrollResult.netSalary);
        console.log('- employerCost:', payrollResult.employerCost);
        console.log('- contributionDetails:', JSON.stringify(payrollResult.contributionDetails, null, 2));
        console.log('- otherTaxesDetails:', JSON.stringify(payrollResult.otherTaxesDetails, null, 2));
        console.log('============================================================');

        // Return preview in expected format with detailed breakdowns
        return {
          success: true,
          payslipPreview: {
            grossSalary: payrollResult.grossSalary,
            baseSalary: totalBaseSalary, // Use totalBaseSalary (Code 11 + Code 12) calculated above
            baseComponents: baseSalaryComponentsList, // Include base component breakdown
            components: input.components || [],
            cnpsEmployee: payrollResult.cnpsEmployee,
            cmuEmployee: payrollResult.cmuEmployee || 0,
            incomeTax: payrollResult.its,
            netSalary: payrollResult.netSalary,
            fiscalParts: fiscalParts,
            cnpsEmployer: payrollResult.cnpsEmployer,
            cmuEmployer: payrollResult.cmuEmployer || 0,
            totalEmployerCost: payrollResult.employerCost,
            // Add detailed breakdowns
            deductionsDetails: payrollResult.deductionsDetails || [],
            otherTaxesDetails: payrollResult.otherTaxesDetails || [],
            contributionDetails: payrollResult.contributionDetails || [], // Social security details
          },
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Impossible de calculer la paie',
        });
      }
    }),

  /**
   * Complete onboarding (V2)
   */
  completeOnboardingV2: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        const result = await completeOnboardingV2(ctx.user.tenantId);

        return {
          success: true,
          ...result,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Impossible de terminer l\'onboarding',
        });
      }
    }),
});
