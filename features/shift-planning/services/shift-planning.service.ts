/**
 * Shift Planning Service
 *
 * Core business logic for shift planning system:
 * - Creating and managing planned shifts
 * - Bulk scheduling operations
 * - Publishing schedules (draft → published)
 * - Contract-aware scheduling (CDDTI vs CDI/CDD)
 * - Integration with conflict detection
 *
 * @module shift-planning/services/shift-planning
 */

import { db } from '@/lib/db';
import {
  plannedShifts,
  shiftTemplates,
  type PlannedShift,
  type NewPlannedShift,
  type ShiftTemplate,
} from '@/lib/db/schema/shift-planning';
import { employees } from '@/lib/db/schema/employees';
import { eq, and, between, sql, inArray, or, gte, lte } from 'drizzle-orm';
import { checkAllConflicts, type ConflictCheck } from './shift-conflict-checker.service';
import { getShiftTemplateById } from './shift-template.service';

// ============================================
// Error Classes
// ============================================

export class ShiftPlanningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShiftPlanningError';
  }
}

export class ShiftConflictError extends ShiftPlanningError {
  conflicts: ConflictCheck;

  constructor(message: string, conflicts: ConflictCheck) {
    super(message);
    this.name = 'ShiftConflictError';
    this.conflicts = conflicts;
  }
}

// ============================================
// Types
// ============================================

export interface CreateShiftInput {
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  tenantId: string;
  shiftTemplateId?: string;
  breakMinutes?: number;
  notes?: string;
  createdBy?: string;
  skipConflictCheck?: boolean; // For bulk operations
}

export interface BulkCreateShiftsInput {
  employeeIds: string[];
  shiftDates: string[];
  shiftTemplateId: string;
  tenantId: string;
  createdBy?: string;
  stopOnConflict?: boolean; // If true, stop on first conflict
}

export interface ScheduleFilters {
  tenantId: string;
  startDate: string;
  endDate: string;
  employeeId?: string;
  departmentId?: string;
  status?: string;
}

export interface BulkCreateResult {
  created: PlannedShift[];
  conflicts: Array<{
    employeeId: string;
    shiftDate: string;
    conflicts: ConflictCheck;
  }>;
  totalAttempted: number;
  totalCreated: number;
  totalConflicts: number;
}

// ============================================
// Main Shift Creation
// ============================================

/**
 * Create a single planned shift with conflict detection
 *
 * @param input - Shift creation data
 * @returns Created shift with contract details
 *
 * @throws {ShiftConflictError} If conflicts detected and skipConflictCheck is false
 * @throws {ShiftPlanningError} For other errors (employee not found, etc.)
 *
 * @example
 * ```typescript
 * const shift = await createPlannedShift({
 *   employeeId: "...",
 *   shiftDate: "2025-11-10",
 *   startTime: "08:00:00",
 *   endTime: "16:00:00",
 *   tenantId: "...",
 *   shiftTemplateId: "..." // Optional
 * });
 * ```
 */
export async function createPlannedShift(
  input: CreateShiftInput
): Promise<PlannedShift> {
  try {
    // 1. Get employee details (for contract info)
    const [employee] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.id, input.employeeId), eq(employees.tenantId, input.tenantId)))
      .limit(1);

    if (!employee) {
      throw new ShiftPlanningError('Employé non trouvé');
    }

    // 2. Check for conflicts (unless skipped)
    if (!input.skipConflictCheck) {
      const conflictCheck = await checkAllConflicts({
        employeeId: input.employeeId,
        shiftDate: input.shiftDate,
        startTime: input.startTime,
        endTime: input.endTime,
        tenantId: input.tenantId,
      });

      if (conflictCheck.hasConflicts) {
        throw new ShiftConflictError(
          'Impossible de créer le quart: conflits détectés',
          conflictCheck
        );
      }
    }

    // 3. Calculate duration and paid hours
    const duration = calculateShiftDuration(input.startTime, input.endTime);
    const paidHours = duration - (input.breakMinutes ?? 0) / 60;

    // 4. Get template details if provided
    let template: ShiftTemplate | null = null;
    if (input.shiftTemplateId) {
      template = await getShiftTemplateById(input.shiftTemplateId, input.tenantId);
    }

    // 5. Prepare shift data
    const shiftData: NewPlannedShift = {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      shiftDate: input.shiftDate,
      startTime: input.startTime,
      endTime: input.endTime,
      shiftTemplateId: input.shiftTemplateId,
      breakMinutes: input.breakMinutes ?? template?.breakMinutes ?? 0,
      durationHours: duration.toString(),
      paidHours: paidHours.toString(),
      notes: input.notes,
      createdBy: input.createdBy,

      // Contract details (for payroll integration)
      contractId: employee.currentContractId ?? undefined,
      contractType: employee.contractType ?? undefined,

      // Status
      status: 'draft',
      hasConflicts: false,
    };

    // 6. Insert shift
    const [created] = await db
      .insert(plannedShifts)
      .values(shiftData)
      .returning();

    return created;
  } catch (error) {
    if (error instanceof ShiftConflictError || error instanceof ShiftPlanningError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors de la création du quart: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Create a shift from a template
 *
 * @param templateId - Template ID
 * @param employeeId - Employee ID
 * @param shiftDate - Shift date
 * @param tenantId - Tenant ID
 * @param createdBy - Creator user ID
 * @returns Created shift
 */
export async function createShiftFromTemplate(
  templateId: string,
  employeeId: string,
  shiftDate: string,
  tenantId: string,
  createdBy?: string
): Promise<PlannedShift> {
  try {
    const template = await getShiftTemplateById(templateId, tenantId);

    if (!template) {
      throw new ShiftPlanningError('Modèle non trouvé');
    }

    if (!template.isActive) {
      throw new ShiftPlanningError('Modèle inactif');
    }

    return await createPlannedShift({
      employeeId,
      shiftDate,
      startTime: template.startTime,
      endTime: template.endTime,
      breakMinutes: template.breakMinutes ?? undefined,
      tenantId,
      shiftTemplateId: templateId,
      createdBy,
    });
  } catch (error) {
    if (error instanceof ShiftPlanningError) throw error;
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors de la création depuis modèle: ${error.message}`
      );
    }
    throw error;
  }
}

// ============================================
// Bulk Operations
// ============================================

/**
 * Bulk create shifts for multiple employees/dates
 *
 * Useful for creating a week's worth of shifts at once.
 * Returns both successful creations and conflicts.
 *
 * @param input - Bulk creation parameters
 * @returns Result with created shifts and conflicts
 *
 * @example
 * ```typescript
 * const result = await bulkCreateShifts({
 *   employeeIds: ["emp1", "emp2", "emp3"],
 *   shiftDates: ["2025-11-10", "2025-11-11", "2025-11-12"],
 *   shiftTemplateId: "morning-shift",
 *   tenantId: "...",
 *   stopOnConflict: false // Continue even if conflicts
 * });
 *
 * console.log(`Created ${result.totalCreated} of ${result.totalAttempted} shifts`);
 * console.log(`Conflicts: ${result.totalConflicts}`);
 * ```
 */
export async function bulkCreateShifts(
  input: BulkCreateShiftsInput
): Promise<BulkCreateResult> {
  const result: BulkCreateResult = {
    created: [],
    conflicts: [],
    totalAttempted: 0,
    totalCreated: 0,
    totalConflicts: 0,
  };

  try {
    // Get template
    const template = await getShiftTemplateById(input.shiftTemplateId, input.tenantId);
    if (!template) {
      throw new ShiftPlanningError('Modèle non trouvé');
    }

    // Create shifts for each employee × date combination
    for (const employeeId of input.employeeIds) {
      for (const shiftDate of input.shiftDates) {
        result.totalAttempted++;

        try {
          const shift = await createPlannedShift({
            employeeId,
            shiftDate,
            startTime: template.startTime,
            endTime: template.endTime,
            breakMinutes: template.breakMinutes ?? undefined,
            tenantId: input.tenantId,
            shiftTemplateId: input.shiftTemplateId,
            createdBy: input.createdBy,
            skipConflictCheck: false, // Always check conflicts
          });

          result.created.push(shift);
          result.totalCreated++;
        } catch (error) {
          if (error instanceof ShiftConflictError) {
            result.conflicts.push({
              employeeId,
              shiftDate,
              conflicts: error.conflicts,
            });
            result.totalConflicts++;

            if (input.stopOnConflict) {
              break; // Stop processing
            }
          } else {
            // Other errors should bubble up
            throw error;
          }
        }
      }

      if (input.stopOnConflict && result.totalConflicts > 0) {
        break; // Stop processing employees
      }
    }

    return result;
  } catch (error) {
    if (error instanceof ShiftPlanningError) throw error;
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors de la création en masse: ${error.message}`
      );
    }
    throw error;
  }
}

// ============================================
// Status Management
// ============================================

/**
 * Publish a schedule (move shifts from draft to published)
 *
 * Published shifts are visible to employees and used for payroll.
 * Once published, shifts require special approval to modify.
 *
 * @param tenantId - Tenant ID
 * @param startDate - Week start date
 * @param endDate - Week end date
 * @param publishedBy - User ID publishing the schedule
 * @returns Number of shifts published
 *
 * @example
 * ```typescript
 * // Publish shifts for the week of Nov 10-16
 * const count = await publishSchedule(
 *   "tenant-id",
 *   "2025-11-10",
 *   "2025-11-16",
 *   "user-id"
 * );
 * console.log(`Published ${count} shifts`);
 * ```
 */
export async function publishSchedule(
  tenantId: string,
  startDate: string,
  endDate: string,
  publishedBy?: string
): Promise<number> {
  try {
    // Only publish draft shifts without conflicts
    // In West African context, published shifts are automatically confirmed (no employee confirmation needed)
    const now = new Date();
    const result = await db
      .update(plannedShifts)
      .set({
        status: 'published',
        publishedAt: now,
        publishedBy,
        confirmedAt: now, // Auto-confirm when published
        confirmedBy: publishedBy, // Manager confirms on behalf of employee
        updatedAt: now,
      })
      .where(
        and(
          eq(plannedShifts.tenantId, tenantId),
          eq(plannedShifts.status, 'draft'),
          eq(plannedShifts.hasConflicts, false),
          between(plannedShifts.shiftDate, startDate, endDate)
        )
      )
      .returning();

    return result.length;
  } catch (error) {
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors de la publication: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Cancel a planned shift
 *
 * @param shiftId - Shift ID
 * @param tenantId - Tenant ID (for security)
 * @param cancelledBy - User ID cancelling the shift
 * @param reason - Cancellation reason
 * @returns Updated shift
 */
export async function cancelShift(
  shiftId: string,
  tenantId: string,
  cancelledBy?: string,
  reason?: string
): Promise<PlannedShift> {
  try {
    const [cancelled] = await db
      .update(plannedShifts)
      .set({
        status: 'cancelled',
        notes: reason ? `Annulé: ${reason}` : 'Annulé',
        updatedAt: new Date(),
      })
      .where(and(eq(plannedShifts.id, shiftId), eq(plannedShifts.tenantId, tenantId)))
      .returning();

    if (!cancelled) {
      throw new ShiftPlanningError('Quart non trouvé');
    }

    return cancelled;
  } catch (error) {
    if (error instanceof ShiftPlanningError) throw error;
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors de l'annulation: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Mark a shift as confirmed by employee
 *
 * @param shiftId - Shift ID
 * @param tenantId - Tenant ID (for security)
 * @param confirmedBy - Employee user ID
 * @returns Updated shift
 */
export async function confirmShift(
  shiftId: string,
  tenantId: string,
  confirmedBy: string
): Promise<PlannedShift> {
  try {
    const [confirmed] = await db
      .update(plannedShifts)
      .set({
        confirmedAt: new Date(),
        confirmedBy,
        updatedAt: new Date(),
      })
      .where(and(eq(plannedShifts.id, shiftId), eq(plannedShifts.tenantId, tenantId)))
      .returning();

    if (!confirmed) {
      throw new ShiftPlanningError('Quart non trouvé');
    }

    return confirmed;
  } catch (error) {
    if (error instanceof ShiftPlanningError) throw error;
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors de la confirmation: ${error.message}`
      );
    }
    throw error;
  }
}

// ============================================
// Querying Schedules
// ============================================

/**
 * Get weekly schedule for a specific date range
 *
 * @param filters - Query filters
 * @returns Array of planned shifts with employee details
 *
 * @example
 * ```typescript
 * // Get all shifts for the week of Nov 10-16
 * const shifts = await getWeeklySchedule({
 *   tenantId: "...",
 *   startDate: "2025-11-10",
 *   endDate: "2025-11-16"
 * });
 *
 * // Get shifts for specific employee
 * const employeeShifts = await getWeeklySchedule({
 *   tenantId: "...",
 *   startDate: "2025-11-10",
 *   endDate: "2025-11-16",
 *   employeeId: "emp-123"
 * });
 * ```
 */
export async function getWeeklySchedule(
  filters: ScheduleFilters
): Promise<Array<PlannedShift & { employee?: any }>> {
  try {
    const conditions = [
      eq(plannedShifts.tenantId, filters.tenantId),
      between(plannedShifts.shiftDate, filters.startDate, filters.endDate),
    ];

    if (filters.employeeId) {
      conditions.push(eq(plannedShifts.employeeId, filters.employeeId));
    }

    if (filters.status) {
      conditions.push(eq(plannedShifts.status, filters.status));
    }

    // TODO: Add department filter once department relations are set up
    // if (filters.departmentId) {
    //   conditions.push(eq(employees.departmentId, filters.departmentId));
    // }

    const shifts = await db
      .select({
        shift: plannedShifts,
        employee: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
          sector: employees.sector,
          contractType: employees.contractType,
        },
      })
      .from(plannedShifts)
      .leftJoin(employees, eq(plannedShifts.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(plannedShifts.shiftDate, plannedShifts.startTime);

    return shifts.map((row) => ({
      ...row.shift,
      employee: row.employee,
    }));
  } catch (error) {
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors de la récupération du planning: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Get employee's schedule for a date range
 *
 * @param employeeId - Employee ID
 * @param tenantId - Tenant ID
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Array of shifts
 */
export async function getEmployeeSchedule(
  employeeId: string,
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<PlannedShift[]> {
  try {
    const shifts = await db
      .select()
      .from(plannedShifts)
      .where(
        and(
          eq(plannedShifts.tenantId, tenantId),
          eq(plannedShifts.employeeId, employeeId),
          between(plannedShifts.shiftDate, startDate, endDate),
          // Only show published or confirmed shifts to employees
          or(
            eq(plannedShifts.status, 'published'),
            eq(plannedShifts.status, 'confirmed')
          )
        )
      )
      .orderBy(plannedShifts.shiftDate, plannedShifts.startTime);

    return shifts;
  } catch (error) {
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors de la récupération du planning employé: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Get shift details by ID
 *
 * @param shiftId - Shift ID
 * @param tenantId - Tenant ID (for security)
 * @returns Shift with employee and template details
 */
export async function getShiftById(
  shiftId: string,
  tenantId: string
): Promise<(PlannedShift & { employee?: any; template?: ShiftTemplate }) | null> {
  try {
    const [result] = await db
      .select({
        shift: plannedShifts,
        employee: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
          sector: employees.sector,
          contractType: employees.contractType,
        },
        template: shiftTemplates,
      })
      .from(plannedShifts)
      .leftJoin(employees, eq(plannedShifts.employeeId, employees.id))
      .leftJoin(shiftTemplates, eq(plannedShifts.shiftTemplateId, shiftTemplates.id))
      .where(and(eq(plannedShifts.id, shiftId), eq(plannedShifts.tenantId, tenantId)))
      .limit(1);

    if (!result) {
      return null;
    }

    return {
      ...result.shift,
      employee: result.employee,
      template: result.template ?? undefined,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors de la récupération du quart: ${error.message}`
      );
    }
    throw error;
  }
}

// ============================================
// Update Operations
// ============================================

/**
 * Update a planned shift
 *
 * Re-checks conflicts after update.
 *
 * @param shiftId - Shift ID
 * @param tenantId - Tenant ID (for security)
 * @param updates - Fields to update
 * @returns Updated shift
 *
 * @throws {ShiftConflictError} If update would create conflicts
 */
export async function updatePlannedShift(
  shiftId: string,
  tenantId: string,
  updates: Partial<{
    shiftDate: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    notes: string;
  }>
): Promise<PlannedShift> {
  try {
    // Get current shift
    const current = await getShiftById(shiftId, tenantId);
    if (!current) {
      throw new ShiftPlanningError('Quart non trouvé');
    }

    // Prepare updated values
    const shiftDate = updates.shiftDate ?? current.shiftDate;
    const startTime = updates.startTime ?? current.startTime;
    const endTime = updates.endTime ?? current.endTime;
    const breakMinutes = updates.breakMinutes ?? current.breakMinutes;

    // Check for conflicts with updated values
    const conflictCheck = await checkAllConflicts({
      employeeId: current.employeeId,
      shiftDate,
      startTime,
      endTime,
      tenantId,
      id: shiftId, // Exclude current shift from overlap check
    });

    if (conflictCheck.hasConflicts) {
      throw new ShiftConflictError(
        'Impossible de modifier: conflits détectés',
        conflictCheck
      );
    }

    // Recalculate duration
    const duration = calculateShiftDuration(startTime, endTime);
    const paidHours = duration - (breakMinutes ?? 0) / 60;

    // Update shift
    const [updated] = await db
      .update(plannedShifts)
      .set({
        ...updates,
        durationHours: updates.startTime || updates.endTime
          ? duration.toString()
          : undefined,
        paidHours:
          updates.startTime || updates.endTime || updates.breakMinutes !== undefined
            ? paidHours.toString()
            : undefined,
        hasConflicts: false,
        updatedAt: new Date(),
      })
      .where(and(eq(plannedShifts.id, shiftId), eq(plannedShifts.tenantId, tenantId)))
      .returning();

    if (!updated) {
      throw new ShiftPlanningError('Quart non trouvé');
    }

    return updated;
  } catch (error) {
    if (error instanceof ShiftConflictError || error instanceof ShiftPlanningError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors de la mise à jour: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Delete a planned shift
 *
 * Only allows deletion of draft shifts. Published shifts must be cancelled.
 *
 * @param shiftId - Shift ID
 * @param tenantId - Tenant ID (for security)
 */
export async function deletePlannedShift(
  shiftId: string,
  tenantId: string
): Promise<void> {
  try {
    const shift = await getShiftById(shiftId, tenantId);
    if (!shift) {
      throw new ShiftPlanningError('Quart non trouvé');
    }

    if (shift.status !== 'draft') {
      throw new ShiftPlanningError(
        'Impossible de supprimer un quart publié. Veuillez l\'annuler.'
      );
    }

    await db
      .delete(plannedShifts)
      .where(and(eq(plannedShifts.id, shiftId), eq(plannedShifts.tenantId, tenantId)));
  } catch (error) {
    if (error instanceof ShiftPlanningError) throw error;
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors de la suppression: ${error.message}`
      );
    }
    throw error;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate shift duration in hours
 *
 * Handles overnight shifts (end time before start time)
 *
 * @param startTime - Start time (HH:MM:SS)
 * @param endTime - End time (HH:MM:SS)
 * @returns Duration in hours
 *
 * @example
 * calculateShiftDuration("08:00:00", "16:00:00") // 8.0
 * calculateShiftDuration("22:00:00", "06:00:00") // 8.0 (overnight)
 */
export function calculateShiftDuration(startTime: string, endTime: string): number {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);

  // Handle overnight shifts
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  const durationMs = end.getTime() - start.getTime();
  return durationMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Get start and end dates for a week (Monday to Sunday)
 *
 * @param date - Any date in the week
 * @returns { startDate, endDate } in ISO format
 */
export function getWeekRange(date: Date): { startDate: string; endDate: string } {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday

  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    startDate: monday.toISOString().split('T')[0],
    endDate: sunday.toISOString().split('T')[0],
  };
}

/**
 * Calculate total hours for an employee in a date range
 *
 * @param employeeId - Employee ID
 * @param tenantId - Tenant ID
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Total paid hours
 */
export async function calculateTotalHours(
  employeeId: string,
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  try {
    const shifts = await db
      .select()
      .from(plannedShifts)
      .where(
        and(
          eq(plannedShifts.tenantId, tenantId),
          eq(plannedShifts.employeeId, employeeId),
          between(plannedShifts.shiftDate, startDate, endDate),
          sql`${plannedShifts.status} NOT IN ('cancelled', 'no_show')`
        )
      );

    return shifts.reduce((total, shift) => total + Number(shift.paidHours ?? 0), 0);
  } catch (error) {
    if (error instanceof Error) {
      throw new ShiftPlanningError(
        `Erreur lors du calcul des heures: ${error.message}`
      );
    }
    throw error;
  }
}
