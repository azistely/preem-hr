/**
 * Salary Review Service
 *
 * Manages salary review approval workflows.
 * Supports creating review requests, approving/rejecting, and automatic execution.
 */

import { db } from '@/lib/db';
import { salaryReviews, employees, employeeSalaries } from '@/drizzle/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { changeSalary } from './salary.service';

export interface CreateSalaryReviewInput {
  tenantId: string;
  employeeId: string;
  proposedSalary: number;
  proposedAllowances?: {
    housingAllowance?: number;
    transportAllowance?: number;
    mealAllowance?: number;
    otherAllowances?: Array<{ name: string; amount: number; taxable: boolean }>;
  };
  effectiveFrom: Date;
  reason: string;
  justification?: string;
  requestedBy: string;
}

export interface ReviewDecisionInput {
  reviewId: string;
  tenantId: string;
  decision: 'approved' | 'rejected';
  reviewNotes?: string;
  reviewedBy: string;
}

/**
 * Create salary review request
 */
export async function createSalaryReview(input: CreateSalaryReviewInput) {
  // Get employee and current salary
  const [employee] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, input.employeeId),
        eq(employees.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!employee) {
    throw new NotFoundError('Employé', input.employeeId);
  }

  // Get current salary
  const [currentSalary] = await db
    .select()
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.employeeId, input.employeeId),
        isNull(employeeSalaries.effectiveTo)
      )
    )
    .limit(1);

  if (!currentSalary) {
    throw new ValidationError('Aucun salaire actuel trouvé pour cet employé');
  }

  // Create review
  const [review] = await db
    .insert(salaryReviews)
    .values({
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      currentSalary: currentSalary.baseSalary,
      proposedSalary: input.proposedSalary.toString(),
      proposedAllowances: input.proposedAllowances || {},
      effectiveFrom: input.effectiveFrom.toISOString().split('T')[0],
      reason: input.reason,
      justification: input.justification,
      status: 'pending',
      requestedBy: input.requestedBy,
    })
    .returning();

  return review!;
}

/**
 * Approve or reject salary review
 */
export async function reviewSalaryChange(input: ReviewDecisionInput) {
  // Get review
  const [review] = await db
    .select()
    .from(salaryReviews)
    .where(
      and(
        eq(salaryReviews.id, input.reviewId),
        eq(salaryReviews.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!review) {
    throw new NotFoundError('Demande de révision salariale', input.reviewId);
  }

  if (review.status !== 'pending') {
    throw new ValidationError(
      `Cette demande a déjà été ${review.status === 'approved' ? 'approuvée' : 'rejetée'}`
    );
  }

  return await db.transaction(async (tx) => {
    // Update review status
    const [updatedReview] = await tx
      .update(salaryReviews)
      .set({
        status: input.decision,
        reviewedBy: input.reviewedBy,
        reviewedAt: new Date().toISOString(),
        reviewNotes: input.reviewNotes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(salaryReviews.id, input.reviewId))
      .returning();

    // If approved, execute salary change
    if (input.decision === 'approved') {
      const allowances = review.proposedAllowances as any || {};

      // Build components array from proposed salary and allowances
      const components = [
        {
          code: '01',
          name: 'Salaire de base',
          amount: parseFloat(review.proposedSalary),
          sourceType: 'standard' as const,
        }
      ];

      // Add allowances as components if they exist
      if (allowances.housingAllowance) {
        components.push({
          code: '21',
          name: 'Indemnité de logement',
          amount: allowances.housingAllowance,
          sourceType: 'standard' as const,
        });
      }
      if (allowances.transportAllowance) {
        components.push({
          code: '22',
          name: 'Indemnité de transport',
          amount: allowances.transportAllowance,
          sourceType: 'standard' as const,
        });
      }
      if (allowances.mealAllowance) {
        components.push({
          code: '23',
          name: 'Indemnité de repas',
          amount: allowances.mealAllowance,
          sourceType: 'standard' as const,
        });
      }
      if (Array.isArray(allowances.otherAllowances)) {
        allowances.otherAllowances.forEach((allowance: any, index: number) => {
          components.push({
            code: `90${index}`,
            name: allowance.name || 'Autre indemnité',
            amount: allowance.amount,
            sourceType: 'standard' as const, // Changed to 'standard' since it's from salary review system
          });
        });
      }

      await changeSalary({
        employeeId: review.employeeId,
        tenantId: review.tenantId,
        components,
        effectiveFrom: new Date(review.effectiveFrom),
        changeReason: review.reason,
        notes: `Approuvé par révision #${review.id}`,
        createdBy: input.reviewedBy,
      });
    }

    return updatedReview!;
  });
}

/**
 * Get pending reviews for tenant
 */
export async function getPendingReviews(tenantId: string) {
  return await db
    .select()
    .from(salaryReviews)
    .where(
      and(
        eq(salaryReviews.tenantId, tenantId),
        eq(salaryReviews.status, 'pending')
      )
    )
    .orderBy(salaryReviews.requestedAt);
}

/**
 * Get review history for employee
 */
export async function getEmployeeReviewHistory(employeeId: string) {
  return await db
    .select()
    .from(salaryReviews)
    .where(eq(salaryReviews.employeeId, employeeId))
    .orderBy(salaryReviews.requestedAt);
}

/**
 * Cancel review
 */
export async function cancelSalaryReview(reviewId: string, tenantId: string) {
  const [review] = await db
    .update(salaryReviews)
    .set({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(salaryReviews.id, reviewId),
        eq(salaryReviews.tenantId, tenantId),
        eq(salaryReviews.status, 'pending')
      )
    )
    .returning();

  if (!review) {
    throw new NotFoundError('Demande de révision salariale', reviewId);
  }

  return review;
}
