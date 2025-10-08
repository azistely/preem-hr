import { db } from '@/lib/db';
import { salaryBands, positions, employees, employeeSalaries } from '@/drizzle/schema';
import { eq, and, isNull, or, lte, gte } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '@/lib/errors';

export interface CreateSalaryBandInput {
  tenantId: string;
  name: string;
  code: string;
  jobLevel: string;
  minSalary: number;
  midSalary: number;
  maxSalary: number;
  currency?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
}

export interface ValidateSalaryInput {
  salary: number;
  positionId: string;
  tenantId: string;
}

/**
 * Create salary band
 */
export async function createSalaryBand(input: CreateSalaryBandInput) {
  // Validate salary range
  if (input.minSalary >= input.midSalary || input.midSalary >= input.maxSalary) {
    throw new ValidationError(
      'Salaires invalides: min < milieu < max requis',
      { minSalary: input.minSalary, midSalary: input.midSalary, maxSalary: input.maxSalary }
    );
  }

  // Check for duplicate code within tenant
  const [existing] = await db
    .select()
    .from(salaryBands)
    .where(
      and(
        eq(salaryBands.tenantId, input.tenantId),
        eq(salaryBands.code, input.code),
        isNull(salaryBands.effectiveTo)
      )
    )
    .limit(1);

  if (existing) {
    throw new ValidationError(
      `Une bande salariale avec le code '${input.code}' existe déjà`
    );
  }

  const [band] = await db
    .insert(salaryBands)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      code: input.code,
      jobLevel: input.jobLevel,
      minSalary: input.minSalary.toString(),
      midSalary: input.midSalary.toString(),
      maxSalary: input.maxSalary.toString(),
      currency: input.currency || 'XOF',
      effectiveFrom: input.effectiveFrom?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      effectiveTo: input.effectiveTo?.toISOString().split('T')[0] || null,
      isActive: true,
    })
    .returning();

  return band!;
}

/**
 * Get salary band by position
 */
export async function getSalaryBandByPosition(positionId: string, tenantId: string) {
  const [position] = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.id, positionId),
        eq(positions.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!position) {
    throw new NotFoundError('Poste', positionId);
  }

  if (!position.salaryBandId) {
    return null; // Position has no salary band
  }

  const [band] = await db
    .select()
    .from(salaryBands)
    .where(eq(salaryBands.id, position.salaryBandId))
    .limit(1);

  return band || null;
}

/**
 * Validate salary against band
 */
export async function validateSalaryAgainstBand(input: ValidateSalaryInput) {
  const band = await getSalaryBandByPosition(input.positionId, input.tenantId);

  if (!band) {
    return { valid: true, reason: 'Aucune bande salariale définie pour ce poste' };
  }

  const minSalary = parseFloat(band.minSalary);
  const maxSalary = parseFloat(band.maxSalary);

  if (input.salary < minSalary) {
    return {
      valid: false,
      reason: `Salaire en dessous du minimum de la bande (${minSalary} FCFA)`,
      band,
    };
  }

  if (input.salary > maxSalary) {
    return {
      valid: false,
      reason: `Salaire au-dessus du maximum de la bande (${maxSalary} FCFA)`,
      band,
    };
  }

  return { valid: true, band };
}

/**
 * Calculate compa-ratio (actual salary / midpoint)
 */
export function getSalaryCompaRatio(actualSalary: number, bandMidpoint: number): number {
  if (bandMidpoint === 0) return 0;
  return (actualSalary / bandMidpoint) * 100;
}

/**
 * List salary bands
 */
export async function listSalaryBands(tenantId: string, activeOnly: boolean = true) {
  const conditions = [eq(salaryBands.tenantId, tenantId)];

  if (activeOnly) {
    conditions.push(eq(salaryBands.isActive, true));
    conditions.push(isNull(salaryBands.effectiveTo));
  }

  return await db
    .select()
    .from(salaryBands)
    .where(and(...conditions))
    .orderBy(salaryBands.jobLevel, salaryBands.code);
}

/**
 * Update salary band
 */
export async function updateSalaryBand(
  bandId: string,
  tenantId: string,
  updates: Partial<CreateSalaryBandInput>
) {
  const [band] = await db
    .select()
    .from(salaryBands)
    .where(
      and(
        eq(salaryBands.id, bandId),
        eq(salaryBands.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!band) {
    throw new NotFoundError('Bande salariale', bandId);
  }

  // Validate salary range if updated
  const minSalary = updates.minSalary ?? parseFloat(band.minSalary);
  const midSalary = updates.midSalary ?? parseFloat(band.midSalary || '0');
  const maxSalary = updates.maxSalary ?? parseFloat(band.maxSalary);

  if (minSalary >= midSalary || midSalary >= maxSalary) {
    throw new ValidationError(
      'Salaires invalides: min < milieu < max requis'
    );
  }

  const [updated] = await db
    .update(salaryBands)
    .set({
      name: updates.name ?? band.name,
      jobLevel: updates.jobLevel ?? band.jobLevel,
      minSalary: updates.minSalary?.toString() ?? band.minSalary,
      midSalary: updates.midSalary?.toString() ?? band.midSalary,
      maxSalary: updates.maxSalary?.toString() ?? band.maxSalary,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(salaryBands.id, bandId))
    .returning();

  return updated!;
}
