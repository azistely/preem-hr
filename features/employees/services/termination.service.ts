/**
 * Employee Termination Service
 *
 * Purpose: Handle employee terminations with all terminal calculations,
 * document generation tracking, and workflow management
 *
 * Compliance: Convention Collective Articles 35-40
 */

import { db } from '@/db';
import { employeeTerminations, employees } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

export interface CreateTerminationInput {
  employeeId: string;
  tenantId: string;
  terminationDate: Date;
  terminationReason: string;
  notes?: string;
  noticePeriodDays: number;
  severanceAmount: number;
  vacationPayoutAmount?: number;
  averageSalary12m: number;
  yearsOfService: number;
  severanceRate: number;
  createdBy: string;
  createdByEmail: string;
}

export interface UpdateTerminationInput {
  id: string;
  tenantId: string;
  status?: string;
  workCertificateUrl?: string;
  finalPayslipUrl?: string;
  cnpsAttestationUrl?: string;
  updatedBy: string;
  updatedByEmail: string;
}

/**
 * Create a new termination record
 */
export async function createTermination(input: CreateTerminationInput) {
  // Insert termination record
  const [termination] = await db
    .insert(employeeTerminations)
    .values({
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      terminationDate: input.terminationDate.toISOString().split('T')[0],
      terminationReason: input.terminationReason,
      notes: input.notes,
      noticePeriodDays: input.noticePeriodDays,
      severanceAmount: input.severanceAmount.toString(),
      vacationPayoutAmount: input.vacationPayoutAmount?.toString() || '0',
      averageSalary12m: input.averageSalary12m.toString(),
      yearsOfService: input.yearsOfService.toString(),
      severanceRate: input.severanceRate,
      status: 'pending',
      createdBy: input.createdBy,
      createdByEmail: input.createdByEmail,
    })
    .returning();

  // Update employee record
  await db
    .update(employees)
    .set({
      status: 'terminated',
      terminationDate: input.terminationDate.toISOString().split('T')[0],
      terminationReason: input.terminationReason,
      terminationId: termination.id,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(employees.id, input.employeeId),
        eq(employees.tenantId, input.tenantId)
      )
    );

  // Emit termination event
  await eventBus.publish('employee.terminated', {
    employeeId: input.employeeId,
    tenantId: input.tenantId,
    terminationDate: input.terminationDate,
    terminationId: termination.id,
    severanceAmount: input.severanceAmount,
    noticePeriodDays: input.noticePeriodDays,
  });

  return termination;
}

/**
 * Update termination record (mainly for document URLs and status)
 */
export async function updateTermination(input: UpdateTerminationInput) {
  const updateData: any = {
    updatedBy: input.updatedBy,
    updatedByEmail: input.updatedByEmail,
    updatedAt: new Date().toISOString(),
  };

  if (input.status) updateData.status = input.status;
  if (input.workCertificateUrl) {
    updateData.workCertificateUrl = input.workCertificateUrl;
    updateData.workCertificateGeneratedAt = new Date().toISOString();
  }
  if (input.finalPayslipUrl) {
    updateData.finalPayslipUrl = input.finalPayslipUrl;
    updateData.finalPayslipGeneratedAt = new Date().toISOString();
  }
  if (input.cnpsAttestationUrl) {
    updateData.cnpsAttestationUrl = input.cnpsAttestationUrl;
    updateData.cnpsAttestationGeneratedAt = new Date().toISOString();
  }

  const [termination] = await db
    .update(employeeTerminations)
    .set(updateData)
    .where(
      and(
        eq(employeeTerminations.id, input.id),
        eq(employeeTerminations.tenantId, input.tenantId)
      )
    )
    .returning();

  return termination;
}

/**
 * Get termination by ID
 */
export async function getTerminationById(id: string, tenantId: string) {
  const [termination] = await db
    .select()
    .from(employeeTerminations)
    .where(
      and(
        eq(employeeTerminations.id, id),
        eq(employeeTerminations.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!termination) {
    throw new Error('Termination not found');
  }

  return termination;
}

/**
 * Get termination by employee ID
 */
export async function getTerminationByEmployeeId(employeeId: string, tenantId: string) {
  const [termination] = await db
    .select()
    .from(employeeTerminations)
    .where(
      and(
        eq(employeeTerminations.employeeId, employeeId),
        eq(employeeTerminations.tenantId, tenantId)
      )
    )
    .orderBy(employeeTerminations.createdAt)
    .limit(1);

  return termination || null;
}

/**
 * List all terminations for a tenant
 */
export async function listTerminations(tenantId: string, options?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  let query = db
    .select()
    .from(employeeTerminations)
    .where(eq(employeeTerminations.tenantId, tenantId))
    .orderBy(employeeTerminations.terminationDate);

  if (options?.status) {
    query = query.where(
      and(
        eq(employeeTerminations.tenantId, tenantId),
        eq(employeeTerminations.status, options.status)
      )
    ) as any;
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return query;
}
