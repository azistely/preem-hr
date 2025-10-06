/**
 * Assignment Service
 *
 * Manages employee-position assignments with:
 * - Headcount validation
 * - Overlap prevention (for primary assignments)
 * - Effective dating
 */

import { db } from '@/lib/db';
import { assignments, positions, employees } from '@/drizzle/schema';
import { eq, and, or, isNull, lt, gt, lte, gte, sql } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '@/lib/errors';

export interface CreateAssignmentInput {
  tenantId: string;
  employeeId: string;
  positionId: string;
  assignmentType: 'primary' | 'secondary' | 'temporary';
  effectiveFrom: Date;
  effectiveTo?: Date;
  assignmentReason?: string;
  notes?: string;
  createdBy: string;
}

export interface TransferEmployeeInput {
  employeeId: string;
  tenantId: string;
  newPositionId: string;
  effectiveFrom: Date;
  reason: string;
  notes?: string;
  createdBy: string;
}

/**
 * Create an employee assignment
 */
export async function createAssignment(input: CreateAssignmentInput) {
  // Verify employee exists
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

  // Verify position exists
  const [position] = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.id, input.positionId),
        eq(positions.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!position) {
    throw new NotFoundError('Poste', input.positionId);
  }

  // Check for overlapping primary assignments
  if (input.assignmentType === 'primary') {
    const hasOverlap = await checkAssignmentOverlap(
      input.employeeId,
      input.effectiveFrom,
      input.effectiveTo,
      'primary'
    );

    if (hasOverlap) {
      throw new ValidationError(
        "L'employé a déjà une affectation principale pour cette période"
      );
    }
  }

  // Validate headcount availability
  const currentCount = await getActiveAssignmentCount(
    input.positionId,
    input.effectiveFrom
  );

  if (currentCount >= position.headcount) {
    throw new ValidationError(
      `Effectif complet pour ce poste (${currentCount}/${position.headcount})`,
      { positionId: input.positionId, currentCount, headcount: position.headcount }
    );
  }

  // Create assignment
  const [assignment] = await db
    .insert(assignments)
    .values({
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      positionId: input.positionId,
      assignmentType: input.assignmentType,
      effectiveFrom: input.effectiveFrom.toISOString().split('T')[0],
      effectiveTo: input.effectiveTo?.toISOString().split('T')[0] || null,
      assignmentReason: input.assignmentReason,
      notes: input.notes,
      createdBy: input.createdBy,
    })
    .returning();

  return assignment!;
}

/**
 * Transfer employee to new position
 */
export async function transferEmployee(input: TransferEmployeeInput) {
  return await db.transaction(async (tx) => {
    // Get current primary assignment
    const [currentAssignment] = await tx
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.employeeId, input.employeeId),
          eq(assignments.assignmentType, 'primary'),
          isNull(assignments.effectiveTo)
        )
      )
      .limit(1);

    if (!currentAssignment) {
      throw new NotFoundError('Affectation actuelle', input.employeeId);
    }

    // End current assignment
    await tx
      .update(assignments)
      .set({
        effectiveTo: input.effectiveFrom.toISOString().split('T')[0],
      })
      .where(eq(assignments.id, currentAssignment.id));

    // Create new assignment
    const [newAssignment] = await tx
      .insert(assignments)
      .values({
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        positionId: input.newPositionId,
        assignmentType: 'primary',
        effectiveFrom: input.effectiveFrom.toISOString().split('T')[0],
        effectiveTo: null,
        assignmentReason: input.reason,
        notes: input.notes,
        createdBy: input.createdBy,
      })
      .returning();

    return newAssignment!;
  });
}

/**
 * Get current assignment for an employee (as of specific date)
 */
export async function getCurrentAssignment(
  employeeId: string,
  assignmentType: 'primary' | 'secondary' | 'temporary' = 'primary',
  asOfDate?: Date
) {
  const queryDate = asOfDate || new Date();
  const dateStr = queryDate.toISOString().split('T')[0];

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.employeeId, employeeId),
        eq(assignments.assignmentType, assignmentType),
        lte(assignments.effectiveFrom, dateStr),
        or(
          isNull(assignments.effectiveTo),
          gt(assignments.effectiveTo, dateStr)
        )
      )
    )
    .limit(1);

  return assignment;
}

/**
 * Check if assignment overlaps with existing assignments
 */
async function checkAssignmentOverlap(
  employeeId: string,
  effectiveFrom: Date,
  effectiveTo: Date | undefined,
  assignmentType: 'primary' | 'secondary' | 'temporary'
): Promise<boolean> {
  const fromStr = effectiveFrom.toISOString().split('T')[0];
  const toStr = effectiveTo?.toISOString().split('T')[0];

  // Query for overlapping assignments
  // Overlap exists if: (new_start <= existing_end) AND (new_end >= existing_start)
  const overlapping = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.employeeId, employeeId),
        eq(assignments.assignmentType, assignmentType),
        or(
          // Case 1: Existing assignment has no end date
          and(
            isNull(assignments.effectiveTo),
            toStr ? gte(assignments.effectiveFrom, fromStr) : sql`true`
          ),
          // Case 2: Existing assignment has end date
          and(
            sql`${assignments.effectiveTo} IS NOT NULL`,
            lte(assignments.effectiveFrom, toStr || fromStr),
            toStr
              ? gte(assignments.effectiveTo, fromStr)
              : gte(assignments.effectiveTo, fromStr)
          )
        )
      )
    )
    .limit(1);

  return overlapping.length > 0;
}

/**
 * Get count of active assignments for a position (as of date)
 */
async function getActiveAssignmentCount(
  positionId: string,
  asOfDate: Date
): Promise<number> {
  const dateStr = asOfDate.toISOString().split('T')[0];

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assignments)
    .where(
      and(
        eq(assignments.positionId, positionId),
        lte(assignments.effectiveFrom, dateStr),
        or(
          isNull(assignments.effectiveTo),
          gt(assignments.effectiveTo, dateStr)
        )
      )
    );

  return result[0]?.count || 0;
}
