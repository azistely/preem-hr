/**
 * Geofencing tRPC Router
 *
 * Handles geofence configuration and employee assignments with:
 * - HR Manager-only CRUD operations
 * - Employee read access (for mobile app time tracking)
 * - Tenant isolation
 * - French error messages
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure, hrManagerProcedure } from '../api/trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';
import { geofenceConfigurations, geofenceEmployeeAssignments } from '@/drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { GeofenceConfigurationWithAssignments } from '@/lib/types/extended-models';

// Zod Schemas
const createGeofenceSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(1).max(10000).default(100),
  isActive: z.boolean().default(true),
  appliesToAll: z.boolean().default(true),
});

const updateGeofenceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().int().min(1).max(10000).optional(),
  isActive: z.boolean().optional(),
  appliesToAll: z.boolean().optional(),
});

const assignEmployeesSchema = z.object({
  geofenceId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1, 'Au moins un employé doit être sélectionné'),
});

// Router
export const geofencingRouter = createTRPCRouter({
  /**
   * List all geofences for tenant
   * Public access - used by employee time tracking apps
   */
  list: publicProcedure.query(async ({ ctx }): Promise<GeofenceConfigurationWithAssignments[]> => {
    try {
      const geofences = await db.query.geofenceConfigurations.findMany({
        where: eq(geofenceConfigurations.tenantId, ctx.user.tenantId),
        orderBy: (geofences, { desc }) => [desc(geofences.createdAt)],
        with: {
          employeeAssignments: {
            with: {
              employee: {
                columns: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeNumber: true,
                },
              },
            },
          },
        } as any,
      });

      return geofences as GeofenceConfigurationWithAssignments[];
    } catch (error: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'Erreur lors de la récupération des géorepérages',
      });
    }
  }),

  /**
   * Get a single geofence by ID with employee assignments
   * Public access
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }): Promise<GeofenceConfigurationWithAssignments> => {
      try {
        const geofence = await db.query.geofenceConfigurations.findFirst({
          where: and(
            eq(geofenceConfigurations.id, input.id),
            eq(geofenceConfigurations.tenantId, ctx.user.tenantId)
          ),
          with: {
            employeeAssignments: {
              with: {
                employee: {
                  columns: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeNumber: true,
                    email: true,
                  },
                },
              },
            },
          } as any,
        });

        if (!geofence) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Géorepérage introuvable',
          });
        }

        return geofence as GeofenceConfigurationWithAssignments;
      } catch (error: any) {
        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération du géorepérage',
        });
      }
    }),

  /**
   * Create a new geofence
   * Requires: HR Manager role or higher
   */
  create: hrManagerProcedure
    .input(createGeofenceSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const [newGeofence] = await db
          .insert(geofenceConfigurations)
          .values({
            tenantId: ctx.user.tenantId,
            name: input.name,
            description: input.description,
            latitude: input.latitude.toString(),
            longitude: input.longitude.toString(),
            radiusMeters: input.radiusMeters,
            isActive: input.isActive,
            appliesToAll: input.appliesToAll,
          })
          .returning();

        return newGeofence;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la création du géorepérage',
        });
      }
    }),

  /**
   * Update an existing geofence
   * Requires: HR Manager role or higher
   */
  update: hrManagerProcedure
    .input(updateGeofenceSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, ...updateData } = input;

        // Verify ownership
        const existing = await db.query.geofenceConfigurations.findFirst({
          where: and(
            eq(geofenceConfigurations.id, id),
            eq(geofenceConfigurations.tenantId, ctx.user.tenantId)
          ),
        });

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Géorepérage introuvable',
          });
        }

        const [updatedGeofence] = await db
          .update(geofenceConfigurations)
          .set({
            ...updateData,
            latitude: updateData.latitude !== undefined ? updateData.latitude.toString() : undefined,
            longitude: updateData.longitude !== undefined ? updateData.longitude.toString() : undefined,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(geofenceConfigurations.id, id))
          .returning();

        return updatedGeofence;
      } catch (error: any) {
        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la mise à jour du géorepérage',
        });
      }
    }),

  /**
   * Delete a geofence (cascades to employee assignments)
   * Requires: HR Manager role or higher
   */
  delete: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify ownership
        const existing = await db.query.geofenceConfigurations.findFirst({
          where: and(
            eq(geofenceConfigurations.id, input.id),
            eq(geofenceConfigurations.tenantId, ctx.user.tenantId)
          ),
        });

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Géorepérage introuvable',
          });
        }

        const [deletedGeofence] = await db
          .delete(geofenceConfigurations)
          .where(eq(geofenceConfigurations.id, input.id))
          .returning();

        return { success: true, id: deletedGeofence.id };
      } catch (error: any) {
        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la suppression du géorepérage',
        });
      }
    }),

  /**
   * Assign employees to a geofence
   * Replaces existing assignments (not additive)
   * Requires: HR Manager role or higher
   */
  assignEmployees: hrManagerProcedure
    .input(assignEmployeesSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify geofence exists and belongs to tenant
        const geofence = await db.query.geofenceConfigurations.findFirst({
          where: and(
            eq(geofenceConfigurations.id, input.geofenceId),
            eq(geofenceConfigurations.tenantId, ctx.user.tenantId)
          ),
        });

        if (!geofence) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Géorepérage introuvable',
          });
        }

        // Delete existing assignments
        await db
          .delete(geofenceEmployeeAssignments)
          .where(eq(geofenceEmployeeAssignments.geofenceId, input.geofenceId));

        // Create new assignments
        const assignments = input.employeeIds.map((employeeId) => ({
          geofenceId: input.geofenceId,
          employeeId,
        }));

        await db.insert(geofenceEmployeeAssignments).values(assignments);

        // Update geofence to not apply to all
        await db
          .update(geofenceConfigurations)
          .set({
            appliesToAll: false,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(geofenceConfigurations.id, input.geofenceId));

        return { success: true, count: assignments.length };
      } catch (error: any) {
        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: error.message || 'Erreur lors de l\'assignation des employés',
        });
      }
    }),

  /**
   * Remove a single employee assignment
   * Requires: HR Manager role or higher
   */
  unassignEmployee: hrManagerProcedure
    .input(
      z.object({
        geofenceId: z.string().uuid(),
        employeeId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify geofence exists and belongs to tenant
        const geofence = await db.query.geofenceConfigurations.findFirst({
          where: and(
            eq(geofenceConfigurations.id, input.geofenceId),
            eq(geofenceConfigurations.tenantId, ctx.user.tenantId)
          ),
        });

        if (!geofence) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Géorepérage introuvable',
          });
        }

        await db
          .delete(geofenceEmployeeAssignments)
          .where(
            and(
              eq(geofenceEmployeeAssignments.geofenceId, input.geofenceId),
              eq(geofenceEmployeeAssignments.employeeId, input.employeeId)
            )
          );

        return { success: true };
      } catch (error: any) {
        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la suppression de l\'assignation',
        });
      }
    }),

  /**
   * Clear all employee assignments (make geofence apply to all)
   * Requires: HR Manager role or higher
   */
  clearAssignments: hrManagerProcedure
    .input(z.object({ geofenceId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify geofence exists and belongs to tenant
        const geofence = await db.query.geofenceConfigurations.findFirst({
          where: and(
            eq(geofenceConfigurations.id, input.geofenceId),
            eq(geofenceConfigurations.tenantId, ctx.user.tenantId)
          ),
        });

        if (!geofence) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Géorepérage introuvable',
          });
        }

        // Delete all assignments
        await db
          .delete(geofenceEmployeeAssignments)
          .where(eq(geofenceEmployeeAssignments.geofenceId, input.geofenceId));

        // Update geofence to apply to all
        await db
          .update(geofenceConfigurations)
          .set({
            appliesToAll: true,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(geofenceConfigurations.id, input.geofenceId));

        return { success: true };
      } catch (error: any) {
        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la suppression des assignations',
        });
      }
    }),
});
