/**
 * Training & Competencies tRPC Router
 * Complete training management system for courses, sessions, enrollments, requests, and certifications
 *
 * HR-only access for management operations
 * Employee access for viewing courses and submitting requests
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, hrManagerProcedure } from '../api/trpc';
import {
  trainingCourses,
  trainingSessions,
  trainingEnrollments,
  trainingRequests,
  trainingPlans,
  trainingPlanItems,
  trainingEvaluations,
  employeeSkills,
  employeeCertifications,
  trainingTaxObligations,
  employees,
  departments,
} from '@/lib/db/schema';
import { and, eq, desc, asc, sql, gte, lte, isNull, or, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  detectCompanySize,
  getTrainingConfig,
  applyTrainingPlanDefaults,
} from '@/lib/hr-modules/services/smart-defaults.service';

// ============================================================================
// TRAINING COURSES (Catalog)
// ============================================================================

export const trainingRouter = createTRPCRouter({
  /**
   * Get smart defaults for training
   */
  getSmartDefaults: hrManagerProcedure
    .input(z.object({
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Count active employees
      const [{ count: employeeCount }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(employees)
        .where(and(
          eq(employees.tenantId, tenantId),
          eq(employees.status, 'active')
        ));

      const year = input.year ?? new Date().getFullYear();
      const config = getTrainingConfig(employeeCount);
      const defaults = applyTrainingPlanDefaults(employeeCount, 'CI', year);
      const companySize = detectCompanySize(employeeCount);

      return {
        employeeCount,
        companySize,
        config,
        defaults,
      };
    }),

  // ============================================================================
  // COURSES
  // ============================================================================

  courses: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        category: z.string().optional(),
        modality: z.enum(['in_person', 'virtual', 'e_learning', 'blended', 'on_the_job']).optional(),
        isMandatory: z.boolean().optional(),
        isActive: z.boolean().default(true),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(trainingCourses.tenantId, tenantId)];

        if (input.category) {
          conditions.push(eq(trainingCourses.category, input.category));
        }

        if (input.modality) {
          conditions.push(eq(trainingCourses.modality, input.modality));
        }

        if (input.isMandatory !== undefined) {
          conditions.push(eq(trainingCourses.isMandatory, input.isMandatory));
        }

        if (input.isActive !== undefined) {
          conditions.push(eq(trainingCourses.isActive, input.isActive));
        }

        if (input.search) {
          conditions.push(
            or(
              sql`${trainingCourses.name} ILIKE ${`%${input.search}%`}`,
              sql`${trainingCourses.code} ILIKE ${`%${input.search}%`}`
            )!
          );
        }

        const coursesList = await ctx.db
          .select()
          .from(trainingCourses)
          .where(and(...conditions))
          .orderBy(asc(trainingCourses.name))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(trainingCourses)
          .where(and(...conditions));

        return {
          data: coursesList,
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [course] = await ctx.db
          .select()
          .from(trainingCourses)
          .where(and(
            eq(trainingCourses.id, input.id),
            eq(trainingCourses.tenantId, tenantId)
          ));

        if (!course) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Formation non trouvée',
          });
        }

        // Get upcoming sessions
        const upcomingSessions = await ctx.db
          .select()
          .from(trainingSessions)
          .where(and(
            eq(trainingSessions.courseId, input.id),
            gte(trainingSessions.startDate, new Date().toISOString().split('T')[0])
          ))
          .orderBy(asc(trainingSessions.startDate))
          .limit(5);

        return {
          ...course,
          upcomingSessions,
        };
      }),

    create: hrManagerProcedure
      .input(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        shortDescription: z.string().optional(),
        category: z.string().min(1),
        modality: z.enum(['in_person', 'virtual', 'e_learning', 'blended', 'on_the_job']).default('in_person'),
        durationHours: z.number().min(1),
        provider: z.string().optional(),
        isExternal: z.boolean().default(false),
        costPerParticipant: z.string().optional(),
        currency: z.string().default('XOF'),
        isMandatory: z.boolean().default(false),
        mandatoryRecurrenceMonths: z.number().optional(),
        grantsCertification: z.boolean().default(false),
        certificationValidityMonths: z.number().optional(),
        linkedCompetencyIds: z.array(z.string().uuid()).optional(),
        countryCode: z.string().optional(),
        isRegulatory: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Check for duplicate code
        const [existing] = await ctx.db
          .select()
          .from(trainingCourses)
          .where(and(
            eq(trainingCourses.tenantId, tenantId),
            eq(trainingCourses.code, input.code)
          ));

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Une formation avec ce code existe déjà',
          });
        }

        const [created] = await ctx.db
          .insert(trainingCourses)
          .values({
            tenantId,
            code: input.code,
            name: input.name,
            description: input.description,
            shortDescription: input.shortDescription,
            category: input.category,
            modality: input.modality,
            durationHours: input.durationHours,
            provider: input.provider,
            isExternal: input.isExternal,
            costPerParticipant: input.costPerParticipant,
            currency: input.currency,
            isMandatory: input.isMandatory,
            mandatoryRecurrenceMonths: input.mandatoryRecurrenceMonths,
            grantsCertification: input.grantsCertification,
            certificationValidityMonths: input.certificationValidityMonths,
            linkedCompetencyIds: input.linkedCompetencyIds ?? [],
            countryCode: input.countryCode,
            isRegulatory: input.isRegulatory,
            createdBy: ctx.user.id,
          })
          .returning();

        return created;
      }),

    update: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        shortDescription: z.string().optional(),
        category: z.string().optional(),
        modality: z.enum(['in_person', 'virtual', 'e_learning', 'blended', 'on_the_job']).optional(),
        durationHours: z.number().min(1).optional(),
        provider: z.string().optional(),
        isExternal: z.boolean().optional(),
        costPerParticipant: z.string().optional(),
        currency: z.string().optional(),
        isMandatory: z.boolean().optional(),
        mandatoryRecurrenceMonths: z.number().nullable().optional(),
        grantsCertification: z.boolean().optional(),
        certificationValidityMonths: z.number().nullable().optional(),
        linkedCompetencyIds: z.array(z.string().uuid()).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const { id, ...updates } = input;

        const [course] = await ctx.db
          .select()
          .from(trainingCourses)
          .where(and(
            eq(trainingCourses.id, id),
            eq(trainingCourses.tenantId, tenantId)
          ));

        if (!course) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Formation non trouvée',
          });
        }

        const [updated] = await ctx.db
          .update(trainingCourses)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(trainingCourses.id, id))
          .returning();

        return updated;
      }),

    getCategories: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = ctx.user.tenantId;

      const categories = await ctx.db
        .selectDistinct({ category: trainingCourses.category })
        .from(trainingCourses)
        .where(eq(trainingCourses.tenantId, tenantId))
        .orderBy(asc(trainingCourses.category));

      return categories.map(c => c.category);
    }),
  }),

  // ============================================================================
  // SESSIONS
  // ============================================================================

  sessions: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        courseId: z.string().uuid().optional(),
        status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(trainingSessions.tenantId, tenantId)];

        if (input.courseId) {
          conditions.push(eq(trainingSessions.courseId, input.courseId));
        }

        if (input.status) {
          conditions.push(eq(trainingSessions.status, input.status));
        }

        if (input.dateFrom) {
          conditions.push(gte(trainingSessions.startDate, input.dateFrom));
        }

        if (input.dateTo) {
          conditions.push(lte(trainingSessions.startDate, input.dateTo));
        }

        const sessionsList = await ctx.db
          .select({
            session: trainingSessions,
            course: {
              id: trainingCourses.id,
              code: trainingCourses.code,
              name: trainingCourses.name,
              modality: trainingCourses.modality,
            },
          })
          .from(trainingSessions)
          .leftJoin(trainingCourses, eq(trainingSessions.courseId, trainingCourses.id))
          .where(and(...conditions))
          .orderBy(asc(trainingSessions.startDate))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(trainingSessions)
          .where(and(...conditions));

        // Get enrollment counts
        const sessionIds = sessionsList.map(s => s.session.id);
        let enrollmentCounts: Record<string, number> = {};

        if (sessionIds.length > 0) {
          const counts = await ctx.db
            .select({
              sessionId: trainingEnrollments.sessionId,
              count: sql<number>`count(*)::int`,
            })
            .from(trainingEnrollments)
            .where(inArray(trainingEnrollments.sessionId, sessionIds))
            .groupBy(trainingEnrollments.sessionId);

          enrollmentCounts = Object.fromEntries(
            counts.map(c => [c.sessionId, c.count])
          );
        }

        return {
          data: sessionsList.map(s => ({
            ...s.session,
            course: s.course,
            enrollmentCount: enrollmentCounts[s.session.id] ?? 0,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [result] = await ctx.db
          .select({
            session: trainingSessions,
            course: trainingCourses,
          })
          .from(trainingSessions)
          .leftJoin(trainingCourses, eq(trainingSessions.courseId, trainingCourses.id))
          .where(and(
            eq(trainingSessions.id, input.id),
            eq(trainingSessions.tenantId, tenantId)
          ));

        if (!result) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session non trouvée',
          });
        }

        // Get enrollments
        const enrollments = await ctx.db
          .select({
            enrollment: trainingEnrollments,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
              employeeNumber: employees.employeeNumber,
            },
          })
          .from(trainingEnrollments)
          .leftJoin(employees, eq(trainingEnrollments.employeeId, employees.id))
          .where(eq(trainingEnrollments.sessionId, input.id));

        return {
          ...result.session,
          course: result.course,
          enrollments: enrollments.map(e => ({
            ...e.enrollment,
            employee: e.employee,
          })),
        };
      }),

    create: hrManagerProcedure
      .input(z.object({
        courseId: z.string().uuid(),
        sessionCode: z.string().min(1),
        name: z.string().optional(),
        startDate: z.string(),
        endDate: z.string(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        location: z.string().optional(),
        isVirtual: z.boolean().default(false),
        virtualMeetingUrl: z.string().optional(),
        instructorName: z.string().optional(),
        instructorEmail: z.string().optional(),
        maxParticipants: z.number().min(1).optional(),
        minParticipants: z.number().min(1).default(1),
        registrationDeadline: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Verify course exists
        const [course] = await ctx.db
          .select()
          .from(trainingCourses)
          .where(and(
            eq(trainingCourses.id, input.courseId),
            eq(trainingCourses.tenantId, tenantId)
          ));

        if (!course) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Formation non trouvée',
          });
        }

        const [created] = await ctx.db
          .insert(trainingSessions)
          .values({
            tenantId,
            courseId: input.courseId,
            sessionCode: input.sessionCode,
            name: input.name,
            startDate: input.startDate,
            endDate: input.endDate,
            startTime: input.startTime,
            endTime: input.endTime,
            location: input.location,
            isVirtual: input.isVirtual,
            virtualMeetingUrl: input.virtualMeetingUrl,
            instructorName: input.instructorName,
            instructorEmail: input.instructorEmail,
            maxParticipants: input.maxParticipants,
            minParticipants: input.minParticipants,
            registrationDeadline: input.registrationDeadline,
            notes: input.notes,
            status: 'scheduled',
            createdBy: ctx.user.id,
          })
          .returning();

        return created;
      }),

    update: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        location: z.string().optional(),
        isVirtual: z.boolean().optional(),
        virtualMeetingUrl: z.string().optional(),
        instructorName: z.string().optional(),
        instructorEmail: z.string().optional(),
        maxParticipants: z.number().min(1).optional(),
        registrationDeadline: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const { id, ...updates } = input;

        const [session] = await ctx.db
          .select()
          .from(trainingSessions)
          .where(and(
            eq(trainingSessions.id, id),
            eq(trainingSessions.tenantId, tenantId)
          ));

        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session non trouvée',
          });
        }

        const [updated] = await ctx.db
          .update(trainingSessions)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(trainingSessions.id, id))
          .returning();

        return updated;
      }),
  }),

  // ============================================================================
  // ENROLLMENTS
  // ============================================================================

  enrollments: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        sessionId: z.string().uuid().optional(),
        employeeId: z.string().uuid().optional(),
        status: z.enum(['enrolled', 'attended', 'completed', 'no_show', 'cancelled']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(trainingEnrollments.tenantId, tenantId)];

        if (input.sessionId) {
          conditions.push(eq(trainingEnrollments.sessionId, input.sessionId));
        }

        if (input.employeeId) {
          conditions.push(eq(trainingEnrollments.employeeId, input.employeeId));
        }

        if (input.status) {
          conditions.push(eq(trainingEnrollments.status, input.status));
        }

        const enrollmentsList = await ctx.db
          .select({
            enrollment: trainingEnrollments,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
            session: {
              id: trainingSessions.id,
              startDate: trainingSessions.startDate,
              endDate: trainingSessions.endDate,
            },
            course: {
              id: trainingCourses.id,
              name: trainingCourses.name,
            },
          })
          .from(trainingEnrollments)
          .leftJoin(employees, eq(trainingEnrollments.employeeId, employees.id))
          .leftJoin(trainingSessions, eq(trainingEnrollments.sessionId, trainingSessions.id))
          .leftJoin(trainingCourses, eq(trainingSessions.courseId, trainingCourses.id))
          .where(and(...conditions))
          .orderBy(desc(trainingEnrollments.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(trainingEnrollments)
          .where(and(...conditions));

        return {
          data: enrollmentsList.map(e => ({
            ...e.enrollment,
            employee: e.employee,
            session: e.session,
            course: e.course,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    enroll: hrManagerProcedure
      .input(z.object({
        sessionId: z.string().uuid(),
        employeeIds: z.array(z.string().uuid()).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Verify session exists
        const [session] = await ctx.db
          .select()
          .from(trainingSessions)
          .where(and(
            eq(trainingSessions.id, input.sessionId),
            eq(trainingSessions.tenantId, tenantId)
          ));

        if (!session) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session non trouvée',
          });
        }

        // Check capacity
        if (session.maxParticipants) {
          const [{ count: currentCount }] = await ctx.db
            .select({ count: sql<number>`count(*)::int` })
            .from(trainingEnrollments)
            .where(and(
              eq(trainingEnrollments.sessionId, input.sessionId),
              eq(trainingEnrollments.status, 'enrolled')
            ));

          if (currentCount + input.employeeIds.length > session.maxParticipants) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Capacité maximale atteinte (${session.maxParticipants} participants)`,
            });
          }
        }

        // Create enrollments
        const created = await ctx.db
          .insert(trainingEnrollments)
          .values(
            input.employeeIds.map(employeeId => ({
              tenantId,
              sessionId: input.sessionId,
              employeeId,
              status: 'enrolled' as const,
              enrolledBy: ctx.user.id,
            }))
          )
          .returning();

        return created;
      }),

    updateStatus: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        status: z.enum(['enrolled', 'attended', 'completed', 'no_show', 'cancelled']),
        attendancePercentage: z.number().min(0).max(100).optional(),
        completionStatus: z.enum(['passed', 'failed', 'pending']).optional(),
        completionScore: z.string().optional(),
        certificateIssued: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const { id, ...updates } = input;

        const [enrollment] = await ctx.db
          .select()
          .from(trainingEnrollments)
          .where(and(
            eq(trainingEnrollments.id, id),
            eq(trainingEnrollments.tenantId, tenantId)
          ));

        if (!enrollment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Inscription non trouvée',
          });
        }

        const [updated] = await ctx.db
          .update(trainingEnrollments)
          .set({
            ...updates,
            attendedAt: updates.status === 'attended' ? new Date() : enrollment.attendedAt,
            completedAt: updates.status === 'completed' ? new Date() : enrollment.completedAt,
            updatedAt: new Date(),
          })
          .where(eq(trainingEnrollments.id, id))
          .returning();

        return updated;
      }),

    cancel: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [enrollment] = await ctx.db
          .select()
          .from(trainingEnrollments)
          .where(and(
            eq(trainingEnrollments.id, input.id),
            eq(trainingEnrollments.tenantId, tenantId)
          ));

        if (!enrollment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Inscription non trouvée',
          });
        }

        const [updated] = await ctx.db
          .update(trainingEnrollments)
          .set({
            status: 'cancelled',
            notes: input.reason ? `Annulation: ${input.reason}` : enrollment.notes,
            updatedAt: new Date(),
          })
          .where(eq(trainingEnrollments.id, input.id))
          .returning();

        return updated;
      }),
  }),

  // ============================================================================
  // TRAINING REQUESTS
  // ============================================================================

  requests: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        employeeId: z.string().uuid().optional(),
        status: z.enum(['draft', 'submitted', 'manager_approved', 'hr_approved', 'scheduled', 'rejected', 'cancelled']).optional(),
        myRequests: z.boolean().default(false),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(trainingRequests.tenantId, tenantId)];

        // Non-HR users can only see their own requests or requests they need to approve
        const isHr = ctx.user.role === 'super_admin' || ctx.user.role === 'tenant_admin';

        if (!isHr || input.myRequests) {
          const employeeId = ctx.user.employeeId;
          if (employeeId) {
            if (input.myRequests) {
              conditions.push(eq(trainingRequests.employeeId, employeeId));
            } else {
              // Show own requests + requests to approve as manager
              conditions.push(
                or(
                  eq(trainingRequests.employeeId, employeeId),
                  sql`${trainingRequests.employeeId} IN (
                    SELECT id FROM employees WHERE reporting_manager_id = ${employeeId}
                  )`
                )!
              );
            }
          } else {
            return { data: [], total: 0, hasMore: false };
          }
        }

        if (input.employeeId) {
          conditions.push(eq(trainingRequests.employeeId, input.employeeId));
        }

        if (input.status) {
          conditions.push(eq(trainingRequests.status, input.status));
        }

        const requestsList = await ctx.db
          .select({
            request: trainingRequests,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
            course: {
              id: trainingCourses.id,
              name: trainingCourses.name,
            },
          })
          .from(trainingRequests)
          .leftJoin(employees, eq(trainingRequests.employeeId, employees.id))
          .leftJoin(trainingCourses, eq(trainingRequests.courseId, trainingCourses.id))
          .where(and(...conditions))
          .orderBy(desc(trainingRequests.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(trainingRequests)
          .where(and(...conditions));

        return {
          data: requestsList.map(r => ({
            ...r.request,
            employee: r.employee,
            course: r.course,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        courseId: z.string().uuid().optional(), // From catalog
        customCourseName: z.string().optional(), // Or custom
        customCourseDescription: z.string().optional(),
        justification: z.string().min(1),
        requestOrigin: z.enum(['self', 'manager', 'evaluation', 'mandatory']).default('self'),
        linkedObjectiveId: z.string().uuid().optional(),
        preferredStartDate: z.string().optional(),
        preferredEndDate: z.string().optional(),
        urgency: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
        estimatedCost: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Get employee ID for current user
        const employeeId = ctx.user.employeeId;

        if (!employeeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Vous devez être un employé pour demander une formation',
          });
        }

        // Verify course exists if provided
        if (input.courseId) {
          const [course] = await ctx.db
            .select()
            .from(trainingCourses)
            .where(and(
              eq(trainingCourses.id, input.courseId),
              eq(trainingCourses.tenantId, tenantId)
            ));

          if (!course) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Formation non trouvée',
            });
          }
        }

        // Generate reference number
        const year = new Date().getFullYear();
        const [countResult] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(trainingRequests)
          .where(eq(trainingRequests.tenantId, tenantId));
        const referenceNumber = `TR-${year}-${String(countResult.count + 1).padStart(4, '0')}`;

        const [created] = await ctx.db
          .insert(trainingRequests)
          .values({
            tenantId,
            referenceNumber,
            employeeId,
            courseId: input.courseId,
            customCourseName: input.customCourseName,
            customCourseDescription: input.customCourseDescription,
            justification: input.justification,
            requestOrigin: input.requestOrigin,
            linkedObjectiveId: input.linkedObjectiveId,
            preferredStartDate: input.preferredStartDate,
            preferredEndDate: input.preferredEndDate,
            urgency: input.urgency,
            estimatedCost: input.estimatedCost,
            status: 'submitted',
            submittedAt: new Date(),
          })
          .returning();

        return created;
      }),

    approve: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        comment: z.string().optional(),
        approvedBudget: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [request] = await ctx.db
          .select()
          .from(trainingRequests)
          .where(and(
            eq(trainingRequests.id, input.id),
            eq(trainingRequests.tenantId, tenantId)
          ));

        if (!request) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Demande non trouvée',
          });
        }

        // Determine next status based on current status
        let nextStatus: string;
        let updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (request.status === 'submitted') {
          nextStatus = 'manager_approved';
          updateData = {
            ...updateData,
            status: nextStatus,
            managerApprovalStatus: 'approved',
            managerApprovedBy: ctx.user.id,
            managerApprovedAt: new Date(),
            managerComment: input.comment,
          };
        } else if (request.status === 'manager_approved') {
          nextStatus = 'hr_approved';
          updateData = {
            ...updateData,
            status: nextStatus,
            hrApprovalStatus: 'approved',
            hrApprovedBy: ctx.user.id,
            hrApprovedAt: new Date(),
            hrComment: input.comment,
            approvedBudget: input.approvedBudget,
          };
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cette demande ne peut pas être approuvée dans son état actuel',
          });
        }

        const [updated] = await ctx.db
          .update(trainingRequests)
          .set(updateData)
          .where(eq(trainingRequests.id, input.id))
          .returning();

        return updated;
      }),

    reject: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        rejectionReason: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [request] = await ctx.db
          .select()
          .from(trainingRequests)
          .where(and(
            eq(trainingRequests.id, input.id),
            eq(trainingRequests.tenantId, tenantId)
          ));

        if (!request) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Demande non trouvée',
          });
        }

        const [updated] = await ctx.db
          .update(trainingRequests)
          .set({
            status: 'rejected',
            rejectionReason: input.rejectionReason,
            rejectedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(trainingRequests.id, input.id))
          .returning();

        return updated;
      }),
  }),

  // ============================================================================
  // TRAINING PLANS
  // ============================================================================

  plans: createTRPCRouter({
    list: hrManagerProcedure
      .input(z.object({
        year: z.number().optional(),
        status: z.enum(['draft', 'submitted', 'approved', 'in_progress', 'completed']).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(trainingPlans.tenantId, tenantId)];

        if (input.year) {
          conditions.push(eq(trainingPlans.year, input.year));
        }

        if (input.status) {
          conditions.push(eq(trainingPlans.status, input.status));
        }

        const plansList = await ctx.db
          .select()
          .from(trainingPlans)
          .where(and(...conditions))
          .orderBy(desc(trainingPlans.year));

        // Get item counts per plan
        const planIds = plansList.map(p => p.id);
        let itemCounts: Record<string, { total: number; totalBudget: number }> = {};

        if (planIds.length > 0) {
          const counts = await ctx.db
            .select({
              planId: trainingPlanItems.planId,
              count: sql<number>`count(*)::int`,
              totalBudget: sql<number>`coalesce(sum(${trainingPlanItems.budgetAllocated}), 0)::numeric`,
            })
            .from(trainingPlanItems)
            .where(inArray(trainingPlanItems.planId, planIds))
            .groupBy(trainingPlanItems.planId);

          itemCounts = Object.fromEntries(
            counts.map(c => [c.planId, { total: c.count, totalBudget: Number(c.totalBudget) }])
          );
        }

        return plansList.map(p => ({
          ...p,
          itemCount: itemCounts[p.id]?.total ?? 0,
          itemsAllocatedBudget: itemCounts[p.id]?.totalBudget ?? 0,
        }));
      }),

    getById: hrManagerProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [plan] = await ctx.db
          .select()
          .from(trainingPlans)
          .where(and(
            eq(trainingPlans.id, input.id),
            eq(trainingPlans.tenantId, tenantId)
          ));

        if (!plan) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Plan de formation non trouvé',
          });
        }

        // Get plan items with course info
        const items = await ctx.db
          .select({
            item: trainingPlanItems,
            course: {
              id: trainingCourses.id,
              name: trainingCourses.name,
              code: trainingCourses.code,
            },
          })
          .from(trainingPlanItems)
          .leftJoin(trainingCourses, eq(trainingPlanItems.courseId, trainingCourses.id))
          .where(eq(trainingPlanItems.planId, input.id))
          .orderBy(asc(trainingPlanItems.priority));

        return {
          ...plan,
          items: items.map(i => ({
            ...i.item,
            course: i.course,
          })),
        };
      }),

    create: hrManagerProcedure
      .input(z.object({
        year: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        totalBudget: z.string(),
        currency: z.string().default('XOF'),
        departmentId: z.string().uuid().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [created] = await ctx.db
          .insert(trainingPlans)
          .values({
            tenantId,
            year: input.year,
            name: input.name,
            description: input.description,
            totalBudget: input.totalBudget,
            currency: input.currency,
            departmentId: input.departmentId,
            status: 'draft',
            createdBy: ctx.user.id,
          })
          .returning();

        return created;
      }),

    addItem: hrManagerProcedure
      .input(z.object({
        planId: z.string().uuid(),
        courseId: z.string().uuid().optional(),
        customCourseName: z.string().optional(),
        targetParticipantCount: z.number().min(1),
        targetDepartmentIds: z.array(z.string().uuid()).optional(),
        plannedQuarter: z.number().min(1).max(4).optional(),
        plannedMonth: z.number().min(1).max(12).optional(),
        budgetAllocated: z.string(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        // Verify plan exists and is editable
        const [plan] = await ctx.db
          .select()
          .from(trainingPlans)
          .where(and(
            eq(trainingPlans.id, input.planId),
            eq(trainingPlans.tenantId, tenantId)
          ));

        if (!plan) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Plan de formation non trouvé',
          });
        }

        if (plan.status !== 'draft') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Seuls les plans en brouillon peuvent être modifiés',
          });
        }

        const [created] = await ctx.db
          .insert(trainingPlanItems)
          .values({
            tenantId,
            planId: input.planId,
            courseId: input.courseId,
            customCourseName: input.customCourseName,
            targetParticipantCount: input.targetParticipantCount,
            targetDepartmentIds: input.targetDepartmentIds ?? [],
            plannedQuarter: input.plannedQuarter,
            plannedMonth: input.plannedMonth,
            budgetAllocated: input.budgetAllocated,
            priority: input.priority,
            notes: input.notes,
          })
          .returning();

        return created;
      }),

    updateStatus: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        status: z.enum(['draft', 'submitted', 'approved', 'in_progress', 'completed']),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [plan] = await ctx.db
          .select()
          .from(trainingPlans)
          .where(and(
            eq(trainingPlans.id, input.id),
            eq(trainingPlans.tenantId, tenantId)
          ));

        if (!plan) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Plan de formation non trouvé',
          });
        }

        const [updated] = await ctx.db
          .update(trainingPlans)
          .set({
            status: input.status,
            approvedAt: input.status === 'approved' ? new Date() : plan.approvedAt,
            approvedBy: input.status === 'approved' ? ctx.user.id : plan.approvedBy,
            updatedAt: new Date(),
          })
          .where(eq(trainingPlans.id, input.id))
          .returning();

        return updated;
      }),
  }),

  // ============================================================================
  // CERTIFICATIONS
  // ============================================================================

  certifications: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        employeeId: z.string().uuid().optional(),
        status: z.enum(['active', 'expired', 'expiring_soon', 'pending_renewal', 'revoked']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(employeeCertifications.tenantId, tenantId)];

        if (input.employeeId) {
          conditions.push(eq(employeeCertifications.employeeId, input.employeeId));
        }

        if (input.status === 'active') {
          conditions.push(eq(employeeCertifications.status, 'active'));
        } else if (input.status === 'expired') {
          conditions.push(eq(employeeCertifications.status, 'expired'));
        } else if (input.status === 'expiring_soon') {
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          conditions.push(
            and(
              eq(employeeCertifications.status, 'active'),
              gte(employeeCertifications.expiryDate, new Date().toISOString().split('T')[0]),
              lte(employeeCertifications.expiryDate, thirtyDaysFromNow.toISOString().split('T')[0])
            )!
          );
        } else if (input.status) {
          conditions.push(eq(employeeCertifications.status, input.status));
        }

        const certificationsList = await ctx.db
          .select({
            certification: employeeCertifications,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
          })
          .from(employeeCertifications)
          .leftJoin(employees, eq(employeeCertifications.employeeId, employees.id))
          .where(and(...conditions))
          .orderBy(asc(employeeCertifications.expiryDate))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(employeeCertifications)
          .where(and(...conditions));

        return {
          data: certificationsList.map(c => ({
            ...c.certification,
            employee: c.employee,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    create: hrManagerProcedure
      .input(z.object({
        employeeId: z.string().uuid(),
        certificationName: z.string().min(1),
        certificationCode: z.string().optional(),
        issuingOrganization: z.string().min(1),
        category: z.string().optional(),
        issueDate: z.string(),
        expiryDate: z.string().optional(),
        isLifetime: z.boolean().default(false),
        credentialId: z.string().optional(),
        verificationUrl: z.string().optional(),
        linkedEnrollmentId: z.string().uuid().optional(),
        linkedCourseId: z.string().uuid().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const [created] = await ctx.db
          .insert(employeeCertifications)
          .values({
            tenantId,
            employeeId: input.employeeId,
            certificationName: input.certificationName,
            certificationCode: input.certificationCode,
            issuingOrganization: input.issuingOrganization,
            category: input.category,
            issueDate: input.issueDate,
            expiryDate: input.expiryDate,
            isLifetime: input.isLifetime,
            credentialId: input.credentialId,
            verificationUrl: input.verificationUrl,
            linkedEnrollmentId: input.linkedEnrollmentId,
            linkedCourseId: input.linkedCourseId,
            status: 'active',
            createdBy: ctx.user.id,
          })
          .returning();

        return created;
      }),

    update: hrManagerProcedure
      .input(z.object({
        id: z.string().uuid(),
        certificationName: z.string().min(1).optional(),
        issuingOrganization: z.string().optional(),
        category: z.string().optional(),
        issueDate: z.string().optional(),
        expiryDate: z.string().nullable().optional(),
        credentialId: z.string().optional(),
        verificationUrl: z.string().nullable().optional(),
        status: z.enum(['active', 'expired', 'pending_renewal', 'revoked']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const { id, ...updates } = input;

        const [certification] = await ctx.db
          .select()
          .from(employeeCertifications)
          .where(and(
            eq(employeeCertifications.id, id),
            eq(employeeCertifications.tenantId, tenantId)
          ));

        if (!certification) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Certification non trouvée',
          });
        }

        const [updated] = await ctx.db
          .update(employeeCertifications)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(employeeCertifications.id, id))
          .returning();

        return updated;
      }),

    getExpiringSoon: hrManagerProcedure
      .input(z.object({
        days: z.number().min(1).max(365).default(30),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + input.days);

        const expiring = await ctx.db
          .select({
            certification: employeeCertifications,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
              email: employees.email,
            },
          })
          .from(employeeCertifications)
          .leftJoin(employees, eq(employeeCertifications.employeeId, employees.id))
          .where(and(
            eq(employeeCertifications.tenantId, tenantId),
            eq(employeeCertifications.status, 'active'),
            gte(employeeCertifications.expiryDate, new Date().toISOString().split('T')[0]),
            lte(employeeCertifications.expiryDate, futureDate.toISOString().split('T')[0])
          ))
          .orderBy(asc(employeeCertifications.expiryDate));

        return expiring.map(e => ({
          ...e.certification,
          employee: e.employee,
          daysUntilExpiry: e.certification.expiryDate
            ? Math.ceil((new Date(e.certification.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : null,
        }));
      }),
  }),

  // ============================================================================
  // SKILLS INVENTORY
  // ============================================================================

  skills: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({
        employeeId: z.string().uuid().optional(),
        skillCategory: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const conditions = [eq(employeeSkills.tenantId, tenantId)];

        if (input.employeeId) {
          conditions.push(eq(employeeSkills.employeeId, input.employeeId));
        }

        if (input.skillCategory) {
          conditions.push(eq(employeeSkills.skillCategory, input.skillCategory));
        }

        const skillsList = await ctx.db
          .select({
            skill: employeeSkills,
            employee: {
              id: employees.id,
              firstName: employees.firstName,
              lastName: employees.lastName,
            },
          })
          .from(employeeSkills)
          .leftJoin(employees, eq(employeeSkills.employeeId, employees.id))
          .where(and(...conditions))
          .orderBy(asc(employeeSkills.skillName))
          .limit(input.limit)
          .offset(input.offset);

        const [{ count: total }] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(employeeSkills)
          .where(and(...conditions));

        return {
          data: skillsList.map(s => ({
            ...s.skill,
            employee: s.employee,
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        employeeId: z.string().uuid().optional(), // If not provided, use current user's employee
        skillName: z.string().min(1),
        skillCategory: z.string().optional(),
        proficiencyLevel: z.number().min(1).max(5),
        source: z.enum(['self_declared', 'assessment', 'training', 'certification']).default('self_declared'),
        evidenceNotes: z.string().optional(),
        linkedCompetencyId: z.string().uuid().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        let employeeId = input.employeeId;

        // If no employee ID provided, get current user's employee record
        if (!employeeId) {
          employeeId = ctx.user.employeeId;

          if (!employeeId) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Employé non trouvé',
            });
          }
        }

        const [created] = await ctx.db
          .insert(employeeSkills)
          .values({
            tenantId,
            employeeId,
            skillName: input.skillName,
            skillCategory: input.skillCategory,
            proficiencyLevel: input.proficiencyLevel,
            source: input.source,
            evidenceNotes: input.evidenceNotes,
            linkedCompetencyId: input.linkedCompetencyId,
          })
          .returning();

        return created;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        proficiencyLevel: z.number().min(1).max(5).optional(),
        evidenceNotes: z.string().optional(),
        isValidated: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;
        const { id, ...updates } = input;

        const [skill] = await ctx.db
          .select()
          .from(employeeSkills)
          .where(and(
            eq(employeeSkills.id, id),
            eq(employeeSkills.tenantId, tenantId)
          ));

        if (!skill) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Compétence non trouvée',
          });
        }

        const updateData: Record<string, unknown> = {
          ...updates,
          updatedAt: new Date(),
        };

        if (updates.isValidated) {
          updateData.validatedBy = ctx.user.id;
          updateData.validatedAt = new Date();
        }

        const [updated] = await ctx.db
          .update(employeeSkills)
          .set(updateData)
          .where(eq(employeeSkills.id, id))
          .returning();

        return updated;
      }),

    getCategories: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = ctx.user.tenantId;

      const categories = await ctx.db
        .selectDistinct({ category: employeeSkills.skillCategory })
        .from(employeeSkills)
        .where(eq(employeeSkills.tenantId, tenantId))
        .orderBy(asc(employeeSkills.skillCategory));

      return categories.map(c => c.category).filter(Boolean) as string[];
    }),
  }),

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  dashboard: createTRPCRouter({
    stats: hrManagerProcedure.query(async ({ ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Active courses
      const [activeCourses] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(trainingCourses)
        .where(and(
          eq(trainingCourses.tenantId, tenantId),
          eq(trainingCourses.isActive, true)
        ));

      // Upcoming sessions
      const [upcomingSessions] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(trainingSessions)
        .where(and(
          eq(trainingSessions.tenantId, tenantId),
          eq(trainingSessions.status, 'scheduled'),
          gte(trainingSessions.startDate, new Date().toISOString().split('T')[0])
        ));

      // Pending requests
      const [pendingRequests] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(trainingRequests)
        .where(and(
          eq(trainingRequests.tenantId, tenantId),
          or(
            eq(trainingRequests.status, 'submitted'),
            eq(trainingRequests.status, 'manager_approved')
          )
        ));

      // Expiring certifications (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const [expiringCertifications] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(employeeCertifications)
        .where(and(
          eq(employeeCertifications.tenantId, tenantId),
          eq(employeeCertifications.status, 'active'),
          gte(employeeCertifications.expiryDate, new Date().toISOString().split('T')[0]),
          lte(employeeCertifications.expiryDate, thirtyDaysFromNow.toISOString().split('T')[0])
        ));

      // Training completed this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [completedThisMonth] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(trainingEnrollments)
        .where(and(
          eq(trainingEnrollments.tenantId, tenantId),
          eq(trainingEnrollments.status, 'completed'),
          gte(trainingEnrollments.completedAt, startOfMonth)
        ));

      return {
        activeCourses: activeCourses.count,
        upcomingSessions: upcomingSessions.count,
        pendingRequests: pendingRequests.count,
        expiringCertifications: expiringCertifications.count,
        completedThisMonth: completedThisMonth.count,
      };
    }),

    upcomingSessions: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(20).default(5),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = ctx.user.tenantId;

        const sessions = await ctx.db
          .select({
            session: trainingSessions,
            course: {
              id: trainingCourses.id,
              name: trainingCourses.name,
              modality: trainingCourses.modality,
            },
          })
          .from(trainingSessions)
          .leftJoin(trainingCourses, eq(trainingSessions.courseId, trainingCourses.id))
          .where(and(
            eq(trainingSessions.tenantId, tenantId),
            eq(trainingSessions.status, 'scheduled'),
            gte(trainingSessions.startDate, new Date().toISOString().split('T')[0])
          ))
          .orderBy(asc(trainingSessions.startDate))
          .limit(input.limit);

        // Get enrollment counts
        const sessionIds = sessions.map(s => s.session.id);
        let enrollmentCounts: Record<string, number> = {};

        if (sessionIds.length > 0) {
          const counts = await ctx.db
            .select({
              sessionId: trainingEnrollments.sessionId,
              count: sql<number>`count(*)::int`,
            })
            .from(trainingEnrollments)
            .where(inArray(trainingEnrollments.sessionId, sessionIds))
            .groupBy(trainingEnrollments.sessionId);

          enrollmentCounts = Object.fromEntries(
            counts.map(c => [c.sessionId, c.count])
          );
        }

        return sessions.map(s => ({
          ...s.session,
          course: s.course,
          enrollmentCount: enrollmentCounts[s.session.id] ?? 0,
        }));
      }),

    myTraining: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = ctx.user.tenantId;
      const employeeId = ctx.user.employeeId;

      if (!employeeId) {
        return { upcomingEnrollments: [], pendingRequests: [], expiringCertifications: [] };
      }

      // Upcoming enrollments
      const upcomingEnrollments = await ctx.db
        .select({
          enrollment: trainingEnrollments,
          session: {
            id: trainingSessions.id,
            startDate: trainingSessions.startDate,
            location: trainingSessions.location,
          },
          course: {
            id: trainingCourses.id,
            name: trainingCourses.name,
          },
        })
        .from(trainingEnrollments)
        .leftJoin(trainingSessions, eq(trainingEnrollments.sessionId, trainingSessions.id))
        .leftJoin(trainingCourses, eq(trainingSessions.courseId, trainingCourses.id))
        .where(and(
          eq(trainingEnrollments.employeeId, employeeId),
          eq(trainingEnrollments.status, 'enrolled'),
          gte(trainingSessions.startDate, new Date().toISOString().split('T')[0])
        ))
        .orderBy(asc(trainingSessions.startDate))
        .limit(5);

      // Pending requests
      const pendingRequests = await ctx.db
        .select({
          request: trainingRequests,
          course: {
            name: trainingCourses.name,
          },
        })
        .from(trainingRequests)
        .leftJoin(trainingCourses, eq(trainingRequests.courseId, trainingCourses.id))
        .where(and(
          eq(trainingRequests.employeeId, employeeId),
          or(
            eq(trainingRequests.status, 'submitted'),
            eq(trainingRequests.status, 'manager_approved')
          )
        ))
        .orderBy(desc(trainingRequests.createdAt))
        .limit(5);

      // Expiring certifications
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiringCertifications = await ctx.db
        .select()
        .from(employeeCertifications)
        .where(and(
          eq(employeeCertifications.employeeId, employeeId),
          eq(employeeCertifications.status, 'active'),
          gte(employeeCertifications.expiryDate, new Date().toISOString().split('T')[0]),
          lte(employeeCertifications.expiryDate, thirtyDaysFromNow.toISOString().split('T')[0])
        ))
        .orderBy(asc(employeeCertifications.expiryDate))
        .limit(5);

      return {
        upcomingEnrollments: upcomingEnrollments.map(e => ({
          ...e.enrollment,
          session: e.session,
          course: e.course,
        })),
        pendingRequests: pendingRequests.map(r => ({
          ...r.request,
          courseName: r.course?.name ?? r.request.customCourseName,
        })),
        expiringCertifications,
      };
    }),
  }),
});
