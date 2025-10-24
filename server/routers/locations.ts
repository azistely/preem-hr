import { z } from 'zod';
import { createTRPCRouter, hrManagerProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import { locations, employeeSiteAssignments, LOCATION_TYPES } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

/**
 * Validation Schemas
 */
const createLocationSchema = z.object({
  locationCode: z.string().min(1).max(20).transform(val => val.toUpperCase()),
  locationName: z.string().min(1).max(255),
  locationType: z.enum(['headquarters', 'branch', 'construction_site', 'client_site']),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  countryCode: z.string().length(2).default('CI'),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  geofenceRadiusMeters: z.number().int().positive().default(100),
  transportAllowance: z.string().default('0'),
  mealAllowance: z.string().default('0'),
  sitePremium: z.string().default('0'),
  hazardPayRate: z.string().default('0'),
  notes: z.string().optional(),
});

const updateLocationSchema = createLocationSchema.partial().extend({
  id: z.string().uuid(),
});

const assignEmployeesSchema = z.object({
  locationId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1).max(100),
  assignmentDate: z.coerce.date(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  hoursWorked: z.string().optional(),
  isPrimarySite: z.boolean().default(false),
  notes: z.string().optional(),
});

/**
 * Locations Router
 * Handles CRUD operations for locations and site assignments
 */
export const locationsRouter = createTRPCRouter({
  /**
   * List all locations for the tenant
   */
  list: hrManagerProcedure
    .input(z.object({
      includeInactive: z.boolean().default(false),
    }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const conditions = [eq(locations.tenantId, ctx.user.tenantId)];

        if (!input?.includeInactive) {
          conditions.push(eq(locations.isActive, true));
        }

        const result = await db
          .select()
          .from(locations)
          .where(and(...conditions))
          .orderBy(desc(locations.createdAt));

        return result;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la récupération des sites';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Get a single location by ID
   */
  get: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const result = await db
          .select()
          .from(locations)
          .where(
            and(
              eq(locations.id, input.id),
              eq(locations.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!result[0]) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Site non trouvé',
          });
        }

        return result[0];
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;

        const message = error instanceof Error ? error.message : 'Erreur lors de la récupération du site';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Create a new location
   */
  create: hrManagerProcedure
    .input(createLocationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Check for duplicate location code
        const existing = await db
          .select()
          .from(locations)
          .where(
            and(
              eq(locations.tenantId, ctx.user.tenantId),
              eq(locations.locationCode, input.locationCode)
            )
          )
          .limit(1);

        if (existing[0]) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Un site avec le code "${input.locationCode}" existe déjà`,
          });
        }

        const result = await db
          .insert(locations)
          .values({
            ...input,
            tenantId: ctx.user.tenantId,
            createdBy: ctx.user.id,
          })
          .returning();

        return result[0];
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;

        const message = error instanceof Error ? error.message : 'Erreur lors de la création du site';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Update an existing location
   */
  update: hrManagerProcedure
    .input(updateLocationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        // Check if location code is being changed and if it conflicts
        if (data.locationCode) {
          const existing = await db
            .select()
            .from(locations)
            .where(
              and(
                eq(locations.tenantId, ctx.user.tenantId),
                eq(locations.locationCode, data.locationCode),
                sql`${locations.id} != ${id}`
              )
            )
            .limit(1);

          if (existing[0]) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Un autre site utilise déjà le code "${data.locationCode}"`,
            });
          }
        }

        const result = await db
          .update(locations)
          .set({
            ...data,
            updatedAt: new Date(),
            updatedBy: ctx.user.id,
          })
          .where(
            and(
              eq(locations.id, id),
              eq(locations.tenantId, ctx.user.tenantId)
            )
          )
          .returning();

        if (!result[0]) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Site non trouvé',
          });
        }

        return result[0];
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;

        const message = error instanceof Error ? error.message : 'Erreur lors de la mise à jour du site';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Deactivate a location (soft delete)
   */
  deactivate: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await db
          .update(locations)
          .set({
            isActive: false,
            updatedAt: new Date(),
            updatedBy: ctx.user.id,
          })
          .where(
            and(
              eq(locations.id, input.id),
              eq(locations.tenantId, ctx.user.tenantId)
            )
          )
          .returning();

        if (!result[0]) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Site non trouvé',
          });
        }

        return { success: true };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;

        const message = error instanceof Error ? error.message : 'Erreur lors de la désactivation du site';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Assign multiple employees to a location for a specific date
   */
  assignEmployees: hrManagerProcedure
    .input(assignEmployeesSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { employeeIds, locationId, assignmentDate, ...assignmentData } = input;

        // Verify location exists and belongs to tenant
        const location = await db
          .select()
          .from(locations)
          .where(
            and(
              eq(locations.id, locationId),
              eq(locations.tenantId, ctx.user.tenantId)
            )
          )
          .limit(1);

        if (!location[0]) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Site non trouvé',
          });
        }

        // Format date as string for database
        const dateStr = assignmentDate.toISOString().split('T')[0];

        // Prepare bulk insert data
        const assignments = employeeIds.map((employeeId) => ({
          employeeId,
          locationId,
          assignmentDate: dateStr,
          ...assignmentData,
          createdBy: ctx.user.id,
        }));

        // Insert assignments (will fail if duplicate due to unique constraint)
        await db
          .insert(employeeSiteAssignments)
          .values(assignments)
          .onConflictDoNothing();

        return { success: true, count: assignments.length };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;

        const message = error instanceof Error ? error.message : 'Erreur lors de l\'affectation des employés';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Get all site assignments for an employee within a date range
   */
  getEmployeeAssignments: hrManagerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const startDateStr = input.startDate.toISOString().split('T')[0];
        const endDateStr = input.endDate.toISOString().split('T')[0];

        const result = await db
          .select({
            id: employeeSiteAssignments.id,
            employeeId: employeeSiteAssignments.employeeId,
            locationId: employeeSiteAssignments.locationId,
            assignmentDate: employeeSiteAssignments.assignmentDate,
            startTime: employeeSiteAssignments.startTime,
            endTime: employeeSiteAssignments.endTime,
            hoursWorked: employeeSiteAssignments.hoursWorked,
            isPrimarySite: employeeSiteAssignments.isPrimarySite,
            notes: employeeSiteAssignments.notes,
            createdAt: employeeSiteAssignments.createdAt,
            // Location details
            locationCode: locations.locationCode,
            locationName: locations.locationName,
            locationType: locations.locationType,
            transportAllowance: locations.transportAllowance,
            mealAllowance: locations.mealAllowance,
            sitePremium: locations.sitePremium,
          })
          .from(employeeSiteAssignments)
          .leftJoin(locations, eq(employeeSiteAssignments.locationId, locations.id))
          .where(
            and(
              eq(employeeSiteAssignments.employeeId, input.employeeId),
              gte(employeeSiteAssignments.assignmentDate, startDateStr),
              lte(employeeSiteAssignments.assignmentDate, endDateStr)
            )
          )
          .orderBy(desc(employeeSiteAssignments.assignmentDate));

        return result;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la récupération des affectations';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Get all assignments for a specific location and date
   */
  getAssignmentsByDate: hrManagerProcedure
    .input(
      z.object({
        locationId: z.string().uuid().optional(),
        assignmentDate: z.coerce.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const dateStr = input.assignmentDate.toISOString().split('T')[0];

        const conditions = [
          eq(employeeSiteAssignments.assignmentDate, dateStr),
        ];

        if (input.locationId) {
          conditions.push(eq(employeeSiteAssignments.locationId, input.locationId));
        }

        const result = await db
          .select({
            id: employeeSiteAssignments.id,
            employeeId: employeeSiteAssignments.employeeId,
            locationId: employeeSiteAssignments.locationId,
            assignmentDate: employeeSiteAssignments.assignmentDate,
            startTime: employeeSiteAssignments.startTime,
            endTime: employeeSiteAssignments.endTime,
            hoursWorked: employeeSiteAssignments.hoursWorked,
            isPrimarySite: employeeSiteAssignments.isPrimarySite,
            notes: employeeSiteAssignments.notes,
            // Location details
            locationCode: locations.locationCode,
            locationName: locations.locationName,
            locationType: locations.locationType,
          })
          .from(employeeSiteAssignments)
          .leftJoin(locations, eq(employeeSiteAssignments.locationId, locations.id))
          .where(and(...conditions))
          .orderBy(desc(employeeSiteAssignments.createdAt));

        return result;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la récupération des affectations';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),
});
