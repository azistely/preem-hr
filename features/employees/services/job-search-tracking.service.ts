/**
 * Job Search Days Tracking Service
 *
 * Convention Collective Article 40: During notice period, employee entitled to 2 days/week for job search
 */

import { db } from '@/db';
import { jobSearchDays, employeeTerminations, employees } from '@/drizzle/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

interface CreateJobSearchDayInput {
  terminationId: string;
  employeeId: string;
  tenantId: string;
  searchDate: string; // ISO date string
  dayType: 'full_day' | 'half_day';
  notes?: string;
  createdBy: string;
}

interface UpdateJobSearchDayInput {
  id: string;
  tenantId: string;
  status?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  notes?: string;
  approvedBy?: string;
  updatedBy: string;
}

interface ListJobSearchDaysInput {
  terminationId?: string;
  employeeId?: string;
  tenantId: string;
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

/**
 * Create a job search day request
 */
export async function createJobSearchDay(input: CreateJobSearchDayInput) {
  // 1. Validate termination exists and is in notice period
  const [termination] = await db
    .select()
    .from(employeeTerminations)
    .where(
      and(
        eq(employeeTerminations.id, input.terminationId),
        eq(employeeTerminations.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!termination) {
    throw new Error('Termination not found');
  }

  if (termination.status !== 'notice_period') {
    throw new Error('Employee is not in notice period');
  }

  // 2. Validate search date is within notice period
  const searchDate = new Date(input.searchDate);
  const terminationDate = new Date(termination.terminationDate);
  const noticeStartDate = new Date(terminationDate);
  noticeStartDate.setDate(noticeStartDate.getDate() - termination.noticePeriodDays);

  if (searchDate < noticeStartDate || searchDate > terminationDate) {
    throw new Error('Search date must be within the notice period');
  }

  // 3. Check if search day already exists for this date
  const [existing] = await db
    .select()
    .from(jobSearchDays)
    .where(
      and(
        eq(jobSearchDays.terminationId, input.terminationId),
        eq(jobSearchDays.searchDate, input.searchDate)
      )
    )
    .limit(1);

  if (existing) {
    throw new Error('Job search day already recorded for this date');
  }

  // 4. Calculate hours based on day type
  const hoursTaken = input.dayType === 'full_day' ? '8.00' : '4.00';

  // 5. Create job search day record
  const [jobSearchDay] = await db
    .insert(jobSearchDays)
    .values({
      terminationId: input.terminationId,
      employeeId: input.employeeId,
      tenantId: input.tenantId,
      searchDate: input.searchDate,
      dayType: input.dayType,
      hoursTaken,
      notes: input.notes,
      status: 'pending',
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    })
    .returning();

  return jobSearchDay;
}

/**
 * Update job search day (approve/reject)
 */
export async function updateJobSearchDay(input: UpdateJobSearchDayInput) {
  const updateData: any = {
    updatedBy: input.updatedBy,
    updatedAt: new Date().toISOString(),
  };

  if (input.status) {
    updateData.status = input.status;

    if (input.status === 'approved') {
      updateData.approvedBy = input.approvedBy;
      updateData.approvedAt = new Date().toISOString();
      updateData.rejectionReason = null;
    } else if (input.status === 'rejected') {
      updateData.rejectionReason = input.rejectionReason;
      updateData.approvedBy = null;
      updateData.approvedAt = null;
    }
  }

  if (input.notes !== undefined) {
    updateData.notes = input.notes;
  }

  const [updated] = await db
    .update(jobSearchDays)
    .set(updateData)
    .where(
      and(
        eq(jobSearchDays.id, input.id),
        eq(jobSearchDays.tenantId, input.tenantId)
      )
    )
    .returning();

  if (!updated) {
    throw new Error('Job search day not found');
  }

  return updated;
}

/**
 * List job search days with filters
 */
export async function listJobSearchDays(input: ListJobSearchDaysInput) {
  const conditions = [eq(jobSearchDays.tenantId, input.tenantId)];

  if (input.terminationId) {
    conditions.push(eq(jobSearchDays.terminationId, input.terminationId));
  }

  if (input.employeeId) {
    conditions.push(eq(jobSearchDays.employeeId, input.employeeId));
  }

  if (input.startDate) {
    conditions.push(gte(jobSearchDays.searchDate, input.startDate));
  }

  if (input.endDate) {
    conditions.push(lte(jobSearchDays.searchDate, input.endDate));
  }

  if (input.status) {
    conditions.push(eq(jobSearchDays.status, input.status));
  }

  const days = await db
    .select()
    .from(jobSearchDays)
    .where(and(...conditions))
    .orderBy(desc(jobSearchDays.searchDate));

  return days;
}

/**
 * Get job search day by ID
 */
export async function getJobSearchDayById(id: string, tenantId: string) {
  const [day] = await db
    .select()
    .from(jobSearchDays)
    .where(
      and(
        eq(jobSearchDays.id, id),
        eq(jobSearchDays.tenantId, tenantId)
      )
    )
    .limit(1);

  return day || null;
}

/**
 * Delete job search day
 */
export async function deleteJobSearchDay(id: string, tenantId: string) {
  const [deleted] = await db
    .delete(jobSearchDays)
    .where(
      and(
        eq(jobSearchDays.id, id),
        eq(jobSearchDays.tenantId, tenantId)
      )
    )
    .returning();

  if (!deleted) {
    throw new Error('Job search day not found');
  }

  return deleted;
}

/**
 * Get job search statistics for a termination
 */
export async function getJobSearchStats(terminationId: string, tenantId: string) {
  const [termination] = await db
    .select()
    .from(employeeTerminations)
    .where(
      and(
        eq(employeeTerminations.id, terminationId),
        eq(employeeTerminations.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!termination) {
    throw new Error('Termination not found');
  }

  // Calculate notice period date range
  const terminationDate = new Date(termination.terminationDate);
  const noticeStartDate = new Date(terminationDate);
  noticeStartDate.setDate(noticeStartDate.getDate() - termination.noticePeriodDays);

  // Get all job search days for this termination
  const days = await db
    .select()
    .from(jobSearchDays)
    .where(
      and(
        eq(jobSearchDays.terminationId, terminationId),
        eq(jobSearchDays.tenantId, tenantId)
      )
    );

  // Calculate statistics
  const totalDaysRequested = days.length;
  const approvedDays = days.filter(d => d.status === 'approved').length;
  const pendingDays = days.filter(d => d.status === 'pending').length;
  const rejectedDays = days.filter(d => d.status === 'rejected').length;

  const totalHoursRequested = days.reduce((sum, d) => sum + parseFloat(d.hoursTaken), 0);
  const approvedHours = days
    .filter(d => d.status === 'approved')
    .reduce((sum, d) => sum + parseFloat(d.hoursTaken), 0);

  // Calculate entitled days (2 days per week)
  const noticePeriodWeeks = Math.ceil(termination.noticePeriodDays / 7);
  const entitledDays = noticePeriodWeeks * 2;
  const remainingDays = Math.max(0, entitledDays - approvedDays);

  return {
    noticeStartDate: noticeStartDate.toISOString().split('T')[0],
    noticePeriodDays: termination.noticePeriodDays,
    entitledDays,
    totalDaysRequested,
    approvedDays,
    pendingDays,
    rejectedDays,
    remainingDays,
    totalHoursRequested,
    approvedHours,
    utilizationPercentage: entitledDays > 0 ? (approvedDays / entitledDays) * 100 : 0,
  };
}
