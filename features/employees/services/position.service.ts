/**
 * Position Service
 *
 * Manages organizational positions (separate from people).
 * Includes hierarchy management and headcount validation.
 */

import { db } from '@/lib/db';
import { positions } from '@/drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { getMinimumWage, getTenantCountryCode } from './salary.service';

export interface CreatePositionInput {
  tenantId: string;
  title: string;
  code?: string;
  description?: string;
  departmentId?: string;
  reportsToPositionId?: string;
  minSalary?: number;
  maxSalary?: number;
  jobLevel?: string;
  employmentType?: 'full_time' | 'part_time' | 'contract';
  weeklyHours?: number;
  workSchedule?: Record<string, any>;
  headcount?: number;
  createdBy: string;
}

/**
 * Create a new position
 */
export async function createPosition(input: CreatePositionInput) {
  // Validate salary range
  if (input.minSalary && input.maxSalary && input.minSalary > input.maxSalary) {
    throw new ValidationError(
      'Le salaire minimum doit être inférieur au maximum',
      { minSalary: input.minSalary, maxSalary: input.maxSalary }
    );
  }

  // Validate minimum salary >= country SMIG
  if (input.minSalary) {
    const countryCode = await getTenantCountryCode(input.tenantId);
    const minimumWage = await getMinimumWage(countryCode);

    if (input.minSalary < minimumWage) {
      throw new ValidationError(
        `Le salaire minimum doit être >= SMIG (${minimumWage.toLocaleString('fr-FR')} FCFA)`,
        { minSalary: input.minSalary, minimumWage, countryCode }
      );
    }
  }

  // Check for circular reporting if reportsTo is specified
  if (input.reportsToPositionId) {
    const hasCircular = await checkCircularReporting(
      input.reportsToPositionId,
      input.reportsToPositionId, // New position would report to this
      input.tenantId
    );

    if (hasCircular) {
      throw new ValidationError('Hiérarchie circulaire détectée');
    }
  }

  const [position] = await db
    .insert(positions)
    .values({
      tenantId: input.tenantId,
      title: input.title,
      code: input.code,
      description: input.description,
      departmentId: input.departmentId,
      reportsToPositionId: input.reportsToPositionId,
      minSalary: input.minSalary?.toString(),
      maxSalary: input.maxSalary?.toString(),
      jobLevel: input.jobLevel,
      employmentType: input.employmentType || 'full_time',
      weeklyHours: input.weeklyHours?.toString() || '40',
      workSchedule: input.workSchedule,
      headcount: input.headcount || 1,
      status: 'active',
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    })
    .returning();

  return position!;
}

/**
 * Get position hierarchy (recursive)
 */
export async function getPositionHierarchy(positionId: string, tenantId: string) {
  const position = await db.query.positions.findFirst({
    where: and(
      eq(positions.id, positionId),
      eq(positions.tenantId, tenantId)
    ),
  });

  if (!position) {
    throw new NotFoundError('Poste', positionId);
  }

  // Get all positions that report to this one
  const reports = await db.query.positions.findMany({
    where: and(
      eq(positions.reportsToPositionId, positionId),
      eq(positions.tenantId, tenantId)
    ),
  });

  // Recursively get hierarchy for each report
  const reportsWithHierarchy = await Promise.all(
    reports.map(async (report) => getPositionHierarchy(report.id, tenantId))
  );

  return {
    ...position,
    reports: reportsWithHierarchy,
  };
}

/**
 * Check for circular reporting relationships
 * Prevents: A → B → A or A → B → C → A
 */
async function checkCircularReporting(
  positionId: string,
  reportsToId: string,
  tenantId: string,
  visited: Set<string> = new Set()
): Promise<boolean> {
  if (positionId === reportsToId) {
    return true; // Direct circular reference
  }

  if (visited.has(reportsToId)) {
    return true; // Circular chain detected
  }

  visited.add(reportsToId);

  // Get the position that reportsToId reports to
  const [parentPosition] = await db
    .select({ reportsToPositionId: positions.reportsToPositionId })
    .from(positions)
    .where(
      and(
        eq(positions.id, reportsToId),
        eq(positions.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!parentPosition || !parentPosition.reportsToPositionId) {
    return false; // Reached top of hierarchy, no circular reference
  }

  // Recursively check parent
  return checkCircularReporting(
    positionId,
    parentPosition.reportsToPositionId,
    tenantId,
    visited
  );
}

/**
 * List all positions in a tenant
 */
export async function listPositions(tenantId: string, status?: 'active' | 'inactive') {
  const conditions = [eq(positions.tenantId, tenantId)];

  if (status) {
    conditions.push(eq(positions.status, status));
  }

  return await db
    .select()
    .from(positions)
    .where(and(...conditions));
}
