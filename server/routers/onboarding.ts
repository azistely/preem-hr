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
import { TRPCError } from '@trpc/server';

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
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
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
      email: z.string().email('Email invalide'),
      phone: z.string().optional(),
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
      email: z.string().email('Email invalide'),
      phone: z.string().optional(),
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
});
