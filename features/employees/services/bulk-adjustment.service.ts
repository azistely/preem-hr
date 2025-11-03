import { db } from '@/lib/db';
import {
  bulkSalaryAdjustments,
  bulkAdjustmentItems,
  employees,
  employeeSalaries,
  positions,
  assignments
} from '@/drizzle/schema';
import { eq, and, isNull, gte, lte, inArray } from 'drizzle-orm';
import { ValidationError, NotFoundError, BusinessRuleError } from '@/lib/errors';
import { changeSalary } from './salary.service';
import { getMinimumWage, getTenantCountryCode } from './salary.service';

export interface CreateBulkAdjustmentInput {
  tenantId: string;
  name: string;
  description?: string;
  adjustmentType: 'percentage' | 'fixed_amount' | 'custom';
  adjustmentValue?: number;
  effectiveFrom: Date;
  filters?: {
    departmentIds?: string[];
    positionIds?: string[];
    minSalary?: number;
    maxSalary?: number;
    employeeIds?: string[];
  };
  createdBy: string;
}

export interface ProcessBulkAdjustmentInput {
  adjustmentId: string;
  tenantId: string;
  processedBy: string;
}

/**
 * Create bulk salary adjustment (draft state)
 */
export async function createBulkAdjustment(input: CreateBulkAdjustmentInput) {
  // Validate adjustment type
  if (input.adjustmentType !== 'custom' && !input.adjustmentValue) {
    throw new ValidationError(
      'La valeur d\'ajustement est requise pour ce type',
      { adjustmentType: input.adjustmentType }
    );
  }

  if (input.adjustmentType === 'percentage' && (input.adjustmentValue! < 0 || input.adjustmentValue! > 100)) {
    throw new ValidationError(
      'Le pourcentage doit être entre 0 et 100',
      { adjustmentValue: input.adjustmentValue }
    );
  }

  const [adjustment] = await db
    .insert(bulkSalaryAdjustments)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description,
      adjustmentType: input.adjustmentType === 'percentage' ? 'percentage' : 'flat',
      adjustmentValue: input.adjustmentValue?.toString() || null,
      effectiveFrom: input.effectiveFrom.toISOString().split('T')[0],
      status: 'draft',
      createdBy: input.createdBy,
    })
    .returning();

  return adjustment!;
}

/**
 * Calculate affected employees and preview impact
 */
export async function calculateAffectedEmployees(
  adjustmentId: string,
  tenantId: string
) {
  // Get adjustment
  const [adjustment] = await db
    .select()
    .from(bulkSalaryAdjustments)
    .where(
      and(
        eq(bulkSalaryAdjustments.id, adjustmentId),
        eq(bulkSalaryAdjustments.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!adjustment) {
    throw new NotFoundError('Ajustement en masse', adjustmentId);
  }

  // Build query for affected employees
  const affectedEmployees = await db
    .select({
      employeeId: employees.id,
      employeeName: employees.firstName,
      employeeLastName: employees.lastName,
      employeeNumber: employees.employeeNumber,
      currentSalary: employeeSalaries.baseSalary,
      positionId: assignments.positionId,
    })
    .from(employees)
    .innerJoin(
      employeeSalaries,
      and(
        eq(employeeSalaries.employeeId, employees.id),
        isNull(employeeSalaries.effectiveTo)
      )
    )
    .innerJoin(
      assignments,
      and(
        eq(assignments.employeeId, employees.id),
        isNull(assignments.effectiveTo),
        eq(assignments.assignmentType, 'primary')
      )
    )
    .where(
      and(
        eq(employees.tenantId, tenantId),
        eq(employees.status, 'active')
      )
    );

  // Calculate new salaries
  const items = affectedEmployees.map(emp => {
    const currentSalary = parseFloat(emp.currentSalary);
    let newSalary = currentSalary;

    if (adjustment.adjustmentType === 'percentage') {
      const percentage = parseFloat(adjustment.adjustmentValue || '0');
      newSalary = currentSalary * (1 + percentage / 100);
    } else if (adjustment.adjustmentType === 'flat') {
      const amount = parseFloat(adjustment.adjustmentValue || '0');
      newSalary = currentSalary + amount;
    }

    return {
      employeeId: emp.employeeId,
      employeeName: `${emp.employeeName} ${emp.employeeLastName}`,
      employeeNumber: emp.employeeNumber,
      currentSalary,
      newSalary: Math.round(newSalary),
      adjustmentAmount: Math.round(newSalary - currentSalary),
    };
  });

  const totalCostImpact = items.reduce((sum, item) => sum + item.adjustmentAmount, 0);

  return {
    adjustment,
    items,
    summary: {
      totalEmployees: items.length,
      totalCostImpact,
      averageIncrease: items.length > 0 ? Math.round(totalCostImpact / items.length) : 0,
    },
  };
}

/**
 * Process bulk adjustment (execute salary changes)
 */
export async function processBulkAdjustment(input: ProcessBulkAdjustmentInput) {
  const { adjustmentId, tenantId, processedBy } = input;

  // Get adjustment
  const [adjustment] = await db
    .select()
    .from(bulkSalaryAdjustments)
    .where(
      and(
        eq(bulkSalaryAdjustments.id, adjustmentId),
        eq(bulkSalaryAdjustments.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!adjustment) {
    throw new NotFoundError('Ajustement en masse', adjustmentId);
  }

  if (adjustment.status !== 'draft' && adjustment.status !== 'approved') {
    throw new BusinessRuleError(
      `Impossible de traiter un ajustement avec le statut: ${adjustment.status}`,
      'INVALID_STATUS'
    );
  }

  // Get preview of affected employees
  const preview = await calculateAffectedEmployees(adjustmentId, tenantId);

  if (preview.items.length === 0) {
    throw new ValidationError('Aucun employé ne correspond aux filtres');
  }

  // Get country code for SMIG validation
  const countryCode = await getTenantCountryCode(tenantId);
  const minimumWage = await getMinimumWage(countryCode);

  return await db.transaction(async (tx) => {
    // Update adjustment status
    await tx
      .update(bulkSalaryAdjustments)
      .set({
        status: 'approved',
        approvedBy: processedBy,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(bulkSalaryAdjustments.id, adjustmentId));

    // Create adjustment items
    const itemsToInsert = preview.items.map(item => ({
      adjustmentId: adjustmentId,
      employeeId: item.employeeId,
      currentSalary: item.currentSalary.toString(),
      newSalary: item.newSalary.toString(),
      adjustmentAmount: item.adjustmentAmount.toString(),
      status: 'pending' as const,
    }));

    await tx.insert(bulkAdjustmentItems).values(itemsToInsert);

    // Process each employee
    let successCount = 0;
    let failureCount = 0;

    for (const item of preview.items) {
      try {
        // Validate against SMIG
        if (item.newSalary < minimumWage) {
          await tx
            .update(bulkAdjustmentItems)
            .set({
              status: 'failed',
              errorMessage: `Nouveau salaire (${item.newSalary}) < SMIG (${minimumWage})`,
            })
            .where(
              and(
                eq(bulkAdjustmentItems.adjustmentId, adjustmentId),
                eq(bulkAdjustmentItems.employeeId, item.employeeId)
              )
            );
          failureCount++;
          continue;
        }

        // Apply salary change
        await changeSalary({
          employeeId: item.employeeId,
          tenantId,
          components: [
            {
              code: '01',
              name: 'Salaire de base',
              amount: item.newSalary,
              sourceType: 'standard' as const,
            }
          ],
          effectiveFrom: new Date(adjustment.effectiveFrom),
          changeReason: 'bulk_adjustment',
          notes: `Ajustement en masse: ${adjustment.name}`,
          createdBy: processedBy,
        });

        // Mark item as processed
        await tx
          .update(bulkAdjustmentItems)
          .set({
            status: 'executed',
          })
          .where(
            and(
              eq(bulkAdjustmentItems.adjustmentId, adjustmentId),
              eq(bulkAdjustmentItems.employeeId, item.employeeId)
            )
          );

        successCount++;
      } catch (error: any) {
        await tx
          .update(bulkAdjustmentItems)
          .set({
            status: 'failed',
            errorMessage: error.message,
          })
          .where(
            and(
              eq(bulkAdjustmentItems.adjustmentId, adjustmentId),
              eq(bulkAdjustmentItems.employeeId, item.employeeId)
            )
          );
        failureCount++;
      }
    }

    // Update final status
    const finalStatus = failureCount === 0 ? 'executed' : 'executed';

    await tx
      .update(bulkSalaryAdjustments)
      .set({
        status: finalStatus,
        processedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(bulkSalaryAdjustments.id, adjustmentId));

    return {
      adjustmentId,
      status: finalStatus,
      successCount,
      failureCount,
      totalCount: preview.items.length,
    };
  });
}

/**
 * Get bulk adjustment status
 */
export async function getBulkAdjustmentStatus(adjustmentId: string, tenantId: string) {
  const [adjustment] = await db
    .select()
    .from(bulkSalaryAdjustments)
    .where(
      and(
        eq(bulkSalaryAdjustments.id, adjustmentId),
        eq(bulkSalaryAdjustments.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!adjustment) {
    throw new NotFoundError('Ajustement en masse', adjustmentId);
  }

  // Get items
  const items = await db
    .select()
    .from(bulkAdjustmentItems)
    .where(eq(bulkAdjustmentItems.adjustmentId, adjustmentId));

  return {
    adjustment,
    items,
    summary: {
      total: items.length,
      executed: items.filter(i => i.status === 'executed').length,
      failed: items.filter(i => i.status === 'failed').length,
      pending: items.filter(i => i.status === 'pending').length,
    },
  };
}

/**
 * List bulk adjustments
 */
export async function listBulkAdjustments(tenantId: string) {
  return await db
    .select()
    .from(bulkSalaryAdjustments)
    .where(eq(bulkSalaryAdjustments.tenantId, tenantId))
    .orderBy(bulkSalaryAdjustments.createdAt);
}
