/**
 * Batch Operations Processor
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Processes bulk operations with transaction support:
 * - Bulk salary updates
 * - Mass document generation
 * - Batch notifications
 */

import { db } from '@/lib/db';
import {
  batchOperations,
  employeeSalaries,
  employees,
  auditLogs,
  alerts,
} from '@/lib/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import type { BatchOperation } from '@/lib/db/schema/automation';

/**
 * Process a bulk salary update operation
 * Updates salaries for multiple employees in a single transaction
 */
export async function processBulkSalaryUpdate(operationId: string) {
  // Get the batch operation
  const operation = await db.query.batchOperations.findFirst({
    where: eq(batchOperations.id, operationId),
  });

  if (!operation) {
    throw new Error(`Batch operation ${operationId} not found`);
  }

  if (operation.status !== 'pending') {
    throw new Error(`Batch operation ${operationId} is not pending`);
  }

  // Update status to running
  await db
    .update(batchOperations)
    .set({
      status: 'running',
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(batchOperations.id, operationId));

  const params = operation.params as {
    updateType: 'absolute' | 'percentage';
    value: number;
    effectiveDate: string;
    reason?: string;
  };

  const { updateType, value, effectiveDate } = params;
  const employeeIds = operation.entityIds;

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ entityId: string; error: string; timestamp: string }> = [];

  try {
    // Process each employee in a transaction
    await db.transaction(async (tx) => {
      for (const employeeId of employeeIds) {
        try {
          // Get current salary
          const currentSalary = await tx.query.employeeSalaries.findFirst({
            where: and(
              eq(employeeSalaries.employeeId, employeeId),
              isNull(employeeSalaries.effectiveTo)
            ),
          });

          if (!currentSalary) {
            throw new Error(`No active salary found for employee ${employeeId}`);
          }

          // Calculate new salary
          const newBaseSalary =
            updateType === 'absolute'
              ? value
              : currentSalary.baseSalary * (1 + value / 100);

          // Close current salary
          await tx
            .update(employeeSalaries)
            .set({
              effectiveTo: new Date(effectiveDate),
              updatedAt: new Date(),
            })
            .where(eq(employeeSalaries.id, currentSalary.id));

          // Insert new salary
          await tx.insert(employeeSalaries).values({
            tenantId: operation.tenantId,
            employeeId,
            baseSalary: newBaseSalary,
            effectiveFrom: new Date(effectiveDate),
            effectiveTo: null,
            currency: currentSalary.currency,
            payFrequency: currentSalary.payFrequency,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          successCount++;

          // Update progress
          await tx
            .update(batchOperations)
            .set({
              processedCount: successCount + errorCount,
              successCount,
              errorCount,
              updatedAt: new Date(),
            })
            .where(eq(batchOperations.id, operationId));
        } catch (error) {
          errorCount++;
          errors.push({
            entityId: employeeId,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          });

          // Continue processing other employees even if one fails
          console.error(`Error updating salary for employee ${employeeId}:`, error);
        }
      }

      // Create audit log for the bulk operation
      await tx.insert(auditLogs).values({
        tenantId: operation.tenantId,
        userId: operation.startedBy,
        action: 'bulk_salary_update',
        entityType: 'employee_salaries',
        entityId: operationId,
        metadata: {
          updateType,
          value,
          effectiveDate,
          employeeCount: employeeIds.length,
          successCount,
          errorCount,
        },
        createdAt: new Date(),
      });
    });

    // Mark operation as completed
    await db
      .update(batchOperations)
      .set({
        status: 'completed',
        processedCount: employeeIds.length,
        successCount,
        errorCount,
        errors,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(batchOperations.id, operationId));

    // Create alert for completion
    const user = await db.query.users.findFirst({
      where: eq(employees.id, operation.startedBy),
    });

    if (user) {
      await db.insert(alerts).values({
        tenantId: operation.tenantId,
        type: 'batch_operation_completed',
        severity: errorCount > 0 ? 'warning' : 'info',
        message:
          errorCount > 0
            ? `Mise à jour groupée terminée: ${successCount} succès, ${errorCount} erreurs`
            : `Mise à jour groupée terminée avec succès: ${successCount} salaires mis à jour`,
        assigneeId: operation.startedBy,
        actionUrl: `/batch-operations/${operationId}`,
        actionLabel: 'Voir les détails',
        status: 'active',
        metadata: {
          operationId,
          successCount,
          errorCount,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return {
      success: true,
      operationId,
      successCount,
      errorCount,
      errors,
    };
  } catch (error) {
    // Mark operation as failed
    await db
      .update(batchOperations)
      .set({
        status: 'failed',
        processedCount: successCount + errorCount,
        successCount,
        errorCount,
        errors,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(batchOperations.id, operationId));

    throw error;
  }
}

/**
 * Generic batch processor that can be extended for other operation types
 */
export async function processBatchOperation(operationId: string) {
  const operation = await db.query.batchOperations.findFirst({
    where: eq(batchOperations.id, operationId),
  });

  if (!operation) {
    throw new Error(`Batch operation ${operationId} not found`);
  }

  switch (operation.operationType) {
    case 'salary_update':
      return await processBulkSalaryUpdate(operationId);

    // Add more operation types here as they are implemented
    case 'document_generation':
      throw new Error('Document generation not yet implemented');

    case 'contract_renewal':
      throw new Error('Contract renewal not yet implemented');

    default:
      throw new Error(`Unknown operation type: ${operation.operationType}`);
  }
}

/**
 * Get the current salary for an employee
 */
async function getCurrentSalary(employeeId: string) {
  const salary = await db.query.employeeSalaries.findFirst({
    where: and(
      eq(employeeSalaries.employeeId, employeeId),
      isNull(employeeSalaries.effectiveTo)
    ),
  });

  return salary;
}

/**
 * Validate employees exist before batch operation
 */
export async function validateEmployeesForBatchOperation(
  employeeIds: string[],
  tenantId: string
) {
  const existingEmployees = await db.query.employees.findMany({
    where: and(
      inArray(employees.id, employeeIds),
      eq(employees.tenantId, tenantId)
    ),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  const existingIds = existingEmployees.map((e) => e.id);
  const missingIds = employeeIds.filter((id) => !existingIds.includes(id));

  if (missingIds.length > 0) {
    throw new Error(
      `Les employés suivants n'existent pas: ${missingIds.join(', ')}`
    );
  }

  return existingEmployees;
}

/**
 * Calculate preview for salary updates
 * Used by UI before confirming batch operation
 */
export async function calculateSalaryUpdatePreview(params: {
  employeeIds: string[];
  updateType: 'absolute' | 'percentage';
  value: number;
  tenantId: string;
}) {
  const { employeeIds, updateType, value, tenantId } = params;

  // Validate employees
  const validEmployees = await validateEmployeesForBatchOperation(
    employeeIds,
    tenantId
  );

  // Get current salaries
  const currentSalaries = await db.query.employeeSalaries.findMany({
    where: and(
      inArray(employeeSalaries.employeeId, employeeIds),
      isNull(employeeSalaries.effectiveTo)
    ),
  });

  // Calculate new salaries
  const preview = validEmployees.map((employee) => {
    const currentSalary = currentSalaries.find(
      (s) => s.employeeId === employee.id
    );

    if (!currentSalary) {
      return {
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        currentSalary: null,
        newSalary: null,
        change: null,
        error: 'Aucun salaire actif trouvé',
      };
    }

    const newSalary =
      updateType === 'absolute'
        ? value
        : currentSalary.baseSalary * (1 + value / 100);

    const change = newSalary - currentSalary.baseSalary;
    const changePercentage = (change / currentSalary.baseSalary) * 100;

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      currentSalary: currentSalary.baseSalary,
      newSalary,
      change,
      changePercentage,
      error: null,
    };
  });

  return preview;
}
