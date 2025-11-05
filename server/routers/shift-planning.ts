/**
 * Shift Planning tRPC Router
 *
 * Provides endpoints for:
 * - Shift template management (CRUD)
 * - Shift planning (create, assign, bulk create)
 * - Schedule publishing and status management
 * - Conflict detection
 * - Employee schedule views
 * - Shift swap requests (basic support)
 *
 * Role-based access:
 * - HR Manager: Full access to all departments
 * - Manager: Access to their department only
 * - Employee: View their own schedule, confirm shifts
 */

import { z } from 'zod';
import {
  createTRPCRouter,
  employeeProcedure,
  managerProcedure,
  hrManagerProcedure,
} from '../api/trpc';
import { TRPCError } from '@trpc/server';

// Services
import * as shiftTemplateService from '@/features/shift-planning/services/shift-template.service';
import * as shiftPlanningService from '@/features/shift-planning/services/shift-planning.service';
import * as conflictCheckerService from '@/features/shift-planning/services/shift-conflict-checker.service';

// ============================================
// Input Schemas
// ============================================

const shiftTemplateInputSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(20),
  startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  breakMinutes: z.number().int().min(0).default(0),
  shiftType: z.enum(['regular', 'night', 'weekend', 'holiday']),
  color: z.string().optional(),
  description: z.string().optional(),
  minEmployees: z.number().int().min(0).optional(),
  overtimeMultiplier: z.string().optional(),
  applicableDepartments: z.array(z.string().uuid()).optional(),
  applicablePositions: z.array(z.string().uuid()).optional(),
  applicableSectors: z.array(z.string()).optional(),
});

const createShiftInputSchema = z.object({
  employeeId: z.string().uuid(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  shiftTemplateId: z.string().uuid().optional(),
  breakMinutes: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

const bulkCreateInputSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1),
  shiftDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  shiftTemplateId: z.string().uuid(),
  stopOnConflict: z.boolean().default(false),
});

const scheduleFiltersSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.string().optional(),
});

// ============================================
// Router Definition
// ============================================

export const shiftPlanningRouter = createTRPCRouter({
  // ====================================
  // Shift Templates (HR Manager only)
  // ====================================

  /**
   * Get all shift templates for tenant
   * Requires: Manager role (for viewing templates when creating shifts)
   */
  getTemplates: managerProcedure
    .input(
      z.object({
        isActive: z.boolean().optional(),
        shiftType: z.string().optional(),
        departmentId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        return await shiftTemplateService.getShiftTemplates({
          tenantId: ctx.user.tenantId,
          isActive: input.isActive,
          shiftType: input.shiftType,
          departmentId: input.departmentId,
        });
      } catch (error) {
        if (error instanceof shiftTemplateService.ShiftTemplateError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Get a single shift template by ID
   * Requires: Manager role
   */
  getTemplateById: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        return await shiftTemplateService.getShiftTemplateById(
          input.id,
          ctx.user.tenantId
        );
      } catch (error) {
        if (error instanceof shiftTemplateService.ShiftTemplateError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Create a new shift template
   * Requires: HR Manager role
   */
  createTemplate: hrManagerProcedure
    .input(shiftTemplateInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await shiftTemplateService.createShiftTemplate({
          ...input,
          tenantId: ctx.user.tenantId,
          createdBy: ctx.user.id,
        });
      } catch (error) {
        if (error instanceof shiftTemplateService.ShiftTemplateError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Update an existing shift template
   * Requires: HR Manager role
   */
  updateTemplate: hrManagerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: shiftTemplateInputSchema.partial(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await shiftTemplateService.updateShiftTemplate(
          input.id,
          ctx.user.tenantId,
          input.data
        );
      } catch (error) {
        if (error instanceof shiftTemplateService.ShiftTemplateError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Delete (deactivate) a shift template
   * Requires: HR Manager role
   */
  deleteTemplate: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await shiftTemplateService.deleteShiftTemplate(input.id, ctx.user.tenantId);
        return { success: true };
      } catch (error) {
        if (error instanceof shiftTemplateService.ShiftTemplateError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Create default templates for tenant
   * Requires: HR Manager role
   */
  createDefaultTemplates: hrManagerProcedure.mutation(async ({ ctx }) => {
    try {
      return await shiftTemplateService.createDefaultTemplates(
        ctx.user.tenantId,
        ctx.user.id
      );
    } catch (error) {
      if (error instanceof shiftTemplateService.ShiftTemplateError) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
      throw error;
    }
  }),

  // ====================================
  // Shift Planning (Manager & HR)
  // ====================================

  /**
   * Create a single planned shift
   * Requires: Manager role
   */
  createShift: managerProcedure
    .input(createShiftInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await shiftPlanningService.createPlannedShift({
          ...input,
          tenantId: ctx.user.tenantId,
          createdBy: ctx.user.id,
        });
      } catch (error) {
        if (error instanceof shiftPlanningService.ShiftConflictError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error.conflicts,
          });
        }
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Create shift from template
   * Requires: Manager role
   */
  createFromTemplate: managerProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        employeeId: z.string().uuid(),
        shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await shiftPlanningService.createShiftFromTemplate(
          input.templateId,
          input.employeeId,
          input.shiftDate,
          ctx.user.tenantId,
          ctx.user.id
        );
      } catch (error) {
        if (error instanceof shiftPlanningService.ShiftConflictError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error.conflicts,
          });
        }
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Bulk create shifts for multiple employees/dates
   * Requires: Manager role
   */
  bulkCreateShifts: managerProcedure
    .input(bulkCreateInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await shiftPlanningService.bulkCreateShifts({
          ...input,
          tenantId: ctx.user.tenantId,
          createdBy: ctx.user.id,
        });
      } catch (error) {
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Update a planned shift
   * Requires: Manager role
   */
  updateShift: managerProcedure
    .input(
      z.object({
        shiftId: z.string().uuid(),
        updates: z.object({
          shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
          endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
          breakMinutes: z.number().int().min(0).optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await shiftPlanningService.updatePlannedShift(
          input.shiftId,
          ctx.user.tenantId,
          input.updates
        );
      } catch (error) {
        if (error instanceof shiftPlanningService.ShiftConflictError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error.conflicts,
          });
        }
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Delete a planned shift (draft only)
   * Requires: Manager role
   */
  deleteShift: managerProcedure
    .input(z.object({ shiftId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await shiftPlanningService.deletePlannedShift(
          input.shiftId,
          ctx.user.tenantId
        );
        return { success: true };
      } catch (error) {
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Cancel a planned shift
   * Requires: Manager role
   */
  cancelShift: managerProcedure
    .input(
      z.object({
        shiftId: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await shiftPlanningService.cancelShift(
          input.shiftId,
          ctx.user.tenantId,
          ctx.user.id,
          input.reason
        );
      } catch (error) {
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  // ====================================
  // Schedule Management
  // ====================================

  /**
   * Get weekly schedule (Manager/HR view)
   * Requires: Manager role
   */
  getWeeklySchedule: managerProcedure
    .input(scheduleFiltersSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await shiftPlanningService.getWeeklySchedule({
          ...input,
          tenantId: ctx.user.tenantId,
        });
      } catch (error) {
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Get shift by ID
   * Requires: Manager role
   */
  getShiftById: managerProcedure
    .input(z.object({ shiftId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        return await shiftPlanningService.getShiftById(
          input.shiftId,
          ctx.user.tenantId
        );
      } catch (error) {
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Publish schedule (draft → published)
   * Requires: Manager role
   */
  publishSchedule: managerProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const count = await shiftPlanningService.publishSchedule(
          ctx.user.tenantId,
          input.startDate,
          input.endDate,
          ctx.user.id
        );
        return { count, success: true };
      } catch (error) {
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  // ====================================
  // Employee Views
  // ====================================

  /**
   * Get employee's own schedule
   * Requires: Employee role
   */
  getMySchedule: employeeProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // Ensure employee can only view their own schedule
        if (input.employeeId !== ctx.user.employeeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Vous ne pouvez voir que votre propre planning',
          });
        }

        return await shiftPlanningService.getEmployeeSchedule(
          input.employeeId,
          ctx.user.tenantId,
          input.startDate,
          input.endDate
        );
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Confirm shift (employee acknowledges assignment)
   * Requires: Employee role
   */
  confirmShift: employeeProcedure
    .input(z.object({ shiftId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await shiftPlanningService.confirmShift(
          input.shiftId,
          ctx.user.tenantId,
          ctx.user.id
        );
      } catch (error) {
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Get total hours for employee in date range
   * Requires: Employee role
   */
  getMyTotalHours: employeeProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // Ensure employee can only view their own hours
        if (input.employeeId !== ctx.user.employeeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Vous ne pouvez voir que vos propres heures',
          });
        }

        const totalHours = await shiftPlanningService.calculateTotalHours(
          input.employeeId,
          ctx.user.tenantId,
          input.startDate,
          input.endDate
        );

        return { totalHours };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof shiftPlanningService.ShiftPlanningError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  // ====================================
  // Conflict Detection
  // ====================================

  /**
   * Check conflicts for a potential shift
   * Requires: Manager role
   */
  checkConflicts: managerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
        shiftId: z.string().uuid().optional(), // For updates
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        return await conflictCheckerService.checkAllConflicts({
          ...input,
          tenantId: ctx.user.tenantId,
          id: input.shiftId,
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la vérification des conflits',
        });
      }
    }),

  // ====================================
  // Utilities
  // ====================================

  /**
   * Get week range for a date
   * Requires: Manager role
   */
  getWeekRange: managerProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(({ input }) => {
      const date = new Date(input.date);
      return shiftPlanningService.getWeekRange(date);
    }),

  /**
   * Validate template for employee
   * Requires: Manager role
   */
  validateTemplateForEmployee: managerProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        employeeId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        return await shiftTemplateService.validateTemplateForEmployee(
          input.templateId,
          input.employeeId,
          ctx.user.tenantId
        );
      } catch (error) {
        if (error instanceof shiftTemplateService.ShiftTemplateError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),
});
