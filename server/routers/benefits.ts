/**
 * Benefits Management tRPC Router
 *
 * API endpoints for managing employee benefits (health, dental, life insurance, etc.)
 * with enrollment tracking, effective dates, and cost management.
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import {
  benefitPlans,
  employeeBenefitEnrollments,
  employeeBenefitEnrollmentHistory,
  employees,
} from '@/drizzle/schema';
import { eq, and, isNull, or, lte, gte, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

// ========================================
// Input Schemas - Benefit Plans
// ========================================

const listPlansSchema = z.object({
  benefitType: z.enum(['health', 'dental', 'vision', 'life_insurance', 'retirement', 'disability', 'transport', 'meal', 'other']).optional(),
  isActive: z.boolean().optional(),
});

const createPlanSchema = z.object({
  planName: z.string().min(1, 'Le nom du plan est requis'),
  planCode: z.string().min(1, 'Le code du plan est requis'),
  benefitType: z.enum(['health', 'dental', 'vision', 'life_insurance', 'retirement', 'disability', 'transport', 'meal', 'other']),
  description: z.string().optional(),
  providerName: z.string().optional(),
  coverageLevel: z.enum(['individual', 'family', 'employee_spouse', 'employee_children']).optional(),
  employeeCost: z.string().optional(), // Decimal as string
  employerCost: z.string().optional(),
  totalCost: z.string().optional(),
  currency: z.string().default('XOF'),
  costFrequency: z.enum(['monthly', 'annual', 'per_payroll']).default('monthly'),
  eligibleEmployeeTypes: z.array(z.enum(['LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE'])).optional(),
  waitingPeriodDays: z.number().int().min(0).default(0),
  requiresDependentVerification: z.boolean().default(false),
  isActive: z.boolean().default(true),
  effectiveFrom: z.string().min(1, 'La date de début est requise'),
  effectiveTo: z.string().optional(),
  linksToSalaryComponentId: z.string().uuid().optional(),
  customFields: z.record(z.any()).optional(),
});

const updatePlanSchema = z.object({
  id: z.string().uuid(),
  planName: z.string().min(1).optional(),
  description: z.string().optional(),
  providerName: z.string().optional(),
  coverageLevel: z.enum(['individual', 'family', 'employee_spouse', 'employee_children']).optional(),
  employeeCost: z.string().optional(),
  employerCost: z.string().optional(),
  totalCost: z.string().optional(),
  costFrequency: z.enum(['monthly', 'annual', 'per_payroll']).optional(),
  eligibleEmployeeTypes: z.array(z.enum(['LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE'])).optional(),
  waitingPeriodDays: z.number().int().min(0).optional(),
  requiresDependentVerification: z.boolean().optional(),
  isActive: z.boolean().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  linksToSalaryComponentId: z.string().uuid().nullable().optional(),
  customFields: z.record(z.any()).optional(),
});

const deletePlanSchema = z.object({
  id: z.string().uuid(),
});

// ========================================
// Input Schemas - Employee Enrollments
// ========================================

const listEnrollmentsSchema = z.object({
  employeeId: z.string().uuid().optional(),
  benefitPlanId: z.string().uuid().optional(),
  enrollmentStatus: z.enum(['active', 'pending', 'terminated', 'suspended']).optional(),
  effectiveDate: z.string().optional(), // Get enrollments effective on this date
});

const createEnrollmentSchema = z.object({
  employeeId: z.string().uuid(),
  benefitPlanId: z.string().uuid(),
  enrollmentDate: z.string().min(1, 'La date d\'inscription est requise'),
  effectiveDate: z.string().min(1, 'La date d\'effet est requise'),
  terminationDate: z.string().optional(),
  enrollmentNumber: z.string().optional(), // N° CMU or other external enrollment number
  policyNumber: z.string().optional(),
  coverageLevel: z.enum(['individual', 'family', 'employee_spouse', 'employee_children']).optional(),
  coveredDependents: z.array(
    z.object({
      dependentId: z.string().uuid().optional(),
      name: z.string(),
      relationship: z.string(),
    })
  ).optional(),
  employeeCostOverride: z.string().optional(),
  employerCostOverride: z.string().optional(),
  enrollmentStatus: z.enum(['active', 'pending', 'terminated', 'suspended']).default('active'),
  terminationReason: z.string().optional(),
  enrollmentDocumentUrl: z.string().optional(),
  beneficiaryDesignation: z.array(
    z.object({
      name: z.string(),
      relationship: z.string(),
      percentage: z.number().min(0).max(100),
    })
  ).optional(),
  notes: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

const updateEnrollmentSchema = z.object({
  id: z.string().uuid(),
  enrollmentDate: z.string().optional(),
  effectiveDate: z.string().optional(),
  terminationDate: z.string().optional(),
  enrollmentNumber: z.string().optional(),
  policyNumber: z.string().optional(),
  coverageLevel: z.enum(['individual', 'family', 'employee_spouse', 'employee_children']).optional(),
  coveredDependents: z.array(
    z.object({
      dependentId: z.string().uuid().optional(),
      name: z.string(),
      relationship: z.string(),
    })
  ).optional(),
  employeeCostOverride: z.string().nullable().optional(),
  employerCostOverride: z.string().nullable().optional(),
  enrollmentStatus: z.enum(['active', 'pending', 'terminated', 'suspended']).optional(),
  terminationReason: z.string().optional(),
  enrollmentDocumentUrl: z.string().optional(),
  beneficiaryDesignation: z.array(
    z.object({
      name: z.string(),
      relationship: z.string(),
      percentage: z.number().min(0).max(100),
    })
  ).optional(),
  notes: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

const deleteEnrollmentSchema = z.object({
  id: z.string().uuid(),
});

const terminateEnrollmentSchema = z.object({
  id: z.string().uuid(),
  terminationDate: z.string().min(1, 'La date de résiliation est requise'),
  terminationReason: z.string().min(1, 'La raison de résiliation est requise'),
});

const getEnrollmentHistorySchema = z.object({
  enrollmentId: z.string().uuid(),
});

// ========================================
// Helper Functions
// ========================================

/**
 * Record a change to enrollment history
 */
async function recordEnrollmentHistory(
  enrollmentId: string,
  changeType: 'enrolled' | 'modified' | 'terminated' | 'cost_changed' | 'dependent_added' | 'dependent_removed' | 'status_changed',
  changeDescription: string,
  previousValues: any,
  newValues: any,
  changeDate: string,
  changeReason: string | null,
  effectiveDate: string,
  changedBy: string
) {
  await db.insert(employeeBenefitEnrollmentHistory).values({
    enrollmentId,
    changeType,
    changeDescription,
    previousValues,
    newValues,
    changeDate,
    changeReason: changeReason || null,
    effectiveDate,
    changedBy,
  });
}

// ========================================
// Router
// ========================================

export const benefitsRouter = createTRPCRouter({
  // ========================================
  // BENEFIT PLANS
  // ========================================

  /**
   * List all benefit plans for the tenant
   */
  listPlans: publicProcedure
    .input(listPlansSchema)
    .query(async ({ input, ctx }) => {
      try {
        const conditions = [eq(benefitPlans.tenantId, ctx.user.tenantId)];

        if (input.benefitType) {
          conditions.push(eq(benefitPlans.benefitType, input.benefitType));
        }

        if (input.isActive !== undefined) {
          conditions.push(eq(benefitPlans.isActive, input.isActive));
        }

        const plans = await db
          .select()
          .from(benefitPlans)
          .where(and(...conditions))
          .orderBy(desc(benefitPlans.createdAt));

        return plans;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des plans',
        });
      }
    }),

  /**
   * Get a single benefit plan by ID
   */
  getPlan: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        const [plan] = await db
          .select()
          .from(benefitPlans)
          .where(
            and(
              eq(benefitPlans.id, input.id),
              eq(benefitPlans.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!plan) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Plan non trouvé',
          });
        }

        return plan;
      } catch (error: any) {
        throw new TRPCError({
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération du plan',
        });
      }
    }),

  /**
   * Create a new benefit plan
   */
  createPlan: publicProcedure
    .input(createPlanSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Check for duplicate plan code
        const [existing] = await db
          .select()
          .from(benefitPlans)
          .where(
            and(
              eq(benefitPlans.tenantId, ctx.user.tenantId),
              eq(benefitPlans.planCode, input.planCode)
            )
          )
          .limit(1);

        if (existing) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Un plan avec ce code existe déjà',
          });
        }

        const [plan] = await db
          .insert(benefitPlans)
          .values({
            tenantId: ctx.user.tenantId,
            planName: input.planName,
            planCode: input.planCode,
            benefitType: input.benefitType,
            description: input.description || null,
            providerName: input.providerName || null,
            coverageLevel: input.coverageLevel || null,
            employeeCost: input.employeeCost || null,
            employerCost: input.employerCost || null,
            totalCost: input.totalCost || null,
            currency: input.currency,
            costFrequency: input.costFrequency,
            eligibleEmployeeTypes: input.eligibleEmployeeTypes || null,
            waitingPeriodDays: input.waitingPeriodDays,
            requiresDependentVerification: input.requiresDependentVerification,
            isActive: input.isActive,
            effectiveFrom: input.effectiveFrom,
            effectiveTo: input.effectiveTo || null,
            linksToSalaryComponentId: input.linksToSalaryComponentId || null,
            customFields: input.customFields || {},
            createdBy: ctx.user.id,
            updatedBy: ctx.user.id,
          })
          .returning();

        return plan;
      } catch (error: any) {
        console.error('Error creating benefit plan:', error);
        throw new TRPCError({
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la création du plan',
        });
      }
    }),

  /**
   * Update an existing benefit plan
   */
  updatePlan: publicProcedure
    .input(updatePlanSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify plan exists and belongs to tenant
        const [existing] = await db
          .select()
          .from(benefitPlans)
          .where(
            and(
              eq(benefitPlans.id, input.id),
              eq(benefitPlans.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Plan non trouvé',
          });
        }

        const { id, ...updateData } = input;
        const [updated] = await db
          .update(benefitPlans)
          .set({
            ...updateData,
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(benefitPlans.id, input.id))
          .returning();

        return updated;
      } catch (error: any) {
        console.error('Error updating benefit plan:', error);
        throw new TRPCError({
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la mise à jour du plan',
        });
      }
    }),

  /**
   * Delete a benefit plan (soft delete - mark as inactive)
   */
  deletePlan: publicProcedure
    .input(deletePlanSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify plan exists and belongs to tenant
        const [existing] = await db
          .select()
          .from(benefitPlans)
          .where(
            and(
              eq(benefitPlans.id, input.id),
              eq(benefitPlans.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Plan non trouvé',
          });
        }

        // Check if there are active enrollments
        const [activeEnrollment] = await db
          .select()
          .from(employeeBenefitEnrollments)
          .where(
            and(
              eq(employeeBenefitEnrollments.benefitPlanId, input.id),
              eq(employeeBenefitEnrollments.enrollmentStatus, 'active')
            )
          )
          .limit(1);

        if (activeEnrollment) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Impossible de supprimer un plan avec des inscriptions actives',
          });
        }

        // Soft delete - mark as inactive
        await db
          .update(benefitPlans)
          .set({
            isActive: false,
            effectiveTo: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(benefitPlans.id, input.id));

        return { success: true };
      } catch (error: any) {
        console.error('Error deleting benefit plan:', error);
        throw new TRPCError({
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la suppression du plan',
        });
      }
    }),

  // ========================================
  // EMPLOYEE ENROLLMENTS
  // ========================================

  /**
   * List employee benefit enrollments
   */
  listEnrollments: publicProcedure
    .input(listEnrollmentsSchema)
    .query(async ({ input, ctx }) => {
      try {
        const conditions = [eq(employeeBenefitEnrollments.tenantId, ctx.user.tenantId)];

        if (input.employeeId) {
          conditions.push(eq(employeeBenefitEnrollments.employeeId, input.employeeId));
        }

        if (input.benefitPlanId) {
          conditions.push(eq(employeeBenefitEnrollments.benefitPlanId, input.benefitPlanId));
        }

        if (input.enrollmentStatus) {
          conditions.push(eq(employeeBenefitEnrollments.enrollmentStatus, input.enrollmentStatus));
        }

        if (input.effectiveDate) {
          // Get enrollments that are effective on the given date
          conditions.push(lte(employeeBenefitEnrollments.effectiveDate, input.effectiveDate));
          conditions.push(
            or(
              isNull(employeeBenefitEnrollments.terminationDate),
              gte(employeeBenefitEnrollments.terminationDate, input.effectiveDate)
            )!
          );
        }

        const enrollments = await db
          .select()
          .from(employeeBenefitEnrollments)
          .where(and(...conditions))
          .orderBy(desc(employeeBenefitEnrollments.effectiveDate));

        return enrollments;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des inscriptions',
        });
      }
    }),

  /**
   * Get a single enrollment by ID
   */
  getEnrollment: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        const [enrollment] = await db
          .select()
          .from(employeeBenefitEnrollments)
          .where(
            and(
              eq(employeeBenefitEnrollments.id, input.id),
              eq(employeeBenefitEnrollments.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!enrollment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Inscription non trouvée',
          });
        }

        return enrollment;
      } catch (error: any) {
        throw new TRPCError({
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération de l\'inscription',
        });
      }
    }),

  /**
   * Create a new benefit enrollment for an employee
   */
  createEnrollment: publicProcedure
    .input(createEnrollmentSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify employee belongs to tenant
        const [employee] = await db
          .select()
          .from(employees)
          .where(
            and(
              eq(employees.id, input.employeeId),
              eq(employees.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!employee) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Employé non trouvé',
          });
        }

        // Verify benefit plan belongs to tenant
        const [plan] = await db
          .select()
          .from(benefitPlans)
          .where(
            and(
              eq(benefitPlans.id, input.benefitPlanId),
              eq(benefitPlans.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!plan) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Plan non trouvé',
          });
        }

        // Check eligibility based on employee type
        if (plan.eligibleEmployeeTypes && employee.employeeType) {
          const eligibleTypes = plan.eligibleEmployeeTypes as string[];
          if (!eligibleTypes.includes(employee.employeeType)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Ce plan n'est pas disponible pour les employés de type ${employee.employeeType}`,
            });
          }
        }

        const [enrollment] = await db
          .insert(employeeBenefitEnrollments)
          .values({
            tenantId: ctx.user.tenantId,
            employeeId: input.employeeId,
            benefitPlanId: input.benefitPlanId,
            enrollmentDate: input.enrollmentDate,
            effectiveDate: input.effectiveDate,
            terminationDate: input.terminationDate || null,
            enrollmentNumber: input.enrollmentNumber || null,
            policyNumber: input.policyNumber || null,
            coverageLevel: input.coverageLevel || null,
            coveredDependents: input.coveredDependents || [],
            employeeCostOverride: input.employeeCostOverride || null,
            employerCostOverride: input.employerCostOverride || null,
            enrollmentStatus: input.enrollmentStatus,
            terminationReason: input.terminationReason || null,
            enrollmentDocumentUrl: input.enrollmentDocumentUrl || null,
            beneficiaryDesignation: input.beneficiaryDesignation || null,
            notes: input.notes || null,
            customFields: input.customFields || {},
            createdBy: ctx.user.id,
            updatedBy: ctx.user.id,
          })
          .returning();

        // Record in history
        await recordEnrollmentHistory(
          enrollment.id,
          'enrolled',
          `Inscription au plan ${plan.planName}`,
          null,
          enrollment,
          input.enrollmentDate,
          null,
          input.effectiveDate,
          ctx.user.id
        );

        return enrollment;
      } catch (error: any) {
        console.error('Error creating enrollment:', error);
        throw new TRPCError({
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la création de l\'inscription',
        });
      }
    }),

  /**
   * Update an existing enrollment
   */
  updateEnrollment: publicProcedure
    .input(updateEnrollmentSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Get existing enrollment
        const [existing] = await db
          .select()
          .from(employeeBenefitEnrollments)
          .where(
            and(
              eq(employeeBenefitEnrollments.id, input.id),
              eq(employeeBenefitEnrollments.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Inscription non trouvée',
          });
        }

        const { id, ...updateData } = input;
        const [updated] = await db
          .update(employeeBenefitEnrollments)
          .set({
            ...updateData,
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(employeeBenefitEnrollments.id, input.id))
          .returning();

        // Record in history
        await recordEnrollmentHistory(
          updated.id,
          'modified',
          'Modification de l\'inscription',
          existing,
          updated,
          new Date().toISOString().split('T')[0],
          'Mise à jour manuelle',
          updated.effectiveDate,
          ctx.user.id
        );

        return updated;
      } catch (error: any) {
        console.error('Error updating enrollment:', error);
        throw new TRPCError({
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la mise à jour de l\'inscription',
        });
      }
    }),

  /**
   * Terminate an enrollment
   */
  terminateEnrollment: publicProcedure
    .input(terminateEnrollmentSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const [existing] = await db
          .select()
          .from(employeeBenefitEnrollments)
          .where(
            and(
              eq(employeeBenefitEnrollments.id, input.id),
              eq(employeeBenefitEnrollments.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Inscription non trouvée',
          });
        }

        const [updated] = await db
          .update(employeeBenefitEnrollments)
          .set({
            terminationDate: input.terminationDate,
            terminationReason: input.terminationReason,
            enrollmentStatus: 'terminated',
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(employeeBenefitEnrollments.id, input.id))
          .returning();

        // Record in history
        await recordEnrollmentHistory(
          updated.id,
          'terminated',
          'Résiliation de l\'inscription',
          existing,
          updated,
          new Date().toISOString().split('T')[0],
          input.terminationReason,
          input.terminationDate,
          ctx.user.id
        );

        return updated;
      } catch (error: any) {
        console.error('Error terminating enrollment:', error);
        throw new TRPCError({
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la résiliation de l\'inscription',
        });
      }
    }),

  /**
   * Delete an enrollment (soft delete - mark as terminated)
   */
  deleteEnrollment: publicProcedure
    .input(deleteEnrollmentSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const [existing] = await db
          .select()
          .from(employeeBenefitEnrollments)
          .where(
            and(
              eq(employeeBenefitEnrollments.id, input.id),
              eq(employeeBenefitEnrollments.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Inscription non trouvée',
          });
        }

        await db
          .update(employeeBenefitEnrollments)
          .set({
            enrollmentStatus: 'terminated',
            terminationDate: new Date().toISOString().split('T')[0],
            terminationReason: 'Suppression',
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(employeeBenefitEnrollments.id, input.id));

        return { success: true };
      } catch (error: any) {
        console.error('Error deleting enrollment:', error);
        throw new TRPCError({
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la suppression de l\'inscription',
        });
      }
    }),

  /**
   * Get enrollment history
   */
  getEnrollmentHistory: publicProcedure
    .input(getEnrollmentHistorySchema)
    .query(async ({ input, ctx }) => {
      try {
        // Verify enrollment belongs to tenant
        const [enrollment] = await db
          .select()
          .from(employeeBenefitEnrollments)
          .where(
            and(
              eq(employeeBenefitEnrollments.id, input.enrollmentId),
              eq(employeeBenefitEnrollments.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!enrollment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Inscription non trouvée',
          });
        }

        const history = await db
          .select()
          .from(employeeBenefitEnrollmentHistory)
          .where(eq(employeeBenefitEnrollmentHistory.enrollmentId, input.enrollmentId))
          .orderBy(desc(employeeBenefitEnrollmentHistory.createdAt));

        return history;
      } catch (error: any) {
        throw new TRPCError({
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération de l\'historique',
        });
      }
    }),

  /**
   * List all employees with their benefit enrollments (Excel-like view)
   */
  listEmployeesWithEnrollments: publicProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      try {
        console.log('[listEmployeesWithEnrollments] Starting query for tenant:', ctx.user.tenantId);

        // Get all active employees for tenant
        const allEmployees = await db
          .select({
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
            employeeNumber: employees.employeeNumber,
          })
          .from(employees)
          .where(
            and(
              eq(employees.tenantId, ctx.user.tenantId),
              eq(employees.status, 'active')
            )
          );

        console.log('[listEmployeesWithEnrollments] Found employees:', allEmployees.length);

        // Get all active enrollments for tenant
        const allEnrollments = await db
          .select()
          .from(employeeBenefitEnrollments)
          .where(eq(employeeBenefitEnrollments.tenantId, ctx.user.tenantId));

        console.log('[listEmployeesWithEnrollments] Found enrollments:', allEnrollments.length);

        // Get all benefit plans for tenant
        const allPlans = await db
          .select()
          .from(benefitPlans)
          .where(eq(benefitPlans.tenantId, ctx.user.tenantId));

        console.log('[listEmployeesWithEnrollments] Found plans:', allPlans.length);

        // Combine data
        console.log('[listEmployeesWithEnrollments] Combining data...');
        const result = allEmployees.map((emp) => {
          // Get employee's enrollments
          const empEnrollments = allEnrollments.filter(e => e.employeeId === emp.id);

          // Attach plan details to each enrollment
          const enrichedEnrollments = empEnrollments.map(enrollment => ({
            ...enrollment,
            plan: allPlans.find(p => p.id === enrollment.benefitPlanId) || null,
          }));

          return {
            ...emp,
            position: null, // Position info available via assignments table if needed
            enrollments: enrichedEnrollments,
          };
        });

        console.log('[listEmployeesWithEnrollments] Result:', result.length, 'employees');
        return result;
      } catch (error: any) {
        console.error('Error listing employees with enrollments:', error);
        console.error('Error stack:', error.stack);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des employés',
        });
      }
    }),

  /**
   * Cancel an enrollment (mark as terminated immediately)
   */
  cancelEnrollment: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const [existing] = await db
          .select()
          .from(employeeBenefitEnrollments)
          .where(
            and(
              eq(employeeBenefitEnrollments.id, input.id),
              eq(employeeBenefitEnrollments.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Inscription non trouvée',
          });
        }

        const today = new Date().toISOString().split('T')[0];
        const [updated] = await db
          .update(employeeBenefitEnrollments)
          .set({
            enrollmentStatus: 'terminated',
            terminationDate: today,
            terminationReason: 'Annulation manuelle',
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(eq(employeeBenefitEnrollments.id, input.id))
          .returning();

        // Record in history
        await recordEnrollmentHistory(
          updated.id,
          'terminated',
          'Annulation de l\'inscription',
          existing,
          updated,
          today,
          'Annulation manuelle',
          today,
          ctx.user.id
        );

        return updated;
      } catch (error: any) {
        console.error('Error canceling enrollment:', error);
        throw new TRPCError({
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de l\'annulation de l\'inscription',
        });
      }
    }),
});
