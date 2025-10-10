/**
 * Policies tRPC Router
 *
 * Endpoints for:
 * - Time-off policy management (CRUD with compliance validation)
 * - Overtime rates configuration (multi-country)
 * - Leave accrual rules (age-based, seniority-based)
 * - Policy history (effective-dated audit trail)
 * - Compliance validation
 *
 * Design Principles:
 * - NEVER update existing policy rows → INSERT with effective dating
 * - Validate against Convention Collective minimums
 * - Multi-country support via database-driven rules
 * - All labels in French
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import {
  timeOffPolicies,
} from '@/drizzle/schema';
import { overtimeRates, leaveAccrualRules } from '@/lib/db/schema/policies';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import {
  validatePolicyCompliance,
  validateOvertimeRate,
  validateEffectiveDating,
  getLegalMinimumsForAnnualLeave,
  getOvertimeRateLimits,
  getLeaveAccrualMinimum,
} from '@/features/policies/services/compliance-validator';

// ============================================================================
// Validation Schemas
// ============================================================================

const createPolicySchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  templateId: z.string().uuid().optional(),
  policyType: z.enum(['annual_leave', 'sick_leave', 'maternity', 'paternity', 'unpaid']),
  accrualMethod: z.enum(['fixed', 'accrued_monthly', 'accrued_hourly']),
  accrualRate: z.number().positive('Le taux doit être positif'),
  maxBalance: z.number().positive().optional(),
  requiresApproval: z.boolean().default(true),
  advanceNoticeDays: z.number().int().min(0).default(0),
  minDaysPerRequest: z.number().positive().default(0.5),
  maxDaysPerRequest: z.number().positive().optional(),
  blackoutPeriods: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
        reason: z.string(),
      })
    )
    .optional(),
  isPaid: z.boolean().default(true),
  effectiveFrom: z.date().optional(),
});

const updatePolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  accrualRate: z.number().positive().optional(),
  maxBalance: z.number().positive().optional(),
  requiresApproval: z.boolean().optional(),
  advanceNoticeDays: z.number().int().min(0).optional(),
  blackoutPeriods: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
        reason: z.string(),
      })
    )
    .optional(),
  effectiveFrom: z.date(), // REQUIRED: When does this change take effect?
});

const overtimeRateSchema = z.object({
  countryCode: z.string().length(2),
  periodType: z.enum([
    'weekday_41_48',
    'weekday_48_plus',
    'saturday',
    'sunday',
    'holiday',
    'night',
  ]),
  rateMultiplier: z.number().min(1.0).max(3.0),
  effectiveFrom: z.date().optional(),
});

const accrualRuleSchema = z.object({
  countryCode: z.string().length(2),
  ageThreshold: z.number().positive().optional(),
  seniorityYears: z.number().int().min(0).optional(),
  daysPerMonth: z.number().min(0).max(5.0),
  bonusDays: z.number().int().min(0).default(0),
  effectiveFrom: z.date().optional(),
});

// ============================================================================
// Router
// ============================================================================

export const policiesRouter = createTRPCRouter({
  // ==========================================================================
  // Time-Off Policies
  // ==========================================================================

  /**
   * List all time-off policies for tenant
   */
  listTimeOffPolicies: publicProcedure.query(async ({ ctx }) => {
    return await db.query.timeOffPolicies.findMany({
      where: and(
        eq(timeOffPolicies.tenantId, ctx.user.tenantId),
        isNull(timeOffPolicies.effectiveTo) // Active policies only
      ),
      orderBy: [desc(timeOffPolicies.createdAt)],
    });
  }),

  /**
   * Get single time-off policy with history
   */
  getTimeOffPolicy: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      const policy = await db.query.timeOffPolicies.findFirst({
        where: and(
          eq(timeOffPolicies.id, input),
          eq(timeOffPolicies.tenantId, ctx.user.tenantId)
        ),
      });

      if (!policy) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Politique introuvable',
        });
      }

      return policy;
    }),

  /**
   * Get policy history (all effective-dated versions)
   */
  getPolicyHistory: publicProcedure
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      // Step 1: Get the policy to find its policyType and name
      const policy = await db.query.timeOffPolicies.findFirst({
        where: and(
          eq(timeOffPolicies.id, input),
          eq(timeOffPolicies.tenantId, ctx.user.tenantId)
        ),
      });

      if (!policy) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Politique introuvable',
        });
      }

      // Step 2: Find all versions with same policyType and name (policy lineage)
      const history = await db.query.timeOffPolicies.findMany({
        where: and(
          eq(timeOffPolicies.tenantId, ctx.user.tenantId),
          eq(timeOffPolicies.policyType, policy.policyType),
          eq(timeOffPolicies.name, policy.name)
        ),
        orderBy: [desc(timeOffPolicies.effectiveFrom)],
      });

      return history;
    }),

  /**
   * Create time-off policy from template (with compliance validation)
   */
  createTimeOffPolicy: publicProcedure
    .input(createPolicySchema)
    .mutation(async ({ input, ctx }) => {
      // Step 1: Validate compliance
      const countryCode = 'CI'; // TODO: Get from tenant.countryCode
      const complianceResult = await validatePolicyCompliance(input, countryCode);

      if (!complianceResult.isCompliant) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: complianceResult.violations
            .filter((v) => v.severity === 'critical')
            .map((v) => v.message)
            .join('. '),
          cause: complianceResult,
        });
      }

      // Step 2: Get template (if specified)
      // TODO: Re-enable when template system is implemented
      let template = null;
      // if (input.templateId) {
      //   template = await db.query.timeOffPolicyTemplates.findFirst({
      //     where: eq(timeOffPolicyTemplates.id, input.templateId),
      //   });
      // }

      // Step 3: Create policy
      const [policy] = await db
        .insert(timeOffPolicies)
        .values({
          tenantId: ctx.user.tenantId,
          name: input.name,
          policyType: input.policyType,
          accrualMethod: input.accrualMethod,
          accrualRate: input.accrualRate.toString(),
          maxBalance: input.maxBalance?.toString(),
          requiresApproval: input.requiresApproval,
          advanceNoticeDays: input.advanceNoticeDays,
          minDaysPerRequest: input.minDaysPerRequest.toString(),
          maxDaysPerRequest: input.maxDaysPerRequest?.toString(),
          blackoutPeriods: input.blackoutPeriods as any,
          isPaid: input.isPaid,
          effectiveFrom: (input.effectiveFrom || new Date()).toISOString().split('T')[0],
          effectiveTo: null,
          createdBy: ctx.user.id,
          // Compliance metadata
          templateId: input.templateId || null,
          complianceLevel: complianceResult.complianceLevel,
          legalReference: complianceResult.legalReferences[0] || null,
        } as any)
        .returning();

      return policy;
    }),

  /**
   * Update time-off policy (EFFECTIVE DATING - inserts new row, closes old)
   */
  updateTimeOffPolicy: publicProcedure
    .input(updatePolicySchema)
    .mutation(async ({ input, ctx }) => {
      return await db.transaction(async (tx) => {
        // Step 1: Find current policy
        const currentPolicy = await tx.query.timeOffPolicies.findFirst({
          where: and(
            eq(timeOffPolicies.id, input.id),
            eq(timeOffPolicies.tenantId, ctx.user.tenantId),
            isNull(timeOffPolicies.effectiveTo)
          ),
        });

        if (!currentPolicy) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Politique introuvable ou déjà archivée',
          });
        }

        // Step 2: Validate effective dating
        const effectiveDateErrors = validateEffectiveDating(input.effectiveFrom);
        if (effectiveDateErrors.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: effectiveDateErrors.map((e) => e.message).join('. '),
          });
        }

        // Step 3: Validate compliance for changes
        const countryCode = 'CI'; // TODO: Get from tenant
        const updatedPolicy: any = {
          ...currentPolicy,
          ...input,
          accrualRate: input.accrualRate || parseFloat(currentPolicy.accrualRate || '0'),
        };
        const complianceResult = await validatePolicyCompliance(
          updatedPolicy,
          countryCode
        );

        if (!complianceResult.isCompliant) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: complianceResult.violations
              .filter((v) => v.severity === 'critical')
              .map((v) => v.message)
              .join('. '),
          });
        }

        // Step 4: Close current policy (set effective_to)
        const effectiveToDate = input.effectiveFrom.toISOString().split('T')[0];
        await tx
          .update(timeOffPolicies)
          .set({ effectiveTo: effectiveToDate })
          .where(eq(timeOffPolicies.id, input.id));

        // Step 5: Insert new policy version
        const effectiveFromDate = input.effectiveFrom.toISOString().split('T')[0];
        const now = new Date().toISOString();
        const [newPolicy] = await tx
          .insert(timeOffPolicies)
          .values({
            ...currentPolicy,
            ...input,
            id: undefined, // Generate new ID
            accrualRate: input.accrualRate?.toString() || currentPolicy.accrualRate,
            maxBalance: input.maxBalance?.toString() || currentPolicy.maxBalance,
            effectiveFrom: effectiveFromDate,
            effectiveTo: null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        return newPolicy;
      });
    }),

  // ==========================================================================
  // Policy Templates
  // ==========================================================================

  // TODO: Re-enable when template system is implemented
  // /**
  //  * Get all templates for country
  //  */
  // getTemplates: publicProcedure
  //   .input(
  //     z.object({
  //       countryCode: z.string().length(2).default('CI'),
  //     })
  //   )
  //   .query(async ({ input }) => {
  //     const templates = await db.query.timeOffPolicyTemplates.findMany({
  //       where: and(
  //         eq(timeOffPolicyTemplates.countryCode, input.countryCode),
  //         eq(timeOffPolicyTemplates.isActive, true)
  //       ),
  //       orderBy: [timeOffPolicyTemplates.displayOrder],
  //     });

  //     return templates;
  //   }),

  // /**
  //  * Get template by code
  //  */
  // getTemplate: publicProcedure
  //   .input(
  //     z.object({
  //       countryCode: z.string().length(2),
  //       code: z.string(),
  //     })
  //   )
  //   .query(async ({ input }) => {
  //     const template = await db.query.timeOffPolicyTemplates.findFirst({
  //       where: and(
  //         eq(timeOffPolicyTemplates.countryCode, input.countryCode),
  //         eq(timeOffPolicyTemplates.code, input.code)
  //       ),
  //     });

  //     if (!template) {
  //       throw new TRPCError({
  //         code: 'NOT_FOUND',
  //         message: `Modèle ${input.code} introuvable pour ${input.countryCode}`,
  //       });
  //     }

  //     return template;
  //   }),

  // ==========================================================================
  // Overtime Rates
  // ==========================================================================

  /**
   * Get all overtime rates for country
   */
  getOvertimeRates: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2).default('CI'),
      })
    )
    .query(async ({ input }) => {
      const rates = await db.query.overtimeRates.findMany({
        where: and(
          eq(overtimeRates.countryCode, input.countryCode),
          isNull(overtimeRates.effectiveTo)
        ),
      });

      return rates;
    }),

  /**
   * Update overtime rate (super admin only)
   * Validates against legal minimum
   */
  updateOvertimeRate: publicProcedure
    .input(overtimeRateSchema)
    .mutation(async ({ input, ctx }) => {
      // Validate against legal minimum
      const complianceResult = await validateOvertimeRate(
        input.countryCode,
        input.periodType,
        input.rateMultiplier
      );

      if (!complianceResult.isCompliant) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: complianceResult.violations.map((v) => v.message).join('. '),
        });
      }

      return await db.transaction(async (tx) => {
        // Close existing rate
        const existingRate = await tx.query.overtimeRates.findFirst({
          where: and(
            eq(overtimeRates.countryCode, input.countryCode),
            eq(overtimeRates.periodType, input.periodType),
            isNull(overtimeRates.effectiveTo)
          ),
        });

        if (existingRate) {
          const effectiveFrom = (input.effectiveFrom || new Date()).toISOString().split('T')[0];
          await tx
            .update(overtimeRates)
            .set({ effectiveTo: effectiveFrom })
            .where(eq(overtimeRates.id, existingRate.id));

          // Insert new rate
          const [newRate] = await tx
            .insert(overtimeRates)
            .values({
              ...existingRate,
              id: undefined,
              rateMultiplier: input.rateMultiplier.toString(),
              effectiveFrom,
              effectiveTo: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as any)
            .returning();

          return newRate;
        }

        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Aucun taux trouvé pour ${input.periodType}`,
        });
      });
    }),

  // ==========================================================================
  // Leave Accrual Rules
  // ==========================================================================

  /**
   * Get all leave accrual rules for country
   */
  getAccrualRules: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2).default('CI'),
      })
    )
    .query(async ({ input }) => {
      const rules = await db.query.leaveAccrualRules.findMany({
        where: and(
          eq(leaveAccrualRules.countryCode, input.countryCode),
          isNull(leaveAccrualRules.effectiveTo)
        ),
        orderBy: [desc(leaveAccrualRules.priority)],
      });

      return rules;
    }),

  /**
   * Calculate applicable accrual for employee
   */
  calculateAccrualForEmployee: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2).default('CI'),
        age: z.number().optional(),
        seniorityYears: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const accrual = await getLeaveAccrualMinimum(
        input.countryCode,
        input.age,
        input.seniorityYears
      );

      return accrual;
    }),

  /**
   * Update leave accrual rule (super admin only)
   */
  updateAccrualRule: publicProcedure
    .input(accrualRuleSchema)
    .mutation(async ({ input }) => {
      // Validate at least one trigger is specified
      if (!input.ageThreshold && !input.seniorityYears) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Au moins un déclencheur (âge ou ancienneté) est requis',
        });
      }

      const effectiveFrom = input.effectiveFrom || new Date();

      return await db.transaction(async (tx) => {
        // Find existing rule
        const existingRule = await tx.query.leaveAccrualRules.findFirst({
          where: and(
            eq(leaveAccrualRules.countryCode, input.countryCode),
            input.ageThreshold
              ? eq(leaveAccrualRules.ageThreshold, input.ageThreshold)
              : isNull(leaveAccrualRules.ageThreshold),
            input.seniorityYears
              ? eq(leaveAccrualRules.seniorityYears, input.seniorityYears)
              : isNull(leaveAccrualRules.seniorityYears),
            isNull(leaveAccrualRules.effectiveTo)
          ),
        });

        if (existingRule) {
          // Close existing rule
          const effectiveFromStr = effectiveFrom.toISOString().split('T')[0];
          await tx
            .update(leaveAccrualRules)
            .set({ effectiveTo: effectiveFromStr })
            .where(eq(leaveAccrualRules.id, existingRule.id));

          // Insert new rule
          const [newRule] = await tx
            .insert(leaveAccrualRules)
            .values({
              ...existingRule,
              id: undefined,
              daysPerMonth: input.daysPerMonth.toString(),
              bonusDays: input.bonusDays,
              effectiveFrom: effectiveFromStr,
              effectiveTo: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as any)
            .returning();

          return newRule;
        }

        // Create new rule
        const effectiveFromStr = effectiveFrom.toISOString().split('T')[0];
        const [newRule] = await tx
          .insert(leaveAccrualRules)
          .values({
            countryCode: input.countryCode,
            ageThreshold: input.ageThreshold || null,
            seniorityYears: input.seniorityYears || null,
            daysPerMonth: input.daysPerMonth.toString(),
            bonusDays: input.bonusDays,
            effectiveFrom: effectiveFromStr,
            effectiveTo: null,
          } as any)
          .returning();

        return newRule;
      });
    }),

  // ==========================================================================
  // Compliance Validation (Utility)
  // ==========================================================================

  /**
   * Validate policy compliance before submission
   * Returns violations and suggestions
   */
  validatePolicyCompliance: publicProcedure
    .input(
      z.object({
        policy: createPolicySchema.partial(),
        countryCode: z.string().length(2).default('CI'),
      })
    )
    .query(async ({ input }) => {
      return await validatePolicyCompliance(input.policy, input.countryCode);
    }),

  /**
   * Get legal minimums for display in UI
   */
  getLegalMinimums: publicProcedure
    .input(
      z.object({
        countryCode: z.string().length(2).default('CI'),
      })
    )
    .query(async ({ input }) => {
      const annualLeave = await getLegalMinimumsForAnnualLeave(input.countryCode);

      return {
        annualLeave,
      };
    }),
});
