/**
 * Time Entry Service
 *
 * Handles clock in/out operations with:
 * - Geofence validation
 * - Photo verification
 * - Overtime detection
 * - Duplicate prevention
 */

import { db } from '@/db';
import { timeEntries, employees, tenants } from '@/drizzle/schema';
import { and, eq, isNull, desc, sql } from 'drizzle-orm';
import { validateGeofence, type GeoLocation } from './geofence.service';
import { classifyOvertimeHours } from './overtime.service';
import { validateShiftLength } from '@/lib/compliance/shift-validation.service';

export interface ClockInInput {
  employeeId: string;
  tenantId: string;
  location?: GeoLocation;
  photoUrl?: string;
}

export interface ClockOutInput {
  employeeId: string;
  tenantId: string;
  location?: GeoLocation;
  photoUrl?: string;
}

export class TimeEntryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TimeEntryError';
  }
}

/**
 * Clock in employee
 */
export async function clockIn(input: ClockInInput) {
  const { employeeId, tenantId, location, photoUrl } = input;

  // Check for existing open time entry
  const openEntry = await db.query.timeEntries.findFirst({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      eq(timeEntries.tenantId, tenantId),
      isNull(timeEntries.clockOut)
    ),
    orderBy: [desc(timeEntries.clockIn)],
  });

  if (openEntry) {
    throw new TimeEntryError(
      'Vous avez déjà pointé votre arrivée',
      'ALREADY_CLOCKED_IN',
      { existingEntryId: openEntry.id }
    );
  }

  // Validate geofence if location provided
  let geofenceVerified = false;
  if (location) {
    const validation = await validateGeofence(tenantId, location);

    if (!validation.isValid) {
      throw new TimeEntryError(
        validation.reason || 'Vous êtes trop loin du lieu de travail',
        'GEOFENCE_VIOLATION',
        { distance: validation.distance }
      );
    }

    geofenceVerified = true;
  }

  // Create time entry
  const clockInTime = new Date();

  const [newEntry] = await db
    .insert(timeEntries)
    .values({
      tenantId,
      employeeId,
      clockIn: clockInTime.toISOString(),
      clockInLocation: location
        ? sql`ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography`
        : null,
      clockInPhotoUrl: photoUrl || null,
      geofenceVerified,
      status: 'pending',
    })
    .returning();

  return newEntry;
}

/**
 * Clock out employee
 */
export async function clockOut(input: ClockOutInput) {
  const { employeeId, tenantId, location, photoUrl } = input;

  // Find open time entry
  const openEntry = await db.query.timeEntries.findFirst({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      eq(timeEntries.tenantId, tenantId),
      isNull(timeEntries.clockOut)
    ),
    orderBy: [desc(timeEntries.clockIn)],
  });

  if (!openEntry) {
    throw new TimeEntryError(
      "Vous n'avez pas pointé votre arrivée",
      'NO_CLOCK_IN',
      { employeeId }
    );
  }

  // Validate geofence if location provided
  if (location && openEntry.geofenceVerified) {
    const validation = await validateGeofence(tenantId, location);

    if (!validation.isValid) {
      throw new TimeEntryError(
        validation.reason || 'Vous êtes trop loin du lieu de travail',
        'GEOFENCE_VIOLATION',
        { distance: validation.distance }
      );
    }
  }

  // Calculate hours worked
  const clockOutTime = new Date();
  const clockInTime = new Date(openEntry.clockIn);
  const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

  // Get employee and tenant to determine country and sector
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    throw new TimeEntryError('Employé non trouvé', 'EMPLOYEE_NOT_FOUND', { employeeId });
  }

  const [tenant] = await db
    .select({
      countryCode: tenants.countryCode,
      sectorCode: tenants.sectorCode,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const countryCode = tenant?.countryCode || 'CI';
  const sectorCode = tenant?.sectorCode || 'SERVICES';

  // Validate shift length for restricted sectors (GAP-SEC-003)
  const shiftValidation = validateShiftLength(clockInTime, clockOutTime, sectorCode);

  if (!shiftValidation.isValid) {
    throw new TimeEntryError(
      shiftValidation.errorMessage || 'Durée de quart invalide',
      'SHIFT_LENGTH_VIOLATION',
      {
        shiftLength: shiftValidation.shiftLength,
        maxAllowed: shiftValidation.maxAllowed,
        sectorCode: shiftValidation.sectorCode,
      }
    );
  }

  // Classify overtime
  const overtimeBreakdown = await classifyOvertimeHours(
    employeeId,
    clockInTime,
    clockOutTime,
    countryCode
  );

  // Determine entry type
  let entryType = 'regular';
  if (overtimeBreakdown.hours_above_46 || overtimeBreakdown.hours_41_to_46) {
    entryType = 'overtime';
  }
  if (overtimeBreakdown.night_work) {
    entryType = 'overtime'; // Night work is always overtime
  }

  // Update time entry
  const [updatedEntry] = await db
    .update(timeEntries)
    .set({
      clockOut: clockOutTime.toISOString(),
      clockOutLocation: location
        ? sql`ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography`
        : null,
      clockOutPhotoUrl: photoUrl || null,
      totalHours: totalHours.toFixed(2),
      entryType,
      overtimeBreakdown: overtimeBreakdown as any,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(timeEntries.id, openEntry.id))
    .returning();

  return updatedEntry;
}

/**
 * Get current time entry for employee
 */
export async function getCurrentTimeEntry(employeeId: string, tenantId: string) {
  const entry = await db.query.timeEntries.findFirst({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      eq(timeEntries.tenantId, tenantId),
      isNull(timeEntries.clockOut)
    ),
    orderBy: [desc(timeEntries.clockIn)],
  });

  // React Query requires non-undefined return values
  return entry ?? null;
}

/**
 * Get time entries for employee in date range
 */
export async function getTimeEntries(
  employeeId: string,
  tenantId: string,
  startDate: Date,
  endDate: Date
) {
  return await db.query.timeEntries.findMany({
    where: and(
      eq(timeEntries.employeeId, employeeId),
      eq(timeEntries.tenantId, tenantId)
    ),
    orderBy: [desc(timeEntries.clockIn)],
  });
}

/**
 * Approve time entry
 */
export async function approveTimeEntry(
  entryId: string,
  approvedBy: string
) {
  const [approvedEntry] = await db
    .update(timeEntries)
    .set({
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(timeEntries.id, entryId))
    .returning();

  return approvedEntry;
}

/**
 * Reject time entry
 */
export async function rejectTimeEntry(
  entryId: string,
  approvedBy: string,
  rejectionReason: string
) {
  const [rejectedEntry] = await db
    .update(timeEntries)
    .set({
      status: 'rejected',
      approvedBy,
      approvedAt: new Date().toISOString(),
      rejectionReason,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(timeEntries.id, entryId))
    .returning();

  return rejectedEntry;
}

/**
 * Manual Time Entry Functions
 */

export interface CreateManualTimeEntryInput {
  employeeId: string;
  tenantId: string;
  workDate: string; // YYYY-MM-DD
  clockIn: string; // ISO timestamp
  clockOut: string; // ISO timestamp
  totalHours: number;
  locationId?: string;
  notes?: string;
  approvedBy?: string; // User ID of approver (HR manager/tenant admin auto-approve)
}

/**
 * Create manual time entry
 * For managers/HR to enter hours for employees
 */
export async function createManualTimeEntry(input: CreateManualTimeEntryInput) {
  const { employeeId, tenantId, workDate, clockIn, clockOut, totalHours, locationId, notes } = input;

  // Get employee and tenant to determine country
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    throw new TimeEntryError('Employé non trouvé', 'EMPLOYEE_NOT_FOUND', { employeeId });
  }

  const [tenant] = await db
    .select({
      countryCode: tenants.countryCode,
      sectorCode: tenants.sectorCode,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const countryCode = tenant?.countryCode || 'CI';

  // Parse timestamps
  const clockInTime = new Date(clockIn);
  const clockOutTime = new Date(clockOut);

  // Classify overtime
  const overtimeBreakdown = await classifyOvertimeHours(
    employeeId,
    clockInTime,
    clockOutTime,
    countryCode
  );

  // Determine entry type
  let entryType = 'regular';
  if (overtimeBreakdown.hours_above_46 || overtimeBreakdown.hours_41_to_46) {
    entryType = 'overtime';
  }
  if (overtimeBreakdown.night_work) {
    entryType = 'overtime';
  }

  // Create manual entry
  // If approvedBy is provided (HR manager/tenant admin), auto-approve the entry
  const status = input.approvedBy ? 'approved' : 'pending';
  const approvedAt = input.approvedBy ? new Date().toISOString() : null;

  const [newEntry] = await db
    .insert(timeEntries)
    .values({
      tenantId,
      employeeId,
      clockIn: clockInTime.toISOString(),
      clockOut: clockOutTime.toISOString(),
      totalHours: totalHours.toString(),
      entrySource: 'manual' as const,
      entryType,
      overtimeBreakdown: overtimeBreakdown as any,
      locationId: locationId || null,
      notes: notes || null,
      status: status as any,
      geofenceVerified: false,
      approvedBy: input.approvedBy || null,
      approvedAt: approvedAt as any,
    })
    .returning();

  return newEntry;
}

/**
 * Update manual time entry
 */
export async function updateManualTimeEntry(
  entryId: string,
  tenantId: string,
  updates: {
    clockIn?: string;
    clockOut?: string;
    totalHours?: number;
    notes?: string;
  }
) {
  // Get existing entry
  const existing = await db.query.timeEntries.findFirst({
    where: and(
      eq(timeEntries.id, entryId),
      eq(timeEntries.tenantId, tenantId),
      eq(timeEntries.entrySource, 'manual')
    ),
  });

  if (!existing) {
    throw new TimeEntryError('Entrée non trouvée', 'ENTRY_NOT_FOUND', { entryId });
  }

  // If clock times changed, recalculate overtime
  let overtimeBreakdown = existing.overtimeBreakdown;
  let entryType = existing.entryType;

  if (updates.clockIn || updates.clockOut) {
    const clockInTime = new Date(updates.clockIn || existing.clockIn);
    const clockOutTime = new Date(updates.clockOut || existing.clockOut || existing.clockIn);

    // Get tenant country code
    const [tenant] = await db
      .select({ countryCode: tenants.countryCode })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const countryCode = tenant?.countryCode || 'CI';

    const newOvertimeBreakdown = await classifyOvertimeHours(
      existing.employeeId,
      clockInTime,
      clockOutTime,
      countryCode
    );

    overtimeBreakdown = newOvertimeBreakdown as any;

    entryType = 'regular';
    if (newOvertimeBreakdown.hours_above_46 || newOvertimeBreakdown.hours_41_to_46) {
      entryType = 'overtime';
    }
    if (newOvertimeBreakdown.night_work) {
      entryType = 'overtime';
    }
  }

  const [updatedEntry] = await db
    .update(timeEntries)
    .set({
      clockIn: updates.clockIn || existing.clockIn,
      clockOut: updates.clockOut || existing.clockOut,
      totalHours: updates.totalHours?.toString() || existing.totalHours,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      overtimeBreakdown: overtimeBreakdown as any,
      entryType,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(timeEntries.id, entryId))
    .returning();

  return updatedEntry;
}

/**
 * Delete manual time entry
 */
export async function deleteManualTimeEntry(entryId: string, tenantId: string) {
  const [deletedEntry] = await db
    .delete(timeEntries)
    .where(
      and(
        eq(timeEntries.id, entryId),
        eq(timeEntries.tenantId, tenantId),
        eq(timeEntries.entrySource, 'manual')
      )
    )
    .returning();

  if (!deletedEntry) {
    throw new TimeEntryError('Entrée non trouvée', 'ENTRY_NOT_FOUND', { entryId });
  }

  return deletedEntry;
}

/**
 * Get manual time entries for period
 */
export async function getManualTimeEntriesForPeriod(
  tenantId: string,
  startDate: Date,
  endDate: Date
) {
  console.log('[getManualTimeEntriesForPeriod] Service called with:', {
    tenantId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  // Use manual join instead of with: clause (TypeScript best practice)
  const result = await db
    .select({
      id: timeEntries.id,
      tenantId: timeEntries.tenantId,
      employeeId: timeEntries.employeeId,
      clockIn: timeEntries.clockIn,
      clockOut: timeEntries.clockOut,
      totalHours: timeEntries.totalHours,
      entrySource: timeEntries.entrySource,
      locationId: timeEntries.locationId,
      geofenceVerified: timeEntries.geofenceVerified,
      clockInLocation: timeEntries.clockInLocation,
      clockOutLocation: timeEntries.clockOutLocation,
      clockInPhotoUrl: timeEntries.clockInPhotoUrl,
      clockOutPhotoUrl: timeEntries.clockOutPhotoUrl,
      entryType: timeEntries.entryType,
      status: timeEntries.status,
      approvedBy: timeEntries.approvedBy,
      approvedAt: timeEntries.approvedAt,
      rejectionReason: timeEntries.rejectionReason,
      notes: timeEntries.notes,
      overtimeBreakdown: timeEntries.overtimeBreakdown,
      createdAt: timeEntries.createdAt,
      updatedAt: timeEntries.updatedAt,
      employee: {
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        employeeNumber: employees.employeeNumber,
        email: employees.email,
        status: employees.status,
      },
    })
    .from(timeEntries)
    .innerJoin(employees, eq(timeEntries.employeeId, employees.id))
    .where(
      and(
        eq(timeEntries.tenantId, tenantId),
        eq(timeEntries.entrySource, 'manual'),
        sql`${timeEntries.clockIn} >= ${startDate.toISOString()}`,
        sql`${timeEntries.clockIn} < ${endDate.toISOString()}`
      )
    )
    .orderBy(desc(timeEntries.clockIn));

  console.log('[getManualTimeEntriesForPeriod] DB result:', {
    count: result.length,
    entries: result,
  });

  return result;
}
